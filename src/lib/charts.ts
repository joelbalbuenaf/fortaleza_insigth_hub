// Tipos y catálogo de gráficos (sin datos: el armado vive en src/server/graficos.ts).
// Fide solo elige el gráfico y sus filtros; los valores siempre los calcula el servidor.

export type TipoGrafico = "linea" | "barras" | "area" | "torta" | "dispersion";

/**
 * - "publico": hecho publicado por Fortaleza (nombre, año y estado de los proyectos).
 * - "ilustrativo": supuesto de la demo.
 * - "mixto": estructura pública con valores supuestos (p. ej. unidades por proyecto).
 * - "real": reservado para cuando se cargue la cartera real.
 */
export type Fuente = "real" | "publico" | "ilustrativo" | "mixto";

export type ChartSpec = {
  id: string;
  titulo: string;
  tipo: TipoGrafico;
  unidad: string;
  fuente: Fuente;
  /** Clave del eje X (o de la categoría en torta). */
  x: string;
  series: { clave: string; nombre: string; estilo?: "punteada" | "banda" }[];
  datos: Record<string, string | number | null | undefined>[];
  apilado?: boolean;
  nota?: string;
  /** Pregunta sugerida para profundizar con Fide. */
  pregunta?: string;
};

export const graficosDisponibles = [
  // ── Cartera ────────────────────────────────────────────────────────────────────────
  "cartera_mensual",
  "cartera_por_plan",
  "cartera_por_asesor",
  "composicion_cartera",
  "cartera_por_barrio",
  "altas_bajas",
  "ticket_por_plan",
  "antiguedad_socios",
  "concentracion_cartera",
  "forecast_cartera",
  // ── Mora y deserción ───────────────────────────────────────────────────────────────
  "mora_tramos",
  "mora_evolucion",
  "desercion_cohortes",
  // ── Adjudicaciones ─────────────────────────────────────────────────────────────────
  "adjudicaciones_mensuales",
  "espera_adjudicacion",
  "oferta_licitatoria",
  // ── Proyectos y obra ───────────────────────────────────────────────────────────────
  "unidades_por_proyecto",
  "avance_obra",
  "calce_obra",
  "mix_tipologias",
  // ── Mercado ────────────────────────────────────────────────────────────────────────
  "precio_m2_barrio",
  "competencia_barrio",
  "absorcion",
] as const;
export type GraficoId = (typeof graficosDisponibles)[number];

export const descripcionGraficos: Record<GraficoId, string> = {
  cartera_mensual:
    "Línea mensual de aportes recaudados (Gs MM) con el año anterior. Filtros: desde, hasta, plan, asesor, barrio.",
  cartera_por_plan: "Barras de aportes recaudados por plan (Amplia, Plan 20, adicionales).",
  cartera_por_asesor:
    "Barras de aportes recaudados por asesor comercial. Filtros: desde, hasta, limite.",
  composicion_cartera:
    "Barras de la recaudación por situación del contrato (en espera, adjudicado, con posesión). Un contrato con posesión aporta cerca de 3× uno en espera, así que muestra de dónde sale realmente la plata.",
  cartera_por_barrio:
    "Barras de aportes recaudados por barrio de domicilio del socio. Filtros: desde, hasta, limite.",
  altas_bajas: "Barras mensuales de altas y bajas de contratos: crecimiento neto de la cartera.",
  ticket_por_plan: "Barras del aporte mensual promedio por plan (Gs).",
  antiguedad_socios: "Barras de contratos activos por tramo de antigüedad en años.",
  concentracion_cartera:
    "Curva de concentración: % de la recaudación acumulada según % de contratos ordenados por aporte.",
  forecast_cartera:
    "Recaudación histórica + proyección de los próximos 8 meses con intervalo del 80%. Filtros: plan, ajuste_pct.",
  mora_tramos: "Barras de saldo en mora por tramo de atraso (1–3, 4–6, 7–12, 13+ meses).",
  mora_evolucion: "Línea mensual de la mora como % de lo emitido.",
  desercion_cohortes:
    "Supervivencia por cohorte de alta: % de contratos que siguen activos a los 12, 24 y 36 meses.",
  adjudicaciones_mensuales:
    "Barras apiladas de unidades adjudicadas por mes, separando sorteo y licitación.",
  espera_adjudicacion:
    "Barras de la espera promedio hasta la adjudicación (meses) por año de alta.",
  oferta_licitatoria:
    "Línea de la oferta licitatoria mínima ganadora por mes (% del valor de la unidad).",
  unidades_por_proyecto:
    "Barras de unidades por proyecto. Estructura pública (nombres y estado); las unidades son un supuesto.",
  avance_obra: "Barras de avance de obra real vs. cronograma (%) en los proyectos en construcción.",
  calce_obra:
    "Barras de aportes asignados vs. costo estimado por proyecto en construcción (Gs MM).",
  mix_tipologias: "Torta del mix de unidades por tipología (monoambiente a 3 dormitorios).",
  precio_m2_barrio: "Barras del precio de m² por barrio de Asunción (USD/m²).",
  competencia_barrio: "Barras de edificios de la competencia por barrio.",
  absorcion: "Línea de absorción mensual del mercado: unidades vendidas por los desarrolladores.",
};

export type ParametrosGrafico = {
  grafico: GraficoId;
  plan?: "Amplia" | "Plan 20" | "Adicional" | undefined;
  asesor?: string | undefined;
  situacion?: "En espera" | "Adjudicado" | "Con posesión" | undefined;
  barrio?: string | undefined;
  proyecto?: string | undefined;
  desde?: string | undefined;
  hasta?: string | undefined;
  orden?: "monto" | "socios" | "mora" | undefined;
  ajuste_pct?: number | undefined;
  limite?: number | undefined;
  titulo?: string | undefined;
};
