import { pgTable, text, integer, real, boolean, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const providers = pgTable("providers", {
  npi: text("npi").primaryKey(),
  name: text("name").notNull(),
  credentials: text("credentials"),
  entityType: text("entity_type"), // I or O
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
  crmStatus: text("crm_status").default("new"), // new, contacted, replied, meeting, closed, lost
  crmNotes: text("crm_notes"),
  crmLastContact: timestamp("crm_last_contact"),
  crmNextFollowup: timestamp("crm_next_followup"),
  crmOwner: text("crm_owner"),
  // Enrichment fields
  phone: text("phone"),
  fax: text("fax"),
  email: text("email"),
  website: text("website"),
  taxonomy: text("taxonomy"),
  // Codes stored as JSON string
  codesJson: text("codes_json"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tags = pgTable("tags", {
  id: text("id").primaryKey(), // slugified name
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
  filtersJson: text("filters_json"), // stored filter state
  providerCount: integer("provider_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const crmActivity = pgTable("crm_activity", {
  id: text("id").primaryKey(),
  npi: text("npi").notNull().references(() => providers.npi),
  type: text("type").notNull(), // note, call, email, meeting, status_change
  content: text("content"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: text("created_by"),
});
