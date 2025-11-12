/**
 * Facturama Invoice Extractor (Orchestrator)
 * 
 * Orquestador que detecta y procesa facturas CFDI en formato XML o PDF
 * Ruta de alta confianza: archivos XML CFDI con parsing estructurado
 * Ruta de respaldo: archivos PDF con OCR
 * 
 * Funcionalidades:
 * 1. Detección automática de formato (XML vs PDF) por extensión/mime type
 * 2. Delegación a parser especializado (XML parser o PDF OCR)
 * 3. Extracción de datos del receptor: RFC, nombre, dirección, CP, régimen fiscal
 * 4. Detección de número de operación en "Orden de Compra"
 * 5. Validación de formato RFC mexicano
 * 6. Extracción de conceptos y montos para vinculación financiera
 */

import Tesseract from 'tesseract.js';
import { facturamaCfdXmlParser } from './facturama-cfdi-xml-parser';

export interface FacturamaReceptorData {
  // Datos obligatorios
  nombre: string;
  rfc: string;
  
  // Dirección completa
  direccion?: string;
  ciudad?: string;
  estado?: string;
  codigoPostal?: string;
  pais?: string;
  
  // Datos fiscales
  regimenFiscal?: string;
  usoCFDI?: string;
  
  // Metadata
  confidence: number;
  source: 'ocr' | 'text-extraction';
}

export interface FacturamaInvoiceItem {
  // Campos SAT obligatorios
  satProductCode: string; // Código SAT de 8 dígitos (ej: 81141601)
  quantity: number; // Cantidad
  satUnitCode: string; // Clave de unidad SAT (ej: E48 - Unidad de servicio)
  description: string; // Concepto/descripción completa
  unitPrice: number; // Precio unitario
  amount: number; // Importe total
  
  // Campos opcionales
  satTaxObject?: string; // 01=Sin objeto de impuesto, 02=Con objeto de impuesto
  identification?: string; // No Identificación adicional
  taxRate?: number; // Tasa de impuesto (0.16 para IVA 16%)
  taxAmount?: number; // Monto del impuesto
}

export interface FacturamaInvoiceData {
  // Datos del receptor (cliente)
  receptor: FacturamaReceptorData;
  
  // Datos de la factura
  folio?: string;
  folioFiscal?: string;
  ordenCompra?: string; // NAVI-XXXXXX
  fecha?: string;
  subtotal?: number; // Subtotal antes de impuestos
  tax?: number; // Total de impuestos
  total?: number; // Total final
  moneda?: string;
  
  // Datos del emisor (quien factura)
  emisor?: {
    nombre: string;
    rfc: string;
    regimenFiscal?: string;
    lugarExpedicion?: string; // Código postal
  };
  
  // CFDI metadata
  metodoPago?: string; // PUE, PPD
  formaPago?: string; // 99=Por definir, 03=Transferencia, etc.
  tipoComprobante?: string; // I=Ingreso
  usoCFDI?: string; // G03, etc.
  exportacion?: string; // 01=No aplica
  
  // Items/productos de la factura
  items?: FacturamaInvoiceItem[];
  
  // Conceptos para vinculación financiera (legacy)
  conceptos?: string[];
  
  // Metadata
  isFacturamaInvoice: boolean;
  confidence: number;
}

export class FacturamaInvoiceExtractor {
  
  /**
   * Extrae datos de una factura Facturama desde un buffer (XML o PDF)
   * 
   * Orquestador que detecta automáticamente el formato y delega:
   * - XML CFDI: Alta confianza, parsing estructurado
   * - PDF: Respaldo con OCR
   * 
   * @param fileBuffer Buffer del archivo (XML o PDF)
   * @param filename Nombre del archivo
   * @param mimeType Tipo MIME opcional para detección más precisa
   */
  async extractInvoiceData(
    fileBuffer: Buffer, 
    filename: string,
    mimeType?: string
  ): Promise<FacturamaInvoiceData | null> {
    
    console.log(`[Facturama Extractor] 📄 Analizando: ${filename}`);
    
    // 1. Verificar si parece ser una factura
    if (!this.isLikelyInvoice(filename)) {
      console.log('[Facturama Extractor] ⏭️  No parece ser una factura');
      return null;
    }
    
    // 2. Detectar formato (XML vs PDF)
    const isXml = this.isXmlFile(filename, fileBuffer, mimeType);
    
    if (isXml) {
      // ✅ Ruta de alta confianza: XML CFDI
      console.log('[Facturama Extractor] 🎯 Detectado archivo XML - usando parser estructurado');
      return await facturamaCfdXmlParser.parseXml(fileBuffer, filename);
    } else {
      // 📄 Ruta de respaldo: PDF con OCR
      console.log('[Facturama Extractor] 📄 Detectado archivo PDF - usando OCR');
      return await this.extractFromPdf(fileBuffer, filename);
    }
  }
  
  /**
   * Detecta si el archivo es XML basándose en extensión, mime type y contenido
   */
  private isXmlFile(filename: string, fileBuffer: Buffer, mimeType?: string): boolean {
    // 1. Verificar extensión
    if (filename.toLowerCase().endsWith('.xml')) {
      return true;
    }
    
    // 2. Verificar MIME type
    if (mimeType && (mimeType.includes('xml') || mimeType === 'application/xml' || mimeType === 'text/xml')) {
      return true;
    }
    
    // 3. Verificar primeros bytes del contenido
    const firstBytes = fileBuffer.toString('utf-8', 0, Math.min(100, fileBuffer.length));
    if (firstBytes.trim().startsWith('<?xml')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Extrae datos de una factura Facturama desde un buffer PDF (flujo legacy con OCR)
   */
  private async extractFromPdf(pdfBuffer: Buffer, filename: string): Promise<FacturamaInvoiceData | null> {
    
    // 1. Extraer texto del PDF usando OCR
    let extractedText = '';
    try {
      extractedText = await this.extractTextFromPDF(pdfBuffer);
      
      if (!extractedText || extractedText.length < 100) {
        console.log('[Facturama Extractor] ⚠️  No se pudo extraer texto suficiente del PDF');
        return null;
      }
      
    } catch (error) {
      console.error('[Facturama Extractor] Error extracting text:', error);
      return null;
    }
    
    // 2. Verificar si es una factura de Facturama/CFDI
    if (!this.isFacturamaInvoice(extractedText)) {
      console.log('[Facturama Extractor] ⏭️  No es una factura Facturama/CFDI');
      return null;
    }
    
    console.log('[Facturama Extractor] ✅ Factura Facturama detectada - Extrayendo datos...');
    
    // 3. Extraer datos del receptor (cliente)
    const receptor = this.extractReceptorData(extractedText);
    
    if (!receptor) {
      console.log('[Facturama Extractor] ⚠️  No se pudieron extraer datos del receptor');
      return null;
    }
    
    // 5. Extraer datos del emisor (quien factura)
    const emisor = this.extractEmisorData(extractedText);
    
    // 6. Extraer montos (subtotal, impuestos, total)
    const amounts = this.extractAmounts(extractedText);
    
    // 7. Extraer items/productos de la factura
    const items = this.extractInvoiceItems(extractedText);
    
    // 8. Construir objeto completo de factura
    const invoiceData: FacturamaInvoiceData = {
      receptor,
      folio: this.extractFolio(extractedText),
      folioFiscal: this.extractFolioFiscal(extractedText),
      ordenCompra: this.extractOrdenCompra(extractedText),
      fecha: this.extractFecha(extractedText),
      subtotal: amounts.subtotal,
      tax: amounts.tax,
      total: amounts.total,
      moneda: this.extractMoneda(extractedText),
      
      emisor,
      
      // CFDI metadata
      metodoPago: this.extractMetodoPago(extractedText),
      formaPago: this.extractFormaPago(extractedText),
      tipoComprobante: this.extractTipoComprobante(extractedText),
      usoCFDI: receptor.usoCFDI,
      exportacion: this.extractExportacion(extractedText),
      
      // Items
      items,
      
      // Legacy
      conceptos: items.map(item => item.description),
      
      isFacturamaInvoice: true,
      confidence: receptor.confidence
    };
    
    console.log(`[Facturama Extractor] ✅ Datos extraídos - Cliente: ${receptor.nombre}, Items: ${items.length}, Total: ${amounts.total}`);
    
    return invoiceData;
  }

  /**
   * Verifica si el nombre del archivo sugiere que es una factura
   */
  private isLikelyInvoice(filename: string): boolean {
    const invoiceKeywords = ['factura', 'invoice', 'cfdi', 'xml', 'pdf'];
    const lowerFilename = filename.toLowerCase();
    return invoiceKeywords.some(keyword => lowerFilename.includes(keyword));
  }

  /**
   * Extrae texto de un PDF usando OCR (Tesseract.js)
   */
  private async extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    try {
      // Nota: Para PDFs reales necesitarías convertir a imagen primero
      // Aquí asumo que el PDF puede ser leído como texto directamente
      // o que ya está en formato imagen
      
      // Por ahora, intentaremos extraer como texto plano
      const text = pdfBuffer.toString('utf-8');
      
      // Si el texto es muy corto, probablemente es un PDF escaneado
      // y necesitaríamos OCR real, pero para facturas digitales de Facturama
      // normalmente el texto está embebido
      
      return text;
      
    } catch (error) {
      console.error('[Facturama Extractor] Error extracting text:', error);
      return '';
    }
  }

  /**
   * Verifica si el texto corresponde a una factura Facturama/CFDI
   */
  private isFacturamaInvoice(text: string): boolean {
    const cfdiKeywords = [
      'CFDI',
      'Folio Fiscal',
      'Emisor:',
      'Receptor:',
      'Régimen Fiscal',
      'Uso del CFDI',
      'SAT'
    ];
    
    const lowerText = text.toLowerCase();
    const matchCount = cfdiKeywords.filter(keyword => 
      lowerText.includes(keyword.toLowerCase())
    ).length;
    
    // Si tiene al menos 4 de las keywords, es muy probable que sea un CFDI
    return matchCount >= 4;
  }

  /**
   * Extrae datos del receptor (cliente) de la factura
   */
  private extractReceptorData(text: string): FacturamaReceptorData | null {
    
    // Buscar sección "Receptor:"
    const receptorMatch = text.match(/Receptor\s*:([\s\S]*?)(?:Código postal|Lugar de Expedición|Efecto del comprobante|Folio Fiscal)/i);
    
    if (!receptorMatch) {
      return null;
    }
    
    const receptorText = receptorMatch[1];
    
    // Extraer RFC (formato: 12-13 caracteres alfanuméricos)
    const rfcMatch = receptorText.match(/([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{2,3})/);
    if (!rfcMatch) {
      console.log('[Facturama Extractor] ⚠️  RFC no encontrado en sección receptor');
      return null;
    }
    const rfc = rfcMatch[1];
    
    // Extraer nombre (generalmente la primera línea después de "Receptor:")
    const lines = receptorText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let nombre = '';
    
    // El nombre suele estar en las primeras líneas, antes del RFC
    for (const line of lines) {
      if (!line.match(/[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{2,3}/) && line.length > 3 && line.length < 100) {
        nombre = line;
        break;
      }
    }
    
    if (!nombre) {
      nombre = 'Cliente sin nombre'; // Fallback
    }
    
    // Extraer dirección
    const direccionMatch = receptorText.match(/([A-ZÁÉÍÓÚÑ\s\d,.-]+(?:CENTRO|AREA|LOCAL|PISO)[A-ZÁÉÍÓÚÑ\s\d,.-]*)/i);
    const direccion = direccionMatch ? direccionMatch[1].trim() : undefined;
    
    // Extraer código postal
    const cpMatch = text.match(/Código\s+postal\s*:\s*(\d{5})/i);
    const codigoPostal = cpMatch ? cpMatch[1] : undefined;
    
    // Extraer régimen fiscal
    const regimenMatch = text.match(/Régimen\s+Fiscal\s*:\s*(\d{3})\s*-\s*([^;\n]+)/i);
    const regimenFiscal = regimenMatch ? `${regimenMatch[1]} - ${regimenMatch[2].trim()}` : undefined;
    
    // Extraer uso del CFDI
    const usoMatch = text.match(/Uso\s+del\s+CFDI\s*:\s*([A-Z]\d{2})\s*-\s*([^;\n]+)/i);
    const usoCFDI = usoMatch ? `${usoMatch[1]} - ${usoMatch[2].trim()}` : undefined;
    
    // Extraer ciudad y estado de la dirección
    let ciudad, estado;
    const ubicacionMatch = direccion?.match(/,\s*([A-ZÁÉÍÓÚÑ\s]+),\s*([A-ZÁÉÍÓÚÑ\s]+)/i);
    if (ubicacionMatch) {
      ciudad = ubicacionMatch[1].trim();
      estado = ubicacionMatch[2].trim();
    }
    
    // Calcular confianza
    let confidence = 70; // Base
    if (rfc && this.isValidRFC(rfc)) confidence += 15;
    if (direccion) confidence += 5;
    if (codigoPostal) confidence += 5;
    if (regimenFiscal) confidence += 5;
    
    return {
      nombre: this.cleanText(nombre),
      rfc,
      direccion: direccion ? this.cleanText(direccion) : undefined,
      ciudad: ciudad ? this.cleanText(ciudad) : undefined,
      estado: estado ? this.cleanText(estado) : undefined,
      codigoPostal,
      pais: 'México',
      regimenFiscal,
      usoCFDI,
      confidence: Math.min(confidence, 100),
      source: 'text-extraction'
    };
  }

  /**
   * Valida formato de RFC mexicano
   */
  private isValidRFC(rfc: string): boolean {
    // Persona Física: 13 caracteres (AAAA######XXX)
    // Persona Moral: 12 caracteres (AAA######XXX)
    const rfcPattern = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{2,3}$/;
    return rfcPattern.test(rfc);
  }

  /**
   * Extrae el folio de la factura
   */
  private extractFolio(text: string): string | undefined {
    const folioMatch = text.match(/FOLIO\s*:\s*(\d+)/i);
    return folioMatch ? folioMatch[1] : undefined;
  }

  /**
   * Extrae el folio fiscal (UUID)
   */
  private extractFolioFiscal(text: string): string | undefined {
    const uuidPattern = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
    const match = text.match(uuidPattern);
    return match ? match[1] : undefined;
  }

  /**
   * Extrae la orden de compra (número de operación)
   */
  private extractOrdenCompra(text: string): string | undefined {
    // Buscar patrón NAVI-#######
    const ordenMatch = text.match(/(NAVI-\d{7})/i);
    return ordenMatch ? ordenMatch[1] : undefined;
  }

  /**
   * Extrae la fecha de emisión
   */
  private extractFecha(text: string): string | undefined {
    const fechaMatch = text.match(/Fecha[\/\s]*Hora\s+de\s+Emisión\s*:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    return fechaMatch ? fechaMatch[1] : undefined;
  }

  /**
   * Extrae el total de la factura
   */
  private extractTotal(text: string): string | undefined {
    const totalMatch = text.match(/Total\s*:\s*\$?\s*([\d,]+\.?\d{0,2})/i);
    return totalMatch ? totalMatch[1] : undefined;
  }

  /**
   * Extrae la moneda
   */
  private extractMoneda(text: string): string | undefined {
    const monedaMatch = text.match(/Moneda\s*:\s*([A-Z]{3})/i);
    return monedaMatch ? monedaMatch[1] : 'MXN';
  }

  /**
   * Extrae los conceptos principales
   */
  private extractConceptos(text: string): string[] {
    const conceptos: string[] = [];
    
    // Buscar líneas que parecen conceptos (después de "Concepto(s)")
    const conceptoPattern = /Concepto\(s\)([\s\S]*?)(?:Subtotal|Moneda)/i;
    const match = text.match(conceptoPattern);
    
    if (match) {
      const lines = match[1].split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        // Conceptos suelen empezar con keywords como FLETE, SERVICIO, etc.
        if (trimmed.match(/^(FLETE|SERVICIO|DELIVERY|BL|AMS|ASESOR)/i) && trimmed.length > 10) {
          conceptos.push(trimmed.slice(0, 150));
        }
      }
    }
    
    return conceptos;
  }

  /**
   * Limpia texto eliminando caracteres extraños y espacios múltiples
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .trim();
  }

  /**
   * Extrae datos del emisor (quien factura)
   */
  private extractEmisorData(text: string): { nombre: string; rfc: string; regimenFiscal?: string; lugarExpedicion?: string } | undefined {
    try {
      // Buscar sección "Emisor:"
      const emisorSection = text.match(/E\s*m\s*i\s*sor\s*:\s*([\s\S]*?)R\s*ec\s*epto\s*r\s*:/i);
      if (!emisorSection) return undefined;
      
      const emisorText = emisorSection[1];
      
      // Extraer RFC del emisor (formato: XXX######XXX o similar)
      const rfcMatch = emisorText.match(/([A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3})/);
      
      // Extraer nombre (línea antes del RFC)
      const nameMatch = emisorText.match(/([A-ZÁ-Ú\s\.&,]{10,})\s+[A-Z&Ñ]{3,4}\d{6}/);
      
      // Extraer régimen fiscal
      const regimenMatch = text.match(/R\s*égim\s*en\s+F\s*isc\s*al\s*:\s*(\d{3}\s*-[^(]+)/i);
      
      // Extraer lugar de expedición (código postal)
      const lugarMatch = text.match(/Lugar\s+de\s+Expedic\s*ió\s*n\s*:\s*(\d{5})/i);
      
      return {
        nombre: nameMatch ? nameMatch[1].trim() : 'Emisor desconocido',
        rfc: rfcMatch ? rfcMatch[1] : '',
        regimenFiscal: regimenMatch ? regimenMatch[1].trim() : undefined,
        lugarExpedicion: lugarMatch ? lugarMatch[1] : undefined
      };
    } catch (error) {
      console.error('[Facturama Extractor] Error extracting emisor:', error);
      return undefined;
    }
  }

  /**
   * Extrae subtotal, tax y total de la factura
   */
  private extractAmounts(text: string): { subtotal: number; tax: number; total: number } {
    let subtotal = 0;
    let tax = 0;
    let total = 0;
    
    try {
      // Extraer subtotal
      const subtotalMatch = text.match(/S\s*ubtotal\s*:\s*\$?\s*([\d,]+\.?\d{0,2})/i);
      if (subtotalMatch) {
        subtotal = parseFloat(subtotalMatch[1].replace(/,/g, ''));
      }
      
      // Extraer IVA/tax
      const ivaMatch = text.match(/IVA\s+\d+\s*%\s*:\s*\$?\s*([\d,]+\.?\d{0,2})/i);
      if (ivaMatch) {
        tax = parseFloat(ivaMatch[1].replace(/,/g, ''));
      }
      
      // Extraer total
      const totalMatch = text.match(/Total\s*:\s*\$?\s*([\d,]+\.?\d{0,2})/i);
      if (totalMatch) {
        total = parseFloat(totalMatch[1].replace(/,/g, ''));
      }
      
    } catch (error) {
      console.error('[Facturama Extractor] Error extracting amounts:', error);
    }
    
    return { subtotal, tax, total };
  }

  /**
   * Extrae todos los items/productos de la factura con códigos SAT
   */
  private extractInvoiceItems(text: string): FacturamaInvoiceItem[] {
    const items: FacturamaInvoiceItem[] = [];
    
    try {
      // Buscar sección de productos (desde "Producto" hasta "Subtotal")
      const productsSection = text.match(/Pr\s*oducto\s+Cantidad\s+Unidad\s+Concepto[\s\S]*?S\s*ubtotal\s*:/i);
      if (!productsSection) {
        console.log('[Facturama Extractor] ⚠️  No se encontró sección de productos');
        return [];
      }
      
      const productsText = productsSection[0];
      
      // Patrón para capturar cada item de la factura
      // Formato: Código SAT (8 dígitos) Cantidad Unidad Concepto Precio Importe
      const itemPattern = /(\d{8})\s+(\d+(?:\.\d{2})?)\s+(E\d{2}|H\d{2}|[A-Z]\d{2})\s*-?[^\$]*?\$\s*([\d,]+\.?\d{0,2})\s+\$\s*([\d,]+\.?\d{0,2})/g;
      
      let match;
      while ((match = itemPattern.exec(productsText)) !== null) {
        const satProductCode = match[1];
        const quantity = parseFloat(match[2]);
        const satUnitCode = match[3];
        const unitPrice = parseFloat(match[4].replace(/,/g, ''));
        const amount = parseFloat(match[5].replace(/,/g, ''));
        
        // Extraer descripción (texto entre unidad y precio)
        const itemTextStart = match.index + match[0].indexOf(satUnitCode) + satUnitCode.length;
        const itemTextEnd = match.index + match[0].indexOf('$');
        const fullItemText = productsText.substring(itemTextStart, itemTextEnd);
        
        // Limpiar descripción
        let description = fullItemText
          .replace(/\s*-\s*Unidad de servicio/gi, '')
          .replace(/\s*\d{2}\s*-\s*[^$\n]*/gi, '') // Remover códigos de impuesto
          .replace(/No Identificación:[^\n]*/gi, '')
          .replace(/Traslados:[^\n]*/gi, '')
          .replace(/IVA:[^\n]*/gi, '')
          .trim();
        
        if (!description) {
          description = 'Servicio';
        }
        
        // Extraer objeto de impuesto
        const taxObjectMatch = fullItemText.match(/(\d{2})\s*-\s*(Sin|Con)\s+objeto\s+de\s+impuesto/i);
        const satTaxObject = taxObjectMatch ? taxObjectMatch[1] : undefined;
        
        // Extraer identificación adicional
        const identificationMatch = fullItemText.match(/No\s+Identificación\s*:\s*([^\n]+)/i);
        const identification = identificationMatch ? identificationMatch[1].trim() : undefined;
        
        // Extraer tasa y monto de impuesto
        const taxRateMatch = fullItemText.match(/Tasa\s*:\s*(0\.\d+)/i);
        const taxAmountMatch = fullItemText.match(/Importe\s*:\s*\$?\s*([\d,]+\.?\d{0,2})/i);
        
        const taxRate = taxRateMatch ? parseFloat(taxRateMatch[1]) : undefined;
        const taxAmount = taxAmountMatch ? parseFloat(taxAmountMatch[1].replace(/,/g, '')) : undefined;
        
        items.push({
          satProductCode,
          quantity,
          satUnitCode,
          description,
          unitPrice,
          amount,
          satTaxObject,
          identification,
          taxRate,
          taxAmount
        });
      }
      
      console.log(`[Facturama Extractor] ✅ ${items.length} items extraídos`);
      
    } catch (error) {
      console.error('[Facturama Extractor] Error extracting items:', error);
    }
    
    return items;
  }

  /**
   * Extrae método de pago (PPD, PUE)
   */
  private extractMetodoPago(text: string): string | undefined {
    const metodoPagoMatch = text.match(/Méto\s*do\s+de\s+P\s*ago\s*:\s*(PPD|PUE)/i);
    return metodoPagoMatch ? metodoPagoMatch[1] : undefined;
  }

  /**
   * Extrae forma de pago (99, 03, 01, etc.)
   */
  private extractFormaPago(text: string): string | undefined {
    const formaPagoMatch = text.match(/F\s*o\s*r\s*m\s*a\s+de\s+P\s*ago\s*:\s*(\d{2})\s*-/i);
    return formaPagoMatch ? formaPagoMatch[1] : undefined;
  }

  /**
   * Extrae tipo de comprobante (I, E, T, P)
   */
  private extractTipoComprobante(text: string): string | undefined {
    const tipoMatch = text.match(/Efec\s*to\s+del\s+c\s*o\s*m\s*pr\s*o\s*bante\s*:\s*([IETP])\s*-/i);
    return tipoMatch ? tipoMatch[1] : 'I'; // Default: Ingreso
  }

  /**
   * Extrae exportación (01, 02, etc.)
   */
  private extractExportacion(text: string): string | undefined {
    const exportMatch = text.match(/Expo\s*r\s*tac\s*io\s*n\s*:\s*(\d{2})\s*-/i);
    return exportMatch ? exportMatch[1] : '01'; // Default: No aplica
  }
}

export const facturamaInvoiceExtractor = new FacturamaInvoiceExtractor();
