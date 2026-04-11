"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Provider, Filters } from "@/lib/types";
import type { ProvidersResponse, TagData, SegmentData } from "@/lib/api";
import { fetchProviders, fetchStates, fetchTags, fetchSegments, applyTagToProviders, removeTagFromProvider, saveSegment as saveSegmentApi, deleteSegmentApi, fetchAllForExport } from "@/lib/api";
import Sidebar from "@/components/Sidebar";
import ProviderTable from "@/components/ProviderTable";
import DetailPanel from "@/components/DetailPanel";
import TagModal from "@/components/TagModal";
import SegmentModal from "@/components/SegmentModal";
import SegmentsWorkspace from "@/components/SegmentsWorkspace";
import Toast from "@/components/Toast";

const DEFAULT_FILTERS: Filters = {
  states: [],
  minAssessUnits: 0,
  minAssessRatio: 0,
  minAdminUnits: 0,
  minRevenue: 0,
  minComplexity: 0,
  neuroOnly: false,
  orgOnly: false,
  indivOnly: false,
  search: "",
  preset: "",
  tagFilter: [],
};

export default function Home() {
  const [states, setStates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [tab, setTab] = useState<"providers" | "segments">("providers");
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" }>({ field: "revenue_proxy", dir: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailNpi, setDetailNpi] = useState<string | null>(null);

  // API data
  const [providers, setProviders] = useState<Provider[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ totalRevenue: 0, totalAssess: 0, avgRatio: 0 });
  const [maxRevenue, setMaxRevenue] = useState(1);
  const [dbTags, setDbTags] = useState<TagData[]>([]);
  const [savedSegments, setSavedSegments] = useState<SegmentData[]>([]);

  const [showTagModal, setShowTagModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const fetchRef = useRef(0); // debounce token

  // Initial load
  useEffect(() => {
    Promise.all([fetchStates(), fetchTags(), fetchSegments()]).then(([s, t, seg]) => {
      setStates(s);
      setDbTags(t);
      setSavedSegments(seg);
      setLoading(false);
    });
  }, []);

  // Fetch providers when filters/sort/page change
  const loadProviders = useCallback(async () => {
    const token = ++fetchRef.current;
    setFetching(true);
    try {
      const data = await fetchProviders(filters, sort, page, pageSize);
      if (fetchRef.current !== token) return; // stale
      setProviders(data.providers);
      setTotal(data.total);
      setStats(data.stats);
      setMaxRevenue(data.maxRevenue);
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      if (fetchRef.current === token) setFetching(false);
    }
  }, [filters, sort, page, pageSize]);

  useEffect(() => {
    if (!loading) loadProviders();
  }, [loadProviders, loading]);

  const maxPages = Math.ceil(total / pageSize);
  const allTagNames = dbTags.map((t) => t.name);
  const detailProvider = detailNpi ? providers.find((p) => p.npi === detailNpi) : null;

  function applyPreset(preset: string) {
    const f = { ...DEFAULT_FILTERS, preset };
    switch (preset) {
      case "all_assessment": f.minAssessUnits = 1; break;
      case "top5": f.minAssessUnits = 100; f.minAssessRatio = 0.4; f.minComplexity = 0.25; f.minRevenue = 20000; break;
      case "scaling": f.minAdminUnits = 50; f.minAssessUnits = 20; f.minRevenue = 5000; break;
      case "underserved": f.minAdminUnits = 100; break;
      case "neuropsych": f.neuroOnly = true; f.minComplexity = 0.2; f.minRevenue = 10000; break;
      case "adhd": f.minAssessUnits = 50; f.minRevenue = 5000; break;
    }
    setFilters(f);
    setPage(1);
  }

  function toggleSelect(npi: string) {
    setSelected((prev) => { const next = new Set(prev); if (next.has(npi)) next.delete(npi); else next.add(npi); return next; });
  }
  function selectAllPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = providers.every((p) => next.has(p.npi));
      providers.forEach((p) => { if (allSelected) next.delete(p.npi); else next.add(p.npi); });
      return next;
    });
  }

  async function handleApplyTag(tag: string) {
    const npis = Array.from(selected);
    await applyTagToProviders(tag, npis);
    setShowTagModal(false);
    showToastMsg(`Tagged ${npis.length} providers with "${tag}"`);
    // Refresh tags and providers
    const [t] = await Promise.all([fetchTags(), loadProviders()]);
    setDbTags(t);
  }

  async function handleRemoveTag(npi: string, tagName: string) {
    const tag = dbTags.find((t) => t.name === tagName);
    if (!tag) return;
    await removeTagFromProvider(tag.id, npi);
    const t = await fetchTags();
    setDbTags(t);
    loadProviders();
  }

  async function handleSaveSegment(name: string) {
    await saveSegmentApi(name, filters, total);
    setShowSegmentModal(false);
    const seg = await fetchSegments();
    setSavedSegments(seg);
    showToastMsg(`Saved segment "${name}" with ${total} providers`);
  }

  function loadSegment(seg: SegmentData) {
    setFilters(seg.filters);
    setPage(1);
  }

  async function handleDeleteSegment(id: string) {
    await deleteSegmentApi(id);
    const seg = await fetchSegments();
    setSavedSegments(seg);
  }

  async function exportCSV(mode: "filtered" | "selected") {
    showToastMsg("Exporting...");
    let rows: Provider[];
    if (mode === "selected") {
      // Fetch selected NPIs from current providers (may span pages, so just use what we have selected)
      // For a proper export we'd need a dedicated endpoint, but for now use current page data
      rows = providers.filter((p) => selected.has(p.npi));
    } else {
      rows = await fetchAllForExport(filters, sort);
    }
    const headers = ["NPI","Name","Credentials","Entity_Type","City","State","Zip","Provider_Type","Revenue_Proxy","Total_Revenue","Assessment_Units","Admin_Units","Addon_Units","Neuro_Units","Total_Units","Assessment_Ratio","Complexity_Score","Neuro_Flag","Tags","Codes_Detail"];
    const csvRows = rows.map((p) => {
      const tags = (p.tags || []).join(";");
      const codes = Object.entries(p.codes || {}).map(([c, d]) => `${c}:${d.units}u/$${Math.round(d.revenue)}`).join(";");
      return [p.npi, `"${p.name}"`, p.credentials, p.entity_type, `"${p.city}"`, p.state, p.zip, `"${p.provider_type}"`, p.revenue_proxy, p.total_revenue, p.assessment_units, p.admin_units, p.addon_units, p.neuro_units, p.total_units, p.assessment_ratio, p.complexity_score, p.neuro_flag, tags, `"${codes}"`].join(",");
    });
    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paai_${mode}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToastMsg(`Exported ${rows.length} providers`);
  }

  function showToastMsg(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000); }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-4 bg-bg">
        <div className="w-8 h-8 border-[3px] border-border border-t-accent rounded-full animate-spin" />
        <div className="text-dim">Connecting to database...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {tab === "providers" && (
        <Sidebar
          states={states}
          filters={filters}
          setFilters={(f) => { setFilters(f); setPage(1); }}
          applyPreset={applyPreset}
          allTagNames={allTagNames}
          savedSegments={savedSegments}
          loadSegment={loadSegment}
          deleteSegment={handleDeleteSegment}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex items-center gap-0 border-b border-border bg-surface">
          <button onClick={() => setTab("providers")} className={`px-5 py-2.5 text-xs font-semibold cursor-pointer border-b-2 transition-all ${tab === "providers" ? "border-accent text-accent bg-accent/5" : "border-transparent text-dim hover:text-txt"}`}>
            Providers
          </button>
          <button onClick={() => setTab("segments")} className={`px-5 py-2.5 text-xs font-semibold cursor-pointer border-b-2 transition-all ${tab === "segments" ? "border-accent text-accent bg-accent/5" : "border-transparent text-dim hover:text-txt"}`}>
            Segments & Pipeline
            {savedSegments.length > 0 && <span className="ml-1.5 bg-accent/20 text-accent text-[10px] px-1.5 py-0.5 rounded-full">{savedSegments.length}</span>}
          </button>
          {/* Loading indicator */}
          {fetching && <div className="ml-auto mr-4 w-4 h-4 border-2 border-border border-t-accent rounded-full animate-spin" />}
        </div>

        {tab === "providers" ? (
          <>
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface gap-3 flex-wrap">
              <div className="flex gap-5 text-xs">
                <div><span className="font-bold text-accent">{total.toLocaleString()}</span>{" "}<span className="text-dim text-[10px]">providers</span></div>
                <div><span className="font-bold text-accent">${Math.round(stats.totalRevenue).toLocaleString()}</span>{" "}<span className="text-dim text-[10px]">total revenue</span></div>
                <div><span className="font-bold text-accent">{Math.round(stats.totalAssess).toLocaleString()}</span>{" "}<span className="text-dim text-[10px]">assess units</span></div>
                <div><span className="font-bold text-accent">{stats.avgRatio.toFixed(3)}</span>{" "}<span className="text-dim text-[10px]">avg ratio</span></div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => exportCSV("filtered")} className="px-3 py-1.5 rounded border border-border bg-surface2 text-txt text-[11px] hover:bg-border cursor-pointer">Export Filtered CSV</button>
                <button onClick={() => exportCSV("selected")} className="px-3 py-1.5 rounded border border-border bg-surface2 text-txt text-[11px] hover:bg-border cursor-pointer">Export Selected CSV</button>
                <button onClick={() => setShowSegmentModal(true)} className="px-3 py-1.5 rounded border border-accent bg-accent text-white text-[11px] hover:bg-accent-dim cursor-pointer">Save Segment</button>
              </div>
            </div>

            {/* Selection bar */}
            {selected.size > 0 && (
              <div className="flex items-center justify-between px-4 py-2 bg-accent/10 border-b border-accent">
                <div className="text-xs text-txt"><span className="font-bold">{selected.size}</span> selected</div>
                <div className="flex gap-1.5">
                  <button onClick={() => setShowTagModal(true)} className="px-2 py-1 rounded border border-border bg-surface2 text-txt text-[10px] hover:bg-border cursor-pointer">Tag Selected</button>
                  <button onClick={() => setSelected(new Set())} className="px-2 py-1 rounded border border-border bg-surface2 text-txt text-[10px] hover:bg-border cursor-pointer">Clear Selection</button>
                </div>
              </div>
            )}

            {/* Sort bar */}
            <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-surface text-[11px]">
              <span className="text-dim">Sort:</span>
              {[
                { field: "revenue_proxy", label: "Revenue $" },
                { field: "assessment_units", label: "Assess Units" },
                { field: "complexity_score", label: "Complexity" },
                { field: "assessment_ratio", label: "Ratio" },
                { field: "admin_units", label: "Admin Units" },
                { field: "total_units", label: "Total Units" },
              ].map((s) => (
                <button
                  key={s.field}
                  onClick={() => {
                    if (sort.field === s.field) setSort({ field: s.field, dir: sort.dir === "desc" ? "asc" : "desc" });
                    else setSort({ field: s.field, dir: "desc" });
                    setPage(1);
                  }}
                  className={`px-2 py-0.5 rounded border text-[11px] cursor-pointer ${sort.field === s.field ? "text-accent border-accent bg-accent/10" : "text-dim border-transparent bg-transparent hover:text-txt"}`}
                >
                  {s.label} {sort.field === s.field ? (sort.dir === "desc" ? "▼" : "▲") : ""}
                </button>
              ))}
            </div>

            <ProviderTable
              providers={providers}
              selected={selected}
              maxRevenue={maxRevenue}
              onToggleSelect={toggleSelect}
              onSelectAll={selectAllPage}
              onClickNpi={setDetailNpi}
              allPageSelected={providers.length > 0 && providers.every((p) => selected.has(p.npi))}
            />

            {/* Pagination */}
            <div className="flex items-center justify-center gap-3 py-2.5 border-t border-border bg-surface">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-2 py-1 rounded border border-border bg-surface2 text-txt text-[11px] disabled:opacity-30 cursor-pointer">Prev</button>
              <span className="text-xs text-dim">Page {page} of {maxPages || 1}</span>
              <button onClick={() => setPage((p) => Math.min(maxPages, p + 1))} disabled={page >= maxPages} className="px-2 py-1 rounded border border-border bg-surface2 text-txt text-[11px] disabled:opacity-30 cursor-pointer">Next</button>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="bg-bg border border-border text-txt text-xs rounded px-2 py-1">
                <option value={50}>50/page</option>
                <option value={100}>100/page</option>
                <option value={250}>250/page</option>
                <option value={500}>500/page</option>
              </select>
            </div>
          </>
        ) : (
          <SegmentsWorkspace
            segments={savedSegments}
            dbTags={dbTags}
            onLoadSegment={(seg) => { loadSegment(seg); setTab("providers"); }}
            onDeleteSegment={handleDeleteSegment}
            onSwitchToProviders={() => setTab("providers")}
          />
        )}
      </div>

      {detailProvider && tab === "providers" && (
        <DetailPanel
          provider={detailProvider}
          onClose={() => setDetailNpi(null)}
          onRemoveTag={(tag) => handleRemoveTag(detailProvider.npi, tag)}
        />
      )}

      {showTagModal && <TagModal allTagNames={allTagNames} onApply={handleApplyTag} onClose={() => setShowTagModal(false)} />}
      {showSegmentModal && <SegmentModal count={total} onSave={handleSaveSegment} onClose={() => setShowSegmentModal(false)} />}
      {toast && <Toast message={toast} />}
    </div>
  );
}
