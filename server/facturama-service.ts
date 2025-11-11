/**
 * Facturama API Integration Service
 * 
 * Integración con la API de Facturama para timbrado de CFDI 4.0
 * Documentación: https://apisandbox.facturama.mx/Docs
 */

import type { InsertInvoice, InvoiceItem } from "@shared/schema";

interface FacturamaConfig {
  apiUser: string;
  apiPassword: string;
  baseUrl: string;
}

interface FacturamaInvoiceRequest {
  Serie?: string;
  Folio?: string;
  Currency: string;
  Date?: string;
  PaymentForm: string;
  PaymentMethod: string;
  OrderNumber?: string;
  CfdiType: string;
  ExpeditionPlace: string;
  Exportation: string;
  Receiver: {
    Rfc: string;
    Name: string;
    CfdiUse: string;
    FiscalRegime: string;
    TaxZipCode?: string;
  };
  Items: Array<{
    ProductCode: string;
    IdentificationNumber?: string;
    Description: string;
    Unit: string;
    UnitCode: string;
    UnitPrice: number;
    Quantity: number;
    Subtotal: number;
    TaxObject: string;
    Taxes?: Array<{
      Total: number;
      Name: string;
      Base: number;
      Rate: number;
      IsRetention: boolean;
    }>;
    Total: number;
  }>;
}

interface FacturamaInvoiceResponse {
  Id: string;
  Folio: string;
  Serie?: string;
  Date: string;
  CfdiType: string;
  PaymentForm: string;
  PaymentMethod: string;
  Complement: {
    TaxStamp: {
      Uuid: string;
      Date: string;
      CfdSatSeal: string;
      CfdSealNumber: string;
      SatCertNumber: string;
      SatSeal: string;
    };
  };
  Subtotal: number;
  Total: number;
  Currency: string;
  Receiver: {
    Rfc: string;
    Name: string;
    CfdiUse: string;
    FiscalRegime: string;
  };
}

/**
 * Obtiene la configuración de Facturama
 */
function getFacturamaConfig(): FacturamaConfig {
  const apiUser = process.env.FACTURAMA_API_USER;
  const apiPassword = process.env.FACTURAMA_API_PASSWORD;
  const useSandbox = process.env.FACTURAMA_USE_SANDBOX !== 'false';

  if (!apiUser || !apiPassword) {
    throw new Error('Credenciales de Facturama no configuradas. Define FACTURAMA_API_USER y FACTURAMA_API_PASSWORD');
  }

  return {
    apiUser,
    apiPassword,
    baseUrl: useSandbox 
      ? 'https://apisandbox.facturama.mx' 
      : 'https://api.facturama.mx'
  };
}

/**
 * Timbra una factura en Facturama
 */
export async function stampInvoiceInFacturama(
  invoice: InsertInvoice & { id: string },
  items: InvoiceItem[],
  receiverRFC: string,
  receiverName: string,
  receiverFiscalRegime: string = "612"
): Promise<{ folioFiscal: string; facturamId: string }> {
  const config = getFacturamaConfig();

  // Validar datos requeridos
  if (!invoice.issuerRFC || !invoice.issuerName || !invoice.lugarExpedicion) {
    throw new Error('Faltan datos fiscales del emisor: RFC, Razón Social o Lugar de Expedición');
  }

  if (!receiverRFC || !receiverName) {
    throw new Error('Faltan datos fiscales del receptor: RFC y Razón Social');
  }

  if (!items || items.length === 0) {
    throw new Error('La factura debe tener al menos un concepto/item');
  }

  // Construir la solicitud para Facturama
  const facturamaRequest: FacturamaInvoiceRequest = {
    Serie: invoice.invoiceNumber.split('-')[0] || undefined,
    Folio: invoice.invoiceNumber.split('-')[1] || invoice.invoiceNumber,
    Currency: invoice.currency,
    PaymentForm: invoice.formaPago || "99",
    PaymentMethod: invoice.metodoPago || "PPD",
    OrderNumber: invoice.ordenCompra || undefined,
    CfdiType: invoice.tipoComprobante || "I",
    ExpeditionPlace: invoice.lugarExpedicion,
    Exportation: invoice.exportacion || "01",
    Receiver: {
      Rfc: receiverRFC,
      Name: receiverName,
      CfdiUse: invoice.usoCFDI || "G03",
      FiscalRegime: receiverFiscalRegime,
    },
    Items: items.map(item => {
      const itemSubtotal = parseFloat(item.amount);
      const itemTax = item.taxAmount ? parseFloat(item.taxAmount) : 0;
      const itemTotal = itemSubtotal + itemTax;

      const facturamaItem: any = {
        ProductCode: item.satProductCode || "01010101",
        IdentificationNumber: item.identification || undefined,
        Description: item.description,
        Unit: SAT_UNIT_NAMES[item.satUnitCode || "E48"] || "Unidad de servicio",
        UnitCode: item.satUnitCode || "E48",
        UnitPrice: parseFloat(item.unitPrice),
        Quantity: parseFloat(item.quantity),
        Subtotal: itemSubtotal,
        TaxObject: item.satTaxObject || "01",
        Total: itemTotal,
      };

      // Agregar impuestos solo si aplica
      if (item.taxAmount && parseFloat(item.taxAmount) > 0) {
        facturamaItem.Taxes = [
          {
            Total: itemTax,
            Name: "IVA",
            Base: itemSubtotal,
            Rate: item.taxRate ? parseFloat(item.taxRate) : 0.16,
            IsRetention: false,
          }
        ];
      }

      return facturamaItem;
    }),
  };

  // Llamar a la API de Facturama
  const auth = Buffer.from(`${config.apiUser}:${config.apiPassword}`).toString('base64');
  
  console.log('[Facturama] Timbrando factura:', invoice.invoiceNumber);
  
  const response = await fetch(`${config.baseUrl}/api/3/cfdis`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(facturamaRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Facturama] Error al timbrar:', errorText);
    
    let errorMessage = 'Error al timbrar en Facturama';
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.Message) {
        errorMessage = errorJson.Message;
      } else if (errorJson.ModelState) {
        const errors = Object.values(errorJson.ModelState).flat();
        errorMessage = errors.join(', ');
      }
    } catch {
      errorMessage = errorText;
    }
    
    throw new Error(errorMessage);
  }

  const result: FacturamaInvoiceResponse = await response.json();
  
  console.log('[Facturama] Factura timbrada exitosamente:', result.Complement.TaxStamp.Uuid);

  return {
    folioFiscal: result.Complement.TaxStamp.Uuid,
    facturamId: result.Id,
  };
}

/**
 * Cancela una factura en Facturama
 */
export async function cancelInvoiceInFacturama(
  facturamId: string,
  motive: string = "01", // 01: Comprobante emitido con errores con relación
  substitutionUUID?: string
): Promise<void> {
  const config = getFacturamaConfig();
  const auth = Buffer.from(`${config.apiUser}:${config.apiPassword}`).toString('base64');

  const cancelRequest: any = {
    Motive: motive,
  };

  if (substitutionUUID) {
    cancelRequest.SubstitutionUUID = substitutionUUID;
  }

  const response = await fetch(`${config.baseUrl}/api/3/cfdis/${facturamId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cancelRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Facturama] Error al cancelar:', errorText);
    throw new Error('Error al cancelar factura en Facturama');
  }

  console.log('[Facturama] Factura cancelada exitosamente:', facturamId);
}

/**
 * Descarga el PDF de una factura desde Facturama
 */
export async function downloadInvoicePDF(facturamId: string): Promise<Buffer> {
  const config = getFacturamaConfig();
  const auth = Buffer.from(`${config.apiUser}:${config.apiPassword}`).toString('base64');

  const response = await fetch(`${config.baseUrl}/api/3/cfdis/${facturamId}/pdf`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    throw new Error('Error al descargar PDF de Facturama');
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Descarga el XML de una factura desde Facturama
 */
export async function downloadInvoiceXML(facturamId: string): Promise<string> {
  const config = getFacturamaConfig();
  const auth = Buffer.from(`${config.apiUser}:${config.apiPassword}`).toString('base64');

  const response = await fetch(`${config.baseUrl}/api/3/cfdis/${facturamId}/xml`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
    },
  });

  if (!response.ok) {
    throw new Error('Error al descargar XML de Facturama');
  }

  return await response.text();
}

// Mapeo de códigos SAT de unidad a nombres completos
const SAT_UNIT_NAMES: Record<string, string> = {
  "E48": "Unidad de servicio",
  "H87": "Pieza",
  "KGM": "Kilogramo",
  "MTR": "Metro",
  "XBX": "Caja",
  "ACT": "Actividad",
  "E51": "Metro cuadrado",
  "LTR": "Litro",
  "HUR": "Hora",
  "DAY": "Día",
  "MON": "Mes",
  "ANN": "Año",
};
