"use client";

import { useState } from "react";

interface ImportResult {
  ok: boolean;
  total: number;
  updated: number;
  notFound: number;
  results: { npi: string; status: string; confidence?: string; score?: number }[];
}

interface Props {
  onClose: () => void;
  onDone: () => void;
}

export default function ImportModal({ onClose, onDone }: Props) {
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!csvText.trim()) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: csvText,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed");
      } else {
        setResult(data);
        onDone();
      }
    } catch {
      setError("Network error");
    } finally {
      setImporting(false);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="bg-surface border border-border rounded-lg p-6 w-[600px] max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-sm font-bold text-txt">Import Emails from Clay</h2>
          <button onClick={onClose} className="px-2 py-0.5 rounded border border-border bg-surface2 text-[10px] text-txt cursor-pointer hover:bg-border">x</button>
        </div>

        {!result ? (
          <>
            <p className="text-[11px] text-dim mb-3">
              Paste your Clay CSV export below, or upload the file. Must have an <span className="text-accent">NPI</span> column and an <span className="text-accent">email</span> column. Each email will be scored for confidence automatically.
            </p>

            <div className="mb-3">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFile}
                className="text-xs text-dim"
              />
            </div>

            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'NPI,email\n1720004716,drjohnson@example.com\n1194742858,info@abcpsych.com'}
              className="w-full h-48 bg-bg border border-border text-txt text-xs rounded px-3 py-2 mb-3 focus:outline-none focus:border-accent resize-y"
              style={{ fontFamily: "inherit" }}
            />

            {error && <div className="text-err text-xs mb-3">{error}</div>}

            <div className="mb-3 bg-bg border border-border rounded p-3">
              <div className="text-[10px] text-dim uppercase font-semibold mb-1">Confidence Scoring</div>
              <div className="space-y-1 text-[11px]">
                <div><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: "#22c55e" }} />
                  <span className="text-ok font-semibold">High (75-95)</span> <span className="text-dim">— matches provider name</span></div>
                <div><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: "#06b6d4" }} />
                  <span className="text-info font-semibold">Medium (50-60)</span> <span className="text-dim">— personal pattern, unverified</span></div>
                <div><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: "#f59e0b" }} />
                  <span className="text-warn font-semibold">Generic (30)</span> <span className="text-dim">— info@, contact@, office@</span></div>
                <div><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: "#f59e0b" }} />
                  <span className="text-warn font-semibold">Direct Messaging (15)</span> <span className="text-dim">— EHR health exchange, not inbox</span></div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={importing || !csvText.trim()}
                className="px-4 py-2 rounded border border-accent bg-accent text-white text-[11px] cursor-pointer hover:bg-accent-dim disabled:opacity-50"
              >
                {importing ? "Importing..." : `Import Emails`}
              </button>
              <button onClick={onClose} className="px-4 py-2 rounded border border-border bg-surface2 text-txt text-[11px] cursor-pointer hover:bg-border">
                Cancel
              </button>
            </div>

            {/* Webhook info */}
            <div className="mt-4 border-t border-border pt-3">
              <div className="text-[10px] text-dim uppercase font-semibold mb-1">For automation: Clay Webhook</div>
              <div className="text-[11px] text-dim">
                Add an HTTP Request action in Clay pointing to:
              </div>
              <code className="block mt-1 text-[10px] text-accent bg-bg border border-border rounded px-2 py-1 break-all">
                POST {typeof window !== "undefined" ? window.location.origin : ""}/api/import
              </code>
              <div className="text-[10px] text-dim mt-1">
                Body: {`{ "npi": "{{NPI}}", "email": "{{email}}", "source": "clay" }`}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-ok/10 border border-ok/30 rounded p-3 mb-4">
              <div className="text-ok font-semibold text-xs">Import Complete</div>
              <div className="text-xs text-txt mt-1">
                {result.updated} emails imported &middot; {result.notFound} NPIs not found &middot; {result.total} total rows
              </div>
            </div>

            {/* Results breakdown */}
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-dim text-[10px] uppercase pb-1">NPI</th>
                    <th className="text-left text-dim text-[10px] uppercase pb-1">Status</th>
                    <th className="text-left text-dim text-[10px] uppercase pb-1">Confidence</th>
                    <th className="text-right text-dim text-[10px] uppercase pb-1">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {result.results.map((r, i) => (
                    <tr key={i}>
                      <td className="py-0.5 text-txt">{r.npi}</td>
                      <td className="py-0.5">
                        <span className={r.status === "updated" ? "text-ok" : "text-err"}>{r.status}</span>
                      </td>
                      <td className="py-0.5 text-dim">{r.confidence || "—"}</td>
                      <td className="py-0.5 text-right text-dim">{r.score ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={onClose} className="px-4 py-2 rounded border border-accent bg-accent text-white text-[11px] cursor-pointer hover:bg-accent-dim">Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
