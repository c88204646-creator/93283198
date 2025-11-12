/**
 * Client Auto-Assignment Service
 * 
 * Servicio que detecta facturas en attachments de operaciones y:
 * 1. Extrae datos del cliente desde facturas Facturama
 * 2. Busca si el cliente ya existe (por RFC o nombre)
 * 3. Crea nuevo cliente si no existe
 * 4. Asigna automáticamente el cliente a la operación
 * 
 * Integrado con el sistema de automatización para procesamiento continuo
 */

import { facturamaInvoiceExtractor, type FacturamaInvoiceData } from './facturama-invoice-extractor';
import { backblazeStorage } from './backblazeStorage';
import { storage } from './storage';
import { db } from './db';
import { clients, operations } from '@shared/schema';
import { eq, or, and, ilike, sql } from 'drizzle-orm';

export interface ClientMatchResult {
  matched: boolean;
  client?: any;
  matchType?: 'rfc' | 'name' | 'email' | 'none';
  confidence: number;
}

export interface AutoAssignmentResult {
  success: boolean;
  action: 'assigned-existing' | 'created-and-assigned' | 'skipped' | 'error';
  clientId?: string;
  clientName?: string;
  invoiceData?: FacturamaInvoiceData;
  error?: string;
  reasoning?: string;
}

export class ClientAutoAssignmentService {
  
  /**
   * Procesa un attachment de operación para detectar si es factura y asignar cliente
   */
  async processAttachmentForClientAssignment(
    operationId: string,
    attachmentId: string,
    filename: string,
    b2Key: string
  ): Promise<AutoAssignmentResult> {
    
    console.log(`[Client Auto-Assignment] 📎 Procesando attachment: ${filename} para operación: ${operationId.substring(0, 10)}...`);
    
    try {
      // 1. Verificar si la operación ya tiene cliente asignado
      const operation = await storage.getOperation(operationId);
      
      if (!operation) {
        return {
          success: false,
          action: 'error',
          error: 'Operación no encontrada'
        };
      }
      
      if (operation.clientId) {
        console.log(`[Client Auto-Assignment] ⏭️  Operación ya tiene cliente asignado: ${operation.clientId}`);
        return {
          success: false,
          action: 'skipped',
          reasoning: 'Operación ya tiene cliente asignado'
        };
      }
      
      // 2. Descargar el attachment desde B2
      let fileBuffer: Buffer;
      try {
        fileBuffer = await backblazeStorage.downloadFile(b2Key);
      } catch (error) {
        console.log(`[Client Auto-Assignment] ⚠️  No se pudo descargar archivo desde B2: ${error}`);
        return {
          success: false,
          action: 'error',
          error: 'No se pudo descargar archivo desde B2'
        };
      }
      
      // 3. Intentar extraer datos de factura
      const invoiceData = await facturamaInvoiceExtractor.extractInvoiceData(fileBuffer, filename);
      
      if (!invoiceData) {
        console.log('[Client Auto-Assignment] ⏭️  No es una factura válida de Facturama');
        return {
          success: false,
          action: 'skipped',
          reasoning: 'No es una factura de Facturama'
        };
      }
      
      console.log(`[Client Auto-Assignment] ✅ Factura detectada - Cliente: ${invoiceData.receptor.nombre} (RFC: ${invoiceData.receptor.rfc})`);
      
      // 4. Buscar si el cliente ya existe
      const matchResult = await this.findMatchingClient(invoiceData.receptor);
      
      let clientId: string;
      let clientName: string;
      let action: 'assigned-existing' | 'created-and-assigned';
      
      if (matchResult.matched && matchResult.client) {
        // Cliente existente - solo asignar
        clientId = matchResult.client.id;
        clientName = matchResult.client.name;
        action = 'assigned-existing';
        
        console.log(`[Client Auto-Assignment] 🔗 Cliente existente encontrado: ${clientName} (match type: ${matchResult.matchType})`);
        
        // Actualizar datos del cliente si son más completos (incluye divisa)
        await this.updateClientIfNeeded(matchResult.client, invoiceData.receptor, attachmentId, invoiceData.moneda);
        
      } else {
        // Cliente nuevo - crear con la divisa correcta desde la factura
        const newClient = await this.createClientFromInvoice(invoiceData.receptor, attachmentId, invoiceData.moneda);
        
        clientId = newClient.id;
        clientName = newClient.name;
        action = 'created-and-assigned';
        
        console.log(`[Client Auto-Assignment] ✨ Nuevo cliente creado: ${clientName} (RFC: ${invoiceData.receptor.rfc})`);
      }
      
      // 5. Asignar cliente a la operación
      await storage.updateOperation(operationId, { clientId });
      
      console.log(`[Client Auto-Assignment] ✅ Cliente asignado a operación: ${clientName}`);
      
      return {
        success: true,
        action,
        clientId,
        clientName,
        invoiceData,
        reasoning: `Cliente ${action === 'created-and-assigned' ? 'creado y' : ''} asignado automáticamente desde factura`
      };
      
    } catch (error) {
      console.error('[Client Auto-Assignment] Error:', error);
      return {
        success: false,
        action: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Busca un cliente que coincida con los datos del receptor
   */
  private async findMatchingClient(receptorData: FacturamaInvoiceData['receptor']): Promise<ClientMatchResult> {
    
    try {
      // 1. Búsqueda por RFC (máxima prioridad)
      if (receptorData.rfc) {
        const clientByRFC = await db.select().from(clients)
          .where(eq(clients.rfc, receptorData.rfc))
          .limit(1);
        
        if (clientByRFC.length > 0) {
          return {
            matched: true,
            client: clientByRFC[0],
            matchType: 'rfc',
            confidence: 95
          };
        }
      }
      
      // 2. Búsqueda por nombre (similitud)
      const normalizedName = this.normalizeName(receptorData.nombre);
      
      const clientsByName = await db.select().from(clients)
        .where(
          or(
            ilike(clients.name, `%${normalizedName}%`),
            ilike(clients.razonSocial, `%${normalizedName}%`)
          )
        )
        .limit(5);
      
      for (const client of clientsByName) {
        const similarity = this.calculateNameSimilarity(normalizedName, this.normalizeName(client.name));
        
        if (similarity > 0.8) {
          return {
            matched: true,
            client,
            matchType: 'name',
            confidence: Math.round(similarity * 100)
          };
        }
      }
      
      // 3. No se encontró coincidencia
      return {
        matched: false,
        matchType: 'none',
        confidence: 0
      };
      
    } catch (error) {
      console.error('[Client Auto-Assignment] Error searching for client:', error);
      return {
        matched: false,
        matchType: 'none',
        confidence: 0
      };
    }
  }

  /**
   * Crea un nuevo cliente desde los datos de la factura
   */
  private async createClientFromInvoice(
    receptorData: FacturamaInvoiceData['receptor'],
    sourceAttachmentId: string,
    invoiceCurrency?: string
  ): Promise<any> {
    
    // Generar email temporal si no existe
    const email = this.generateTemporaryEmail(receptorData.rfc || receptorData.nombre);
    
    // Determinar divisa desde la factura o usar MXN por defecto
    let currency = 'MXN';
    if (invoiceCurrency) {
      currency = invoiceCurrency.toUpperCase();
    }
    
    const newClient = await storage.createClient({
      name: receptorData.nombre,
      email,
      phone: '',
      address: receptorData.direccion || '',
      currency, // Usar divisa de la factura
      status: 'active',
      notes: `Cliente creado automáticamente desde factura Facturama (Divisa: ${currency})`,
      
      // Datos fiscales
      rfc: receptorData.rfc,
      razonSocial: receptorData.nombre,
      codigoPostal: receptorData.codigoPostal,
      regimenFiscal: receptorData.regimenFiscal,
      usoCFDI: receptorData.usoCFDI,
      ciudad: receptorData.ciudad,
      estado: receptorData.estado,
      pais: receptorData.pais || 'México',
      
      // Metadata
      createdFromInvoice: true,
      sourceInvoiceAttachmentId: sourceAttachmentId
    });
    
    return newClient;
  }

  /**
   * Actualiza datos de un cliente existente si los nuevos datos son más completos
   * IMPORTANTE: Actualiza la divisa del cliente si la factura tiene una divisa diferente
   */
  private async updateClientIfNeeded(
    existingClient: any,
    receptorData: FacturamaInvoiceData['receptor'],
    sourceAttachmentId: string,
    invoiceCurrency?: string
  ): Promise<void> {
    
    const updates: any = {};
    
    // 🔑 ACTUALIZAR DIVISA SI LA FACTURA TIENE UNA DIVISA DIFERENTE
    // Esta es la "fuente de verdad" - la factura indica la divisa correcta del cliente
    if (invoiceCurrency) {
      const normalizedInvoiceCurrency = invoiceCurrency.toUpperCase();
      const currentCurrency = existingClient.currency?.toUpperCase() || 'MXN';
      
      if (normalizedInvoiceCurrency !== currentCurrency) {
        updates.currency = normalizedInvoiceCurrency;
        
        console.log(`[Client Auto-Assignment] 💱 Actualizando divisa del cliente de ${currentCurrency} a ${normalizedInvoiceCurrency} (basado en factura Facturama)`);
      }
    }
    
    // Actualizar RFC si no existe
    if (!existingClient.rfc && receptorData.rfc) {
      updates.rfc = receptorData.rfc;
    }
    
    // Actualizar dirección si no existe
    if (!existingClient.address && receptorData.direccion) {
      updates.address = receptorData.direccion;
    }
    
    // Actualizar código postal si no existe
    if (!existingClient.codigoPostal && receptorData.codigoPostal) {
      updates.codigoPostal = receptorData.codigoPostal;
    }
    
    // Actualizar régimen fiscal si no existe
    if (!existingClient.regimenFiscal && receptorData.regimenFiscal) {
      updates.regimenFiscal = receptorData.regimenFiscal;
    }
    
    // Actualizar ciudad/estado si no existen
    if (!existingClient.ciudad && receptorData.ciudad) {
      updates.ciudad = receptorData.ciudad;
    }
    if (!existingClient.estado && receptorData.estado) {
      updates.estado = receptorData.estado;
    }
    
    // Marcar que fue actualizado desde factura
    if (Object.keys(updates).length > 0) {
      updates.sourceInvoiceAttachmentId = sourceAttachmentId;
      
      await storage.updateClient(existingClient.id, updates);
      
      console.log(`[Client Auto-Assignment] 📝 Cliente actualizado con ${Object.keys(updates).length} nuevos campos`);
    }
  }

  /**
   * Normaliza un nombre para comparación
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[áàä]/g, 'a')
      .replace(/[éèë]/g, 'e')
      .replace(/[íìï]/g, 'i')
      .replace(/[óòö]/g, 'o')
      .replace(/[úùü]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calcula similitud entre dos nombres (0-1)
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const words1 = new Set(name1.split(/\s+/));
    const words2 = new Set(name2.split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Genera un email temporal para clientes sin email
   */
  private generateTemporaryEmail(identifier: string): string {
    const sanitized = identifier.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${sanitized}@cliente-temporal.mx`;
  }

  /**
   * Procesa todas las operaciones sin cliente asignado para intentar asignar desde facturas
   */
  async processUnassignedOperations(): Promise<{
    processed: number;
    assigned: number;
    created: number;
    errors: number;
  }> {
    
    console.log('[Client Auto-Assignment] 🔄 Procesando operaciones sin cliente...');
    
    const stats = {
      processed: 0,
      assigned: 0,
      created: 0,
      errors: 0
    };
    
    try {
      // Obtener operaciones sin cliente
      const unassignedOps = await db.select()
        .from(operations)
        .where(sql`${operations.clientId} IS NULL`)
        .limit(50);
      
      console.log(`[Client Auto-Assignment] Encontradas ${unassignedOps.length} operaciones sin cliente`);
      
      for (const op of unassignedOps) {
        stats.processed++;
        
        // Obtener attachments de la operación
        const attachments = await storage.getOperationFiles(op.id);
        
        // Buscar PDFs que puedan ser facturas (incluye abreviaciones comunes)
        const invoiceCandidates = attachments.filter(att => {
          if (!att.name) return false;
          const nameLower = att.name.toLowerCase();
          return (
            nameLower.includes('factura') ||
            nameLower.includes('invoice') ||
            nameLower.includes('fact.') ||  // Abreviación común
            nameLower.includes('fact ') ||   // Abreviación con espacio
            nameLower.includes('inv.') ||    // Abreviación de invoice
            (nameLower.endsWith('.pdf') && att.mimeType === 'application/pdf')
          );
        });
        
        if (invoiceCandidates.length === 0) {
          continue;
        }
        
        // Intentar con cada attachment
        for (const attachment of invoiceCandidates) {
          const result = await this.processAttachmentForClientAssignment(
            op.id,
            attachment.id,
            attachment.name,
            attachment.b2Key
          );
          
          if (result.success) {
            if (result.action === 'created-and-assigned') {
              stats.created++;
            }
            stats.assigned++;
            break; // Ya se asignó, no seguir con otros attachments
          } else if (result.action === 'error') {
            stats.errors++;
          }
        }
      }
      
      console.log(`[Client Auto-Assignment] ✅ Procesamiento completo: ${stats.assigned} asignados, ${stats.created} creados, ${stats.errors} errores`);
      
    } catch (error) {
      console.error('[Client Auto-Assignment] Error en processUnassignedOperations:', error);
    }
    
    return stats;
  }
}

export const clientAutoAssignmentService = new ClientAutoAssignmentService();
