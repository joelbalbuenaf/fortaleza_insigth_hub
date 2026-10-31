// Proyección genérica de una serie mensual: tendencia lineal sobre la serie desestacionalizada,
// con índices estacionales promediados sobre los años completos disponibles, intervalo de
// predicción del 80% y backtest de los últimos meses. No conoce los datos: recibe la serie.
import { anioDe, desplazar, etiquetaCorta, etiquetaPeriodo, mesDe } from "./periodos";
import { redondear } from "./random";

export type PuntoSerie = { periodo: string; valor: number };

/** z para un intervalo de predicción del 80%. */
const Z80 = 1.2816;

function indicesEstacionales(serie: PuntoSerie[]) {
  const porAnio = new Map<number, PuntoSerie[]>();
  for (const p of serie)
    porAnio.set(anioDe(p.periodo), [...(porAnio.get(anioDe(p.periodo)) ?? []), p]);
  const completos = [...porAnio.values()].filter((a) => a.length === 12);
  const idx = Array.from({ length: 12 }, () => [] as number[]);
  for (const anio of completos) {
    const m = anio.reduce((s, p) => s + p.valor, 0) / 12;
    for (const p of anio) idx[mesDe(p.periodo) - 1]?.push(p.valor / m);
  }
  return {
    indices: idx.map((v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : 1)),
    anios: completos.length,
  };
}

function ajustar(serie: PuntoSerie[]) {
  const { indices, anios } = indicesEstacionales(serie);
  const y = serie.map((p) => p.valor / (indices[mesDe(p.periodo) - 1] ?? 1));
  const n = y.length;
  const xMedia = (n - 1) / 2;
  const yMedia = y.reduce((s, v) => s + v, 0) / n;
  const pendiente =
    y.reduce((s, v, i) => s + (i - xMedia) * (v - yMedia), 0) /
    (y.reduce((s, _, i) => s + (i - xMedia) ** 2, 0) || 1);
  const predecir = (periodo: string, i: number) =>
    Math.max(0, (yMedia + pendiente * (i - xMedia)) * (indices[mesDe(periodo) - 1] ?? 1));
  const residuos = serie.map((p, i) => p.valor / (predecir(p.periodo, i) || 1) - 1);
  const sigmaRel = Math.sqrt(residuos.reduce((s, r) => s + r * r, 0) / Math.max(1, n - 2));
  return { n, predecir, pendiente, sigmaRel, anios };
}

export function proyectarSerie(
  serie: PuntoSerie[],
  { horizonte = 8, ajustePct = 0, mesesBacktest = 4, decimales = 2 } = {},
) {
  const ultimo = serie[serie.length - 1]?.periodo ?? "";
  const modelo = ajustar(serie);
  const meses = Array.from({ length: horizonte }, (_, i) => {
    const periodo = desplazar(ultimo, i + 1);
    const base = redondear(modelo.predecir(periodo, modelo.n + i), decimales);
    const margen = base * Z80 * modelo.sigmaRel * Math.sqrt(1 + (i + 1) / modelo.n);
    return {
      periodo,
      mes: etiquetaCorta(periodo),
      etiqueta: etiquetaPeriodo(periodo),
      base,
      minimo: redondear(base - margen, decimales),
      maximo: redondear(base + margen, decimales),
      escenario: redondear(base * (1 + ajustePct / 100), decimales),
    };
  });

  // Backtest: entrenar sin los últimos meses y comparar contra lo real.
  const entrenamiento = serie.slice(0, -mesesBacktest);
  const prueba = ajustar(entrenamiento);
  const backtest = serie.slice(-mesesBacktest).map((p, k) => {
    const pronostico = redondear(prueba.predecir(p.periodo, prueba.n + k), decimales);
    return {
      periodo: p.periodo,
      mes: etiquetaCorta(p.periodo),
      real: redondear(p.valor, decimales),
      pronostico,
      errorPct: redondear((Math.abs(pronostico - p.valor) / (p.valor || 1)) * 100, 1),
    };
  });
  const suma = (k: "base" | "escenario") =>
    redondear(
      meses.reduce((s, m) => s + m[k], 0),
      decimales,
    );

  return {
    meses,
    totalBase: suma("base"),
    totalEscenario: suma("escenario"),
    ajustePct,
    backtest,
    mapePct: redondear(backtest.reduce((s, b) => s + b.errorPct, 0) / (backtest.length || 1), 1),
    pendientePorMes: redondear(modelo.pendiente, decimales),
    aniosEstacionalidad: modelo.anios,
  };
}

/** Histórico + proyección en un mismo arreglo, listo para graficar (empalma en el último mes). */
export function serieConProyeccion(
  serie: PuntoSerie[],
  proyeccion: ReturnType<typeof proyectarSerie>,
  decimales = 2,
) {
  const historico: Record<string, string | number | null>[] = serie.map((p) => ({
    periodo: p.periodo,
    mes: etiquetaCorta(p.periodo),
    real: redondear(p.valor, decimales),
  }));
  const ultimo = historico[historico.length - 1];
  if (ultimo)
    Object.assign(ultimo, {
      base: ultimo["real"],
      minimo: ultimo["real"],
      maximo: ultimo["real"],
      ...(proyeccion.ajustePct ? { escenario: ultimo["real"] } : {}),
    });
  return [
    ...historico,
    ...proyeccion.meses.map((m) => ({
      periodo: m.periodo,
      mes: m.mes,
      base: m.base,
      minimo: m.minimo,
      maximo: m.maximo,
      ...(proyeccion.ajustePct ? { escenario: m.escenario } : {}),
    })),
  ];
}
