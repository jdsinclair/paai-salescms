"use client";

import { useState, useEffect, useCallback } from "react";
import type { Provider } from "@/lib/types";
import { fetchProviders } from "@/lib/api";

interface Props {
  onDone: () => void;
}

export default function EmailReview({ onDone }: Props) {
  const [queue, setQueue] = useState<Provider[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ accepted: 0, denied: 0, total: 0 });
  const [filter, setFilter] = useState<"all" | "generic" | "medium" | "high">("all");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    // Fetch all providers with contact_email, sorted by confidence ascending (review worst first)
    const minConf = filter === "generic" ? 1 : filter === "medium" ? 40 : filter === "high" ? 70 : 1;
    const maxPages = 10;
    const all: Provider[] = [];
    for (let page = 1; page <= maxPages; page++) {
      const data = await fetchProviders(
        {
          states: [], minAssessUnits: 0, minAssessRatio: 0, minAdminUnits: 0,
          minRevenue: 0, minComplexity: 0, neuroOnly: false, orgOnly: false,
          indivOnly: false, search: "", preset: "", tagFilter: [],
          hasEmail: true, hasPhone: false, minEmailConfidence: minConf, minEvalPatients: 0, maxAvgHours: 0,
        },
        { field: "email_confidence_score", dir: "asc" },
        page, 100
      );
      all.push(...data.providers);
      if (all.length >= data.total) break;
    }
    // Filter out already-verified and denied unless viewing specific filter
    const filtered = filter === "high" ? all : all.filter((p) => p.email_confidence !== "verified" && p.email_confidence !== "denied");
    setQueue(filtered);
    setCurrentIdx(0);
    setStats({ accepted: 0, denied: 0, total: filtered.length });
    setLoading(false);
  }, [filter]);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  const current = queue[currentIdx];

  async function handleAction(action: "accept" | "deny") {
    if (!current || saving) return;
    setSaving(true);

    if (action === "accept") {
      await fetch("/api/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npi: current.npi,
          email_confidence: "verified",
          email_confidence_score: 100,
        }),
      });
      setStats((s) => ({ ...s, accepted: s.accepted + 1 }));
    } else {
      // Keep the email but mark as denied — won't be used for outbound
      await fetch("/api/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npi: current.npi,
          email_confidence: "denied",
          email_confidence_score: 0,
        }),
      });
      setStats((s) => ({ ...s, denied: s.denied + 1 }));
    }

    setSaving(false);
    if (currentIdx < queue.length - 1) {
      setCurrentIdx((i) => i + 1);
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "a") handleAction("accept");
      if (e.key === "ArrowLeft" || e.key === "d") handleAction("deny");
      if (e.key === "ArrowDown" || e.key === "s") setCurrentIdx((i) => Math.min(i + 1, queue.length - 1));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const remaining = queue.length - currentIdx;
  const isNeuropsych = (current?.neuro_units || 0) > 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
        <div>
          <h2 className="text-base font-bold text-txt">Email Review</h2>
          <p className="text-[11px] text-dim mt-0.5">Accept or deny Clay-enriched emails. Keyboard: <span className="text-accent">A</span> = accept, <span className="text-accent">D</span> = deny, <span className="text-accent">S</span> = skip</p>
        </div>
        <div className="flex gap-3 text-xs">
          <div className="bg-bg border border-border rounded px-3 py-1.5">
            <span className="text-dim">Remaining: </span><span className="font-bold text-accent">{remaining}</span>
          </div>
          <div className="bg-bg border border-ok/30 rounded px-3 py-1.5">
            <span className="text-dim">Accepted: </span><span className="font-bold text-ok">{stats.accepted}</span>
          </div>
          <div className="bg-bg border border-err/30 rounded px-3 py-1.5">
            <span className="text-dim">Denied: </span><span className="font-bold text-err">{stats.denied}</span>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-border bg-surface text-[11px]">
        <span className="text-dim">Show:</span>
        {[
          { key: "all" as const, label: "All to review" },
          { key: "generic" as const, label: "Generic (info@, contact@)" },
          { key: "medium" as const, label: "Medium confidence" },
          { key: "high" as const, label: "High confidence" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2 py-0.5 rounded border text-[11px] cursor-pointer ${
              filter === f.key ? "text-accent border-accent bg-accent/10" : "text-dim border-transparent hover:text-txt"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center p-6">
        {!current || currentIdx >= queue.length ? (
          <div className="text-center">
            <div className="text-2xl mb-2">&#10003;</div>
            <div className="text-txt font-semibold">All done!</div>
            <p className="text-dim text-xs mt-1">Accepted {stats.accepted}, denied {stats.denied} out of {stats.total} emails.</p>
            <button onClick={onDone} className="mt-4 px-4 py-2 rounded border border-accent bg-accent text-white text-xs cursor-pointer hover:bg-accent-dim">
              Back to Providers
            </button>
          </div>
        ) : (
          <div className="w-full max-w-2xl">
            {/* Progress bar */}
            <div className="w-full h-1 bg-border rounded-full mb-4 overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${((currentIdx + 1) / queue.length) * 100}%` }} />
            </div>

            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              {/* Provider info */}
              <div className="p-5 border-b border-border">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-txt">{current.first_name} {current.last_name}</h3>
                    <div className="text-xs text-dim mt-0.5">{current.name} &middot; {current.credentials}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-dim">NPI {current.npi}</div>
                    <div className="text-[10px] text-dim">{current.entity_type === "O" ? "Organization" : "Individual"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="bg-bg rounded p-2">
                    <div className="text-[10px] text-dim uppercase">Location</div>
                    <div className="text-xs text-txt mt-0.5">{current.location_city || current.city}, {current.location_state || current.state}</div>
                    {current.address1 && <div className="text-[10px] text-dim mt-0.5">{current.address1}</div>}
                  </div>
                  <div className="bg-bg rounded p-2">
                    <div className="text-[10px] text-dim uppercase">Specialty</div>
                    <div className="text-xs text-txt mt-0.5">{current.provider_type}</div>
                    {current.taxonomy && <div className="text-[10px] text-info mt-0.5 truncate" title={current.taxonomy}>{current.taxonomy.split(";")[0]}</div>}
                  </div>
                  <div className="bg-bg rounded p-2">
                    <div className="text-[10px] text-dim uppercase">Assessment Profile</div>
                    <div className="text-xs text-txt mt-0.5">
                      {current.assessment_units.toLocaleString()} units &middot; ${current.revenue_proxy.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-dim mt-0.5">
                      {isNeuropsych ? "Neuropsych" : "Psych"} &middot; {(current.assessment_ratio * 100).toFixed(0)}% ratio &middot; {(current.complexity_score * 100).toFixed(0)}% complexity
                    </div>
                  </div>
                </div>

                {current.phone && current.phone !== "NO_PHONE" && current.phone !== "NOT_FOUND" && (
                  <div className="text-xs"><span className="text-dim">Phone: </span><span className="text-ok">{current.phone}</span></div>
                )}
              </div>

              {/* Email to review */}
              <div className="p-5 bg-bg">
                <div className="text-[10px] text-dim uppercase mb-2">Clay Email — Review</div>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl text-accent font-bold">{current.contact_email}</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-semibold"
                    style={{
                      background: current.email_confidence === "high" ? "rgba(34,197,94,0.2)" :
                        current.email_confidence === "medium" ? "rgba(6,182,212,0.2)" :
                        current.email_confidence === "verified" ? "rgba(34,197,94,0.3)" :
                        "rgba(245,158,11,0.2)",
                      color: current.email_confidence === "high" || current.email_confidence === "verified" ? "#4ade80" :
                        current.email_confidence === "medium" ? "#22d3ee" : "#fbbf24",
                    }}
                  >
                    {current.email_confidence} ({current.email_confidence_score})
                  </span>
                  <span className="text-[10px] text-dim">via {current.email_source || "clay"}</span>
                </div>

                {/* Quick checks */}
                <div className="space-y-1 text-[11px] mb-4">
                  <div className="flex items-center gap-2">
                    <span className={current.email_confidence_score && current.email_confidence_score >= 75 ? "text-ok" : "text-warn"}>
                      {current.email_confidence_score && current.email_confidence_score >= 75 ? "+" : "?"}
                    </span>
                    <span className="text-dim">
                      {current.contact_email?.toLowerCase().includes(current.last_name?.toLowerCase() || "XXXX")
                        ? "Email contains provider last name"
                        : current.contact_email?.toLowerCase().includes(current.first_name?.toLowerCase() || "XXXX")
                        ? "Email contains provider first name"
                        : "Email doesn't match provider name"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={/^(info|contact|office|admin|hello|support|general|reception|billing|scheduling|intake|appointments|referrals|records|frontdesk)/.test(current.contact_email?.split("@")[0]?.toLowerCase() || "") ? "text-warn" : "text-ok"}>
                      {/^(info|contact|office|admin|hello|support|general|reception|billing|scheduling|intake|appointments|referrals|records|frontdesk)/.test(current.contact_email?.split("@")[0]?.toLowerCase() || "") ? "!" : "+"}
                    </span>
                    <span className="text-dim">
                      {/^(info|contact|office|admin|hello|support|general|reception|billing|scheduling|intake|appointments|referrals|records|frontdesk)/.test(current.contact_email?.split("@")[0]?.toLowerCase() || "")
                        ? "Generic mailbox — may not reach provider directly"
                        : "Looks like a personal/direct email"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={/gmail|yahoo|hotmail|aol|outlook/.test(current.contact_email?.toLowerCase() || "") ? "text-dim" : "text-ok"}>
                      {/gmail|yahoo|hotmail|aol|outlook/.test(current.contact_email?.toLowerCase() || "") ? "~" : "+"}
                    </span>
                    <span className="text-dim">
                      {/gmail|yahoo|hotmail|aol|outlook/.test(current.contact_email?.toLowerCase() || "")
                        ? "Free email provider (common for solo practitioners)"
                        : `Practice domain: ${current.contact_email?.split("@")[1]}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between p-5 border-t border-border">
                <button
                  onClick={() => handleAction("deny")}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg border border-err bg-err/10 text-err text-sm font-semibold cursor-pointer hover:bg-err/20 disabled:opacity-50 transition-colors"
                >
                  <span className="text-lg">&#10007;</span> Deny
                  <span className="text-[10px] font-normal opacity-60 ml-1">(D)</span>
                </button>

                <div className="text-xs text-dim">
                  {currentIdx + 1} of {queue.length}
                </div>

                <button
                  onClick={() => handleAction("accept")}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg border border-ok bg-ok/10 text-ok text-sm font-semibold cursor-pointer hover:bg-ok/20 disabled:opacity-50 transition-colors"
                >
                  Accept <span className="text-lg">&#10003;</span>
                  <span className="text-[10px] font-normal opacity-60 ml-1">(A)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
