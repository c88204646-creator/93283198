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

interface ExecutiveSummary {
  businessContext: string;
  stakeholders: string[];
  riskFlags: string[];
  keyMilestones: string[];
  pendingDependencies: string[];
}

interface AnalysisResult {
  tasks: BasicTask[];
  notes: BasicNote[];
  executiveSummary?: ExecutiveSummary;
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
  async analyzeEmailThread(
    messages: EmailMessage[],
    companyContext?: {
      companyName?: string;
      companyDomain?: string;
      employeeEmails?: string[];
    }
  ): Promise<AnalysisResult> {
    const tasks: BasicTask[] = [];
    const notes: BasicNote[] = [];

    // Analizar cada mensaje
    for (const message of messages) {
      const fullText = `${message.subject} ${message.snippet} ${message.body || ''}`.toLowerCase();
      
      // Detectar tareas basadas en keywords
      const detectedTasks = this.detectTasks(message, fullText, companyContext);
      tasks.push(...detectedTasks);

      // Generar nota descriptiva del email
      const note = this.generateNote(message, fullText, companyContext);
      if (note) {
        notes.push(note);
      }
    }

    // Deduplicar tasks similares
    const uniqueTasks = this.deduplicateTasks(tasks);

    // Generar resumen ejecutivo
    const executiveSummary = this.generateExecutiveSummary(messages, uniqueTasks, notes, companyContext);

    console.log(`[Basic Analyzer] ✅ Analyzed ${messages.length} messages: ${uniqueTasks.length} tasks, ${notes.length} notes, executive summary generated`);

    return {
      tasks: uniqueTasks,
      notes,
      executiveSummary,
      method: 'rule-based'
    };
  }

  /**
   * Genera un resumen ejecutivo autoexplicativo para cualquier empleado
   */
  private generateExecutiveSummary(
    messages: EmailMessage[],
    tasks: BasicTask[],
    notes: BasicNote[],
    companyContext?: {
      companyName?: string;
      companyDomain?: string;
      employeeEmails?: string[];
    }
  ): ExecutiveSummary {
    const allText = messages.map(m => `${m.subject} ${m.snippet} ${m.body || ''}`).join(' ').toLowerCase();
    
    // Extraer stakeholders (emails únicos mencionados)
    const emailMatches = this.extractMatches(allText, this.patterns.email);
    const uniqueStakeholders = [...new Set(emailMatches)]
      .filter(email => {
        // Filtrar emails internos si tenemos contexto
        if (companyContext?.employeeEmails) {
          return !companyContext.employeeEmails.some(internal => 
            email.toLowerCase().includes(internal.toLowerCase())
          );
        }
        return true;
      })
      .slice(0, 5); // Máximo 5 stakeholders

    // Detectar riesgos/alertas
    const riskFlags: string[] = [];
    if (this.containsKeywords(allText, this.actionKeywords.urgent)) {
      riskFlags.push('ALERTA: Marcado como URGENTE - requiere atención inmediata');
    }
    if (this.containsKeywords(allText, this.actionKeywords.pending)) {
      riskFlags.push('PENDIENTE: Acciones pendientes identificadas');
    }
    if (tasks.filter(t => t.priority === 'urgent').length > 0) {
      riskFlags.push(`CRÍTICO: ${tasks.filter(t => t.priority === 'urgent').length} tareas urgentes detectadas`);
    }
    if (this.containsKeywords(allText, this.actionKeywords.payment)) {
      riskFlags.push('FINANCIERO: Asunto relacionado con pagos/facturación');
    }
    if (messages.length > 10) {
      riskFlags.push('COMUNICACIÓN: Thread extenso - conversación con múltiples intercambios');
    }

    // Detectar hitos clave (fechas mencionadas)
    const dateMatches = this.extractMatches(allText, this.patterns.date);
    const keyMilestones = [...new Set(dateMatches)].slice(0, 5);

    // Detectar dependencias pendientes
    const pendingDependencies: string[] = [];
    if (this.containsKeywords(allText, this.actionKeywords.confirm)) {
      pendingDependencies.push('Confirmación requerida de stakeholders');
    }
    if (this.containsKeywords(allText, this.actionKeywords.send)) {
      pendingDependencies.push('Envío de documentos/información pendiente');
    }
    if (this.containsKeywords(allText, ['aa', 'agente aduanal', 'customs'])) {
      pendingDependencies.push('Coordinación con agente aduanal');
    }
    if (this.containsKeywords(allText, ['cliente', 'customer', 'client'])) {
      pendingDependencies.push('Respuesta o acción del cliente');
    }
    if (this.containsKeywords(allText, ['carrier', 'transportista', 'naviera'])) {
      pendingDependencies.push('Coordinación con transportista/naviera');
    }

    // Generar contexto de negocio profesional y autoexplicativo
    let businessContext = 'Esta operación logística involucra';
    
    // Detectar tipo de operación
    if (this.containsKeywords(allText, ['importación', 'import'])) {
      businessContext += ' un proceso de importación';
    } else if (this.containsKeywords(allText, ['exportación', 'export'])) {
      businessContext += ' un proceso de exportación';
    } else if (this.containsKeywords(allText, ['shipment', 'envío', 'embarque'])) {
      businessContext += ' una operación de envío';
    } else {
      businessContext += ' gestión logística';
    }

    // Agregar información de tracking si existe
    const trackingNumbers = this.extractMatches(allText, this.patterns.tracking);
    if (trackingNumbers.length > 0) {
      businessContext += ` con referencia ${trackingNumbers[0]}`;
    }

    // Agregar stakeholders principales
    if (uniqueStakeholders.length > 0) {
      businessContext += `. Participantes externos: ${uniqueStakeholders.slice(0, 3).join(', ')}`;
    }

    // Agregar fechas clave
    if (keyMilestones.length > 0) {
      businessContext += `. Fechas relevantes: ${keyMilestones.slice(0, 2).join(', ')}`;
    }

    businessContext += `. Total de comunicaciones: ${messages.length} mensajes`;

    // Agregar estado actual basado en tareas
    if (tasks.length > 0) {
      const urgentCount = tasks.filter(t => t.priority === 'urgent').length;
      const highCount = tasks.filter(t => t.priority === 'high').length;
      
      if (urgentCount > 0) {
        businessContext += `. Estado: ${urgentCount} acción(es) urgente(s) pendiente(s)`;
      } else if (highCount > 0) {
        businessContext += `. Estado: ${highCount} acción(es) de alta prioridad pendiente(s)`;
      } else if (tasks.length > 0) {
        businessContext += `. Estado: ${tasks.length} acción(es) pendiente(s)`;
      } else {
        businessContext += `. Estado: Sin acciones pendientes detectadas`;
      }
    }

    return {
      businessContext,
      stakeholders: uniqueStakeholders,
      riskFlags: riskFlags.length > 0 ? riskFlags : ['Sin alertas detectadas'],
      keyMilestones: keyMilestones.length > 0 ? keyMilestones : ['No se detectaron fechas específicas'],
      pendingDependencies: pendingDependencies.length > 0 ? pendingDependencies : ['No se detectaron dependencias externas']
    };
  }

  /**
   * Detecta tareas pendientes basadas en keywords y patrones
   */
  private detectTasks(
    message: EmailMessage, 
    fullText: string,
    companyContext?: {
      companyName?: string;
      companyDomain?: string;
      employeeEmails?: string[];
    }
  ): BasicTask[] {
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
      // Título profesional: acción + contexto
      const ref = trackingNumbers.length > 0 ? trackingNumbers[0] : '';
      const date = dates.length > 0 ? dates[0] : '';
      
      let title = actionTypes[0]; // Usar primera acción principal
      if (ref) title += ` ${ref}`;
      if (date && !ref) title += ` para ${date}`;
      
      // Descripción: TRANSFORMAR conversación a contenido profesional AGRESIVO
      let description = message.snippet;
      
      // 1. ELIMINAR TODO saludo/despedida al inicio
      description = description.replace(/^(buen[ao]s?\s+(dia|tarde|noche|dias)|hola|hello|hi|dear|estimad[ao])\s+[a-záéíóúñ]+[,:\s]*/gi, '');
      
      // 2. TRANSFORMAR frases conversacionales a lenguaje objetivo
      description = description
        .replace(/ya\s+(solicité|solicite|solicito|envié|envie|envío|mandé|mande|mando)/gi, 'Solicitado')
        .replace(/en\s+cuanto\s+(la|lo|los|las)\s+(tenga|reciba|tengamos|recibamos)/gi, 'Pendiente de recibir')
        .replace(/te\s+(la|lo|los|las)\s+(comparto|envío|envio|mando|enviaré|enviare)/gi, 'Se enviará')
        .replace(/cuando\s+puedas/gi, 'Lo antes posible')
        .replace(/si\s+puedes/gi, 'Se requiere')
        .replace(/favor\s+de/gi, 'Requerido')
        .replace(/por\s+favor/gi, '')
        .replace(/I'?ll?\s+pending/gi, 'Pendiente')
        .replace(/I'?ll?\s+send/gi, 'Se enviará')
        .replace(/please/gi, '')
        .replace(/kindly/gi, '')
        
        // Eliminar TODAS las despedidas completas
        .replace(/quedo\s+atent[ao].*/gi, '')
        .replace(/quedamos?\s+(a\s+la\s+orden|al\s+pendiente).*/gi, '')
        .replace(/best\s+regards.*/gi, '')
        .replace(/atentamente.*/gi, '')
        .replace(/saludos.*/gi, '')
        .replace(/regards.*/gi, '')
        .replace(/thank\s+you.*/gi, '')
        .replace(/gracias.*/gi, '');
      
      // 3. Eliminar PRONOMBRES de segunda persona (te, ti, you, your, tu, tus)
      description = description
        .replace(/\b(te|ti)\b/gi, '')
        .replace(/\byou\b/gi, '')
        .replace(/\byour\b/gi, '')
        .replace(/\btu\b/gi, '')
        .replace(/\btus\b/gi, '');
      
      // 4. Convertir abreviaciones a texto completo
      description = description
        .replace(/\bal\s+AA\b/gi, 'al agente aduanal')
        .replace(/\bAA\b/gi, 'Agente aduanal')
        .replace(/\bECU\b/gi, 'ECU')
        .replace(/\binfo\b/gi, 'información')
        .replace(/\bdoc\b/gi, 'documento')
        .replace(/\bdocs\b/gi, 'documentos');
      
      // 5. Limpiar espacios múltiples, puntuación y capitalizar
      description = description
        .replace(/\s+/g, ' ')
        .replace(/\s+,/g, ',')
        .replace(/\s+\./g, '.')
        .trim()
        .slice(0, 100);
      
      // Capitalizar primera letra
      if (description.length > 0) {
        description = description.charAt(0).toUpperCase() + description.slice(1);
      }
      
      // Si queda muy corto o solo saludos/despedidas, generar descripción ESTRUCTURADA
      if (description.length < 15 || description.match(/^(buen|hola|hello|dear|estimad|salud|regard)/i)) {
        description = `${actionTypes[0].charAt(0).toUpperCase() + actionTypes[0].slice(1)} requerido`;
        if (ref) description += ` - ${ref}`;
        if (date && !ref) description += ` - ${date}`;
        if (!ref && !date && amounts.length > 0) description += ` - ${amounts[0]}`;
      }

      tasks.push({
        title: title.slice(0, 60),
        description,
        priority,
        confidence: 65,
        reasoning: `Detectado automáticamente por keywords: ${actionTypes.join(', ')}`,
        source: 'rule-based'
      });
    }

    // Si hay palabras de urgencia pero no acción específica, crear task genérica
    else if (hasUrgent || hasHigh) {
      tasks.push({
        title: 'Revisar email',
        description: message.snippet.slice(0, 100).trim() + (message.snippet.length > 100 ? '...' : ''),
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
  private generateNote(
    message: EmailMessage, 
    fullText: string,
    companyContext?: {
      companyName?: string;
      companyDomain?: string;
      employeeEmails?: string[];
    }
  ): BasicNote | null {
    // Extraer información clave
    const trackingNumbers = this.extractMatches(fullText, this.patterns.tracking);
    const dates = this.extractMatches(fullText, this.patterns.date);
    const amounts = this.extractMatches(fullText, this.patterns.amount);

    // Solo crear nota si hay información relevante
    const hasRelevantInfo = trackingNumbers.length > 0 || dates.length > 0 || amounts.length > 0;
    
    if (!hasRelevantInfo) {
      return null;
    }

    // TRANSFORMAR conversación informal a contenido profesional
    let cleanContent = message.snippet;
    
    // 1. Eliminar saludos completos (al inicio o en medio)
    cleanContent = cleanContent.replace(/(^|\s)(buen[ao]s?\s+(dia|tarde|noche|dias)|hola|hello|hi|dear|estimad[ao])\s+[a-z]+(\s|,|:)/gi, ' ');
    
    // 2. Eliminar frases conversacionales comunes
    cleanContent = cleanContent
      .replace(/ya\s+(solicite|solicité|envie|envié|mande|mandé)/gi, 'Solicitado')
      .replace(/en\s+cuanto\s+(la|lo|los|las)\s+(tenga|reciba|tengamos|recibamos)/gi, 'Pendiente de recibir')
      .replace(/te\s+(la|lo|los|las)\s+(comparto|envio|envío|mando)/gi, 'para compartir')
      .replace(/quedo\s+atent[ao].*/gi, '')
      .replace(/quedamos?\s+(a\s+la\s+orden|al\s+pendiente).*/gi, '')
      .replace(/\/\s*I[''']ll?\s+pending.*/gi, '')
      .replace(/best\s+regards.*/gi, '')
      .replace(/atentamente.*/gi, '')
      .replace(/saludos.*/gi, '')
      .replace(/regards.*/gi, '');
    
    // 3. Convertir referencias informales a formales
    cleanContent = cleanContent
      .replace(/\bal\s+AA\b/gi, 'al agente aduanal')
      .replace(/\bAA\b/gi, 'Agente aduanal');
    
    // 4. Limpiar espacios múltiples y puntuación
    cleanContent = cleanContent
      .replace(/\s+/g, ' ')
      .replace(/\s+,/g, ',')
      .replace(/\s+\./g, '.')
      .trim();
    
    // 5. Capitalizar primera letra
    if (cleanContent.length > 0) {
      cleanContent = cleanContent.charAt(0).toUpperCase() + cleanContent.slice(1);
    }

    // Si después de limpiar queda muy poco o solo quedaron saludos, generar nota estructurada
    if (cleanContent.length < 30 || cleanContent.match(/^(buen|hola|hello|dear|estimad)/i)) {
      const parts = [];
      if (trackingNumbers.length > 0) parts.push(`Ref: ${trackingNumbers[0]}`);
      if (dates.length > 0) parts.push(`Fecha: ${dates[0]}`);
      if (amounts.length > 0) parts.push(`Monto: ${amounts[0]}`);
      
      if (parts.length > 0) {
        cleanContent = `Comunicación registrada. ${parts.join('. ')}.`;
      } else {
        // No hay información suficiente para crear nota
        return null;
      }
    }

    // Limitar a 150 caracteres
    const content = cleanContent.slice(0, 150).trim() + (cleanContent.length > 150 ? '...' : '');

    // Verificar que tenga longitud mínima
    if (content.length < 30) {
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
