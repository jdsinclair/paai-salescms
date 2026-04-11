import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { tags, providerTags } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";

// List all tags
export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const allTags = await db.select().from(tags);
  return NextResponse.json({ tags: allTags });
}

// Create tag and/or assign to providers
export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const body = await req.json();
  const { name, color, npis } = body as { name: string; color?: string; npis?: string[] };

  if (!name) return NextResponse.json({ error: "Tag name required" }, { status: 400 });

  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Upsert tag
  await db
    .insert(tags)
    .values({ id, name, color: color || "#6366f1" })
    .onConflictDoNothing();

  // Assign to providers if NPIs given
  if (npis && npis.length > 0) {
    const rows = npis.map((npi) => ({ npi, tagId: id }));
    // Batch insert
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      await db.insert(providerTags).values(rows.slice(i, i + BATCH)).onConflictDoNothing();
    }
  }

  return NextResponse.json({ ok: true, tagId: id, assigned: npis?.length || 0 });
}

// Remove tag from providers or delete tag entirely
export async function DELETE(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const body = await req.json();
  const { tagId, npi } = body as { tagId: string; npi?: string };

  if (!tagId) return NextResponse.json({ error: "tagId required" }, { status: 400 });

  if (npi) {
    // Remove tag from specific provider
    const { and } = await import("drizzle-orm");
    await db
      .delete(providerTags)
      .where(and(eq(providerTags.tagId, tagId), eq(providerTags.npi, npi)));
  } else {
    // Delete tag entirely
    await db.delete(providerTags).where(eq(providerTags.tagId, tagId));
    await db.delete(tags).where(eq(tags.id, tagId));
  }

  return NextResponse.json({ ok: true });
}
