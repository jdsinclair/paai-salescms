import type { Provider, Filters } from "./types";

export interface ProvidersResponse {
  providers: Provider[];
  total: number;
  page: number;
  limit: number;
  stats: {
    totalRevenue: number;
    totalAssess: number;
    avgRatio: number;
  };
  maxRevenue: number;
}

export interface TagData {
  id: string;
  name: string;
  color: string;
  count: number;
}

export interface SegmentData {
  id: string;
  name: string;
  filters: Filters;
  providerCount: number;
  emailSubject?: string;
  emailBody?: string;
  hasEmail?: boolean;
  queueStats?: { total: number; pending: number; queued: number; skipped: number; sent: number } | null;
  createdAt: string;
}

// Build query string from filters
function filtersToParams(filters: Filters, sort: { field: string; dir: string }, page: number, limit: number): URLSearchParams {
  const p = new URLSearchParams();
  p.set("page", String(page));
  p.set("limit", String(limit));
  p.set("sort", sort.field);
  p.set("dir", sort.dir);

  if (filters.states.length > 0) p.set("state", filters.states.join(","));
  if (filters.minAssessUnits > 0) p.set("minAssessUnits", String(filters.minAssessUnits));
  if (filters.minAssessRatio > 0) p.set("minAssessRatio", String(filters.minAssessRatio));
  if (filters.minAdminUnits > 0) p.set("minAdminUnits", String(filters.minAdminUnits));
  if (filters.minRevenue > 0) p.set("minRevenue", String(filters.minRevenue));
  if (filters.minComplexity > 0) p.set("minComplexity", String(filters.minComplexity));
  if (filters.neuroOnly) p.set("neuroOnly", "true");
  if (filters.orgOnly) p.set("entityType", "O");
  if (filters.indivOnly) p.set("entityType", "I");
  if (filters.search) p.set("search", filters.search);
  if (filters.tagFilter.length > 0) p.set("tagFilter", filters.tagFilter.join(","));
  if (filters.hasEmail) p.set("hasEmail", "true");
  if (filters.hasPhone) p.set("hasPhone", "true");
  if (filters.minEmailConfidence > 0) p.set("minEmailConfidence", String(filters.minEmailConfidence));
  if (filters.minEvalPatients > 0) p.set("minEvalPatients", String(filters.minEvalPatients));
  if (filters.maxAvgHours > 0) p.set("maxAvgHours", String(filters.maxAvgHours));

  // Preset-specific: underserved caps ratio at 0.3
  if (filters.preset === "underserved") p.set("maxAssessRatio", "0.3");

  return p;
}

export async function fetchProviders(
  filters: Filters,
  sort: { field: string; dir: string },
  page: number,
  limit: number
): Promise<ProvidersResponse> {
  const params = filtersToParams(filters, sort, page, limit);
  const res = await fetch(`/api/providers?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch providers");
  return res.json();
}

export async function fetchStates(): Promise<string[]> {
  const res = await fetch("/api/states");
  if (!res.ok) return [];
  const data = await res.json();
  return data.states;
}

export async function fetchTags(): Promise<TagData[]> {
  const res = await fetch("/api/tags");
  if (!res.ok) return [];
  const data = await res.json();
  return data.tags;
}

export async function applyTagToProviders(tagName: string, npis: string[]): Promise<void> {
  await fetch("/api/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: tagName, npis }),
  });
}

export async function removeTagFromProvider(tagId: string, npi: string): Promise<void> {
  await fetch("/api/tags", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tagId, npi }),
  });
}

export async function fetchSegments(): Promise<SegmentData[]> {
  const res = await fetch("/api/segments");
  if (!res.ok) return [];
  const data = await res.json();
  return data.segments;
}

export async function saveSegment(name: string, filters: Filters, providerCount: number): Promise<string> {
  const res = await fetch("/api/segments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, filters, providerCount }),
  });
  const data = await res.json();
  return data.id;
}

export async function deleteSegmentApi(id: string): Promise<void> {
  await fetch("/api/segments", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

export async function updateProvider(npi: string, updates: Record<string, string | null>): Promise<void> {
  await fetch("/api/providers", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ npi, ...updates }),
  });
}

// Export CSV from a set of providers (fetches all matching, no pagination)
export async function fetchAllForExport(
  filters: Filters,
  sort: { field: string; dir: string }
): Promise<Provider[]> {
  // Fetch in chunks of 1000
  const all: Provider[] = [];
  let page = 1;
  const limit = 1000;
  while (true) {
    const data = await fetchProviders(filters, sort, page, limit);
    all.push(...data.providers);
    if (all.length >= data.total) break;
    page++;
  }
  return all;
}
