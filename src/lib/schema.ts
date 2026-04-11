import { pgTable, text, integer, real, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const providers = pgTable("providers", {
  npi: text("npi").primaryKey(),
  name: text("name").notNull(),
  credentials: text("credentials"),
  entityType: text("entity_type"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  providerType: text("provider_type"),
  // Metrics
  totalUnits: integer("total_units").default(0),
  assessmentUnits: integer("assessment_units").default(0),
  adminUnits: integer("admin_units").default(0),
  addonUnits: integer("addon_units").default(0),
  neuroUnits: integer("neuro_units").default(0),
  revenueProxy: real("revenue_proxy").default(0),
  totalRevenue: real("total_revenue").default(0),
  assessmentRatio: real("assessment_ratio").default(0),
  complexityScore: real("complexity_score").default(0),
  neuroFlag: boolean("neuro_flag").default(false),
  // CRM fields
  crmStatus: text("crm_status").default("new"),
  crmNotes: text("crm_notes"),
  crmLastContact: timestamp("crm_last_contact"),
  crmNextFollowup: timestamp("crm_next_followup"),
  crmOwner: text("crm_owner"),
  // NPPES enrichment
  firstName: text("first_name"),
  lastName: text("last_name"),
  sex: text("sex"),
  orgName: text("org_name"),
  soleProprietor: text("sole_proprietor"),
  // Location address
  address1: text("address1"),
  address2: text("address2"),
  locationCity: text("location_city"),
  locationState: text("location_state"),
  locationZip: text("location_zip"),
  phone: text("phone"),
  fax: text("fax"),
  // Mailing address
  mailingAddress1: text("mailing_address1"),
  mailingAddress2: text("mailing_address2"),
  mailingCity: text("mailing_city"),
  mailingState: text("mailing_state"),
  mailingZip: text("mailing_zip"),
  // Taxonomy & license
  taxonomy: text("taxonomy"),
  taxonomyCode: text("taxonomy_code"),
  licenseInfo: text("license_info"),
  // NPI registry metadata
  enumerationType: text("enumeration_type"),
  enumerationDate: text("enumeration_date"),
  npiLastUpdated: text("npi_last_updated"),
  npiStatus: text("npi_status"),
  // Org authorized official
  authorizedOfficial: text("authorized_official"),
  authorizedOfficialTitle: text("authorized_official_title"),
  authorizedOfficialPhone: text("authorized_official_phone"),
  // Other
  otherIdentifiers: text("other_identifiers"),
  endpointsJson: text("endpoints_json"),
  practiceLocationsJson: text("practice_locations_json"),
  otherNamesJson: text("other_names_json"),
  email: text("email"),
  website: text("website"),
  nppesRaw: text("nppes_raw"),
  // Codes stored as JSON string
  codesJson: text("codes_json"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tags = pgTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").default("#6366f1"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const providerTags = pgTable("provider_tags", {
  npi: text("npi").notNull().references(() => providers.npi),
  tagId: text("tag_id").notNull().references(() => tags.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.npi, t.tagId] }),
]);

export const segments = pgTable("segments", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  filtersJson: text("filters_json"),
  providerCount: integer("provider_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const crmActivity = pgTable("crm_activity", {
  id: text("id").primaryKey(),
  npi: text("npi").notNull().references(() => providers.npi),
  type: text("type").notNull(),
  content: text("content"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
});
