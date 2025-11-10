import { GoogleGenerativeAI } from '@google/generative-ai';
import { storage } from './storage';
import { knowledgeBaseService } from './knowledge-base-service';
import { BasicEmailAnalyzer } from './basic-email-analyzer';
import { CircuitBreaker } from './circuit-breaker';
import type { OperationAnalysis } from '@shared/schema';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Operation Analysis Service
 * Generates AI-powered insights about operations based on linked emails
 */
export class OperationAnalysisService {
  private model;
  private basicAnalyzer: BasicEmailAnalyzer;
  private circuitBreaker: CircuitBreaker;
  
  constructor() {
    this.basicAnalyzer = new BasicEmailAnalyzer();
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 15 * 60 * 1000 // 15 minutes
    });
    this.model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp', // Using latest flash model
      systemInstruction: `You are an expert logistics and freight forwarding assistant specialized in creating self-explanatory operation reports.

CRITICAL REQUIREMENT: Your analysis must be understandable by ANY employee (even those not assigned to this operation) without needing to read the original emails or ask questions to the assigned team.

ANALYSIS FORMAT (MANDATORY SECTIONS):

**CONTEXTO DE NEGOCIO** (Business Context - MANDATORY)
Explica de qué trata esta operación en términos que cualquier empleado nuevo pueda entender:
- ¿Qué tipo de operación es? (importación, exportación, transporte doméstico, etc.)
- ¿Quiénes son los participantes principales? (cliente, proveedor, agente aduanal, transportista)
- ¿Cuál es el objetivo de negocio?
- Referencias clave (números de tracking, BL/AWB, fechas importantes)

**ESTADO ACTUAL** (Current Status)
Resumen ejecutivo del estado de la operación basado en evidencia de los correos

**ACTUALIZACIONES CLAVE** (Key Updates)
Desarrollos importantes de los correos recientes (NO copies literalmente frases de correos, INTERPRETA)

**RIESGOS Y ALERTAS** (Risk Flags)
Identifica problemas potenciales, demoras, documentación faltante

**ACCIONES REQUERIDAS** (Action Items)
Lista priorizada de qué debe hacerse

**PRÓXIMOS PASOS** (Next Steps)
Acciones inmediatas recomendadas con responsables sugeridos

**DEPENDENCIAS EXTERNAS** (External Dependencies)
Qué se está esperando de terceros (cliente, agente aduanal, naviera, etc.)

REGLAS CRÍTICAS:
1. NUNCA uses emoji en tu respuesta
2. La sección "Contexto de Negocio" es OBLIGATORIA y debe ser autoexplicativa
3. NO copies frases literales de correos - INTERPRETA y resume profesionalmente
4. Incluye números de referencia, fechas, nombres de empresas (NO empleados internos)
5. Usa terminología profesional de logística
6. Si la información es escasa, genera un resumen coherente con lo disponible
7. Máximo 600 palabras total
8. SIEMPRE responde en ESPAÑOL

LENGUAJE: Siempre en ESPAÑOL (Español).`
    });
  }

  /**
   * Generate analysis for an operation
   */
  async generateAnalysis(operationId: string): Promise<string> {
    try {
      console.log(`[Analysis] Generating analysis for operation ${operationId}`);

      // Get operation details
      const operation = await storage.getOperation(operationId);
      if (!operation) {
        throw new Error('Operation not found');
      }

      // Get linked emails
      const emails = await storage.getGmailMessagesByOperation(operationId);
      console.log(`[Analysis] Found ${emails.length} linked emails`);

      // Get tasks and notes
      const [tasks, notes, files] = await Promise.all([
        storage.getOperationTasks(operationId),
        storage.getOperationNotes(operationId),
        storage.getOperationFiles(operationId)
      ]);

      // Prepare context for AI
      const emailSummaries = emails.slice(0, 20).map((email: any, idx: number) => {
        return `Email ${idx + 1}:
From: ${email.from}
To: ${email.to}
Subject: ${email.subject}
Date: ${new Date(email.date).toLocaleDateString('es-ES')}
Snippet: ${email.snippet || 'No preview available'}
---`;
      }).join('\n\n');

      const tasksSummary = tasks.map(t => 
        `- [${t.status}] ${t.title} (${t.priority})`
      ).join('\n');

      const notesSummary = notes.slice(0, 10).map((n, idx) => 
        `Note ${idx + 1}: ${n.content.substring(0, 150)}...`
      ).join('\n');

      const prompt = `Analyze this freight forwarding operation and provide professional feedback:

**OPERATION DETAILS:**
Name: ${operation.name}
Description: ${operation.description || 'No description'}
Status: ${operation.status}
Category: ${operation.projectCategory}
Type: ${operation.operationType}
Shipping Mode: ${operation.shippingMode}
Priority: ${operation.priority}
Start Date: ${new Date(operation.startDate).toLocaleDateString('es-ES')}
${operation.endDate ? `End Date: ${new Date(operation.endDate).toLocaleDateString('es-ES')}` : ''}
${operation.courier ? `Courier: ${operation.courier}` : ''}
${operation.bookingTracking ? `Booking/Tracking: ${operation.bookingTracking}` : ''}
${operation.pickUpAddress ? `Pickup: ${operation.pickUpAddress}` : ''}
${operation.deliveryAddress ? `Delivery: ${operation.deliveryAddress}` : ''}
${operation.etd ? `ETD: ${new Date(operation.etd).toLocaleDateString('es-ES')}` : ''}
${operation.eta ? `ETA: ${new Date(operation.eta).toLocaleDateString('es-ES')}` : ''}
${operation.mblAwb ? `MBL/AWB: ${operation.mblAwb}` : ''}
${operation.hblAwb ? `HBL/AWB: ${operation.hblAwb}` : ''}

**LINKED EMAILS (${emails.length} total, showing recent):**
${emailSummaries || 'No emails linked to this operation'}

**TASKS (${tasks.length} total):**
${tasksSummary || 'No tasks created'}

**RECENT NOTES (${notes.length} total):**
${notesSummary || 'No notes available'}

**FILES:**
${files.length} files uploaded

Based on this information, provide a comprehensive analysis of the operation's current status, identify pending actions, potential issues, and provide professional recommendations for the logistics team.`;

      // Generate analysis
      const result = await this.model.generateContent(prompt);
      const analysis = result.response.text();

      console.log(`[Analysis] Generated ${analysis.length} characters of analysis`);
      return analysis;

    } catch (error: any) {
      console.error('[Analysis] Error generating analysis:', error);
      throw new Error(`Failed to generate analysis: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Generate fallback analysis using open-source rule-based system (no AI required)
   * This ensures the user ALWAYS gets a professional analysis, even when Gemini fails
   */
  async generateFallbackAnalysis(operationId: string): Promise<string> {
    console.log('[Analysis] Generating fallback analysis (rule-based, no AI)');
    
    try {
      // Get operation details
      const operation = await storage.getOperation(operationId);
      if (!operation) {
        throw new Error('Operation not found');
      }

      // Get linked data
      const [emails, tasks, notes, files] = await Promise.all([
        storage.getGmailMessagesByOperation(operationId),
        storage.getOperationTasks(operationId),
        storage.getOperationNotes(operationId),
        storage.getOperationFiles(operationId)
      ]);

      // Analyze emails with basic analyzer to get executive summary
      let executiveSummary = null;
      if (emails.length > 0) {
        const emailMessages = emails.map(email => ({
          id: email.id,
          from: email.from,
          subject: email.subject,
          snippet: email.snippet || '',
          body: email.snippet || '',
          date: new Date(email.date)
        }));
        
        const analysisResult = await this.basicAnalyzer.analyzeEmailThread(emailMessages);
        executiveSummary = analysisResult.executiveSummary;
      }

      // Build professional fallback analysis matching Gemini format
      let analysis = '';

      // CONTEXTO DE NEGOCIO (Business Context)
      analysis += '**CONTEXTO DE NEGOCIO**\n\n';
      if (executiveSummary?.businessContext) {
        analysis += executiveSummary.businessContext + '\n\n';
      } else {
        // Generate basic context from operation data
        analysis += `Esta es una operación de ${operation.operationType || 'logística'}`;
        if (operation.shippingMode) {
          analysis += ` por ${operation.shippingMode}`;
        }
        analysis += `. Nombre de operación: ${operation.name}`;
        if (operation.bookingTracking) {
          analysis += `. Referencia: ${operation.bookingTracking}`;
        }
        if (operation.courier) {
          analysis += `. Courier/Transportista: ${operation.courier}`;
        }
        analysis += `.\n\n`;
      }

      // Agregar participantes si están disponibles
      if (executiveSummary?.stakeholders && executiveSummary.stakeholders.length > 0) {
        analysis += `Participantes externos: ${executiveSummary.stakeholders.join(', ')}.\n\n`;
      }

      // ESTADO ACTUAL (Current Status)
      analysis += '**ESTADO ACTUAL**\n\n';
      analysis += `Estado de operación: ${operation.status}\n`;
      analysis += `Prioridad: ${operation.priority}\n`;
      if (operation.startDate) {
        analysis += `Fecha de inicio: ${new Date(operation.startDate).toLocaleDateString('es-ES')}\n`;
      }
      if (operation.endDate) {
        analysis += `Fecha de fin: ${new Date(operation.endDate).toLocaleDateString('es-ES')}\n`;
      }
      if (operation.etd) {
        analysis += `ETD (Fecha estimada de salida): ${new Date(operation.etd).toLocaleDateString('es-ES')}\n`;
      }
      if (operation.eta) {
        analysis += `ETA (Fecha estimada de arribo): ${new Date(operation.eta).toLocaleDateString('es-ES')}\n`;
      }
      analysis += `\nComunicaciones registradas: ${emails.length} correos electrónicos\n`;
      analysis += `Archivos adjuntos: ${files.length} documentos\n\n`;

      // RIESGOS Y ALERTAS (Risk Flags)
      analysis += '**RIESGOS Y ALERTAS**\n\n';
      if (executiveSummary?.riskFlags && executiveSummary.riskFlags.length > 0) {
        executiveSummary.riskFlags.forEach(flag => {
          analysis += `- ${flag}\n`;
        });
      } else {
        analysis += '- Sin alertas detectadas en este momento\n';
      }
      analysis += '\n';

      // ACCIONES REQUERIDAS (Action Items)
      analysis += '**ACCIONES REQUERIDAS**\n\n';
      if (tasks.length > 0) {
        const urgentTasks = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed');
        const highTasks = tasks.filter(t => t.priority === 'high' && t.status !== 'completed');
        const otherTasks = tasks.filter(t => !['urgent', 'high'].includes(t.priority) && t.status !== 'completed');

        if (urgentTasks.length > 0) {
          analysis += 'URGENTE:\n';
          urgentTasks.forEach(task => {
            analysis += `- ${task.title} [${task.status}]\n`;
          });
          analysis += '\n';
        }

        if (highTasks.length > 0) {
          analysis += 'ALTA PRIORIDAD:\n';
          highTasks.forEach(task => {
            analysis += `- ${task.title} [${task.status}]\n`;
          });
          analysis += '\n';
        }

        if (otherTasks.length > 0 && otherTasks.length <= 5) {
          analysis += 'NORMAL:\n';
          otherTasks.forEach(task => {
            analysis += `- ${task.title} [${task.status}]\n`;
          });
          analysis += '\n';
        } else if (otherTasks.length > 5) {
          analysis += `NORMAL: ${otherTasks.length} tareas adicionales registradas\n\n`;
        }
      } else {
        analysis += 'No se han registrado tareas pendientes para esta operación.\n\n';
      }

      // DEPENDENCIAS EXTERNAS (External Dependencies)
      analysis += '**DEPENDENCIAS EXTERNAS**\n\n';
      if (executiveSummary?.pendingDependencies && executiveSummary.pendingDependencies.length > 0) {
        executiveSummary.pendingDependencies.forEach(dep => {
          analysis += `- ${dep}\n`;
        });
      } else {
        analysis += '- No se detectaron dependencias externas pendientes\n';
      }
      analysis += '\n';

      // FECHAS CLAVE (Key Milestones)
      if (executiveSummary?.keyMilestones && executiveSummary.keyMilestones.length > 0) {
        analysis += '**FECHAS CLAVE**\n\n';
        executiveSummary.keyMilestones.forEach(milestone => {
          analysis += `- ${milestone}\n`;
        });
        analysis += '\n';
      }

      // PRÓXIMOS PASOS (Next Steps)
      analysis += '**PRÓXIMOS PASOS**\n\n';
      const pendingTasks = tasks.filter(t => t.status === 'pending').slice(0, 3);
      if (pendingTasks.length > 0) {
        analysis += 'Basado en las tareas registradas:\n';
        pendingTasks.forEach((task, idx) => {
          analysis += `${idx + 1}. ${task.title}\n`;
        });
      } else {
        analysis += '1. Revisar el estado de la operación con el equipo asignado\n';
        analysis += '2. Verificar que toda la documentación esté completa\n';
        analysis += '3. Confirmar fechas clave con los participantes\n';
      }
      analysis += '\n';

      // Agregar nota sobre el método de generación
      analysis += '---\n';
      analysis += '*Nota: Este resumen fue generado automáticamente usando análisis basado en reglas (sistema open-source). Para un análisis más detallado con IA, el sistema reintentará cuando el servicio esté disponible.*\n';

      console.log(`[Analysis] Generated fallback analysis: ${analysis.length} characters`);
      return analysis;

    } catch (error: any) {
      console.error('[Analysis] Error generating fallback analysis:', error);
      // Incluso si el fallback falla, retornamos algo profesional
      return `**RESUMEN DE OPERACIÓN**\n\nOperación: ${operationId}\n\nEl sistema está procesando esta operación. Por favor, revise los correos, tareas y archivos asociados directamente para obtener más detalles.\n\n**NOTA**: El análisis automático no está disponible temporalmente. El equipo de soporte técnico ha sido notificado.`;
    }
  }

  /**
   * Get cached analysis or generate new one (with knowledge base learning)
   */
  async getOrGenerateAnalysis(operationId: string): Promise<OperationAnalysis> {
    try {
      // Check for existing, valid cache (24 hours)
      const existing = await storage.getOperationAnalysis(operationId);
      
      if (existing && existing.status === 'ready') {
        const now = new Date();
        const expiresAt = new Date(existing.expiresAt);
        
        // Return cached if not expired (24 hours)
        if (expiresAt > now) {
          console.log(`[Analysis] Using cached analysis for operation ${operationId}`);
          return existing;
        }
      }

      // Get operation data for knowledge matching
      const operation = await storage.getOperation(operationId);
      if (!operation) {
        throw new Error('Operation not found');
      }

      console.log(`[Analysis] Looking for similar knowledge for operation ${operationId}`);
      
      // Try to find similar knowledge first (LEARNING SYSTEM)
      const similarKnowledge = await knowledgeBaseService.findSimilarKnowledge(operation);

      if (similarKnowledge && similarKnowledge.score >= 60) {
        console.log(`[Analysis] 🎓 REUSING KNOWLEDGE (score: ${similarKnowledge.score}%) - Saving Gemini API call!`);
        
        // Reuse existing knowledge
        const adaptedAnalysis = await knowledgeBaseService.reuseKnowledge(
          similarKnowledge.knowledge.id,
          operation
        );

        if (adaptedAnalysis) {
          // Save as cached analysis
          const cachedAnalysis = await storage.createOperationAnalysis({
            operationId,
            analysis: adaptedAnalysis,
            emailsAnalyzed: similarKnowledge.knowledge.emailCount,
            status: 'ready',
            generatedAt: new Date(),
            expiresAt: new Date(Date.now() + 86400000) // 24 hour cache
          });

          return cachedAnalysis;
        }
      }

      // No similar knowledge found - generate new with Gemini
      console.log(`[Analysis] 🤖 CALLING GEMINI API - No similar knowledge found`);
      
      // Create pending record
      const pendingAnalysis = await storage.createOperationAnalysis({
        operationId,
        analysis: 'Generating analysis...',
        emailsAnalyzed: 0,
        status: 'generating',
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000) // 24 hour expiration
      });

      try {
        // Verificar circuit breaker antes de intentar con Gemini
        if (!this.circuitBreaker.canMakeRequest()) {
          console.warn('[Analysis] Circuit breaker OPEN - usando fallback inmediatamente');
          throw new Error('Circuit breaker is OPEN - using fallback');
        }

        // Get context
        const [emails, tasks, files] = await Promise.all([
          storage.getGmailMessagesByOperation(operationId),
          storage.getOperationTasks(operationId),
          storage.getOperationFiles(operationId)
        ]);
        
        // Generate analysis with Gemini
        const analysis = await this.generateAnalysis(operationId);
        
        // Si llegamos aquí, Gemini funcionó
        this.circuitBreaker.recordSuccess();

        // Update with results
        const completedAnalysis = await storage.updateOperationAnalysis(pendingAnalysis.id, {
          analysis,
          emailsAnalyzed: emails.length,
          status: 'ready',
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000) // 24 hour cache
        });

        // 📚 SAVE TO KNOWLEDGE BASE for future reuse
        console.log(`[Analysis] 💾 Saving to knowledge base for future learning...`);
        await knowledgeBaseService.saveKnowledge(
          operation,
          analysis,
          emails.length,
          tasks.length,
          files.length
        );

        return completedAnalysis!;

      } catch (error: any) {
        // Registrar fallo en circuit breaker
        this.circuitBreaker.recordFailure(error);
        
        console.warn('[Analysis] Gemini failed - switching to fallback (open-source):', error.message);
        
        // USAR FALLBACK EN LUGAR DE RETORNAR ERROR
        try {
          const fallbackAnalysis = await this.generateFallbackAnalysis(operationId);
          
          // Get email count for metadata
          const emails = await storage.getGmailMessagesByOperation(operationId);
          
          // Update with fallback results (marked as ready, not error!)
          const completedAnalysis = await storage.updateOperationAnalysis(pendingAnalysis.id, {
            analysis: fallbackAnalysis,
            emailsAnalyzed: emails.length,
            status: 'ready',
            generatedAt: new Date(),
            expiresAt: new Date(Date.now() + 7200000) // 2 hour cache for fallback (shorter)
          });

          console.log('[Analysis] ✅ Fallback analysis generated successfully');
          return completedAnalysis!;
          
        } catch (fallbackError: any) {
          // Si incluso el fallback falla, actualizar con error
          console.error('[Analysis] ❌ Even fallback failed:', fallbackError);
          await storage.updateOperationAnalysis(pendingAnalysis.id, {
            status: 'error',
            errorMessage: `Both AI and fallback systems failed: ${fallbackError?.message || 'Unknown error'}`
          });
          throw fallbackError;
        }
      }

    } catch (error: any) {
      console.error('[Analysis] Error in getOrGenerateAnalysis:', error);
      throw error;
    }
  }
}

export const operationAnalysisService = new OperationAnalysisService();
