import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendQueue } from "@/lib/schema";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET: get queue items for a segment
export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const segmentId = req.nextUrl.searchParams.get("segmentId");
  if (!segmentId) return NextResponse.json({ error: "segmentId required" }, { status: 400 });

  const status = req.nextUrl.searchParams.get("status") || "pending";

  const items = await db.select().from(sendQueue)
    .where(and(eq(sendQueue.segmentId, segmentId), eq(sendQueue.status, status)))
    .orderBy(sendQueue.createdAt);

  return NextResponse.json({ items });
}

// POST: add items to queue (bulk)
export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const body = await req.json();
  const { items } = body as { items: { segmentId: string; npi: string; emailTo: string; emailSubject: string; emailBody: string }[] };

  if (!items || items.length === 0) return NextResponse.json({ error: "No items" }, { status: 400 });

  const BATCH = 100;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH).map((item) => ({
      id: `${item.segmentId}-${item.npi}-${Date.now().toString(36)}`,
      segmentId: item.segmentId,
      npi: item.npi,
      emailTo: item.emailTo,
      emailSubject: item.emailSubject,
      emailBody: item.emailBody,
      status: "pending",
    }));
    await db.insert(sendQueue).values(batch).onConflictDoNothing();
  }

  return NextResponse.json({ ok: true, queued: items.length });
}

// PATCH: update a queue item (status, edited email)
export async function PATCH(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const body = await req.json();
  const { id, status, emailSubject, emailBody } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (status) {
    updates.status = status;
    if (status === "queued" || status === "skipped") updates.reviewedAt = new Date();
    if (status === "sent") updates.sentAt = new Date();
  }
  if (emailSubject !== undefined) updates.emailSubject = emailSubject;
  if (emailBody !== undefined) updates.emailBody = emailBody;

  await db.update(sendQueue).set(updates).where(eq(sendQueue.id, id));
  return NextResponse.json({ ok: true });
}
