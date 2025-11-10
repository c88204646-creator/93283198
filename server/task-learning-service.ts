/**
 * Task Learning Service - Sistema de Aprendizaje Progresivo para Tasks/Notas
 * 
 * PRIORIDAD 1: Este sistema se ejecuta PRIMERO, antes que Gemini
 * 
 * Funcionalidades:
 * 1. Aprende de tasks/notas creadas manualmente por usuarios
 * 2. Aprende de tasks/notas aprobadas por usuarios
 * 3. Almacena patrones exitosos en knowledge base
 * 4. Genera nuevas tasks/notas basándose en patrones aprendidos
 * 5. Detecta duplicados semánticos (no solo strings exactos)
 * 6. Auto-actualiza status de tareas basado en correos nuevos
 * 7. Transforma lenguaje conversacional a profesional SIEMPRE
 */

import { storage } from './storage';
import { db } from './db';
import { knowledgeBase } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { backblazeStorage } from './backblazeStorage';

interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  body?: string;
  date: Date;
}

interface LearnedTask {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  confidence: number;
  reasoning: string;
  source: 'learned-pattern';
  suggestedStatus?: 'pending' | 'completed';
  keywords: string[];
}

interface LearnedNote {
  content: string;
  confidence: number;
  reasoning: string;
  source: 'learned-pattern';
  keywords: string[];
}

interface TaskPattern {
  triggerKeywords: string[];
  titleTemplate: string;
  descriptionTemplate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  usageCount: number;
  successRate: number;
}

interface LearningResult {
  tasks: LearnedTask[];
  notes: LearnedNote[];
  statusUpdates: { taskId: string; newStatus: 'completed' | 'overdue'; reasoning: string }[];
  source: 'learned-patterns';
  confidence: number;
}

export class TaskLearningService {
  
  /**
   * Keywords para transformación profesional de texto
   */
  private professionalTransformations = {
    // Saludos a eliminar
    greetings: ['buen dia', 'buena tarde', 'buenos dias', 'buenas tardes', 'hola', 'hello', 'hi', 'dear', 'estimado', 'estimada'],
    
    // Despedidas a eliminar
    farewells: ['saludos', 'regards', 'best regards', 'atentamente', 'quedo atento', 'quedo atenta', 'quedamos al pendiente'],
    
    // Frases conversacionales → Profesional
    conversationalToProfessional: [
      { pattern: /ya\s+(solicité|solicite|envié|envie)/gi, replacement: 'Solicitado' },
      { pattern: /en\s+cuanto\s+(la|lo|los|las)\s+(tenga|reciba)/gi, replacement: 'Pendiente de recibir' },
      { pattern: /te\s+(la|lo|los|las)\s+(comparto|envío|envio|mando)/gi, replacement: 'Se compartirá' },
      { pattern: /I'?ll?\s+pending/gi, replacement: 'Pendiente' },
      { pattern: /por\s+favor/gi, replacement: '' },
      { pattern: /favor\s+de/gi, replacement: 'Se requiere' },
      { pattern: /si\s+puedes/gi, replacement: 'Se necesita' },
      { pattern: /cuando\s+puedas/gi, replacement: 'Lo antes posible' },
    ],
    
    // Abreviaciones → Texto completo
    abbreviations: [
      { pattern: /\bal\s+AA\b/gi, replacement: 'al agente aduanal' },
      { pattern: /\bAA\b/gi, replacement: 'Agente aduanal' },
      { pattern: /\bECU\b/gi, replacement: 'ECU' }, // Mantener ECU
      { pattern: /\bcta\b/gi, replacement: 'cuenta' },
      { pattern: /\binfo\b/gi, replacement: 'información' },
      { pattern: /\bdoc\b/gi, replacement: 'documento' },
      { pattern: /\bdocs\b/gi, replacement: 'documentos' },
    ],
    
    // Pronombres a eliminar
    pronouns: ['te', 'ti', 'you', 'your', 'tu', 'tus'],
  };

  /**
   * Analiza correos usando patrones aprendidos PRIMERO
   * Este método tiene PRIORIDAD sobre Gemini
   */
  async analyzeUsingLearnedPatterns(
    messages: EmailMessage[],
    existingTasks: { title: string; status: string; id: string }[],
    existingNotes: { content: string }[],
    companyContext?: {
      companyName?: string;
      companyDomain?: string;
      employeeEmails?: string[];
    }
  ): Promise<LearningResult | null> {
    
    console.log('[Task Learning] 🎓 Analizando con patrones aprendidos...');
    
    // 1. Obtener patrones aprendidos de la knowledge base
    const patterns = await this.getLearnedPatterns();
    
    if (patterns.length === 0) {
      console.log('[Task Learning] ⚠️  Sin patrones aprendidos aún. Sistema necesita entrenamiento inicial.');
      return null;
    }
    
    console.log(`[Task Learning] 📚 ${patterns.length} patrones disponibles`);
    
    const tasks: LearnedTask[] = [];
    const notes: LearnedNote[] = [];
    const statusUpdates: { taskId: string; newStatus: 'completed' | 'overdue'; reasoning: string }[] = [];
    
    // 2. Analizar cada mensaje con patrones aprendidos
    for (const message of messages) {
      const fullText = `${message.subject} ${message.snippet} ${message.body || ''}`.toLowerCase();
      
      // 3. Buscar coincidencias con patrones
      for (const pattern of patterns) {
        const matchedKeywords = pattern.triggerKeywords.filter(keyword => 
          fullText.includes(keyword.toLowerCase())
        );
        
        if (matchedKeywords.length >= 2) { // Al menos 2 keywords para alta confianza
          // Generar task basada en patrón aprendido
          const task = this.generateTaskFromPattern(pattern, message, fullText, companyContext);
          
          // Verificar duplicado semántico
          const isDuplicate = this.isSemanticDuplicate(task.title, existingTasks.map(t => t.title));
          
          if (!isDuplicate) {
            tasks.push(task);
            
            // Actualizar contador de uso del patrón
            await this.incrementPatternUsage(pattern);
          }
        }
      }
      
      // 4. Generar nota transformada profesionalmente
      const note = this.generateProfessionalNote(message, fullText, companyContext);
      if (note) {
        // Verificar duplicado
        const isDuplicateNote = this.isNoteDuplicate(note.content, existingNotes.map(n => n.content));
        if (!isDuplicateNote) {
          notes.push(note);
        }
      }
    }
    
    // 5. Auto-actualizar status de tareas basado en correos
    const updates = await this.detectStatusUpdates(messages, existingTasks);
    statusUpdates.push(...updates);
    
    const confidence = patterns.length > 5 ? 85 : 70; // Mayor confianza con más patrones
    
    console.log(`[Task Learning] ✅ Generadas ${tasks.length} tasks, ${notes.length} notes, ${statusUpdates.length} status updates (confidence: ${confidence}%)`);
    
    return {
      tasks,
      notes,
      statusUpdates,
      source: 'learned-patterns',
      confidence
    };
  }

  /**
   * Genera una tarea basada en un patrón aprendido
   */
  private generateTaskFromPattern(
    pattern: TaskPattern,
    message: EmailMessage,
    fullText: string,
    companyContext?: any
  ): LearnedTask {
    
    // Extraer fechas, tracking, etc.
    const dates = this.extractDates(fullText);
    const references = this.extractReferences(fullText);
    
    // Generar título profesional usando template
    let title = pattern.titleTemplate;
    if (dates.length > 0) {
      title = title.replace('{date}', dates[0]);
    }
    if (references.length > 0) {
      title = title.replace('{ref}', references[0]);
    }
    
    // Generar descripción transformada profesionalmente
    let description = this.transformToProfessional(message.snippet);
    
    // Si la descripción es muy corta después de limpiar, usar template
    if (description.length < 20) {
      description = pattern.descriptionTemplate;
    }
    
    return {
      title: title.slice(0, 60),
      description: description.slice(0, 100),
      priority: pattern.priority,
      confidence: Math.min(70 + (pattern.usageCount * 2), 95), // Más uso = más confianza
      reasoning: `Patrón aprendido con ${pattern.usageCount} usos exitosos (${(pattern.successRate * 100).toFixed(0)}% éxito)`,
      source: 'learned-pattern',
      keywords: pattern.triggerKeywords
    };
  }

  /**
   * Transforma texto conversacional a profesional
   */
  private transformToProfessional(text: string): string {
    let transformed = text;
    
    // 1. Eliminar saludos
    for (const greeting of this.professionalTransformations.greetings) {
      const regex = new RegExp(`(^|\\s)${greeting}\\s+[a-záéíóúñ]+`, 'gi');
      transformed = transformed.replace(regex, ' ');
    }
    
    // 2. Eliminar despedidas
    for (const farewell of this.professionalTransformations.farewells) {
      const regex = new RegExp(`${farewell}.*$`, 'gi');
      transformed = transformed.replace(regex, '');
    }
    
    // 3. Transformar frases conversacionales
    for (const { pattern, replacement } of this.professionalTransformations.conversationalToProfessional) {
      transformed = transformed.replace(pattern, replacement);
    }
    
    // 4. Expandir abreviaciones
    for (const { pattern, replacement } of this.professionalTransformations.abbreviations) {
      transformed = transformed.replace(pattern, replacement);
    }
    
    // 5. Eliminar pronombres de segunda persona
    for (const pronoun of this.professionalTransformations.pronouns) {
      const regex = new RegExp(`\\b${pronoun}\\b`, 'gi');
      transformed = transformed.replace(regex, '');
    }
    
    // 6. Limpiar espacios y capitalizar
    transformed = transformed
      .replace(/\s+/g, ' ')
      .trim();
    
    if (transformed.length > 0) {
      transformed = transformed.charAt(0).toUpperCase() + transformed.slice(1);
    }
    
    return transformed;
  }

  /**
   * Genera nota profesional sin copiar conversación
   */
  private generateProfessionalNote(
    message: EmailMessage,
    fullText: string,
    companyContext?: any
  ): LearnedNote | null {
    
    // Extraer información relevante
    const dates = this.extractDates(fullText);
    const references = this.extractReferences(fullText);
    const amounts = this.extractAmounts(fullText);
    
    // Solo crear nota si hay información relevante
    if (dates.length === 0 && references.length === 0 && amounts.length === 0) {
      return null;
    }
    
    // Construir nota profesional
    let content = 'Comunicación recibida';
    
    if (references.length > 0) {
      content += ` ref. ${references[0]}`;
    }
    
    if (dates.length > 0) {
      content += ` - Fecha mencionada: ${dates[0]}`;
    }
    
    if (amounts.length > 0) {
      content += ` - Monto: ${amounts[0]}`;
    }
    
    // Añadir contexto transformado
    const transformedSnippet = this.transformToProfessional(message.snippet);
    if (transformedSnippet.length > 20) {
      content += `. ${transformedSnippet.slice(0, 80)}`;
    }
    
    return {
      content: content.slice(0, 150),
      confidence: 75,
      reasoning: 'Nota generada con transformación profesional de contenido',
      source: 'learned-pattern',
      keywords: [...dates, ...references]
    };
  }

  /**
   * Detecta si una tarea es duplicado semántico (no solo string exacto)
   */
  private isSemanticDuplicate(newTitle: string, existingTitles: string[]): boolean {
    const normalized = newTitle.toLowerCase().trim();
    
    for (const existing of existingTitles) {
      const normalizedExisting = existing.toLowerCase().trim();
      
      // Duplicado exacto
      if (normalized === normalizedExisting) {
        return true;
      }
      
      // Similitud semántica alta (>75% de palabras en común)
      const newWords = new Set(normalized.split(/\s+/));
      const existingWords = new Set(normalizedExisting.split(/\s+/));
      
      const intersection = new Set([...newWords].filter(x => existingWords.has(x)));
      const union = new Set([...newWords, ...existingWords]);
      
      const similarity = intersection.size / union.size;
      
      if (similarity > 0.75) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Detecta si una nota es duplicada
   */
  private isNoteDuplicate(newContent: string, existingContents: string[]): boolean {
    const normalized = newContent.slice(0, 50).toLowerCase();
    
    for (const existing of existingContents) {
      const normalizedExisting = existing.slice(0, 50).toLowerCase();
      
      if (normalized === normalizedExisting) {
        return true;
      }
      
      // Similitud alta en primeros 50 caracteres
      if (normalized.includes(normalizedExisting.slice(0, 20)) || 
          normalizedExisting.includes(normalized.slice(0, 20))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Detecta actualizaciones de status basadas en correos nuevos
   */
  private async detectStatusUpdates(
    messages: EmailMessage[],
    existingTasks: { title: string; status: string; id: string }[]
  ): Promise<{ taskId: string; newStatus: 'completed' | 'overdue'; reasoning: string }[]> {
    
    const updates: { taskId: string; newStatus: 'completed' | 'overdue'; reasoning: string }[] = [];
    
    const completionKeywords = ['completado', 'completed', 'listo', 'done', 'enviado', 'sent', 'confirmado', 'confirmed'];
    const overdueKeywords = ['atrasado', 'overdue', 'pending long time', 'no response'];
    
    for (const message of messages) {
      const fullText = `${message.subject} ${message.snippet}`.toLowerCase();
      
      // Buscar tareas que puedan estar completadas
      for (const task of existingTasks) {
        if (task.status === 'completed') continue; // Ya está completada
        
        // Verificar si el email menciona la tarea
        const taskWords = task.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const mentionsTask = taskWords.some(word => fullText.includes(word));
        
        if (mentionsTask) {
          // Verificar si indica completitud
          const isCompleted = completionKeywords.some(keyword => fullText.includes(keyword));
          
          if (isCompleted) {
            updates.push({
              taskId: task.id,
              newStatus: 'completed',
              reasoning: `Detectado en email: "${message.subject}" contiene keywords de completitud`
            });
          }
        }
      }
    }
    
    return updates;
  }

  /**
   * Aprende de una tarea creada manualmente por usuario
   */
  async learnFromManualTask(
    task: { title: string; description: string; priority: string },
    relatedEmails: EmailMessage[]
  ): Promise<void> {
    
    console.log(`[Task Learning] 📖 Aprendiendo de tarea manual: ${task.title}`);
    
    // Extraer keywords del contexto de emails
    const keywords = this.extractKeywordsFromEmails(relatedEmails);
    
    // Crear patrón para futuros usos
    const pattern: TaskPattern = {
      triggerKeywords: keywords,
      titleTemplate: this.generalizeTemplate(task.title),
      descriptionTemplate: task.description,
      priority: task.priority as any,
      usageCount: 1,
      successRate: 1.0
    };
    
    // Guardar patrón en knowledge base
    await this.savePattern(pattern, 'manual-task');
    
    console.log(`[Task Learning] ✅ Patrón guardado con ${keywords.length} keywords`);
  }

  /**
   * Aprende de una tarea aprobada por usuario
   */
  async learnFromApprovedTask(taskId: string): Promise<void> {
    // Incrementar success rate del patrón asociado
    console.log(`[Task Learning] 👍 Tarea aprobada: ${taskId} - Incrementando confianza del patrón`);
    // TODO: Implementar actualización de success rate
  }

  /**
   * Aprende de una tarea rechazada por usuario
   */
  async learnFromRejectedTask(taskId: string): Promise<void> {
    // Decrementar success rate del patrón asociado
    console.log(`[Task Learning] 👎 Tarea rechazada: ${taskId} - Decrementando confianza del patrón`);
    // TODO: Implementar actualización de success rate
  }

  /**
   * Obtiene patrones aprendidos de la knowledge base
   */
  private async getLearnedPatterns(): Promise<TaskPattern[]> {
    try {
      const patterns = await db.select().from(knowledgeBase)
        .where(eq(knowledgeBase.type, 'task-pattern'))
        .orderBy(desc(knowledgeBase.qualityScore), desc(knowledgeBase.usageCount))
        .limit(20);
      
      const result: TaskPattern[] = [];
      
      for (const pattern of patterns) {
        if (!pattern.b2Key) continue;
        
        try {
          // Descargar patrón de B2
          const content = await backblazeStorage.downloadFile(pattern.b2Key);
          const patternData = JSON.parse(content.toString('utf-8')) as TaskPattern;
          result.push(patternData);
        } catch (error) {
          console.error(`[Task Learning] Error loading pattern ${pattern.id}:`, error);
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('[Task Learning] Error getting learned patterns:', error);
      return [];
    }
  }

  /**
   * Guarda un patrón en la knowledge base
   */
  private async savePattern(pattern: TaskPattern, source: string): Promise<void> {
    try {
      // Subir a B2
      const filename = `task-pattern-${Date.now()}.json`;
      const buffer = Buffer.from(JSON.stringify(pattern, null, 2), 'utf-8');
      
      const uploadResult = await backblazeStorage.uploadOperationFile(
        buffer,
        filename,
        'application/json',
        'system',
        'system',
        'task-learning'
      );
      
      // Guardar en DB
      await db.insert(knowledgeBase).values({
        type: 'task-pattern',
        b2Key: uploadResult.fileKey,
        tags: pattern.triggerKeywords,
        usageCount: pattern.usageCount,
        qualityScore: Math.round(pattern.successRate * 10),
        metadata: { source, priority: pattern.priority }
      });
      
      console.log(`[Task Learning] ✅ Patrón guardado en B2: ${uploadResult.fileKey}`);
      
    } catch (error) {
      console.error('[Task Learning] Error saving pattern:', error);
    }
  }

  /**
   * Incrementa el contador de uso de un patrón
   */
  private async incrementPatternUsage(pattern: TaskPattern): Promise<void> {
    // TODO: Implementar incremento en DB
  }

  /**
   * Extrae keywords relevantes de emails
   */
  private extractKeywordsFromEmails(emails: EmailMessage[]): string[] {
    const keywords = new Set<string>();
    
    for (const email of emails) {
      const text = `${email.subject} ${email.snippet}`.toLowerCase();
      const words = text.split(/\s+/);
      
      for (const word of words) {
        if (word.length > 4 && !this.isStopWord(word)) {
          keywords.add(word);
        }
      }
    }
    
    return Array.from(keywords).slice(0, 10); // Top 10 keywords
  }

  /**
   * Generaliza un template de título
   */
  private generalizeTemplate(title: string): string {
    // Reemplazar fechas con {date}
    let template = title.replace(/\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/g, '{date}');
    
    // Reemplazar referencias con {ref}
    template = template.replace(/[A-Z0-9]{5,}/g, '{ref}');
    
    return template;
  }

  /**
   * Extrae fechas del texto
   */
  private extractDates(text: string): string[] {
    const datePattern = /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/g;
    return text.match(datePattern) || [];
  }

  /**
   * Extrae referencias (tracking, BL, etc)
   */
  private extractReferences(text: string): string[] {
    const refPattern = /(REF|TR|AWB|BL|TRACK|#)[-:\s]?([A-Z0-9]{4,})/gi;
    const matches = text.match(refPattern) || [];
    return matches.slice(0, 3);
  }

  /**
   * Extrae montos
   */
  private extractAmounts(text: string): string[] {
    const amountPattern = /(\$|USD|MXN|EUR)?\s?(\d{1,3}(,\d{3})*(\.\d{2})?)\s?(USD|MXN|EUR)?/gi;
    const matches = text.match(amountPattern) || [];
    return matches.slice(0, 3);
  }

  /**
   * Verifica si una palabra es stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'para', 'con', 'por', 'una', 'como', 'esta', 'esto', 'ese', 'esa'];
    return stopWords.includes(word.toLowerCase());
  }
}

export const taskLearningService = new TaskLearningService();
