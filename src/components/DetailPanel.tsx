"use client";

import type { Provider } from "@/lib/types";

const GROUP_COLORS: Record<string, string> = {
  ASSESSMENT_CORE: "bg-[rgba(99,102,241,0.2)] text-[#818cf8]",
  TEST_ADMIN: "bg-[rgba(6,182,212,0.2)] text-[#22d3ee]",
  NEURO_DEV: "bg-[rgba(168,85,247,0.2)] text-[#c084fc]",
  INTAKE_NOISE: "bg-[rgba(239,68,68,0.15)] text-[#f87171]",
};

interface Props {
  provider: Provider;
  customTags: string[];
  onClose: () => void;
  onRemoveTag: (tag: string) => void;
}

export default function DetailPanel({ provider: p, customTags, onClose, onRemoveTag }: Props) {
  const buckets: { label: string; cls: string }[] = [];
  if (p.assessment_units >= 100 && p.assessment_ratio >= 0.4 && p.complexity_score >= 0.25)
    buckets.push({ label: "TOP 5%", cls: "bg-[rgba(34,197,94,0.2)] text-[#4ade80] border border-[rgba(34,197,94,0.3)]" });
  if (p.admin_units >= 50 && p.assessment_units >= 20 && p.revenue_proxy >= 5000)
    buckets.push({ label: "SCALING", cls: "bg-[rgba(245,158,11,0.2)] text-[#fbbf24] border border-[rgba(245,158,11,0.3)]" });
  if (p.admin_units >= 100 && p.assessment_ratio < 0.3)
    buckets.push({ label: "OPPORTUNITY", cls: "bg-[rgba(6,182,212,0.2)] text-[#22d3ee] border border-[rgba(6,182,212,0.3)]" });

  const sortedCodes = Object.entries(p.codes).sort((a, b) => b[1].revenue - a[1].revenue);

  return (
    <div className="w-96 min-w-96 bg-[var(--surface)] border-l border-[var(--border)] overflow-y-auto p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-bold">{p.name}</h2>
        <button onClick={onClose} className="px-2 py-0.5 rounded border border-[var(--border)] bg-[var(--surface2)] text-[10px] cursor-pointer hover:bg-[var(--border)]">x</button>
      </div>

      <div className="text-[11px] text-[var(--text-dim)] mb-3">
        NPI: {p.npi} · {p.entity_type === "O" ? "Organization" : "Individual"} · {p.credentials || "—"}
      </div>

      {/* Buckets */}
      <div className="mb-3 flex gap-1 flex-wrap">
        {buckets.length > 0 ? buckets.map((b) => (
          <span key={b.label} className={`px-2 py-0.5 rounded text-[10px] font-semibold ${b.cls}`}>{b.label}</span>
        )) : (
          <span className="text-[11px] text-[var(--text-dim)]">No bucket match</span>
        )}
      </div>

      {/* Tags */}
      <div className="mb-4 text-xs">
        <span className="text-[var(--text-dim)]">Tags: </span>
        {customTags.length > 0 ? customTags.map((t) => (
          <span key={t} onClick={() => onRemoveTag(t)} className="inline-block px-1.5 py-0 rounded text-[10px] font-semibold bg-[rgba(99,102,241,0.2)] text-[#818cf8] mr-1 cursor-pointer hover:bg-[rgba(99,102,241,0.35)]" title="Click to remove">
            {t} x
          </span>
        )) : (
          <span className="text-[var(--text-dim)]">none</span>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: "Revenue Proxy", value: `$${p.revenue_proxy.toLocaleString()}`, color: "text-[var(--green)]" },
          { label: "Total Revenue", value: `$${p.total_revenue.toLocaleString()}`, color: "" },
          { label: "Assess Units", value: p.assessment_units.toLocaleString(), color: "" },
          { label: "Admin Units", value: p.admin_units.toLocaleString(), color: "" },
          { label: "Assess Ratio", value: `${(p.assessment_ratio * 100).toFixed(1)}%`, color: "" },
          { label: "Complexity", value: `${(p.complexity_score * 100).toFixed(1)}%`, color: "" },
        ].map((m) => (
          <div key={m.label} className="bg-[var(--bg)] border border-[var(--border)] rounded p-2">
            <div className="text-[10px] text-[var(--text-dim)] uppercase">{m.label}</div>
            <div className={`text-base font-bold mt-0.5 ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Location */}
      <div className="text-[11px] text-[var(--text-dim)] mb-4">
        {p.city}, {p.state} {p.zip} · {p.provider_type}
      </div>

      {/* Code Breakdown */}
      <h3 className="text-xs font-semibold mb-2">CPT Code Breakdown</h3>
      <div className="space-y-0">
        {sortedCodes.map(([code, data]) => (
          <div key={code} className="flex justify-between items-center py-1 border-b border-[var(--border)] text-xs">
            <span className="font-semibold">{code}</span>
            <span className={`px-1.5 py-0 rounded text-[10px] font-semibold ${GROUP_COLORS[data.group] || ""}`}>
              {data.group}
            </span>
            <span className="text-[var(--text-dim)]">{data.units.toLocaleString()} units</span>
            <span className="text-[var(--green)]">${Math.round(data.revenue).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
