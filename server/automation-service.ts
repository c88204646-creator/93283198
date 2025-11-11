import { storage } from './storage';
import type { AutomationConfig, AutomationRule, GmailMessage } from '@shared/schema';
import { getAttachmentData } from './gmail-sync';
import { BackblazeStorage } from './backblazeStorage';
import { processEmailThreadForAutomation, EmailTaskAutomation } from './email-task-automation';
import { clientAutoAssignmentService } from './client-auto-assignment-service';
import { invoiceAutoAssignmentService } from './invoice-auto-assignment-service';

// Automation service that processes emails and creates operations automatically
export class AutomationService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes (optimized to reduce DB transfer)
  private emailTaskAutomation: EmailTaskAutomation;

  constructor() {
    this.emailTaskAutomation = new EmailTaskAutomation();
  }

  start() {
    if (this.isRunning) {
      console.log('Automation service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Automation service started (interval: 15 minutes)');

    // Run immediately on start
    this.processAutomations().catch(err => {
      console.error('Error in initial automation run:', err);
    });

    // Then run every 15 minutes
    this.intervalId = setInterval(() => {
      this.processAutomations().catch(err => {
        console.error('Error in automation service:', err);
      });
    }, this.CHECK_INTERVAL);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Automation service stopped');
  }

  async processAutomations() {
    try {
      // Get all enabled automation configs
      const configs = await storage.getEnabledAutomationConfigs();
      console.log(`[Automation] Found ${configs.length} enabled automation configs`);
      
      for (const config of configs) {
        await this.processConfigAutomation(config);
      }
      
      // 🆕 Procesamiento adicional: Asignación automática de clientes desde facturas
      await this.processClientAutoAssignment();
      
      // 🆕 Procesamiento adicional: Creación y asignación automática de facturas desde PDFs
      await this.processInvoiceAutoAssignment();
      
      // 🆕 Limpieza automática de thumbnails huérfanos y duplicados en B2
      await this.cleanupOrphanedThumbnails();
      
    } catch (error) {
      console.error('Error processing automations:', error);
    }
  }

  /**
   * Limpia thumbnails huérfanos que ya no tienen archivo padre
   */
  private async cleanupOrphanedThumbnails() {
    try {
      const { ThumbnailService } = await import('./thumbnail-service');
      const deleted = await ThumbnailService.cleanupOrphanedThumbnails();
      
      if (deleted > 0) {
        console.log(`[Automation] Cleaned up ${deleted} orphaned thumbnails`);
      }
    } catch (error) {
      console.error('[Automation] Error cleaning up thumbnails:', error);
    }
  }

  /**
   * Procesa operaciones sin cliente asignado para detectar facturas y asignar automáticamente
   */
  private async processClientAutoAssignment() {
    try {
      // Verificar si hay alguna config con autoAssignClients habilitado
      const configs = await storage.getEnabledAutomationConfigs();
      const clientAssignmentEnabled = configs.some(c => c.autoAssignClients === true);
      
      if (!clientAssignmentEnabled) {
        // No hacer nada si está deshabilitado
        return;
      }
      
      console.log('[Automation] 📋 Procesando asignación automática de clientes...');
      
      const result = await clientAutoAssignmentService.processUnassignedOperations();
      
      if (result.assigned > 0 || result.created > 0) {
        console.log(`[Automation] ✅ Asignación de clientes completada: ${result.assigned} asignados, ${result.created} nuevos creados`);
      } else {
        console.log('[Automation] ℹ️  No se encontraron operaciones para asignar clientes');
      }
      
    } catch (error) {
      console.error('[Automation] Error en processClientAutoAssignment:', error);
    }
  }

  /**
   * Procesa operaciones para detectar y crear facturas automáticamente desde PDFs de Facturama
   */
  private async processInvoiceAutoAssignment() {
    try {
      // Verificar si hay alguna config con autoAssignInvoices habilitado
      const configs = await storage.getEnabledAutomationConfigs();
      const invoiceAssignmentEnabled = configs.some(c => c.autoAssignInvoices === true);
      
      if (!invoiceAssignmentEnabled) {
        // No hacer nada si está deshabilitado
        return;
      }
      
      console.log('[Automation] 📄 Procesando creación automática de facturas...');
      
      const result = await invoiceAutoAssignmentService.processOperationsForInvoiceDetection();
      
      if (result.invoicesCreated > 0 || result.invoicesAssigned > 0) {
        console.log(`[Automation] ✅ Creación de facturas completada: ${result.invoicesCreated} creadas, ${result.invoicesAssigned} asignadas`);
      } else {
        console.log('[Automation] ℹ️  No se encontraron facturas para procesar');
      }
      
    } catch (error) {
      console.error('[Automation] Error en processInvoiceAutoAssignment:', error);
    }
  }

  private async processConfigAutomation(config: AutomationConfig) {
    try {
      console.log(`[Automation] Processing config: ${config.moduleId}, enabled: ${config.isEnabled}`);
      
      // Get enabled rules for this config, sorted by priority
      const rules = await storage.getAutomationRulesByConfig(config.id);
      const enabledRules = rules.filter(r => r.isEnabled).sort((a, b) => (b.priority || 0) - (a.priority || 0));
      console.log(`[Automation] Found ${enabledRules.length} enabled rules for config ${config.moduleId}`);

      if (enabledRules.length === 0) {
        console.log(`[Automation] No enabled rules for config ${config.moduleId}, skipping`);
        return;
      }

      // Get selected Gmail accounts
      const accountIds = (config.selectedGmailAccounts as string[]) || [];
      console.log(`[Automation] Gmail accounts selected: ${accountIds.length}`);
      if (accountIds.length === 0) {
        console.log(`[Automation] No Gmail accounts selected for config ${config.moduleId}, skipping`);
        return;
      }

      // Get unprocessed messages from selected accounts
      const messages = await storage.getUnprocessedMessages(accountIds, config.lastProcessedAt || new Date(0));
      console.log(`[Automation] Found ${messages.length} unprocessed messages`);

      for (const message of messages) {
        await this.processMessage(message, enabledRules, config);
      }

      // Process attachments for linked messages if enabled
      if (config.processAttachments) {
        await this.processLinkedMessagesAttachments(config);
      }

      // Process existing operations for tasks/notes automation if enabled
      if (config.autoCreateTasks !== 'disabled' || config.autoCreateNotes !== 'disabled') {
        await this.processExistingOperationsForTasksAndNotes(config);
      }

      // Process financial detection for operations if enabled
      if (config.autoDetectPayments || config.autoDetectExpenses) {
        await this.processFinancialDetectionForOperations(config);
      }

      // Update last processed timestamp
      await storage.updateAutomationConfig(config.id, {
        lastProcessedAt: new Date(),
      });
      console.log(`[Automation] Updated lastProcessedAt for config ${config.moduleId}`);
    } catch (error) {
      console.error(`Error processing automation config ${config.id}:`, error);
    }
  }

  private async processMessage(message: GmailMessage, rules: AutomationRule[], config: AutomationConfig) {
    for (const rule of rules) {
      try {
        const matches = await this.evaluateRule(message, rule);
        
        if (matches) {
          await this.executeRuleActions(message, rule, config);
          // Only execute the first matching rule (highest priority)
          break;
        }
      } catch (error) {
        console.error(`Error processing rule ${rule.id} for message ${message.id}:`, error);
        
        // Log error
        await storage.createAutomationLog({
          ruleId: rule.id,
          emailMessageId: message.id,
          actionType: 'rule_evaluation',
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async evaluateRule(message: GmailMessage, rule: AutomationRule): Promise<boolean> {
    const conditions = rule.conditions as any;
    
    if (!conditions || !Array.isArray(conditions)) {
      return false;
    }

    // Evaluate all conditions (AND logic)
    for (const condition of conditions) {
      const { field, operator, value } = condition;

      let fieldValue: any;
      if (field === 'subject') {
        fieldValue = message.subject;
      } else if (field === 'from') {
        fieldValue = message.fromEmail || message.fromName || '';
      } else if (field === 'to') {
        fieldValue = message.toRecipients || '';
      } else if (field === 'body') {
        fieldValue = message.snippet || '';
      } else {
        continue;
      }

      const matches = this.evaluateCondition(fieldValue, operator, value);
      if (!matches) {
        return false;
      }
    }

    return true;
  }

  private evaluateCondition(fieldValue: string | null, operator: string, expectedValue: string): boolean {
    if (!fieldValue) return false;

    switch (operator) {
      case 'contains':
        return fieldValue.toLowerCase().includes(expectedValue.toLowerCase());
      case 'startsWith':
        return fieldValue.toLowerCase().startsWith(expectedValue.toLowerCase());
      case 'endsWith':
        return fieldValue.toLowerCase().endsWith(expectedValue.toLowerCase());
      case 'equals':
        return fieldValue.toLowerCase() === expectedValue.toLowerCase();
      case 'matches': // Regex
        try {
          const regex = new RegExp(expectedValue, 'i');
          return regex.test(fieldValue);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  private async executeRuleActions(message: GmailMessage, rule: AutomationRule, config: AutomationConfig) {
    const actions = rule.actions as any;
    
    if (!actions || !Array.isArray(actions)) {
      return;
    }

    for (const action of actions) {
      try {
        if (action.type === 'create_operation') {
          await this.createOperation(message, rule, config, action.params || {});
        }
      } catch (error) {
        console.error(`Error executing action ${action.type}:`, error);
        
        await storage.createAutomationLog({
          ruleId: rule.id,
          emailMessageId: message.id,
          actionType: action.type,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async createOperation(message: GmailMessage, rule: AutomationRule, config: AutomationConfig, params: any) {
    // Extract operation ID from subject using the pattern
    const pattern = params.idPattern || 'NAVI-';
    const regex = new RegExp(`${pattern}(\\d+)`, 'i');
    const match = message.subject?.match(regex);

    if (!match) {
      console.log(`No operation ID found in subject: ${message.subject}`);
      return;
    }

    const operationId = match[1];
    const operationName = `${pattern}${operationId}`;

    // Check if operation already exists
    const existingOperations = await storage.getAllOperations();
    const exists = existingOperations.some(op => op.name === operationName);

    if (exists) {
      console.log(`Operation ${operationName} already exists, skipping`);
      
      await storage.createAutomationLog({
        ruleId: rule.id,
        emailMessageId: message.id,
        actionType: 'create_operation',
        status: 'skipped',
        details: { reason: 'operation_already_exists', operationName },
      });
      
      return;
    }

    // Create operation with minimal data
    const operation = await storage.createOperation({
      name: operationName,
      description: `Operation ${operationName} created from email: ${message.subject}`,
      status: 'planning',
      priority: 'medium',
      startDate: new Date(),
      projectCategory: params.defaultCategory || 'import',
      operationType: params.defaultType || 'FCL',
      shippingMode: params.defaultMode || 'sea',
      insurance: params.defaultInsurance || 'no',
      projectCurrency: params.defaultCurrency || 'USD',
      createdAutomatically: true,
      automationRuleId: rule.id,
      requiresReview: true,
    });

    // Link the message to the newly created operation
    await storage.linkMessageToOperation(message.id, operation.id);
    console.log(`Linked message ${message.id} to operation ${operation.id}`);

    // Assign default employees to the operation
    const defaultEmployees = (config.defaultEmployees as string[]) || [];
    for (const employeeId of defaultEmployees) {
      try {
        await storage.assignEmployeeToOperation(operation.id, employeeId);
      } catch (error) {
        console.error(`Error assigning employee ${employeeId} to operation ${operation.id}:`, error);
      }
    }

    console.log(`Created operation ${operationName} automatically with ${defaultEmployees.length} assigned employees`);

    // Process email attachments if enabled
    if (config.processAttachments) {
      await this.processEmailAttachments(message, operation.id, config);
    }

    // Process email thread for automated tasks and notes if enabled
    if (config.autoCreateTasks !== 'disabled' || config.autoCreateNotes !== 'disabled') {
      console.log(`[Automation] Processing email thread for tasks/notes automation (tasks: ${config.autoCreateTasks}, notes: ${config.autoCreateNotes})`);
      try {
        await processEmailThreadForAutomation(
          message.id,
          operation.id,
          config.autoCreateTasks || 'disabled',
          config.autoCreateNotes || 'disabled',
          config.aiOptimizationLevel || 'high'
        );
      } catch (error) {
        console.error('[Automation] Error processing email thread for tasks/notes:', error);
      }
    }

    await storage.createAutomationLog({
      ruleId: rule.id,
      emailMessageId: message.id,
      actionType: 'create_operation',
      status: 'success',
      entityType: 'operation',
      entityId: operation.id,
      details: { 
        operationName, 
        messageSubject: message.subject,
        assignedEmployees: defaultEmployees.length,
        autoTasksEnabled: config.autoCreateTasks !== 'disabled',
        autoNotesEnabled: config.autoCreateNotes !== 'disabled',
      },
    });
  }

  private async getOrCreateCategoryFolder(operationId: string, category: string | null, config: AutomationConfig): Promise<string | null> {
    if (!category) return null;

    const categoryNames: Record<string, string> = {
      'payment': 'Pagos',
      'expense': 'Gastos',
      'image': 'Fotos',
      'invoice': 'Facturas',
      'contract': 'Contratos',
      'document': 'Documentos',
    };

    const folderName = categoryNames[category] || 'Otros';

    // Check if folder already exists
    const existingFolders = await storage.getOperationFolders(operationId);
    const existingFolder = existingFolders.find(f => f.name === folderName);

    if (existingFolder) {
      return existingFolder.id;
    }

    // Create folder if it doesn't exist
    const newFolder = await storage.createOperationFolder({
      operationId,
      name: folderName,
      parentFolderId: null,
      createdBy: config.userId,
    });

    return newFolder.id;
  }

  private async processEmailAttachments(message: GmailMessage, operationId: string, config: AutomationConfig) {
    try {
      // Get attachments for this message
      const attachments = await storage.getGmailAttachments(message.id);
      
      if (attachments.length === 0) {
        console.log(`[Automation] No attachments found for message ${message.id}`);
        return;
      }

      console.log(`[Automation] Processing ${attachments.length} attachments for operation ${operationId}`);

      // Get Gmail account to download attachments
      const gmailAccount = await storage.getGmailAccount(message.gmailAccountId);
      if (!gmailAccount) {
        console.error(`[Automation] Gmail account ${message.gmailAccountId} not found`);
        return;
      }

      const b2Storage = new BackblazeStorage();
      const db = (await import('./db')).db;
      const { operationFiles } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      for (const attachment of attachments) {
        try {
          // Skip inline images
          if (attachment.isInline) {
            continue;
          }

          // Check if this specific attachment has already been processed
          // This respects user modifications - if the file exists, we don't touch it
          // If the user deleted it, we can recreate it
          const existingFile = await db.select()
            .from(operationFiles)
            .where(eq(operationFiles.sourceGmailAttachmentId, attachment.id))
            .limit(1);

          if (existingFile.length > 0) {
            console.log(`[Automation] Attachment ${attachment.filename} already exists, skipping`);
            continue;
          }

          // Download attachment data
          const attachmentData = await getAttachmentData(
            gmailAccount,
            message.messageId,
            attachment.attachmentId
          );

          // Convert base64 to buffer
          const buffer = Buffer.from(attachmentData, 'base64');

          // Upload to Backblaze B2 (automatically handles deduplication)
          const uploadResult = await b2Storage.uploadFile(buffer, 'operations/files', {
            originalName: attachment.filename,
            mimeType: attachment.mimeType,
            uploadedBy: config.userId,
            source: 'gmail_automation',
            emailId: message.id,
            attachmentId: attachment.id,
          });

          const objectPath = uploadResult.fileKey;

          // Categorize automatically
          const category = this.categorizeFile(attachment.filename, attachment.mimeType);

          // Get or create folder for this category
          const folderId = await this.getOrCreateCategoryFolder(operationId, category, config);

          // Create file record
          await storage.createOperationFile({
            operationId,
            folderId,
            name: attachment.filename,
            originalName: attachment.filename,
            mimeType: attachment.mimeType,
            size: attachment.size,
            objectPath,
            category,
            description: `Email attachment: ${message.subject}`,
            uploadedBy: config.userId,
            uploadedVia: 'gmail_automation',
            sourceGmailMessageId: message.id,
            sourceGmailAttachmentId: attachment.id,
          });

          console.log(`[Automation] Processed attachment ${attachment.filename} for operation ${operationId} in folder ${folderId}`);
        } catch (error) {
          console.error(`[Automation] Error processing attachment ${attachment.filename}:`, error);
        }
      }
    } catch (error) {
      console.error(`[Automation] Error processing email attachments:`, error);
    }
  }

  private async processLinkedMessagesAttachments(config: AutomationConfig) {
    try {
      // Get all messages linked to operations that have attachments
      const db = (await import('./db')).db;
      const { gmailMessages, gmailAttachments, operationFiles } = await import('@shared/schema');
      const { eq, and, isNotNull, sql: sqlFunc } = await import('drizzle-orm');
      
      const messagesWithAttachments = await db.select()
        .from(gmailMessages)
        .where(and(
          isNotNull(gmailMessages.operationId),
          eq(gmailMessages.hasAttachments, true)
        ));

      console.log(`[Automation] Found ${messagesWithAttachments.length} linked messages with attachments`);

      for (const message of messagesWithAttachments) {
        // Process attachments for this message
        // The processEmailAttachments function now checks each attachment individually
        // This respects user modifications: if a user deletes a file, it can be recreated
        // If a user edits a file (moves, renames), it won't be duplicated
        console.log(`[Automation] Processing attachments for message ${message.id} (operation: ${message.operationId})`);
        await this.processEmailAttachments(message as any, message.operationId!, config);
      }
    } catch (error) {
      console.error('[Automation] Error processing linked messages attachments:', error);
    }
  }

  private async processExistingOperationsForTasksAndNotes(config: AutomationConfig) {
    try {
      console.log(`[Automation] Processing existing operations for tasks/notes automation`);
      
      // Get all operations that have linked emails
      const db = (await import('./db')).db;
      const { gmailMessages } = await import('@shared/schema');
      const { isNotNull, sql: sqlFunc } = await import('drizzle-orm');
      
      // Get distinct operation IDs that have linked emails
      const operationsWithEmails = await db.selectDistinct({
        operationId: gmailMessages.operationId
      })
        .from(gmailMessages)
        .where(isNotNull(gmailMessages.operationId));

      console.log(`[Automation] Found ${operationsWithEmails.length} operations with linked emails`);

      // Process each operation
      for (const item of operationsWithEmails) {
        if (!item.operationId) continue;

        try {
          // Get the first linked message to extract the initial messageId
          const [firstMessage] = await db.select()
            .from(gmailMessages)
            .where(sqlFunc`${gmailMessages.operationId} = ${item.operationId}`)
            .limit(1);

          if (!firstMessage) continue;

          // Process this operation for tasks and notes
          await processEmailThreadForAutomation(
            firstMessage.id,
            item.operationId,
            config.autoCreateTasks || 'disabled',
            config.autoCreateNotes || 'disabled',
            config.aiOptimizationLevel || 'high'
          );

          // Small delay to avoid overwhelming Gemini API
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`[Automation] Error processing operation ${item.operationId}:`, error);
        }
      }

      console.log(`[Automation] Finished processing operations for tasks/notes automation`);
    } catch (error) {
      console.error('[Automation] Error in processExistingOperationsForTasksAndNotes:', error);
    }
  }

  private async processFinancialDetectionForOperations(config: AutomationConfig) {
    try {
      console.log(`[Automation] Processing financial detection for operations`);
      
      // Get all operations that have linked emails
      const db = (await import('./db')).db;
      const { gmailMessages } = await import('@shared/schema');
      const { isNotNull } = await import('drizzle-orm');
      
      // Get distinct operation IDs that have linked emails
      const operationsWithEmails = await db.selectDistinct({
        operationId: gmailMessages.operationId
      })
        .from(gmailMessages)
        .where(isNotNull(gmailMessages.operationId));

      console.log(`[Automation] Found ${operationsWithEmails.length} operations with linked emails for financial detection`);

      let totalSuggestionsCreated = 0;

      // Process each operation
      for (const item of operationsWithEmails) {
        if (!item.operationId) continue;

        try {
          // Call financial detection for this operation
          const suggestionsCreated = await this.emailTaskAutomation.processFinancialDetection(
            item.operationId,
            config.autoDetectPayments || false,
            config.autoDetectExpenses || false
          );

          totalSuggestionsCreated += suggestionsCreated;

          // Small delay to avoid overwhelming services
          if (suggestionsCreated > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error) {
          console.error(`[Automation] Error processing financial detection for operation ${item.operationId}:`, error);
        }
      }

      console.log(`[Automation] Finished processing financial detection - Created ${totalSuggestionsCreated} suggestions`);
    } catch (error) {
      console.error('[Automation] Error in processFinancialDetectionForOperations:', error);
    }
  }

  private categorizeFile(filename: string, mimeType: string): string | null {
    const lowerFilename = filename.toLowerCase();
    const lowerMimeType = mimeType.toLowerCase();

    // Images
    if (lowerMimeType.startsWith('image/')) {
      return 'image';
    }

    // Payments - look for keywords in filename
    if (lowerFilename.includes('payment') || lowerFilename.includes('pago') || 
        lowerFilename.includes('transferencia') || lowerFilename.includes('transfer')) {
      return 'payment';
    }

    // Expenses
    if (lowerFilename.includes('expense') || lowerFilename.includes('gasto') ||
        lowerFilename.includes('recibo') || lowerFilename.includes('receipt')) {
      return 'expense';
    }

    // Invoices
    if (lowerFilename.includes('invoice') || lowerFilename.includes('factura') ||
        lowerFilename.includes('bill')) {
      return 'invoice';
    }

    // Contracts
    if (lowerFilename.includes('contract') || lowerFilename.includes('contrato') ||
        lowerFilename.includes('agreement')) {
      return 'contract';
    }

    // Documents
    if (lowerMimeType.includes('pdf') || lowerMimeType.includes('word') ||
        lowerMimeType.includes('document')) {
      return 'document';
    }

    return null;
  }
}

// Export singleton instance
export const automationService = new AutomationService();

// Auto-start function for background processing
export function startAutomationService() {
  automationService.start();
}
