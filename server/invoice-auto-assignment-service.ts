/**
 * Invoice Auto-Assignment Service
 * 
 * Servicio que detecta facturas Facturama en attachments y:
 * 1. Extrae datos completos de la factura (emisor, receptor, items, montos, etc.)
 * 2. Verifica si la factura ya existe (por folioFiscal - UUID)
 * 3. Crea la factura completa con todos los items y códigos SAT
 * 4. Asigna automáticamente la factura a la operación
 * 
 * Integrado con el sistema de automatización para procesamiento continuo
 */

import { facturamaInvoiceExtractor, type FacturamaInvoiceData } from './facturama-invoice-extractor';
import { backblazeStorage } from './backblazeStorage';
import { storage } from './storage';
import { db } from './db';
import { invoices, invoiceItems, operations, clients, operationFiles } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface InvoiceMatchResult {
  matched: boolean;
  invoice?: any;
  matchType?: 'folio-fiscal' | 'folio' | 'none';
  confidence: number;
}

export interface InvoiceAutoAssignmentResult {
  success: boolean;
  action: 'assigned-existing' | 'created-and-assigned' | 'skipped' | 'error';
  invoiceId?: string;
  invoiceNumber?: string;
  invoiceData?: FacturamaInvoiceData;
  error?: string;
  reasoning?: string;
}

export class InvoiceAutoAssignmentService {
  
  /**
   * Procesa un attachment de operación para detectar si es factura y crear/asignar factura
   */
  async processAttachmentForInvoiceCreation(
    operationId: string,
    attachmentId: string,
    filename: string,
    b2Key: string
  ): Promise<InvoiceAutoAssignmentResult> {
    
    console.log(`[Invoice Auto-Assignment] 📄 Procesando attachment: ${filename} para operación: ${operationId.substring(0, 10)}...`);
    
    try {
      // 1. Verificar si la operación existe
      const operation = await storage.getOperation(operationId);
      
      if (!operation) {
        return {
          success: false,
          action: 'error',
          error: 'Operación no encontrada'
        };
      }
      
      // 2. Descargar el attachment desde B2
      let fileBuffer: Buffer;
      try {
        fileBuffer = await backblazeStorage.downloadFile(b2Key);
      } catch (error) {
        console.log(`[Invoice Auto-Assignment] ⚠️  No se pudo descargar archivo desde B2 (posible límite diario): ${error}`);
        return {
          success: false,
          action: 'error',
          error: 'No se pudo descargar archivo desde B2'
        };
      }
      
      // 3. Intentar extraer datos completos de la factura (el extractor detecta automáticamente XML vs PDF)
      const invoiceData = await facturamaInvoiceExtractor.extractInvoiceData(fileBuffer, filename, undefined);
      
      if (!invoiceData) {
        console.log('[Invoice Auto-Assignment] ⏭️  No es una factura válida de Facturama');
        return {
          success: false,
          action: 'skipped',
          reasoning: 'No es una factura de Facturama'
        };
      }
      
      if (!invoiceData.folioFiscal) {
        console.log('[Invoice Auto-Assignment] ⚠️  Factura sin folio fiscal (UUID) - No se puede validar unicidad');
        return {
          success: false,
          action: 'error',
          error: 'Factura sin folio fiscal'
        };
      }
      
      console.log(`[Invoice Auto-Assignment] ✅ Factura detectada - Folio Fiscal: ${invoiceData.folioFiscal}, Cliente: ${invoiceData.receptor.nombre}`);
      
      // 4. Crear o actualizar factura
      // La función createInvoiceFromFacturama ahora maneja:
      // - Creación de nuevas facturas
      // - Actualización de facturas existentes creadas manualmente
      // - Detección de facturas auto-creadas existentes
      const newInvoiceId = await this.createInvoiceFromFacturama(invoiceData, operationId);
      
      if (!newInvoiceId) {
        // null = factura auto-creada ya existe, no hacer nada
        return {
          success: true,
          action: 'assigned-existing',
          invoiceNumber: invoiceData.folio || invoiceData.folioFiscal?.substring(0, 8)
        };
      }
      
      const invoiceId = newInvoiceId;
      const action = 'created-and-assigned'; // Puede ser creación o actualización
      
      console.log(`[Invoice Auto-Assignment] ✅ Factura procesada - ID: ${invoiceId}, Items: ${invoiceData.items?.length || 0}`);
      
      // 5. Asignar la factura a la operación (si no está ya asignada)
      // Nota: Las facturas se vinculan a operaciones a través del campo operationId
      // Si la factura fue creada con operationId, ya está vinculada
      
      return {
        success: true,
        action,
        invoiceId,
        invoiceNumber: invoiceData.folio || invoiceData.folioFiscal?.substring(0, 8),
        invoiceData
      };
      
    } catch (error) {
      console.error('[Invoice Auto-Assignment] Error procesando attachment:', error);
      return {
        success: false,
        action: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }
  
  /**
   * Busca si una factura con el mismo folio fiscal ya existe
   */
  private async findMatchingInvoice(invoiceData: FacturamaInvoiceData): Promise<InvoiceMatchResult> {
    try {
      // Buscar por folio fiscal (UUID) - más confiable
      if (invoiceData.folioFiscal) {
        const existingInvoice = await db.query.invoices.findFirst({
          where: eq(invoices.folioFiscal, invoiceData.folioFiscal)
        });
        
        if (existingInvoice) {
          return {
            matched: true,
            invoice: existingInvoice,
            matchType: 'folio-fiscal',
            confidence: 100
          };
        }
      }
      
      // Si no hay match por UUID, buscar por folio + cliente (menos confiable)
      if (invoiceData.folio && invoiceData.receptor.rfc) {
        // Buscar cliente por RFC
        const client = await db.query.clients.findFirst({
          where: eq(clients.rfc, invoiceData.receptor.rfc)
        });
        
        if (client) {
          const existingInvoice = await db.query.invoices.findFirst({
            where: and(
              eq(invoices.invoiceNumber, invoiceData.folio),
              eq(invoices.clientId, client.id)
            )
          });
          
          if (existingInvoice) {
            return {
              matched: true,
              invoice: existingInvoice,
              matchType: 'folio',
              confidence: 80
            };
          }
        }
      }
      
      // No match
      return {
        matched: false,
        matchType: 'none',
        confidence: 0
      };
      
    } catch (error) {
      console.error('[Invoice Auto-Assignment] Error buscando factura:', error);
      return {
        matched: false,
        matchType: 'none',
        confidence: 0
      };
    }
  }
  
  /**
   * Crea una nueva factura desde datos extraídos de Facturama
   * O actualiza una existente si fue creada manualmente con datos incorrectos
   */
  private async createInvoiceFromFacturama(
    invoiceData: FacturamaInvoiceData,
    operationId: string
  ): Promise<string | null> {
    
    try {
      // 0. VALIDAR SI YA EXISTE UNA FACTURA CON ESTE UUID
      if (invoiceData.folioFiscal) {
        const { invoices: invoicesTable } = await import('@shared/schema');
        const existingInvoice = await db.query.invoices.findFirst({
          where: eq(invoicesTable.folioFiscal, invoiceData.folioFiscal)
        });
        
        if (existingInvoice) {
          // Si la factura NO fue auto-creada, actualizarla con datos correctos del XML
          if (!existingInvoice.createdAutomatically) {
            console.log(`[Invoice Auto-Assignment] 🔄 Factura existente creada manualmente - actualizando con datos del XML`);
            return await this.updateInvoiceWithXmlData(existingInvoice.id, invoiceData, operationId);
          }
          
          console.log(`[Invoice Auto-Assignment] ⏭️  Factura auto-creada ya existe con UUID ${invoiceData.folioFiscal} - omitiendo`);
          return null; // No actualizar facturas ya auto-creadas
        }
      }
      
      // 1. Obtener el primer empleado disponible para asignar a facturas automáticas
      const firstEmployee = await db.query.employees.findFirst();
      
      if (!firstEmployee) {
        console.error('[Invoice Auto-Assignment] ❌ No se encontró ningún empleado para asignar factura');
        return null;
      }
      
      // 2. Buscar o crear cliente
      let clientId: string | undefined;
      
      if (invoiceData.receptor.rfc) {
        // Buscar cliente por RFC
        const existingClient = await db.query.clients.findFirst({
          where: eq(clients.rfc, invoiceData.receptor.rfc)
        });
        
        if (existingClient) {
          clientId = existingClient.id;
          
          // 🔑 ACTUALIZAR DIVISA SI LA FACTURA TIENE UNA DIVISA DIFERENTE
          if (invoiceData.moneda) {
            const invoiceCurrency = invoiceData.moneda.toUpperCase();
            const currentCurrency = existingClient.currency?.toUpperCase() || 'MXN';
            
            if (invoiceCurrency !== currentCurrency) {
              await storage.updateClient(existingClient.id, {
                currency: invoiceCurrency
              });
              
              console.log(`[Invoice Auto-Assignment] 💱 Divisa del cliente actualizada de ${currentCurrency} a ${invoiceCurrency} (basado en factura)`);
            }
          }
          
        } else {
          // Crear nuevo cliente con la divisa correcta desde la factura
          // Usar RFC como email temporal si no hay email disponible
          const newClient = await storage.createClient({
            name: invoiceData.receptor.nombre,
            email: `${invoiceData.receptor.rfc}@temp.factura.mx`, // Email temporal basado en RFC
            rfc: invoiceData.receptor.rfc,
            address: invoiceData.receptor.direccion,
            city: invoiceData.receptor.ciudad,
            state: invoiceData.receptor.estado,
            postalCode: invoiceData.receptor.codigoPostal,
            country: invoiceData.receptor.pais || 'México',
            regimenFiscal: invoiceData.receptor.regimenFiscal,
            usoCFDI: invoiceData.receptor.usoCFDI,
            currency: invoiceData.moneda?.toUpperCase() || 'MXN'
          });
          
          clientId = newClient.id;
          console.log(`[Invoice Auto-Assignment] ✅ Cliente creado: ${newClient.name} (${newClient.rfc}) con divisa ${newClient.currency}`);
        }
      }
      
      // 3. Crear la factura principal
      const newInvoice = await storage.createInvoice({
        operationId,
        employeeId: firstEmployee.id, // Asignar al primer empleado disponible
        clientId,
        invoiceNumber: invoiceData.folio || invoiceData.folioFiscal?.substring(0, 15) || 'Sin Folio',
        date: invoiceData.fecha ? new Date(invoiceData.fecha.split('/').reverse().join('-')) : new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 días
        subtotal: invoiceData.subtotal || 0,
        tax: invoiceData.tax || 0,
        total: invoiceData.total || 0,
        status: 'pending',
        currency: invoiceData.moneda || 'MXN',
        
        // Campos CFDI 4.0
        folioFiscal: invoiceData.folioFiscal,
        issuerRFC: invoiceData.emisor?.rfc,
        issuerName: invoiceData.emisor?.nombre,
        emisorRegimenFiscal: invoiceData.emisor?.regimenFiscal,
        metodoPago: invoiceData.metodoPago,
        formaPago: invoiceData.formaPago,
        
        // Marcar como creada automáticamente
        createdAutomatically: true
      });
      
      console.log(`[Invoice Auto-Assignment] ✅ Factura creada: ${newInvoice.invoiceNumber}`);
      
      // 4. Crear items de la factura
      if (invoiceData.items && invoiceData.items.length > 0) {
        for (const item of invoiceData.items) {
          // Calcular amount si no está disponible
          const amount = item.amount || (item.quantity * item.unitPrice);
          
          await storage.createInvoiceItem({
            invoiceId: newInvoice.id,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            tax: item.taxAmount || 0,
            total: amount,
            
            // Campos SAT
            satProductCode: item.satProductCode,
            satUnitCode: item.satUnitCode,
            satTaxObject: item.satTaxObject,
            identification: item.identification
          });
        }
        
        console.log(`[Invoice Auto-Assignment] ✅ ${invoiceData.items.length} items creados`);
      }
      
      return newInvoice.id;
      
    } catch (error) {
      console.error('[Invoice Auto-Assignment] Error creando factura:', error);
      return null;
    }
  }
  
  /**
   * Actualiza una factura existente con datos correctos del XML
   */
  private async updateInvoiceWithXmlData(
    invoiceId: string,
    invoiceData: FacturamaInvoiceData,
    operationId: string
  ): Promise<string | null> {
    
    try {
      // 1. Buscar o actualizar cliente
      let clientId: string | undefined;
      
      if (invoiceData.receptor.rfc) {
        const existingClient = await db.query.clients.findFirst({
          where: eq(clients.rfc, invoiceData.receptor.rfc)
        });
        
        if (existingClient) {
          clientId = existingClient.id;
          
          // Actualizar divisa si es incorrecta
          const invoiceCurrency = invoiceData.moneda?.toUpperCase() || 'MXN';
          const currentCurrency = existingClient.currency?.toUpperCase() || 'XXX';
          
          if (currentCurrency === 'XXX' || invoiceCurrency !== currentCurrency) {
            await storage.updateClient(existingClient.id, {
              currency: invoiceCurrency
            });
            
            console.log(`[Invoice Auto-Assignment] 💱 Divisa del cliente corregida de ${currentCurrency} a ${invoiceCurrency}`);
          }
        }
      }
      
      // 2. Actualizar factura con datos correctos del XML
      await storage.updateInvoice(invoiceId, {
        operationId, // Asegurar que está vinculada a la operación correcta
        clientId,
        invoiceNumber: invoiceData.folio || invoiceData.folioFiscal?.substring(0, 15) || 'Sin Folio',
        date: invoiceData.fecha ? new Date(invoiceData.fecha.split('/').reverse().join('-')) : new Date(),
        subtotal: invoiceData.subtotal || 0,
        tax: invoiceData.tax || 0,
        total: invoiceData.total || 0,
        currency: invoiceData.moneda?.toUpperCase() || 'MXN',
        
        // Campos CFDI 4.0
        folioFiscal: invoiceData.folioFiscal,
        issuerRFC: invoiceData.emisor?.rfc,
        issuerName: invoiceData.emisor?.nombre,
        emisorRegimenFiscal: invoiceData.emisor?.regimenFiscal,
        metodoPago: invoiceData.metodoPago,
        formaPago: invoiceData.formaPago,
        
        // Marcar como auto-actualizada
        createdAutomatically: true
      });
      
      console.log(`[Invoice Auto-Assignment] ✅ Factura actualizada: ${invoiceData.folio} (${invoiceData.moneda} ${invoiceData.total})`);
      
      // 3. Verificar y crear items si no existen
      const existingItems = await db.query.invoiceItems.findMany({
        where: eq(invoiceItems.invoiceId, invoiceId)
      });
      
      if (existingItems.length === 0 && invoiceData.items && invoiceData.items.length > 0) {
        for (const item of invoiceData.items) {
          // Calcular amount si no está disponible
          const amount = item.amount || (item.quantity * item.unitPrice);
          
          await storage.createInvoiceItem({
            invoiceId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            tax: item.taxAmount || 0,
            total: amount,
            
            // Campos SAT
            satProductCode: item.satProductCode,
            satUnitCode: item.satUnitCode,
            satTaxObject: item.satTaxObject,
            identification: item.identification
          });
        }
        
        console.log(`[Invoice Auto-Assignment] ✅ ${invoiceData.items.length} items creados para factura actualizada`);
      }
      
      return invoiceId;
      
    } catch (error) {
      console.error('[Invoice Auto-Assignment] Error actualizando factura:', error);
      return null;
    }
  }
  
  /**
   * Procesa todas las operaciones que tienen attachments sin factura asignada
   */
  async processOperationsForInvoiceDetection(operationIds?: string[]): Promise<{
    processed: number;
    invoicesCreated: number;
    invoicesAssigned: number;
    errors: number;
  }> {
    
    console.log('[Invoice Auto-Assignment] 🔄 Iniciando procesamiento de facturas...');
    
    let processed = 0;
    let invoicesCreated = 0;
    let invoicesAssigned = 0;
    let errors = 0;
    
    try {
      // Obtener operaciones a procesar
      let operations;
      
      if (operationIds && operationIds.length > 0) {
        // Procesar solo operaciones específicas
        operations = await Promise.all(
          operationIds.map(id => storage.getOperation(id))
        );
        operations = operations.filter(op => op !== null);
      } else {
        // Procesar todas las operaciones
        operations = await storage.getAllOperations();
      }
      
      console.log(`[Invoice Auto-Assignment] 📋 Procesando ${operations.length} operaciones...`);
      
      // Procesar cada operación
      for (const operation of operations) {
        try {
          // Obtener attachments de la operación
          const files = await db.query.operationFiles.findMany({
            where: eq(operationFiles.operationId, operation.id)
          });
          
          if (!files || files.length === 0) {
            continue;
          }
          
          // Procesar cada archivo
          for (const file of files) {
            if (!file.b2Key || !file.filename) {
              continue;
            }
            
            const result = await this.processAttachmentForInvoiceCreation(
              operation.id,
              file.id,
              file.filename,
              file.b2Key
            );
            
            processed++;
            
            if (result.success) {
              if (result.action === 'created-and-assigned') {
                invoicesCreated++;
              } else if (result.action === 'assigned-existing') {
                invoicesAssigned++;
              }
            } else if (result.action === 'error') {
              errors++;
            }
          }
          
        } catch (error) {
          console.error(`[Invoice Auto-Assignment] Error procesando operación ${operation.id}:`, error);
          errors++;
        }
      }
      
    } catch (error) {
      console.error('[Invoice Auto-Assignment] Error en procesamiento batch:', error);
    }
    
    console.log(`[Invoice Auto-Assignment] ✅ Procesamiento completo - Procesados: ${processed}, Creadas: ${invoicesCreated}, Asignadas: ${invoicesAssigned}, Errores: ${errors}`);
    
    return {
      processed,
      invoicesCreated,
      invoicesAssigned,
      errors
    };
  }
}

export const invoiceAutoAssignmentService = new InvoiceAutoAssignmentService();
