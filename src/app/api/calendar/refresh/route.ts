import { NextResponse } from "next/server";
import { pullEvents, getConnection } from "@/lib/google-calendar";
import { upsertEvents } from "@/lib/calendar-server";

// In-app "Refresh sync" — pulls events from the connected Google Calendar and
// updates the local cache. Local tagging is preserved by upsertEvents.

export async function POST() {
  const conn = await getConnection();
  if (!conn) {
    return NextResponse.json(
      { error: "Google Calendar isn't connected." },
      { status: 409 },
    );
  }
  try {
    const pulled = await pullEvents();
    const { added, updated } = await upsertEvents(pulled);
    return NextResponse.json({ ok: true, added, updated, pulled: pulled.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
