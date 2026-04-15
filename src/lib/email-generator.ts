import type { Provider } from "./types";

// Fix NPPES ALL-CAPS names to proper case
function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(s.includes("-") ? "-" : " ");
}

export function generateSalesEmail(p: Provider): { subject: string; body: string; insights: string[] } {
  const lastName = titleCase(p.last_name || p.name?.split(",")[0]?.trim());
  const firstName = titleCase(p.first_name || p.name?.split(",")[1]?.trim()?.split(" ")[0]);
  const isOrg = p.entity_type === "O";
  const greeting = isOrg ? `Dear ${titleCase(p.name)} team` : `Dear Dr. ${lastName}`;

  const evalCount = p.eval_patients || 0;
  const avgHrs = p.avg_eval_hours || 0;
  const isNeuropsych = (p.neuro_units || 0) > 0;

  // Build volume description
  let volumePhrase: string;
  if (evalCount > 200) {
    volumePhrase = `process over ${evalCount.toLocaleString()} evaluations annually`;
  } else if (evalCount > 50) {
    volumePhrase = `run a substantial assessment practice with ${evalCount.toLocaleString()}+ evaluations per year`;
  } else if (evalCount > 0) {
    volumePhrase = `conduct ${isNeuropsych ? "neuropsychological" : "psychological"} evaluations as part of your practice`;
  } else {
    volumePhrase = `are actively involved in ${isNeuropsych ? "neuropsychological" : "psychological"} assessment`;
  }

  // Build insights
  const insights: string[] = [];
  if (evalCount > 0) insights.push(`${evalCount.toLocaleString()} evaluations/year (based on Medicare base codes)`);
  if (avgHrs > 0) insights.push(`${avgHrs.toFixed(1)} average hours per evaluation`);
  if (p.admin_units > 50) insights.push(`Active test administration staff (${p.admin_units.toLocaleString()} admin units)`);
  if (isNeuropsych) insights.push(`Neuropsych-focused practice (96132/33 present)`);
  if (p.assessment_ratio > 0.5) insights.push(`Assessment-focused: ${(p.assessment_ratio * 100).toFixed(0)}% of billing`);

  const city = titleCase(p.location_city || p.city);
  const state = p.location_state || p.state || "";

  const subject = `Quick intro — report writing for ${isNeuropsych ? "neuropsych" : "psych"} evals`;

  const body = `${greeting},

Apologies for the cold outreach. I'm Dr. Barnes, founder of PsychAssist.ai and a fellow assessment psychologist.

My platform is the leading tool to accelerate holistic psychological report writing — keeping your clinical voice, not AI slop, not GPT prayer circles.

I noticed via Medicare data that you ${volumePhrase}${city ? ` out of ${city}, ${state}` : ""}. We work with a lot of doctors like you, and we know we can make this exponentially easier — better visuals, holistic data integration, earlier diagnostic clarity, all while preserving the way you write.

Would love to show you what we're building. If you're open to 15 minutes, grab a time here:

https://calendly.com/psychassist

Best,
Dr. Barnes
Founder, PsychAssist.ai`;

  return { subject, body, insights };
}
