import type { Provider } from "./types";

function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .split(/[\s-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(s.includes("-") ? "-" : " ");
}

// Default template
export const DEFAULT_SUBJECT = `Quick intro — report writing for {{eval_type}} evals`;
export const DEFAULT_BODY = `Dear Dr. {{last_name}},

Apologies for the cold outreach. I'm Dr. Barnes, founder of PsychAssist.ai and a fellow assessment psychologist.

My platform is the leading tool to accelerate holistic psychological report writing — keeping your clinical voice, not AI slop, not GPT prayer circles.

I noticed via Medicare data that you {{volume_phrase}}{{location_phrase}}. We work with a lot of doctors like you, and we know we can make this exponentially easier — better visuals, holistic data integration, earlier diagnostic clarity, all while preserving the way you write.

Would love to show you what we're building. If you're open to 15 minutes, grab a time here:

https://calendly.com/psychassist

Best,
Dr. Barnes
Founder, PsychAssist.ai`;

// All available variables
export const TEMPLATE_VARIABLES = [
  { key: "first_name", desc: "Provider first name (title case)" },
  { key: "last_name", desc: "Provider last name (title case)" },
  { key: "full_name", desc: "Full name (title case)" },
  { key: "credentials", desc: "Credentials (e.g. Ph.D.)" },
  { key: "city", desc: "Practice city" },
  { key: "state", desc: "Practice state" },
  { key: "eval_count", desc: "Number of evaluations/year" },
  { key: "eval_type", desc: "'neuropsych' or 'psych'" },
  { key: "avg_hours", desc: "Average hours per evaluation" },
  { key: "volume_phrase", desc: "Auto-generated volume description" },
  { key: "location_phrase", desc: "' out of City, ST' or empty" },
  { key: "provider_type", desc: "Specialty (e.g. Psychologist, Clinical)" },
  { key: "npi", desc: "NPI number" },
];

export function buildVariables(p: Provider): Record<string, string> {
  const lastName = titleCase(p.last_name || p.name?.split(",")[0]?.trim());
  const firstName = titleCase(p.first_name || p.name?.split(",")[1]?.trim()?.split(" ")[0]);
  const evalCount = p.eval_patients || 0;
  const isNeuropsych = (p.neuro_units || 0) > 0;
  const city = titleCase(p.location_city || p.city);
  const state = p.location_state || p.state || "";

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

  return {
    first_name: firstName,
    last_name: lastName,
    full_name: `${firstName} ${lastName}`.trim(),
    credentials: p.credentials || "",
    city,
    state,
    eval_count: evalCount.toLocaleString(),
    eval_type: isNeuropsych ? "neuropsych" : "psych",
    avg_hours: (p.avg_eval_hours || 0).toFixed(1),
    volume_phrase: volumePhrase,
    location_phrase: city && state ? ` out of ${city}, ${state}` : "",
    provider_type: p.provider_type || "",
    npi: p.npi,
  };
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

export function generateSalesEmail(p: Provider, customSubject?: string, customBody?: string): { subject: string; body: string; insights: string[] } {
  const vars = buildVariables(p);
  const subject = renderTemplate(customSubject || DEFAULT_SUBJECT, vars);
  const body = renderTemplate(customBody || DEFAULT_BODY, vars);

  const insights: string[] = [];
  const evalCount = p.eval_patients || 0;
  if (evalCount > 0) insights.push(`${evalCount.toLocaleString()} evaluations/year`);
  if (p.avg_eval_hours && p.avg_eval_hours > 0) insights.push(`${p.avg_eval_hours.toFixed(1)} avg hours per eval`);
  if (p.admin_units > 50) insights.push(`Active test admin staff (${p.admin_units.toLocaleString()} units)`);
  if ((p.neuro_units || 0) > 0) insights.push(`Neuropsych-focused`);

  return { subject, body, insights };
}
