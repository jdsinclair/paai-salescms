import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { providers, providerTags, tags } from "@/lib/schema";
import { eq, sql, and, gte, inArray } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const params = req.nextUrl.searchParams;
  const page = parseInt(params.get("page") || "1");
  const limit = parseInt(params.get("limit") || "100");
  const sortField = params.get("sort") || "revenue_proxy";
  const sortDir = params.get("dir") || "desc";

  // Build where conditions
  const conditions: ReturnType<typeof eq>[] = [];

  const state = params.get("state");
  if (state) {
    const states = state.split(",");
    conditions.push(inArray(providers.state, states));
  }

  const minAssess = parseFloat(params.get("minAssessUnits") || "0");
  if (minAssess > 0) conditions.push(gte(providers.assessmentUnits, minAssess));

  const minRatio = parseFloat(params.get("minAssessRatio") || "0");
  if (minRatio > 0) conditions.push(gte(providers.assessmentRatio, minRatio));

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
      sql`(${providers.npi} ILIKE ${'%' + search + '%'} OR ${providers.name} ILIKE ${'%' + search + '%'} OR ${providers.city} ILIKE ${'%' + search + '%'})`
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Sort mapping
  const sortFields: Record<string, string> = {
    revenue_proxy: "revenue_proxy",
    assessment_units: "assessment_units",
    admin_units: "admin_units",
    complexity_score: "complexity_score",
    assessment_ratio: "assessment_ratio",
    total_units: "total_units",
  };
  const col = sortFields[sortField] || "revenue_proxy";
  const orderExpr = sql.raw(`${col} ${sortDir === "asc" ? "ASC" : "DESC"}`);

  const [countResult, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(providers).where(where),
    db.select().from(providers).where(where).orderBy(orderExpr).limit(limit).offset((page - 1) * limit),
  ]);

  const total = Number(countResult[0].count);

  // Get tags for these providers
  const npis = rows.map((r) => r.npi);
  let tagMap: Record<string, string[]> = {};
  if (npis.length > 0) {
    const tagRows = await db
      .select({ npi: providerTags.npi, tagName: tags.name })
      .from(providerTags)
      .innerJoin(tags, eq(providerTags.tagId, tags.id))
      .where(inArray(providerTags.npi, npis));
    tagRows.forEach((r) => {
      if (!tagMap[r.npi]) tagMap[r.npi] = [];
      tagMap[r.npi].push(r.tagName);
    });
  }

  const result = rows.map((r) => ({
    npi: r.npi,
    name: r.name,
    credentials: r.credentials,
    entity_type: r.entityType,
    city: r.city,
    state: r.state,
    zip: r.zip,
    provider_type: r.providerType,
    total_units: r.totalUnits,
    assessment_units: r.assessmentUnits,
    admin_units: r.adminUnits,
    addon_units: r.addonUnits,
    neuro_units: r.neuroUnits,
    revenue_proxy: r.revenueProxy,
    total_revenue: r.totalRevenue,
    assessment_ratio: r.assessmentRatio,
    complexity_score: r.complexityScore,
    neuro_flag: r.neuroFlag,
    codes: r.codesJson ? JSON.parse(r.codesJson) : {},
    crm_status: r.crmStatus,
    crm_notes: r.crmNotes,
    crm_last_contact: r.crmLastContact,
    crm_next_followup: r.crmNextFollowup,
    crm_owner: r.crmOwner,
    phone: r.phone,
    email: r.email,
    tags: tagMap[r.npi] || [],
  }));

  return NextResponse.json({ providers: result, total, page, limit });
}

// Update a provider (CRM fields, enrichment)
export async function PATCH(req: NextRequest) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "DB not connected" }, { status: 500 });

  const body = await req.json();
  const { npi, ...updates } = body;
  if (!npi) return NextResponse.json({ error: "NPI required" }, { status: 400 });

  const fieldMap: Record<string, keyof typeof providers> = {
    crm_status: "crmStatus",
    crm_notes: "crmNotes",
    crm_owner: "crmOwner",
    phone: "phone",
    fax: "fax",
    email: "email",
    website: "website",
  };

  const dbUpdates: Record<string, string | null> = {};
  for (const [key, val] of Object.entries(updates)) {
    const dbField = fieldMap[key];
    if (dbField) dbUpdates[dbField as string] = val as string;
  }

  if (updates.crm_last_contact) dbUpdates.crmLastContact = updates.crm_last_contact;
  if (updates.crm_next_followup) dbUpdates.crmNextFollowup = updates.crm_next_followup;

  await db.update(providers).set(dbUpdates).where(eq(providers.npi, npi));
  return NextResponse.json({ ok: true });
}
