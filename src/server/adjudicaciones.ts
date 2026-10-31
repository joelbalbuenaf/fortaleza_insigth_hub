// Adjudicaciones: sorteo y licitación (solo servidor). Datos ILUSTRATIVOS sobre un mecanismo
// PÚBLICO, el que Fortaleza describe en su sitio:
//   - Sorteo: se extrae una bolilla de cada contenedor para formar el número de contrato, así que
//     todos los socios al día tienen la misma probabilidad, sin importar su antigüedad.
//   - Licitación: se abren los sobres ante escribano y gana la mejor oferta, que combina los
//     pagos realizados con los puntos de beneficios.
//
// Nada de lo que hay acá debe leerse como una promesa de plazo: la espera es probabilística.
import { etiquetaCorta, etiquetaPeriodo, periodos, rango } from "@/lib/data/periodos";
import { redondear } from "@/lib/data/random";
import { media } from "@/lib/data/estadistica";
import {
  ANTIGUEDAD_MINIMA,
  antiguedadMeses,
  esElegible,
  ofertaLicitatoria,
  socios,
  VALOR_PUNTO,
  type Socio,
  type ViaAdjudicacion,
} from "./socios/datos";
import { PERIODO_ACTUAL, type FiltroCartera } from "./socios/consultas";

const mm = (guaranies: number, d = 0) => redondear(guaranies / 1_000_000, d);

export const MECANISMOS: ViaAdjudicacion[] = ["Sorteo", "Licitación"];

/** Actos de adjudicación mes a mes. */
export function serieAdjudicaciones(f: FiltroCartera = PERIODO_ACTUAL) {
  return rango(f.desde, f.hasta).map((periodo) => {
    const delMes = socios.filter((s) => s.adjudicado === periodo);
    const sorteo = delMes.filter((s) => s.via === "Sorteo");
    const licitacion = delMes.filter((s) => s.via === "Licitación");
    const ofertas = licitacion.map((s) => ofertaLicitatoria(s, periodo));
    return {
      periodo,
      mes: etiquetaCorta(periodo),
      etiqueta: etiquetaPeriodo(periodo),
      sorteo: sorteo.length,
      licitacion: licitacion.length,
      total: delMes.length,
      elegibles: socios.filter((s) => esElegible(s, periodo) || s.adjudicado === periodo).length,
      /** Oferta más baja que ganó en la licitación del mes: el "corte" del acto. */
      ofertaGanadoraMinimaMM: ofertas.length ? mm(Math.min(...ofertas), 1) : null,
      ofertaGanadoraMediaMM: ofertas.length ? mm(media(ofertas), 1) : null,
    };
  });
}

/** Resumen del período: cuántas unidades se adjudicaron y cuánto esperaron los adjudicados. */
export function resumenAdjudicaciones(f: FiltroCartera = PERIODO_ACTUAL) {
  const delPeriodo = socios.filter(
    (s) => s.adjudicado && s.adjudicado >= f.desde && s.adjudicado <= f.hasta,
  );
  const esperas = delPeriodo.map((s) => antiguedadMeses(s, s.adjudicado!));
  const elegiblesHoy = socios.filter((s) => esElegible(s, f.hasta));
  const porMes = serieAdjudicaciones(f);
  const adjudicadosPorMes = media(porMes.map((m) => m.total));

  return {
    fuente: "ilustrativo" as const,
    adjudicados: delPeriodo.length,
    porSorteo: delPeriodo.filter((s) => s.via === "Sorteo").length,
    porLicitacion: delPeriodo.filter((s) => s.via === "Licitación").length,
    esperaMediaMeses: esperas.length ? redondear(media(esperas), 1) : null,
    esperaMinimaMeses: esperas.length ? Math.min(...esperas) : null,
    esperaMaximaMeses: esperas.length ? Math.max(...esperas) : null,
    elegiblesEnEspera: elegiblesHoy.length,
    adjudicadosPorMes: redondear(adjudicadosPorMes, 1),
    /**
     * Años que tardaría en adjudicarse toda la cola si el ritmo actual se mantuviera. Es una
     * división, no un pronóstico: la cola crece con las altas y el ritmo depende de las obras.
     */
    aniosParaVaciarLaCola: adjudicadosPorMes
      ? redondear(elegiblesHoy.length / adjudicadosPorMes / 12, 1)
      : null,
  };
}

/** Espera hasta la adjudicación según el año de alta, para ver si la cola se alarga o se acorta. */
export function esperaPorCohorte() {
  const anios = [
    ...new Set(socios.filter((s) => s.adjudicado).map((s) => Number(s.alta.slice(0, 4)))),
  ]
    .sort()
    .slice(-12);
  return anios.map((anio) => {
    const lista = socios.filter((s) => s.adjudicado && Number(s.alta.slice(0, 4)) === anio);
    const esperas = lista.map((s) => antiguedadMeses(s, s.adjudicado!));
    const total = socios.filter((s) => Number(s.alta.slice(0, 4)) === anio).length;
    return {
      cohorte: String(anio),
      adjudicados: lista.length,
      /** Ojo: las cohortes recientes tienen menos tiempo de haber sido adjudicadas. */
      adjudicadosPct: total ? redondear((lista.length / total) * 100, 1) : 0,
      esperaMediaMeses: esperas.length ? redondear(media(esperas), 1) : null,
      porSorteoPct: lista.length
        ? redondear((lista.filter((s) => s.via === "Sorteo").length / lista.length) * 100, 1)
        : 0,
    };
  });
}

// ── Simulación: qué chance tiene un socio ──────────────────────────────────────────────

export type EntradaSimulacion = {
  /** Cuotas pagadas acumuladas, en guaraníes. */
  pagadoGs?: number | undefined;
  /** Puntos de beneficios. */
  puntos?: number | undefined;
  /** Antigüedad en meses. */
  antiguedadMeses?: number | undefined;
  /** Contrato existente: si viene, se toman sus datos reales de la cartera. */
  contrato?: string | undefined;
};

/**
 * Probabilidad de adjudicación de un socio en el próximo acto, separando los dos mecanismos.
 *
 * - Sorteo: 1 / elegibles. No depende de la antigüedad ni de los pagos.
 * - Licitación: depende de la posición de su oferta en la cola de elegibles. Se estima con la
 *   distribución de ofertas de los elegibles de hoy y la cantidad de cupos que se asignaron por
 *   licitación en los últimos meses.
 *
 * Es un cálculo sobre el acto siguiente, no un plazo prometido.
 */
export function simularAdjudicacion(entrada: EntradaSimulacion, hasta = PERIODO_ACTUAL.hasta) {
  const elegibles = socios.filter((s) => esElegible(s, hasta));
  const existente = entrada.contrato
    ? socios.find((s) => s.contrato.toLowerCase() === entrada.contrato!.toLowerCase())
    : undefined;

  const antiguedad = existente
    ? antiguedadMeses(existente, hasta)
    : Math.max(0, Math.round(entrada.antiguedadMeses ?? 0));
  const oferta = existente
    ? ofertaLicitatoria(existente, hasta)
    : (entrada.pagadoGs ?? 0) + (entrada.puntos ?? 0) * VALOR_PUNTO;

  if (antiguedad < ANTIGUEDAD_MINIMA)
    return {
      fuente: "ilustrativo" as const,
      elegible: false,
      motivo: `Hacen falta ${ANTIGUEDAD_MINIMA} meses de antigüedad para entrar al acto; lleva ${antiguedad}.`,
      antiguedadMeses: antiguedad,
      ofertaMM: mm(oferta, 1),
      elegibles: elegibles.length,
      probabilidadSorteoPct: 0,
      probabilidadLicitacionPct: 0,
      probabilidadTotalPct: 0,
      posicionEnLaCola: null,
      ofertaParaEntrarMM: null,
      cupos: { sorteo: 0, licitacion: 0 },
    };

  // Cupos del próximo acto: promedio de los últimos seis meses efectivamente adjudicados.
  const ultimos = serieAdjudicaciones({
    desde: periodos[Math.max(0, periodos.length - 6)]!,
    hasta,
  });
  const cuposSorteo = Math.round(media(ultimos.map((m) => m.sorteo)));
  const cuposLicitacion = Math.round(media(ultimos.map((m) => m.licitacion)));

  const ofertas = elegibles.map((s) => ofertaLicitatoria(s, hasta)).sort((a, b) => b - a);
  const mejores = ofertas.filter((o) => o > oferta).length;
  const posicion = mejores + 1;
  const corte = ofertas[Math.max(0, cuposLicitacion - 1)] ?? null;

  const pSorteo = elegibles.length ? Math.min(1, cuposSorteo / elegibles.length) : 0;
  // En licitación entra si su oferta queda entre las primeras `cuposLicitacion`.
  const pLicitacion = posicion <= cuposLicitacion ? 1 : 0;
  const pTotal = pLicitacion === 1 ? 1 : pSorteo;

  return {
    fuente: "ilustrativo" as const,
    elegible: true,
    motivo: null,
    antiguedadMeses: antiguedad,
    ofertaMM: mm(oferta, 1),
    elegibles: elegibles.length,
    probabilidadSorteoPct: redondear(pSorteo * 100, 2),
    probabilidadLicitacionPct: redondear(pLicitacion * 100, 1),
    probabilidadTotalPct: redondear(pTotal * 100, 2),
    posicionEnLaCola: posicion,
    /** Oferta que hoy haría falta para entrar por licitación. */
    ofertaParaEntrarMM: corte === null ? null : mm(corte, 1),
    cupos: { sorteo: cuposSorteo, licitacion: cuposLicitacion },
    nota: "El sorteo no mira antigüedad ni pagos: todos los socios al día tienen la misma chance. La licitación sí ordena por oferta. Esto describe el próximo acto, no un plazo de adjudicación.",
  };
}

/** Distribución de ofertas de los elegibles: dónde está el corte de la licitación. */
export function distribucionOfertas(hasta = PERIODO_ACTUAL.hasta) {
  const ofertas = socios
    .filter((s) => esElegible(s, hasta))
    .map((s) => ofertaLicitatoria(s, hasta))
    .sort((a, b) => a - b);
  if (!ofertas.length) return [];
  const percentil = (p: number) =>
    ofertas[Math.min(ofertas.length - 1, Math.floor(ofertas.length * p))]!;
  return [10, 25, 50, 75, 90, 99].map((p) => ({
    percentil: `P${p}`,
    ofertaMM: mm(percentil(p / 100), 1),
  }));
}

export type Adjudicado = {
  contrato: string;
  periodo: string;
  etiqueta: string;
  via: ViaAdjudicacion;
  esperaMeses: number;
  ofertaMM: number;
};

/** Últimos adjudicados, identificados por contrato (nunca por nombre). */
export function ultimosAdjudicados(limite = 20): Adjudicado[] {
  return socios
    .filter((s): s is Socio & { adjudicado: string; via: ViaAdjudicacion } => Boolean(s.adjudicado))
    .sort((a, b) => b.adjudicado.localeCompare(a.adjudicado))
    .slice(0, limite)
    .map((s) => ({
      contrato: s.contrato,
      periodo: s.adjudicado,
      etiqueta: etiquetaPeriodo(s.adjudicado),
      via: s.via,
      esperaMeses: antiguedadMeses(s, s.adjudicado),
      ofertaMM: mm(ofertaLicitatoria(s, s.adjudicado), 1),
    }));
}
