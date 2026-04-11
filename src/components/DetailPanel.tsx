"use client";

import type { Provider } from "@/lib/types";

const GROUP_STYLES: Record<string, { bg: string; text: string }> = {
  ASSESSMENT_CORE: { bg: "rgba(99,102,241,0.2)", text: "#818cf8" },
  TEST_ADMIN: { bg: "rgba(6,182,212,0.2)", text: "#22d3ee" },
  NEURO_DEV: { bg: "rgba(168,85,247,0.2)", text: "#c084fc" },
  INTAKE_NOISE: { bg: "rgba(239,68,68,0.15)", text: "#f87171" },
};

interface Props {
  provider: Provider;
  onClose: () => void;
  onRemoveTag: (tag: string) => void;
}

export default function DetailPanel({ provider: p, onClose, onRemoveTag }: Props) {
  const buckets: { label: string; bg: string; text: string; border: string }[] = [];
  if (p.assessment_units >= 100 && p.assessment_ratio >= 0.4 && p.complexity_score >= 0.25)
    buckets.push({ label: "TOP 5%", bg: "rgba(34,197,94,0.2)", text: "#4ade80", border: "rgba(34,197,94,0.3)" });
  if (p.admin_units >= 50 && p.assessment_units >= 20 && p.revenue_proxy >= 5000)
    buckets.push({ label: "SCALING", bg: "rgba(245,158,11,0.2)", text: "#fbbf24", border: "rgba(245,158,11,0.3)" });
  if (p.admin_units >= 100 && p.assessment_ratio < 0.3)
    buckets.push({ label: "OPPORTUNITY", bg: "rgba(6,182,212,0.2)", text: "#22d3ee", border: "rgba(6,182,212,0.3)" });

  const sortedCodes = Object.entries(p.codes || {}).sort((a, b) => b[1].revenue - a[1].revenue);
  const tags = p.tags || [];

  return (
    <div className="w-96 min-w-96 bg-surface border-l border-border overflow-y-auto p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-bold text-txt">{p.name}</h2>
        <button onClick={onClose} className="px-2 py-0.5 rounded border border-border bg-surface2 text-[10px] text-txt cursor-pointer hover:bg-border">x</button>
      </div>

      <div className="text-[11px] text-dim mb-3">
        NPI: {p.npi} &middot; {p.entity_type === "O" ? "Organization" : "Individual"} &middot; {p.credentials || "—"}
      </div>

      <div className="mb-3 flex gap-1 flex-wrap">
        {buckets.length > 0 ? buckets.map((b) => (
          <span key={b.label} className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: b.bg, color: b.text, border: `1px solid ${b.border}` }}>{b.label}</span>
        )) : (
          <span className="text-[11px] text-dim">No bucket match</span>
        )}
      </div>

      {/* CRM Status */}
      {p.crm_status && (
        <div className="mb-3 text-xs">
          <span className="text-dim">Status: </span>
          <span className="font-semibold text-accent">{p.crm_status}</span>
        </div>
      )}

      {/* Tags */}
      <div className="mb-4 text-xs">
        <span className="text-dim">Tags: </span>
        {tags.length > 0 ? tags.map((t) => (
          <span key={t} onClick={() => onRemoveTag(t)} className="inline-block px-1.5 rounded text-[10px] font-semibold bg-accent/20 text-indigo-light mr-1 cursor-pointer hover:bg-accent/35" title="Click to remove">
            {t} x
          </span>
        )) : (
          <span className="text-dim">none</span>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: "Revenue Proxy", value: `$${p.revenue_proxy.toLocaleString()}`, color: "#22c55e" },
          { label: "Total Revenue", value: `$${p.total_revenue.toLocaleString()}`, color: "" },
          { label: "Assess Units", value: p.assessment_units.toLocaleString(), color: "" },
          { label: "Admin Units", value: p.admin_units.toLocaleString(), color: "" },
          { label: "Assess Ratio", value: `${(p.assessment_ratio * 100).toFixed(1)}%`, color: "" },
          { label: "Complexity", value: `${(p.complexity_score * 100).toFixed(1)}%`, color: "" },
        ].map((m) => (
          <div key={m.label} className="bg-bg border border-border rounded p-2">
            <div className="text-[10px] text-dim uppercase">{m.label}</div>
            <div className="text-base font-bold mt-0.5" style={m.color ? { color: m.color } : undefined}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Contact info if enriched */}
      {(p.phone || p.email) && (
        <div className="mb-4 bg-bg border border-border rounded p-2">
          <div className="text-[10px] text-dim uppercase mb-1">Contact</div>
          {p.phone && <div className="text-xs text-txt">{p.phone}</div>}
          {p.email && <div className="text-xs text-accent">{p.email}</div>}
        </div>
      )}

      <div className="text-[11px] text-dim mb-4">
        {p.city}, {p.state} {p.zip} &middot; {p.provider_type}
      </div>

      <h3 className="text-xs font-semibold mb-2 text-txt">CPT Code Breakdown</h3>
      {sortedCodes.map(([code, data]) => {
        const gs = GROUP_STYLES[data.group];
        return (
          <div key={code} className="flex justify-between items-center py-1 border-b border-border text-xs">
            <span className="font-semibold text-txt">{code}</span>
            <span className="px-1.5 rounded text-[10px] font-semibold" style={gs ? { background: gs.bg, color: gs.text } : undefined}>{data.group}</span>
            <span className="text-dim">{data.units.toLocaleString()} units</span>
            <span className="text-ok">${Math.round(data.revenue).toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
