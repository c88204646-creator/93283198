import { google } from 'googleapis';
import { storage } from './storage';
import type { GmailAccount } from '@shared/schema';
import * as calendarSync from './calendar-sync';
import { AttachmentAnalyzer } from './attachment-analyzer';
import { backblazeStorage } from './backblazeStorage';
import { SpamFilter } from './spam-filter';
import { AttachmentFilter } from './attachment-filter';

// Construir la URL de redirección automáticamente
function getRedirectUri(): string {
  const redirectPath = process.env.GOOGLE_REDIRECT_URI || '/api/gmail/oauth/callback';
  
  // Si GOOGLE_REDIRECT_URI ya es una URL completa, usarla tal cual
  if (redirectPath.startsWith('http://') || redirectPath.startsWith('https://')) {
    return redirectPath;
  }
  
  // Caso contrario, construir la URL completa usando REPLIT_DOMAINS
  const baseUrl = process.env.REPLIT_DOMAINS 
    ? `https://${process.env.REPLIT_DOMAINS}`
    : 'http://localhost:5000';
  
  // Asegurar que el path empiece con /
  const normalizedPath = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;
  
  return `${baseUrl}${normalizedPath}`;
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  getRedirectUri()
);

export function getAuthUrl(userId: string): string {
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/calendar', // Acceso completo a Google Calendar
    ],
    state,
    prompt: 'consent',
  });
}

export async function handleOAuthCallback(code: string, userId: string, syncFromDate: Date) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const profile = await gmail.users.getProfile({ userId: 'me' });

  if (!tokens.refresh_token || !tokens.access_token || !tokens.expiry_date) {
    throw new Error('Invalid tokens received from Google');
  }

  const account = await storage.createGmailAccount({
    userId,
    email: profile.data.emailAddress!,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    tokenExpiry: new Date(tokens.expiry_date),
    syncFromDate,
    syncEnabled: true,
  });

  // Iniciar sincronización de Gmail y Calendar
  startSync(account.id);
  calendarSync.syncCalendarEvents(account.id).catch(err => {
    console.error('Error syncing calendar on OAuth callback:', err);
  });

  return account;
}

export async function refreshAccessToken(account: GmailAccount) {
  oauth2Client.setCredentials({
    refresh_token: account.refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  if (!credentials.access_token || !credentials.expiry_date) {
    throw new Error('Failed to refresh access token');
  }

  await storage.updateGmailAccount(account.id, {
    accessToken: credentials.access_token,
    tokenExpiry: new Date(credentials.expiry_date),
  });

  return credentials.access_token;
}

async function getValidAccessToken(account: GmailAccount): Promise<string> {
  if (new Date() >= new Date(account.tokenExpiry)) {
    return await refreshAccessToken(account);
  }
  return account.accessToken;
}

export async function startSync(accountId: string) {
  try {
    const account = await storage.getGmailAccount(accountId);
    if (!account || !account.syncEnabled) return;

    await storage.updateGmailAccount(accountId, {
      syncStatus: 'syncing',
      errorMessage: null,
    });

    const accessToken = await getValidAccessToken(account);
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const after = Math.floor(new Date(account.syncFromDate).getTime() / 1000);
    const query = `after:${after}`;

    let pageToken: string | undefined;
    let syncedCount = 0;
    let filteredSpamCount = 0;
    let totalProcessed = 0;

    console.log(`Starting sync for account ${accountId} from date ${account.syncFromDate}`);

    do {
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 500, // Aumentar a 500 mensajes por página
        pageToken,
      });

      const messages = response.data.messages || [];
      totalProcessed += messages.length;

      console.log(`Processing ${messages.length} messages (total processed: ${totalProcessed})`);

      for (const message of messages) {
        if (!message.id) continue;

        const existing = await storage.getGmailMessageByMessageId(message.id);
        if (existing) {
          console.log(`Message ${message.id} already exists, skipping...`);
          continue;
        }

        const fullMessage = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full',
        });

        const headers = fullMessage.data.payload?.headers || [];
        const getHeader = (name: string) => headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

        const subject = getHeader('subject');
        const from = getHeader('from');
        const to = getHeader('to');
        const cc = getHeader('cc');
        const bcc = getHeader('bcc');
        const date = fullMessage.data.internalDate ? new Date(parseInt(fullMessage.data.internalDate)) : new Date();

        const fromMatch = from.match(/<(.+?)>/) || from.match(/(.+)/);
        const fromEmail = fromMatch ? fromMatch[1].trim() : from;
        const fromName = from.replace(/<.+>/, '').trim() || fromEmail;

        const toEmails = to.split(',').map((e: string) => {
          const match = e.match(/<(.+?)>/) || e.match(/(.+)/);
          return match ? match[1].trim() : e.trim();
        }).filter((e: string) => e);

        const ccEmails = cc ? cc.split(',').map((e: string) => {
          const match = e.match(/<(.+?)>/) || e.match(/(.+)/);
          return match ? match[1].trim() : e.trim();
        }).filter((e: string) => e) : [];

        const bccEmails = bcc ? bcc.split(',').map((e: string) => {
          const match = e.match(/<(.+?)>/) || e.match(/(.+)/);
          return match ? match[1].trim() : e.trim();
        }).filter((e: string) => e) : [];

        let bodyText = '';
        let bodyHtml = '';

        const extractBody = (part: any): void => {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.mimeType === 'text/html' && part.body?.data) {
            bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
          }
          if (part.parts) {
            part.parts.forEach(extractBody);
          }
        };

        if (fullMessage.data.payload) {
          extractBody(fullMessage.data.payload);
        }

        const hasAttachments = (fullMessage.data.payload?.parts || []).some(
          (part: any) => part.filename && part.body?.attachmentId
        );

        const labels = fullMessage.data.labelIds || [];
        const isRead = !labels.includes('UNREAD');
        const isStarred = labels.includes('STARRED');
        const isImportant = labels.includes('IMPORTANT');

        // Aplicar filtro de spam inteligente
        const spamCheck = SpamFilter.getFilterStats({
          fromEmail,
          fromName,
          subject,
          bodyText,
          bodyHtml,
          labels,
        });

        // Si es spam, saltar este correo (pero registrar la acción)
        if (spamCheck.isSpam) {
          filteredSpamCount++;
          console.log(`[SPAM FILTERED] ${fromEmail} - "${subject}" | Reason: ${spamCheck.reason} (Confidence: ${spamCheck.confidence})`);
          continue; // No guardar este correo
        }

        // Store email body in Backblaze B2 (if configured)
        let bodyTextB2Key: string | undefined;
        let bodyHtmlB2Key: string | undefined;

        if (backblazeStorage.isAvailable()) {
          try {
            const b2Keys = await backblazeStorage.uploadEmailBody(
              message.id,
              bodyText || null,
              bodyHtml || null
            );
            bodyTextB2Key = b2Keys.textKey;
            bodyHtmlB2Key = b2Keys.htmlKey;
            console.log(`Stored email body in Backblaze: ${message.id}`);
          } catch (error) {
            console.error(`Error storing email body in Backblaze for ${message.id}:`, error);
            // Continue without Backblaze if there's an error
          }
        }

        const createdMessage = await storage.createGmailMessage({
          gmailAccountId: accountId,
          messageId: message.id,
          threadId: fullMessage.data.threadId || message.id,
          subject,
          fromEmail,
          fromName,
          toEmails,
          ccEmails: ccEmails.length > 0 ? ccEmails : null,
          bccEmails: bccEmails.length > 0 ? bccEmails : null,
          date,
          snippet: fullMessage.data.snippet || null,
          bodyText: bodyTextB2Key ? null : (bodyText || null), // Fall back to DB if B2 not configured
          bodyHtml: bodyHtmlB2Key ? null : (bodyHtml || null), // Fall back to DB if B2 not configured
          bodyTextB2Key: bodyTextB2Key || null,
          bodyHtmlB2Key: bodyHtmlB2Key || null,
          labels: labels.length > 0 ? labels : null,
          hasAttachments,
          isRead,
          isStarred,
          isImportant,
          internalDate: fullMessage.data.internalDate || null,
        });

        if (hasAttachments && fullMessage.data.payload?.parts) {
          for (const part of fullMessage.data.payload.parts) {
            if (part.filename && part.body?.attachmentId) {
              const mimeType = part.mimeType || 'application/octet-stream';
              
              // Detectar si es inline antes de procesar
              const isInline = part.headers?.some((h: {name?: string | null; value?: string | null}) => 
                h.name === 'Content-Disposition' && h.value?.includes('inline')
              ) || false;
              
              // Filtrar attachments innecesarios (firmas, logos inline, tracking pixels)
              const shouldIgnore = AttachmentFilter.shouldIgnoreAttachment({
                filename: part.filename,
                mimeType,
                size: part.body.size || 0,
                isInline
              });
              
              if (shouldIgnore) {
                // Saltar este attachment - no descargarlo ni almacenarlo
                continue;
              }
              
              // 🎯 LAZY LOADING: Solo guardar metadata, NO descargar archivos aún
              // Los archivos se descargarán cuando:
              // 1. Email se vincule a operación (automático)
              // 2. Automatizaciones lo necesiten (Facturama, pagos, etc.)
              // 3. Usuario haga clic en el archivo (on-demand)
              
              await storage.createGmailAttachment({
                gmailMessageId: createdMessage.id,
                attachmentId: part.body.attachmentId,
                filename: part.filename,
                mimeType,
                size: part.body.size || 0,
                data: null, // No descargar en sync - lazy loading
                b2Key: null, // Se llenará cuando se descargue
                fileHash: null, // Se llenará cuando se descargue
                isInline,
                extractedText: null, // Se llenará cuando se descargue
                extractedTextB2Key: null, // Se llenará cuando se descargue
              });
              
              console.log(`📋 Metadata saved for attachment: ${part.filename} (${(part.body.size || 0) / 1024} KB) - lazy loading enabled`);
            }
          }
        }

        syncedCount++;
      }

      pageToken = response.data.nextPageToken || undefined;

      // Actualizar progreso cada página procesada
      console.log(`Synced ${syncedCount} new messages so far for account ${accountId}`);

      // Pequeña pausa para evitar rate limiting de Google
      if (pageToken) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

    } while (pageToken);

    await storage.updateGmailAccount(accountId, {
      syncStatus: 'idle',
      lastSyncDate: new Date(),
      errorMessage: null,
    });

    console.log(`Sync completed for account ${accountId}. Total processed: ${totalProcessed} messages, New messages synced: ${syncedCount}, Spam filtered: ${filteredSpamCount}`);

  } catch (error: any) {
    console.error(`Sync error for account ${accountId}:`, error);
    await storage.updateGmailAccount(accountId, {
      syncStatus: 'error',
      errorMessage: error.message || 'Unknown error',
    });
  }
}

/**
 * 🎯 LAZY LOADING: Descarga y procesa un archivo adjunto cuando realmente se necesita
 * Se usa en:
 * 1. Vinculación de email a operación (automático)
 * 2. Automatizaciones (Facturama, pagos, etc.)
 * 3. Usuario hace clic en archivo (on-demand)
 */
export async function downloadAndProcessAttachment(
  gmailAttachmentId: string
): Promise<void> {
  try {
    // 1. Obtener metadata del attachment
    const attachment = await storage.getGmailAttachment(gmailAttachmentId);
    if (!attachment) {
      throw new Error(`Attachment ${gmailAttachmentId} not found`);
    }

    // 2. Si ya está descargado, no hacer nada
    if (attachment.b2Key || attachment.data) {
      console.log(`✅ Attachment ${attachment.filename} already downloaded, skipping`);
      return;
    }

    // 3. Obtener el mensaje para acceder a la cuenta Gmail
    const message = await storage.getGmailMessage(attachment.gmailMessageId);
    if (!message) {
      throw new Error(`Message not found for attachment ${gmailAttachmentId}`);
    }

    // 4. Obtener la cuenta Gmail
    const account = await storage.getGmailAccount(message.gmailAccountId);
    if (!account) {
      throw new Error(`Gmail account not found for message ${message.id}`);
    }

    console.log(`📥 Downloading attachment: ${attachment.filename} (${attachment.size / 1024} KB)`);

    // 5. Descargar el archivo desde Gmail
    const attachmentData = await getAttachmentData(
      account,
      message.messageId,
      attachment.attachmentId
    );

    if (!attachmentData) {
      throw new Error(`Failed to download attachment ${attachment.filename}`);
    }

    const buffer = Buffer.from(attachmentData, 'base64');
    let extractedText: string | null = null;
    let b2Key: string | undefined;
    let fileHash: string | undefined;

    // 6. Extraer texto si es PDF o imagen
    const shouldAnalyze =
      attachment.mimeType === 'application/pdf' ||
      attachment.mimeType.startsWith('image/');

    if (shouldAnalyze && attachment.size < 10 * 1024 * 1024) {
      try {
        extractedText = await AttachmentAnalyzer.analyzeAttachment(
          attachment.mimeType,
          attachmentData
        );
        console.log(`📝 Extracted ${extractedText.length} characters from ${attachment.filename}`);
      } catch (error) {
        console.error(`Error analyzing attachment ${attachment.filename}:`, error);
      }
    }

    // 7. Subir a Backblaze B2 con deduplicación
    if (backblazeStorage.isAvailable()) {
      try {
        const uploadResult = await backblazeStorage.uploadAttachment(
          buffer,
          attachment.filename,
          attachment.mimeType,
          message.id,
          attachment.attachmentId,
          extractedText || undefined
        );

        b2Key = uploadResult.fileKey;
        fileHash = uploadResult.fileHash;

        if (uploadResult.isDuplicate) {
          console.log(`♻️ Attachment ${attachment.filename} deduplicated in Backblaze`);
        } else {
          console.log(`✅ Stored ${attachment.filename} in Backblaze`);
        }
      } catch (error) {
        console.error(`Error storing attachment ${attachment.filename} in Backblaze:`, error);
        // Continue without Backblaze if there's an error
      }
    }

    // 8. Actualizar metadata del attachment con los datos descargados
    await storage.updateGmailAttachment(gmailAttachmentId, {
      data: b2Key ? null : attachmentData, // Fall back to DB if B2 not configured
      b2Key: b2Key || null,
      fileHash: fileHash || null,
      extractedText: extractedText && !b2Key ? extractedText : null,
      extractedTextB2Key: extractedText && b2Key ? `emails/attachments/extracted-text/${fileHash}` : null,
    });

    console.log(`✅ Successfully processed attachment: ${attachment.filename}`);
  } catch (error) {
    console.error(`Error in downloadAndProcessAttachment:`, error);
    throw error;
  }
}

/**
 * 🎯 Descarga y procesa TODOS los archivos de un mensaje (cuando se vincula a operación)
 */
export async function downloadMessageAttachments(gmailMessageId: string): Promise<void> {
  try {
    const attachments = await storage.getGmailAttachments(gmailMessageId);
    
    console.log(`📥 Downloading ${attachments.length} attachments for message ${gmailMessageId}`);
    
    // Descargar todos los attachments en paralelo
    await Promise.all(
      attachments.map(att => downloadAndProcessAttachment(att.id))
    );
    
    console.log(`✅ Successfully downloaded all attachments for message ${gmailMessageId}`);
  } catch (error) {
    console.error(`Error downloading message attachments:`, error);
    throw error;
  }
}

export async function getAttachmentData(account: GmailAccount, messageId: string, attachmentId: string): Promise<string> {
  const accessToken = await getValidAccessToken(account);
  oauth2Client.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  const response = await gmail.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });

  return response.data.data || '';
}
