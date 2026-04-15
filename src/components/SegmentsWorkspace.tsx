"use client";

import { useEffect, useState, useCallback } from "react";
import type { Provider, Filters } from "@/lib/types";
import type { TagData, SegmentData, ProvidersResponse } from "@/lib/api";
import { fetchProviders } from "@/lib/api";
import { DEFAULT_SUBJECT, DEFAULT_BODY, TEMPLATE_VARIABLES, generateSalesEmail, buildVariables, renderTemplate } from "@/lib/email-generator";

interface SegmentWithEmail extends SegmentData {
  emailSubject?: string;
  emailBody?: string;
  hasEmail?: boolean;
  queueStats?: { total: number; pending: number; queued: number; skipped: number; sent: number } | null;
}

interface Props {
  segments: SegmentWithEmail[];
  dbTags: TagData[];
  onLoadSegment: (seg: SegmentData) => void;
  onDeleteSegment: (id: string) => void;
  onSwitchToProviders: () => void;
  onRefreshSegments: () => void;
}

// Sub-views
type View = "list" | "compose" | "prep";

export default function SegmentsWorkspace({ segments, dbTags, onLoadSegment, onDeleteSegment, onSwitchToProviders, onRefreshSegments }: Props) {
  const [view, setView] = useState<View>("list");
  const [activeSeg, setActiveSeg] = useState<SegmentWithEmail | null>(null);
  const [segStats, setSegStats] = useState<Record<string, { total: number; withEmail: number; verified: number; noEmail: number }>>({});

  // Load email coverage stats per segment
  useEffect(() => {
    segments.forEach(async (seg) => {
      const [allData, emailData] = await Promise.all([
        fetchProviders(seg.filters, { field: "revenue_proxy", dir: "desc" }, 1, 1),
        fetchProviders({ ...seg.filters, hasEmail: true, minEmailConfidence: 0 }, { field: "revenue_proxy", dir: "desc" }, 1, 1),
      ]);
      // Get verified count
      const verifiedData = await fetchProviders({ ...seg.filters, hasEmail: true, minEmailConfidence: 75 }, { field: "revenue_proxy", dir: "desc" }, 1, 1);
      setSegStats((prev) => ({
        ...prev,
        [seg.id]: {
          total: allData.total,
          withEmail: emailData.total,
          verified: verifiedData.total,
          noEmail: allData.total - emailData.total,
        },
      }));
    });
  }, [segments]);

  // Compose state
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [previewProvider, setPreviewProvider] = useState<Provider | null>(null);
  const [saving, setSaving] = useState(false);

  // Prep state
  const [prepQueue, setPrepQueue] = useState<{ provider: Provider; queueId?: string; emailSubject: string; emailBody: string }[]>([]);
  const [prepIdx, setPrepIdx] = useState(0);
  const [prepEditSubject, setPrepEditSubject] = useState("");
  const [prepEditBody, setPrepEditBody] = useState("");
  const [prepEditing, setPrepEditing] = useState(false);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepStats, setPrepStats] = useState({ queued: 0, skipped: 0, total: 0 });

  function openCompose(seg: SegmentWithEmail) {
    setActiveSeg(seg);
    setEditSubject(seg.emailSubject || DEFAULT_SUBJECT);
    setEditBody(seg.emailBody || DEFAULT_BODY);
    setView("compose");
    // Load a preview provider
    fetchProviders(seg.filters, { field: "revenue_proxy", dir: "desc" }, 1, 1).then((d) => {
      if (d.providers.length > 0) setPreviewProvider(d.providers[0]);
    });
  }

  async function saveTemplate() {
    if (!activeSeg) return;
    setSaving(true);
    await fetch("/api/segments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: activeSeg.id, emailSubject: editSubject, emailBody: editBody }),
    });
    setSaving(false);
    onRefreshSegments();
    setView("list");
  }

  async function openPrep(seg: SegmentWithEmail) {
    setActiveSeg(seg);
    setPrepLoading(true);
    setPrepIdx(0);
    setPrepStats({ queued: 0, skipped: 0, total: 0 });

    // Fetch all providers in segment that have contact_email + verified/high confidence
    const all: Provider[] = [];
    let page = 1;
    while (true) {
      const data = await fetchProviders(
        { ...seg.filters, hasEmail: true, minEmailConfidence: 50 },
        { field: "revenue_proxy", dir: "desc" },
        page, 200
      );
      all.push(...data.providers);
      if (all.length >= data.total) break;
      page++;
    }

    // Dedup by email address — never send to same email twice
    const seenEmails = new Set<string>();
    const deduped: Provider[] = [];
    let dupCount = 0;
    for (const p of all) {
      const email = (p.contact_email || "").toLowerCase().trim();
      if (!email || seenEmails.has(email)) {
        if (email) dupCount++;
        continue;
      }
      seenEmails.add(email);
      deduped.push(p);
    }

    // Generate personalized emails for each
    const subject = seg.emailSubject || DEFAULT_SUBJECT;
    const body = seg.emailBody || DEFAULT_BODY;
    const queue = deduped.map((p) => {
      const vars = buildVariables(p);
      return {
        provider: p,
        emailSubject: renderTemplate(subject, vars),
        emailBody: renderTemplate(body, vars),
      };
    });

    setPrepQueue(queue);
    setPrepStats({ queued: 0, skipped: 0, total: queue.length });
    if (dupCount > 0) console.log(`Deduped ${dupCount} duplicate email addresses`);
    if (queue.length > 0) {
      setPrepEditSubject(queue[0].emailSubject);
      setPrepEditBody(queue[0].emailBody);
    }
    setPrepLoading(false);
    setView("prep");
  }

  const currentPrep = prepQueue[prepIdx];

  async function prepAction(action: "queue" | "skip") {
    if (!currentPrep || !activeSeg) return;

    // Save to send_queue
    await fetch("/api/send-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{
          segmentId: activeSeg.id,
          npi: currentPrep.provider.npi,
          emailTo: currentPrep.provider.contact_email,
          emailSubject: prepEditing ? prepEditSubject : currentPrep.emailSubject,
          emailBody: prepEditing ? prepEditBody : currentPrep.emailBody,
        }],
      }),
    });

    // Update status
    const queueRes = await fetch("/api/send-queue?" + new URLSearchParams({ segmentId: activeSeg.id, status: "pending" }));
    const queueData = await queueRes.json();
    const lastItem = queueData.items?.[queueData.items.length - 1];
    if (lastItem) {
      await fetch("/api/send-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lastItem.id, status: action === "queue" ? "queued" : "skipped" }),
      });
    }

    setPrepStats((s) => ({
      ...s,
      queued: action === "queue" ? s.queued + 1 : s.queued,
      skipped: action === "skip" ? s.skipped + 1 : s.skipped,
    }));

    // Move to next
    const nextIdx = prepIdx + 1;
    if (nextIdx < prepQueue.length) {
      setPrepIdx(nextIdx);
      setPrepEditSubject(prepQueue[nextIdx].emailSubject);
      setPrepEditBody(prepQueue[nextIdx].emailBody);
      setPrepEditing(false);
    } else {
      setPrepIdx(nextIdx); // past end = done
    }
  }

  // Keyboard shortcuts for prep
  useEffect(() => {
    if (view !== "prep") return;
    function handleKey(e: KeyboardEvent) {
      if (prepEditing) return; // don't capture keys while editing
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "q") prepAction("queue");
      if (e.key === "s") prepAction("skip");
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  // LIST VIEW
  if (view === "list") {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
          <div>
            <h2 className="text-base font-bold text-txt">Segments & Outbound</h2>
            <p className="text-[11px] text-dim mt-0.5">Create email templates per segment, then review and queue for sending</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {segments.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-dim text-sm mb-2">No segments yet</div>
              <button onClick={onSwitchToProviders} className="px-4 py-2 rounded border border-accent bg-accent text-white text-xs cursor-pointer hover:bg-accent-dim">Go to Providers</button>
            </div>
          ) : (
            <div className="space-y-3">
              {segments.map((seg) => {
                const stats = segStats[seg.id];
                const emailReady = stats && stats.withEmail > 0;
                const allReviewed = stats && stats.noEmail === 0;
                const coveragePct = stats ? Math.round((stats.withEmail / stats.total) * 100) : 0;

                return (
                <div key={seg.id} className="bg-surface border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div>
                      <h4 className="text-sm font-bold text-txt">{seg.name}</h4>
                      <div className="text-[10px] text-dim mt-0.5">{seg.providerCount} providers · created {new Date(seg.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => openCompose(seg)} className={`px-2.5 py-1 rounded border text-[11px] cursor-pointer ${seg.hasEmail ? "border-ok bg-ok/10 text-ok hover:bg-ok/20" : "border-accent bg-accent/10 text-accent hover:bg-accent/20"}`}>
                        {seg.hasEmail ? "Edit Email" : "Compose Email"}
                      </button>
                      {seg.hasEmail && emailReady && (
                        <button onClick={() => openPrep(seg)} className="px-2.5 py-1 rounded border border-warn bg-warn/10 text-warn text-[11px] cursor-pointer hover:bg-warn/20">
                          Prep to Send
                        </button>
                      )}
                      <button onClick={() => { onLoadSegment(seg); onSwitchToProviders(); }} className="px-2.5 py-1 rounded border border-border bg-surface2 text-txt text-[11px] cursor-pointer hover:bg-border">
                        View
                      </button>
                      <button onClick={() => onDeleteSegment(seg.id)} className="px-2.5 py-1 rounded border border-border bg-surface2 text-err text-[11px] cursor-pointer hover:bg-border">
                        x
                      </button>
                    </div>
                  </div>

                  {/* Email coverage bar */}
                  {stats && (
                    <div className="px-4 py-2 border-t border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-dim uppercase">Email Coverage</span>
                        <span className="text-[10px] text-dim">{stats.withEmail}/{stats.total} ({coveragePct}%)</span>
                      </div>
                      <div className="w-full h-1.5 bg-bg rounded-full overflow-hidden mb-1">
                        <div className="h-full rounded-full transition-all" style={{ width: `${coveragePct}%`, background: coveragePct === 100 ? "#22c55e" : coveragePct > 50 ? "#f59e0b" : "#ef4444" }} />
                      </div>
                      <div className="flex gap-3 text-[10px]">
                        <span className="text-ok">{stats.verified} verified</span>
                        <span className="text-info">{stats.withEmail - stats.verified} unverified</span>
                        <span className="text-err">{stats.noEmail} no email</span>
                      </div>
                    </div>
                  )}

                  {/* Queue stats */}
                  {seg.queueStats && seg.queueStats.total > 0 && (
                    <div className="px-4 py-2 border-t border-border flex gap-4 text-[10px]">
                      <span className="text-dim">Queue:</span>
                      <span className="text-ok">{seg.queueStats.queued} queued</span>
                      <span className="text-dim">{seg.queueStats.skipped} skipped</span>
                      <span className="text-accent">{seg.queueStats.sent} sent</span>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // COMPOSE VIEW
  if (view === "compose" && activeSeg) {
    const previewVars = previewProvider ? buildVariables(previewProvider) : {};
    const previewSubject = renderTemplate(editSubject, previewVars);
    const previewBody = renderTemplate(editBody, previewVars);

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface">
          <div className="flex items-center gap-3">
            <button onClick={() => setView("list")} className="text-dim text-xs cursor-pointer hover:text-txt">&larr; Back</button>
            <h2 className="text-sm font-bold text-txt">Email Template: {activeSeg.name}</h2>
          </div>
          <button onClick={saveTemplate} disabled={saving} className="px-4 py-1.5 rounded border border-ok bg-ok text-white text-[11px] cursor-pointer hover:bg-ok/80 disabled:opacity-50">
            {saving ? "Saving..." : "Save Template"}
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Editor */}
          <div className="flex-1 p-4 overflow-y-auto border-r border-border">
            <div className="mb-3">
              <label className="text-[10px] text-dim uppercase block mb-1">Subject</label>
              <input
                type="text"
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="w-full bg-bg border border-border text-txt text-xs rounded px-3 py-2 focus:outline-none focus:border-accent"
              />
            </div>
            <div className="mb-3">
              <label className="text-[10px] text-dim uppercase block mb-1">Body</label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={20}
                className="w-full bg-bg border border-border text-txt text-xs rounded px-3 py-2 focus:outline-none focus:border-accent resize-y"
                style={{ fontFamily: "inherit" }}
              />
            </div>
            <div>
              <div className="text-[10px] text-dim uppercase mb-1">Available Variables</div>
              <div className="flex flex-wrap gap-1">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setEditBody((b) => b + `{{${v.key}}}`)}
                    className="px-1.5 py-0.5 rounded text-[10px] bg-accent/10 text-accent border border-accent/20 cursor-pointer hover:bg-accent/20"
                    title={v.desc}
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="w-96 min-w-96 p-4 overflow-y-auto bg-bg">
            <div className="text-[10px] text-dim uppercase mb-2">Live Preview {previewProvider ? `(${previewProvider.name})` : ""}</div>
            <div className="bg-surface border border-border rounded p-4">
              <div className="mb-2">
                <div className="text-[10px] text-dim">Subject:</div>
                <div className="text-xs text-txt font-semibold">{previewSubject}</div>
              </div>
              <hr className="border-border my-2" />
              <pre className="text-[11px] text-txt whitespace-pre-wrap leading-relaxed" style={{ fontFamily: "inherit" }}>{previewBody}</pre>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // PREP TO SEND VIEW
  if (view === "prep" && activeSeg) {
    if (prepLoading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-border border-t-accent rounded-full animate-spin" />
          <span className="ml-2 text-dim text-xs">Loading providers with verified emails...</span>
        </div>
      );
    }

    const done = prepIdx >= prepQueue.length;

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface">
          <div className="flex items-center gap-3">
            <button onClick={() => { setView("list"); onRefreshSegments(); }} className="text-dim text-xs cursor-pointer hover:text-txt">&larr; Back</button>
            <h2 className="text-sm font-bold text-txt">Prep to Send: {activeSeg.name}</h2>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="text-dim">Remaining: <span className="text-accent font-bold">{prepQueue.length - prepIdx}</span></span>
            <span className="text-ok">Queued: <span className="font-bold">{prepStats.queued}</span></span>
            <span className="text-dim">Skipped: <span className="font-bold">{prepStats.skipped}</span></span>
          </div>
        </div>

        {/* Progress */}
        <div className="w-full h-1 bg-border">
          <div className="h-full bg-accent transition-all" style={{ width: `${((prepIdx) / prepQueue.length) * 100}%` }} />
        </div>

        {done ? (
          <div className="flex-1 flex items-center justify-center flex-col gap-3">
            <div className="text-2xl">&#10003;</div>
            <div className="text-txt font-semibold">All reviewed!</div>
            <div className="text-dim text-xs">{prepStats.queued} queued to send, {prepStats.skipped} skipped</div>
            <button onClick={() => { setView("list"); onRefreshSegments(); }} className="px-4 py-2 rounded border border-accent bg-accent text-white text-xs cursor-pointer hover:bg-accent-dim">
              Back to Segments
            </button>
          </div>
        ) : currentPrep && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Provider profile */}
            <div className="w-80 min-w-80 p-4 overflow-y-auto border-r border-border bg-surface">
              <h3 className="text-sm font-bold text-txt mb-2">
                {currentPrep.provider.first_name && currentPrep.provider.last_name
                  ? `${currentPrep.provider.first_name} ${currentPrep.provider.last_name}`.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w+/g, (c) => c.toLowerCase())
                  : currentPrep.provider.name}
              </h3>
              <div className="text-[11px] text-dim mb-3">NPI: {currentPrep.provider.npi} · {currentPrep.provider.credentials}</div>

              <div className="space-y-2 text-xs">
                <div className="bg-bg rounded p-2">
                  <div className="text-[10px] text-dim uppercase">Location</div>
                  <div className="text-txt">{currentPrep.provider.location_city || currentPrep.provider.city}, {currentPrep.provider.location_state || currentPrep.provider.state}</div>
                  {currentPrep.provider.address1 && <div className="text-dim text-[10px]">{currentPrep.provider.address1}</div>}
                </div>
                <div className="bg-bg rounded p-2">
                  <div className="text-[10px] text-dim uppercase">Practice Profile</div>
                  <div className="text-txt">{currentPrep.provider.eval_patients} patients/yr · {currentPrep.provider.avg_eval_hours?.toFixed(1)}h avg</div>
                  <div className="text-dim text-[10px]">{(currentPrep.provider.neuro_units || 0) > 0 ? "Neuropsych" : "Psych"} · {(currentPrep.provider.assessment_ratio * 100).toFixed(0)}% ratio · ${currentPrep.provider.revenue_proxy.toLocaleString()} rev</div>
                </div>
                <div className="bg-bg rounded p-2">
                  <div className="text-[10px] text-dim uppercase">Taxonomy</div>
                  <div className="text-txt text-[10px]">{currentPrep.provider.taxonomy?.split(";")[0] || currentPrep.provider.provider_type}</div>
                </div>
                <div className="bg-bg rounded p-2">
                  <div className="text-[10px] text-dim uppercase">Email</div>
                  <div className="text-accent font-semibold">{currentPrep.provider.contact_email}</div>
                  {currentPrep.provider.email_confidence && (
                    <span className="text-[9px] text-dim">{currentPrep.provider.email_confidence} ({currentPrep.provider.email_confidence_score})</span>
                  )}
                </div>
                {currentPrep.provider.phone && currentPrep.provider.phone !== "NO_PHONE" && (
                  <div className="bg-bg rounded p-2">
                    <div className="text-[10px] text-dim uppercase">Phone</div>
                    <div className="text-ok">{currentPrep.provider.phone}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Email */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] text-dim uppercase">Email to {currentPrep.provider.contact_email}</div>
                  <button
                    onClick={() => setPrepEditing(!prepEditing)}
                    className={`px-2 py-0.5 rounded border text-[10px] cursor-pointer ${prepEditing ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface2 text-dim hover:text-txt"}`}
                  >
                    {prepEditing ? "Preview" : "Edit"}
                  </button>
                </div>

                {prepEditing ? (
                  <>
                    <input
                      type="text"
                      value={prepEditSubject}
                      onChange={(e) => setPrepEditSubject(e.target.value)}
                      className="w-full bg-bg border border-border text-txt text-xs rounded px-3 py-2 mb-2 focus:outline-none focus:border-accent"
                    />
                    <textarea
                      value={prepEditBody}
                      onChange={(e) => setPrepEditBody(e.target.value)}
                      rows={18}
                      className="w-full bg-bg border border-border text-txt text-xs rounded px-3 py-2 focus:outline-none focus:border-accent resize-y"
                      style={{ fontFamily: "inherit" }}
                    />
                  </>
                ) : (
                  <div className="bg-bg border border-border rounded p-4">
                    <div className="mb-2">
                      <div className="text-[10px] text-dim">Subject:</div>
                      <div className="text-xs text-txt font-semibold">{prepEditing ? prepEditSubject : currentPrep.emailSubject}</div>
                    </div>
                    <hr className="border-border my-2" />
                    <pre className="text-[11px] text-txt whitespace-pre-wrap leading-relaxed" style={{ fontFamily: "inherit" }}>
                      {prepEditing ? prepEditBody : currentPrep.emailBody}
                    </pre>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between p-4 border-t border-border bg-surface">
                <button
                  onClick={() => prepAction("skip")}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg border border-err bg-err/10 text-err text-sm font-semibold cursor-pointer hover:bg-err/20 transition-colors"
                >
                  Don&apos;t Send <span className="text-[10px] font-normal opacity-60">(S)</span>
                </button>
                <div className="text-xs text-dim">{prepIdx + 1} of {prepQueue.length}</div>
                <button
                  onClick={() => prepAction("queue")}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg border border-ok bg-ok/10 text-ok text-sm font-semibold cursor-pointer hover:bg-ok/20 transition-colors"
                >
                  Queue to Send <span className="text-[10px] font-normal opacity-60">(Q)</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
