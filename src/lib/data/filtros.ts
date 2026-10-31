// Filtros de cartera compartidos por cliente y servidor (sin datos).
import { nombresBarrios } from "./geografia";
import { periodos } from "./periodos";

/** Planes del Sistema de Ahorro Fortaleza. Los nombres son PÚBLICOS (sitio de Fortaleza). */
export const planes = ["Amplia", "Plan 20", "Adicional"] as const;
export type Plan = (typeof planes)[number];

export const nombrePlan: Record<Plan, string> = {
  Amplia: "Plan Amplia",
  "Plan 20": "Plan 20",
  Adicional: "Productos adicionales",
};

/** Sucursales: ILUSTRATIVAS. El sitio menciona que hay sucursales pero no las nombra. */
export const sucursales = [
  "Casa Central",
  "Villa Morra",
  "Mcal. López",
  "San Lorenzo",
  "Ciudad del Este",
  "Encarnación",
] as const;
export type Sucursal = (typeof sucursales)[number];

/** Canales de alta de socios: ILUSTRATIVOS. */
export const canales = ["Asesor", "Web", "Referido", "App Fideliza", "Eventos"] as const;
export type Canal = (typeof canales)[number];

export type FiltrosCartera = {
  desde: string;
  hasta: string;
  plan?: Plan | undefined;
  sucursal?: Sucursal | undefined;
  barrio?: string | undefined;
};

export const FILTROS_POR_DEFECTO: FiltrosCartera = {
  desde: "2026-01",
  hasta: periodos[periodos.length - 1] ?? "2026-09",
};

const enLista = <T extends string>(v: unknown, lista: readonly T[]) =>
  lista.includes(v as T) ? (v as T) : undefined;

/** Normaliza filtros que llegan de la URL o de la IA a valores válidos. */
export function normalizarFiltros(f: {
  [K in keyof FiltrosCartera]?: FiltrosCartera[K] | undefined;
}): FiltrosCartera {
  const valido = (p: unknown, def: string) =>
    typeof p === "string" && periodos.includes(p) ? p : def;
  let desde = valido(f.desde, FILTROS_POR_DEFECTO.desde);
  let hasta = valido(f.hasta, FILTROS_POR_DEFECTO.hasta);
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  return {
    desde,
    hasta,
    plan: enLista(f.plan, planes),
    sucursal: enLista(f.sucursal, sucursales),
    barrio: f.barrio && nombresBarrios.includes(f.barrio) ? f.barrio : undefined,
  };
}

// ── Unidades ──────────────────────────────────────────────────────────────────────────
// Los aportes se guardan en guaraníes y se muestran en millones de guaraníes (Gs MM).
// Socios, unidades y adjudicaciones son conteos: nunca se suman con montos.

export const GsMM = (guaranies: number) => guaranies / 1_000_000;
export const UNIDAD_MONTO = "Gs MM";
