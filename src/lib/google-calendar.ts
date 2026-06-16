// Google Calendar — server-side OAuth + read/write bridge.
//
// Trust model: the OAuth *app* credentials (client id/secret) come from .env.
// The *user grant* (offline refresh token) is stored in the single-row
// GoogleCalendarAuth table. The Next app is localhost-only, so neither secret is
// ever network-exposed. Scope is deliberately limited to calendar.events — the
// app can read/create/update/delete events and nothing else (no Gmail, Drive,
// or profile access).
//
// Everything here runs in the Node runtime only (never imported by client code).

import { google, calendar_v3 } from "googleapis";
import { db } from "./db";

// Use the OAuth2 client type as produced by `google.auth.OAuth2` — importing it
// from google-auth-library directly clashes with googleapis' bundled copy.
type OAuthClient = InstanceType<typeof google.auth.OAuth2>;

// Read+write of calendar events only. Nothing broader.
export const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

const AUTH_ID = "singleton";

export type GoogleEnv = { clientId: string; clientSecret: string; redirectUri: string };

// Throws a friendly error if the app credentials aren't configured yet.
export function googleEnv(): GoogleEnv {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/calendar/auth/callback";
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google Calendar isn't configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local.",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function isConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function baseClient(): OAuthClient {
  const { clientId, clientSecret, redirectUri } = googleEnv();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Consent URL — offline access + forced consent so Google returns a refresh
// token (it only does so on the first grant unless prompt=consent).
export function authUrl(): string {
  return baseClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });
}

// Exchange the callback code for tokens and persist the grant.
export async function exchangeCode(code: string): Promise<void> {
  const client = baseClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    // Happens if the user previously granted without revoking; ask them to
    // revoke at myaccount.google.com and reconnect so we get a fresh token.
    throw new Error(
      "Google didn't return a refresh token. Revoke LifeOS at myaccount.google.com → Security → Third-party access, then reconnect.",
    );
  }
  await db.googleCalendarAuth.upsert({
    where: { id: AUTH_ID },
    create: {
      id: AUTH_ID,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token ?? null,
      expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
    update: {
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token ?? null,
      expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    },
  });
}

export async function getConnection() {
  return db.googleCalendarAuth.findUnique({ where: { id: AUTH_ID } });
}

export async function disconnect(): Promise<void> {
  await db.googleCalendarAuth.deleteMany({});
}

// An OAuth2 client primed with the stored grant. Auto-persists any newly
// refreshed access token via the 'tokens' event. Throws if not connected.
async function authedClient(): Promise<{ client: OAuthClient; calendarId: string }> {
  const conn = await getConnection();
  if (!conn) throw new Error("Google Calendar isn't connected. Connect it from the Calendar page.");
  const client = baseClient();
  client.setCredentials({
    refresh_token: conn.refreshToken,
    access_token: conn.accessToken ?? undefined,
    expiry_date: conn.expiry ? conn.expiry.getTime() : undefined,
  });
  client.on("tokens", (t) => {
    void db.googleCalendarAuth
      .update({
        where: { id: AUTH_ID },
        data: {
          accessToken: t.access_token ?? conn.accessToken,
          expiry: t.expiry_date ? new Date(t.expiry_date) : conn.expiry,
          // Google only resends refresh_token rarely; keep the existing one.
          ...(t.refresh_token ? { refreshToken: t.refresh_token } : {}),
        },
      })
      .catch(() => {});
  });
  return { client, calendarId: conn.calendarId };
}

async function api(): Promise<{ cal: calendar_v3.Calendar; calendarId: string }> {
  const { client, calendarId } = await authedClient();
  return { cal: google.calendar({ version: "v3", auth: client }), calendarId };
}

// ---- shape shared with the local cache upsert ----
export type PulledEvent = {
  externalId: string;
  calendarId: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  allDay: boolean;
  raw: unknown;
};

function gEventToPulled(e: calendar_v3.Schema$Event, calendarId: string): PulledEvent | null {
  if (!e.id) return null;
  const allDay = !!e.start?.date && !e.start?.dateTime;
  const start = e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00.000Z` : null);
  const end = e.end?.dateTime ?? (e.end?.date ? `${e.end.date}T00:00:00.000Z` : null);
  if (!start || !end) return null;
  return {
    externalId: e.id,
    calendarId,
    title: (e.summary ?? "(untitled)").trim() || "(untitled)",
    start,
    end,
    allDay,
    raw: e,
  };
}

// Pull events in a window (defaults: 30 days back → 90 days ahead), expanding
// recurring events into instances so the cache matches what you see in Google.
export async function pullEvents(timeMin?: Date, timeMax?: Date): Promise<PulledEvent[]> {
  const { cal, calendarId } = await api();
  const min = timeMin ?? new Date(Date.now() - 30 * 86400_000);
  const max = timeMax ?? new Date(Date.now() + 90 * 86400_000);
  const out: PulledEvent[] = [];
  let pageToken: string | undefined;
  do {
    const res = await cal.events.list({
      calendarId,
      timeMin: min.toISOString(),
      timeMax: max.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500,
      pageToken,
      showDeleted: false,
    });
    for (const e of res.data.items ?? []) {
      if (e.status === "cancelled") continue;
      const p = gEventToPulled(e, calendarId);
      if (p) out.push(p);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

// ---- write-back ----
export type WriteEvent = { title: string; start: string; end: string; allDay: boolean };

function toGoogleBody(ev: WriteEvent): calendar_v3.Schema$Event {
  if (ev.allDay) {
    return {
      summary: ev.title,
      start: { date: ev.start.slice(0, 10) },
      end: { date: ev.end.slice(0, 10) },
    };
  }
  return {
    summary: ev.title,
    start: { dateTime: new Date(ev.start).toISOString() },
    end: { dateTime: new Date(ev.end).toISOString() },
  };
}

export async function pushCreate(ev: WriteEvent): Promise<string> {
  const { cal, calendarId } = await api();
  const res = await cal.events.insert({ calendarId, requestBody: toGoogleBody(ev) });
  if (!res.data.id) throw new Error("Google did not return an event id");
  return res.data.id;
}

export async function pushUpdate(externalId: string, ev: WriteEvent): Promise<void> {
  const { cal, calendarId } = await api();
  await cal.events.patch({ calendarId, eventId: externalId, requestBody: toGoogleBody(ev) });
}

export async function pushDelete(externalId: string): Promise<void> {
  const { cal, calendarId } = await api();
  await cal.events.delete({ calendarId, eventId: externalId }).catch((err: unknown) => {
    // 404/410 = already gone on Google; treat as success.
    const code = (err as { code?: number })?.code;
    if (code !== 404 && code !== 410) throw err;
  });
}
