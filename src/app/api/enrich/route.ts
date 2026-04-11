import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { providers } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface NppesAddress {
  address_1?: string;
  address_2?: string;
  address_purpose: string;
  address_type?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country_code?: string;
  telephone_number?: string;
  fax_number?: string;
}

interface NppesTaxonomy {
  code?: string;
  desc?: string;
  primary?: boolean;
  state?: string;
  license?: string;
  taxonomy_group?: string;
}

interface NppesResult {
  number: string;
  enumeration_type: string;
  basic: Record<string, string>;
  addresses: NppesAddress[];
  taxonomies: NppesTaxonomy[];
  endpoints: { endpointType?: string; endpoint?: string }[];
  identifiers: { code?: string; desc?: string; identifier?: string; issuer?: string; state?: string }[];
  other_names: { type?: string; code?: string; first_name?: string; last_name?: string; organization_name?: string }[];
  practiceLocations: NppesAddress[];
}

async function fetchNppes(npi: string): Promise<NppesResult | null> {
  const res = await fetch(`https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;
  return data.results[0];
}

function extractAll(nppes: NppesResult) {
  const b = nppes.basic;

  // Addresses
  const location = nppes.addresses.find((a) => a.address_purpose === "LOCATION") || nppes.addresses[0];
  const mailing = nppes.addresses.find((a) => a.address_purpose === "MAILING");

  // Taxonomies
  const primaryTax = nppes.taxonomies.find((t) => t.primary) || nppes.taxonomies[0];
  const allTaxonomies = nppes.taxonomies
    .map((t) => {
      let s = t.desc || t.code || "";
      if (t.primary) s += " (primary)";
      if (t.state) s += ` [${t.state}]`;
      if (t.license) s += ` lic:${t.license}`;
      return s;
    })
    .join("; ");

  // License info from taxonomies
  const licenseInfo = nppes.taxonomies
    .filter((t) => t.license)
    .map((t) => `${t.state || ""}:${t.license} (${t.desc || t.code})`)
    .join("; ");

  // Identifiers
  const otherIds = nppes.identifiers
    .map((id) => `${id.desc || id.code}: ${id.identifier}${id.state ? ` [${id.state}]` : ""}${id.issuer ? ` (${id.issuer})` : ""}`)
    .join("; ");

  // Authorized official (for orgs)
  const authOfficial = b.authorized_official_first_name
    ? `${b.authorized_official_first_name} ${b.authorized_official_middle_name || ""} ${b.authorized_official_last_name || ""}`.trim()
    : null;

  return {
    // Basic
    firstName: b.first_name || null,
    lastName: b.last_name || null,
    orgName: b.organization_name || null,
    credential: b.credential || null,
    sex: b.sex || null,
    soleProprietor: b.sole_proprietor || null,
    enumerationType: nppes.enumeration_type || null,
    enumerationDate: b.enumeration_date || null,
    npiLastUpdated: b.last_updated || null,
    npiStatus: b.status || null,

    // Org fields
    authorizedOfficial: authOfficial,
    authorizedOfficialTitle: b.authorized_official_title_or_position || null,
    authorizedOfficialPhone: b.authorized_official_telephone_number || null,

    // Location address
    address1: location?.address_1 || null,
    address2: location?.address_2 || null,
    locationCity: location?.city || null,
    locationState: location?.state || null,
    locationZip: location?.postal_code || null,
    phone: location?.telephone_number || null,
    fax: location?.fax_number || null,

    // Mailing address
    mailingAddress1: mailing?.address_1 || null,
    mailingAddress2: mailing?.address_2 || null,
    mailingCity: mailing?.city || null,
    mailingState: mailing?.state || null,
    mailingZip: mailing?.postal_code || null,

    // Taxonomy
    taxonomy: allTaxonomies || null,
    taxonomyCode: primaryTax?.code || null,

    // Other
    licenseInfo: licenseInfo || null,
    otherIdentifiers: otherIds || null,
  };
}

function buildDbUpdate(enriched: ReturnType<typeof extractAll>) {
  return {
    firstName: enriched.firstName,
    lastName: enriched.lastName,
    address1: enriched.address1,
    address2: enriched.address2,
    phone: enriched.phone || "NO_PHONE",
    fax: enriched.fax,
    taxonomy: enriched.taxonomy,
    sex: enriched.sex,
    npiStatus: enriched.npiStatus,
    // Store additional fields via raw SQL since schema may not have all columns mapped
  };
}

// Enrich a single provider (also used for retry)
export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const body = await req.json();
  const { npi } = body;
  if (!npi) return NextResponse.json({ error: "NPI required" }, { status: 400 });

  const nppes = await fetchNppes(npi);
  if (!nppes) return NextResponse.json({ error: "NPI not found in NPPES" }, { status: 404 });

  const enriched = extractAll(nppes);

  // Write all fields to DB using raw SQL for the extended columns
  await db.execute(sql`
    UPDATE providers SET
      first_name = ${enriched.firstName},
      last_name = ${enriched.lastName},
      address1 = ${enriched.address1},
      address2 = ${enriched.address2},
      phone = ${enriched.phone || "NO_PHONE"},
      fax = ${enriched.fax},
      taxonomy = ${enriched.taxonomy},
      taxonomy_code = ${enriched.taxonomyCode},
      sex = ${enriched.sex},
      npi_status = ${enriched.npiStatus},
      org_name = ${enriched.orgName},
      sole_proprietor = ${enriched.soleProprietor},
      enumeration_type = ${enriched.enumerationType},
      enumeration_date = ${enriched.enumerationDate},
      npi_last_updated = ${enriched.npiLastUpdated},
      authorized_official = ${enriched.authorizedOfficial},
      authorized_official_title = ${enriched.authorizedOfficialTitle},
      authorized_official_phone = ${enriched.authorizedOfficialPhone},
      location_city = ${enriched.locationCity},
      location_state = ${enriched.locationState},
      location_zip = ${enriched.locationZip},
      mailing_address1 = ${enriched.mailingAddress1},
      mailing_address2 = ${enriched.mailingAddress2},
      mailing_city = ${enriched.mailingCity},
      mailing_state = ${enriched.mailingState},
      mailing_zip = ${enriched.mailingZip},
      license_info = ${enriched.licenseInfo},
      other_identifiers = ${enriched.otherIdentifiers},
      nppes_raw = ${JSON.stringify(nppes)},
      updated_at = NOW()
    WHERE npi = ${npi}
  `);

  return NextResponse.json({ ok: true, enriched });
}

// Batch enrich unenriched assessment providers
export async function PUT(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const params = req.nextUrl.searchParams;
  const batchSize = parseInt(params.get("batch") || "50");

  // Get unenriched providers with assessment units > 0
  const unenriched = await db
    .select({ npi: providers.npi })
    .from(providers)
    .where(sql`${providers.phone} IS NULL AND ${providers.assessmentUnits} > 0`)
    .orderBy(sql`${providers.revenueProxy} DESC`)
    .limit(batchSize);

  if (unenriched.length === 0) {
    return NextResponse.json({ ok: true, enriched: 0, remaining: 0, message: "All assessment providers enriched" });
  }

  let enrichedCount = 0;
  let errorCount = 0;
  const results: { npi: string; status: string; taxonomy?: string; phone?: string }[] = [];

  for (const row of unenriched) {
    try {
      if (enrichedCount > 0) await new Promise((r) => setTimeout(r, 200));

      const nppes = await fetchNppes(row.npi);
      if (!nppes) {
        results.push({ npi: row.npi, status: "not_found" });
        await db.execute(sql`UPDATE providers SET phone = 'NOT_FOUND', updated_at = NOW() WHERE npi = ${row.npi}`);
        continue;
      }

      const enriched = extractAll(nppes);

      await db.execute(sql`
        UPDATE providers SET
          first_name = ${enriched.firstName},
          last_name = ${enriched.lastName},
          address1 = ${enriched.address1},
          address2 = ${enriched.address2},
          phone = ${enriched.phone || "NO_PHONE"},
          fax = ${enriched.fax},
          taxonomy = ${enriched.taxonomy},
          taxonomy_code = ${enriched.taxonomyCode},
          sex = ${enriched.sex},
          npi_status = ${enriched.npiStatus},
          org_name = ${enriched.orgName},
          sole_proprietor = ${enriched.soleProprietor},
          enumeration_type = ${enriched.enumerationType},
          enumeration_date = ${enriched.enumerationDate},
          npi_last_updated = ${enriched.npiLastUpdated},
          authorized_official = ${enriched.authorizedOfficial},
          authorized_official_title = ${enriched.authorizedOfficialTitle},
          authorized_official_phone = ${enriched.authorizedOfficialPhone},
          location_city = ${enriched.locationCity},
          location_state = ${enriched.locationState},
          location_zip = ${enriched.locationZip},
          mailing_address1 = ${enriched.mailingAddress1},
          mailing_address2 = ${enriched.mailingAddress2},
          mailing_city = ${enriched.mailingCity},
          mailing_state = ${enriched.mailingState},
          mailing_zip = ${enriched.mailingZip},
          license_info = ${enriched.licenseInfo},
          other_identifiers = ${enriched.otherIdentifiers},
          nppes_raw = ${JSON.stringify(nppes)},
          updated_at = NOW()
        WHERE npi = ${row.npi}
      `);

      results.push({
        npi: row.npi,
        status: "enriched",
        taxonomy: enriched.taxonomy || undefined,
        phone: enriched.phone || undefined,
      });
      enrichedCount++;
    } catch (e) {
      results.push({ npi: row.npi, status: "error" });
      errorCount++;
    }
  }

  const remaining = await db
    .select({ count: sql<number>`count(*)` })
    .from(providers)
    .where(sql`${providers.phone} IS NULL AND ${providers.assessmentUnits} > 0`);

  return NextResponse.json({
    ok: true,
    enriched: enrichedCount,
    errors: errorCount,
    remaining: Number(remaining[0].count),
    results,
  });
}
