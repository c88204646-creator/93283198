import { AutomationService } from './automation-service';
import { storage } from './storage';

async function forceFinancialDetection() {
  console.log('🚀 Forcing financial detection process...');
  
  const configs = await storage.getEnabledAutomationConfigs();
  if (configs.length === 0) {
    console.log('❌ No enabled automation configs found');
    return;
  }
  
  const config = configs[0];
  console.log(`✅ Found config with autoDetectPayments: ${config.autoDetectPayments}, autoDetectExpenses: ${config.autoDetectExpenses}`);
  
  const automationService = new AutomationService();
  
  console.log('⏳ Processing financial detection for all operations...');
  await (automationService as any).processFinancialDetectionForOperations(config);
  
  console.log('✅ Financial detection process completed!');
  console.log('💡 Check your notifications bell icon in the header for pending suggestions');
  
  process.exit(0);
}

forceFinancialDetection().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
