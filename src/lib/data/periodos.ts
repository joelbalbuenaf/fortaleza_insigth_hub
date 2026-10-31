export const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

// Calendario de la cartera: Ene 2022 – Sep 2026 (último mes cerrado). Son 57 meses, con cuatro
// años completos (2022–2025), así que el forecast estima estacionalidad sobre cuatro ciclos.
export const PRIMER_PERIODO = "2022-01";
export const ULTIMO_PERIODO = "2026-09";

export const anioDe = (p: string) => Number(p.slice(0, 4));
export const mesDe = (p: string) => Number(p.slice(5, 7));

export function desplazar(p: string, meses: number): string {
  const total = anioDe(p) * 12 + mesDe(p) - 1 + meses;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function rango(desde: string, hasta: string): string[] {
  const out: string[] = [];
  for (let p = desde; p <= hasta; p = desplazar(p, 1)) out.push(p);
  return out;
}

/** Todos los meses con datos (Ene 2024 – Abr 2026). */
export const periodos = rango(PRIMER_PERIODO, ULTIMO_PERIODO);

const indice = new Map(periodos.map((p, i) => [p, i]));
/** Posición de un período en el calendario; -1 si cae fuera. */
export const indiceDePeriodo = (p: string) => indice.get(p) ?? -1;

/** Mes absoluto (año × 12 + mes). Sirve para medir antigüedades que empiezan antes del calendario. */
export const mesAbsoluto = (p: string) => anioDe(p) * 12 + mesDe(p);
/** Meses transcurridos de `a` a `b`, aunque alguno caiga fuera del calendario. */
export const mesesEntre = (a: string, b: string) => mesAbsoluto(b) - mesAbsoluto(a);

export const etiquetaPeriodo = (p: string) => `${MESES[mesDe(p) - 1]} ${anioDe(p)}`;
export const etiquetaCorta = (p: string) => `${MESES[mesDe(p) - 1]} ${String(anioDe(p)).slice(2)}`;

export function etiquetaRango(desde: string, hasta: string) {
  if (desde === hasta) return etiquetaPeriodo(desde);
  if (anioDe(desde) === anioDe(hasta))
    return `${MESES[mesDe(desde) - 1]}–${etiquetaPeriodo(hasta)}`;
  return `${etiquetaPeriodo(desde)} – ${etiquetaPeriodo(hasta)}`;
}

export const presetsPeriodo = [
  { id: "ytd", label: "Ene–Sep 2026", desde: "2026-01", hasta: "2026-09" },
  { id: "u12", label: "Últimos 12 meses", desde: "2025-10", hasta: "2026-09" },
  { id: "a2025", label: "Año 2025", desde: "2025-01", hasta: "2025-12" },
  { id: "a2024", label: "Año 2024", desde: "2024-01", hasta: "2024-12" },
  { id: "todo", label: "Ene 2022 – Sep 2026", desde: PRIMER_PERIODO, hasta: ULTIMO_PERIODO },
] as const;
