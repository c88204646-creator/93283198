import { storage } from './storage';
import type { AutomationConfig, AutomationRule, GmailMessage } from '@shared/schema';
import { getAttachmentData } from './gmail-sync';
import { ObjectStorageService } from './objectStorage';

// Automation service that processes emails and creates operations automatically
export class AutomationService {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes

  start() {
    if (this.isRunning) {
      console.log('Automation service is already running');
      return;
    }

    this.isRunning = true;
    console.log('Automation service started (interval: 2 minutes)');

    // Run immediately on start
    this.processAutomations().catch(err => {
      console.error('Error in initial automation run:', err);
    });

    // Then run every 2 minutes
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
    } catch (error) {
      console.error('Error processing automations:', error);
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
        fieldValue = message.from;
      } else if (field === 'to') {
        fieldValue = message.to;
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
      description: `Operación creada automáticamente desde correo: ${message.subject}\n\nDe: ${message.from}\nFecha: ${message.receivedAt}\n\nSnippet: ${message.snippet}`,
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
      },
    });
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

      const objectStorageService = new ObjectStorageService();

      for (const attachment of attachments) {
        try {
          // Skip inline images
          if (attachment.isInline) {
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

          // Upload to object storage
          const uploadURL = await objectStorageService.getObjectEntityUploadURL();
          
          // Upload buffer directly (simplified - in production you'd use a proper upload method)
          const response = await fetch(uploadURL, {
            method: 'PUT',
            body: buffer,
            headers: {
              'Content-Type': attachment.mimeType || 'application/octet-stream',
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to upload attachment: ${response.statusText}`);
          }

          const fileURL = uploadURL.split('?')[0];

          // Set ACL policy
          const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(fileURL, {
            owner: config.userId,
            visibility: 'private',
          });

          // Categorize automatically
          const category = this.categorizeFile(attachment.filename, attachment.mimeType);

          // Create file record
          await storage.createOperationFile({
            operationId,
            folderId: null,
            name: attachment.filename,
            originalName: attachment.filename,
            mimeType: attachment.mimeType,
            size: attachment.size,
            objectPath,
            category,
            description: `Adjunto de correo: ${message.subject}`,
            tags: ['automatico', 'gmail'],
            uploadedBy: config.userId,
            uploadedVia: 'automation',
          });

          console.log(`[Automation] Processed attachment ${attachment.filename} for operation ${operationId}`);
        } catch (error) {
          console.error(`[Automation] Error processing attachment ${attachment.filename}:`, error);
        }
      }
    } catch (error) {
      console.error(`[Automation] Error processing email attachments:`, error);
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
