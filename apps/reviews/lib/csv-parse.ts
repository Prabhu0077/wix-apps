// RFC 4180 CSV parser (quotes, escaped quotes, commas and newlines inside
// quotes, CRLF or LF, UTF-8 BOM). Runs in the browser for review imports.
// Also accepts semicolon- or tab-separated files (common from European Excel).

export function detectDelimiter(firstLine: string): string {
  const counts = [",", ";", "\t"].map((d) => ({ d, n: firstLine.split(d).length - 1 }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].n > 0 ? counts[0].d : ",";
}

export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const firstLineEnd = text.search(/\r?\n/);
  const delim = detectDelimiter(firstLineEnd === -1 ? text : text.slice(0, firstLineEnd));

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"' && cell === "") quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop fully empty lines.
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}
