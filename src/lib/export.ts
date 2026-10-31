/** Descarga filas como CSV (separador ; y BOM para que Excel en español lo abra bien). */
export function exportarCsv(filas: object[], nombre: string) {
  const primera = filas[0];
  if (!primera) return;
  const claves = Object.keys(primera);
  const celda = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = [
    claves.join(";"),
    ...filas.map((f) => claves.map((k) => celda((f as Record<string, unknown>)[k])).join(";")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre.endsWith(".csv") ? nombre : `${nombre}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const fmtNumero = (n: unknown, decimales = 1) =>
  typeof n === "number"
    ? n.toLocaleString("es-PY", { maximumFractionDigits: decimales })
    : String(n ?? "—");

export const slug = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
