import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { providers } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";
import { scoreEmail } from "@/lib/email-confidence";

export const dynamic = "force-dynamic";

// Simple CSV parser that handles quoted fields with commas
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        current.push(field.trim());
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        current.push(field.trim());
        if (current.some((f) => f !== "")) lines.push(current);
        current = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  // Last field
  current.push(field.trim());
  if (current.some((f) => f !== "")) lines.push(current);

  if (lines.length < 2) return { headers: [], rows: [] };
  return { headers: lines[0], rows: lines.slice(1) };
}

function findColumn(headers: string[], ...patterns: string[]): number {
  const lower = headers.map((h) => h.toLowerCase());
  for (const pattern of patterns) {
    // Exact match first
    const exact = lower.findIndex((h) => h === pattern);
    if (exact >= 0) return exact;
  }
  for (const pattern of patterns) {
    // Contains match
    const contains = lower.findIndex((h) => h.includes(pattern));
    if (contains >= 0) return contains;
  }
  return -1;
}

interface ImportRecord {
  npi: string;
  email: string;
  source: string;
  practiceName?: string;
  clayConfidence?: string;
  clayConfidenceReason?: string;
}

// POST: Import emails from Clay CSV or JSON
export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const contentType = req.headers.get("content-type") || "";
  let records: ImportRecord[] = [];

  if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
    const text = await req.text();
    const { headers, rows } = parseCSV(text);

    if (headers.length === 0) {
      return NextResponse.json({ error: "Could not parse CSV" }, { status: 400 });
    }

    // Find columns — prefer specific Clay column names
    const npiIdx = findColumn(headers, "npi", "rndrng_npi", "provider_npi");
    // Look specifically for the Clay email column, not just any "email" column
    const emailIdx = findColumn(headers, "practice email data email", "contact_email", "email");
    const practiceNameIdx = findColumn(headers, "practice email data practice name", "practice_name", "practice name");
    const clayConfIdx = findColumn(headers, "practice email data confidence");
    const clayReasonIdx = findColumn(headers, "practice email data confidence reason");
    const sourceIdx = findColumn(headers, "source", "email_source");

    if (npiIdx === -1) {
      return NextResponse.json({ error: "Could not find NPI column", detected_columns: headers }, { status: 400 });
    }
    if (emailIdx === -1) {
      return NextResponse.json({ error: "Could not find email column", detected_columns: headers }, { status: 400 });
    }

    for (const row of rows) {
      const npi = row[npiIdx];
      const email = row[emailIdx];
      if (npi && email && email.includes("@")) {
        records.push({
          npi,
          email,
          source: sourceIdx >= 0 ? row[sourceIdx] || "clay" : "clay",
          practiceName: practiceNameIdx >= 0 ? row[practiceNameIdx] : undefined,
          clayConfidence: clayConfIdx >= 0 ? row[clayConfIdx] : undefined,
          clayConfidenceReason: clayReasonIdx >= 0 ? row[clayReasonIdx] : undefined,
        });
      }
    }

    // Return info about what we detected
    const detectedInfo = {
      totalRows: rows.length,
      npiColumn: headers[npiIdx],
      emailColumn: headers[emailIdx],
      practiceNameColumn: practiceNameIdx >= 0 ? headers[practiceNameIdx] : null,
      recordsWithEmail: records.length,
      recordsWithoutEmail: rows.length - records.length,
    };

    return await processRecords(db, records, detectedInfo);
  } else {
    // JSON body
    const body = await req.json();
    if (body.records) {
      records = body.records.map((r: { npi: string; email: string; source?: string }) => ({
        ...r,
        source: r.source || "clay",
      }));
    } else if (body.npi && body.email) {
      records = [{ npi: body.npi, email: body.email, source: body.source || "clay" }];
    } else {
      return NextResponse.json({ error: "Expected { npi, email } or { records: [...] }" }, { status: 400 });
    }
    return await processRecords(db, records);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processRecords(db: any, records: ImportRecord[], detectedInfo?: Record<string, unknown>) {
  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  const results: { npi: string; status: string; email?: string; confidence?: string; score?: number; practiceName?: string }[] = [];

  for (const rec of records) {
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
        email_source = ${rec.source},
        email_confidence = ${confidence.label},
        email_confidence_score = ${confidence.score},
        updated_at = NOW()
      WHERE npi = ${rec.npi}
    `);

    updated++;
    results.push({
      npi: rec.npi,
      status: "updated",
      email: rec.email,
      confidence: confidence.label,
      score: confidence.score,
      practiceName: rec.practiceName,
    });
  }

  return NextResponse.json({
    ok: true,
    total: records.length,
    updated,
    skipped,
    notFound,
    ...(detectedInfo || {}),
    results: results.slice(0, 200),
  });
}
