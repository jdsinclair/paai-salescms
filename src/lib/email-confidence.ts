// Score email confidence 0-100
// Higher = more likely to reach a real person who can make a decision

const GENERIC_PREFIXES = [
  "info", "contact", "hello", "admin", "office", "support", "help",
  "general", "reception", "mail", "team", "sales", "billing",
  "inquiry", "inquiries", "questions", "feedback", "service",
  "records", "scheduling", "appointments", "referrals", "intake",
  "frontdesk", "front.desk", "front_desk",
];

const ROLE_PREFIXES = [
  "director", "manager", "owner", "ceo", "cfo", "hr",
  "marketing", "operations", "clinical",
];

const JUNK_DOMAINS = [
  "example.com", "test.com", "noreply", "no-reply", "donotreply",
];

const DIRECT_MESSAGING_PATTERNS = [
  "direct.", ".direct.", "directtrust", "hisp.",
  "ehrdirect.", "cernerdirect.", "allscriptsdirect.",
  "athenahealth.com", // Direct Messaging via Athena
];

export interface EmailConfidence {
  score: number;       // 0-100
  label: string;       // "high" | "medium" | "low" | "generic" | "direct_messaging"
  reason: string;
  color: string;       // for UI
}

export function scoreEmail(email: string | null | undefined, firstName?: string | null, lastName?: string | null): EmailConfidence {
  if (!email || !email.includes("@")) {
    return { score: 0, label: "none", reason: "No email", color: "#8888aa" };
  }

  const lower = email.toLowerCase().trim();
  const [localPart, domain] = lower.split("@");

  // Check junk/invalid
  if (JUNK_DOMAINS.some((d) => domain.includes(d))) {
    return { score: 0, label: "invalid", reason: "Invalid/test domain", color: "#ef4444" };
  }

  // Check Direct Messaging (health info exchange, not personal inbox)
  if (DIRECT_MESSAGING_PATTERNS.some((p) => lower.includes(p))) {
    return { score: 15, label: "direct_messaging", reason: "Health info exchange address — not a personal inbox", color: "#f59e0b" };
  }

  // Check generic prefixes
  const isGeneric = GENERIC_PREFIXES.some((prefix) => {
    return localPart === prefix || localPart.startsWith(prefix + "@") || localPart.startsWith(prefix + ".");
  });

  if (isGeneric) {
    return { score: 30, label: "generic", reason: `Generic mailbox (${localPart}@) — may reach front desk, not the provider`, color: "#f59e0b" };
  }

  // Check role-based
  const isRole = ROLE_PREFIXES.some((prefix) => localPart.startsWith(prefix));
  if (isRole) {
    return { score: 40, label: "role", reason: "Role-based email — reaches a function, not a specific person", color: "#f59e0b" };
  }

  // Check if email contains the provider's name (high confidence)
  const hasFirstName = firstName && firstName.length > 2 && localPart.includes(firstName.toLowerCase());
  const hasLastName = lastName && lastName.length > 2 && localPart.includes(lastName.toLowerCase());

  if (hasFirstName && hasLastName) {
    return { score: 95, label: "high", reason: "Personal email — matches first + last name", color: "#22c55e" };
  }

  if (hasLastName) {
    return { score: 85, label: "high", reason: "Personal email — matches last name", color: "#22c55e" };
  }

  if (hasFirstName) {
    return { score: 75, label: "medium", reason: "Likely personal — matches first name", color: "#06b6d4" };
  }

  // Check if it looks like a personal email pattern (initials, name-like)
  const looksPersonal = /^[a-z]{1,3}\.[a-z]+|^[a-z]+\.[a-z]+|^[a-z]+[0-9]{0,4}$/.test(localPart);
  if (looksPersonal && !isGeneric) {
    return { score: 60, label: "medium", reason: "Likely personal email pattern — couldn't verify against provider name", color: "#06b6d4" };
  }

  // Default — has an email but can't determine confidence
  return { score: 50, label: "medium", reason: "Email found — confidence unknown", color: "#06b6d4" };
}
