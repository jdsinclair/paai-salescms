"use client";

import { useState } from "react";

interface Props {
  count: number;
  onSave: (name: string) => void;
  onClose: () => void;
}

export default function SegmentModal({ count, onSave, onClose }: Props) {
  const [name, setName] = useState("");

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 w-96" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-bold mb-4">Save Current Filter as Segment</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Segment name (e.g. Wave 1 Targets)"
          className="w-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] px-3 py-2 rounded text-sm mb-3 focus:outline-none focus:border-[var(--accent)]"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSave(name.trim()); }}
        />
        <div className="text-[11px] text-[var(--text-dim)] mb-3">
          This will save the current filter state and {count.toLocaleString()} providers.
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => name.trim() && onSave(name.trim())}
            className="px-3 py-1.5 rounded border border-[var(--accent)] bg-[var(--accent)] text-white text-[11px] cursor-pointer hover:bg-[var(--accent-dim)]"
          >
            Save
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
