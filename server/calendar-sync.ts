import { google } from 'googleapis';
import { storage } from './storage';
import type { GmailAccount, CalendarEvent } from '@shared/schema';

interface GoogleAttendee {
  email?: string;
  displayName?: string;
  responseStatus?: string;
}

interface GoogleReminder {
  method?: string;
  minutes?: number;
}

interface GoogleEventDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

interface GoogleEvent {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  attendees?: GoogleAttendee[];
  status?: string;
  visibility?: string;
  reminders?: {
    useDefault?: boolean;
    overrides?: GoogleReminder[];
  };
  recurrence?: string[];
  colorId?: string;
  created?: string;
  updated?: string;
}

export async function getCalendarOAuthClient(account: GmailAccount) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });

  return oauth2Client;
}

export async function syncCalendarEvents(accountId: string) {
  try {
    const account = await storage.getGmailAccount(accountId);
    if (!account) {
      console.error('Account not found:', accountId);
      throw new Error('Account not found');
    }

    if (!account.accessToken || !account.refreshToken) {
      console.error('Invalid account credentials:', accountId);
      throw new Error('Invalid account credentials');
    }

    const oauth2Client = await getCalendarOAuthClient(account);
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Obtener el calendario principal del usuario
    const calendarList = await calendar.calendarList.list();
    const primaryCalendar = calendarList.data.items?.find(cal => cal.primary);

    if (!primaryCalendar?.id) {
      console.error('Primary calendar not found');
      return;
    }

    // Sincronizar eventos desde la fecha configurada
    const timeMin = account.syncFromDate.toISOString();
    const events = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      maxResults: 2500,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const googleEvents = events.data.items || [];
    console.log(`Found ${googleEvents.length} events for account ${account.email}`);

    for (const event of googleEvents) {
      await syncSingleEvent(accountId, primaryCalendar.id, event);
    }

    console.log(`Synced ${googleEvents.length} events for account ${account.email}`);
  } catch (error: any) {
    console.error('Error syncing calendar events:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status
    });
    throw new Error(`Failed to sync calendar: ${error.message || 'Unknown error'}`);
  }
}

async function syncSingleEvent(accountId: string, calendarId: string, event: GoogleEvent) {
  if (!event.id || !event.start || !event.end) {
    return;
  }

  // Determinar si es evento de día completo
  const isAllDay = !!(event.start.date && event.end.date);

  // Convertir fechas
  const startTime = new Date(event.start.dateTime || event.start.date || '');
  const endTime = new Date(event.end.dateTime || event.end.date || '');

  // Preparar attendees
  const attendees = event.attendees?.map(att => ({
    email: att.email || '',
    name: att.displayName || '',
    responseStatus: att.responseStatus || 'needsAction',
  })) || [];

  // Preparar reminders
  const reminders = event.reminders?.overrides?.map(rem => ({
    method: rem.method || 'popup',
    minutes: rem.minutes || 10,
  })) || [];

  // Verificar si el evento ya existe
  const existingEvents = await storage.getCalendarEventsByGoogleId(event.id);

  if (existingEvents.length > 0) {
    // Actualizar evento existente
    await storage.updateCalendarEvent(existingEvents[0].id, {
      title: event.summary || 'Sin título',
      description: event.description,
      location: event.location,
      startTime,
      endTime,
      isAllDay,
      attendees: attendees.length > 0 ? attendees : null,
      status: event.status || 'confirmed',
      visibility: event.visibility || 'default',
      reminders: reminders.length > 0 ? reminders : null,
      recurrence: event.recurrence || null,
      color: event.colorId,
      lastSyncedAt: new Date(),
    });
  } else {
    // Crear nuevo evento
    await storage.createCalendarEvent({
      gmailAccountId: accountId,
      eventId: event.id,
      calendarId,
      title: event.summary || 'Sin título',
      description: event.description,
      location: event.location,
      startTime,
      endTime,
      isAllDay,
      attendees: attendees.length > 0 ? attendees : null,
      status: event.status || 'confirmed',
      visibility: event.visibility || 'default',
      reminders: reminders.length > 0 ? reminders : null,
      recurrence: event.recurrence || null,
      color: event.colorId,
      source: 'google',
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
    });
  }
}

export async function createGoogleCalendarEvent(
  accountId: string,
  eventData: {
    title: string;
    description?: string;
    location?: string;
    startTime: Date;
    endTime: Date;
    isAllDay: boolean;
    attendees?: any[];
    reminders?: any[];
  }
) {
  const account = await storage.getGmailAccount(accountId);
  if (!account) {
    throw new Error('Account not found');
  }

  const oauth2Client = await getCalendarOAuthClient(account);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const eventResource: any = {
    summary: eventData.title,
    description: eventData.description,
    location: eventData.location,
    start: eventData.isAllDay
      ? { date: eventData.startTime.toISOString().split('T')[0] }
      : { dateTime: eventData.startTime.toISOString() },
    end: eventData.isAllDay
      ? { date: eventData.endTime.toISOString().split('T')[0] }
      : { dateTime: eventData.endTime.toISOString() },
  };

  if (eventData.attendees && eventData.attendees.length > 0) {
    eventResource.attendees = eventData.attendees.map(att => ({ email: att.email }));
  }

  if (eventData.reminders && eventData.reminders.length > 0) {
    eventResource.reminders = {
      useDefault: false,
      overrides: eventData.reminders,
    };
  }

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: eventResource,
  });

  // Guardar en base de datos local
  const event = await storage.createCalendarEvent({
    gmailAccountId: accountId,
    eventId: response.data.id!,
    calendarId: 'primary',
    title: eventData.title,
    description: eventData.description,
    location: eventData.location,
    startTime: eventData.startTime,
    endTime: eventData.endTime,
    isAllDay: eventData.isAllDay,
    attendees: eventData.attendees,
    status: 'confirmed',
    visibility: 'default',
    reminders: eventData.reminders,
    source: 'google',
    syncStatus: 'synced',
    lastSyncedAt: new Date(),
  });

  return event;
}

export async function deleteGoogleCalendarEvent(eventId: string) {
  const event = await storage.getCalendarEvent(eventId);
  if (!event || !event.gmailAccountId || !event.eventId) {
    throw new Error('Event not found or not synced with Google');
  }

  const account = await storage.getGmailAccount(event.gmailAccountId);
  if (!account) {
    throw new Error('Account not found');
  }

  const oauth2Client = await getCalendarOAuthClient(account);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  await calendar.events.delete({
    calendarId: event.calendarId || 'primary',
    eventId: event.eventId,
  });

  await storage.deleteCalendarEvent(eventId);
}

export async function updateGoogleCalendarEvent(
  eventId: string,
  eventData: Partial<{
    title: string;
    description: string;
    location: string;
    startTime: Date;
    endTime: Date;
    isAllDay: boolean;
    attendees: any[];
    reminders: any[];
  }>
) {
  const event = await storage.getCalendarEvent(eventId);
  if (!event || !event.gmailAccountId || !event.eventId) {
    throw new Error('Event not found or not synced with Google');
  }

  const account = await storage.getGmailAccount(event.gmailAccountId);
  if (!account) {
    throw new Error('Account not found');
  }

  const oauth2Client = await getCalendarOAuthClient(account);
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const eventResource: any = {};

  if (eventData.title !== undefined) eventResource.summary = eventData.title;
  if (eventData.description !== undefined) eventResource.description = eventData.description;
  if (eventData.location !== undefined) eventResource.location = eventData.location;
  
  if (eventData.startTime && eventData.isAllDay !== undefined) {
    eventResource.start = eventData.isAllDay
      ? { date: eventData.startTime.toISOString().split('T')[0] }
      : { dateTime: eventData.startTime.toISOString() };
  }
  
  if (eventData.endTime && eventData.isAllDay !== undefined) {
    eventResource.end = eventData.isAllDay
      ? { date: eventData.endTime.toISOString().split('T')[0] }
      : { dateTime: eventData.endTime.toISOString() };
  }

  if (eventData.attendees !== undefined) {
    eventResource.attendees = eventData.attendees.map(att => ({ email: att.email }));
  }

  if (eventData.reminders !== undefined) {
    eventResource.reminders = {
      useDefault: false,
      overrides: eventData.reminders,
    };
  }

  await calendar.events.patch({
    calendarId: event.calendarId || 'primary',
    eventId: event.eventId,
    requestBody: eventResource,
  });

  await storage.updateCalendarEvent(eventId, {
    ...eventData,
    lastSyncedAt: new Date(),
    syncStatus: 'synced',
  });
}

// Iniciar sincronización automática cada 5 minutos
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutos

export function startAutoCalendarSync() {
  setInterval(async () => {
    try {
      const accounts = await storage.getAllGmailAccounts();
      for (const account of accounts) {
        if (account.syncEnabled && account.status === 'active') {
          await syncCalendarEvents(account.id);
        }
      }
    } catch (error) {
      console.error('Error in auto calendar sync:', error);
    }
  }, SYNC_INTERVAL);

  console.log('Auto calendar sync started (interval: 5 minutes)');
}
