import type { Provider } from "./types";

export function generateSalesEmail(p: Provider): { subject: string; body: string; insights: string[] } {
  const firstName = p.first_name || p.name?.split(",")[1]?.trim()?.split(" ")[0] || "there";
  const lastName = p.last_name || p.name?.split(",")[0]?.trim() || "";
  const isOrg = p.entity_type === "O";
  const greeting = isOrg ? `Hi ${p.name} team` : `Hi Dr. ${lastName}`;

  // Determine what kind of practice this is based on data signals
  const isNeuropsych = (p.neuro_units || 0) > 0;
  const isHighVolume = p.assessment_units > 200;
  const isMediumVolume = p.assessment_units > 50 && p.assessment_units <= 200;
  const hasAdminStaff = p.admin_units > 50;
  const isComprehensive = p.complexity_score > 0.25;
  const isScaling = hasAdminStaff && isMediumVolume;
  const assessRatioPct = Math.round(p.assessment_ratio * 100);

  // Build personalized insights
  const insights: string[] = [];

  if (isNeuropsych && isComprehensive) {
    insights.push(`Comprehensive neuropsych practice — multi-hour batteries with high add-on billing`);
  } else if (isNeuropsych) {
    insights.push(`Neuropsych evaluations (96132/33) are a meaningful part of the practice`);
  }

  if (isHighVolume) {
    insights.push(`High-volume testing operation — ${p.assessment_units.toLocaleString()} assessment units/year`);
  } else if (isMediumVolume) {
    insights.push(`Growing assessment volume — ${p.assessment_units.toLocaleString()} units/year`);
  }

  if (hasAdminStaff) {
    insights.push(`Has test administration staff (${p.admin_units.toLocaleString()} admin units) — infrastructure already in place`);
  }

  if (assessRatioPct > 60) {
    insights.push(`Assessment-focused practice — ${assessRatioPct}% of billing is evaluations`);
  } else if (assessRatioPct > 30) {
    insights.push(`Meaningful assessment component — ${assessRatioPct}% of billing mix`);
  }

  // Determine the angle
  let angle: string;
  let painPoint: string;
  let valueProp: string;

  if (isHighVolume && isComprehensive) {
    angle = "high-volume comprehensive";
    painPoint = `Running ${p.assessment_units.toLocaleString()}+ evaluations a year with comprehensive batteries, report writing is probably the biggest bottleneck in your workflow`;
    valueProp = `PsychAssist.ai automates the synthesis of test data into structured clinical narratives — cutting report turnaround from hours to minutes while maintaining the clinical depth your comprehensive evaluations require`;
  } else if (isHighVolume && !isComprehensive) {
    angle = "high-volume standardized";
    painPoint = `At your volume (${p.assessment_units.toLocaleString()}+ evals/year), even small time savings per report compound into days of recovered capacity`;
    valueProp = `PsychAssist.ai generates first-draft reports from your test data in minutes — consistent structure, integrated scores, ready for your clinical review. Practices at your scale typically recover 10-15 hours per week`;
  } else if (isScaling) {
    angle = "scaling practice";
    painPoint = `You've invested in admin staff to scale test administration — but report writing often becomes the new bottleneck as volume grows`;
    valueProp = `PsychAssist.ai helps you match your report output to your testing capacity. It synthesizes scores into clinical narratives so your psychologists can review and finalize rather than write from scratch`;
  } else if (isNeuropsych) {
    angle = "neuropsych specialist";
    painPoint = `Neuropsych reports are some of the most complex in the field — integrating cognitive, behavioral, and functional data into a coherent clinical narrative takes real time`;
    valueProp = `PsychAssist.ai is built for this complexity. It ingests your full battery results, cross-references normative data, identifies patterns across domains, and generates integrated neuropsych reports that capture the clinical reasoning — not just the numbers`;
  } else {
    angle = "assessment practice";
    painPoint = `If you're like most assessment psychologists, report writing takes longer than the evaluation itself`;
    valueProp = `PsychAssist.ai synthesizes your test data into structured clinical reports — handling score integration, normative comparisons, and narrative generation so you can focus on clinical interpretation rather than document formatting`;
  }

  const city = p.location_city || p.city || "";
  const state = p.location_state || p.state || "";
  const locationRef = city && state ? ` in ${city}, ${state}` : "";

  const subject = isNeuropsych
    ? `Report writing for neuropsych evaluations${locationRef}`
    : isHighVolume
    ? `Scaling report output at your assessment volume`
    : `Faster psych assessment reports — PsychAssist.ai`;

  const body = `${greeting},

${painPoint}.

I wanted to introduce PsychAssist.ai — ${valueProp}.

A few things that caught my attention about your practice:
${insights.map((i) => `  • ${i}`).join("\n")}

Would you be open to a 15-minute call this week to see if it's a fit? Happy to show you a demo with a sample report in your specialty area.

Best,
[Your Name]
PsychAssist.ai

P.S. We work with ${isNeuropsych ? "neuropsych" : "assessment"} practices across the country and consistently hear that report writing is the #1 time sink. If that resonates, I'd love to chat.`;

  return { subject, body, insights };
}
