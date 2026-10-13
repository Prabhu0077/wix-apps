// Small CSV writer (RFC 4180) that opens cleanly in Excel and Google Sheets.
//
// Formula injection: review text is written by shoppers, so a cell starting
// with = + - @ (or tab / carriage return) could run as a formula when the
// merchant opens the file. Such cells get a leading apostrophe, which
// spreadsheets show as plain text (OWASP "CSV injection" guidance).

export type CsvValue = string | number | boolean | Date | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === "string" && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvRow(values: CsvValue[]): string {
  return values.map(csvCell).join(",") + "\r\n";
}

/** UTF-8 byte-order mark so Excel reads non-English text correctly. */
export const CSV_BOM = "﻿";
