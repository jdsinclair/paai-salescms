import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { providers } from "@/lib/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const rows = await db
    .selectDistinct({ state: providers.state })
    .from(providers)
    .where(sql`${providers.state} IS NOT NULL AND ${providers.state} != ''`)
    .orderBy(providers.state);

  return NextResponse.json({ states: rows.map((r) => r.state) });
}
