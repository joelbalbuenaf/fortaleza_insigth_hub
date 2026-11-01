// Construye los gráficos del catálogo desde los datos (solo servidor). Fide y las pantallas solo
// eligen el gráfico y sus filtros: los valores salen siempre de acá.
import type { ChartSpec, ParametrosGrafico } from "@/lib/charts";
import { nombrePlan, type Plan, type Asesor } from "@/lib/data/filtros";
import { normalizarFiltros } from "@/lib/data/filtros";
import { proyectarSerie, serieConProyeccion } from "@/lib/data/forecast";
import { etiquetaRango, PRIMER_PERIODO, ULTIMO_PERIODO } from "@/lib/data/periodos";
import { serieAdjudicaciones, esperaPorCohorte } from "./adjudicaciones";
import { estadoDeObra, mixTipologias, unidadesPorProyecto } from "./obra";
import { porDesarrolladora, preciosPorBarrio, serieAbsorcion } from "./mercado";
import { cohortesDesercion, evolucionMora, moraPorTramo } from "./socios/mora";
import {
  altasYBajas,
  concentracion,
  porBarrio,
  porPlan,
  porAsesor,
  porSituacion,
  serieMensualCartera,
  tramosAntiguedad,
  type FiltroCartera,
} from "./socios/consultas";

const NOTA_ILUSTRATIVA = "Ilustrativo: supuestos de la demo, no datos reales.";
const NOTA_PUBLICA =
  "Estructura pública (proyectos, años y estado del sitio de Fortaleza); las cantidades son supuestos.";

let contador = 0;
const nuevoId = (g: string) => `${g}-${(contador++).toString(36)}`;

/** Proyección de la recaudación a partir de la serie mensual completa. */
export function proyeccionCartera(plan?: Plan, ajustePct = 0) {
  const serie = serieMensualCartera({
    desde: PRIMER_PERIODO,
    hasta: ULTIMO_PERIODO,
    plan,
  }).map((m) => ({ periodo: m.periodo, valor: m.cobradoMM }));
  return { serie, proyeccion: proyectarSerie(serie, { horizonte: 8, ajustePct, decimales: 0 }) };
}

export function construirGrafico(p: ParametrosGrafico): ChartSpec {
  const base = normalizarFiltros({
    desde: p.desde,
    hasta: p.hasta,
    plan: p.plan,
    asesor: p.asesor as Asesor | undefined,
    barrio: p.barrio,
  });
  const f: FiltroCartera = base;
  const rangoTxt = etiquetaRango(f.desde, f.hasta);
  const sufijo = `${f.plan ? ` · ${nombrePlan[f.plan]}` : ""}${f.asesor ? ` · ${f.asesor}` : ""}${f.barrio ? ` · ${f.barrio}` : ""} · ${rangoTxt}`;
  const titulo = (t: string) => p.titulo || t;

  const ilustrativo = (spec: Omit<ChartSpec, "id" | "fuente">): ChartSpec => ({
    id: nuevoId(p.grafico),
    fuente: "ilustrativo",
    nota: NOTA_ILUSTRATIVA,
    ...spec,
  });
  const mixto = (spec: Omit<ChartSpec, "id" | "fuente">): ChartSpec => ({
    id: nuevoId(p.grafico),
    fuente: "mixto",
    nota: NOTA_PUBLICA,
    ...spec,
  });

  switch (p.grafico) {
    // ── Cartera ──────────────────────────────────────────────────────────────────────
    case "cartera_mensual":
      return ilustrativo({
        titulo: titulo(`Aportes recaudados${sufijo}`),
        tipo: "linea",
        unidad: "Gs MM",
        x: "mes",
        datos: serieMensualCartera(f),
        series: [
          { clave: "cobradoMM", nombre: "Cobrado" },
          { clave: "emitidoMM", nombre: "Emitido", estilo: "punteada" },
          { clave: "anioAnteriorMM", nombre: "Año anterior", estilo: "punteada" },
        ],
        pregunta: "¿Cómo viene la recaudación y qué explica la variación?",
      });
    case "cartera_por_plan":
      return ilustrativo({
        titulo: titulo(`Recaudación por plan · ${rangoTxt}`),
        tipo: "barras",
        unidad: "Gs MM",
        x: "nombre",
        datos: porPlan(f),
        series: [{ clave: "cobradoMM", nombre: "Cobrado" }],
        pregunta: "¿Cómo se reparte la cartera entre los planes?",
      });
    case "cartera_por_asesor":
      return ilustrativo({
        titulo: titulo(`Recaudación por asesor · ${rangoTxt}`),
        tipo: "barras",
        unidad: "Gs MM",
        x: "nombre",
        datos: porAsesor(f).slice(0, p.limite ?? 12),
        series: [{ clave: "cobradoMM", nombre: "Cobrado" }],
        pregunta: "Compará los asesores por recaudación, altas y mora.",
      });
    case "composicion_cartera":
      return ilustrativo({
        titulo: titulo(`Recaudación por situación del contrato · ${rangoTxt}`),
        tipo: "barras",
        unidad: "Gs MM",
        x: "nombre",
        datos: porSituacion(f),
        series: [{ clave: "cobradoMM", nombre: "Cobrado" }],
        nota: `Un contrato con posesión aporta cerca de 3× uno en espera, así que un grupo chico puede explicar una porción grande de la recaudación. ${NOTA_ILUSTRATIVA}`,
        pregunta:
          "¿De qué se compone la recaudación entre los que esperan y los que ya tienen su unidad?",
      });
    case "cartera_por_barrio":
      return ilustrativo({
        titulo: titulo(`Recaudación por barrio del socio · ${rangoTxt}`),
        tipo: "barras",
        unidad: "Gs MM",
        x: "nombre",
        datos: porBarrio(f).slice(0, p.limite ?? 12),
        series: [{ clave: "cobradoMM", nombre: "Cobrado" }],
        pregunta: "¿De qué barrios vienen los socios?",
      });
    case "altas_bajas":
      return ilustrativo({
        titulo: titulo(`Altas y bajas de contratos${sufijo}`),
        tipo: "barras",
        unidad: "socios",
        x: "mes",
        datos: altasYBajas(f),
        series: [
          { clave: "altas", nombre: "Altas" },
          { clave: "bajas", nombre: "Bajas" },
        ],
        nota: `Las bajas se grafican en negativo para leer el crecimiento neto. ${NOTA_ILUSTRATIVA}`,
        pregunta: "¿Cómo viene el crecimiento neto de la cartera?",
      });
    case "ticket_por_plan":
      return ilustrativo({
        titulo: titulo("Cuota mensual promedio por plan"),
        tipo: "barras",
        unidad: "Gs",
        x: "nombre",
        datos: porPlan(f).map((x) => ({
          ...x,
          cuotaGs: x.contratos ? Math.round((x.cobradoMM * 1_000_000) / x.contratos / 9) : 0,
        })),
        series: [{ clave: "cuotaGs", nombre: "Cuota promedio" }],
        pregunta: "¿Cuál es el ticket promedio de cada plan?",
      });
    case "antiguedad_socios":
      return ilustrativo({
        titulo: titulo("Contratos activos por antigüedad"),
        tipo: "barras",
        unidad: "contratos",
        x: "nombre",
        datos: tramosAntiguedad(f),
        series: [{ clave: "contratos", nombre: "Contratos" }],
        pregunta: "¿Cómo se distribuye la antigüedad de la cartera?",
      });
    case "concentracion_cartera": {
      const c = concentracion(f);
      return ilustrativo({
        titulo: titulo(`Concentración de la recaudación · ${rangoTxt}`),
        tipo: "area",
        unidad: "% del monto",
        x: "contratosPct",
        datos: c.puntos,
        series: [{ clave: "montoPct", nombre: "% del monto acumulado" }],
        nota: `${c.n80} de ${c.contratos} contratos aportan el 80% de la recaudación; los 100 primeros, el ${c.top100Pct}%. ${NOTA_ILUSTRATIVA}`,
        pregunta: "¿Qué tan concentrada está la recaudación?",
      });
    }
    case "forecast_cartera": {
      const ajuste = p.ajuste_pct ?? 0;
      const { serie, proyeccion } = proyeccionCartera(f.plan, ajuste);
      return ilustrativo({
        titulo: titulo(
          `Proyección de recaudación${f.plan ? ` · ${nombrePlan[f.plan]}` : ""}${ajuste ? ` · escenario ${ajuste > 0 ? "+" : ""}${ajuste}%` : ""}`,
        ),
        tipo: "linea",
        unidad: "Gs MM",
        x: "mes",
        datos: serieConProyeccion(serie, proyeccion, 0),
        series: [
          { clave: "real", nombre: "Recaudado" },
          { clave: "base", nombre: "Proyección", estilo: "punteada" },
          { clave: "minimo", nombre: "Mínimo (80%)", estilo: "banda" },
          { clave: "maximo", nombre: "Máximo (80%)", estilo: "banda" },
          ...(ajuste
            ? [{ clave: "escenario", nombre: `Escenario ${ajuste}%`, estilo: "punteada" as const }]
            : []),
        ],
        nota: `Tendencia + estacionalidad de ${proyeccion.aniosEstacionalidad} años completos; backtest de los últimos 4 meses con error medio ${proyeccion.mapePct}%. Es una referencia, no una predicción validada. ${NOTA_ILUSTRATIVA}`,
        pregunta: "Proyectá la recaudación y explicá las limitaciones del modelo.",
      });
    }

    // ── Mora y deserción ─────────────────────────────────────────────────────────────
    case "mora_tramos":
      return ilustrativo({
        titulo: titulo("Saldo en mora por tramo de atraso"),
        tipo: "barras",
        unidad: "Gs MM",
        x: "nombre",
        datos: moraPorTramo(f),
        series: [{ clave: "saldoMM", nombre: "Saldo en mora" }],
        nota: `A las 7 cuotas impagas el contrato se cae. ${NOTA_ILUSTRATIVA}`,
        pregunta: "¿Cómo está repartida la mora por tramo de atraso?",
      });
    case "mora_evolucion":
      return ilustrativo({
        titulo: titulo(`Mora sobre lo emitido${sufijo}`),
        tipo: "linea",
        unidad: "%",
        x: "mes",
        datos: evolucionMora(f),
        series: [{ clave: "pctFacturacion", nombre: "Mora / emitido del mes" }],
        pregunta: "¿La mora viene subiendo o bajando?",
      });
    case "desercion_cohortes":
      return ilustrativo({
        titulo: titulo("Retención por cohorte de alta"),
        tipo: "barras",
        unidad: "% activos",
        x: "cohorte",
        datos: cohortesDesercion(),
        series: [
          { clave: "vivos12", nombre: "A los 12 meses" },
          { clave: "vivos24", nombre: "A los 24 meses" },
          { clave: "vivos36", nombre: "A los 36 meses" },
        ],
        nota: `Las cohortes que todavía no cumplieron el hito quedan vacías en lugar de mostrar un dato parcial. ${NOTA_ILUSTRATIVA}`,
        pregunta: "¿Cómo viene la retención por cohorte de alta?",
      });

    // ── Adjudicaciones ───────────────────────────────────────────────────────────────
    case "adjudicaciones_mensuales":
      return ilustrativo({
        titulo: titulo(`Unidades adjudicadas por mes · ${rangoTxt}`),
        tipo: "barras",
        apilado: true,
        unidad: "unidades",
        x: "mes",
        datos: serieAdjudicaciones(f),
        series: [
          { clave: "sorteo", nombre: "Sorteo" },
          { clave: "licitacion", nombre: "Licitación" },
        ],
        pregunta: "¿Cómo vienen los actos de adjudicación mes a mes?",
      });
    case "espera_adjudicacion":
      return ilustrativo({
        titulo: titulo("Espera media hasta la adjudicación, por año de alta"),
        tipo: "barras",
        unidad: "meses",
        x: "cohorte",
        datos: esperaPorCohorte(),
        series: [{ clave: "esperaMediaMeses", nombre: "Espera media" }],
        nota: `Las cohortes recientes tuvieron menos tiempo de ser adjudicadas, así que su espera media está subestimada. La adjudicación es por sorteo y licitación: no hay un plazo prometido. ${NOTA_ILUSTRATIVA}`,
        pregunta: "¿Cuánto esperan los socios hasta adjudicarse?",
      });
    case "oferta_licitatoria":
      return ilustrativo({
        titulo: titulo(`Oferta ganadora en licitación · ${rangoTxt}`),
        tipo: "linea",
        unidad: "Gs MM",
        x: "mes",
        datos: serieAdjudicaciones(f),
        series: [
          { clave: "ofertaGanadoraMinimaMM", nombre: "Mínima ganadora (corte)" },
          { clave: "ofertaGanadoraMediaMM", nombre: "Media ganadora", estilo: "punteada" },
        ],
        nota: `La oferta combina pagos realizados y puntos de beneficios. ${NOTA_ILUSTRATIVA}`,
        pregunta: "¿Qué oferta hace falta para ganar una licitación?",
      });

    // ── Proyectos y obra ─────────────────────────────────────────────────────────────
    case "unidades_por_proyecto":
      return mixto({
        titulo: titulo("Unidades por proyecto"),
        tipo: "barras",
        unidad: "unidades",
        x: "nombre",
        datos: unidadesPorProyecto(),
        series: [{ clave: "unidades", nombre: "Unidades" }],
        pregunta: "¿Cómo viene el catálogo de proyectos de Fortaleza?",
      });
    case "avance_obra":
      return mixto({
        titulo: titulo("Avance de obra vs. cronograma"),
        tipo: "barras",
        unidad: "%",
        x: "corto",
        datos: estadoDeObra(),
        series: [
          { clave: "avancePct", nombre: "Avance real" },
          { clave: "avancePlanPct", nombre: "Cronograma" },
        ],
        nota: `Los proyectos y sus años de entrega son públicos; el avance es un supuesto de la demo.`,
        pregunta: "¿Qué obras están atrasadas frente al cronograma?",
      });
    case "calce_obra":
      return ilustrativo({
        titulo: titulo("Aportes asignados vs. obra ejecutada"),
        tipo: "barras",
        unidad: "Gs MM",
        x: "corto",
        datos: estadoDeObra(),
        series: [
          { clave: "asignadoMM", nombre: "Aportes asignados" },
          { clave: "ejecutadoMM", nombre: "Obra ejecutada" },
        ],
        nota: `Si la obra ejecutada supera los aportes asignados, la construcción va por delante del fondeo. ${NOTA_ILUSTRATIVA}`,
        pregunta: "¿Los aportes alcanzan para el cronograma de obra comprometido?",
      });
    case "mix_tipologias":
      return mixto({
        titulo: titulo("Mix de unidades por tipología"),
        tipo: "torta",
        unidad: "unidades",
        x: "nombre",
        datos: mixTipologias(),
        series: [{ clave: "unidades", nombre: "Unidades" }],
        pregunta: "¿Qué tipologías predominan en el catálogo?",
      });

    // ── Mercado ──────────────────────────────────────────────────────────────────────
    case "precio_m2_barrio":
      return ilustrativo({
        titulo: titulo("Precio de m² por barrio"),
        tipo: "barras",
        unidad: "USD/m²",
        x: "barrio",
        datos: [...preciosPorBarrio]
          .sort((a, b) => b.precioM2Usd - a.precioM2Usd)
          .slice(0, p.limite ?? 14),
        series: [{ clave: "precioM2Usd", nombre: "Precio de m²" }],
        pregunta: "¿Cómo están los precios de m² por barrio?",
      });
    case "competencia_barrio":
      return ilustrativo({
        titulo: titulo(`Edificios de la competencia${f.barrio ? ` · ${f.barrio}` : ""}`),
        tipo: "barras",
        unidad: "edificios",
        x: "nombre",
        datos: porDesarrolladora(f.barrio),
        series: [{ clave: "edificios", nombre: "Edificios" }],
        nota: `Desarrolladoras y edificios inventados para la demo. ${NOTA_ILUSTRATIVA}`,
        pregunta: "¿Dónde construye la competencia y dónde no estamos?",
      });
    case "absorcion":
      return ilustrativo({
        titulo: titulo(`Absorción del mercado · ${rangoTxt}`),
        tipo: "area",
        unidad: "unidades",
        x: "mes",
        datos: serieAbsorcion(f.desde, f.hasta),
        series: [{ clave: "unidades", nombre: "Unidades vendidas" }],
        pregunta: "¿Cómo viene la absorción del mercado de departamentos?",
      });
  }
}
