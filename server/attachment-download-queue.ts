import { storage } from './storage';
import * as gmailSync from './gmail-sync';

/**
 * 🎯 SISTEMA DE COLA ASÍNCRONA PARA DESCARGAS DE ARCHIVOS
 * 
 * Beneficios:
 * - No bloquea sincronización ni automatizaciones
 * - Concurrencia limitada (2-3 descargas simultáneas)
 * - Retry automático con exponential backoff
 * - Priorización: archivos de operaciones vinculadas primero
 * - Ahorra ancho de banda y almacenamiento en Backblaze
 */

interface QueueItem {
  attachmentId: string;
  priority: 'high' | 'normal';
  retryCount: number;
  enqueuedAt: Date;
}

class AttachmentDownloadQueue {
  private queue: QueueItem[] = [];
  private processing: Set<string> = new Set();
  private maxConcurrent = 2; // 2 descargas simultáneas
  private maxRetries = 3;
  private retryDelays = [30000, 120000, 300000]; // 30s, 2min, 5min
  private isRunning = false;

  /**
   * Encola un attachment para descarga (no bloquea)
   */
  async enqueue(attachmentId: string, priority: 'high' | 'normal' = 'normal'): Promise<void> {
    // Verificar si ya está en cola o procesando
    const inQueue = this.queue.some(item => item.attachmentId === attachmentId);
    const isProcessing = this.processing.has(attachmentId);
    
    if (inQueue || isProcessing) {
      console.log(`[Queue] Attachment ${attachmentId} already queued/processing`);
      return;
    }

    // Verificar si ya está descargado
    const attachment = await storage.getGmailAttachment(attachmentId);
    if (!attachment) {
      console.error(`[Queue] Attachment ${attachmentId} not found`);
      return;
    }

    if (attachment.downloadStatus === 'ready') {
      console.log(`[Queue] Attachment ${attachment.filename} already downloaded`);
      return;
    }

    // Agregar a la cola
    this.queue.push({
      attachmentId,
      priority,
      retryCount: attachment.downloadRetryCount || 0,
      enqueuedAt: new Date(),
    });

    // Actualizar prioridad en DB
    await storage.updateGmailAttachment(attachmentId, {
      downloadPriority: priority,
      downloadStatus: 'pending',
    });

    console.log(`[Queue] Enqueued attachment ${attachment.filename} (priority: ${priority})`);

    // Iniciar procesamiento si no está corriendo
    if (!this.isRunning) {
      this.startProcessing();
    }
  }

  /**
   * Encola TODOS los attachments de un mensaje (para correos vinculados a operaciones)
   */
  async enqueueMessageAttachments(gmailMessageId: string, priority: 'high' | 'normal' = 'high'): Promise<void> {
    const attachments = await storage.getGmailAttachments(gmailMessageId);
    
    console.log(`[Queue] Enqueuing ${attachments.length} attachments from message ${gmailMessageId}`);
    
    // Encolar todos (en paralelo, sin esperar)
    await Promise.all(
      attachments.map(att => this.enqueue(att.id, priority))
    );
  }

  /**
   * Worker que procesa la cola continuamente
   */
  private async startProcessing() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[Queue] Worker started');

    while (this.queue.length > 0 || this.processing.size > 0) {
      // Ordenar cola por prioridad (high primero)
      this.queue.sort((a, b) => {
        if (a.priority === 'high' && b.priority === 'normal') return -1;
        if (a.priority === 'normal' && b.priority === 'high') return 1;
        return a.enqueuedAt.getTime() - b.enqueuedAt.getTime();
      });

      // Procesar mientras haya espacio disponible
      while (this.processing.size < this.maxConcurrent && this.queue.length > 0) {
        const item = this.queue.shift()!;
        
        // Marcar como procesando
        this.processing.add(item.attachmentId);
        
        // Procesar asíncronamente (no esperar)
        this.processItem(item).catch(error => {
          console.error(`[Queue] Error processing ${item.attachmentId}:`, error);
        });
      }

      // Esperar un poco antes de revisar cola de nuevo
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.isRunning = false;
    console.log('[Queue] Worker stopped (queue empty)');
  }

  /**
   * Procesa un item de la cola
   */
  private async processItem(item: QueueItem): Promise<void> {
    const { attachmentId, retryCount } = item;

    try {
      // Actualizar status a 'downloading'
      await storage.updateGmailAttachment(attachmentId, {
        downloadStatus: 'downloading',
        lastDownloadAttempt: new Date(),
      });

      // Descargar y procesar
      await gmailSync.downloadAndProcessAttachment(attachmentId);

      // Marcar como ready
      await storage.updateGmailAttachment(attachmentId, {
        downloadStatus: 'ready',
        downloadError: null,
      });

      console.log(`[Queue] ✅ Successfully processed attachment ${attachmentId}`);

    } catch (error: any) {
      console.error(`[Queue] ❌ Error processing attachment ${attachmentId}:`, error);

      // Retry logic con exponential backoff
      const newRetryCount = retryCount + 1;
      
      if (newRetryCount < this.maxRetries) {
        const retryDelay = this.retryDelays[newRetryCount - 1] || 300000;
        
        console.log(`[Queue] Retry ${newRetryCount}/${this.maxRetries} for ${attachmentId} in ${retryDelay/1000}s`);

        // Actualizar contador de reintentos
        await storage.updateGmailAttachment(attachmentId, {
          downloadStatus: 'pending',
          downloadRetryCount: newRetryCount,
          downloadError: error.message,
        });

        // Re-encolar después del delay
        setTimeout(() => {
          this.queue.push({
            ...item,
            retryCount: newRetryCount,
          });
        }, retryDelay);

      } else {
        // Max retries alcanzado - marcar como failed
        console.error(`[Queue] 🛑 Max retries reached for ${attachmentId}, marking as failed`);
        
        await storage.updateGmailAttachment(attachmentId, {
          downloadStatus: 'failed',
          downloadError: error.message,
        });
      }
    } finally {
      // Remover de procesando
      this.processing.delete(attachmentId);
    }
  }

  /**
   * Obtiene estadísticas de la cola
   */
  getStats() {
    return {
      queueLength: this.queue.length,
      processing: this.processing.size,
      isRunning: this.isRunning,
      highPriority: this.queue.filter(i => i.priority === 'high').length,
      normalPriority: this.queue.filter(i => i.priority === 'normal').length,
    };
  }
}

// Singleton instance
export const downloadQueue = new AttachmentDownloadQueue();

/**
 * 🎯 HELPER: Asegura que los attachments de un mensaje estén listos
 * Para usar en automatizaciones que necesitan archivos
 */
export async function ensureAttachmentsReady(
  gmailMessageId: string,
  timeoutMs: number = 60000
): Promise<boolean> {
  const attachments = await storage.getGmailAttachments(gmailMessageId);
  
  if (attachments.length === 0) {
    return true; // No hay attachments, listo
  }

  // Verificar si todos están ready
  const allReady = attachments.every(att => att.downloadStatus === 'ready');
  if (allReady) {
    return true;
  }

  // Encolar con prioridad alta
  await downloadQueue.enqueueMessageAttachments(gmailMessageId, 'high');

  // Esperar hasta que estén listos (con timeout)
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    const updatedAttachments = await storage.getGmailAttachments(gmailMessageId);
    const ready = updatedAttachments.filter(att => att.downloadStatus === 'ready').length;
    const failed = updatedAttachments.filter(att => att.downloadStatus === 'failed').length;
    const total = updatedAttachments.length;

    console.log(`[ensureAttachmentsReady] ${ready}/${total} ready, ${failed} failed`);

    // Si todos están listos o fallaron
    if (ready + failed === total) {
      return ready === total; // true si todos ready, false si alguno falló
    }

    // Esperar 2 segundos antes de revisar de nuevo
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Timeout alcanzado
  console.warn(`[ensureAttachmentsReady] Timeout reached for message ${gmailMessageId}`);
  return false;
}
