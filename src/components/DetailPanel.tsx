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

function Field({ label, value, color }: { label: string; value?: string | null; color?: string }) {
  if (!value || value === "NO_PHONE" || value === "NOT_FOUND" || value === "--") return null;
  return (
    <div className="mt-1.5">
      <div className="text-[10px] text-dim uppercase">{label}</div>
      <div className="text-[11px] mt-0.5" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

export default function DetailPanel({ provider: p, onClose, onRemoveTag, onEnriched }: Props) {
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<Record<string, string | null> | null>(null);

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

  // Use enriched data from DB or just-fetched
  const e = enrichResult || {};
  const firstName = e.firstName ?? p.first_name;
  const lastName = e.lastName ?? p.last_name;
  const phone = e.phone ?? p.phone;
  const fax = e.fax ?? p.fax;
  const taxonomy = e.taxonomy ?? p.taxonomy;
  const taxonomyCode = e.taxonomyCode ?? p.taxonomy_code;
  const address1 = e.address1 ?? p.address1;
  const address2 = e.address2 ?? p.address2;
  const locationCity = e.locationCity ?? p.location_city;
  const locationState = e.locationState ?? p.location_state;
  const locationZip = e.locationZip ?? p.location_zip;
  const mailingAddress1 = e.mailingAddress1 ?? p.mailing_address1;
  const mailingCity = e.mailingCity ?? p.mailing_city;
  const mailingState = e.mailingState ?? p.mailing_state;
  const mailingZip = e.mailingZip ?? p.mailing_zip;
  const sex = e.sex ?? p.sex;
  const orgName = e.orgName ?? p.org_name;
  const npiStatus = e.npiStatus ?? p.npi_status;
  const enumerationType = e.enumerationType ?? p.enumeration_type;
  const enumerationDate = e.enumerationDate ?? p.enumeration_date;
  const npiLastUpdated = e.npiLastUpdated ?? p.npi_last_updated;
  const authorizedOfficial = e.authorizedOfficial ?? p.authorized_official;
  const authorizedOfficialTitle = e.authorizedOfficialTitle ?? p.authorized_official_title;
  const authorizedOfficialPhone = e.authorizedOfficialPhone ?? p.authorized_official_phone;
  const licenseInfo = e.licenseInfo ?? p.license_info;
  const otherIdentifiers = e.otherIdentifiers ?? p.other_identifiers;
  const soleProprietor = e.soleProprietor ?? p.sole_proprietor;

  const isEnriched = p.enriched || !!enrichResult;
  const hasPhone = phone && phone !== "NO_PHONE" && phone !== "NOT_FOUND";
  const hasFax = fax && fax !== "NO_PHONE" && fax !== "NOT_FOUND";

  const locationLine = [address1, address2].filter(Boolean).join(", ");
  const locationCityLine = [locationCity, locationState, locationZip?.slice(0, 5)].filter(Boolean).join(", ");
  const mailingLine = [mailingAddress1, mailingCity, mailingState, mailingZip?.slice(0, 5)].filter(Boolean).join(", ");

  return (
    <div className="w-[420px] min-w-[420px] bg-surface border-l border-border overflow-y-auto p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-bold text-txt">{p.name}</h2>
        <button onClick={onClose} className="px-2 py-0.5 rounded border border-border bg-surface2 text-[10px] text-txt cursor-pointer hover:bg-border">x</button>
      </div>

      <div className="text-[11px] text-dim mb-1">
        NPI: {p.npi} &middot; {enumerationType || (p.entity_type === "O" ? "NPI-2" : "NPI-1")} &middot; {p.credentials || "—"}
        {npiStatus && <span> &middot; Status: <span className={npiStatus === "A" ? "text-ok" : "text-err"}>{npiStatus === "A" ? "Active" : npiStatus}</span></span>}
      </div>

      {/* NPPES Enrichment Block */}
      <div className="bg-bg border border-border rounded p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-dim uppercase font-semibold tracking-wider">NPI Registry Data</span>
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="px-2 py-0.5 rounded border border-info bg-info/10 text-info text-[10px] cursor-pointer hover:bg-info/20 disabled:opacity-50"
          >
            {enriching ? "Fetching..." : isEnriched ? "Retry Enrich" : "Enrich from NPPES"}
          </button>
        </div>

        {/* Name */}
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

        {sex && sex !== "--" && (
          <div className="mt-1.5 text-[11px] text-dim">Gender: {sex === "M" ? "Male" : sex === "F" ? "Female" : sex}</div>
        )}

        {/* Org fields */}
        <Field label="Organization Name" value={orgName} />
        {authorizedOfficial && (
          <div className="mt-1.5">
            <div className="text-[10px] text-dim uppercase">Authorized Official</div>
            <div className="text-[11px] text-txt mt-0.5">
              {authorizedOfficial}
              {authorizedOfficialTitle && <span className="text-dim"> — {authorizedOfficialTitle}</span>}
              {authorizedOfficialPhone && <span className="text-ok ml-1">{authorizedOfficialPhone}</span>}
            </div>
          </div>
        )}

        {/* Taxonomy */}
        <Field label="NPPES Taxonomy" value={taxonomy} color="#06b6d4" />
        <Field label="Taxonomy Code" value={taxonomyCode} />

        {/* Practice location */}
        {locationLine && (
          <div className="mt-2">
            <div className="text-[10px] text-dim uppercase">Practice Location</div>
            <div className="text-[11px] text-txt mt-0.5">{locationLine}</div>
            {locationCityLine && <div className="text-[11px] text-txt">{locationCityLine}</div>}
          </div>
        )}

        {/* Mailing */}
        {mailingLine && mailingLine !== locationLine && (
          <div className="mt-1.5">
            <div className="text-[10px] text-dim uppercase">Mailing Address</div>
            <div className="text-[11px] text-txt mt-0.5">{mailingLine}</div>
          </div>
        )}

        {/* Phone / Fax */}
        {(hasPhone || hasFax) && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {hasPhone && (
              <div>
                <div className="text-[10px] text-dim uppercase">Phone</div>
                <div className="text-xs text-ok font-semibold mt-0.5">{phone}</div>
              </div>
            )}
            {hasFax && (
              <div>
                <div className="text-[10px] text-dim uppercase">Fax</div>
                <div className="text-xs text-txt mt-0.5">{fax}</div>
              </div>
            )}
          </div>
        )}

        {/* License */}
        <Field label="License Info" value={licenseInfo} />

        {/* Other identifiers */}
        <Field label="Other Identifiers" value={otherIdentifiers} />

        {/* NPI metadata */}
        <div className="mt-2 flex gap-4 text-[10px] text-dim">
          {enumerationDate && <span>Enumerated: {enumerationDate}</span>}
          {npiLastUpdated && <span>Updated: {npiLastUpdated}</span>}
          {soleProprietor && soleProprietor !== "--" && <span>Sole prop: {soleProprietor}</span>}
        </div>
      </div>

      {/* Buckets */}
      <div className="mb-3 flex gap-1 flex-wrap">
        {buckets.length > 0 ? buckets.map((b) => (
          <span key={b.label} className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: b.bg, color: b.text, border: `1px solid ${b.border}` }}>{b.label}</span>
        )) : (
          <span className="text-[11px] text-dim">No bucket match</span>
        )}
      </div>

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
