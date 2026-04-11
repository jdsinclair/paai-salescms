import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { providers } from "@/lib/schema";
import { eq, sql, isNull, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface NppesResult {
  basic: {
    first_name?: string;
    last_name?: string;
    organization_name?: string;
    credential?: string;
    sex?: string;
    enumeration_date?: string;
    last_updated?: string;
    status?: string;
    name_prefix?: string;
    sole_proprietor?: string;
  };
  addresses: {
    address_1?: string;
    address_2?: string;
    address_purpose: string;
    city?: string;
    state?: string;
    postal_code?: string;
    telephone_number?: string;
    fax_number?: string;
  }[];
  taxonomies: {
    code?: string;
    desc?: string;
    primary?: boolean;
    state?: string;
    license?: string;
  }[];
  endpoints: {
    endpointType?: string;
    endpoint?: string;
  }[];
}

async function fetchNppes(npi: string): Promise<NppesResult | null> {
  const res = await fetch(`https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;
  return data.results[0];
}

function extractEnrichment(nppes: NppesResult) {
  // Get practice location address (prefer LOCATION over MAILING)
  const locationAddr = nppes.addresses.find((a) => a.address_purpose === "LOCATION") || nppes.addresses[0];
  const mailingAddr = nppes.addresses.find((a) => a.address_purpose === "MAILING");

  // Primary taxonomy
  const primaryTax = nppes.taxonomies.find((t) => t.primary) || nppes.taxonomies[0];

  // All taxonomies as summary
  const allTaxonomies = nppes.taxonomies
    .map((t) => `${t.desc || t.code}${t.primary ? " (primary)" : ""}`)
    .join("; ");

  // Build enriched name
  const firstName = nppes.basic.first_name || "";
  const lastName = nppes.basic.last_name || "";
  const orgName = nppes.basic.organization_name || "";

  return {
    firstName,
    lastName,
    orgName,
    credential: nppes.basic.credential || null,
    sex: nppes.basic.sex || null,
    phone: locationAddr?.telephone_number || mailingAddr?.telephone_number || null,
    fax: locationAddr?.fax_number || mailingAddr?.fax_number || null,
    address1: locationAddr?.address_1 || null,
    address2: locationAddr?.address_2 || null,
    city: locationAddr?.city || null,
    state: locationAddr?.state || null,
    zip: locationAddr?.postal_code || null,
    taxonomy: allTaxonomies || null,
    primaryTaxonomy: primaryTax?.desc || null,
    primaryTaxonomyCode: primaryTax?.code || null,
    status: nppes.basic.status || null,
    enumerationDate: nppes.basic.enumeration_date || null,
  };
}

// Enrich a single provider
export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const body = await req.json();
  const { npi } = body;
  if (!npi) return NextResponse.json({ error: "NPI required" }, { status: 400 });

  const nppes = await fetchNppes(npi);
  if (!nppes) return NextResponse.json({ error: "NPI not found in NPPES" }, { status: 404 });

  const enriched = extractEnrichment(nppes);

  // Update DB
  await db.update(providers).set({
    firstName: enriched.firstName,
    lastName: enriched.lastName,
    address1: enriched.address1,
    address2: enriched.address2,
    phone: enriched.phone || "NO_PHONE",
    fax: enriched.fax,
    taxonomy: enriched.taxonomy,
    website: enriched.primaryTaxonomyCode,
    sex: enriched.sex,
    npiStatus: enriched.status,
    updatedAt: new Date(),
  }).where(eq(providers.npi, npi));

  return NextResponse.json({ ok: true, enriched });
}

// Batch enrich: enrich all assessment providers that haven't been enriched yet
export async function PUT(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const params = req.nextUrl.searchParams;
  const batchSize = parseInt(params.get("batch") || "50");

  // Get unenriched providers with assessment units > 0
  const unenriched = await db
    .select({ npi: providers.npi })
    .from(providers)
    .where(
      sql`${providers.phone} IS NULL AND ${providers.assessmentUnits} > 0`
    )
    .orderBy(sql`${providers.revenueProxy} DESC`)
    .limit(batchSize);

  if (unenriched.length === 0) {
    return NextResponse.json({ ok: true, enriched: 0, remaining: 0, message: "All assessment providers enriched" });
  }

  let enrichedCount = 0;
  const results: { npi: string; status: string; taxonomy?: string; phone?: string }[] = [];

  for (const row of unenriched) {
    try {
      // Rate limit: small delay between requests
      if (enrichedCount > 0) await new Promise((r) => setTimeout(r, 200));

      const nppes = await fetchNppes(row.npi);
      if (!nppes) {
        results.push({ npi: row.npi, status: "not_found" });
        // Mark as checked so we don't retry
        await db.update(providers).set({ phone: "NOT_FOUND", updatedAt: new Date() }).where(eq(providers.npi, row.npi));
        continue;
      }

      const enriched = extractEnrichment(nppes);
      await db.update(providers).set({
        firstName: enriched.firstName,
        lastName: enriched.lastName,
        address1: enriched.address1,
        address2: enriched.address2,
        phone: enriched.phone || "NO_PHONE",
        fax: enriched.fax,
        taxonomy: enriched.taxonomy,
        website: enriched.primaryTaxonomyCode,
        sex: enriched.sex,
        npiStatus: enriched.status,
        updatedAt: new Date(),
      }).where(eq(providers.npi, row.npi));

      results.push({ npi: row.npi, status: "enriched", taxonomy: enriched.primaryTaxonomy || undefined, phone: enriched.phone || undefined });
      enrichedCount++;
    } catch (e) {
      results.push({ npi: row.npi, status: "error" });
    }
  }

  // Count remaining
  const remaining = await db
    .select({ count: sql<number>`count(*)` })
    .from(providers)
    .where(sql`${providers.phone} IS NULL AND ${providers.assessmentUnits} > 0`);

  return NextResponse.json({
    ok: true,
    enriched: enrichedCount,
    remaining: Number(remaining[0].count),
    results,
  });
}
