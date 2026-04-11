import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

interface NppesResult {
  number: string;
  enumeration_type: string;
  basic: Record<string, string>;
  addresses: { address_1?: string; address_2?: string; address_purpose: string; city?: string; state?: string; postal_code?: string; telephone_number?: string; fax_number?: string }[];
  taxonomies: { code?: string; desc?: string; primary?: boolean; state?: string; license?: string; taxonomy_group?: string }[];
  endpoints: unknown[];
  identifiers: { code?: string; desc?: string; identifier?: string; issuer?: string; state?: string }[];
  other_names: unknown[];
  practiceLocations: unknown[];
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
  const location = nppes.addresses.find((a) => a.address_purpose === "LOCATION") || nppes.addresses[0];
  const mailing = nppes.addresses.find((a) => a.address_purpose === "MAILING");
  const primaryTax = nppes.taxonomies.find((t) => t.primary) || nppes.taxonomies[0];

  const allTaxonomies = nppes.taxonomies
    .map((t) => { let s = t.desc || t.code || ""; if (t.primary) s += " (primary)"; if (t.state) s += ` [${t.state}]`; if (t.license) s += ` lic:${t.license}`; return s; })
    .join("; ");

  const licenseInfo = nppes.taxonomies
    .filter((t) => t.license)
    .map((t) => `${t.state || ""}:${t.license} (${t.desc || t.code})`)
    .join("; ");

  const otherIds = nppes.identifiers
    .map((id) => `${id.desc || id.code}: ${id.identifier}${id.state ? ` [${id.state}]` : ""}${id.issuer ? ` (${id.issuer})` : ""}`)
    .join("; ");

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
    address1: location?.address_1 || null,
    address2: location?.address_2 || null,
    locationCity: location?.city || null,
    locationState: location?.state || null,
    locationZip: location?.postal_code || null,
    phone: location?.telephone_number || null,
    fax: location?.fax_number || null,
    mailingAddress1: mailing?.address_1 || null,
    mailingAddress2: mailing?.address_2 || null,
    mailingCity: mailing?.city || null,
    mailingState: mailing?.state || null,
    mailingZip: mailing?.postal_code || null,
    taxonomy: allTaxonomies || null,
    taxonomyCode: primaryTax?.code || null,
    licenseInfo: licenseInfo || null,
    otherIdentifiers: otherIds || null,
    nppesRaw: JSON.stringify(nppes),
  };
}

async function run() {
  // Get all unenriched assessment providers
  const rows = await sql`SELECT npi FROM providers WHERE phone IS NULL AND assessment_units > 0 ORDER BY revenue_proxy DESC`;
  console.log(`Total to enrich: ${rows.length}`);

  let enriched = 0;
  let notFound = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < rows.length; i++) {
    const npi = rows[i].npi;

    try {
      if (i > 0) await new Promise((r) => setTimeout(r, 150)); // rate limit

      const nppes = await fetchNppes(npi);
      if (!nppes) {
        await sql`UPDATE providers SET phone = 'NOT_FOUND', updated_at = NOW() WHERE npi = ${npi}`;
        notFound++;
      } else {
        const e = extractAll(nppes);
        await sql`
          UPDATE providers SET
            first_name = ${e.firstName}, last_name = ${e.lastName},
            address1 = ${e.address1}, address2 = ${e.address2},
            phone = ${e.phone || "NO_PHONE"}, fax = ${e.fax},
            taxonomy = ${e.taxonomy}, taxonomy_code = ${e.taxonomyCode},
            sex = ${e.sex}, npi_status = ${e.npiStatus},
            org_name = ${e.orgName}, sole_proprietor = ${e.soleProprietor},
            enumeration_type = ${e.enumerationType}, enumeration_date = ${e.enumerationDate},
            npi_last_updated = ${e.npiLastUpdated},
            authorized_official = ${e.authorizedOfficial},
            authorized_official_title = ${e.authorizedOfficialTitle},
            authorized_official_phone = ${e.authorizedOfficialPhone},
            location_city = ${e.locationCity}, location_state = ${e.locationState},
            location_zip = ${e.locationZip},
            mailing_address1 = ${e.mailingAddress1}, mailing_address2 = ${e.mailingAddress2},
            mailing_city = ${e.mailingCity}, mailing_state = ${e.mailingState},
            mailing_zip = ${e.mailingZip},
            license_info = ${e.licenseInfo}, other_identifiers = ${e.otherIdentifiers},
            nppes_raw = ${e.nppesRaw},
            updated_at = NOW()
          WHERE npi = ${npi}
        `;
        enriched++;
      }
    } catch (err) {
      errors++;
      // Mark as attempted so we don't get stuck
      await sql`UPDATE providers SET phone = 'ERROR', updated_at = NOW() WHERE npi = ${npi}`.catch(() => {});
    }

    // Progress every 100
    if ((i + 1) % 100 === 0 || i === rows.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = ((i + 1) / ((Date.now() - startTime) / 1000)).toFixed(1);
      const eta = (((rows.length - i - 1) / parseFloat(rate)) / 60).toFixed(1);
      console.log(`  ${i + 1}/${rows.length} | enriched: ${enriched} | not_found: ${notFound} | errors: ${errors} | ${elapsed}s elapsed | ${rate}/s | ETA: ${eta}min`);
    }
  }

  console.log(`\nDone! Enriched: ${enriched}, Not found: ${notFound}, Errors: ${errors}`);
}

run().catch(console.error);
