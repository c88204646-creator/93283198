/**
 * Email Task Automation - Crea tasks y notes automáticamente desde correos electrónicos
 * usando Smart Gemini Service
 */

import { storage } from './storage';
import { smartGeminiService } from './smart-gemini-service';
import { KnowledgeBaseService } from './knowledge-base-service';
import { FinancialDetectionService } from './financial-detection-service';
import { backblazeStorage } from './backblazeStorage';
import type { GmailMessage, Operation } from '@shared/schema';

interface ProcessingResult {
  operationId: string;
  tasksCreated: number;
  notesCreated: number;
  financialSuggestionsCreated?: number;
  skipped: boolean;
  reason?: string;
}

export class EmailTaskAutomation {
  private knowledgeBaseService: KnowledgeBaseService;
  private financialDetectionService: FinancialDetectionService;
  
  constructor() {
    this.knowledgeBaseService = new KnowledgeBaseService();
    this.financialDetectionService = new FinancialDetectionService();
  }
  
  /**
   * Procesa correos vinculados a una operación y crea tasks/notes automáticas
   */
  async processOperation(
    operationId: string,
    userId: string,
    autoCreateTasks: string,
    autoCreateNotes: string,
    optimizationLevel: 'high' | 'medium' | 'low' = 'high'
  ): Promise<ProcessingResult> {
    
    // Configurar nivel de optimización
    smartGeminiService.setOptimizationLevel(optimizationLevel);
    
    // 1. Obtener la operación y sus correos vinculados
    const operation = await storage.getOperation(operationId);
    if (!operation) {
      return {
        operationId,
        tasksCreated: 0,
        notesCreated: 0,
        skipped: true,
        reason: 'Operación no encontrada'
      };
    }
    
    const linkedEmails = await storage.getGmailMessagesByOperation(operationId);
    if (linkedEmails.length === 0) {
      return {
        operationId,
        tasksCreated: 0,
        notesCreated: 0,
        skipped: true,
        reason: 'Sin correos vinculados'
      };
    }
    
    console.log(`[Email Task Automation] Processing operation ${operation.name} with ${linkedEmails.length} emails`);
    
    // 2. Agrupar correos por thread
    const threadMap = new Map<string, typeof linkedEmails>();
    for (const email of linkedEmails) {
      if (!threadMap.has(email.threadId)) {
        threadMap.set(email.threadId, []);
      }
      threadMap.get(email.threadId)!.push(email);
    }
    
    console.log(`[Email Task Automation] Found ${threadMap.size} email threads`);
    
    // 3. Obtener tasks y notes existentes
    const existingTasks = await storage.getOperationTasks(operationId);
    const existingNotes = await storage.getOperationNotes(operationId);
    
    // 4. Procesar cada thread con Smart Gemini
    let totalTasksCreated = 0;
    let totalNotesCreated = 0;
    
    for (const [threadId, emails] of threadMap) {
      // Ordenar por fecha
      emails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      // Construir thread para análisis
      const thread = {
        threadId,
        messages: emails.map(email => ({
          id: email.messageId,
          from: email.fromEmail,
          subject: email.subject || 'Sin asunto',
          snippet: email.snippet || '',
          date: new Date(email.date)
        }))
      };
      
      // Analizar con Smart Gemini
      const analysis = await smartGeminiService.analyzeEmailThread(
        thread,
        existingTasks.map(t => ({ title: t.title, status: t.status })),
        existingNotes.map(n => ({ content: n.content }))
      );
      
      if (analysis.shouldSkip) {
        console.log(`[Email Task Automation] ⏭️  Skipped thread ${threadId.substring(0, 10)}... (${analysis.usedCache ? 'cached' : 'analyzed'})`);
        continue;
      }
      
      // 5. Crear tasks si está habilitado
      if (autoCreateTasks !== 'disabled' && analysis.tasks.length > 0) {
        for (const taskSuggestion of analysis.tasks) {
          try {
            // Verificar que no exista una tarea similar
            const similarTask = existingTasks.find(t => 
              t.title.toLowerCase().includes(taskSuggestion.title.toLowerCase().substring(0, 20)) ||
              taskSuggestion.title.toLowerCase().includes(t.title.toLowerCase().substring(0, 20))
            );
            
            if (similarTask) {
              // Respetar tareas modificadas manualmente - NUNCA duplicar o modificar
              if (similarTask.modifiedManually) {
                console.log(`[Email Task Automation] 🔒 Respecting manually modified task: ${similarTask.title}`);
                continue;
              }
              
              // Tarea duplicada automática - skip
              console.log(`[Email Task Automation] ⏭️  Skipped duplicate task: ${taskSuggestion.title}`);
              continue;
            }
            
            const task = await storage.createOperationTask({
              operationId,
              title: taskSuggestion.title,
              description: taskSuggestion.description,
              priority: taskSuggestion.priority,
              status: taskSuggestion.suggestedStatus || 'pending',
              createdById: userId,
              order: existingTasks.length + totalTasksCreated,
              createdAutomatically: true,
              modifiedManually: false,
              sourceGmailMessageId: emails[emails.length - 1].id,
              sourceEmailThreadId: threadId,
              aiConfidence: taskSuggestion.confidence.toString(),
              aiModel: 'gemini-2.0-flash-exp',
              aiSuggestion: taskSuggestion.reasoning
            });
            
            totalTasksCreated++;
            console.log(`[Email Task Automation] ✅ Created task: ${task.title} (confidence: ${taskSuggestion.confidence}%)`);
            
          } catch (error) {
            console.error('[Email Task Automation] Error creating task:', error);
          }
        }
      }
      
      // 6. Crear notes si está habilitado
      if (autoCreateNotes !== 'disabled' && analysis.notes.length > 0) {
        for (const noteSuggestion of analysis.notes) {
          try {
            // Verificar que no exista una nota similar
            const isDuplicate = existingNotes.some(n => 
              n.content.toLowerCase().includes(noteSuggestion.content.toLowerCase().substring(0, 30))
            );
            
            if (isDuplicate) {
              console.log(`[Email Task Automation] ⏭️  Skipped duplicate note`);
              continue;
            }
            
            const note = await storage.createOperationNote({
              operationId,
              userId,
              content: `[AUTO] ${noteSuggestion.content}\n\n---\n💡 Confianza: ${noteSuggestion.confidence}%\n📧 De correo: ${emails[emails.length - 1].subject}`,
              createdAutomatically: true,
              sourceGmailMessageId: emails[emails.length - 1].id,
              sourceEmailThreadId: threadId,
              aiConfidence: noteSuggestion.confidence.toString(),
              aiModel: 'gemini-2.0-flash-exp'
            });
            
            totalNotesCreated++;
            console.log(`[Email Task Automation] ✅ Created note (confidence: ${noteSuggestion.confidence}%)`);
            
          } catch (error) {
            console.error('[Email Task Automation] Error creating note:', error);
          }
        }
      }
      
      // 7. Procesar actualizaciones de estatus si está habilitado
      if (analysis.statusUpdates && analysis.statusUpdates.length > 0) {
        for (const statusUpdate of analysis.statusUpdates) {
          try {
            // Buscar la tarea existente por título
            const taskToUpdate = existingTasks.find(t => 
              t.title.toLowerCase().includes(statusUpdate.taskTitle.toLowerCase().substring(0, 20)) ||
              statusUpdate.taskTitle.toLowerCase().includes(t.title.toLowerCase().substring(0, 20))
            );
            
            if (!taskToUpdate) {
              console.log(`[Email Task Automation] ⚠️  Task not found for status update: ${statusUpdate.taskTitle}`);
              continue;
            }
            
            // Respetar tareas modificadas manualmente
            if (taskToUpdate.modifiedManually) {
              console.log(`[Email Task Automation] 🔒 Respecting manually modified task: ${taskToUpdate.title}`);
              continue;
            }
            
            // Actualizar estatus solo si cambió
            if (taskToUpdate.status !== statusUpdate.newStatus) {
              await storage.updateOperationTask(taskToUpdate.id, {
                status: statusUpdate.newStatus,
                aiSuggestion: `Auto-actualizado: ${statusUpdate.reasoning}`
              });
              console.log(`[Email Task Automation] ✅ Updated task status: "${taskToUpdate.title}" → ${statusUpdate.newStatus}`);
            }
            
          } catch (error) {
            console.error('[Email Task Automation] Error updating task status:', error);
          }
        }
      }
    }
    
    // 8. Limpiar caché antigua periódicamente
    smartGeminiService.clearOldCache();
    
    const stats = smartGeminiService.getStats();
    console.log(`[Email Task Automation] 📊 Gemini Stats:`, stats);
    
    // 9. Guardar en knowledge base para aprendizaje continuo si fue exitoso
    if (totalTasksCreated > 0 || totalNotesCreated > 0) {
      try {
        const operationFiles = await storage.getOperationFiles(operationId);
        const knowledgeSummary = `📋 Procesamiento automático de correos:\n` +
          `- ${linkedEmails.length} correos analizados\n` +
          `- ${totalTasksCreated} tareas creadas automáticamente\n` +
          `- ${totalNotesCreated} notas generadas\n` +
          `- ${threadMap.size} hilos de conversación procesados\n\n` +
          `Tipo de operación: ${operation.operationType || 'No especificado'}\n` +
          `Categoría: ${operation.projectCategory || 'No especificada'}`;
        
        await this.knowledgeBaseService.saveKnowledge(
          operation,
          knowledgeSummary,
          linkedEmails.length,
          totalTasksCreated,
          operationFiles.length
        );
        console.log(`[Email Task Automation] 💾 Saved to knowledge base for future learning`);
      } catch (error) {
        console.error('[Email Task Automation] Error saving to knowledge base:', error);
        // No fallar el proceso si falla el guardado en knowledge base
      }
    }
    
    return {
      operationId,
      tasksCreated: totalTasksCreated,
      notesCreated: totalNotesCreated,
      skipped: totalTasksCreated === 0 && totalNotesCreated === 0,
      reason: totalTasksCreated === 0 && totalNotesCreated === 0 ? 'No se encontraron acciones pendientes' : undefined
    };
  }

  /**
   * Procesa attachments de una operación para detectar transacciones financieras
   */
  async processFinancialDetection(
    operationId: string,
    autoDetectPayments: boolean,
    autoDetectExpenses: boolean
  ): Promise<number> {
    if (!autoDetectPayments && !autoDetectExpenses) {
      return 0;
    }

    console.log(`[Financial Detection] Processing operation ${operationId}`);

    // Obtener correos vinculados a la operación
    const linkedEmails = await storage.getGmailMessagesByOperation(operationId);
    if (linkedEmails.length === 0) {
      return 0;
    }

    // Obtener attachments de los correos
    const emailIds = linkedEmails.map(e => e.id);
    const allAttachments = await Promise.all(
      emailIds.map(async (emailId: string) => {
        const attachments = await storage.getGmailAttachments(emailId);
        return attachments.map((att: any) => ({ ...att, emailId }));
      })
    );

    const attachments = allAttachments.flat();
    const pdfAttachments = attachments.filter((att: any) => 
      att.mimeType === 'application/pdf' || att.filename?.toLowerCase().endsWith('.pdf')
    );

    if (pdfAttachments.length === 0) {
      console.log(`[Financial Detection] No PDF attachments found`);
      return 0;
    }

    console.log(`[Financial Detection] Found ${pdfAttachments.length} PDF attachments to analyze`);

    let suggestionsCreated = 0;

    for (const attachment of pdfAttachments) {
      try {
        // Descargar el archivo de B2
        if (!attachment.b2FileKey) {
          console.log(`[Financial Detection] ⚠️  No B2 key for attachment ${attachment.filename}`);
          continue;
        }

        const fileBuffer = await backblazeStorage.downloadFile(attachment.b2FileKey);
        
        // Calcular hash del archivo para detección de duplicados
        const attachmentHash = this.financialDetectionService.calculateFileHash(fileBuffer);
        
        // Verificar si este hash ya fue procesado (archivo exacto)
        const existingSuggestions = await storage.getFinancialSuggestions(operationId);
        const alreadyProcessedByHash = existingSuggestions.some((s: any) => 
          s.attachmentHash === attachmentHash
        );

        if (alreadyProcessedByHash) {
          console.log(`[Financial Detection] ⏭️  Skipping already processed file ${attachment.filename} (identical hash)`);
          continue;
        }
        
        // Obtener operación para contexto
        const operation = await storage.getOperation(operationId);

        // Determinar el tipo de detección basado en configuración
        // Por defecto, intentamos detectar expenses. Si está habilitado payments, preferimos eso.
        const detectionType = autoDetectPayments ? 'payment' : 'expense';

        // Usar el método con fallback automático (Gemini -> OCR -> Queue)
        const { transactions: detectedTransactions, method } = await this.financialDetectionService.detectWithFallback(
          fileBuffer,
          attachment.filename,
          attachment.b2FileKey,
          detectionType,
          operation ? {
            operationId: operation.id,
            operationName: operation.name,
            clientName: operation.clientId || undefined,
            gmailMessageId: attachment.emailId,
            gmailAttachmentId: attachment.id,
          } : undefined
        );

        // Si fue enviado a la queue (método queued), no hay transacciones que procesar
        if (method === 'queued') {
          console.log(`[Financial Detection] 📋 File queued for manual review: ${attachment.filename}`);
          continue;
        }

        // Extraer texto para guardarlo con la sugerencia
        let text = '';
        try {
          text = await this.financialDetectionService.extractTextFromPDF(fileBuffer);
        } catch (error) {
          console.log(`[Financial Detection] Could not extract text from ${attachment.filename}`);
        }

        // Crear sugerencias financieras con detección de duplicados
        for (const transaction of detectedTransactions) {
          // Filtrar según configuración
          if (transaction.type === 'payment' && !autoDetectPayments) continue;
          if (transaction.type === 'expense' && !autoDetectExpenses) continue;

          // Usar el nuevo método que incluye verificación de duplicados y método de detección
          const suggestionData = await this.financialDetectionService.createSuggestionFromTransaction(
            transaction,
            {
              sourceType: 'email_attachment',
              gmailMessageId: attachment.emailId,
              gmailAttachmentId: attachment.id,
              operationId,
              extractedText: text,
              attachmentHash,
              detectionMethod: method, // gemini o ocr
            }
          );

          await storage.createFinancialSuggestion(suggestionData);

          suggestionsCreated++;
          
          const methodLabel = method === 'gemini' ? '🤖 AI' : '📄 OCR';
          
          if (suggestionData.isDuplicate) {
            console.log(`[Financial Detection] ⚠️  Created DUPLICATE ${transaction.type} suggestion via ${methodLabel}: ${transaction.description} (${transaction.amount} ${transaction.currency}) - ${suggestionData.duplicateReason}`);
          } else {
            console.log(`[Financial Detection] ✅ Created ${transaction.type} suggestion via ${methodLabel}: ${transaction.description} (${transaction.amount} ${transaction.currency})`);
          }
        }

        // Pequeña pausa entre archivos
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`[Financial Detection] Error processing attachment ${attachment.filename}:`, error);
        // Continuar con el siguiente archivo
      }
    }

    return suggestionsCreated;
  }
  
  /**
   * Procesa todas las operaciones que tengan automatización habilitada
   */
  async processAllOperationsWithAutomation(userId: string): Promise<ProcessingResult[]> {
    // Obtener configuraciones de automatización activas
    const configs = await storage.getAutomationConfigs(userId);
    const activeConfig = configs.find(c => 
      c.isEnabled && 
      (c.autoCreateTasks !== 'disabled' || c.autoCreateNotes !== 'disabled' || c.autoDetectPayments || c.autoDetectExpenses)
    );
    
    if (!activeConfig) {
      console.log('[Email Task Automation] No active configurations found');
      return [];
    }
    
    // Obtener todas las operaciones que fueron creadas automáticamente o tienen correos vinculados
    const operations = await storage.getAllOperations();
    const operationsWithEmails = await Promise.all(
      operations.map(async (op) => {
        const emails = await storage.getGmailMessagesByOperation(op.id);
        return { operation: op, hasEmails: emails.length > 0 };
      })
    );
    
    const toProcess = operationsWithEmails.filter(item => item.hasEmails);
    
    console.log(`[Email Task Automation] Processing ${toProcess.length} operations with emails`);
    
    const results: ProcessingResult[] = [];
    
    for (const item of toProcess) {
      const result = await this.processOperation(
        item.operation.id,
        userId,
        activeConfig.autoCreateTasks || 'disabled',
        activeConfig.autoCreateNotes || 'disabled',
        (activeConfig.aiOptimizationLevel as any) || 'high'
      );

      // Procesar detección financiera si está habilitada
      let financialSuggestionsCreated = 0;
      if (activeConfig.autoDetectPayments || activeConfig.autoDetectExpenses) {
        try {
          financialSuggestionsCreated = await this.processFinancialDetection(
            item.operation.id,
            activeConfig.autoDetectPayments || false,
            activeConfig.autoDetectExpenses || false
          );
        } catch (error) {
          console.error(`[Email Task Automation] Error in financial detection for operation ${item.operation.id}:`, error);
        }
      }
      
      results.push({
        ...result,
        financialSuggestionsCreated
      });
      
      // Pequeña pausa entre operaciones para no saturar Gemini API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }
}

export const emailTaskAutomation = new EmailTaskAutomation();

/**
 * Función helper para procesar el thread de un correo específico y crear tasks/notes
 * Usado por el servicio de automatización
 */
export async function processEmailThreadForAutomation(
  messageId: string,
  operationId: string,
  autoCreateTasks: string,
  autoCreateNotes: string,
  optimizationLevel: 'high' | 'medium' | 'low' = 'high'
): Promise<void> {
  // Obtener el mensaje
  const message = await storage.getGmailMessage(messageId);
  if (!message) {
    console.error(`[Email Task Automation] Message ${messageId} not found`);
    return;
  }

  // Obtener la operación para determinar el userId
  const operation = await storage.getOperation(operationId);
  if (!operation) {
    console.error(`[Email Task Automation] Operation ${operationId} not found`);
    return;
  }

  // Obtener el usuario desde la configuración de automatización habilitada
  const configs = await storage.getEnabledAutomationConfigs();
  const config = configs[0]; // Usar la primera configuración habilitada
  
  if (!config) {
    console.error('[Email Task Automation] No enabled automation config found');
    return;
  }

  console.log(`[Email Task Automation] Processing operation ${operationId} with ${autoCreateTasks} tasks and ${autoCreateNotes} notes`);

  // Procesar la operación
  await emailTaskAutomation.processOperation(
    operationId,
    config.userId,
    autoCreateTasks,
    autoCreateNotes,
    optimizationLevel
  );
}
