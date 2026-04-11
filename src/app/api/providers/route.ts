import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { providers, providerTags, tags } from "@/lib/schema";
import { eq, sql, and, gte, lte, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

function buildWhere(params: URLSearchParams) {
  const conditions: ReturnType<typeof eq>[] = [];

  const state = params.get("state");
  if (state) conditions.push(inArray(providers.state, state.split(",")));

  const minAssess = parseFloat(params.get("minAssessUnits") || "0");
  if (minAssess > 0) conditions.push(gte(providers.assessmentUnits, minAssess));

  const minRatio = parseFloat(params.get("minAssessRatio") || "0");
  if (minRatio > 0) conditions.push(gte(providers.assessmentRatio, minRatio));

  const maxRatio = parseFloat(params.get("maxAssessRatio") || "0");
  if (maxRatio > 0) conditions.push(lte(providers.assessmentRatio, maxRatio));

  const minAdmin = parseFloat(params.get("minAdminUnits") || "0");
  if (minAdmin > 0) conditions.push(gte(providers.adminUnits, minAdmin));

  const minRev = parseFloat(params.get("minRevenue") || "0");
  if (minRev > 0) conditions.push(gte(providers.revenueProxy, minRev));

  const minComplex = parseFloat(params.get("minComplexity") || "0");
  if (minComplex > 0) conditions.push(gte(providers.complexityScore, minComplex));

  const neuro = params.get("neuroOnly");
  if (neuro === "true") conditions.push(eq(providers.neuroFlag, true));

  const entityType = params.get("entityType");
  if (entityType) conditions.push(eq(providers.entityType, entityType));

  const search = params.get("search");
  if (search) {
    conditions.push(
      sql`(${providers.npi} ILIKE ${"%" + search + "%"} OR ${providers.name} ILIKE ${"%" + search + "%"} OR ${providers.city} ILIKE ${"%" + search + "%"} OR ${providers.providerType} ILIKE ${"%" + search + "%"})`
    );
  }

  // Tag filter
  const tagFilter = params.get("tagFilter");
  if (tagFilter) {
    const tagIds = tagFilter.split(",");
    conditions.push(
      sql`${providers.npi} IN (SELECT npi FROM provider_tags WHERE tag_id IN (${sql.join(tagIds.map(t => sql`${t}`), sql`,`)}))`
    );
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const params = req.nextUrl.searchParams;
  const page = parseInt(params.get("page") || "1");
  const limit = parseInt(params.get("limit") || "100");
  const sortField = params.get("sort") || "revenue_proxy";
  const sortDir = params.get("dir") || "desc";

  const where = buildWhere(params);

  // Sort
  const sortFields: Record<string, string> = {
    revenue_proxy: "revenue_proxy",
    assessment_units: "assessment_units",
    admin_units: "admin_units",
    complexity_score: "complexity_score",
    assessment_ratio: "assessment_ratio",
    total_units: "total_units",
    total_revenue: "total_revenue",
    name: "name",
  };
  const col = sortFields[sortField] || "revenue_proxy";
  const direction = sortDir === "asc" ? "ASC" : "DESC";
  const orderExpr = sql.raw(`${col} ${direction} NULLS LAST`);

  const [countResult, statsResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(providers).where(where),
    db.select({
      totalRevenue: sql<number>`coalesce(sum(revenue_proxy), 0)`,
      totalAssess: sql<number>`coalesce(sum(assessment_units), 0)`,
      avgRatio: sql<number>`coalesce(avg(assessment_ratio), 0)`,
    }).from(providers).where(where),
    db.select().from(providers).where(where).orderBy(orderExpr).limit(limit).offset((page - 1) * limit),
  ]);

  const total = Number(countResult[0].count);
  const stats = {
    totalRevenue: Number(statsResult[0].totalRevenue),
    totalAssess: Number(statsResult[0].totalAssess),
    avgRatio: Number(statsResult[0].avgRatio),
  };

  // Get tags for page providers
  const npis = rows.map((r) => r.npi);
  const tagMap: Record<string, string[]> = {};
  if (npis.length > 0) {
    const tagRows = await db
      .select({ npi: providerTags.npi, tagName: tags.name, tagId: tags.id })
      .from(providerTags)
      .innerJoin(tags, eq(providerTags.tagId, tags.id))
      .where(inArray(providerTags.npi, npis));
    tagRows.forEach((r) => {
      if (!tagMap[r.npi]) tagMap[r.npi] = [];
      tagMap[r.npi].push(r.tagName);
    });
  }

  // Max revenue for bar scaling
  const maxRevRow = await db.select({ max: sql<number>`coalesce(max(revenue_proxy), 1)` }).from(providers).where(where);
  const maxRevenue = Number(maxRevRow[0].max);

  const result = rows.map((r) => ({
    npi: r.npi,
    name: r.name,
    credentials: r.credentials,
    entity_type: r.entityType,
    city: r.city,
    state: r.state,
    zip: r.zip,
    provider_type: r.providerType,
    total_units: r.totalUnits ?? 0,
    assessment_units: r.assessmentUnits ?? 0,
    admin_units: r.adminUnits ?? 0,
    addon_units: r.addonUnits ?? 0,
    neuro_units: r.neuroUnits ?? 0,
    revenue_proxy: r.revenueProxy ?? 0,
    total_revenue: r.totalRevenue ?? 0,
    assessment_ratio: r.assessmentRatio ?? 0,
    complexity_score: r.complexityScore ?? 0,
    neuro_flag: r.neuroFlag ?? false,
    codes: r.codesJson ? JSON.parse(r.codesJson) : {},
    crm_status: r.crmStatus,
    crm_notes: r.crmNotes,
    crm_last_contact: r.crmLastContact,
    crm_next_followup: r.crmNextFollowup,
    crm_owner: r.crmOwner,
    phone: r.phone,
    fax: r.fax,
    email: r.email,
    first_name: r.firstName,
    last_name: r.lastName,
    sex: r.sex,
    org_name: r.orgName,
    sole_proprietor: r.soleProprietor,
    address1: r.address1,
    address2: r.address2,
    location_city: r.locationCity,
    location_state: r.locationState,
    location_zip: r.locationZip,
    mailing_address1: r.mailingAddress1,
    mailing_address2: r.mailingAddress2,
    mailing_city: r.mailingCity,
    mailing_state: r.mailingState,
    mailing_zip: r.mailingZip,
    taxonomy: r.taxonomy,
    taxonomy_code: r.taxonomyCode,
    license_info: r.licenseInfo,
    enumeration_type: r.enumerationType,
    enumeration_date: r.enumerationDate,
    npi_last_updated: r.npiLastUpdated,
    npi_status: r.npiStatus,
    authorized_official: r.authorizedOfficial,
    authorized_official_title: r.authorizedOfficialTitle,
    authorized_official_phone: r.authorizedOfficialPhone,
    other_identifiers: r.otherIdentifiers,
    enriched: !!r.phone && r.phone !== "NO_PHONE" && r.phone !== "NOT_FOUND",
    tags: tagMap[r.npi] || [],
  }));

  return NextResponse.json({ providers: result, total, page, limit, stats, maxRevenue });
}

// Update a provider (CRM fields, enrichment)
export async function PATCH(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const body = await req.json();
  const { npi, ...updates } = body;
  if (!npi) return NextResponse.json({ error: "NPI required" }, { status: 400 });

  const fieldMap: Record<string, string> = {
    crm_status: "crmStatus",
    crm_notes: "crmNotes",
    crm_owner: "crmOwner",
    phone: "phone",
    fax: "fax",
    email: "email",
    website: "website",
  };

  const dbUpdates: Record<string, string | null> = { updatedAt: new Date().toISOString() };
  for (const [key, val] of Object.entries(updates)) {
    const dbField = fieldMap[key];
    if (dbField) dbUpdates[dbField] = val as string;
  }

  await db.update(providers).set(dbUpdates).where(eq(providers.npi, npi));
  return NextResponse.json({ ok: true });
}
