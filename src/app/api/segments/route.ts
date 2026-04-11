import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { segments } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const allSegments = await db.select().from(segments);
  return NextResponse.json({
    segments: allSegments.map((s) => ({
      id: s.id,
      name: s.name,
      filters: s.filtersJson ? JSON.parse(s.filtersJson) : {},
      providerCount: s.providerCount,
      createdAt: s.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const body = await req.json();
  const { name, filters, providerCount } = body;
  const id = Date.now().toString(36);

  await db.insert(segments).values({
    id,
    name,
    filtersJson: JSON.stringify(filters),
    providerCount,
  });

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.delete(segments).where(eq(segments.id, id));
  return NextResponse.json({ ok: true });
}
