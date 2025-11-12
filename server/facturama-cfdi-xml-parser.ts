/**
 * Facturama CFDI XML Parser
 * 
 * Parser especializado para extraer datos de facturas CFDI 4.0 en formato XML
 * Proporciona extracción estructurada y confiable de datos fiscales mexicanos
 * 
 * Funcionalidades:
 * 1. Parseo de archivos XML CFDI 4.0 con soporte para namespaces
 * 2. Extracción de datos del receptor (cliente): RFC, nombre, régimen fiscal, uso CFDI
 * 3. Extracción de datos del emisor (proveedor): RFC, nombre, régimen fiscal
 * 4. Extracción de totales: subtotal, impuestos, total
 * 5. Extracción de UUID (Folio Fiscal) del timbre fiscal digital
 * 6. Extracción de conceptos/items de la factura
 * 7. Detección de número de operación en "Orden de Compra"
 */

import { XMLParser } from 'fast-xml-parser';
import type { FacturamaInvoiceData, FacturamaReceptorData, FacturamaInvoiceItem } from './facturama-invoice-extractor';

interface CfdiComprobante {
  '@_Version'?: string;
  '@_Folio'?: string;
  '@_Fecha'?: string;
  '@_SubTotal'?: string;
  '@_Total'?: string;
  '@_Moneda'?: string;
  '@_TipoDeComprobante'?: string;
  '@_MetodoPago'?: string;
  '@_FormaPago'?: string;
  '@_LugarExpedicion'?: string;
  '@_Exportacion'?: string;
  
  'cfdi:Emisor'?: {
    '@_Rfc'?: string;
    '@_Nombre'?: string;
    '@_RegimenFiscal'?: string;
  };
  
  'cfdi:Receptor'?: {
    '@_Rfc'?: string;
    '@_Nombre'?: string;
    '@_DomicilioFiscalReceptor'?: string;
    '@_RegimenFiscalReceptor'?: string;
    '@_UsoCFDI'?: string;
  };
  
  'cfdi:Conceptos'?: {
    'cfdi:Concepto'?: CfdiConcepto | CfdiConcepto[];
  };
  
  'cfdi:Impuestos'?: {
    '@_TotalImpuestosTrasladados'?: string;
    'cfdi:Traslados'?: {
      'cfdi:Traslado'?: {
        '@_Base'?: string;
        '@_Impuesto'?: string;
        '@_TipoFactor'?: string;
        '@_TasaOCuota'?: string;
        '@_Importe'?: string;
      } | Array<{
        '@_Base'?: string;
        '@_Impuesto'?: string;
        '@_TipoFactor'?: string;
        '@_TasaOCuota'?: string;
        '@_Importe'?: string;
      }>;
    };
  };
  
  'cfdi:Complemento'?: {
    'tfd:TimbreFiscalDigital'?: {
      '@_UUID'?: string;
      '@_FechaTimbrado'?: string;
    };
  };
}

interface CfdiConcepto {
  '@_ClaveProdServ'?: string;
  '@_Cantidad'?: string;
  '@_ClaveUnidad'?: string;
  '@_Descripcion'?: string;
  '@_ValorUnitario'?: string;
  '@_Importe'?: string;
  '@_ObjetoImp'?: string;
  '@_NoIdentificacion'?: string;
  'cfdi:Impuestos'?: {
    'cfdi:Traslados'?: {
      'cfdi:Traslado'?: {
        '@_Base'?: string;
        '@_Impuesto'?: string;
        '@_TipoFactor'?: string;
        '@_TasaOCuota'?: string;
        '@_Importe'?: string;
      };
    };
  };
}

export class FacturamaCfdXmlParser {
  
  private xmlParser: XMLParser;
  
  constructor() {
    // Configurar parser XML con soporte para namespaces y atributos
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: false, // Mantener strings para control manual
      removeNSPrefix: false, // Mantener prefijos de namespace (cfdi:, tfd:)
      allowBooleanAttributes: true,
    });
  }
  
  /**
   * Extrae datos de una factura CFDI desde un buffer XML
   */
  async parseXml(xmlBuffer: Buffer, filename: string): Promise<FacturamaInvoiceData | null> {
    
    console.log(`[CFDI XML Parser] 📄 Parseando XML: ${filename}`);
    
    try {
      // 1. Convertir buffer a string
      const xmlContent = xmlBuffer.toString('utf-8');
      
      // 2. Parsear XML
      const parsed = this.xmlParser.parse(xmlContent);
      
      // 3. Navegar hasta el elemento Comprobante
      const comprobante = this.findComprobante(parsed);
      
      if (!comprobante) {
        console.log('[CFDI XML Parser] ⚠️  No se encontró elemento cfdi:Comprobante');
        return null;
      }
      
      // 4. Validar que es un CFDI válido
      if (!this.isValidCfdi(comprobante)) {
        console.log('[CFDI XML Parser] ⚠️  XML no es un CFDI válido');
        return null;
      }
      
      console.log('[CFDI XML Parser] ✅ CFDI válido detectado - Extrayendo datos...');
      
      // 5. Extraer datos del receptor (cliente)
      const receptor = this.extractReceptor(comprobante);
      
      if (!receptor) {
        console.log('[CFDI XML Parser] ⚠️  No se pudo extraer datos del receptor');
        return null;
      }
      
      // 6. Extraer datos del emisor
      const emisor = this.extractEmisor(comprobante);
      
      // 7. Extraer UUID del timbre fiscal
      const folioFiscal = this.extractUUID(comprobante);
      
      // 8. Extraer totales
      const subtotal = this.parseNumber(comprobante['@_SubTotal']);
      const total = this.parseNumber(comprobante['@_Total']);
      const tax = total && subtotal ? total - subtotal : this.extractTotalTax(comprobante);
      
      // 9. Extraer conceptos/items
      const items = this.extractItems(comprobante);
      
      // 10. Extraer orden de compra (buscar en descripción o campos adicionales)
      const ordenCompra = this.extractOrdenCompra(comprobante, filename);
      
      // 11. Construir objeto de factura
      const invoiceData: FacturamaInvoiceData = {
        receptor,
        
        folio: comprobante['@_Folio'],
        folioFiscal,
        ordenCompra,
        fecha: comprobante['@_Fecha'],
        subtotal,
        tax,
        total,
        moneda: comprobante['@_Moneda'] || 'MXN',
        
        emisor,
        
        // CFDI metadata
        metodoPago: comprobante['@_MetodoPago'],
        formaPago: comprobante['@_FormaPago'],
        tipoComprobante: comprobante['@_TipoDeComprobante'],
        usoCFDI: receptor.usoCFDI,
        exportacion: comprobante['@_Exportacion'],
        
        // Items
        items,
        
        // Legacy
        conceptos: items.map(item => item.description),
        
        isFacturamaInvoice: true,
        confidence: 1.0, // XML parsing tiene 100% de confianza
      };
      
      console.log(`[CFDI XML Parser] ✅ Datos extraídos exitosamente`);
      console.log(`  - Receptor: ${receptor.nombre} (${receptor.rfc})`);
      console.log(`  - Emisor: ${emisor?.nombre} (${emisor?.rfc})`);
      console.log(`  - Total: ${total} ${invoiceData.moneda}`);
      console.log(`  - UUID: ${folioFiscal}`);
      if (ordenCompra) {
        console.log(`  - Orden de Compra: ${ordenCompra}`);
      }
      
      return invoiceData;
      
    } catch (error) {
      console.error('[CFDI XML Parser] Error parseando XML:', error);
      return null;
    }
  }
  
  /**
   * Busca el elemento cfdi:Comprobante en el árbol XML
   */
  private findComprobante(parsed: any): CfdiComprobante | null {
    // El elemento raíz puede ser directamente cfdi:Comprobante
    if (parsed['cfdi:Comprobante']) {
      return parsed['cfdi:Comprobante'];
    }
    
    // O puede estar anidado bajo otro elemento
    if (parsed.Comprobante) {
      return parsed.Comprobante;
    }
    
    return null;
  }
  
  /**
   * Valida que el XML es un CFDI válido
   */
  private isValidCfdi(comprobante: CfdiComprobante): boolean {
    // Debe tener versión (4.0 generalmente)
    if (!comprobante['@_Version']) {
      return false;
    }
    
    // Debe tener emisor y receptor
    if (!comprobante['cfdi:Emisor'] || !comprobante['cfdi:Receptor']) {
      return false;
    }
    
    // Debe tener totales
    if (!comprobante['@_Total']) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Extrae datos del receptor (cliente)
   */
  private extractReceptor(comprobante: CfdiComprobante): FacturamaReceptorData | null {
    const receptorNode = comprobante['cfdi:Receptor'];
    
    if (!receptorNode) {
      return null;
    }
    
    const rfc = receptorNode['@_Rfc'];
    const nombre = receptorNode['@_Nombre'];
    
    if (!rfc || !nombre) {
      return null;
    }
    
    return {
      rfc,
      nombre,
      codigoPostal: receptorNode['@_DomicilioFiscalReceptor'],
      regimenFiscal: receptorNode['@_RegimenFiscalReceptor'],
      usoCFDI: receptorNode['@_UsoCFDI'],
      confidence: 1.0, // XML tiene 100% de confianza
      source: 'text-extraction',
    };
  }
  
  /**
   * Extrae datos del emisor (proveedor)
   */
  private extractEmisor(comprobante: CfdiComprobante): { nombre: string; rfc: string; regimenFiscal?: string; lugarExpedicion?: string } | undefined {
    const emisorNode = comprobante['cfdi:Emisor'];
    
    if (!emisorNode || !emisorNode['@_Rfc'] || !emisorNode['@_Nombre']) {
      return undefined;
    }
    
    return {
      rfc: emisorNode['@_Rfc'],
      nombre: emisorNode['@_Nombre'],
      regimenFiscal: emisorNode['@_RegimenFiscal'],
      lugarExpedicion: comprobante['@_LugarExpedicion'],
    };
  }
  
  /**
   * Extrae UUID del timbre fiscal digital
   */
  private extractUUID(comprobante: CfdiComprobante): string | undefined {
    const complemento = comprobante['cfdi:Complemento'];
    
    if (!complemento) {
      return undefined;
    }
    
    const timbre = complemento['tfd:TimbreFiscalDigital'];
    
    if (!timbre) {
      return undefined;
    }
    
    return timbre['@_UUID'];
  }
  
  /**
   * Extrae el total de impuestos
   */
  private extractTotalTax(comprobante: CfdiComprobante): number | undefined {
    const impuestos = comprobante['cfdi:Impuestos'];
    
    if (!impuestos) {
      return undefined;
    }
    
    return this.parseNumber(impuestos['@_TotalImpuestosTrasladados']);
  }
  
  /**
   * Extrae los conceptos/items de la factura
   */
  private extractItems(comprobante: CfdiComprobante): FacturamaInvoiceItem[] {
    const items: FacturamaInvoiceItem[] = [];
    
    const conceptosNode = comprobante['cfdi:Conceptos'];
    
    if (!conceptosNode || !conceptosNode['cfdi:Concepto']) {
      return items;
    }
    
    // Puede ser un solo concepto o un array
    const conceptos = Array.isArray(conceptosNode['cfdi:Concepto']) 
      ? conceptosNode['cfdi:Concepto']
      : [conceptosNode['cfdi:Concepto']];
    
    for (const concepto of conceptos) {
      const item: FacturamaInvoiceItem = {
        satProductCode: concepto['@_ClaveProdServ'] || '',
        quantity: this.parseNumber(concepto['@_Cantidad']) || 0,
        satUnitCode: concepto['@_ClaveUnidad'] || '',
        description: concepto['@_Descripcion'] || '',
        unitPrice: this.parseNumber(concepto['@_ValorUnitario']) || 0,
        amount: this.parseNumber(concepto['@_Importe']) || 0,
        satTaxObject: concepto['@_ObjetoImp'],
        identification: concepto['@_NoIdentificacion'],
      };
      
      // Extraer impuestos del concepto si existen
      const impuestos = concepto['cfdi:Impuestos'];
      if (impuestos && impuestos['cfdi:Traslados'] && impuestos['cfdi:Traslados']['cfdi:Traslado']) {
        const traslado = impuestos['cfdi:Traslados']['cfdi:Traslado'];
        item.taxRate = this.parseNumber(traslado['@_TasaOCuota']);
        item.taxAmount = this.parseNumber(traslado['@_Importe']);
      }
      
      items.push(item);
    }
    
    return items;
  }
  
  /**
   * Intenta extraer número de operación (NAVI-XXXXXX) del XML o filename
   */
  private extractOrdenCompra(comprobante: CfdiComprobante, filename: string): string | undefined {
    // 1. Buscar en el filename
    const filenameMatch = filename.match(/NAVI-\d{7}/i);
    if (filenameMatch) {
      return filenameMatch[0];
    }
    
    // 2. Buscar en conceptos/descripciones
    const conceptosNode = comprobante['cfdi:Conceptos'];
    if (conceptosNode && conceptosNode['cfdi:Concepto']) {
      const conceptos = Array.isArray(conceptosNode['cfdi:Concepto']) 
        ? conceptosNode['cfdi:Concepto']
        : [conceptosNode['cfdi:Concepto']];
      
      for (const concepto of conceptos) {
        const descripcion = concepto['@_Descripcion'] || '';
        const match = descripcion.match(/NAVI-\d{7}/i);
        if (match) {
          return match[0];
        }
      }
    }
    
    return undefined;
  }
  
  /**
   * Helper para parsear números de forma segura
   */
  private parseNumber(value: string | undefined): number | undefined {
    if (!value) {
      return undefined;
    }
    
    const num = Number(value);
    
    return isNaN(num) ? undefined : num;
  }
}

// Export singleton instance
export const facturamaCfdXmlParser = new FacturamaCfdXmlParser();
