import { storage } from './storage';
import * as gmailSync from './gmail-sync';

let syncInterval: NodeJS.Timeout | null = null;

/**
 * Recupera cuentas atascadas en estado 'syncing'
 * Una cuenta se considera atascada si lleva más de 30 minutos en estado 'syncing'
 */
async function recoverStuckAccounts() {
  try {
    const allUsers = await storage.getAllUsers();
    const allAccounts: any[] = [];
    
    for (const user of allUsers) {
      const accounts = await storage.getAllGmailAccounts(user.id);
      allAccounts.push(...accounts);
    }

    const stuckAccounts = allAccounts.filter(acc => {
      if (acc.syncStatus !== 'syncing') return false;
      
      // Si no hay lastSyncAt, considerarla atascada
      if (!acc.lastSyncAt) return true;
      
      // Verificar si lleva más de 30 minutos en 'syncing'
      const lastSyncTime = new Date(acc.lastSyncAt).getTime();
      const now = Date.now();
      const thirtyMinutesAgo = now - (30 * 60 * 1000);
      
      return lastSyncTime < thirtyMinutesAgo;
    });

    if (stuckAccounts.length > 0) {
      console.log(`[Gmail Auto-Sync] Found ${stuckAccounts.length} stuck account(s), resetting...`);
      
      for (const account of stuckAccounts) {
        await storage.updateGmailAccount(account.id, {
          syncStatus: 'active',
          errorMessage: 'Recovered from stuck syncing state'
        });
        console.log(`[Gmail Auto-Sync] Reset account ${account.email} from 'syncing' to 'active'`);
      }
    }
  } catch (error) {
    console.error('[Gmail Auto-Sync] Error recovering stuck accounts:', error);
  }
}

/**
 * Sincroniza automáticamente todas las cuentas Gmail habilitadas
 */
async function syncAllGmailAccounts() {
  try {
    // Primero, recuperar cuentas atascadas
    await recoverStuckAccounts();
    
    // Obtener todas las cuentas habilitadas de todos los usuarios
    const allUsers = await storage.getAllUsers();
    
    const allAccounts: any[] = [];
    for (const user of allUsers) {
      const accounts = await storage.getAllGmailAccounts(user.id);
      allAccounts.push(...accounts.filter(acc => acc.syncEnabled));
    }

    if (allAccounts.length === 0) {
      console.log('[Gmail Auto-Sync] No enabled accounts found');
      return;
    }

    console.log(`[Gmail Auto-Sync] Starting sync for ${allAccounts.length} account(s)`);

    // Sincronizar cada cuenta
    for (const account of allAccounts) {
      try {
        // Solo sincronizar si no está actualmente sincronizando
        if (account.syncStatus === 'syncing') {
          console.log(`[Gmail Auto-Sync] Account ${account.email} is already syncing, skipping...`);
          continue;
        }

        console.log(`[Gmail Auto-Sync] Syncing account: ${account.email}`);
        await gmailSync.startSync(account.id);

        // Pequeña pausa entre cuentas para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`[Gmail Auto-Sync] Error syncing account ${account.email}:`, error);
      }
    }

    console.log('[Gmail Auto-Sync] Sync cycle completed');

    // Link messages to operations after sync
    try {
      console.log('[Gmail Auto-Sync] Linking messages to operations...');
      await storage.linkMessagesToOperations();
    } catch (error) {
      console.error('[Gmail Auto-Sync] Error linking messages:', error);
    }

  } catch (error) {
    console.error('[Gmail Auto-Sync] Error in sync cycle:', error);
  }
}

/**
 * Inicia el servicio de sincronización automática de Gmail
 * @param intervalMinutes Intervalo en minutos (por defecto 10 minutos)
 */
export function startAutoGmailSync(intervalMinutes: number = 10) {
  if (syncInterval) {
    console.log('[Gmail Auto-Sync] Service already running');
    return;
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  
  // Ejecutar inmediatamente al inicio
  syncAllGmailAccounts();
  
  // Luego ejecutar periódicamente
  syncInterval = setInterval(syncAllGmailAccounts, intervalMs);
  
  console.log(`[Gmail Auto-Sync] Service started (interval: ${intervalMinutes} minutes)`);
}

/**
 * Detiene el servicio de sincronización automática
 */
export function stopAutoGmailSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[Gmail Auto-Sync] Service stopped');
  }
}
