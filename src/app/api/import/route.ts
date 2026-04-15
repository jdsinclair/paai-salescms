import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { providers } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { scoreEmail } from "@/lib/email-confidence";

export const dynamic = "force-dynamic";

// POST: Import emails from Clay (single record webhook or batch JSON)
// Accepts either:
//   { npi, email, source? }                    — single record
//   { records: [{ npi, email, source? }, ...] } — batch
//   CSV text body with NPI and email columns    — CSV import
export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const contentType = req.headers.get("content-type") || "";
  let records: { npi: string; email: string; source?: string }[] = [];

  if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    // CSV body
    const text = await req.text();
    const lines = text.trim().split("\n");
    const header = lines[0].toLowerCase();
    const cols = header.split(",").map((c) => c.trim().replace(/"/g, ""));

    const npiIdx = cols.findIndex((c) => c === "npi" || c === "rndrng_npi" || c === "provider_npi");
    const emailIdx = cols.findIndex((c) => c.includes("email") || c.includes("e-mail"));
    const sourceIdx = cols.findIndex((c) => c === "source" || c === "email_source");

    if (npiIdx === -1 || emailIdx === -1) {
      return NextResponse.json({ error: "CSV must have NPI and email columns", detected_columns: cols }, { status: 400 });
    }

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""));
      const npi = vals[npiIdx];
      const email = vals[emailIdx];
      if (npi && email && email.includes("@")) {
        records.push({ npi, email, source: sourceIdx >= 0 ? vals[sourceIdx] : "clay" });
      }
    }
  } else {
    // JSON body
    const body = await req.json();
    if (body.records) {
      records = body.records;
    } else if (body.npi && body.email) {
      records = [body];
    } else {
      return NextResponse.json({ error: "Expected { npi, email } or { records: [...] }" }, { status: 400 });
    }
  }

  if (records.length === 0) {
    return NextResponse.json({ error: "No valid records found", count: 0 }, { status: 400 });
  }

  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  const results: { npi: string; status: string; confidence?: string; score?: number }[] = [];

  for (const rec of records) {
    // Check provider exists
    const existing = await db.select({ npi: providers.npi, firstName: providers.firstName, lastName: providers.lastName })
      .from(providers).where(eq(providers.npi, rec.npi)).limit(1);

    if (existing.length === 0) {
      notFound++;
      results.push({ npi: rec.npi, status: "not_found" });
      continue;
    }

    const p = existing[0];
    const confidence = scoreEmail(rec.email, p.firstName, p.lastName);

    await db.execute(sql`
      UPDATE providers SET
        contact_email = ${rec.email},
        email_source = ${rec.source || "clay"},
        email_confidence = ${confidence.label},
        email_confidence_score = ${confidence.score},
        updated_at = NOW()
      WHERE npi = ${rec.npi}
    `);

    updated++;
    results.push({ npi: rec.npi, status: "updated", confidence: confidence.label, score: confidence.score });
  }

  return NextResponse.json({
    ok: true,
    total: records.length,
    updated,
    skipped,
    notFound,
    results: results.slice(0, 100), // cap response size
  });
}
