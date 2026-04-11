import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { providers } from "../src/lib/schema";
import fs from "fs";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

interface ProviderData {
  npi: string;
  name: string;
  credentials: string;
  entity_type: string;
  city: string;
  state: string;
  zip: string;
  provider_type: string;
  codes: Record<string, { units: number; revenue: number; group: string }>;
  total_units: number;
  assessment_units: number;
  admin_units: number;
  addon_units: number;
  neuro_units: number;
  revenue_proxy: number;
  total_revenue: number;
  assessment_ratio: number;
  complexity_score: number;
  neuro_flag: boolean;
}

async function seed() {
  console.log("Loading provider data...");
  const raw = JSON.parse(fs.readFileSync("public/providers_data.json", "utf-8"));
  const data: ProviderData[] = raw.providers;
  console.log(`Loaded ${data.length} providers`);

  // Insert in batches of 500
  const BATCH = 500;
  for (let i = 0; i < data.length; i += BATCH) {
    const batch = data.slice(i, i + BATCH);
    const rows = batch.map((p) => ({
      npi: p.npi,
      name: p.name,
      credentials: p.credentials || null,
      entityType: p.entity_type,
      city: p.city,
      state: p.state,
      zip: p.zip,
      providerType: p.provider_type,
      totalUnits: p.total_units,
      assessmentUnits: p.assessment_units,
      adminUnits: p.admin_units,
      addonUnits: p.addon_units,
      neuroUnits: p.neuro_units,
      revenueProxy: p.revenue_proxy,
      totalRevenue: p.total_revenue,
      assessmentRatio: p.assessment_ratio,
      complexityScore: p.complexity_score,
      neuroFlag: p.neuro_flag,
      codesJson: JSON.stringify(p.codes),
      crmStatus: "new" as const,
    }));

    await db.insert(providers).values(rows).onConflictDoNothing();
    console.log(`  Inserted ${Math.min(i + BATCH, data.length)} / ${data.length}`);
  }

  console.log("Done seeding!");
}

seed().catch(console.error);
