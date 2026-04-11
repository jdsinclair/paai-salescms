import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { providers } from "@/lib/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function fetchNppes(npi: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.results || data.results.length === 0) return null;
  return data.results[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractAll(nppes: any) {
  const b = nppes.basic || {};
  const addresses = nppes.addresses || [];
  const taxonomies = nppes.taxonomies || [];
  const endpoints = nppes.endpoints || [];
  const identifiers = nppes.identifiers || [];
  const otherNames = nppes.other_names || [];
  const practiceLocations = nppes.practiceLocations || [];

  // Addresses
  const location = addresses.find((a: { address_purpose: string }) => a.address_purpose === "LOCATION") || addresses[0] || {};
  const mailing = addresses.find((a: { address_purpose: string }) => a.address_purpose === "MAILING");

  // Taxonomies
  const primaryTax = taxonomies.find((t: { primary: boolean }) => t.primary) || taxonomies[0];
  const allTaxonomies = taxonomies
    .map((t: { desc?: string; code?: string; primary?: boolean; state?: string; license?: string; taxonomy_group?: string }) => {
      let s = t.desc || t.code || "";
      if (t.primary) s += " (primary)";
      if (t.state) s += ` [${t.state}]`;
      if (t.license) s += ` lic:${t.license}`;
      if (t.taxonomy_group) s += ` group:${t.taxonomy_group}`;
      return s;
    })
    .join("; ");

  const licenseInfo = taxonomies
    .filter((t: { license?: string }) => t.license)
    .map((t: { state?: string; license?: string; desc?: string; code?: string }) => `${t.state || ""}:${t.license} (${t.desc || t.code})`)
    .join("; ");

  // Identifiers
  const otherIds = identifiers
    .map((id: { desc?: string; code?: string; identifier?: string; state?: string; issuer?: string }) =>
      `${id.desc || id.code}: ${id.identifier}${id.state ? ` [${id.state}]` : ""}${id.issuer ? ` (${id.issuer})` : ""}`)
    .join("; ");

  // Endpoints — extract emails
  let email: string | null = null;
  const endpointsSummary = endpoints.map((ep: Record<string, string>) => {
    // Capture any email-like endpoint
    if (ep.endpoint && ep.endpoint.includes("@")) {
      email = ep.endpoint;
    }
    return `${ep.endpointTypeDescription || ep.endpointType || "unknown"}: ${ep.endpoint || ""}${ep.endpointDescription ? ` (${ep.endpointDescription})` : ""}`;
  }).join("; ");

  // Authorized official (for orgs)
  const authOfficial = b.authorized_official_first_name
    ? `${b.authorized_official_first_name} ${b.authorized_official_middle_name || ""} ${b.authorized_official_last_name || ""}`.trim()
    : null;

  return {
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
    authorizedOfficial: authOfficial,
    authorizedOfficialTitle: b.authorized_official_title_or_position || null,
    authorizedOfficialPhone: b.authorized_official_telephone_number || null,
    address1: location.address_1 || null,
    address2: location.address_2 || null,
    locationCity: location.city || null,
    locationState: location.state || null,
    locationZip: location.postal_code || null,
    phone: location.telephone_number || null,
    fax: location.fax_number || null,
    mailingAddress1: mailing?.address_1 || null,
    mailingAddress2: mailing?.address_2 || null,
    mailingCity: mailing?.city || null,
    mailingState: mailing?.state || null,
    mailingZip: mailing?.postal_code || null,
    taxonomy: allTaxonomies || null,
    taxonomyCode: primaryTax?.code || null,
    licenseInfo: licenseInfo || null,
    otherIdentifiers: otherIds || null,
    email,
    endpointsJson: endpoints.length > 0 ? JSON.stringify(endpoints) : null,
    practiceLocationsJson: practiceLocations.length > 0 ? JSON.stringify(practiceLocations) : null,
    otherNamesJson: otherNames.length > 0 ? JSON.stringify(otherNames) : null,
    nppesRaw: JSON.stringify(nppes),
  };
}

function buildSql(npi: string, e: ReturnType<typeof extractAll>) {
  return sql`
    UPDATE providers SET
      first_name = ${e.firstName},
      last_name = ${e.lastName},
      address1 = ${e.address1},
      address2 = ${e.address2},
      phone = ${e.phone || "NO_PHONE"},
      fax = ${e.fax},
      email = ${e.email},
      taxonomy = ${e.taxonomy},
      taxonomy_code = ${e.taxonomyCode},
      sex = ${e.sex},
      npi_status = ${e.npiStatus},
      org_name = ${e.orgName},
      sole_proprietor = ${e.soleProprietor},
      enumeration_type = ${e.enumerationType},
      enumeration_date = ${e.enumerationDate},
      npi_last_updated = ${e.npiLastUpdated},
      authorized_official = ${e.authorizedOfficial},
      authorized_official_title = ${e.authorizedOfficialTitle},
      authorized_official_phone = ${e.authorizedOfficialPhone},
      location_city = ${e.locationCity},
      location_state = ${e.locationState},
      location_zip = ${e.locationZip},
      mailing_address1 = ${e.mailingAddress1},
      mailing_address2 = ${e.mailingAddress2},
      mailing_city = ${e.mailingCity},
      mailing_state = ${e.mailingState},
      mailing_zip = ${e.mailingZip},
      license_info = ${e.licenseInfo},
      other_identifiers = ${e.otherIdentifiers},
      endpoints_json = ${e.endpointsJson},
      practice_locations_json = ${e.practiceLocationsJson},
      other_names_json = ${e.otherNamesJson},
      nppes_raw = ${e.nppesRaw},
      updated_at = NOW()
    WHERE npi = ${npi}
  `;
}

// Enrich single provider (also retry)
export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const body = await req.json();
  const { npi } = body;
  if (!npi) return NextResponse.json({ error: "NPI required" }, { status: 400 });

  const nppes = await fetchNppes(npi);
  if (!nppes) return NextResponse.json({ error: "NPI not found in NPPES" }, { status: 404 });

  const enriched = extractAll(nppes);
  await db.execute(buildSql(npi, enriched));

  return NextResponse.json({ ok: true, enriched });
}

// Batch enrich
export async function PUT(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const params = req.nextUrl.searchParams;
  const batchSize = parseInt(params.get("batch") || "50");

  const unenriched = await db
    .select({ npi: providers.npi })
    .from(providers)
    .where(sql`${providers.phone} IS NULL AND ${providers.assessmentUnits} > 0`)
    .orderBy(sql`${providers.revenueProxy} DESC`)
    .limit(batchSize);

  if (unenriched.length === 0) {
    return NextResponse.json({ ok: true, enriched: 0, remaining: 0, message: "All done" });
  }

  let enrichedCount = 0;
  let errorCount = 0;

  for (const row of unenriched) {
    try {
      if (enrichedCount > 0) await new Promise((r) => setTimeout(r, 150));
      const nppes = await fetchNppes(row.npi);
      if (!nppes) {
        await db.execute(sql`UPDATE providers SET phone = 'NOT_FOUND', updated_at = NOW() WHERE npi = ${row.npi}`);
      } else {
        const enriched = extractAll(nppes);
        await db.execute(buildSql(row.npi, enriched));
        enrichedCount++;
      }
    } catch {
      errorCount++;
      await db.execute(sql`UPDATE providers SET phone = 'ERROR', updated_at = NOW() WHERE npi = ${row.npi}`).catch(() => {});
    }
  }

  const remaining = await db
    .select({ count: sql<number>`count(*)` })
    .from(providers)
    .where(sql`${providers.phone} IS NULL AND ${providers.assessmentUnits} > 0`);

  return NextResponse.json({ ok: true, enriched: enrichedCount, errors: errorCount, remaining: Number(remaining[0].count) });
}
