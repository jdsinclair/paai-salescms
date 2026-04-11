"use client";

import { useState, useEffect, useMemo } from "react";
import type { Provider, Filters } from "@/lib/types";
import Sidebar from "@/components/Sidebar";
import ProviderTable from "@/components/ProviderTable";
import DetailPanel from "@/components/DetailPanel";
import TagModal from "@/components/TagModal";
import SegmentModal from "@/components/SegmentModal";
import Toast from "@/components/Toast";

interface DataPayload {
  providers: Provider[];
  states: string[];
  total: number;
}

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

interface Segment {
  id: string;
  name: string;
  filters: Filters;
  count: number;
  createdAt: string;
}

export default function Home() {
  const [data, setData] = useState<Provider[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState<{ field: string; dir: "asc" | "desc" }>({
    field: "revenue_proxy",
    dir: "desc",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailNpi, setDetailNpi] = useState<string | null>(null);
  const [customTags, setCustomTags] = useState<Record<string, string[]>>({});
  const [savedSegments, setSavedSegments] = useState<Segment[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch("/providers_data.json")
      .then((r) => r.json())
      .then((d: DataPayload) => {
        setData(d.providers);
        setStates(d.states);
        setLoading(false);
      });
    try {
      const t = localStorage.getItem("paai_tags");
      if (t) setCustomTags(JSON.parse(t));
      const s = localStorage.getItem("paai_segments");
      if (s) setSavedSegments(JSON.parse(s));
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("paai_tags", JSON.stringify(customTags));
  }, [customTags]);
  useEffect(() => {
    localStorage.setItem("paai_segments", JSON.stringify(savedSegments));
  }, [savedSegments]);

  const filtered = useMemo(() => {
    let result = data.filter((p) => {
      if (filters.states.length > 0 && !filters.states.includes(p.state)) return false;
      if (p.assessment_units < filters.minAssessUnits) return false;
      if (p.assessment_ratio < filters.minAssessRatio) return false;
      if (p.admin_units < filters.minAdminUnits) return false;
      if (p.revenue_proxy < filters.minRevenue) return false;
      if (p.complexity_score < filters.minComplexity) return false;
      if (filters.neuroOnly && !p.neuro_flag) return false;
      if (filters.orgOnly && p.entity_type !== "O") return false;
      if (filters.indivOnly && p.entity_type !== "I") return false;
      if (filters.preset === "underserved" && p.assessment_ratio > 0.3) return false;
      if (filters.preset === "adhd" && p.neuro_units > p.assessment_units * 0.3) return false;
      if (filters.tagFilter.length > 0) {
        const pTags = customTags[p.npi] || [];
        if (!filters.tagFilter.some((t) => pTags.includes(t))) return false;
      }
      if (filters.search) {
        const hay = `${p.npi} ${p.name} ${p.city} ${p.state} ${p.provider_type}`.toLowerCase();
        if (!hay.includes(filters.search.toLowerCase())) return false;
      }
      return true;
    });

    const dir = sort.dir === "desc" ? -1 : 1;
    const field = sort.field as keyof Provider;
    result.sort((a, b) => {
      const av = (a[field] as number) || 0;
      const bv = (b[field] as number) || 0;
      return (av - bv) * dir;
    });
    return result;
  }, [data, filters, sort, customTags]);

  const stats = useMemo(() => {
    const totalRev = filtered.reduce((s, p) => s + p.revenue_proxy, 0);
    const totalAssess = filtered.reduce((s, p) => s + p.assessment_units, 0);
    const avgRatio = filtered.length > 0
      ? filtered.reduce((s, p) => s + p.assessment_ratio, 0) / filtered.length
      : 0;
    return { count: filtered.length, revenue: totalRev, assessUnits: totalAssess, avgRatio };
  }, [filtered]);

  const maxPages = Math.ceil(filtered.length / pageSize);
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  const maxRevenue = useMemo(
    () => Math.max(...filtered.slice(0, 200).map((p) => p.revenue_proxy), 1),
    [filtered]
  );
  const detailProvider = useMemo(
    () => (detailNpi ? data.find((p) => p.npi === detailNpi) : null),
    [detailNpi, data]
  );
  const allTagNames = useMemo(() => {
    const s = new Set<string>();
    Object.values(customTags).forEach((tags) => tags.forEach((t) => s.add(t)));
    return Array.from(s);
  }, [customTags]);

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
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(npi)) next.delete(npi); else next.add(npi);
      return next;
    });
  }

  function selectAllPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = pageItems.every((p) => next.has(p.npi));
      pageItems.forEach((p) => {
        if (allSelected) next.delete(p.npi); else next.add(p.npi);
      });
      return next;
    });
  }

  function applyTag(tag: string) {
    setCustomTags((prev) => {
      const next = { ...prev };
      selected.forEach((npi) => {
        if (!next[npi]) next[npi] = [];
        if (!next[npi].includes(tag)) next[npi] = [...next[npi], tag];
      });
      return next;
    });
    setShowTagModal(false);
    showToastMsg(`Tagged ${selected.size} providers with "${tag}"`);
  }

  function removeTag(npi: string, tag: string) {
    setCustomTags((prev) => {
      const next = { ...prev };
      if (next[npi]) {
        next[npi] = next[npi].filter((t) => t !== tag);
        if (next[npi].length === 0) delete next[npi];
      }
      return next;
    });
  }

  function saveSegment(name: string) {
    const seg: Segment = {
      id: Date.now().toString(36),
      name,
      filters: { ...filters },
      count: filtered.length,
      createdAt: new Date().toISOString(),
    };
    setSavedSegments((prev) => [...prev, seg]);
    setShowSegmentModal(false);
    showToastMsg(`Saved segment "${name}" with ${filtered.length} providers`);
  }

  function loadSegment(seg: Segment) {
    setFilters(seg.filters);
    setPage(1);
  }

  function deleteSegment(id: string) {
    setSavedSegments((prev) => prev.filter((s) => s.id !== id));
  }

  function exportCSV(providers: Provider[], filename: string) {
    const headers = [
      "NPI","Name","Credentials","Entity_Type","City","State","Zip","Provider_Type",
      "Revenue_Proxy","Total_Revenue","Assessment_Units","Admin_Units","Addon_Units",
      "Neuro_Units","Total_Units","Assessment_Ratio","Complexity_Score","Neuro_Flag",
      "Custom_Tags","Codes_Detail",
    ];
    const rows = providers.map((p) => {
      const tags = (customTags[p.npi] || []).join(";");
      const codes = Object.entries(p.codes)
        .map(([c, d]) => `${c}:${d.units}u/$${Math.round(d.revenue)}`)
        .join(";");
      return [
        p.npi, `"${p.name}"`, p.credentials, p.entity_type, `"${p.city}"`,
        p.state, p.zip, `"${p.provider_type}"`, p.revenue_proxy, p.total_revenue,
        p.assessment_units, p.admin_units, p.addon_units, p.neuro_units,
        p.total_units, p.assessment_ratio, p.complexity_score, p.neuro_flag,
        tags, `"${codes}"`,
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paai_${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToastMsg(`Exported ${providers.length} providers`);
  }

  function showToastMsg(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-4">
        <div className="w-8 h-8 border-[3px] border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin" />
        <div className="text-[var(--text-dim)]">Loading provider data...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        states={states}
        filters={filters}
        setFilters={(f) => { setFilters(f); setPage(1); }}
        applyPreset={applyPreset}
        allTagNames={allTagNames}
        savedSegments={savedSegments}
        loadSegment={loadSegment}
        deleteSegment={deleteSegment}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] gap-3 flex-wrap">
          <div className="flex gap-5 text-xs">
            <div><span className="font-bold text-[var(--accent)]">{stats.count.toLocaleString()}</span>{" "}<span className="text-[var(--text-dim)] text-[10px]">providers</span></div>
            <div><span className="font-bold text-[var(--accent)]">${Math.round(stats.revenue).toLocaleString()}</span>{" "}<span className="text-[var(--text-dim)] text-[10px]">total revenue</span></div>
            <div><span className="font-bold text-[var(--accent)]">{stats.assessUnits.toLocaleString()}</span>{" "}<span className="text-[var(--text-dim)] text-[10px]">assess units</span></div>
            <div><span className="font-bold text-[var(--accent)]">{stats.avgRatio.toFixed(3)}</span>{" "}<span className="text-[var(--text-dim)] text-[10px]">avg ratio</span></div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => exportCSV(filtered, "filtered")} className="px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] text-[11px] hover:bg-[var(--border)] cursor-pointer">Export Filtered</button>
            <button onClick={() => exportCSV(data.filter((p) => selected.has(p.npi)), "selected")} className="px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] text-[11px] hover:bg-[var(--border)] cursor-pointer">Export Selected</button>
            <button onClick={() => setShowSegmentModal(true)} className="px-3 py-1.5 rounded border border-[var(--accent)] bg-[var(--accent)] text-white text-[11px] hover:bg-[var(--accent-dim)] cursor-pointer">Save Segment</button>
          </div>
        </div>

        {/* Selection bar */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-[rgba(99,102,241,0.1)] border-b border-[var(--accent)]">
            <div className="text-xs"><span className="font-bold">{selected.size}</span> selected</div>
            <div className="flex gap-1.5">
              <button onClick={() => setShowTagModal(true)} className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] text-[10px] hover:bg-[var(--border)] cursor-pointer">Tag Selected</button>
              <button onClick={() => setSelected(new Set())} className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] text-[10px] hover:bg-[var(--border)] cursor-pointer">Clear Selection</button>
            </div>
          </div>
        )}

        {/* Sort bar */}
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--border)] bg-[var(--surface)] text-[11px]">
          <span className="text-[var(--text-dim)]">Sort:</span>
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
              }}
              className={`px-2 py-0.5 rounded border text-[11px] cursor-pointer ${
                sort.field === s.field
                  ? "text-[var(--accent)] border-[var(--accent)] bg-[rgba(99,102,241,0.1)]"
                  : "text-[var(--text-dim)] border-transparent bg-transparent hover:text-[var(--text)]"
              }`}
            >
              {s.label} {sort.field === s.field ? (sort.dir === "desc" ? "▼" : "▲") : ""}
            </button>
          ))}
        </div>

        <ProviderTable
          providers={pageItems}
          selected={selected}
          customTags={customTags}
          maxRevenue={maxRevenue}
          onToggleSelect={toggleSelect}
          onSelectAll={selectAllPage}
          onClickNpi={setDetailNpi}
          allPageSelected={pageItems.length > 0 && pageItems.every((p) => selected.has(p.npi))}
        />

        {/* Pagination */}
        <div className="flex items-center justify-center gap-3 py-2.5 border-t border-[var(--border)] bg-[var(--surface)]">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] text-[11px] disabled:opacity-30 cursor-pointer">← Prev</button>
          <span className="text-xs text-[var(--text-dim)]">Page {page} of {maxPages || 1}</span>
          <button onClick={() => setPage((p) => Math.min(maxPages, p + 1))} disabled={page >= maxPages} className="px-2 py-1 rounded border border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] text-[11px] disabled:opacity-30 cursor-pointer">Next →</button>
          <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-xs rounded px-2 py-1">
            <option value={50}>50/page</option>
            <option value={100}>100/page</option>
            <option value={250}>250/page</option>
            <option value={500}>500/page</option>
          </select>
        </div>
      </div>

      {detailProvider && (
        <DetailPanel
          provider={detailProvider}
          customTags={customTags[detailProvider.npi] || []}
          onClose={() => setDetailNpi(null)}
          onRemoveTag={(tag) => removeTag(detailProvider.npi, tag)}
        />
      )}

      {showTagModal && <TagModal allTagNames={allTagNames} onApply={applyTag} onClose={() => setShowTagModal(false)} />}
      {showSegmentModal && <SegmentModal count={filtered.length} onSave={saveSegment} onClose={() => setShowSegmentModal(false)} />}
      {toast && <Toast message={toast} />}
    </div>
  );
}
