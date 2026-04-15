import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { segments, sendQueue } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const allSegments = await db.select().from(segments);

  // Get queue stats per segment
  const queueStats = await db.select({
    segmentId: sendQueue.segmentId,
    total: sql<number>`count(*)`,
    pending: sql<number>`count(*) FILTER (WHERE ${sendQueue.status} = 'pending')`,
    queued: sql<number>`count(*) FILTER (WHERE ${sendQueue.status} = 'queued')`,
    skipped: sql<number>`count(*) FILTER (WHERE ${sendQueue.status} = 'skipped')`,
    sent: sql<number>`count(*) FILTER (WHERE ${sendQueue.status} = 'sent')`,
  }).from(sendQueue).groupBy(sendQueue.segmentId);

  const statsMap: Record<string, { total: number; pending: number; queued: number; skipped: number; sent: number }> = {};
  queueStats.forEach((s) => {
    statsMap[s.segmentId] = { total: Number(s.total), pending: Number(s.pending), queued: Number(s.queued), skipped: Number(s.skipped), sent: Number(s.sent) };
  });

  return NextResponse.json({
    segments: allSegments.map((s) => ({
      id: s.id,
      name: s.name,
      filters: s.filtersJson ? JSON.parse(s.filtersJson) : {},
      providerCount: s.providerCount,
      emailSubject: s.emailSubject,
      emailBody: s.emailBody,
      hasEmail: !!s.emailBody,
      queueStats: statsMap[s.id] || null,
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

// PATCH: update segment (email template, name, etc.)
export async function PATCH(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const body = await req.json();
  const { id, emailSubject, emailBody, name } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, string | null> = {};
  if (emailSubject !== undefined) updates.emailSubject = emailSubject;
  if (emailBody !== undefined) updates.emailBody = emailBody;
  if (name !== undefined) updates.name = name;

  await db.update(segments).set(updates).where(eq(segments.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.delete(sendQueue).where(eq(sendQueue.segmentId, id));
  await db.delete(segments).where(eq(segments.id, id));
  return NextResponse.json({ ok: true });
}
