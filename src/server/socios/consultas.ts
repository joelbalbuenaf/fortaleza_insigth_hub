// Consultas sobre la cartera de socios (solo servidor). Los aportes se guardan en guaraníes y
// se devuelven en millones de guaraníes (Gs MM); los conteos de socios van aparte y nunca se
// suman con montos.
import { nombrePlan, planes, sucursales, type Plan, type Sucursal } from "@/lib/data/filtros";
import { barrios, normalizar } from "@/lib/data/geografia";
import { desvio, media } from "@/lib/data/estadistica";
import {
  desplazar,
  etiquetaCorta,
  etiquetaPeriodo,
  indiceDePeriodo,
  periodos,
  rango,
  ULTIMO_PERIODO,
} from "@/lib/data/periodos";
import { redondear } from "@/lib/data/random";
import {
  antiguedadMeses,
  atrasoAl,
  cobrado,
  cobradoEnRango,
  cuotasDe,
  emitido,
  emitidoEnRango,
  esActivo,
  estadoDe,
  ofertaLicitatoria,
  socios,
  type EstadoSocio,
  type Socio,
} from "./datos";

export type FiltroCartera = {
  desde: string;
  hasta: string;
  plan?: Plan | undefined;
  sucursal?: Sucursal | undefined;
  barrio?: string | undefined;
};

/** Período actual del Hub: Ene–Sep 2026, contra el mismo tramo de 2025. */
export const PERIODO_ACTUAL = { desde: "2026-01", hasta: ULTIMO_PERIODO };

const pct = (a: number, b: number | null) =>
  b && b > 0 ? redondear(((a - b) / b) * 100, 1) : null;
/** Guaraníes a millones de guaraníes. */
const mm = (guaranies: number, d = 0) => redondear(guaranies / 1_000_000, d);

function enRango(f: FiltroCartera, desplazamiento: number) {
  const desde = desplazar(f.desde, desplazamiento);
  const hasta = desplazar(f.hasta, desplazamiento);
  return periodos.includes(desde) ? { ...f, desde, hasta } : null;
}

/** Mismo rango un año antes (null si no hay datos). */
export const rangoInteranual = (f: FiltroCartera) => enRango(f, -12);
/** Rango inmediatamente anterior de igual duración (null si no hay datos). */
export const rangoAnterior = (f: FiltroCartera) => enRango(f, -rango(f.desde, f.hasta).length);

export function filtrar(f: Pick<FiltroCartera, "plan" | "sucursal" | "barrio">) {
  return socios.filter(
    (s) =>
      (!f.plan || s.plan === f.plan) &&
      (!f.sucursal || s.sucursal === f.sucursal) &&
      (!f.barrio || s.barrio === f.barrio),
  );
}

const sumarCobrado = (lista: Socio[], f: FiltroCartera) =>
  lista.reduce((t, s) => t + cobradoEnRango(s, f.desde, f.hasta), 0);
const sumarEmitido = (lista: Socio[], f: FiltroCartera) =>
  lista.reduce((t, s) => t + emitidoEnRango(s, f.desde, f.hasta), 0);

/**
 * Saldo en mora al cierre del período: cuotas impagas pendientes valorizadas a la cuota vigente
 * de cada socio. No se calcula como "emitido − cobrado" de la ventana, porque las
 * regularizaciones de meses anteriores entran en la ventana y la dejarían en casi cero.
 */
export function saldoEnMora(lista: Socio[], hasta: string) {
  let saldo = 0;
  let cuotas = 0;
  let enMora = 0;
  for (const s of lista) {
    if (!esActivo(s, hasta)) continue;
    const atraso = atrasoAl(s, hasta);
    if (atraso <= 0) continue;
    // La última cuota emitida es la referencia de valor.
    const i = Math.min(indiceDePeriodo(hasta), periodos.length - 1);
    let cuota = 0;
    for (let k = i; k >= 0 && !cuota; k--) cuota = s.emitido[k] ?? 0;
    saldo += atraso * cuota;
    cuotas += atraso;
    enMora++;
  }
  return { saldo, cuotas, socios: enMora };
}

// ── Resumen de cartera ─────────────────────────────────────────────────────────────────

export function resumenCartera(f: FiltroCartera) {
  const lista = filtrar(f);
  const cob = sumarCobrado(lista, f);
  const emi = sumarEmitido(lista, f);
  const ia = rangoInteranual(f);
  const ant = rangoAnterior(f);
  const interanual = ia ? sumarCobrado(lista, ia) : null;
  const anterior = ant ? sumarCobrado(lista, ant) : null;

  const activos = lista.filter((s) => esActivo(s, f.hasta));
  const estados = activos.map((s) => estadoDe(s, f.hasta));
  const mora = saldoEnMora(lista, f.hasta);
  const meses = rango(f.desde, f.hasta).length;
  const altas = lista.filter((s) => s.alta >= f.desde && s.alta <= f.hasta).length;
  const bajas = lista.filter((s) => s.baja && s.baja >= f.desde && s.baja <= f.hasta).length;
  const adjudicados = lista.filter(
    (s) => s.adjudicado && s.adjudicado >= f.desde && s.adjudicado <= f.hasta,
  ).length;
  // Facturación de un mes típico del período: referencia para dimensionar la mora.
  const emitidoMensual = emi / (meses || 1);

  return {
    fuente: "ilustrativo" as const,
    unidad: "Gs MM",
    cobradoMM: mm(cob),
    emitidoMM: mm(emi),
    cobrado: cob,
    interanualMM: interanual === null ? null : mm(interanual),
    variacionInteranualPct: pct(cob, interanual),
    anteriorMM: anterior === null ? null : mm(anterior),
    variacionAnteriorPct: pct(cob, anterior),
    /** Cobranza del período sobre lo emitido: cuánto de lo facturado entró. */
    efectividadCobranzaPct: emi ? redondear((cob / emi) * 100, 1) : null,
    socios: lista.length,
    activos: activos.length,
    alDia: estados.filter((e) => e === "Al día").length,
    enMora: estados.filter((e) => e === "En mora").length,
    adjudicadosVigentes: estados.filter((e) => e === "Adjudicado").length,
    altas,
    bajas,
    crecimientoNeto: altas - bajas,
    adjudicadosEnPeriodo: adjudicados,
    moraSaldoMM: mm(mora.saldo),
    moraCuotas: mora.cuotas,
    /** Saldo en mora como % de un mes de facturación: así se lee mejor que en "meses". */
    moraPctFacturacionMensual: emitidoMensual
      ? redondear((mora.saldo / emitidoMensual) * 100, 1)
      : 0,
    moraSociosPct: activos.length ? redondear((mora.socios / activos.length) * 100, 1) : 0,
    /** Cuota media de los socios activos, en guaraníes. */
    cuotaMediaGs: activos.length
      ? Math.round(
          activos.reduce((t, s) => t + (emitido(s, f.hasta) || s.aporteMensual), 0) /
            activos.length,
        )
      : 0,
  };
}

export function serieMensualCartera(f: FiltroCartera) {
  const lista = filtrar(f);
  return rango(f.desde, f.hasta).map((periodo) => {
    const previo = desplazar(periodo, -12);
    const cob = lista.reduce((t, s) => t + cobrado(s, periodo), 0);
    const emi = lista.reduce((t, s) => t + emitido(s, periodo), 0);
    const mora = saldoEnMora(lista, periodo);
    return {
      periodo,
      mes: etiquetaCorta(periodo),
      etiqueta: etiquetaPeriodo(periodo),
      cobradoMM: mm(cob),
      emitidoMM: mm(emi),
      anioAnteriorMM: periodos.includes(previo)
        ? mm(lista.reduce((t, s) => t + cobrado(s, previo), 0))
        : null,
      moraPct: emi ? redondear((mora.saldo / emi) * 100, 1) : 0,
      activos: lista.filter((s) => esActivo(s, periodo)).length,
    };
  });
}

/** Altas y bajas de socios mes a mes: el crecimiento neto de la cartera. */
export function altasYBajas(f: FiltroCartera) {
  const lista = filtrar(f);
  return rango(f.desde, f.hasta).map((periodo) => {
    const altas = lista.filter((s) => s.alta === periodo).length;
    const bajas = lista.filter((s) => s.baja === periodo).length;
    return {
      periodo,
      mes: etiquetaCorta(periodo),
      etiqueta: etiquetaPeriodo(periodo),
      altas,
      // Negativas para que el gráfico de barras las muestre hacia abajo.
      bajas: -bajas,
      neto: altas - bajas,
    };
  });
}

// ── Desgloses ──────────────────────────────────────────────────────────────────────────

type FilaDesglose = {
  clave: string;
  nombre: string;
  cobradoMM: number;
  participacionPct: number;
  variacionInteranualPct: number | null;
  socios: number;
  moraPctFacturacionMensual: number;
};

function desglosar(
  f: FiltroCartera,
  claves: string[],
  nombre: (c: string) => string,
  filtroDe: (c: string) => Pick<FiltroCartera, "plan" | "sucursal" | "barrio">,
): FilaDesglose[] {
  const total = sumarCobrado(filtrar(f), f);
  const ia = rangoInteranual(f);
  return claves
    .map((clave) => {
      const lista = filtrar({ ...f, ...filtroDe(clave) });
      const cob = sumarCobrado(lista, f);
      const emi = sumarEmitido(lista, f);
      const mora = saldoEnMora(lista, f.hasta);
      return {
        clave,
        nombre: nombre(clave),
        cobradoMM: mm(cob),
        participacionPct: total ? redondear((cob / total) * 100, 1) : 0,
        variacionInteranualPct: ia ? pct(cob, sumarCobrado(lista, ia)) : null,
        socios: lista.filter((s) => esActivo(s, f.hasta)).length,
        moraPctFacturacionMensual: emi
          ? redondear((mora.saldo / (emi / rango(f.desde, f.hasta).length)) * 100, 1)
          : 0,
      };
    })
    .filter((d) => d.socios > 0)
    .sort((a, b) => b.cobradoMM - a.cobradoMM);
}

export const porPlan = (f: FiltroCartera) =>
  desglosar(
    f,
    [...planes],
    (c) => nombrePlan[c as Plan],
    (c) => ({ plan: c as Plan }),
  );

export const porSucursal = (f: FiltroCartera) =>
  desglosar(
    f,
    [...sucursales],
    (c) => c,
    (c) => ({ sucursal: c as Sucursal }),
  );

export const porBarrio = (f: FiltroCartera) =>
  desglosar(
    f,
    barrios.map((b) => b.nombre),
    (c) => c,
    (c) => ({ barrio: c }),
  );

// ── Socios ─────────────────────────────────────────────────────────────────────────────

export type OrdenSocios = "aportes" | "antiguedad" | "atraso" | "oferta" | "contrato";
/** Estados por los que se puede filtrar el listado de socios. */
export type EstadoSocioFiltro = EstadoSocio;

export type FilaSocio = {
  contrato: string;
  plan: Plan;
  sucursal: Sucursal;
  canal: string;
  barrio: string;
  alta: string;
  altaEtiqueta: string;
  antiguedadMeses: number;
  cuotaGs: number;
  aportadoMM: number;
  cuotasPagadas: number;
  cuotasEmitidas: number;
  atraso: number;
  puntos: number;
  ofertaMM: number;
  estado: EstadoSocio;
  adjudicado: string | null;
  via: string | null;
};

function fila(s: Socio, f: FiltroCartera): FilaSocio {
  const { emitidas, pagadas } = cuotasDe(s, f.hasta);
  return {
    contrato: s.contrato,
    plan: s.plan,
    sucursal: s.sucursal,
    canal: s.canal,
    barrio: s.barrio,
    alta: s.alta,
    altaEtiqueta: etiquetaPeriodo(s.alta),
    antiguedadMeses: antiguedadMeses(s, f.hasta),
    cuotaGs: emitido(s, f.hasta) || s.aporteMensual,
    aportadoMM: mm(cobradoEnRango(s, f.desde, f.hasta), 1),
    cuotasPagadas: pagadas,
    cuotasEmitidas: emitidas,
    atraso: atrasoAl(s, f.hasta),
    puntos: s.puntos,
    ofertaMM: mm(ofertaLicitatoria(s, f.hasta), 1),
    estado: estadoDe(s, f.hasta),
    adjudicado: s.adjudicado,
    via: s.via,
  };
}

export function rankingSocios(
  f: FiltroCartera & {
    busqueda?: string | undefined;
    estado?: EstadoSocio | undefined;
    canal?: string | undefined;
  },
  orden: OrdenSocios = "aportes",
) {
  const q = f.busqueda ? normalizar(f.busqueda) : "";
  const filas = filtrar(f)
    .filter((s) => !f.canal || s.canal === f.canal)
    .filter(
      (s) => !q || normalizar(`${s.contrato} ${s.plan} ${s.sucursal} ${s.barrio}`).includes(q),
    )
    .map((s) => fila(s, f))
    .filter((r) => !f.estado || r.estado === f.estado);
  const comparar: Record<OrdenSocios, (a: FilaSocio, b: FilaSocio) => number> = {
    aportes: (a, b) => b.aportadoMM - a.aportadoMM,
    antiguedad: (a, b) => b.antiguedadMeses - a.antiguedadMeses,
    atraso: (a, b) => b.atraso - a.atraso || b.aportadoMM - a.aportadoMM,
    oferta: (a, b) => b.ofertaMM - a.ofertaMM,
    contrato: (a, b) => a.contrato.localeCompare(b.contrato),
  };
  return filas.sort(comparar[orden]);
}

export function buscarSocio(texto: string) {
  const q = normalizar(texto);
  if (!q) return [];
  const exacto = socios.find((s) => normalizar(s.contrato) === q || s.contrato.slice(2) === q);
  if (exacto) return [exacto];
  const palabras = q.split(/\s+/).filter((p) => p.length > 1);
  return socios.filter((s) => {
    const t = normalizar(`${s.contrato} ${s.plan} ${s.sucursal} ${s.barrio} ${s.canal}`);
    return palabras.every((p) => t.includes(p));
  });
}

export function fichaSocio(contrato: string, f: FiltroCartera = PERIODO_ACTUAL) {
  const s = socios.find((x) => normalizar(x.contrato) === normalizar(contrato));
  if (!s) return null;
  const resumen = fila(s, f);
  const ranking = rankingSocios(f, "oferta");
  return {
    fuente: "ilustrativo" as const,
    ...resumen,
    aportadoTotalMM: mm(s.pagadoPrevio + cobradoEnRango(s, periodos[0]!, f.hasta), 1),
    cuotasPlan: s.cuotasPlan,
    avancePlanPct: redondear((resumen.antiguedadMeses / s.cuotasPlan) * 100, 1),
    /** Posición en la cola de licitación: cuántos socios tienen mejor oferta. */
    posicionLicitacion: ranking.findIndex((r) => r.contrato === s.contrato) + 1,
    totalEnCola: ranking.length,
    serie: periodos.map((p) => ({
      periodo: p,
      mes: etiquetaCorta(p),
      cobradoMM: s.cobrado[indiceDePeriodo(p)] === null ? null : mm(cobrado(s, p), 2),
      atraso: s.atraso[indiceDePeriodo(p)] ?? null,
    })),
  };
}

// ── Concentración, atípicos y aportes a la variación ───────────────────────────────────

/** Cuánto de la recaudación depende de los socios más grandes. */
export function concentracion(f: FiltroCartera) {
  const valores = filtrar(f)
    .map((s) => cobradoEnRango(s, f.desde, f.hasta))
    .filter((v) => v > 0)
    .sort((a, b) => b - a);
  const total = valores.reduce((t, v) => t + v, 0);
  let acumulado = 0;
  let n80 = valores.length;
  const puntos = valores.map((v, i) => {
    acumulado += v;
    if (acumulado >= 0.8 * total && n80 === valores.length) n80 = i + 1;
    return {
      sociosPct: redondear(((i + 1) / valores.length) * 100, 1),
      montoPct: redondear((acumulado / total) * 100, 1),
    };
  });
  const top = (n: number) =>
    redondear((valores.slice(0, n).reduce((t, v) => t + v, 0) / total) * 100, 1);
  return {
    socios: valores.length,
    n80,
    top100Pct: top(100),
    top500Pct: top(500),
    // Una curva de 8.000 puntos no se grafica: se muestrea.
    puntos: puntos.filter((_, i) => i % Math.max(1, Math.floor(puntos.length / 60)) === 0),
  };
}

/** Meses con recaudación fuera de lo habitual (|z| ≥ umbral sobre la variación interanual). */
export function mesesAtipicos(umbral = 1.8) {
  const meses = periodos.filter((p) => periodos.includes(desplazar(p, -12)));
  const serie = meses.map((p) => {
    const actual = socios.reduce((t, s) => t + cobrado(s, p), 0);
    const previo = socios.reduce((t, s) => t + cobrado(s, desplazar(p, -12)), 0);
    return {
      periodo: p,
      etiqueta: etiquetaPeriodo(p),
      cobradoMM: mm(actual),
      variacionInteranualPct: pct(actual, previo) ?? 0,
    };
  });
  const vs = serie.map((x) => x.variacionInteranualPct);
  const m = media(vs);
  const d = desvio(vs);
  return serie
    .map((x) => ({ ...x, z: redondear(d ? (x.variacionInteranualPct - m) / d : 0, 2) }))
    .filter((x) => Math.abs(x.z) >= umbral)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
}

/** Qué explica la variación interanual: por sucursal, plan y canal. */
export function aportesVariacion(f: FiltroCartera) {
  const ia = rangoInteranual(f);
  if (!ia) return { sucursales: [], planes: [] };
  const delta = (lista: Socio[]) => sumarCobrado(lista, f) - sumarCobrado(lista, ia);
  return {
    sucursales: sucursales
      .map((s) => ({ nombre: s, deltaMM: mm(delta(filtrar({ ...f, sucursal: s }))) }))
      .sort((a, b) => b.deltaMM - a.deltaMM),
    planes: planes
      .map((p) => ({ nombre: nombrePlan[p], deltaMM: mm(delta(filtrar({ ...f, plan: p }))) }))
      .sort((a, b) => b.deltaMM - a.deltaMM),
  };
}

/** Socios activos por tramo de antigüedad. */
export function tramosAntiguedad(f: FiltroCartera) {
  const tramos = [
    { clave: "0-1", nombre: "Menos de 1 año", min: 0, max: 12 },
    { clave: "1-3", nombre: "1 a 3 años", min: 12, max: 36 },
    { clave: "3-5", nombre: "3 a 5 años", min: 36, max: 60 },
    { clave: "5-10", nombre: "5 a 10 años", min: 60, max: 120 },
    { clave: "10+", nombre: "Más de 10 años", min: 120, max: Infinity },
  ];
  const activos = filtrar(f).filter((s) => esActivo(s, f.hasta));
  return tramos.map((t) => {
    const lista = activos.filter((s) => {
      const a = antiguedadMeses(s, f.hasta);
      return a >= t.min && a < t.max;
    });
    return {
      tramo: t.clave,
      nombre: t.nombre,
      socios: lista.length,
      adjudicadosPct: lista.length
        ? redondear((lista.filter((s) => s.adjudicado).length / lista.length) * 100, 1)
        : 0,
      cobradoMM: mm(sumarCobrado(lista, f)),
    };
  });
}
