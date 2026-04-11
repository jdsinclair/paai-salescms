export interface CodeDetail {
  units: number;
  revenue: number;
  group: string;
}

export interface Provider {
  npi: string;
  name: string;
  credentials: string;
  entity_type: string;
  city: string;
  state: string;
  zip: string;
  provider_type: string;
  codes: Record<string, CodeDetail>;
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
  // CRM fields (from DB)
  crm_status?: string;
  crm_notes?: string;
  crm_last_contact?: string;
  crm_next_followup?: string;
  crm_owner?: string;
  phone?: string;
  fax?: string;
  email?: string;
  website?: string;
  tags?: string[];
}

export interface Filters {
  states: string[];
  minAssessUnits: number;
  minAssessRatio: number;
  minAdminUnits: number;
  minRevenue: number;
  minComplexity: number;
  neuroOnly: boolean;
  orgOnly: boolean;
  indivOnly: boolean;
  search: string;
  preset: string;
  tagFilter: string[];
}

export interface Segment {
  id: string;
  name: string;
  filters: Filters;
  providerCount: number;
  createdAt: string;
}

export const CRM_STATUSES = [
  { value: "new", label: "New", color: "#8888aa" },
  { value: "contacted", label: "Contacted", color: "#6366f1" },
  { value: "replied", label: "Replied", color: "#f59e0b" },
  { value: "meeting", label: "Meeting Set", color: "#06b6d4" },
  { value: "closed", label: "Closed Won", color: "#22c55e" },
  { value: "lost", label: "Lost", color: "#ef4444" },
] as const;
