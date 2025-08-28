
import { google } from 'googleapis';

class CalendarError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'CalendarError';
    this.status = status;
    this.data = data;
  }
}

function normalizeEvent(e) {
  if (!e) return null;
  return {
    id: e.id,
    status: e.status,
    summary: e.summary,
    description: e.description,
    start: e.start?.dateTime || e.start?.date || null,
    end: e.end?.dateTime || e.end?.date || null,
    created: e.created,
    updated: e.updated,
    location: e.location || null,
    attendees: (e.attendees || []).map(a => ({ email: a.email, responseStatus: a.responseStatus })),
    organizer: e.organizer?.email,
    hangoutLink: e.hangoutLink || null
  };
}

export async function listEvents(auth, { calendarId = 'primary', maxResults = 10, timeMin, timeMax, singleEvents = true, orderBy = 'startTime' } = {}) {
  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.list({
      calendarId,
      timeMin: timeMin || new Date().toISOString(),
      timeMax,
      maxResults,
      singleEvents,
      orderBy
    });
    return (res.data.items || []).map(normalizeEvent);
  } catch (err) {
    console.error('Calendar listEvents error:', err.message);
    throw new CalendarError('Failed to fetch calendar events', err.response?.status, err.response?.data);
  }
}

export async function getUpcomingEvents(auth, opts = {}) {
  return listEvents(auth, opts);
}

export default { listEvents, getUpcomingEvents };
