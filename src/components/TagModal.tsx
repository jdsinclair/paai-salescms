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
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-bold mb-4">Tag Selected Providers</h2>
        <input
          type="text"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Enter tag name (e.g. Wave 1, Priority)"
          className="w-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] px-3 py-2 rounded text-sm mb-3 focus:outline-none focus:border-[var(--accent)]"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter" && tag.trim()) onApply(tag.trim()); }}
        />
        {allTagNames.length > 0 && (
          <div className="mb-3">
            <div className="text-[11px] text-[var(--text-dim)] mb-1">Existing tags (click to apply):</div>
            <div className="flex flex-wrap gap-1">
              {allTagNames.map((t) => (
                <button
                  key={t}
                  onClick={() => onApply(t)}
                  className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[rgba(99,102,241,0.2)] text-[#818cf8] cursor-pointer hover:bg-[rgba(99,102,241,0.35)] border-none"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => tag.trim() && onApply(tag.trim())}
            className="px-3 py-1.5 rounded border border-[var(--accent)] bg-[var(--accent)] text-white text-[11px] cursor-pointer hover:bg-[var(--accent-dim)]"
          >
            Apply Tag
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface2)] text-[var(--text)] text-[11px] cursor-pointer hover:bg-[var(--border)]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
