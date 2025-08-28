import { google } from 'googleapis';

/**
 *
 * @param {Object} user 
 * @param {number} maxResults 
 */
export async function getCalendarEvents(user, maxResults = 5) {
  if (!user?.googleRefreshToken) return [];
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  const missing = [
    ['GOOGLE_CLIENT_ID', GOOGLE_CLIENT_ID],
    ['GOOGLE_CLIENT_SECRET', GOOGLE_CLIENT_SECRET],
    ['GOOGLE_REDIRECT_URI', GOOGLE_REDIRECT_URI]
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.warn('Missing Google OAuth env vars:', missing.join(', '));
    return [];
  }
  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  oAuth2Client.setCredentials({ refresh_token: user.googleRefreshToken });

  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  const now = new Date().toISOString();
  try {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime'
    });
    return (res.data.items || []).map(event => ({
      id: event.id,
      title: event.summary,
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location || null
    }));
  } catch (err) {
    console.error('Google Calendar fetch failed:', err.message);
    return [];
  }
}

export default { getCalendarEvents };
