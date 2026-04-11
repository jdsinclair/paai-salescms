"use client";

import { useEffect, useState } from "react";
import type { Filters } from "@/lib/types";
import type { TagData, SegmentData, ProvidersResponse } from "@/lib/api";
import { fetchProviders } from "@/lib/api";

const CRM_STATUSES = [
  { value: "new", label: "New", color: "#8888aa" },
  { value: "contacted", label: "Contacted", color: "#6366f1" },
  { value: "replied", label: "Replied", color: "#f59e0b" },
  { value: "meeting", label: "Meeting Set", color: "#06b6d4" },
  { value: "closed", label: "Closed Won", color: "#22c55e" },
  { value: "lost", label: "Lost", color: "#ef4444" },
];

interface SegmentStats {
  segment: SegmentData;
  data: ProvidersResponse | null;
  loading: boolean;
}

interface Props {
  segments: SegmentData[];
  dbTags: TagData[];
  onLoadSegment: (seg: SegmentData) => void;
  onDeleteSegment: (id: string) => void;
  onSwitchToProviders: () => void;
}

export default function SegmentsWorkspace({ segments, dbTags, onLoadSegment, onDeleteSegment, onSwitchToProviders }: Props) {
  const [segmentStats, setSegmentStats] = useState<SegmentStats[]>([]);

  // Fetch stats for each segment from the API
  useEffect(() => {
    const initial = segments.map((s) => ({ segment: s, data: null as ProvidersResponse | null, loading: true }));
    setSegmentStats(initial);

    segments.forEach((seg, i) => {
      fetchProviders(seg.filters, { field: "revenue_proxy", dir: "desc" }, 1, 5)
        .then((data) => {
          setSegmentStats((prev) => prev.map((ss, j) => j === i ? { ...ss, data, loading: false } : ss));
        })
        .catch(() => {
          setSegmentStats((prev) => prev.map((ss, j) => j === i ? { ...ss, loading: false } : ss));
        });
    });
  }, [segments]);

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
            <span className="text-dim">Tags: </span><span className="font-bold text-accent">{dbTags.length}</span>
          </div>
          <div className="bg-bg border border-border rounded px-3 py-1.5">
            <span className="text-dim">Tagged: </span><span className="font-bold text-accent">{dbTags.reduce((s, t) => s + t.count, 0)}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Tag Overview */}
        {dbTags.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-dim uppercase tracking-widest mb-3">Tag Overview</h3>
            <div className="flex flex-wrap gap-2">
              {dbTags.map((tag) => (
                <div key={tag.id} className="bg-surface border border-border rounded-lg px-3 py-2 flex items-center gap-2">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-accent/20 text-indigo-light">{tag.name}</span>
                  <span className="text-xs text-txt font-bold">{tag.count}</span>
                  <span className="text-[10px] text-dim">providers</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Segments */}
        {segments.length === 0 ? (
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
            {segmentStats.map((ss) => {
              const seg = ss.segment;
              const d = ss.data;
              return (
                <div key={seg.id} className="bg-surface border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <h4 className="text-sm font-bold text-txt">{seg.name}</h4>
                      <span className="text-[10px] text-dim">created {new Date(seg.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => onLoadSegment(seg)} className="px-2.5 py-1 rounded border border-accent bg-accent/10 text-accent text-[11px] cursor-pointer hover:bg-accent/20">
                        View Providers
                      </button>
                      <button onClick={() => onDeleteSegment(seg.id)} className="px-2.5 py-1 rounded border border-border bg-surface2 text-err text-[11px] cursor-pointer hover:bg-border">
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="px-4 py-3">
                    {ss.loading ? (
                      <div className="flex items-center gap-2 text-dim text-xs">
                        <div className="w-3 h-3 border-2 border-border border-t-accent rounded-full animate-spin" />
                        Loading stats...
                      </div>
                    ) : d ? (
                      <>
                        <div className="grid grid-cols-4 gap-3 mb-3">
                          <div className="bg-bg rounded p-2">
                            <div className="text-[10px] text-dim uppercase">Providers</div>
                            <div className="text-lg font-bold text-accent">{d.total.toLocaleString()}</div>
                          </div>
                          <div className="bg-bg rounded p-2">
                            <div className="text-[10px] text-dim uppercase">Revenue</div>
                            <div className="text-lg font-bold text-ok">${Math.round(d.stats.totalRevenue).toLocaleString()}</div>
                          </div>
                          <div className="bg-bg rounded p-2">
                            <div className="text-[10px] text-dim uppercase">Assess Units</div>
                            <div className="text-lg font-bold text-txt">{Math.round(d.stats.totalAssess).toLocaleString()}</div>
                          </div>
                          <div className="bg-bg rounded p-2">
                            <div className="text-[10px] text-dim uppercase">Avg Ratio</div>
                            <div className="text-lg font-bold text-txt">{(d.stats.avgRatio * 100).toFixed(1)}%</div>
                          </div>
                        </div>

                        {/* Top 5 */}
                        <div className="mb-2">
                          <div className="text-[10px] text-dim uppercase mb-1">Top Providers</div>
                          {d.providers.map((p) => (
                            <div key={p.npi} className="flex items-center justify-between text-xs py-0.5">
                              <span className="text-dim w-24">{p.npi}</span>
                              <span className="text-txt flex-1 truncate">{p.name}</span>
                              <span className="text-dim w-10 text-center">{p.state}</span>
                              <span className="text-ok w-24 text-right">${p.revenue_proxy.toLocaleString()}</span>
                              <span className="text-dim w-20 text-right">{p.assessment_units} units</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-dim text-xs">Failed to load stats</div>
                    )}

                    {/* Filter summary */}
                    <div className="mt-2 text-[10px] text-dim">
                      Filters: {seg.filters.preset && <span className="text-accent">{seg.filters.preset}</span>}
                      {seg.filters.states?.length > 0 && <span> | States: {seg.filters.states.join(", ")}</span>}
                      {seg.filters.minAssessUnits > 0 && <span> | Assess&gt;{seg.filters.minAssessUnits}</span>}
                      {seg.filters.minRevenue > 0 && <span> | Rev&gt;${seg.filters.minRevenue.toLocaleString()}</span>}
                      {seg.filters.minAssessRatio > 0 && <span> | Ratio&gt;{seg.filters.minAssessRatio}</span>}
                      {seg.filters.minComplexity > 0 && <span> | Cmplx&gt;{seg.filters.minComplexity}</span>}
                      {seg.filters.neuroOnly && <span> | Neuro only</span>}
                    </div>
                  </div>
                </div>
              );
            })}
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
