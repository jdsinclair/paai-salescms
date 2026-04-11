"use client";

import { useState } from "react";
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
  onEnriched?: () => void;
}

export default function DetailPanel({ provider: p, onClose, onRemoveTag, onEnriched }: Props) {
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<Record<string, string> | null>(null);

  const buckets: { label: string; bg: string; text: string; border: string }[] = [];
  if (p.assessment_units >= 100 && p.assessment_ratio >= 0.4 && p.complexity_score >= 0.25)
    buckets.push({ label: "TOP 5%", bg: "rgba(34,197,94,0.2)", text: "#4ade80", border: "rgba(34,197,94,0.3)" });
  if (p.admin_units >= 50 && p.assessment_units >= 20 && p.revenue_proxy >= 5000)
    buckets.push({ label: "SCALING", bg: "rgba(245,158,11,0.2)", text: "#fbbf24", border: "rgba(245,158,11,0.3)" });
  if (p.admin_units >= 100 && p.assessment_ratio < 0.3)
    buckets.push({ label: "OPPORTUNITY", bg: "rgba(6,182,212,0.2)", text: "#22d3ee", border: "rgba(6,182,212,0.3)" });

  const sortedCodes = Object.entries(p.codes || {}).sort((a, b) => b[1].revenue - a[1].revenue);
  const tags = p.tags || [];

  async function handleEnrich() {
    setEnriching(true);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ npi: p.npi }),
      });
      const data = await res.json();
      if (data.ok) {
        setEnrichResult(data.enriched);
        onEnriched?.();
      } else {
        setEnrichResult({ error: data.error || "Failed" });
      }
    } catch {
      setEnrichResult({ error: "Network error" });
    } finally {
      setEnriching(false);
    }
  }

  // Use enriched data if available (from DB or just-fetched)
  const firstName = enrichResult?.firstName || p.first_name || "";
  const lastName = enrichResult?.lastName || p.last_name || "";
  const phone = enrichResult?.phone || p.phone;
  const fax = enrichResult?.fax || p.fax;
  const taxonomy = enrichResult?.taxonomy || p.taxonomy;
  const address1 = enrichResult?.address1 || p.address1;
  const isEnriched = p.enriched || !!enrichResult;
  const displayPhone = phone && phone !== "NO_PHONE" && phone !== "NOT_FOUND" ? phone : null;
  const displayFax = fax && fax !== "NO_PHONE" && fax !== "NOT_FOUND" ? fax : null;

  return (
    <div className="w-96 min-w-96 bg-surface border-l border-border overflow-y-auto p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-bold text-txt">{p.name}</h2>
        <button onClick={onClose} className="px-2 py-0.5 rounded border border-border bg-surface2 text-[10px] text-txt cursor-pointer hover:bg-border">x</button>
      </div>

      {/* NPI Info */}
      <div className="text-[11px] text-dim mb-1">
        NPI: {p.npi} &middot; {p.entity_type === "O" ? "Organization" : "Individual"} &middot; {p.credentials || "—"}
      </div>

      {/* Name breakdown from NPPES */}
      <div className="bg-bg border border-border rounded p-2.5 mb-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] text-dim uppercase">First Name</div>
            <div className="text-xs font-semibold text-txt mt-0.5">{firstName || <span className="text-dim italic">—</span>}</div>
          </div>
          <div>
            <div className="text-[10px] text-dim uppercase">Last Name</div>
            <div className="text-xs font-semibold text-txt mt-0.5">{lastName || <span className="text-dim italic">—</span>}</div>
          </div>
        </div>
        {taxonomy && (
          <div className="mt-2">
            <div className="text-[10px] text-dim uppercase">NPPES Taxonomy</div>
            <div className="text-[11px] text-info mt-0.5">{taxonomy}</div>
          </div>
        )}
        {address1 && (
          <div className="mt-2">
            <div className="text-[10px] text-dim uppercase">Practice Address</div>
            <div className="text-[11px] text-txt mt-0.5">{address1}</div>
          </div>
        )}
        {(displayPhone || displayFax) && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {displayPhone && (
              <div>
                <div className="text-[10px] text-dim uppercase">Phone</div>
                <div className="text-xs text-ok mt-0.5">{displayPhone}</div>
              </div>
            )}
            {displayFax && (
              <div>
                <div className="text-[10px] text-dim uppercase">Fax</div>
                <div className="text-xs text-txt mt-0.5">{displayFax}</div>
              </div>
            )}
          </div>
        )}
        {!isEnriched && (
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="mt-2 w-full px-3 py-1.5 rounded border border-info bg-info/10 text-info text-[11px] cursor-pointer hover:bg-info/20 disabled:opacity-50"
          >
            {enriching ? "Fetching from NPPES..." : "Enrich from NPI Registry"}
          </button>
        )}
        {isEnriched && !firstName && (
          <div className="mt-1 text-[10px] text-dim">Enriched — no additional name data found</div>
        )}
      </div>

      {/* Buckets */}
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

      <div className="text-[11px] text-dim mb-4">
        {p.city}, {p.state} {p.zip} &middot; {p.provider_type}
      </div>

      {/* Code Breakdown */}
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
