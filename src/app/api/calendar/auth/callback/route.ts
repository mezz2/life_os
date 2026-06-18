import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/google-calendar";

// Google redirects here after consent. Exchange the code for tokens, persist
// the grant, then bounce back to the calendar page.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error");
  if (err || !code) {
    const url = new URL(`/calendar?error=${encodeURIComponent(err ?? "no-code")}`, req.url);
    return NextResponse.redirect(url);
  }
  try {
    await exchangeCode(code);
    return NextResponse.redirect(new URL("/calendar?connected=1", req.url));
  } catch (e) {
    const message = e instanceof Error ? e.message : "auth-failed";
    return NextResponse.redirect(new URL(`/calendar?error=${encodeURIComponent(message)}`, req.url));
  }
}
