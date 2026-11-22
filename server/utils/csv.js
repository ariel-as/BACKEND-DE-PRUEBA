// Convierte una lista de objetos planos en CSV (separador coma, UTF-8 con BOM para que Excel respete las tildes).
const BOM = '﻿';
const cell = (v) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv(rows) {
  if (!rows.length) return BOM;
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return BOM + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}
