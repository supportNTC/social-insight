/** RFC 4180-ish CSV escaping — quotes a field only when it needs it, doubles embedded quotes. */
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsvRow(fields: (string | number | null)[]): string {
  return fields.map((f) => escapeCsvField(f === null ? "" : String(f))).join(",");
}

export function toCsv(rows: (string | number | null)[][]): string {
  // \r\n and a leading BOM so Excel (still the most common opener) reads UTF-8 Thai text correctly.
  return "﻿" + rows.map(toCsvRow).join("\r\n");
}
