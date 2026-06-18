import { NextRequest, NextResponse } from "next/server";
import { authUrl, isConfigured, disconnect } from "@/lib/google-calendar";

// GET → kick off the OAuth consent flow (redirect to Google).
export async function GET(req: NextRequest) {
  if (!isConfigured()) {
    const url = new URL("/calendar?error=not-configured", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.redirect(authUrl());
}

// DELETE → forget the stored grant locally. (Full revocation is done by the
// user at myaccount.google.com → Security → Third-party access.)
export async function DELETE() {
  await disconnect();
  return NextResponse.json({ ok: true });
}
