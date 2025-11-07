import { google } from 'googleapis';
import { storage } from './storage';
import type { GmailAccount } from '@shared/schema';
import * as calendarSync from './calendar-sync';
import { AttachmentAnalyzer } from './attachment-analyzer';
import { backblazeStorage } from './backblazeStorage';
import { SpamFilter } from './spam-filter';

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
              let extractedText: string | null = null;
              let b2Key: string | undefined;
              let fileHash: string | undefined;

              // Download and store attachment (in Backblaze if configured)
              let attachmentDataBase64: string | null = null;
              
              try {
                const attachmentData = await getAttachmentData(
                  account, 
                  message.id, 
                  part.body.attachmentId
                );
                
                if (attachmentData) {
                  attachmentDataBase64 = attachmentData; // Keep for fallback storage
                  const buffer = Buffer.from(attachmentData, 'base64');
                  
                  // Analyze for text extraction if applicable
                  const shouldAnalyze = 
                    mimeType === 'application/pdf' || 
                    mimeType.startsWith('image/');

                  if (shouldAnalyze && part.body.size && part.body.size < 10 * 1024 * 1024) {
                    try {
                      extractedText = await AttachmentAnalyzer.analyzeAttachment(
                        mimeType, 
                        attachmentData
                      );
                      console.log(`Extracted ${extractedText.length} characters from ${part.filename}`);
                    } catch (error) {
                      console.error(`Error analyzing attachment ${part.filename}:`, error);
                    }
                  }

                  // Upload to Backblaze B2 with deduplication (if configured)
                  if (backblazeStorage.isAvailable()) {
                    try {
                      const uploadResult = await backblazeStorage.uploadAttachment(
                        buffer,
                        part.filename,
                        mimeType,
                        createdMessage.id,
                        part.body.attachmentId,
                        extractedText || undefined
                      );

                      b2Key = uploadResult.fileKey;
                      fileHash = uploadResult.fileHash;

                      if (uploadResult.isDuplicate) {
                        console.log(`Attachment ${part.filename} already exists in Backblaze (deduplicated)`);
                      } else {
                        console.log(`Stored new attachment ${part.filename} in Backblaze`);
                      }
                    } catch (error) {
                      console.error(`Error storing attachment ${part.filename} in Backblaze:`, error);
                      // Continue without Backblaze if there's an error
                    }
                  }
                }
              } catch (error) {
                console.error(`Error downloading attachment ${part.filename}:`, error);
                // Continue without attachment data if there's an error
              }

              await storage.createGmailAttachment({
                gmailMessageId: createdMessage.id,
                attachmentId: part.body.attachmentId,
                filename: part.filename,
                mimeType,
                size: part.body.size || 0,
                data: b2Key ? null : attachmentDataBase64, // Fall back to DB if B2 not configured
                b2Key: b2Key || null,
                fileHash: fileHash || null,
                isInline: part.headers?.some((h: {name?: string | null; value?: string | null}) => 
                  h.name === 'Content-Disposition' && h.value?.includes('inline')
                ) || false,
                extractedText: extractedText && !b2Key ? extractedText : null, // Fall back to DB if B2 not configured
                extractedTextB2Key: extractedText && b2Key ? `emails/attachments/extracted-text/${fileHash}` : null,
              });
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
