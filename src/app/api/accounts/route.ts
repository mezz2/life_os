import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const accounts = await db.account.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, institution: true, type: true },
  });
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const institution = String(body.institution ?? "").trim() || "Manual";
  const type = String(body.type ?? "").trim() || "transaction";

  if (!name) return NextResponse.json({ error: "Account name is required." }, { status: 400 });

  const account = await db.account.create({
    data: { name, institution, type },
    select: { id: true, name: true, institution: true, type: true },
  });

  return NextResponse.json({ account });
}
