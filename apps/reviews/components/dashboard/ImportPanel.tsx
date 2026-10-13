"use client";

// Import reviews (PRD R8): one click from the native Wix Reviews app, or any
// CSV export (Judge.me, Loox, Yotpo, Fera, Stamped, a spreadsheet). The file
// is read in the browser, columns are guessed and can be changed, then rows
// go to the server in batches of 500 — there is no row limit.

import { useState } from "react";

import { parseCsv } from "@/lib/csv-parse";
import { api, ApiError } from "@/lib/dashboard-client";
import { guessMapping, IMPORT_FIELDS, type ImportField, type ImportRow } from "@/lib/import-fields";

type Report = { imported: number; duplicates: number; failed: { line: number; reason: string }[] };
type Csv = { fileName: string; headers: string[]; rows: string[][] };

const BATCH = 500;

export function ImportPanel({ instance, onDone }: { instance: string | null; onDone: () => void }) {
  const [csv, setCsv] = useState<Csv | null>(null);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, number>>>({});
  const [publish, setPublish] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function readFile(file: File | undefined) {
    setReport(null);
    setError(null);
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return setError("That file is over 50 MB. Split it into smaller files.");
    const all = parseCsv(await file.text());
    if (all.length < 2) return setError("We couldn't find any rows in that file. Check that it's a CSV with a header row.");
    const headers = all[0].map((h) => h.trim());
    setCsv({ fileName: file.name, headers, rows: all.slice(1) });
    setMapping(guessMapping(headers));
  }

  const missing = IMPORT_FIELDS.filter((f) => f.required && mapping[f.key] === undefined).map((f) => f.label);

  async function importCsv() {
    if (!csv || missing.length) return;
    setError(null);
    const total: Report = { imported: 0, duplicates: 0, failed: [] };
    try {
      for (let i = 0; i < csv.rows.length; i += BATCH) {
        setBusy(`Importing… ${Math.min(i, csv.rows.length)} of ${csv.rows.length}`);
        const rows: ImportRow[] = csv.rows.slice(i, i + BATCH).map((cells, j) => {
          const row: ImportRow = { line: i + j + 2 }; // +2: header row and 1-based lines
          for (const f of IMPORT_FIELDS) {
            const col = mapping[f.key];
            if (col !== undefined) row[f.key] = (cells[col] ?? "").slice(0, 6000);
          }
          return row;
        });
        const r = await api<Report>(instance, "/api/reviews/import", { method: "POST", body: { publish, rows } });
        total.imported += r.imported;
        total.duplicates += r.duplicates;
        total.failed.push(...r.failed);
      }
      setReport(total);
      setCsv(null);
      onDone();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : `The import stopped. ${total.imported} reviews were saved; run the same file again to add the rest (nothing is added twice).`,
      );
      if (total.imported) setReport(total);
    } finally {
      setBusy(null);
    }
  }

  async function importFromWix() {
    setError(null);
    setReport(null);
    const total: Report = { imported: 0, duplicates: 0, failed: [] };
    let cursor: string | null = null;
    try {
      do {
        setBusy(`Importing from Wix Reviews… ${total.imported + total.duplicates} so far`);
        const r: { imported: number; duplicates: number; next: string | null } = await api(instance, "/api/reviews/import/wix", {
          method: "POST",
          body: cursor ? { cursor } : {},
        });
        total.imported += r.imported;
        total.duplicates += r.duplicates;
        cursor = r.next;
      } while (cursor);
      setReport(total);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't read your Wix Reviews. Try again, or export them as CSV.");
      if (total.imported) setReport(total);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card" aria-labelledby="import-title">
      <div className="card-head">
        <div>
          <h2 className="card-title" id="import-title">
            Import reviews
          </h2>
          <p className="card-sub">
            Bring your reviews from Wix Reviews or another app. Imported reviews are labelled &quot;Imported review&quot; and keep
            their original dates. Importing the same reviews twice doesn&apos;t create copies.
          </p>
        </div>
      </div>

      <div className="card-body stack-sm">
        <div className="import-row">
          <div>
            <div className="check-title">From Wix Reviews</div>
            <div className="check-help">Copies every product review from the Wix Reviews app on this site.</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={importFromWix} disabled={busy !== null}>
            Import from Wix Reviews
          </button>
        </div>

        <div className="import-row">
          <div>
            <div className="check-title">From a CSV file</div>
            <div className="check-help">Export reviews as CSV from your old app or spreadsheet, then choose the file.</div>
          </div>
          <label className="btn btn-secondary btn-sm file-btn">
            <input type="file" accept=".csv,text/csv" onChange={(e) => void readFile(e.target.files?.[0])} disabled={busy !== null} />
            Choose CSV file
          </label>
        </div>

        {csv && (
          <div className="stack-sm">
            <p>
              <strong>{csv.fileName}</strong>: {csv.rows.length.toLocaleString("en-US")} rows. Check which column holds each
              detail:
            </p>
            <div className="map-grid">
              {IMPORT_FIELDS.map((f) => (
                <label key={f.key} className="map-row">
                  <span>
                    {f.label}
                    {f.required && <span className="rsmall"> (required)</span>}
                  </span>
                  <select
                    className="select-sm"
                    value={mapping[f.key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => {
                        const next = { ...m };
                        if (e.target.value === "") delete next[f.key];
                        else next[f.key] = Number(e.target.value);
                        return next;
                      })
                    }
                  >
                    <option value="">— not in file —</option>
                    {csv.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <label className="map-check">
              <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> Publish imported
              reviews right away (otherwise they wait in &quot;Waiting for you&quot;)
            </label>
            {missing.length > 0 && <div className="notice notice-warn">Choose a column for: {missing.join(", ")}.</div>}
            <div>
              <button className="btn btn-primary btn-sm" onClick={importCsv} disabled={busy !== null || missing.length > 0}>
                Import {csv.rows.length.toLocaleString("en-US")} reviews
              </button>
            </div>
          </div>
        )}

        {busy && (
          <p className="rsmall" role="status">
            {busy}
          </p>
        )}
        {error && (
          <div className="notice notice-error" role="alert">
            {error}
          </div>
        )}
        {report && (
          <div className="notice notice-ok" role="status">
            <strong>{report.imported.toLocaleString("en-US")} reviews imported.</strong>
            {report.duplicates > 0 && ` ${report.duplicates.toLocaleString("en-US")} were already here and were skipped.`}
            {report.failed.length > 0 && ` ${report.failed.length.toLocaleString("en-US")} rows couldn't be imported:`}
          </div>
        )}
        {report && report.failed.length > 0 && (
          <ul className="import-failed">
            {report.failed.slice(0, 100).map((f) => (
              <li key={f.line}>
                Row {f.line}: {f.reason}
              </li>
            ))}
            {report.failed.length > 100 && <li>…and {report.failed.length - 100} more.</li>}
          </ul>
        )}
      </div>
    </section>
  );
}
