// Herramientas de Fide (corren solo en el servidor). Las comparten el agente con Claude y el
// modo demo. Cada resultado declara su fuente: "publico" (catálogo del sitio de Fortaleza),
// "ilustrativo" (supuestos de la demo) o "mixto".
import * as z from "zod/v4";
import { graficosDisponibles, type ChartSpec } from "@/lib/charts";
import {
  APORTE_ESPERA,
  APORTE_POSESION,
  canales,
  planes,
  asesores,
  situaciones,
} from "@/lib/data/filtros";
import { nombresBarrios, normalizar } from "@/lib/data/geografia";
import { periodos } from "@/lib/data/periodos";
import {
  FUENTE_PUBLICA,
  PROYECTOS_ENTREGADOS_SEGUN_SITIO,
  PROYECTOS_EN_OBRA_SEGUN_SITIO,
  proyectos,
} from "@/lib/data/proyectos";
import { detectarAlertas } from "@/server/alertas";
import {
  distribucionOfertas,
  esperaPorCohorte,
  resumenAdjudicaciones,
  serieAdjudicaciones,
  simularAdjudicacion,
  ultimosAdjudicados,
} from "@/server/adjudicaciones";
import { construirGrafico, proyeccionCartera } from "@/server/graficos";
import {
  barriosSinPresencia,
  porDesarrolladora,
  preciosPorBarrio,
  resumenMercado,
} from "@/server/mercado";
import { estadoDeObra, mixTipologias, proyeccionCaja, resumenObra } from "@/server/obra";
import {
  altasYBajas,
  concentracion,
  fichaSocio,
  mesesAtipicos,
  PERIODO_ACTUAL,
  porBarrio,
  porPlan,
  porAsesor,
  porSituacion,
  rankingSocios,
  resumenCartera,
  serieMensualCartera,
  tramosAntiguedad,
} from "@/server/socios/consultas";
import {
  cohortesDesercion,
  desercionPor,
  evolucionMora,
  moraPorSituacion,
  moraPorTramo,
  prioridadDeContacto,
  resumenRiesgo,
} from "@/server/socios/mora";
import { evaluarTerreno, puntoDeBarrio, rankingBarrios } from "@/server/terrenos";
import { etiquetaDe } from "./etiquetas";
import { generarCronograma } from "./simulador";

const periodo = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .describe(
    `Mes AAAA-MM entre ${periodos[0]} y ${periodos[periodos.length - 1]}. Por defecto Ene–Sep 2026.`,
  );
const plan = z.enum(planes);
const asesor = z.enum(asesores);
const situacion = z
  .enum(situaciones)
  .describe(
    "Dónde está el contrato en el camino hacia su unidad. En espera: todavía no se adjudicó. " +
      "Adjudicado: ya tiene unidad asignada pero la torre no se entregó. Con posesión: recibió la " +
      `unidad y pasó a aportar Gs ${APORTE_POSESION.toLocaleString("es-PY")} al mes en lugar de ` +
      `Gs ${APORTE_ESPERA.toLocaleString("es-PY")}.`,
  );
const barrio = z.enum(nombresBarrios as [string, ...string[]]);

export type ResultadoHerramienta = { resultado: unknown; graficos?: ChartSpec[] };

type Definicion<S extends z.ZodType> = {
  name: string;
  description: string;
  inputSchema: S;
  run: (input: z.infer<S>) => ResultadoHerramienta;
};

/** La etiqueta visible sale de etiquetas.ts, que el cliente también puede importar. */
const definir = <S extends z.ZodType>(d: Definicion<S>) => ({ ...d, etiqueta: etiquetaDe(d.name) });

/** Rango con valores por defecto (Ene–Sep 2026). */
const rangoDe = (i: { desde?: string | undefined; hasta?: string | undefined }) => ({
  desde: i.desde && periodos.includes(i.desde) ? i.desde : PERIODO_ACTUAL.desde,
  hasta: i.hasta && periodos.includes(i.hasta) ? i.hasta : PERIODO_ACTUAL.hasta,
});

export const herramientas = [
  // ── Cartera ──────────────────────────────────────────────────────────────────────
  definir({
    name: "consultar_cartera",
    description:
      "ILUSTRATIVO. Aportes recaudados del Sistema de Ahorro (guaraníes → Gs MM): total, variación interanual y contra el período anterior, contratos y socios activos, altas y bajas, composición en espera / adjudicados / con posesión, mora y efectividad de cobranza. Con el desglose pedido (mes, plan, asesor, situación o barrio). Agrupar por situación es la forma de ver de dónde sale la recaudación: los contratos con posesión aportan cerca de 3× los que esperan.",
    inputSchema: z.object({
      desde: periodo.optional(),
      hasta: periodo.optional(),
      plan: plan.optional(),
      asesor: asesor.optional(),
      situacion: situacion.optional(),
      barrio: barrio.optional(),
      agrupar: z.enum(["total", "mes", "plan", "asesor", "situacion", "barrio"]),
    }),
    run: (i) => {
      const f = {
        ...rangoDe(i),
        plan: i.plan,
        asesor: i.asesor,
        situacion: i.situacion,
        barrio: i.barrio,
      };
      const desglose =
        i.agrupar === "mes"
          ? serieMensualCartera(f).map(({ etiqueta, cobradoMM, emitidoMM, anioAnteriorMM }) => ({
              mes: etiqueta,
              cobradoMM,
              emitidoMM,
              anioAnteriorMM,
            }))
          : i.agrupar === "plan"
            ? porPlan(f)
            : i.agrupar === "asesor"
              ? porAsesor(f)
              : i.agrupar === "situacion"
                ? porSituacion(f)
                : i.agrupar === "barrio"
                  ? porBarrio(f).slice(0, 15)
                  : undefined;
      return { resultado: { filtros: f, ...resumenCartera(f), desglose } };
    },
  }),
  definir({
    name: "analizar_crecimiento",
    description:
      "ILUSTRATIVO. Cómo crece la cartera: altas y bajas mes a mes, antigüedad de los socios activos, concentración de la recaudación y meses con recaudación fuera de lo habitual (z-score de la variación interanual).",
    inputSchema: z.object({
      desde: periodo.optional(),
      hasta: periodo.optional(),
      plan: plan.optional(),
    }),
    run: (i) => {
      const f = { ...rangoDe(i), plan: i.plan };
      const { puntos: _p, ...c } = concentracion(f);
      return {
        resultado: {
          fuente: "ilustrativo",
          filtros: f,
          altasYBajas: altasYBajas(f).map(({ etiqueta, altas, bajas, neto }) => ({
            mes: etiqueta,
            altas,
            bajas: Math.abs(bajas),
            neto,
          })),
          antiguedad: tramosAntiguedad(f),
          concentracion: c,
          mesesAtipicos: mesesAtipicos(),
        },
      };
    },
  }),
  definir({
    name: "buscar_socio",
    description:
      "ILUSTRATIVO. Ficha de un socio por número de contrato (formato F-100000): aportes del período, cuotas pagadas y emitidas, atraso, puntos, oferta licitatoria, posición en la cola y serie mensual. Identifica por contrato, nunca por nombre.",
    inputSchema: z.object({ contrato: z.string().min(2).max(20) }),
    run: (i) => {
      const ficha = fichaSocio(i.contrato);
      if (!ficha)
        return {
          resultado: {
            fuente: "ilustrativo",
            encontrado: false,
            mensaje:
              "Sin coincidencias. Los contratos de la cartera ilustrativa tienen el formato F-100000.",
          },
        };
      const { serie: _s, ...resto } = ficha;
      return { resultado: { encontrado: true, ...resto } };
    },
  }),
  definir({
    name: "ranking_socios",
    description:
      "ILUSTRATIVO. Socios ordenados por aportes del período, antigüedad, atraso u oferta licitatoria. Devuelve números de contrato, no nombres. Útil para ver quién encabeza la cola de licitación o quién arrastra más atraso.",
    inputSchema: z.object({
      desde: periodo.optional(),
      hasta: periodo.optional(),
      plan: plan.optional(),
      asesor: asesor.optional(),
      situacion: situacion.optional(),
      estado_pago: z
        .enum(["Al día", "En mora", "Baja"])
        .optional()
        .describe(
          "Cómo viene pagando. Es independiente de la situación: un contrato con posesión puede " +
            "estar en mora.",
        ),
      canal: z.enum(canales).optional(),
      orden: z.enum(["aportes", "antiguedad", "atraso", "oferta"]),
      limite: z.number().int().min(1).max(30).optional(),
    }),
    run: (i) => {
      const f = {
        ...rangoDe(i),
        plan: i.plan,
        asesor: i.asesor,
        situacion: i.situacion,
        estadoPago: i.estado_pago,
        canal: i.canal,
      };
      const filas = rankingSocios(f, i.orden);
      return {
        resultado: {
          fuente: "ilustrativo",
          filtros: f,
          cantidad: filas.length,
          socios: filas.slice(0, i.limite ?? 10),
        },
      };
    },
  }),
  definir({
    name: "proyectar_cartera",
    description:
      "ILUSTRATIVO (proyección). Proyecta la recaudación de los próximos 8 meses: tendencia + estacionalidad de los años completos disponibles, intervalo del 80% y backtest de los últimos 4 meses (MAPE). Escenario opcional con ajuste %.",
    inputSchema: z.object({
      plan: plan.optional(),
      ajuste_pct: z
        .number()
        .min(-50)
        .max(50)
        .optional()
        .describe("Escenario: variación % sobre la base."),
    }),
    run: (i) => {
      const { proyeccion } = proyeccionCartera(i.plan, i.ajuste_pct ?? 0);
      return {
        resultado: {
          fuente: "ilustrativo",
          ...proyeccion,
          metodo:
            "Tendencia lineal sobre la serie mensual desestacionalizada, con índices estacionales promediados sobre los años completos. Intervalo del 80% según el error del ajuste. Es una referencia, no una predicción validada.",
        },
      };
    },
  }),

  // ── Mora y deserción ─────────────────────────────────────────────────────────────
  definir({
    name: "analizar_mora",
    description:
      "ILUSTRATIVO. Mora por tramo de atraso (1–2, 3–4, 5–6 cuotas) con saldo y riesgo de caída, evolución mensual de la mora sobre lo emitido, y mora comparada por situación del contrato (quien espera su unidad frente a quien ya la recibió y paga la cuota alta). A las 7 cuotas impagas el contrato se cae.",
    inputSchema: z.object({
      desde: periodo.optional(),
      hasta: periodo.optional(),
      asesor: asesor.optional(),
      plan: plan.optional(),
      situacion: situacion.optional(),
    }),
    run: (i) => {
      const f = { ...rangoDe(i), asesor: i.asesor, plan: i.plan, situacion: i.situacion };
      return {
        resultado: {
          fuente: "ilustrativo",
          filtros: f,
          tramos: moraPorTramo(f),
          evolucion: evolucionMora(f),
          porSituacion: moraPorSituacion(f),
        },
      };
    },
  }),
  definir({
    name: "analizar_desercion",
    description:
      "ILUSTRATIVO. Deserción de la cartera: retención por cohorte de alta (a 12, 24 y 36 meses) y deserción agrupada por plan, canal de alta, asesor o situación, con la cuota mensual que se perdió y la antigüedad típica al momento de la baja. Agrupada por situación, la clave es la del contrato cuando terminó: responde si se abandona esperando la unidad o ya viviendo en ella.",
    inputSchema: z.object({
      agrupar: z.enum(["plan", "canal", "asesor", "situacion"]).optional(),
    }),
    run: (i) => ({
      resultado: {
        fuente: "ilustrativo",
        cohortes: cohortesDesercion(),
        desglose: desercionPor(i.agrupar ?? "canal"),
        nota: "Las cohortes que todavía no cumplieron el hito quedan en null en lugar de mostrar un dato parcial.",
      },
    }),
  }),
  definir({
    name: "riesgo_de_desercion",
    description:
      "ILUSTRATIVO. Scoring 0–100 de riesgo de abandono con factores explícitos (atraso, antigüedad, cumplimiento histórico, canal, plan, si ya está adjudicado). Devuelve el resumen por nivel de riesgo y los socios a contactar primero, ordenados por recaudación en juego.",
    inputSchema: z.object({
      asesor: asesor.optional(),
      situacion: situacion.optional(),
      limite: z.number().int().min(1).max(25).optional(),
    }),
    run: (i) => {
      const f = { ...PERIODO_ACTUAL, asesor: i.asesor, situacion: i.situacion };
      return {
        resultado: {
          fuente: "ilustrativo",
          resumen: resumenRiesgo(f),
          contactar: prioridadDeContacto(f, i.limite ?? 10),
          nota: "El puntaje no es un modelo entrenado: es una suma de factores explícitos, y cada uno se muestra para poder discutirlo.",
        },
      };
    },
  }),

  // ── Adjudicaciones ───────────────────────────────────────────────────────────────
  definir({
    name: "consultar_adjudicaciones",
    description:
      "ILUSTRATIVO sobre un mecanismo PÚBLICO. Actos de adjudicación mes a mes separando sorteo y licitación, oferta ganadora mínima y media, espera de los adjudicados, cola de elegibles y distribución de ofertas por percentil.",
    inputSchema: z.object({ desde: periodo.optional(), hasta: periodo.optional() }),
    run: (i) => {
      const f = rangoDe(i);
      return {
        resultado: {
          filtros: f,
          ...resumenAdjudicaciones(f),
          mensual: serieAdjudicaciones(f),
          porCohorte: esperaPorCohorte(),
          percentilesDeOferta: distribucionOfertas(),
          ultimos: ultimosAdjudicados(10),
          mecanismo:
            "Sorteo: se extrae una bolilla de cada contenedor para formar el número de contrato, así que todos los socios al día tienen la misma probabilidad. Licitación: se abren los sobres ante escribano y gana la mejor oferta, que combina pagos realizados y puntos de beneficios.",
        },
      };
    },
  }),
  definir({
    name: "simular_adjudicacion",
    description:
      "ILUSTRATIVO. Chance de adjudicación de un socio en el PRÓXIMO acto, separando sorteo (igual para todos los que están al día) y licitación (ordena por oferta). Se puede pasar un número de contrato existente o los datos a mano. No devuelve un plazo de adjudicación: la espera es probabilística.",
    inputSchema: z.object({
      contrato: z.string().max(20).optional().describe("Contrato existente, formato F-100000."),
      pagado_gs: z.number().min(0).optional().describe("Pagos acumulados en guaraníes."),
      puntos: z.number().int().min(0).max(300).optional(),
      antiguedad_meses: z.number().int().min(0).max(300).optional(),
    }),
    run: (i) => ({
      resultado: simularAdjudicacion({
        contrato: i.contrato,
        pagadoGs: i.pagado_gs,
        puntos: i.puntos,
        antiguedadMeses: i.antiguedad_meses,
      }),
    }),
  }),

  // ── Proyectos, obra y planes ─────────────────────────────────────────────────────
  definir({
    name: "consultar_proyectos",
    description: `PÚBLICO + ILUSTRATIVO. Catálogo de proyectos de Fortaleza (${FUENTE_PUBLICA}): nombre, año, estado y dirección son públicos; pisos, unidades y tipologías son supuestos. Incluye el mix por tipología.`,
    inputSchema: z.object({
      estado: z.enum(["Entregado", "En construcción"]).optional(),
      barrio: barrio.optional(),
    }),
    run: (i) => {
      const lista = proyectos.filter(
        (p) => (!i.estado || p.estado === i.estado) && (!i.barrio || p.barrio === i.barrio),
      );
      return {
        resultado: {
          fuente: "mixto",
          fuentePublica: FUENTE_PUBLICA,
          proyectos: lista.map(({ tipologias, lat: _a, lng: _b, ...p }) => ({
            ...p,
            tipologias: tipologias.filter((t) => t.unidades > 0),
          })),
          mixTipologias: mixTipologias(),
          nota: `El sitio informa ${PROYECTOS_ENTREGADOS_SEGUN_SITIO} proyectos entregados y ${PROYECTOS_EN_OBRA_SEGUN_SITIO} en construcción, pero nombra menos: este catálogo cubre los nombrados.`,
        },
      };
    },
  }),
  definir({
    name: "analizar_obra",
    description:
      "PÚBLICO + ILUSTRATIVO. Avance de obra contra cronograma de los proyectos en construcción, y calce financiero: aportes asignados contra costo de lo ya ejecutado. Incluye una proyección de caja de obra de los próximos meses.",
    inputSchema: z.object({ meses_proyeccion: z.number().int().min(3).max(24).optional() }),
    run: (i) => ({
      resultado: {
        ...resumenObra(),
        obras: estadoDeObra(),
        caja: proyeccionCaja(i.meses_proyeccion ?? 12),
        nota: "Los proyectos y sus años de entrega son públicos; el avance, los costos y la asignación de aportes son supuestos de la demo.",
      },
    }),
  }),
  definir({
    name: "simular_plan",
    description:
      "Cronograma de aportes de un plan: cuotas antes de la adjudicación sin interés, saldo financiado después con sistema francés, refuerzos opcionales y capitalización del interés del tramo de obra. Devuelve la cuota de cada tramo, totales e intereses. Es la misma lógica que el cuotero que ya usa el equipo.",
    inputSchema: z.object({
      valor: z.number().min(1_000_000).describe("Valor de la unidad en guaraníes."),
      cuotas_totales: z.number().int().min(2).max(240),
      cuotas_pre: z.number().int().min(0).max(240).describe("Cuotas antes de la adjudicación."),
      tasa_mensual: z
        .number()
        .min(0)
        .max(0.05)
        .optional()
        .describe("Tasa del tramo financiado (0.009 = 0,9% mensual)."),
      inicio: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      refuerzos: z
        .array(z.object({ periodo: z.number().int().min(1), monto: z.number().min(0) }))
        .max(12)
        .optional(),
    }),
    run: (i) => {
      const cuotasPre = Math.min(i.cuotas_pre, i.cuotas_totales);
      const { filas, resumen } = generarCronograma({
        valor: i.valor,
        cuotasPre,
        cuotasTotales: i.cuotas_totales,
        tasa: i.tasa_mensual ?? 0.009,
        inicio: i.inicio ?? `${periodos[periodos.length - 1]}-10`,
        refuerzos: i.refuerzos ?? [],
      });
      return {
        resultado: {
          fuente: "ilustrativo",
          resumen,
          // El cronograma completo puede tener 240 filas: se devuelven las primeras y las últimas.
          primeras: filas.slice(0, 6),
          ultimas: filas.slice(-6),
          nota: "El tramo pre-adjudicación no tiene interés; el interés que se deja de cobrar durante la obra se capitaliza y se financia después, igual que en el cuotero original.",
        },
      };
    },
  }),

  // ── Mercado y terrenos ───────────────────────────────────────────────────────────
  definir({
    name: "consultar_mercado",
    description:
      "ILUSTRATIVO. Mercado de departamentos de Asunción: precio de m² por barrio, edificios de la competencia por desarrolladora, absorción y barrios donde la competencia construye y Fortaleza no tiene proyectos. Desarrolladoras y precios inventados para la demo.",
    inputSchema: z.object({ barrio: barrio.optional() }),
    run: (i) => ({
      resultado: {
        ...resumenMercado(),
        precios: i.barrio
          ? preciosPorBarrio.filter((p) => p.barrio === i.barrio)
          : [...preciosPorBarrio].sort((a, b) => b.precioM2Usd - a.precioM2Usd),
        competencia: porDesarrolladora(i.barrio),
        barriosSinPresencia: barriosSinPresencia(),
      },
    }),
  }),
  definir({
    name: "evaluar_terreno",
    description:
      "ILUSTRATIVO. Puntaje 0–100 para un terreno en Asunción con factores explícitos: demanda del entorno, precio de m² de la zona, cercanía a avenida, competencia a 1 km y canibalización con proyectos propios. Se indica un barrio o coordenadas. Incluye el ranking de barrios candidatos.",
    inputSchema: z.object({
      barrio: z.string().optional().describe("Nombre de barrio de Asunción."),
      lat: z.number().min(-25.45).max(-25.2).optional(),
      lng: z.number().min(-57.72).max(-57.45).optional(),
    }),
    run: (i) => {
      const punto =
        i.lat !== undefined && i.lng !== undefined
          ? { lat: i.lat, lng: i.lng }
          : i.barrio
            ? puntoDeBarrio(i.barrio)
            : undefined;
      if (!punto)
        return {
          resultado: {
            error: `Barrio no encontrado. Barrios disponibles: ${nombresBarrios.join(", ")}.`,
          },
        };
      return {
        resultado: {
          ...evaluarTerreno(punto),
          rankingBarrios: rankingBarrios().slice(0, 8),
        },
      };
    },
  }),

  // ── Transversales ────────────────────────────────────────────────────────────────
  definir({
    name: "detectar_alertas",
    description:
      "Alertas priorizadas sobre los datos: mora grave, riesgo de deserción, retención por cohorte, obra atrasada, calce financiero, cola de adjudicación y mercado. Todas se calculan, ninguna está escrita a mano.",
    inputSchema: z.object({}),
    run: () => ({ resultado: { alertas: detectarAlertas().map(({ enlace: _e, ...a }) => a) } }),
  }),
  definir({
    name: "crear_grafico",
    description:
      "Muestra al usuario un gráfico del catálogo. Los valores los calcula el sistema: solo se elige el gráfico y sus filtros. Usar cuando un gráfico ayude o el usuario lo pida (máximo 3 por respuesta).",
    inputSchema: z.object({
      grafico: z.enum(graficosDisponibles),
      plan: plan.optional(),
      asesor: asesor.optional(),
      barrio: barrio.optional(),
      desde: periodo.optional(),
      hasta: periodo.optional(),
      ajuste_pct: z.number().min(-50).max(50).optional(),
      limite: z.number().int().min(3).max(20).optional(),
      titulo: z.string().max(90).optional(),
    }),
    run: (i) => {
      const g = construirGrafico(i);
      return {
        resultado: {
          mostrado: true,
          titulo: g.titulo,
          fuente: g.fuente,
          unidad: g.unidad,
          puntos: g.datos.length,
        },
        graficos: [g],
      };
    },
  }),
];

export type Herramienta = (typeof herramientas)[number];

export function buscarHerramienta(nombre: string) {
  return herramientas.find((h) => h.name === nombre);
}

/** Ejecuta una herramienta validando la entrada con su esquema. */
export function ejecutarHerramienta(nombre: string, input: unknown): ResultadoHerramienta {
  const h = buscarHerramienta(nombre);
  if (!h) throw new Error(`Herramienta desconocida: ${nombre}`);
  const parsed = h.inputSchema.parse(input) as never;
  return (h.run as (i: never) => ResultadoHerramienta)(parsed);
}

/** Busca un barrio por nombre aproximado ("manora" → "Manorá"). */
export const resolverBarrio = (texto?: string) => {
  if (!texto) return undefined;
  const q = normalizar(texto);
  return nombresBarrios.find((b) => normalizar(b).includes(q));
};
