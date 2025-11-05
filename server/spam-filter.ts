/**
 * Sistema de filtrado inteligente de spam para Gmail
 * Filtra correos basura pero MANTIENE correos importantes como:
 * - Bancos y estados de cuenta
 * - Facturas y comprobantes
 * - Documentos legales
 * - Notificaciones transaccionales importantes
 */

interface EmailMetadata {
  fromEmail: string;
  fromName: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  labels?: string[];
}

export class SpamFilter {
  
  // Dominios de correos importantes que NUNCA deben filtrarse
  private static IMPORTANT_DOMAINS = [
    // Bancos mexicanos
    'banamex.com', 'bancomer.com', 'bbva.mx', 'santander.com.mx', 'banorte.com',
    'hsbc.com.mx', 'scotiabank.com.mx', 'banregio.com', 'inbursa.com',
    'banco-base.com', 'bancoazteca.com', 'banbajio.com',
    
    // Bancos internacionales
    'bankofamerica.com', 'chase.com', 'wellsfargo.com', 'citibank.com',
    
    // Procesadores de pago y facturación
    'stripe.com', 'paypal.com', 'mercadopago.com', 'openpay.mx',
    'conekta.io', 'clip.mx', 'facturapi.io', 'facturaelectronica.sat.gob.mx',
    
    // Gobierno y entidades oficiales
    'sat.gob.mx', 'gob.mx', 'imss.gob.mx', 'infonavit.org.mx',
    
    // Servicios legales y contables
    'sat.gob.mx', 'notario.gob.mx',
    
    // Proveedores de transporte y logística importantes
    'fedex.com', 'dhl.com', 'ups.com', 'estafeta.com', 'redpack.com.mx',
    
    // Servicios empresariales críticos
    'amazonaws.com', 'google.com', 'microsoft.com', 'azure.com',
    'twilio.com', 'sendgrid.net', 'mailgun.net',
  ];

  // Palabras clave en asunto que indican correos IMPORTANTES
  private static IMPORTANT_SUBJECT_KEYWORDS = [
    // Finanzas
    'factura', 'invoice', 'estado de cuenta', 'comprobante', 'pago',
    'transferencia', 'recibo', 'receipt', 'payment', 'billing',
    'cargo', 'charge', 'abono', 'deposito', 'deposit',
    
    // Legal y contratos
    'contrato', 'contract', 'acuerdo', 'agreement', 'legal',
    'notificacion legal', 'legal notice', 'citatorio',
    
    // Documentos oficiales
    'constancia', 'certificado', 'certificate', 'titulo',
    'documento oficial', 'official document',
    
    // Transacciones
    'pedido', 'order', 'compra', 'purchase', 'transaccion',
    'transaction', 'confirmacion', 'confirmation',
    
    // Envíos y logística
    'tracking', 'rastreo', 'envio', 'shipment', 'delivery',
    'entrega', 'guia', 'waybill',
    
    // Seguridad y alertas
    'alerta', 'alert', 'seguridad', 'security', 'verificacion',
    'verification', 'autenticacion', 'authentication',
    
    // Cotizaciones y propuestas
    'cotizacion', 'quote', 'propuesta', 'proposal', 'presupuesto',
    'budget', 'estimate',
  ];

  // Palabras clave que indican SPAM (solo si no es importante)
  private static SPAM_SUBJECT_KEYWORDS = [
    // Marketing genérico
    'oferta exclusiva', 'exclusive offer', 'descuento limitado',
    'limited discount', 'compra ahora', 'buy now', 'aprovecha',
    'no te lo pierdas', "don't miss", 'ultima oportunidad',
    'last chance', 'gratis', 'free', 'regalo', 'gift',
    
    // Suscripciones no solicitadas
    'newsletter', 'boletin', 'suscribete', 'subscribe',
    'unsubscribe', 'darse de baja',
    
    // Promociones
    'promocion', 'promotion', 'sale', 'venta', 'rebaja',
    'clearance', 'liquidacion',
  ];

  // Remitentes conocidos de spam
  private static SPAM_SENDERS = [
    'noreply@', 'no-reply@', 'donotreply@', 'marketing@',
    'newsletter@', 'promo@', 'offers@', 'deals@',
    'notifications@samsung', 'updates@linkedin',
  ];

  // Dominios de spam conocidos
  private static SPAM_DOMAINS = [
    'unroll.me', 'mailchimp.com', 'sendgrid.net',
    'constantcontact.com', 'campaign-archive.com',
  ];

  /**
   * Determina si un correo es spam
   * @returns true si es spam (debe filtrarse), false si es importante (debe guardarse)
   */
  static isSpam(email: EmailMetadata): boolean {
    const { fromEmail, fromName, subject, labels } = email;
    const lowerEmail = fromEmail.toLowerCase();
    const lowerSubject = subject.toLowerCase();
    const lowerName = fromName.toLowerCase();

    // 1. Si Gmail ya lo marcó como spam, es spam
    if (labels?.includes('SPAM')) {
      return true;
    }

    // 2. Si es de un dominio IMPORTANTE, NUNCA es spam
    const domain = this.extractDomain(lowerEmail);
    if (this.IMPORTANT_DOMAINS.some(d => domain.includes(d))) {
      return false;
    }

    // 3. Si el asunto contiene palabras clave IMPORTANTES, NO es spam
    if (this.IMPORTANT_SUBJECT_KEYWORDS.some(keyword => 
      lowerSubject.includes(keyword.toLowerCase())
    )) {
      return false;
    }

    // 4. Si es de un remitente conocido de spam
    if (this.SPAM_SENDERS.some(sender => lowerEmail.includes(sender))) {
      // Excepción: si tiene palabras importantes en el asunto, mantenerlo
      if (this.IMPORTANT_SUBJECT_KEYWORDS.some(keyword => 
        lowerSubject.includes(keyword.toLowerCase())
      )) {
        return false;
      }
      return true;
    }

    // 5. Si es de un dominio de spam conocido
    if (this.SPAM_DOMAINS.some(d => domain.includes(d))) {
      // Excepción: si tiene palabras importantes, mantenerlo
      if (this.IMPORTANT_SUBJECT_KEYWORDS.some(keyword => 
        lowerSubject.includes(keyword.toLowerCase())
      )) {
        return false;
      }
      return true;
    }

    // 6. Si tiene múltiples palabras clave de spam y ninguna importante
    const spamKeywordCount = this.SPAM_SUBJECT_KEYWORDS.filter(keyword =>
      lowerSubject.includes(keyword.toLowerCase())
    ).length;

    if (spamKeywordCount >= 2) {
      return true;
    }

    // 7. Detección de newsletters genéricos
    if (this.isGenericNewsletter(lowerEmail, lowerSubject, lowerName)) {
      return true;
    }

    // Por defecto, NO filtrar (mejor tener un falso negativo que perder correos importantes)
    return false;
  }

  /**
   * Detecta newsletters genéricos
   */
  private static isGenericNewsletter(email: string, subject: string, name: string): boolean {
    const newsletterPatterns = [
      /newsletter/i,
      /boletin/i,
      /weekly.*digest/i,
      /daily.*update/i,
      /resumen.*semanal/i,
    ];

    // Si el asunto indica newsletter
    const isNewsletterSubject = newsletterPatterns.some(pattern => pattern.test(subject));
    
    // Y NO tiene palabras importantes
    const hasImportantWords = this.IMPORTANT_SUBJECT_KEYWORDS.some(keyword =>
      subject.includes(keyword.toLowerCase())
    );

    return isNewsletterSubject && !hasImportantWords;
  }

  /**
   * Extrae el dominio de un email
   */
  private static extractDomain(email: string): string {
    const parts = email.split('@');
    return parts.length === 2 ? parts[1] : email;
  }

  /**
   * Obtiene estadísticas del filtrado
   */
  static getFilterStats(email: EmailMetadata): {
    isSpam: boolean;
    reason: string;
    confidence: 'high' | 'medium' | 'low';
  } {
    const isSpam = this.isSpam(email);
    const domain = this.extractDomain(email.fromEmail.toLowerCase());
    
    let reason = '';
    let confidence: 'high' | 'medium' | 'low' = 'low';

    if (email.labels?.includes('SPAM')) {
      reason = 'Marcado como SPAM por Gmail';
      confidence = 'high';
    } else if (this.IMPORTANT_DOMAINS.some(d => domain.includes(d))) {
      reason = 'Dominio importante (banco, facturación, gobierno)';
      confidence = 'high';
    } else if (this.IMPORTANT_SUBJECT_KEYWORDS.some(k => 
      email.subject.toLowerCase().includes(k.toLowerCase())
    )) {
      reason = 'Asunto contiene palabras clave importantes';
      confidence = 'high';
    } else if (this.SPAM_SENDERS.some(s => email.fromEmail.toLowerCase().includes(s))) {
      reason = 'Remitente conocido de spam/marketing';
      confidence = 'medium';
    } else if (isSpam) {
      reason = 'Detectado como spam por múltiples indicadores';
      confidence = 'medium';
    } else {
      reason = 'No se detectó como spam';
      confidence = 'low';
    }

    return { isSpam, reason, confidence };
  }
}
