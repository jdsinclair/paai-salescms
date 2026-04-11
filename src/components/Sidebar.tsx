"use client";

import { useState } from "react";
import type { Filters } from "@/lib/types";

interface Segment {
  id: string;
  name: string;
  filters: Filters;
  count: number;
  createdAt: string;
}

interface Props {
  states: string[];
  filters: Filters;
  setFilters: (f: Filters) => void;
  applyPreset: (preset: string) => void;
  allTagNames: string[];
  savedSegments: Segment[];
  loadSegment: (seg: Segment) => void;
  deleteSegment: (id: string) => void;
}

const PRESETS = [
  { key: "all_assessment", label: "All Assessment Providers (3,988)", desc: "Everyone who billed at least 1 assessment unit", highlight: true },
  { key: "top5", label: "Top 5% Assessment Shops", desc: "High units + high ratio + high add-ons" },
  { key: "scaling", label: "Scaling Clinics", desc: "Medium units + rising admin codes" },
  { key: "underserved", label: "Underserved (Opportunity)", desc: "High admin, low eval = inefficiency" },
  { key: "neuropsych", label: "Neuropsych Heavy", desc: "High 96132/33 + high add-ons" },
  { key: "adhd", label: "High Volume ADHD Clinics", desc: "High 96130 + low 96132" },
];

export default function Sidebar({ states, filters, setFilters, applyPreset, allTagNames, savedSegments, loadSegment, deleteSegment }: Props) {
  const [activePreset, setActivePreset] = useState("");
  const [activeTagFilters, setActiveTagFilters] = useState<Set<string>>(new Set());

  function handlePreset(key: string) {
    setActivePreset(key === activePreset ? "" : key);
    applyPreset(key === activePreset ? "clear" : key);
  }

  function updateFilter(key: keyof Filters, value: string | number | boolean) {
    setActivePreset("");
    setFilters({ ...filters, [key]: value });
  }

  function toggleTagFilter(tag: string) {
    const next = new Set(activeTagFilters);
    if (next.has(tag)) next.delete(tag); else next.add(tag);
    setActiveTagFilters(next);
    setFilters({ ...filters, tagFilter: Array.from(next) });
  }

  return (
    <div className="w-80 min-w-80 bg-surface border-r border-border flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border sticky top-0 bg-surface z-10">
        <h1 className="text-sm font-bold tracking-widest text-accent">PAAI SALES CMS</h1>
        <div className="text-[11px] text-dim mt-0.5">Provider Assessment Intelligence</div>
      </div>

      {/* Lead Buckets */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-[11px] uppercase tracking-widest text-dim mb-2">Lead Buckets</h3>
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => handlePreset(p.key)}
            className={`w-full text-left px-2.5 py-1.5 rounded border mb-1 text-[11px] cursor-pointer transition-all ${
              activePreset === p.key
                ? "border-accent bg-accent/15 text-txt"
                : p.highlight
                ? "border-ok bg-surface2 text-txt hover:bg-bg"
                : "border-border bg-surface2 text-txt hover:border-accent hover:bg-bg"
            }`}
          >
            <span className="font-semibold block">{p.label}</span>
            <span className="block text-[10px] text-dim mt-0.5">{p.desc}</span>
          </button>
        ))}
        <button
          onClick={() => { setActivePreset(""); applyPreset("clear"); }}
          className="w-full text-left px-2.5 py-1.5 rounded border border-err text-err text-[11px] cursor-pointer hover:bg-bg"
        >
          <span className="font-semibold">Clear All Filters</span>
        </button>
      </div>

      {/* State filter */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-[11px] uppercase tracking-widest text-dim mb-2">State</h3>
        <select
          multiple
          value={filters.states}
          onChange={(e) => {
            const vals = Array.from(e.target.selectedOptions, (o) => o.value);
            setActivePreset("");
            setFilters({ ...filters, states: vals });
          }}
          className="w-full h-28 bg-bg border border-border text-txt text-xs rounded px-2 py-1"
        >
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Thresholds */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-[11px] uppercase tracking-widest text-dim mb-2">Thresholds</h3>
        {[
          { key: "minAssessUnits", label: "Min Assess Units", ph: "e.g. 200", step: "1" },
          { key: "minAssessRatio", label: "Min Assess Ratio", ph: "e.g. 0.4", step: "0.01" },
          { key: "minAdminUnits", label: "Min Admin Units", ph: "e.g. 100", step: "1" },
          { key: "minRevenue", label: "Min Revenue ($)", ph: "e.g. 10000", step: "1" },
          { key: "minComplexity", label: "Min Complexity", ph: "e.g. 0.3", step: "0.01" },
        ].map((f) => (
          <div key={f.key} className="flex items-center gap-2 mb-1.5">
            <label className="text-[11px] text-dim min-w-28 cursor-help hover:text-accent">{f.label}</label>
            <input
              type="number"
              step={f.step}
              placeholder={f.ph}
              value={(filters[f.key as keyof Filters] as number) || ""}
              onChange={(e) => updateFilter(f.key as keyof Filters, parseFloat(e.target.value) || 0)}
              className="flex-1 bg-bg border border-border text-txt px-2 py-1 rounded text-xs focus:outline-none focus:border-accent"
            />
          </div>
        ))}
      </div>

      {/* Code groups */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-[11px] uppercase tracking-widest text-dim mb-2">Code Groups</h3>
        {[
          { key: "neuroOnly", label: "Neuro/Dev codes present" },
          { key: "orgOnly", label: "Organizations only (entity=O)" },
          { key: "indivOnly", label: "Individuals only (entity=I)" },
        ].map((c) => (
          <label key={c.key} className="flex items-center gap-1.5 text-xs mb-1 cursor-pointer text-txt">
            <input type="checkbox" checked={filters[c.key as keyof Filters] as boolean} onChange={(e) => updateFilter(c.key as keyof Filters, e.target.checked)} className="accent-accent" />
            {c.label}
          </label>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-[11px] uppercase tracking-widest text-dim mb-2">Search</h3>
        <input
          type="text"
          placeholder="NPI, name, city..."
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="w-full bg-bg border border-border text-txt px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-accent"
        />
      </div>

      {/* Custom Tags */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-[11px] uppercase tracking-widest text-dim mb-2">Custom Tags</h3>
        {allTagNames.length === 0 ? (
          <div className="text-[11px] text-dim">No tags yet</div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {allTagNames.map((t) => (
              <button
                key={t}
                onClick={() => toggleTagFilter(t)}
                className={`px-2 py-0.5 rounded text-[10px] cursor-pointer border ${
                  activeTagFilters.has(t)
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-surface2 text-txt hover:bg-border"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <div className="text-[10px] text-dim mt-1">Select rows in table, then tag them</div>
      </div>

      {/* Saved Segments */}
      <div className="px-4 py-3">
        <h3 className="text-[11px] uppercase tracking-widest text-dim mb-2">Saved Segments</h3>
        {savedSegments.length === 0 ? (
          <div className="text-[11px] text-dim">No saved segments yet</div>
        ) : (
          savedSegments.map((seg) => (
            <div key={seg.id} className="flex items-center justify-between px-2 py-1.5 border border-border rounded mb-1">
              <div>
                <div className="text-xs font-semibold text-txt">{seg.name}</div>
                <div className="text-[10px] text-dim">{seg.count} providers</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => loadSegment(seg)} className="px-1.5 py-0.5 rounded border border-border bg-surface2 text-[10px] text-txt cursor-pointer hover:bg-border">Load</button>
                <button onClick={() => deleteSegment(seg.id)} className="px-1.5 py-0.5 rounded border border-border bg-surface2 text-[10px] text-err cursor-pointer hover:bg-border">x</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
