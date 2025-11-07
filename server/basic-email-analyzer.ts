/**
 * Basic Email Analyzer - Fallback 100% Open Source
 * 
 * Sistema de respaldo que funciona sin IA cuando:
 * - Gemini alcanza límite de uso (429)
 * - Circuit breaker está OPEN
 * - No hay API key de Gemini
 * 
 * Usa solo código open source: regex, análisis de texto, patrones.
 */

interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  body?: string;
  date: Date;
}

interface BasicTask {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  confidence: number;
  reasoning: string;
  source: 'rule-based';
}

interface BasicNote {
  content: string;
  confidence: number;
  reasoning: string;
  source: 'rule-based';
}

interface AnalysisResult {
  tasks: BasicTask[];
  notes: BasicNote[];
  method: 'rule-based';
}

export class BasicEmailAnalyzer {
  
  /**
   * Palabras clave para detectar acciones pendientes
   */
  private actionKeywords = {
    urgent: ['urgente', 'urgent', 'asap', 'inmediato', 'emergency', 'emergencia'],
    high: ['importante', 'important', 'prioridad', 'priority', 'crítico', 'critical'],
    request: ['solicito', 'solicitud', 'necesito', 'requiero', 'request', 'need', 'require'],
    pending: ['pendiente', 'pending', 'espera', 'waiting', 'falta', 'missing'],
    send: ['enviar', 'envío', 'send', 'remitir', 'mandar'],
    quote: ['cotizar', 'cotización', 'quote', 'presupuesto', 'budget'],
    confirm: ['confirmar', 'confirmación', 'confirm', 'confirmation'],
    follow: ['seguimiento', 'follow', 'revisar', 'check', 'verificar', 'verify'],
    payment: ['pago', 'payment', 'factura', 'invoice', 'cobro'],
    delivery: ['entrega', 'delivery', 'envío', 'shipment', 'arribo', 'arrival']
  };

  /**
   * Patrones regex para extraer información estructurada
   */
  private patterns = {
    // Fechas: 15/01/2024, 15-01-2024, Jan 15 2024
    date: /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|(\w{3,9}\s+\d{1,2},?\s+\d{4})/gi,
    
    // Números de tracking/referencia: REF-123, TR123456, #12345
    tracking: /(REF|TR|AWB|BL|TRACK|#)[-:\s]?([A-Z0-9]{4,})/gi,
    
    // Montos: $1,234.56, USD 1234, 1,234.56 USD
    amount: /(\$|USD|MXN|EUR)?\s?(\d{1,3}(,\d{3})*(\.\d{2})?)\s?(USD|MXN|EUR)?/gi,
    
    // Emails
    email: /[\w.-]+@[\w.-]+\.\w{2,}/gi,
    
    // Teléfonos: +52 123 456 7890, (123) 456-7890
    phone: /(\+\d{1,3}\s?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/gi,
    
    // Nombres de personas (Estimado/Dear + nombre)
    person: /(estimado|dear|hola|hello|sr\.|sra\.|mr\.|mrs\.)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/gi
  };

  /**
   * Analiza un thread de emails y extrae tasks/notes usando reglas
   */
  async analyzeEmailThread(messages: EmailMessage[]): Promise<AnalysisResult> {
    const tasks: BasicTask[] = [];
    const notes: BasicNote[] = [];

    // Analizar cada mensaje
    for (const message of messages) {
      const fullText = `${message.subject} ${message.snippet} ${message.body || ''}`.toLowerCase();
      
      // Detectar tareas basadas en keywords
      const detectedTasks = this.detectTasks(message, fullText);
      tasks.push(...detectedTasks);

      // Generar nota descriptiva del email
      const note = this.generateNote(message, fullText);
      if (note) {
        notes.push(note);
      }
    }

    // Deduplicar tasks similares
    const uniqueTasks = this.deduplicateTasks(tasks);

    console.log(`[Basic Analyzer] ✅ Analyzed ${messages.length} messages: ${uniqueTasks.length} tasks, ${notes.length} notes`);

    return {
      tasks: uniqueTasks,
      notes,
      method: 'rule-based'
    };
  }

  /**
   * Detecta tareas pendientes basadas en keywords y patrones
   */
  private detectTasks(message: EmailMessage, fullText: string): BasicTask[] {
    const tasks: BasicTask[] = [];

    // Detectar nivel de urgencia
    let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
    let hasUrgent = false;
    let hasHigh = false;

    for (const keyword of this.actionKeywords.urgent) {
      if (fullText.includes(keyword)) {
        hasUrgent = true;
        break;
      }
    }

    if (!hasUrgent) {
      for (const keyword of this.actionKeywords.high) {
        if (fullText.includes(keyword)) {
          hasHigh = true;
          break;
        }
      }
    }

    if (hasUrgent) priority = 'urgent';
    else if (hasHigh) priority = 'high';

    // Detectar tipo de acción requerida
    const actionTypes = [];

    if (this.containsKeywords(fullText, this.actionKeywords.send)) {
      actionTypes.push('envío');
    }
    if (this.containsKeywords(fullText, this.actionKeywords.quote)) {
      actionTypes.push('cotización');
    }
    if (this.containsKeywords(fullText, this.actionKeywords.confirm)) {
      actionTypes.push('confirmación');
    }
    if (this.containsKeywords(fullText, this.actionKeywords.payment)) {
      actionTypes.push('pago');
    }
    if (this.containsKeywords(fullText, this.actionKeywords.delivery)) {
      actionTypes.push('entrega');
    }
    if (this.containsKeywords(fullText, this.actionKeywords.follow)) {
      actionTypes.push('seguimiento');
    }

    // Extraer información contextual
    const trackingNumbers = this.extractMatches(fullText, this.patterns.tracking);
    const dates = this.extractMatches(fullText, this.patterns.date);
    const amounts = this.extractMatches(fullText, this.patterns.amount);

    // Crear task si se detectó alguna acción
    if (actionTypes.length > 0) {
      const context = [];
      if (trackingNumbers.length > 0) context.push(`Ref: ${trackingNumbers[0]}`);
      if (dates.length > 0) context.push(`Fecha: ${dates[0]}`);
      if (amounts.length > 0) context.push(`Monto: ${amounts[0]}`);

      const title = `${actionTypes.join(' y ')} - ${message.subject.slice(0, 50)}`;
      const description = [
        `Email de: ${message.from}`,
        `Asunto: ${message.subject}`,
        context.length > 0 ? context.join(' | ') : '',
        message.snippet.slice(0, 150)
      ].filter(Boolean).join('\n');

      tasks.push({
        title,
        description,
        priority,
        confidence: 65, // Confianza media para análisis basado en reglas
        reasoning: `Detectado automáticamente por keywords: ${actionTypes.join(', ')}`,
        source: 'rule-based'
      });
    }

    // Si hay palabras de urgencia pero no acción específica, crear task genérica
    else if (hasUrgent || hasHigh) {
      tasks.push({
        title: `Revisar: ${message.subject.slice(0, 60)}`,
        description: `Email ${hasUrgent ? 'urgente' : 'importante'} de ${message.from}\n${message.snippet.slice(0, 150)}`,
        priority,
        confidence: 60,
        reasoning: `Marcado como ${hasUrgent ? 'urgente' : 'importante'} por keywords detectadas`,
        source: 'rule-based'
      });
    }

    return tasks;
  }

  /**
   * Genera una nota descriptiva del email
   */
  private generateNote(message: EmailMessage, fullText: string): BasicNote | null {
    // Extraer información clave
    const trackingNumbers = this.extractMatches(fullText, this.patterns.tracking);
    const dates = this.extractMatches(fullText, this.patterns.date);
    const amounts = this.extractMatches(fullText, this.patterns.amount);
    const emails = this.extractMatches(message.from + ' ' + (message.body || ''), this.patterns.email);

    // Solo crear nota si hay información estructurada suficiente
    if (trackingNumbers.length === 0 && dates.length === 0 && amounts.length === 0) {
      return null;
    }

    const sections = [];
    
    sections.push(`📧 Email de: ${message.from}`);
    sections.push(`📌 Asunto: ${message.subject}`);
    sections.push(`📅 Fecha: ${message.date.toLocaleDateString('es-MX')}`);

    if (trackingNumbers.length > 0) {
      sections.push(`🔢 Referencias detectadas: ${trackingNumbers.slice(0, 3).join(', ')}`);
    }

    if (dates.length > 0) {
      sections.push(`📆 Fechas mencionadas: ${dates.slice(0, 3).join(', ')}`);
    }

    if (amounts.length > 0) {
      sections.push(`💰 Montos detectados: ${amounts.slice(0, 3).join(', ')}`);
    }

    // Agregar snippet del contenido
    sections.push(`\n📝 Contenido:\n${message.snippet.slice(0, 200)}${message.snippet.length > 200 ? '...' : ''}`);

    const content = sections.join('\n');

    // Verificar longitud mínima (100 caracteres)
    if (content.length < 100) {
      return null;
    }

    return {
      content,
      confidence: 70,
      reasoning: 'Nota generada automáticamente con información extraída del email',
      source: 'rule-based'
    };
  }

  /**
   * Verifica si el texto contiene alguna de las keywords
   */
  private containsKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  /**
   * Extrae matches de un patrón regex
   */
  private extractMatches(text: string, pattern: RegExp): string[] {
    const matches: string[] = [];
    let match;
    
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(text)) !== null && matches.length < 5) {
      matches.push(match[0].trim());
    }
    
    return matches;
  }

  /**
   * Elimina tasks duplicadas basándose en similitud de títulos
   */
  private deduplicateTasks(tasks: BasicTask[]): BasicTask[] {
    const unique: BasicTask[] = [];
    
    for (const task of tasks) {
      const isDuplicate = unique.some(existing => 
        this.calculateSimilarity(task.title, existing.title) > 0.7
      );
      
      if (!isDuplicate) {
        unique.push(task);
      }
    }
    
    return unique;
  }

  /**
   * Calcula similitud entre dos strings (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1;
    
    // Similitud simple basada en palabras comunes
    const words1 = new Set(s1.split(/\s+/));
    const words2 = new Set(s2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
}
