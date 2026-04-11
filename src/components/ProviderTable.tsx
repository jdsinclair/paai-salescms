"use client";

import type { Provider } from "@/lib/types";

const GROUP_TAGS: Record<string, { label: string; cls: string }> = {
  ASSESSMENT_CORE: { label: "ASSESS", cls: "bg-[rgba(99,102,241,0.2)] text-[#818cf8]" },
  TEST_ADMIN: { label: "ADMIN", cls: "bg-[rgba(6,182,212,0.2)] text-[#22d3ee]" },
  NEURO_DEV: { label: "NEURO", cls: "bg-[rgba(168,85,247,0.2)] text-[#c084fc]" },
  INTAKE_NOISE: { label: "NOISE", cls: "bg-[rgba(239,68,68,0.15)] text-[#f87171]" },
};

interface Props {
  providers: Provider[];
  selected: Set<string>;
  customTags: Record<string, string[]>;
  maxRevenue: number;
  onToggleSelect: (npi: string) => void;
  onSelectAll: () => void;
  onClickNpi: (npi: string) => void;
  allPageSelected: boolean;
}

const TH = "bg-[var(--surface2)] px-2.5 py-2 text-left text-[10px] uppercase tracking-wider text-[var(--text-dim)] border-b border-[var(--border)] whitespace-nowrap sticky top-0 z-5";
const TD = "px-2.5 py-1.5 border-b border-[var(--border)] text-xs whitespace-nowrap overflow-hidden text-ellipsis";

const TOOLTIPS: Record<string, string> = {
  npi: "National Provider Identifier — unique 10-digit ID. Use this to enrich with NPPES contact data.",
  provider: "Last, First name (individuals) or org name. Entity type I=Individual, O=Organization.",
  st: "Practice state. Use sidebar multi-select for regional campaigns.",
  type: "CMS provider taxonomy (e.g. Clinical Psychologist, Neuropsychologist).",
  revenue: "Assessment-only Medicare allowed $ (96130-33). Units x avg allowed. #1 sort signal.",
  assess: "Total units from 96130 (psych eval 1st hr), 96131 (+hr), 96132 (neuropsych 1st hr), 96133 (+hr).",
  admin: "Units from 96136-39 (test administration). High = technicians running tests at scale.",
  ratio: "Assessment units / total units. >40% = assessment-focused practice.",
  complex: "% add-on codes (96131/33/37/39). High = multi-hour comprehensive evals.",
  groups: "ASSESS=96130-33, ADMIN=96136-39, NEURO=96112/13/16/21, NOISE=90791/92+96127/46.",
};

function Tip({ id }: { id: string }) {
  return (
    <span className="relative inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[rgba(99,102,241,0.2)] text-[var(--accent)] text-[9px] font-bold ml-1 cursor-help group">
      ?
      <span className="hidden group-hover:block absolute top-full left-1/2 -translate-x-1/2 mt-2 w-60 bg-[var(--surface2)] border border-[var(--accent)] rounded-md px-3 py-2.5 text-[11px] font-normal normal-case tracking-normal text-[var(--text)] whitespace-normal z-50 shadow-lg pointer-events-none leading-relaxed">
        {TOOLTIPS[id]}
      </span>
    </span>
  );
}

export default function ProviderTable({ providers, selected, customTags, maxRevenue, onToggleSelect, onSelectAll, onClickNpi, allPageSelected }: Props) {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${TH} w-8`}>
              <input type="checkbox" checked={allPageSelected} onChange={onSelectAll} className="accent-[var(--accent)]" />
            </th>
            <th className={`${TH} w-24`}>NPI<Tip id="npi" /></th>
            <th className={`${TH} w-44`}>Provider<Tip id="provider" /></th>
            <th className={`${TH} w-10`}>ST<Tip id="st" /></th>
            <th className={`${TH} w-24`}>City</th>
            <th className={`${TH} w-28`}>Type<Tip id="type" /></th>
            <th className={`${TH} w-28 text-right`}>Revenue $<Tip id="revenue" /></th>
            <th className={`${TH} w-20 text-right`}>Assess<Tip id="assess" /></th>
            <th className={`${TH} w-20 text-right`}>Admin<Tip id="admin" /></th>
            <th className={`${TH} w-16 text-right`}>Ratio<Tip id="ratio" /></th>
            <th className={`${TH} w-16 text-right`}>Complex<Tip id="complex" /></th>
            <th className={`${TH} w-36`}>Groups<Tip id="groups" /></th>
            <th className={`${TH} w-32`}>Tags</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((p) => {
            const isSelected = selected.has(p.npi);
            const revColor = p.revenue_proxy > 50000 ? "text-[var(--green)] font-semibold" : p.revenue_proxy > 10000 ? "text-[var(--amber)]" : "text-[var(--text-dim)]";
            const barW = Math.min(100, (p.revenue_proxy / maxRevenue) * 100);
            const barColor = p.revenue_proxy > 50000 ? "var(--green)" : p.revenue_proxy > 10000 ? "var(--amber)" : "var(--text-dim)";
            const groups = new Set(Object.values(p.codes).map((c) => c.group));
            const tags = customTags[p.npi] || [];

            return (
              <tr key={p.npi} className={`hover:bg-[rgba(99,102,241,0.05)] ${isSelected ? "bg-[rgba(99,102,241,0.12)]" : ""}`}>
                <td className={TD}>
                  <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(p.npi)} className="accent-[var(--accent)]" />
                </td>
                <td className={TD}>
                  <button onClick={() => onClickNpi(p.npi)} className="text-[var(--accent)] hover:underline cursor-pointer bg-transparent border-none p-0 font-inherit text-inherit">
                    {p.npi}
                  </button>
                </td>
                <td className={`${TD} max-w-44`} title={p.name}>{p.name}</td>
                <td className={TD}>{p.state}</td>
                <td className={`${TD} max-w-24`} title={p.city}>{p.city}</td>
                <td className={`${TD} max-w-28`} title={p.provider_type}>{p.provider_type}</td>
                <td className={`${TD} text-right ${revColor}`}>
                  ${p.revenue_proxy.toLocaleString()}
                  <div className="inline-block w-14 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden ml-1 align-middle">
                    <div className="h-full rounded-full" style={{ width: `${barW}%`, background: barColor }} />
                  </div>
                </td>
                <td className={`${TD} text-right tabular-nums`}>{p.assessment_units.toLocaleString()}</td>
                <td className={`${TD} text-right tabular-nums`}>{p.admin_units.toLocaleString()}</td>
                <td className={`${TD} text-right tabular-nums`}>{(p.assessment_ratio * 100).toFixed(1)}%</td>
                <td className={`${TD} text-right tabular-nums`}>{(p.complexity_score * 100).toFixed(1)}%</td>
                <td className={TD}>
                  {Array.from(groups).map((g) => {
                    const t = GROUP_TAGS[g];
                    return t ? (
                      <span key={g} className={`inline-block px-1.5 py-0 rounded text-[10px] font-semibold mr-0.5 ${t.cls}`}>
                        {t.label}
                      </span>
                    ) : null;
                  })}
                </td>
                <td className={TD}>
                  {tags.map((t) => (
                    <span key={t} className="inline-block px-1.5 py-0 rounded text-[10px] font-semibold bg-[rgba(99,102,241,0.2)] text-[#818cf8] mr-0.5">
                      {t}
                    </span>
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
