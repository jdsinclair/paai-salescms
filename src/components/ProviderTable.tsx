"use client";

import type { Provider } from "@/lib/types";

const GROUP_TAGS: Record<string, { label: string; bg: string; text: string }> = {
  ASSESSMENT_CORE: { label: "ASSESS", bg: "rgba(99,102,241,0.2)", text: "#818cf8" },
  TEST_ADMIN: { label: "ADMIN", bg: "rgba(6,182,212,0.2)", text: "#22d3ee" },
  NEURO_DEV: { label: "NEURO", bg: "rgba(168,85,247,0.2)", text: "#c084fc" },
  INTAKE_NOISE: { label: "NOISE", bg: "rgba(239,68,68,0.15)", text: "#f87171" },
};

const TOOLTIPS: Record<string, string> = {
  npi: "National Provider Identifier — unique 10-digit ID. Use this to enrich with NPPES contact data.",
  provider: "Last, First name (individuals) or org name. Entity type I=Individual, O=Organization.",
  st: "Practice state. Use sidebar multi-select for regional campaigns.",
  type: "CMS provider taxonomy (e.g. Clinical Psychologist, Neuropsychologist).",
  revenue: "Assessment-only Medicare allowed $ (96130-33). Units x avg allowed. #1 sort signal.",
  assess: "Total units from 96130 (psych eval 1st hr), 96131 (+hr), 96132 (neuropsych 1st hr), 96133 (+hr).",
  admin: "Units from 96136-39 (test administration). High = technicians running tests at scale.",
  patients: "Number of unique evaluations based on base codes (96130 + 96132). Each base code is billed once per patient — this is your real patient count.",
  avghrs: "Average hours per evaluation. Total assessment units / base code count. Higher = more comprehensive batteries (neuropsych). Lower = faster standardized evals (ADHD screens).",
  ratio: "Assessment units / total units. >40% = assessment-focused practice.",
  complex: "% add-on codes (96131/33/37/39). High = multi-hour comprehensive evals.",
  groups: "ASSESS=96130-33, ADMIN=96136-39, NEURO=96112/13/16/21, NOISE=90791/92+96127/46.",
};

function Tip({ id }: { id: string }) {
  return (
    <span className="tip-wrap">
      ?
      <span className="tip-body">{TOOLTIPS[id]}</span>
    </span>
  );
}

interface Props {
  providers: Provider[];
  selected: Set<string>;
  maxRevenue: number;
  onToggleSelect: (npi: string) => void;
  onSelectAll: () => void;
  onClickNpi: (npi: string) => void;
  allPageSelected: boolean;
}

export default function ProviderTable({ providers, selected, maxRevenue, onToggleSelect, onSelectAll, onClickNpi, allPageSelected }: Props) {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th className="bg-surface2 px-2.5 py-2 text-left text-[10px] uppercase tracking-wider text-dim border-b border-border whitespace-nowrap sticky top-0 z-10 w-8">
              <input type="checkbox" checked={allPageSelected} onChange={onSelectAll} className="accent-accent" />
            </th>
            {[
              { id: "npi", label: "NPI", w: "w-24" },
              { id: "provider", label: "Provider", w: "w-44" },
              { id: "st", label: "ST", w: "w-12" },
              { id: "", label: "City", w: "w-24" },
              { id: "type", label: "Type", w: "w-28" },
              { id: "revenue", label: "Revenue $", w: "w-28", right: true },
              { id: "patients", label: "Patients", w: "w-18", right: true },
              { id: "avghrs", label: "Avg Hrs", w: "w-16", right: true },
              { id: "assess", label: "Assess", w: "w-18", right: true },
              { id: "admin", label: "Admin", w: "w-18", right: true },
              { id: "ratio", label: "Ratio", w: "w-14", right: true },
              { id: "complex", label: "Complex", w: "w-14", right: true },
              { id: "groups", label: "Groups", w: "w-36" },
              { id: "", label: "Tags", w: "w-32" },
            ].map((col, i) => (
              <th key={i} className={`bg-surface2 px-2.5 py-2 text-[10px] uppercase tracking-wider text-dim border-b border-border whitespace-nowrap sticky top-0 z-10 ${col.w} ${col.right ? "text-right" : "text-left"}`}>
                {col.label}
                {col.id && <Tip id={col.id} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {providers.map((p) => {
            const isSelected = selected.has(p.npi);
            const barW = Math.min(100, (p.revenue_proxy / maxRevenue) * 100);
            const groups = new Set(Object.values(p.codes || {}).map((c) => c.group));
            const tags = p.tags || [];

            return (
              <tr key={p.npi} className={isSelected ? "bg-accent/10" : "hover:bg-accent/5"}>
                <td className="px-2.5 py-1.5 border-b border-border text-xs">
                  <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(p.npi)} className="accent-accent" />
                </td>
                <td className="px-2.5 py-1.5 border-b border-border text-xs">
                  <div className="flex items-center gap-1">
                    <button onClick={() => onClickNpi(p.npi)} className="text-accent hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit text-xs">
                      {p.npi}
                    </button>
                    <button
                      onClick={() => onClickNpi(p.npi)}
                      className="inline-flex items-center justify-center w-4 h-4 rounded bg-accent/15 text-accent text-[10px] cursor-pointer hover:bg-accent/30 border-none flex-shrink-0"
                      title="View profile & generate email"
                    >
                      &#9993;
                    </button>
                    {p.contact_email && (
                      <span
                        className={`inline-flex items-center justify-center w-4 h-4 rounded text-[9px] cursor-default flex-shrink-0 ${p.email_confidence === "denied" ? "opacity-40" : ""}`}
                        style={{
                          background: p.email_confidence === "verified" ? "rgba(34,197,94,0.35)" :
                            p.email_confidence === "denied" ? "rgba(239,68,68,0.2)" :
                            p.email_confidence === "high" ? "rgba(34,197,94,0.2)" :
                            p.email_confidence === "medium" ? "rgba(6,182,212,0.2)" :
                            "rgba(245,158,11,0.2)",
                          color: p.email_confidence === "verified" ? "#4ade80" :
                            p.email_confidence === "denied" ? "#f87171" :
                            p.email_confidence === "high" ? "#4ade80" :
                            p.email_confidence === "medium" ? "#22d3ee" :
                            "#fbbf24",
                        }}
                        title={`${p.contact_email} (${p.email_confidence === "verified" ? "VERIFIED" : p.email_confidence === "denied" ? "DENIED — inactive" : p.email_confidence || "unknown"}${p.email_confidence_score ? `, score ${p.email_confidence_score}` : ""})`}
                      >
                        {p.email_confidence === "verified" ? "\u2713" : p.email_confidence === "denied" ? "\u2717" : "@"}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2.5 py-1.5 border-b border-border text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-44" title={p.name}>{p.name}</td>
                <td className="px-2.5 py-1.5 border-b border-border text-xs">{p.state}</td>
                <td className="px-2.5 py-1.5 border-b border-border text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-24" title={p.city}>{p.city}</td>
                <td className="px-2.5 py-1.5 border-b border-border text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-28" title={p.provider_type}>{p.provider_type}</td>
                <td className={`px-2.5 py-1.5 border-b border-border text-xs text-right tabular-nums font-semibold ${p.revenue_proxy > 50000 ? "text-ok" : p.revenue_proxy > 10000 ? "text-warn" : "text-dim"}`}>
                  ${p.revenue_proxy.toLocaleString()}
                  <span className="inline-block w-14 h-1.5 bg-bg rounded-full overflow-hidden ml-1 align-middle">
                    <span className="block h-full rounded-full" style={{ width: `${barW}%`, background: p.revenue_proxy > 50000 ? "#22c55e" : p.revenue_proxy > 10000 ? "#f59e0b" : "#8888aa" }} />
                  </span>
                </td>
                <td className="px-2.5 py-1.5 border-b border-border text-xs text-right tabular-nums font-semibold">{p.eval_patients > 0 ? p.eval_patients.toLocaleString() : <span className="text-dim">—</span>}</td>
                <td className="px-2.5 py-1.5 border-b border-border text-xs text-right tabular-nums">{p.avg_eval_hours > 0 ? `${p.avg_eval_hours.toFixed(1)}h` : <span className="text-dim">—</span>}</td>
                <td className="px-2.5 py-1.5 border-b border-border text-xs text-right tabular-nums">{p.assessment_units.toLocaleString()}</td>
                <td className="px-2.5 py-1.5 border-b border-border text-xs text-right tabular-nums">{p.admin_units.toLocaleString()}</td>
                <td className="px-2.5 py-1.5 border-b border-border text-xs text-right tabular-nums">{(p.assessment_ratio * 100).toFixed(1)}%</td>
                <td className="px-2.5 py-1.5 border-b border-border text-xs text-right tabular-nums">{(p.complexity_score * 100).toFixed(1)}%</td>
                <td className="px-2.5 py-1.5 border-b border-border text-xs">
                  {Array.from(groups).map((g) => {
                    const t = GROUP_TAGS[g];
                    return t ? <span key={g} className="inline-block px-1.5 rounded text-[10px] font-semibold mr-0.5" style={{ background: t.bg, color: t.text }}>{t.label}</span> : null;
                  })}
                </td>
                <td className="px-2.5 py-1.5 border-b border-border text-xs">
                  {tags.map((t) => (
                    <span key={t} className="inline-block px-1.5 rounded text-[10px] font-semibold bg-accent/20 text-indigo-light mr-0.5">{t}</span>
                  ))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
