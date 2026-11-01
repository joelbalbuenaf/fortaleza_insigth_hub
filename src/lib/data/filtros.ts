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

/**
 * Asesores comerciales: ILUSTRATIVOS. Se identifican por código y no por nombre, por la misma
 * razón que la cartera no guarda nombres de socios: un nombre inventado en una demo que se
 * presenta termina confundiéndose con una persona real. Con el padrón real se reemplazan los
 * códigos por los asesores de verdad sin tocar nada más.
 */
export const asesores = Array.from(
  { length: 45 },
  (_, i) => `A-${String(i + 1).padStart(2, "0")}`,
) as readonly string[];
export type Asesor = string;

/** Canales de alta de contratos: ILUSTRATIVOS. Por dónde entró el socio, distinto del asesor
 *  que lo atiende: "Oficina" es el que se acercó a la oficina y lo tomó quien estaba de turno. */
export const canales = ["Oficina", "Web", "Referido", "App Fideliza", "Eventos"] as const;
export type Canal = (typeof canales)[number];

/**
 * Situación del contrato dentro del sistema de ahorro. Es independiente del estado de pago: un
 * contrato con posesión también puede estar en mora, y antes esa mora quedaba invisible.
 *
 *  - En espera:   aporta y todavía no salió adjudicado.
 *  - Adjudicado:  salió adjudicado y espera que se entregue su torre.
 *  - Con posesión: recibió la unidad. Su aporte pasa al valor de posesión.
 */
export const situaciones = ["En espera", "Adjudicado", "Con posesión"] as const;
export type Situacion = (typeof situaciones)[number];

export type FiltrosCartera = {
  desde: string;
  hasta: string;
  plan?: Plan | undefined;
  asesor?: Asesor | undefined;
  situacion?: Situacion | undefined;
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
    asesor: f.asesor && asesores.includes(f.asesor) ? f.asesor : undefined,
    situacion: enLista(f.situacion, situaciones),
    barrio: f.barrio && nombresBarrios.includes(f.barrio) ? f.barrio : undefined,
  };
}

// ── Aportes ───────────────────────────────────────────────────────────────────────────
// Los fija la administradora: no dependen del socio ni del barrio, sino de la SITUACIÓN del
// contrato. Son los valores vigentes; para los meses anteriores se deflactan con el ajuste anual.

/** Aporte mensual de un contrato en espera de adjudicación, en guaraníes (valor de hoy). */
export const APORTE_ESPERA = 1_655_000;
/** Aporte mensual de un contrato con posesión de la unidad, en guaraníes (valor de hoy). */
export const APORTE_POSESION = 5_000_000;

// ── Unidades ──────────────────────────────────────────────────────────────────────────
// Los aportes se guardan en guaraníes y se muestran en millones de guaraníes (Gs MM).
// Socios, unidades y adjudicaciones son conteos: nunca se suman con montos.

export const GsMM = (guaranies: number) => guaranies / 1_000_000;
export const UNIDAD_MONTO = "Gs MM";
