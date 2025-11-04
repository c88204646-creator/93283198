import { storage } from './storage';
import type { AutomationConfig, AutomationRule, GmailMessage } from '@shared/schema';

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
      
      for (const config of configs) {
        await this.processConfigAutomation(config);
      }
    } catch (error) {
      console.error('Error processing automations:', error);
    }
  }

  private async processConfigAutomation(config: AutomationConfig) {
    try {
      // Get enabled rules for this config, sorted by priority
      const rules = await storage.getAutomationRulesByConfig(config.id);
      const enabledRules = rules.filter(r => r.isEnabled).sort((a, b) => (b.priority || 0) - (a.priority || 0));

      if (enabledRules.length === 0) {
        return;
      }

      // Get selected Gmail accounts
      const accountIds = (config.selectedGmailAccounts as string[]) || [];
      if (accountIds.length === 0) {
        return;
      }

      // Get unprocessed messages from selected accounts
      const messages = await storage.getUnprocessedMessages(accountIds, config.lastProcessedAt || new Date(0));

      for (const message of messages) {
        await this.processMessage(message, enabledRules, config);
      }

      // Update last processed timestamp
      await storage.updateAutomationConfig(config.id, {
        lastProcessedAt: new Date(),
      });
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
}

// Export singleton instance
export const automationService = new AutomationService();

// Auto-start function for background processing
export function startAutomationService() {
  automationService.start();
}
