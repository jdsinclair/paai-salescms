import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function run() {
  const rows = await sql`SELECT npi, codes_json, revenue_proxy FROM providers WHERE codes_json IS NOT NULL AND assessment_units > 0`;
  console.log(`Computing for ${rows.length} providers`);
  let updated = 0;

  for (const r of rows) {
    const codes = JSON.parse(r.codes_json || "{}");
    const base96130 = codes["96130"]?.units || 0;
    const base96132 = codes["96132"]?.units || 0;
    const base96136 = codes["96136"]?.units || 0;
    const base96138 = codes["96138"]?.units || 0;
    const addon96131 = codes["96131"]?.units || 0;
    const addon96133 = codes["96133"]?.units || 0;

    const evalPatients = base96130 + base96132;
    const adminPatients = base96136 + base96138;
    const totalAssessUnits = base96130 + addon96131 + base96132 + addon96133;
    const avgHours = evalPatients > 0 ? Math.round((totalAssessUnits / evalPatients) * 10) / 10 : 0;
    const revPerPatient = evalPatients > 0 ? Math.round((r.revenue_proxy || 0) / evalPatients) : 0;

    await sql`UPDATE providers SET eval_patients = ${evalPatients}, admin_patients = ${adminPatients}, avg_eval_hours = ${avgHours}, revenue_per_patient = ${revPerPatient} WHERE npi = ${r.npi}`;
    updated++;
    if (updated % 500 === 0) console.log(`  ${updated}/${rows.length}`);
  }

  console.log(`Done: ${updated}`);
  const stats = await sql`
    SELECT count(*) FILTER (WHERE eval_patients > 0) as with_patients,
           round(avg(eval_patients) FILTER (WHERE eval_patients > 0)::numeric, 0) as avg_patients,
           round(avg(avg_eval_hours) FILTER (WHERE eval_patients > 0)::numeric, 1) as avg_hrs,
           round(avg(revenue_per_patient) FILTER (WHERE eval_patients > 0)::numeric, 0) as avg_rev_per_patient
    FROM providers WHERE assessment_units > 0
  `;
  console.log("Stats:", stats[0]);
}

run().catch(console.error);
