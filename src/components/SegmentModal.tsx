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
      <div className="bg-surface border border-border rounded-lg p-6 w-96" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-bold mb-4 text-txt">Save Current Filter as Segment</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Segment name (e.g. Wave 1 Targets)"
          className="w-full bg-bg border border-border text-txt px-3 py-2 rounded text-sm mb-3 focus:outline-none focus:border-accent"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) onSave(name.trim()); }}
        />
        <div className="text-[11px] text-dim mb-3">
          This will save the current filter state and {count.toLocaleString()} providers.
        </div>
        <div className="flex gap-2">
          <button onClick={() => name.trim() && onSave(name.trim())} className="px-3 py-1.5 rounded border border-accent bg-accent text-white text-[11px] cursor-pointer hover:bg-accent-dim">Save</button>
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-border bg-surface2 text-txt text-[11px] cursor-pointer hover:bg-border">Cancel</button>
        </div>
      </div>
    </div>
  );
}
