// Consultas sobre la cartera de socios (solo servidor). Los aportes se guardan en guaraníes y
// se devuelven en millones de guaraníes (Gs MM); los conteos de socios van aparte y nunca se
// suman con montos.
import {
  APORTE_ESPERA,
  APORTE_POSESION,
  asesores,
  nombrePlan,
  planes,
  situaciones,
  type Asesor,
  type Plan,
  type Situacion,
} from "@/lib/data/filtros";
import { barrios, normalizar } from "@/lib/data/geografia";
import { proyectos } from "@/lib/data/proyectos";
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
  estadoDePagoDe,
  entregaPrevista,
  ofertaLicitatoria,
  situacionDe,
  contratos,
  type Contrato,
  type EstadoPago,
} from "./datos";

export type FiltroCartera = {
  desde: string;
  hasta: string;
  plan?: Plan | undefined;
  asesor?: Asesor | undefined;
  situacion?: Situacion | undefined;
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

/** Filtra la cartera. `situacion` se evalúa al cierre del período, que es cuando aplica. */
export function filtrar(
  f: Pick<FiltroCartera, "plan" | "asesor" | "barrio" | "situacion"> & { hasta?: string },
) {
  return contratos.filter(
    (c) =>
      (!f.plan || c.plan === f.plan) &&
      (!f.asesor || c.asesor === f.asesor) &&
      (!f.barrio || c.barrio === f.barrio) &&
      (!f.situacion || situacionDe(c, f.hasta ?? ULTIMO_PERIODO) === f.situacion),
  );
}

const sumarCobrado = (lista: Contrato[], f: FiltroCartera) =>
  lista.reduce((t, s) => t + cobradoEnRango(s, f.desde, f.hasta), 0);
const sumarEmitido = (lista: Contrato[], f: FiltroCartera) =>
  lista.reduce((t, s) => t + emitidoEnRango(s, f.desde, f.hasta), 0);

/**
 * Saldo en mora al cierre del período: cuotas impagas pendientes valorizadas a la cuota vigente
 * de cada contrato. No se calcula como "emitido − cobrado" de la ventana, porque las
 * regularizaciones de meses anteriores entran en la ventana y la dejarían en casi cero.
 */
export function saldoEnMora(lista: Contrato[], hasta: string) {
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
  return { saldo, cuotas, contratos: enMora };
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

  const activos = lista.filter((c) => esActivo(c, f.hasta));
  // Dos ejes independientes: el estado de pago y la situación. Antes estaban mezclados y
  // "Adjudicado" pisaba a "En mora", así que la mora de los adjudicados no se contaba.
  const pagos = activos.map((c) => estadoDePagoDe(c, f.hasta));
  const situacion = (s: Situacion) => activos.filter((c) => situacionDe(c, f.hasta) === s).length;
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
    contratos: lista.length,
    activos: activos.length,
    /** Personas distintas detrás de los contratos activos: un socio puede tener varios. */
    socios: new Set(activos.map((c) => c.socioId)).size,
    alDia: pagos.filter((e) => e === "Al día").length,
    enMora: pagos.filter((e) => e === "En mora").length,
    enEspera: situacion("En espera"),
    adjudicados: situacion("Adjudicado"),
    conPosesion: situacion("Con posesión"),
    /** Lo que aportan los que ya tienen su unidad: pagan el aporte de posesión, 3× el de espera. */
    cobradoPosesionMM: mm(
      lista
        .filter((c) => situacionDe(c, f.hasta) === "Con posesión")
        .reduce((t, c) => t + cobradoEnRango(c, f.desde, f.hasta), 0),
    ),
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
    moraContratosPct: activos.length ? redondear((mora.contratos / activos.length) * 100, 1) : 0,
    /** Cuota media de los contratos activos, en guaraníes. Depende del mix de situaciones. */
    cuotaMediaGs: activos.length
      ? Math.round(activos.reduce((t, c) => t + emitido(c, f.hasta), 0) / activos.length)
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
      activos: lista.filter((c) => esActivo(c, periodo)).length,
      conPosesion: lista.filter(
        (c) => esActivo(c, periodo) && situacionDe(c, periodo) === "Con posesión",
      ).length,
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
  contratos: number;
  socios: number;
  conPosesion: number;
  moraPctFacturacionMensual: number;
};

function desglosar(
  f: FiltroCartera,
  claves: string[],
  nombre: (c: string) => string,
  filtroDe: (c: string) => Partial<Pick<FiltroCartera, "plan" | "asesor" | "barrio" | "situacion">>,
): FilaDesglose[] {
  const total = sumarCobrado(filtrar(f), f);
  const ia = rangoInteranual(f);
  return claves
    .map((clave) => {
      const lista = filtrar({ ...f, ...filtroDe(clave) });
      const activos = lista.filter((c) => esActivo(c, f.hasta));
      const cob = sumarCobrado(lista, f);
      const emi = sumarEmitido(lista, f);
      const mora = saldoEnMora(lista, f.hasta);
      return {
        clave,
        nombre: nombre(clave),
        cobradoMM: mm(cob),
        participacionPct: total ? redondear((cob / total) * 100, 1) : 0,
        variacionInteranualPct: ia ? pct(cob, sumarCobrado(lista, ia)) : null,
        contratos: activos.length,
        socios: new Set(activos.map((c) => c.socioId)).size,
        conPosesion: activos.filter((c) => situacionDe(c, f.hasta) === "Con posesión").length,
        moraPctFacturacionMensual: emi
          ? redondear((mora.saldo / (emi / rango(f.desde, f.hasta).length)) * 100, 1)
          : 0,
      };
    })
    .filter((d) => d.contratos > 0)
    .sort((a, b) => b.cobradoMM - a.cobradoMM);
}

export const porPlan = (f: FiltroCartera) =>
  desglosar(
    f,
    [...planes],
    (c) => nombrePlan[c as Plan],
    (c) => ({ plan: c as Plan }),
  );

export const porAsesor = (f: FiltroCartera) =>
  desglosar(
    f,
    [...asesores],
    (c) => c,
    (c) => ({ asesor: c }),
  );

/** Composición de la cartera por situación: de dónde sale cada guaraní de la recaudación. */
export const porSituacion = (f: FiltroCartera) =>
  desglosar(
    f,
    [...situaciones],
    (c) => c,
    (c) => ({ situacion: c as Situacion }),
  );

export const porBarrio = (f: FiltroCartera) =>
  desglosar(
    f,
    barrios.map((b) => b.nombre),
    (c) => c,
    (c) => ({ barrio: c }),
  );

// ── Contratos ──────────────────────────────────────────────────────────────────────────

export type OrdenSocios = "aportes" | "antiguedad" | "atraso" | "oferta" | "contrato";

export type FilaSocio = {
  contrato: string;
  socioId: string;
  plan: Plan;
  asesor: string;
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
  /** Dónde está en el camino hacia su unidad. */
  situacion: Situacion;
  /** Si paga al día o arrastra atraso. Independiente de la situación. */
  estadoPago: EstadoPago;
  adjudicado: string | null;
  via: string | null;
  proyecto: string | null;
  /** Entrega prevista de su torre, para los que esperan posesión. */
  entrega: string | null;
};

function fila(c: Contrato, f: FiltroCartera): FilaSocio {
  const { emitidas, pagadas } = cuotasDe(c, f.hasta);
  return {
    contrato: c.contrato,
    socioId: c.socioId,
    plan: c.plan,
    asesor: c.asesor,
    canal: c.canal,
    barrio: c.barrio,
    alta: c.alta,
    altaEtiqueta: etiquetaPeriodo(c.alta),
    antiguedadMeses: antiguedadMeses(c, f.hasta),
    cuotaGs: emitido(c, f.hasta),
    aportadoMM: mm(cobradoEnRango(c, f.desde, f.hasta), 1),
    cuotasPagadas: pagadas,
    cuotasEmitidas: emitidas,
    atraso: atrasoAl(c, f.hasta),
    puntos: c.puntos,
    ofertaMM: mm(ofertaLicitatoria(c, f.hasta), 1),
    situacion: situacionDe(c, f.hasta),
    estadoPago: estadoDePagoDe(c, f.hasta),
    adjudicado: c.adjudicado,
    via: c.via,
    proyecto: c.proyecto,
    entrega: entregaPrevista(c),
  };
}

export function rankingSocios(
  f: FiltroCartera & {
    busqueda?: string | undefined;
    estadoPago?: EstadoPago | undefined;
    canal?: string | undefined;
  },
  orden: OrdenSocios = "aportes",
) {
  const q = f.busqueda ? normalizar(f.busqueda) : "";
  const filas = filtrar({ ...f, hasta: f.hasta })
    .filter((c) => !f.canal || c.canal === f.canal)
    .filter(
      (c) =>
        !q ||
        normalizar(`${c.contrato} ${c.socioId} ${c.plan} ${c.asesor} ${c.barrio}`).includes(q),
    )
    .map((c) => fila(c, f))
    .filter((r) => !f.estadoPago || r.estadoPago === f.estadoPago);
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
  const exacto = contratos.find((c) => normalizar(c.contrato) === q || c.contrato.slice(2) === q);
  if (exacto) return [exacto];
  const palabras = q.split(/\s+/).filter((p) => p.length > 1);
  return contratos.filter((c) => {
    const t = normalizar(`${c.contrato} ${c.socioId} ${c.plan} ${c.asesor} ${c.barrio} ${c.canal}`);
    return palabras.every((p) => t.includes(p));
  });
}

export function fichaSocio(contrato: string, f: FiltroCartera = PERIODO_ACTUAL) {
  const c = contratos.find((x) => normalizar(x.contrato) === normalizar(contrato));
  if (!c) return null;
  const resumen = fila(c, f);
  const ranking = rankingSocios(f, "oferta");
  const hermanos = contratos.filter((x) => x.socioId === c.socioId && x.contrato !== c.contrato);
  return {
    fuente: "ilustrativo" as const,
    ...resumen,
    aportadoTotalMM: mm(c.pagadoPrevio + cobradoEnRango(c, periodos[0]!, f.hasta), 1),
    cuotasPlan: c.cuotasPlan,
    avancePlanPct: redondear((resumen.antiguedadMeses / c.cuotasPlan) * 100, 1),
    /** Posición en la cola de licitación: cuántos contratos tienen mejor oferta. */
    posicionLicitacion: ranking.findIndex((r) => r.contrato === c.contrato) + 1,
    totalEnCola: ranking.length,
    /** Otros contratos de la misma persona: contactarla es una sola gestión. */
    otrosContratos: hermanos.map((x) => ({
      contrato: x.contrato,
      plan: x.plan,
      situacion: situacionDe(x, f.hasta),
      atraso: atrasoAl(x, f.hasta),
    })),
    serie: periodos.map((p) => ({
      periodo: p,
      mes: etiquetaCorta(p),
      cobradoMM: c.cobrado[indiceDePeriodo(p)] === null ? null : mm(cobrado(c, p), 2),
      atraso: c.atraso[indiceDePeriodo(p)] ?? null,
    })),
  };
}

// ── Concentración, atípicos y aportes a la variación ───────────────────────────────────

/** Cuánto de la recaudación depende de los contratos más grandes. */
export function concentracion(f: FiltroCartera) {
  const valores = filtrar(f)
    .map((c) => cobradoEnRango(c, f.desde, f.hasta))
    .filter((v) => v > 0)
    .sort((a, b) => b - a);
  const total = valores.reduce((t, v) => t + v, 0);
  let acumulado = 0;
  let n80 = valores.length;
  const puntos = valores.map((v, i) => {
    acumulado += v;
    if (acumulado >= 0.8 * total && n80 === valores.length) n80 = i + 1;
    return {
      contratosPct: redondear(((i + 1) / valores.length) * 100, 1),
      montoPct: redondear((acumulado / total) * 100, 1),
    };
  });
  const top = (n: number) =>
    redondear((valores.slice(0, n).reduce((t, v) => t + v, 0) / total) * 100, 1);
  return {
    contratos: valores.length,
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
    const actual = contratos.reduce((t, s) => t + cobrado(s, p), 0);
    const previo = contratos.reduce((t, s) => t + cobrado(s, desplazar(p, -12)), 0);
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

/** Qué explica la variación interanual: por asesor, plan y situación. */
export function aportesVariacion(f: FiltroCartera) {
  const ia = rangoInteranual(f);
  if (!ia) return { asesores: [], planes: [], situaciones: [] };
  const delta = (lista: Contrato[]) => sumarCobrado(lista, f) - sumarCobrado(lista, ia);
  return {
    asesores: asesores
      .map((a) => ({ nombre: a, deltaMM: mm(delta(filtrar({ ...f, asesor: a }))) }))
      .sort((a, b) => b.deltaMM - a.deltaMM),
    planes: planes
      .map((p) => ({ nombre: nombrePlan[p], deltaMM: mm(delta(filtrar({ ...f, plan: p }))) }))
      .sort((a, b) => b.deltaMM - a.deltaMM),
    situaciones: situaciones
      .map((x) => ({
        nombre: x,
        deltaMM: mm(delta(filtrar({ ...f, situacion: x, hasta: f.hasta }))),
      }))
      .sort((a, b) => b.deltaMM - a.deltaMM),
  };
}

/** Contratos activos por tramo de antigüedad. */
export function tramosAntiguedad(f: FiltroCartera) {
  const tramos = [
    { clave: "0-1", nombre: "Menos de 1 año", min: 0, max: 12 },
    { clave: "1-3", nombre: "1 a 3 años", min: 12, max: 36 },
    { clave: "3-5", nombre: "3 a 5 años", min: 36, max: 60 },
    { clave: "5-10", nombre: "5 a 10 años", min: 60, max: 120 },
    { clave: "10+", nombre: "Más de 10 años", min: 120, max: Infinity },
  ];
  const activos = filtrar(f).filter((c) => esActivo(c, f.hasta));
  return tramos.map((t) => {
    const lista = activos.filter((c) => {
      const a = antiguedadMeses(c, f.hasta);
      return a >= t.min && a < t.max;
    });
    return {
      tramo: t.clave,
      nombre: t.nombre,
      contratos: lista.length,
      /** A más antigüedad, más chance de haber salido adjudicado: es lo que se quiere ver. */
      adjudicadosPct: lista.length
        ? redondear((lista.filter((c) => c.adjudicado).length / lista.length) * 100, 1)
        : 0,
      conPosesionPct: lista.length
        ? redondear(
            (lista.filter((c) => situacionDe(c, f.hasta) === "Con posesión").length /
              lista.length) *
              100,
            1,
          )
        : 0,
      cobradoMM: mm(sumarCobrado(lista, f)),
    };
  });
}

/**
 * Efecto de las próximas entregas sobre la recaudación mensual.
 *
 * Cuando se entrega una torre, los contratos adjudicados a ese proyecto toman posesión y su
 * aporte pasa del de espera al de posesión. Es un salto conocido —depende del cronograma de
 * obra, no de una estimación—, así que va APARTE de la proyección estadística: `proyectarSerie`
 * es tendencia + estacionalidad y no sabe nada del calendario de obra. Mezclarlas sería
 * inventar precisión.
 */
export function efectoEntregas(desdeHasta = ULTIMO_PERIODO) {
  const salto = APORTE_POSESION - APORTE_ESPERA;
  const pendientes = contratos.filter(
    (c) => c.posesion && c.posesion > desdeHasta && !(c.baja && c.baja <= desdeHasta),
  );
  const porPeriodo = new Map<string, Contrato[]>();
  for (const c of pendientes) {
    const lista = porPeriodo.get(c.posesion!) ?? [];
    lista.push(c);
    porPeriodo.set(c.posesion!, lista);
  }
  let acumulado = 0;
  const entregas = [...porPeriodo.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, lista]) => {
      acumulado += lista.length * salto;
      const proyectosDe = [...new Set(lista.map((c) => c.proyecto).filter(Boolean))] as string[];
      return {
        periodo,
        mes: etiquetaPeriodo(periodo),
        proyectos: proyectosDe.map((id) => proyectos.find((p) => p.id === id)?.nombre ?? id),
        contratos: lista.length,
        socios: new Set(lista.map((c) => c.socioId)).size,
        /** Cuánto más entra por mes a partir de esa entrega, en Gs MM. */
        incrementoMensualMM: mm(lista.length * salto, 1),
        /** Incremento mensual acumulado contando las entregas anteriores. */
        acumuladoMensualMM: mm(acumulado, 1),
      };
    });
  return {
    fuente: "mixto" as const,
    /** Fechas de entrega del catálogo público; el reparto de contratos es ilustrativo. */
    saltoPorContratoGs: salto,
    aporteEsperaGs: APORTE_ESPERA,
    aportePosesionGs: APORTE_POSESION,
    contratosPendientes: pendientes.length,
    entregas,
  };
}
