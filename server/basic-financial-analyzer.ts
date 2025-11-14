/**
 * Basic Financial Analyzer - Fallback 100% Rule-Based
 * 
 * Sistema de respaldo que funciona sin IA cuando:
 * - Gemini alcanza límite de uso (429)
 * - Circuit breaker está OPEN
 * - No hay API key de Gemini
 * 
 * Usa solo código rule-based: regex, análisis de texto, patrones.
 */

interface DetectedTransaction {
  type: "payment" | "expense";
  amount: number;
  currency: string;
  date: Date;
  description: string;
  paymentMethod?: string;
  reference?: string;
  category?: string;
  confidence: number;
  reasoning: string;
}

export class BasicFinancialAnalyzer {
  
  /**
   * Palabras clave para detectar pagos
   */
  private paymentKeywords = [
    // Español
    'pago', 'pagó', 'transferencia', 'depósito', 'deposito', 'abono',
    'cobro', 'cobrado', 'recibo', 'comprobante de pago', 'voucher',
    'transferido', 'enviado', 'remesa', 'remitido',
    // Inglés
    'payment', 'paid', 'transfer', 'deposit', 'receipt', 'voucher',
    'transferred', 'sent', 'remittance'
  ];

  /**
   * Palabras clave para detectar gastos
   */
  private expenseKeywords = [
    // Español
    'gasto', 'factura', 'compra', 'adquisición', 'adquisicion',
    'costo', 'cargo', 'cuenta', 'consumo', 'servicio',
    'proveedor', 'invoice', 'bill', 'solicitud de pago',
    // Inglés
    'expense', 'purchase', 'acquisition', 'cost', 'charge',
    'bill', 'supplier', 'vendor', 'service fee'
  ];

  /**
   * Métodos de pago comunes
   */
  private paymentMethods = {
    transfer: ['transferencia', 'transfer', 'spei', 'wire'],
    cash: ['efectivo', 'cash', 'contado'],
    check: ['cheque', 'check'],
    card: ['tarjeta', 'card', 'visa', 'mastercard'],
    other: ['otro', 'other']
  };

  /**
   * Categorías de gastos
   */
  private expenseCategories = {
    travel: ['viaje', 'viático', 'travel', 'transport', 'hotel', 'vuelo', 'flight'],
    supplies: ['suministro', 'material', 'supplies', 'equipment', 'papelería'],
    services: ['servicio', 'service', 'consultoría', 'consulting', 'asesoría'],
    customs: ['despacho', 'aduana', 'customs', 'pedimento', 'importación'],
    freight: ['flete', 'freight', 'transporte', 'shipping', 'envío'],
    other: ['otro', 'other', 'varios', 'miscellaneous']
  };

  /**
   * Patrones regex para extraer información estructurada
   */
  private patterns = {
    // Montos: $1,234.56, USD 1234, 1,234.56 MXN, $1234.56 USD
    amount: /(?:(?:\$|USD|MXN|EUR|ARS)\s?)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s?(?:USD|MXN|EUR|ARS)?/gi,
    
    // Fechas: 15/01/2024, 15-01-2024, 2024-01-15, Jan 15 2024
    date: /(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})|(\w{3,9}\s+\d{1,2},?\s+\d{4})/gi,
    
    // Referencias: REF-123, SPEI-123456, FOLIO 12345, No. 98765
    reference: /(?:REF|SPEI|FOLIO|NO\.|REFERENCIA|REFERENCE|CLAVE)[\s:.-]*([A-Z0-9]{4,})/gi,
    
    // Monedas
    currency: /\b(USD|MXN|EUR|ARS|DOLAR|DOLARES|PESO|PESOS)\b/gi
  };

  /**
   * Analiza texto extraído y detecta transacciones usando reglas
   */
  async analyzeText(
    text: string,
    fileName: string,
    operationContext?: {
      operationId: string;
      operationName: string;
      clientName?: string;
    }
  ): Promise<DetectedTransaction[]> {
    console.log(`[Basic Financial Analyzer] 🔍 Analizando: ${fileName} (${text.length} caracteres)`);
    
    const textLower = text.toLowerCase();
    const transactions: DetectedTransaction[] = [];

    // Determinar tipo de transacción basado en keywords
    const isPayment = this.detectPayment(textLower, fileName.toLowerCase());
    const isExpense = this.detectExpense(textLower, fileName.toLowerCase());

    // Si no detecta nada claro, retornar vacío
    if (!isPayment && !isExpense) {
      console.log(`[Basic Financial Analyzer] ⚠️ No se detectaron indicadores de pago o gasto`);
      return [];
    }

    // Extraer información estructurada
    const amounts = this.extractAmounts(text);
    const dates = this.extractDates(text);
    const reference = this.extractReference(text);
    const currency = this.extractCurrency(text);

    // Validar que tengamos al menos un monto
    if (amounts.length === 0) {
      console.log(`[Basic Financial Analyzer] ⚠️ No se detectaron montos en el texto`);
      return [];
    }

    // Tomar el primer monto encontrado (usualmente el más relevante)
    const amount = amounts[0];
    
    // Tomar la primera fecha o usar fecha actual
    const date = dates.length > 0 ? dates[0] : new Date();

    // Determinar tipo final
    let type: "payment" | "expense";
    let confidence = 0.5; // Confianza base baja para rule-based
    let reasoning = "";

    if (isPayment && !isExpense) {
      type = "payment";
      confidence = 0.65;
      reasoning = "Detectado como pago por palabras clave en texto/nombre de archivo";
    } else if (isExpense && !isPayment) {
      type = "expense";
      confidence = 0.65;
      reasoning = "Detectado como gasto por palabras clave en texto/nombre de archivo";
    } else {
      // Ambos detectados - priorizar basado en contexto
      if (fileName.toLowerCase().includes('pago') || fileName.toLowerCase().includes('payment')) {
        type = "payment";
        confidence = 0.6;
        reasoning = "Detectado como pago (priorizado por nombre de archivo)";
      } else {
        type = "expense";
        confidence = 0.6;
        reasoning = "Detectado como gasto (priorizado por contexto)";
      }
    }

    // Generar descripción
    const description = this.generateDescription(
      type,
      fileName,
      operationContext?.operationName || 'Operación desconocida'
    );

    // Crear transacción base
    const transaction: DetectedTransaction = {
      type,
      amount,
      currency,
      date,
      description,
      confidence,
      reasoning
    };

    // Agregar campos específicos según tipo
    if (type === "payment") {
      transaction.paymentMethod = this.detectPaymentMethod(textLower);
      transaction.reference = reference;
    } else {
      transaction.category = this.detectExpenseCategory(textLower, fileName.toLowerCase());
    }

    transactions.push(transaction);

    console.log(`[Basic Financial Analyzer] ✅ Detectada 1 transacción: ${type} de ${currency} ${amount.toFixed(2)}`);
    
    return transactions;
  }

  /**
   * Detecta si el texto contiene indicadores de pago
   */
  private detectPayment(text: string, fileName: string): boolean {
    const combinedText = `${text} ${fileName}`;
    return this.paymentKeywords.some(keyword => combinedText.includes(keyword));
  }

  /**
   * Detecta si el texto contiene indicadores de gasto
   */
  private detectExpense(text: string, fileName: string): boolean {
    const combinedText = `${text} ${fileName}`;
    return this.expenseKeywords.some(keyword => combinedText.includes(keyword));
  }

  /**
   * Extrae todos los montos encontrados en el texto
   */
  private extractAmounts(text: string): number[] {
    const amounts: number[] = [];
    const matches = text.matchAll(this.patterns.amount);
    
    for (const match of matches) {
      const amountStr = match[1] || match[0];
      const cleanAmount = amountStr.replace(/[$,]/g, '');
      const amount = parseFloat(cleanAmount);
      
      // Validar que sea un monto razonable (entre $1 y $10,000,000)
      if (!isNaN(amount) && amount >= 1 && amount <= 10000000) {
        amounts.push(amount);
      }
    }
    
    return amounts;
  }

  /**
   * Extrae fechas del texto
   */
  private extractDates(text: string): Date[] {
    const dates: Date[] = [];
    const matches = text.matchAll(this.patterns.date);
    
    for (const match of matches) {
      try {
        const dateStr = match[0];
        const date = new Date(dateStr);
        
        // Validar que la fecha sea válida y razonable (últimos 5 años o futuro 1 año)
        const now = new Date();
        const fiveYearsAgo = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
        const oneYearAhead = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        
        if (!isNaN(date.getTime()) && date >= fiveYearsAgo && date <= oneYearAhead) {
          dates.push(date);
        }
      } catch (error) {
        // Ignorar fechas inválidas
      }
    }
    
    return dates;
  }

  /**
   * Extrae número de referencia
   */
  private extractReference(text: string): string | undefined {
    const match = this.patterns.reference.exec(text);
    return match ? match[1] : undefined;
  }

  /**
   * Extrae moneda del texto
   */
  private extractCurrency(text: string): string {
    const match = this.patterns.currency.exec(text);
    
    if (match) {
      const curr = match[1].toUpperCase();
      if (curr === 'DOLAR' || curr === 'DOLARES') return 'USD';
      if (curr === 'PESO' || curr === 'PESOS') return 'MXN';
      return curr;
    }
    
    // Default a MXN (moneda más común en el contexto)
    return 'MXN';
  }

  /**
   * Detecta método de pago
   */
  private detectPaymentMethod(text: string): string {
    for (const [method, keywords] of Object.entries(this.paymentMethods)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return method;
      }
    }
    return 'other';
  }

  /**
   * Detecta categoría de gasto
   */
  private detectExpenseCategory(text: string, fileName: string): string {
    const combinedText = `${text} ${fileName}`;
    
    for (const [category, keywords] of Object.entries(this.expenseCategories)) {
      if (keywords.some(keyword => combinedText.includes(keyword))) {
        return category;
      }
    }
    return 'other';
  }

  /**
   * Genera descripción descriptiva
   */
  private generateDescription(type: string, fileName: string, operationName: string): string {
    const cleanFileName = fileName.replace(/\.(pdf|png|jpg|jpeg)$/i, '');
    
    if (type === 'payment') {
      return `Comprobante de pago - ${cleanFileName} (${operationName})`;
    } else {
      return `Gasto detectado - ${cleanFileName} (${operationName})`;
    }
  }
}
