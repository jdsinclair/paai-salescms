"use client";

import { useState } from "react";
import type { Provider } from "@/lib/types";
import { generateSalesEmail } from "@/lib/email-generator";

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
  onUpdateEmail: (npi: string, email: string | null) => void;
  onEnriched?: () => void;
}

function Field({ label, value, color }: { label: string; value?: string | null; color?: string }) {
  if (!value || value === "NO_PHONE" || value === "NOT_FOUND" || value === "--") return null;
  return (
    <div className="mt-1.5">
      <div className="text-[10px] text-dim uppercase">{label}</div>
      <div className="text-[11px] mt-0.5 break-words" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

function EmailField({ provider: p, nppesEmail, onUpdateEmail }: { provider: Provider; nppesEmail?: string | null; onUpdateEmail: (npi: string, email: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");

  const confColor = p.email_confidence === "high" ? { bg: "rgba(34,197,94,0.2)", text: "#4ade80" }
    : p.email_confidence === "medium" ? { bg: "rgba(6,182,212,0.2)", text: "#22d3ee" }
    : { bg: "rgba(245,158,11,0.2)", text: "#fbbf24" };

  if (editing) {
    return (
      <div className="mt-1.5 bg-bg border border-border rounded p-2">
        <div className="text-[10px] text-dim uppercase mb-1">{p.contact_email ? "Replace Email" : "Add Email"}</div>
        <input
          type="email"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          placeholder="email@example.com"
          className="w-full bg-surface border border-border text-txt text-xs rounded px-2 py-1 mb-1.5 focus:outline-none focus:border-accent"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && editValue.includes("@")) {
              onUpdateEmail(p.npi, editValue.trim());
              setEditing(false);
            }
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <div className="flex gap-1">
          <button
            onClick={() => { if (editValue.includes("@")) { onUpdateEmail(p.npi, editValue.trim()); setEditing(false); } }}
            className="px-2 py-0.5 rounded border border-ok bg-ok/10 text-ok text-[10px] cursor-pointer hover:bg-ok/20"
          >Save</button>
          <button onClick={() => setEditing(false)} className="px-2 py-0.5 rounded border border-border bg-surface2 text-dim text-[10px] cursor-pointer hover:bg-border">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5">
      {p.contact_email ? (
        <div className="bg-bg border border-border rounded p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-dim uppercase">Clay Email</span>
            <div className="flex gap-1">
              <button
                onClick={() => { setEditValue(p.contact_email || ""); setEditing(true); }}
                className="px-1.5 py-0 rounded border border-border bg-surface2 text-[9px] text-dim cursor-pointer hover:text-txt hover:bg-border"
              >replace</button>
              <button
                onClick={() => onUpdateEmail(p.npi, null)}
                className="px-1.5 py-0 rounded border border-border bg-surface2 text-[9px] text-err cursor-pointer hover:bg-err/10"
              >remove</button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-accent font-semibold">{p.contact_email}</span>
            {p.email_confidence && (
              <span className="px-1.5 py-0 rounded text-[9px] font-semibold" style={{ background: confColor.bg, color: confColor.text }}>
                {p.email_confidence} ({p.email_confidence_score})
              </span>
            )}
            <span className="text-[9px] text-dim">via {p.email_source || "clay"}</span>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setEditValue(""); setEditing(true); }}
          className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-dashed border-border text-[10px] text-dim cursor-pointer hover:border-accent hover:text-accent transition-colors"
        >
          + Add email manually
        </button>
      )}

      {/* NPPES Direct Messaging (always show if present) */}
      {nppesEmail && (
        <div className="mt-1 flex items-center gap-1.5">
          <span className="text-[10px] text-dim">NPPES Direct: </span>
          <span className="text-[11px] text-dim">{nppesEmail}</span>
          <span className="px-1 py-0 rounded text-[8px] font-semibold" style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24" }}>HIE</span>
        </div>
      )}
    </div>
  );
}

function EmailSection({ provider }: { provider: Provider }) {
  const [generated, setGenerated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!generated) {
    return (
      <button
        onClick={() => { setGenerated(true); setExpanded(true); }}
        className="w-full mb-4 flex items-center justify-center gap-2 px-3 py-2 rounded border border-accent/30 bg-accent/5 text-accent text-[11px] cursor-pointer hover:bg-accent/10 transition-colors"
      >
        <span style={{ fontSize: 14 }}>&#9993;</span>
        Generate Sales Email
      </button>
    );
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="w-full mb-4 flex items-center justify-center gap-2 px-3 py-2 rounded border border-accent/30 bg-accent/10 text-accent text-[11px] cursor-pointer hover:bg-accent/15 transition-colors"
      >
        <span style={{ fontSize: 14 }}>&#9993;</span>
        View Sales Email
      </button>
    );
  }

  const email = generateSalesEmail(provider);

  function copyToClipboard() {
    const full = `Subject: ${email.subject}\n\n${email.body}`;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mb-4 bg-bg border border-accent/30 rounded overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[10px] text-accent uppercase font-semibold tracking-wider">Generated Email</span>
        <div className="flex gap-1.5">
          <button
            onClick={copyToClipboard}
            className="px-2 py-0.5 rounded border border-border bg-surface2 text-[10px] text-txt cursor-pointer hover:bg-border"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={() => setExpanded(false)}
            className="px-2 py-0.5 rounded border border-border bg-surface2 text-[10px] text-txt cursor-pointer hover:bg-border"
          >
            x
          </button>
        </div>
      </div>
      <div className="px-3 py-2">
        <div className="mb-2">
          <span className="text-[10px] text-dim uppercase">Subject</span>
          <div className="text-xs text-txt font-semibold mt-0.5">{email.subject}</div>
        </div>
        <div className="mb-2">
          <span className="text-[10px] text-dim uppercase">Data Signals Used</span>
          <div className="mt-0.5">
            {email.insights.map((insight, i) => (
              <div key={i} className="text-[10px] text-info">• {insight}</div>
            ))}
          </div>
        </div>
        <div>
          <span className="text-[10px] text-dim uppercase">Body</span>
          <pre className="mt-1 text-[11px] text-txt whitespace-pre-wrap leading-relaxed" style={{ fontFamily: "inherit" }}>{email.body}</pre>
        </div>
      </div>
    </div>
  );
}

export default function DetailPanel({ provider: p, onClose, onRemoveTag, onUpdateEmail, onEnriched }: Props) {
  const [enriching, setEnriching] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [enrichResult, setEnrichResult] = useState<Record<string, any> | null>(null);
  const [npiExpanded, setNpiExpanded] = useState(false);

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
      }
    } catch { /* ignore */ }
    finally { setEnriching(false); }
  }

  // Merge enrichResult (just-fetched) over provider DB data
  const e = enrichResult || {};
  const firstName = e.firstName ?? p.first_name;
  const lastName = e.lastName ?? p.last_name;
  const phone = e.phone ?? p.phone;
  const fax = e.fax ?? p.fax;
  const email = e.email ?? p.email;
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
  const mailingFull = [mailingAddress1, mailingCity, mailingState, mailingZip?.slice(0, 5)].filter(Boolean).join(", ");

  return (
    <div className="w-[420px] min-w-[420px] bg-surface border-l border-border overflow-y-auto p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-bold text-txt">{p.name}</h2>
        <button onClick={onClose} className="px-2 py-0.5 rounded border border-border bg-surface2 text-[10px] text-txt cursor-pointer hover:bg-border">x</button>
      </div>

      <div className="text-[11px] text-dim mb-1">
        NPI: {p.npi} &middot; {enumerationType || (p.entity_type === "O" ? "NPI-2" : "NPI-1")} &middot; {p.credentials || "—"}
        {npiStatus && <span> &middot; <span className={npiStatus === "A" ? "text-ok" : "text-err"}>{npiStatus === "A" ? "Active" : npiStatus}</span></span>}
      </div>

      {/* NPI Registry Data */}
      <div className="bg-bg border border-border rounded mb-3 overflow-hidden">
        {/* Preview (always visible) */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-dim uppercase font-semibold tracking-wider">NPI Registry</span>
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="px-2 py-0.5 rounded border border-info bg-info/10 text-info text-[10px] cursor-pointer hover:bg-info/20 disabled:opacity-50"
            >
              {enriching ? "Fetching..." : isEnriched ? "Retry" : "Enrich"}
            </button>
          </div>

          {/* Name row */}
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

          {/* Key fields always visible */}
          {taxonomy && (
            <div className="mt-1.5">
              <div className="text-[10px] text-dim uppercase">Taxonomy</div>
              <div className="text-[11px] text-info mt-0.5">{taxonomy}</div>
            </div>
          )}

          {/* Phone */}
          {hasPhone && (
            <div className="mt-1.5">
              <span className="text-[10px] text-dim">Phone: </span><span className="text-xs text-ok font-semibold">{phone}</span>
            </div>
          )}

          {/* Clay Email with actions */}
          <EmailField provider={p} nppesEmail={email} onUpdateEmail={onUpdateEmail} />
        </div>

        {/* Expand chevron */}
        {isEnriched && (
          <button
            onClick={() => setNpiExpanded(!npiExpanded)}
            className="w-full flex items-center justify-center gap-1 py-1 border-t border-border text-[10px] text-dim cursor-pointer hover:text-txt hover:bg-surface2 transition-colors"
          >
            {npiExpanded ? "▲▲ Less" : "▼▼ Full NPI Details"}
          </button>
        )}

        {/* Expanded section */}
        {npiExpanded && (
          <div className="px-3 pb-3 border-t border-border pt-2">
            {sex && sex !== "--" && (
              <div className="text-[11px] text-dim mb-1">Gender: {sex === "M" ? "Male" : sex === "F" ? "Female" : sex}</div>
            )}

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

            <Field label="Taxonomy Code" value={taxonomyCode} />

            {/* Practice location */}
            {locationLine && (
              <div className="mt-1.5">
                <div className="text-[10px] text-dim uppercase">Practice Location</div>
                <div className="text-[11px] text-txt mt-0.5">{locationLine}</div>
                {locationCityLine && <div className="text-[11px] text-txt">{locationCityLine}</div>}
              </div>
            )}

            {/* Mailing */}
            {mailingFull && mailingFull !== [locationLine, locationCityLine].join(", ") && (
              <Field label="Mailing Address" value={mailingFull} />
            )}

            {hasFax && <Field label="Fax" value={fax} />}

            <Field label="License Info" value={licenseInfo} color="#06b6d4" />
            <Field label="Other Identifiers" value={otherIdentifiers} />

            <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-dim">
              {enumerationDate && <span>Enumerated: {enumerationDate}</span>}
              {npiLastUpdated && <span>Updated: {npiLastUpdated}</span>}
              {soleProprietor && soleProprietor !== "--" && <span>Sole prop: {soleProprietor}</span>}
            </div>
          </div>
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

      {/* Sales Email */}
      <EmailSection provider={p} />

      {/* Metrics */}
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
