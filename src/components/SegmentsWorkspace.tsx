"use client";

import { useMemo } from "react";
import type { Provider, Filters } from "@/lib/types";

interface Segment {
  id: string;
  name: string;
  filters: Filters;
  count: number;
  createdAt: string;
}

const CRM_STATUSES = [
  { value: "new", label: "New", color: "#8888aa" },
  { value: "contacted", label: "Contacted", color: "#6366f1" },
  { value: "replied", label: "Replied", color: "#f59e0b" },
  { value: "meeting", label: "Meeting Set", color: "#06b6d4" },
  { value: "closed", label: "Closed Won", color: "#22c55e" },
  { value: "lost", label: "Lost", color: "#ef4444" },
];

interface Props {
  segments: Segment[];
  data: Provider[];
  customTags: Record<string, string[]>;
  onLoadSegment: (seg: Segment) => void;
  onDeleteSegment: (id: string) => void;
  onSwitchToProviders: () => void;
}

export default function SegmentsWorkspace({ segments, data, customTags, onLoadSegment, onDeleteSegment, onSwitchToProviders }: Props) {
  // Compute stats per segment
  const segmentStats = useMemo(() => {
    return segments.map((seg) => {
      // Re-apply filters to get actual providers
      const providers = filterProviders(data, seg.filters, customTags);
      const totalRev = providers.reduce((s, p) => s + p.revenue_proxy, 0);
      const avgRatio = providers.length > 0 ? providers.reduce((s, p) => s + p.assessment_ratio, 0) / providers.length : 0;
      const totalAssess = providers.reduce((s, p) => s + p.assessment_units, 0);
      const states = [...new Set(providers.map((p) => p.state))].sort();
      const topProviders = [...providers].sort((a, b) => b.revenue_proxy - a.revenue_proxy).slice(0, 5);
      // Tag distribution
      const tagCounts: Record<string, number> = {};
      providers.forEach((p) => {
        (customTags[p.npi] || []).forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
      });
      return { ...seg, providers, totalRev, avgRatio, totalAssess, states, topProviders, tagCounts, liveCount: providers.length };
    });
  }, [segments, data, customTags]);

  // Overall tag summary
  const allTagSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(customTags).forEach((tags) => tags.forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [customTags]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
        <div>
          <h2 className="text-base font-bold text-txt">Segments & Outbound Pipeline</h2>
          <p className="text-[11px] text-dim mt-0.5">Manage your saved segments, track tags, plan outbound waves</p>
        </div>
        <div className="flex gap-2 text-xs">
          <div className="bg-bg border border-border rounded px-3 py-1.5">
            <span className="text-dim">Segments: </span><span className="font-bold text-accent">{segments.length}</span>
          </div>
          <div className="bg-bg border border-border rounded px-3 py-1.5">
            <span className="text-dim">Tags: </span><span className="font-bold text-accent">{allTagSummary.length}</span>
          </div>
          <div className="bg-bg border border-border rounded px-3 py-1.5">
            <span className="text-dim">Tagged Providers: </span><span className="font-bold text-accent">{Object.keys(customTags).length}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Tag Overview */}
        {allTagSummary.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-dim uppercase tracking-widest mb-3">Tag Overview</h3>
            <div className="flex flex-wrap gap-2">
              {allTagSummary.map(([tag, count]) => (
                <div key={tag} className="bg-surface border border-border rounded-lg px-3 py-2 flex items-center gap-2">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-accent/20 text-indigo-light">{tag}</span>
                  <span className="text-xs text-txt font-bold">{count}</span>
                  <span className="text-[10px] text-dim">providers</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Segments */}
        {segmentStats.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-dim text-sm mb-2">No segments saved yet</div>
            <p className="text-dim text-xs mb-4">Go to the Providers tab, apply filters, and click &quot;Save Segment&quot; to create your first outbound group.</p>
            <button onClick={onSwitchToProviders} className="px-4 py-2 rounded border border-accent bg-accent text-white text-xs cursor-pointer hover:bg-accent-dim">
              Go to Providers
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-dim uppercase tracking-widest mb-1">Saved Segments</h3>
            {segmentStats.map((seg) => (
              <div key={seg.id} className="bg-surface border border-border rounded-lg overflow-hidden">
                {/* Segment header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div className="flex items-center gap-3">
                    <h4 className="text-sm font-bold text-txt">{seg.name}</h4>
                    <span className="text-[10px] text-dim">created {new Date(seg.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => { onLoadSegment(seg); onSwitchToProviders(); }} className="px-2.5 py-1 rounded border border-accent bg-accent/10 text-accent text-[11px] cursor-pointer hover:bg-accent/20">
                      View Providers
                    </button>
                    <button onClick={() => onDeleteSegment(seg.id)} className="px-2.5 py-1 rounded border border-border bg-surface2 text-err text-[11px] cursor-pointer hover:bg-border">
                      Delete
                    </button>
                  </div>
                </div>

                {/* Segment stats */}
                <div className="px-4 py-3">
                  <div className="grid grid-cols-5 gap-3 mb-3">
                    <div className="bg-bg rounded p-2">
                      <div className="text-[10px] text-dim uppercase">Providers</div>
                      <div className="text-lg font-bold text-accent">{seg.liveCount.toLocaleString()}</div>
                    </div>
                    <div className="bg-bg rounded p-2">
                      <div className="text-[10px] text-dim uppercase">Revenue</div>
                      <div className="text-lg font-bold text-ok">${Math.round(seg.totalRev).toLocaleString()}</div>
                    </div>
                    <div className="bg-bg rounded p-2">
                      <div className="text-[10px] text-dim uppercase">Assess Units</div>
                      <div className="text-lg font-bold text-txt">{seg.totalAssess.toLocaleString()}</div>
                    </div>
                    <div className="bg-bg rounded p-2">
                      <div className="text-[10px] text-dim uppercase">Avg Ratio</div>
                      <div className="text-lg font-bold text-txt">{(seg.avgRatio * 100).toFixed(1)}%</div>
                    </div>
                    <div className="bg-bg rounded p-2">
                      <div className="text-[10px] text-dim uppercase">States</div>
                      <div className="text-lg font-bold text-txt">{seg.states.length}</div>
                    </div>
                  </div>

                  {/* Top 5 providers in segment */}
                  <div className="mb-2">
                    <div className="text-[10px] text-dim uppercase mb-1">Top Providers</div>
                    <div className="space-y-0.5">
                      {seg.topProviders.map((p) => (
                        <div key={p.npi} className="flex items-center justify-between text-xs py-0.5">
                          <span className="text-dim w-24">{p.npi}</span>
                          <span className="text-txt flex-1 truncate">{p.name}</span>
                          <span className="text-dim w-10 text-center">{p.state}</span>
                          <span className="text-ok w-24 text-right">${p.revenue_proxy.toLocaleString()}</span>
                          <span className="text-dim w-20 text-right">{p.assessment_units} units</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tags in this segment */}
                  {Object.keys(seg.tagCounts).length > 0 && (
                    <div>
                      <div className="text-[10px] text-dim uppercase mb-1">Tags in Segment</div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(seg.tagCounts).sort((a, b) => b[1] - a[1]).map(([tag, count]) => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-accent/20 text-indigo-light">
                            {tag} <span className="text-dim">({count})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Filter summary */}
                  <div className="mt-2 text-[10px] text-dim">
                    Filters: {seg.filters.preset && <span className="text-accent">{seg.filters.preset}</span>}
                    {seg.filters.states.length > 0 && <span> | States: {seg.filters.states.join(", ")}</span>}
                    {seg.filters.minAssessUnits > 0 && <span> | Assess&gt;{seg.filters.minAssessUnits}</span>}
                    {seg.filters.minRevenue > 0 && <span> | Rev&gt;${seg.filters.minRevenue.toLocaleString()}</span>}
                    {seg.filters.minAssessRatio > 0 && <span> | Ratio&gt;{seg.filters.minAssessRatio}</span>}
                    {seg.filters.minComplexity > 0 && <span> | Cmplx&gt;{seg.filters.minComplexity}</span>}
                    {seg.filters.neuroOnly && <span> | Neuro only</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pipeline placeholder */}
        <div className="mt-8 border border-border border-dashed rounded-lg p-6 text-center">
          <div className="text-dim text-sm mb-1">Outbound Pipeline (Coming Next)</div>
          <p className="text-dim text-xs">After NPI enrichment: track outreach status, automate email sequences, log calls and meetings per segment.</p>
          <div className="flex justify-center gap-3 mt-4">
            {CRM_STATUSES.map((s) => (
              <div key={s.value} className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full mb-1" style={{ background: s.color }} />
                <span className="text-[10px] text-dim">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper to re-apply filters
function filterProviders(data: Provider[], filters: Filters, customTags: Record<string, string[]>): Provider[] {
  return data.filter((p) => {
    if (filters.states.length > 0 && !filters.states.includes(p.state)) return false;
    if (p.assessment_units < filters.minAssessUnits) return false;
    if (p.assessment_ratio < filters.minAssessRatio) return false;
    if (p.admin_units < filters.minAdminUnits) return false;
    if (p.revenue_proxy < filters.minRevenue) return false;
    if (p.complexity_score < filters.minComplexity) return false;
    if (filters.neuroOnly && !p.neuro_flag) return false;
    if (filters.orgOnly && p.entity_type !== "O") return false;
    if (filters.indivOnly && p.entity_type !== "I") return false;
    if (filters.preset === "underserved" && p.assessment_ratio > 0.3) return false;
    if (filters.preset === "adhd" && p.neuro_units > p.assessment_units * 0.3) return false;
    if (filters.tagFilter.length > 0) {
      const pTags = customTags[p.npi] || [];
      if (!filters.tagFilter.some((t) => pTags.includes(t))) return false;
    }
    if (filters.search) {
      const hay = `${p.npi} ${p.name} ${p.city} ${p.state} ${p.provider_type}`.toLowerCase();
      if (!hay.includes(filters.search.toLowerCase())) return false;
    }
    return true;
  });
}
