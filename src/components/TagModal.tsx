"use client";

import { useState } from "react";

interface Props {
  allTagNames: string[];
  onApply: (tag: string) => void;
  onClose: () => void;
}

export default function TagModal({ allTagNames, onApply, onClose }: Props) {
  const [tag, setTag] = useState("");

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-surface border border-border rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-bold mb-4 text-txt">Tag Selected Providers</h2>
        <input
          type="text"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Enter tag name (e.g. Wave 1, Priority)"
          className="w-full bg-bg border border-border text-txt px-3 py-2 rounded text-sm mb-3 focus:outline-none focus:border-accent"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter" && tag.trim()) onApply(tag.trim()); }}
        />
        {allTagNames.length > 0 && (
          <div className="mb-3">
            <div className="text-[11px] text-dim mb-1">Existing tags (click to apply):</div>
            <div className="flex flex-wrap gap-1">
              {allTagNames.map((t) => (
                <button key={t} onClick={() => onApply(t)} className="px-2 py-0.5 rounded text-[10px] font-semibold bg-accent/20 text-indigo-light cursor-pointer hover:bg-accent/35 border-none">
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={() => tag.trim() && onApply(tag.trim())} className="px-3 py-1.5 rounded border border-accent bg-accent text-white text-[11px] cursor-pointer hover:bg-accent-dim">Apply Tag</button>
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-border bg-surface2 text-txt text-[11px] cursor-pointer hover:bg-border">Cancel</button>
        </div>
      </div>
    </div>
  );
}
