/* eslint-disable @typescript-eslint/no-explicit-any -- las plantillas leen resultados JSON de
   herramientas heterogéneas; tiparlos uno a uno no aporta en un modo demo. */
// Modo demo de Fide (sin API key): interpreta la pregunta con reglas simples y responde con las
// mismas herramientas que usa el agente con Claude. No es IA: está pensado para mostrar el Hub
// sin costo ni conexión, y lo dice explícitamente. Corre solo en el servidor.
import type { ParametrosGrafico } from "@/lib/charts";
import { oportunidades } from "@/lib/analytical-questions";
import {
  nombrePlan,
  planes,
  asesores,
  situaciones,
  type Plan,
  type Asesor,
  type Situacion,
} from "@/lib/data/filtros";
import { nombresBarrios, normalizar } from "@/lib/data/geografia";
import { presetsPeriodo, PRIMER_PERIODO, ULTIMO_PERIODO } from "@/lib/data/periodos";
import { ejecutarHerramienta } from "./tools";
import type { EscritorFide } from "./writer";

const fmt = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined ? "—" : n.toLocaleString("es-PY", { maximumFractionDigits: d });
const signo = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${n > 0 ? "+" : ""}${fmt(n)}%`;
const gs = (n: number | null | undefined) => `Gs ${fmt(n, 0)} MM`;

const ILUSTRATIVO = "*Ilustrativo: supuestos de la demo, no datos reales.*";
const MIXTO =
  "*Estructura pública (proyectos del sitio de Fortaleza); las cantidades y el avance son supuestos.*";

function tabla(columnas: string[], filas: (string | number)[][]) {
  return [
    `| ${columnas.join(" | ")} |`,
    `| ${columnas.map(() => "---").join(" | ")} |`,
    ...filas.map((f) => `| ${f.join(" | ")} |`),
  ].join("\n");
}

type Contexto = {
  texto: string;
  desde: string;
  hasta: string;
  etiquetaPeriodo: string;
  plan: Plan | undefined;
  asesor: Asesor | undefined;
  situacion: Situacion | undefined;
  barrio: string | undefined;
  contrato: string | null;
  ajuste: number | null;
};

function leerContexto(pregunta: string): Contexto {
  const texto = normalizar(pregunta);
  const preset =
    /\b2022\b/.test(texto) && !/202[3-6]/.test(texto)
      ? presetsPeriodo.find((p) => p.id === "todo")
      : /\b2024\b/.test(texto) && !/202[56]/.test(texto)
        ? presetsPeriodo.find((p) => p.id === "a2024")
        : /\b2025\b/.test(texto) && !/2026/.test(texto)
          ? presetsPeriodo.find((p) => p.id === "a2025")
          : /12 meses|ultimo ano|ultimo año/.test(texto)
            ? presetsPeriodo.find((p) => p.id === "u12")
            : presetsPeriodo.find((p) => p.id === "ytd");
  const ajuste = texto.match(/([+-]?\d{1,2})\s*%/);
  return {
    texto,
    desde: preset?.desde ?? "2026-01",
    hasta: preset?.hasta ?? ULTIMO_PERIODO,
    etiquetaPeriodo: preset?.label ?? "Ene–Sep 2026",
    plan: planes.find(
      (p) => texto.includes(normalizar(p)) || texto.includes(normalizar(nombrePlan[p])),
    ),
    asesor: asesores.find((s) => texto.includes(normalizar(s))),
    situacion: situaciones.find((x) => texto.includes(normalizar(x))),
    barrio: nombresBarrios.find((b) => texto.includes(normalizar(b))),
    contrato: pregunta.match(/\bF-?\s?1\d{5}\b/i)?.[0]?.replace(/\s/g, "") ?? null,
    ajuste: ajuste
      ? Number(ajuste[1]) *
        (/menor|caida|baja|menos/.test(texto) && !ajuste[1]?.startsWith("-") ? -1 : 1)
      : null,
  };
}

type Paso = { herramienta: string; input: Record<string, unknown> };
type Plan2 = {
  pasos: Paso[];
  componer: (r: Record<string, any>) => string;
  sugerencias: string[];
};

const grafico = (p: ParametrosGrafico): Paso => ({
  herramienta: "crear_grafico",
  input: p as Record<string, unknown>,
});
const cartera = (c: Contexto, agrupar: string, extra: Record<string, unknown> = {}): Paso => ({
  herramienta: "consultar_cartera",
  input: {
    desde: c.desde,
    hasta: c.hasta,
    plan: c.plan,
    asesor: c.asesor,
    situacion: c.situacion,
    barrio: c.barrio,
    agrupar,
    ...extra,
  },
});

type Intencion = { test: (c: Contexto) => boolean; plan: (c: Contexto) => Plan2 };
const re = (r: RegExp) => (c: Contexto) => r.test(c.texto);

const intenciones: Intencion[] = [
  {
    test: re(/^(hola|buenas|buen dia)\b|quien (sos|eres)|que (podes|puedes|sabes) hacer|ayuda/),
    plan: () => ({
      pasos: [],
      sugerencias: [
        "¿Cómo viene la recaudación de 2026 frente a 2025?",
        "¿Cómo está repartida la mora por tramo de atraso?",
        "¿Qué alertas atenderías primero?",
      ],
      componer: () =>
        "¡Hola! Soy **Fide**, el agente analítico del Hub de Fortaleza Inmuebles.\n\nPuedo analizar la **cartera del Sistema de Ahorro**: recaudación y crecimiento, mora por tramo de atraso, deserción por cohorte y canal, riesgo de abandono socio por socio, adjudicaciones por sorteo y licitación, avance y calce financiero de las obras, el mercado de Asunción y el simulador de planes.\n\nDos cosas antes de empezar: la **cartera de este Hub es ilustrativa** —socios, aportes, mora y obra son supuestos generados para la demo; lo único público es el catálogo de proyectos—, y ahora estoy en **modo demo**, así que entiendo preguntas con reglas simples. Con una API key de Claude puedo razonar libremente y recordar la conversación.",
    }),
  },
  {
    test: re(/no se pued|que analisis|datos (faltan|necesit|reales)|cartera real|con datos reales/),
    plan: () => ({
      pasos: [],
      sugerencias: [
        "¿Qué alertas atenderías primero?",
        "¿Cómo viene el catálogo de proyectos de Fortaleza?",
        "Prepará un resumen ejecutivo con tres oportunidades, evidencia y próximos pasos.",
      ],
      componer: () =>
        "Hoy el Hub trabaja con una **cartera ilustrativa**: socios, aportes, mora, deserción, adjudicaciones, obra y mercado son supuestos generados para la demo. Lo único público es el catálogo de proyectos (nombres, años y estado, del sitio de Fortaleza).\n\nCon la **cartera real** se podrían hacer cosas que hoy no:\n\n- **Cobranza dirigida**: priorizar contactos por recaudación en juego de verdad, no sobre un scoring de ejemplo.\n- **Retención por cohorte real**: medir si una campaña de alta sirvió, mirando la deserción a los 12 meses de esa cohorte.\n- **Calce de obra**: cruzar los aportes efectivamente asignados contra los certificados de obra, en lugar de un reparto proporcional al costo.\n- **Adjudicaciones**: estimar la espera con las actas reales de sorteo y licitación, y las ofertas ganadoras históricas.\n- **Rentabilidad por plan y por asesor**, que hoy no se puede calcular porque no hay costos cargados.\n\nQué haría falta: el padrón de contratos con sus aportes mes a mes, las actas de adjudicación, los certificados de avance de obra y los costos por proyecto. Las mismas pantallas y herramientas funcionarían sin cambios.",
    }),
  },
  {
    test: (c) => Boolean(c.contrato),
    plan: (c) => ({
      pasos: [{ herramienta: "buscar_socio", input: { contrato: c.contrato } }],
      sugerencias: [
        "¿Qué oferta hace falta para ganar una licitación?",
        "¿Cómo está repartida la mora por tramo de atraso?",
        "Simulá la chance de adjudicación de un socio con 4 años de antigüedad.",
      ],
      componer: (r) => {
        const s = r["buscar_socio"];
        if (!s.encontrado) return s.mensaje;
        return `El contrato **${s.contrato}** (${nombrePlan[s.plan as Plan]}, asesor ${s.asesor}) lleva **${s.antiguedadMeses} meses** de antigüedad y aportó ${gs(s.aportadoMM)} en ${c.etiquetaPeriodo}.\n\n${tabla(
          ["Dato", "Valor"],
          [
            ["Estado", s.estado],
            ["Cuota vigente", `Gs ${fmt(s.cuotaGs, 0)}`],
            ["Cuotas pagadas", `${s.cuotasPagadas} de ${s.cuotasEmitidas} emitidas`],
            ["Atraso", `${s.atraso} cuota${s.atraso === 1 ? "" : "s"}`],
            ["Puntos de beneficios", s.puntos],
            ["Oferta licitatoria", gs(s.ofertaMM)],
            ["Posición en la cola", `${s.posicionLicitacion} de ${s.totalEnCola}`],
            ["Avance del plan", `${fmt(s.avancePlanPct)}%`],
            ["Adjudicado", s.adjudicado ? `${s.adjudicado} por ${s.via}` : "Todavía no"],
          ],
        )}\n\n${ILUSTRATIVO}`;
      },
    }),
  },
  {
    // Antes que la mora: "¿se atrasa más el que ya tiene posesión?" lleva "atrasa", pero la
    // pregunta es de composición.
    test: re(/posesion|poseedor|aportante|composicion|en espera|ya tiene su unidad/),
    plan: (c) => ({
      pasos: [
        cartera({ ...c, situacion: undefined }, "situacion"),
        {
          herramienta: "analizar_mora",
          input: { desde: c.desde, hasta: c.hasta, asesor: c.asesor },
        },
        grafico({ grafico: "composicion_cartera", desde: c.desde, hasta: c.hasta }),
      ],
      sugerencias: [
        "¿Se atrasa más el que espera su unidad o el que ya la recibió?",
        "¿Qué entregas vienen y cuántos contratos pasan a la cuota con posesión?",
        "¿Cómo vienen los actos de adjudicación mes a mes?",
      ],
      componer: (r) => {
        const v = r["consultar_cartera"];
        const m = r["analizar_mora"];
        const porSit = new Map((m.porSituacion ?? []).map((x: any) => [x.situacion, x]));
        const pos = v.desglose.find((x: any) => x.clave === "Con posesión");
        return `De los **${fmt(v.activos, 0)} contratos activos**, ${fmt(pos?.contratos ?? 0, 0)} ya tienen posesión de su unidad y explican el **${fmt(pos?.participacionPct)}%** de lo recaudado en ${c.etiquetaPeriodo}: su aporte mensual es cerca de tres veces el de quien todavía espera.

${tabla(
  ["Situación", "Contratos", "Cuota / mes", "Recaudado", "Part.", "En mora", "% en mora"],
  v.desglose.map((x: any) => {
    const s = porSit.get(x.clave) as any;
    return [
      x.nombre,
      fmt(x.contratos, 0),
      `Gs ${fmt(s?.cuotaMensualGs ?? 0, 0)}`,
      gs(x.cobradoMM),
      `${fmt(x.participacionPct)}%`,
      fmt(s?.enMora ?? 0, 0),
      `${fmt(s?.moraPct)}%`,
    ];
  }),
)}

La situación y el estado de pago son ejes independientes: un contrato con posesión también puede estar en mora, y cuando lo está el saldo pesa más porque su cuota es la alta.

${ILUSTRATIVO}`;
      },
    }),
  },
  {
    test: re(/mora|atraso|impag|moroso|cobranza/),
    plan: (c) => ({
      pasos: [
        {
          herramienta: "analizar_mora",
          input: { desde: c.desde, hasta: c.hasta, asesor: c.asesor },
        },
        { herramienta: "riesgo_de_desercion", input: { asesor: c.asesor, limite: 8 } },
        grafico({ grafico: "mora_tramos", asesor: c.asesor }),
      ],
      sugerencias: [
        "¿Qué factores explican el riesgo de deserción y dónde se concentra?",
        "¿La mora viene subiendo o bajando?",
        "Compará la deserción por canal de alta y decime qué cambiarías en la venta.",
      ],
      componer: (r) => {
        const m = r["analizar_mora"];
        const g = r["riesgo_de_desercion"];
        const total = m.tramos.reduce((t: number, x: any) => t + x.saldoMM, 0);
        const socios = m.tramos.reduce((t: number, x: any) => t + x.socios, 0);
        const ultimo = m.evolucion[m.evolucion.length - 1];
        return `Hay **${fmt(socios, 0)} socios en mora** con un saldo de **${gs(total)}**${c.asesor ? ` en ${c.asesor}` : ""}. Al cierre del período la mora equivale al ${fmt(ultimo?.pctFacturacion)}% de lo emitido en el mes.\n\n${tabla(
          ["Tramo", "Socios", "Cuotas", "Saldo", "Riesgo de caída"],
          m.tramos.map((x: any) => [x.nombre, x.socios, x.cuotas, gs(x.saldoMM), x.riesgoDeCaida]),
        )}\n\n**A quién contactar primero** (por recaudación mensual en juego, no por orden de atraso):\n\n${tabla(
          ["Contrato", "Atraso", "Cuota", "Riesgo", "En juego"],
          g.contactar
            .slice(0, 6)
            .map((x: any) => [
              x.contrato,
              `${x.atraso} cuotas`,
              `Gs ${fmt(x.cuotaGs, 0)}`,
              `${x.puntaje} (${x.nivel})`,
              `Gs ${fmt(x.enJuegoGs, 0)}`,
            ]),
        )}\n\nA las 7 cuotas impagas el contrato se cae, así que el tramo de 5–6 es el que menos chance tiene de recuperarse solo.\n\n${ILUSTRATIVO}`;
      },
    }),
  },
  {
    test: re(/desercion|desertaron|abandonan|retencion|cohorte|se van|bajas/),
    plan: (c) => ({
      pasos: [
        {
          herramienta: "analizar_desercion",
          input: {
            agrupar: /asesor/.test(c.texto) ? "asesor" : /plan/.test(c.texto) ? "plan" : "canal",
          },
        },
        grafico({ grafico: "desercion_cohortes" }),
      ],
      sugerencias: [
        "¿Qué factores explican el riesgo de deserción y dónde se concentra?",
        "¿Cómo está repartida la mora por tramo de atraso?",
        "¿Cómo viene el crecimiento neto de la cartera?",
      ],
      componer: (r) => {
        const d = r["analizar_desercion"];
        const peor = d.desglose[0];
        const mejor = d.desglose[d.desglose.length - 1];
        return `La deserción se concentra en **${peor.nombre}** (${fmt(peor.desercionPct)}% de sus socios) y la mejor retención está en **${mejor.nombre}** (${fmt(mejor.desercionPct)}%).\n\n${tabla(
          ["Grupo", "Socios", "Bajas", "Deserción", "Cuota perdida", "Meses hasta la baja"],
          d.desglose.map((x: any) => [
            x.nombre,
            fmt(x.socios, 0),
            x.bajas,
            `${fmt(x.desercionPct)}%`,
            gs(x.cuotaPerdidaMM),
            x.mesesHastaLaBaja,
          ]),
        )}\n\n**Retención por cohorte de alta:**\n\n${tabla(
          ["Cohorte", "Socios", "A 12 meses", "A 24 meses", "A 36 meses"],
          d.cohortes.map((x: any) => [
            x.cohorte,
            fmt(x.socios, 0),
            x.vivos12 === null ? "—" : `${fmt(x.vivos12)}%`,
            x.vivos24 === null ? "—" : `${fmt(x.vivos24)}%`,
            x.vivos36 === null ? "—" : `${fmt(x.vivos36)}%`,
          ]),
        )}\n\nLas cohortes que todavía no cumplieron el hito quedan vacías en lugar de mostrar un dato parcial. El primer año es el que concentra las bajas.\n\n${ILUSTRATIVO}`;
      },
    }),
  },
  {
    // Ojo con el orden: una pregunta por el simulador de planes suele mencionar la
    // adjudicación, así que esa intención se atiende antes (ver `simul.*plan`).
    test: (c) =>
      /adjudica|sorteo|licitacion|bolilla|\bcola\b|cuando me toca|espera/.test(c.texto) &&
      !/simul\w*\s+(un\s+)?plan|plan de \d+|cronograma de aporte/.test(c.texto),
    plan: (c) => {
      const simula = /simul|chance|probabilidad|me toca|mi contrato/.test(c.texto);
      const pasos: Paso[] = [
        { herramienta: "consultar_adjudicaciones", input: { desde: c.desde, hasta: c.hasta } },
      ];
      if (simula)
        pasos.push({
          herramienta: "simular_adjudicacion",
          input: c.contrato
            ? { contrato: c.contrato }
            : { pagado_gs: 150_000_000, puntos: 48, antiguedad_meses: 48 },
        });
      pasos.push(grafico({ grafico: "adjudicaciones_mensuales", desde: c.desde, hasta: c.hasta }));
      return {
        pasos,
        sugerencias: [
          "¿Qué oferta hace falta para ganar una licitación?",
          "¿Cuánto esperan los socios hasta adjudicarse?",
          "¿Los aportes alcanzan para el cronograma de obra comprometido?",
        ],
        componer: (r) => {
          const a = r["consultar_adjudicaciones"];
          let out = `En ${c.etiquetaPeriodo} se adjudicaron **${a.adjudicados} unidades**: ${a.porSorteo} por sorteo y ${a.porLicitacion} por licitación. La espera media de los adjudicados fue de **${fmt(a.esperaMediaMeses)} meses** (entre ${a.esperaMinimaMeses} y ${a.esperaMaximaMeses}).\n\nHoy hay **${fmt(a.elegiblesEnEspera, 0)} socios elegibles** en la cola. Al ritmo de ${fmt(a.adjudicadosPorMes)} adjudicaciones por mes tardaría unos ${fmt(a.aniosParaVaciarLaCola)} años en vaciarse, pero es una división, no un plazo: la cola crece con las altas y el ritmo depende de las obras.\n\n**Cómo se adjudica:** por sorteo, todos los socios al día tienen la misma chance, sin importar antigüedad ni pagos. Por licitación, gana la mejor oferta, que combina pagos realizados y puntos de beneficios.\n\n${tabla(
            ["Percentil de oferta", "Monto"],
            a.percentilesDeOferta.map((x: any) => [x.percentil, gs(x.ofertaMM)]),
          )}\n\n`;
          const s = r["simular_adjudicacion"];
          if (s) {
            out += s.elegible
              ? `**Simulación** (socio con ${s.antiguedadMeses} meses y una oferta de ${gs(s.ofertaMM)}): en el próximo acto tendría **${fmt(s.probabilidadSorteoPct, 2)}%** por sorteo y **${fmt(s.probabilidadLicitacionPct)}%** por licitación, con la posición ${s.posicionEnLaCola} de ${fmt(s.elegibles, 0)} en la cola de ofertas. Para entrar por licitación hoy haría falta ofertar ${gs(s.ofertaParaEntrarMM)}.\n\nNo es un plazo de adjudicación: describe el próximo acto.\n\n`
              : `**Simulación:** ${s.motivo}\n\n`;
          }
          return out + ILUSTRATIVO;
        },
      };
    },
  },
  {
    test: re(/obra|avance|cronograma|calce|construccion|atrasad|caja/),
    plan: () => ({
      pasos: [
        { herramienta: "analizar_obra", input: {} },
        grafico({ grafico: "avance_obra" }),
        grafico({ grafico: "calce_obra" }),
      ],
      sugerencias: [
        "¿Cómo viene el catálogo de proyectos de Fortaleza?",
        "¿Cómo viene la cola de adjudicación y qué espera tienen los socios?",
        "¿Dónde conviene buscar el próximo terreno?",
      ],
      componer: (r) => {
        const o = r["analizar_obra"];
        return `Hay **${o.proyectosEnObra} proyectos en construcción** con ${fmt(o.unidadesEnObra, 0)} unidades y un avance medio del ${fmt(o.avanceMedioPct)}%. ${o.atrasadas > 0 ? `**${o.atrasadas} está${o.atrasadas === 1 ? "" : "n"} atrasada${o.atrasadas === 1 ? "" : "s"}** frente al cronograma` : "Ninguna está atrasada"}${o.enAtencion > 0 ? ` y ${o.enAtencion} en zona de atención` : ""}.\n\n${tabla(
          ["Proyecto", "Entrega", "Avance", "Cronograma", "Desvío", "Calce", "Estado"],
          o.obras.map((x: any) => [
            x.corto,
            x.anioEntrega,
            `${fmt(x.avancePct)}%`,
            `${fmt(x.avancePlanPct)}%`,
            `${fmt(x.desvioPuntos)} pts`,
            gs(x.calceMM),
            x.estado,
          ]),
        )}\n\n**Calce financiero:** de los aportes recaudados, ${gs(o.asignadoMM)} están asignados a estas obras y ${gs(o.ejecutadoMM)} es el costo de lo ya ejecutado, así que el calce global es de ${gs(o.calceMM)}. Donde el calce es negativo, la obra va por delante del fondeo.\n\n${MIXTO}`;
      },
    }),
  },
  {
    test: re(/terreno|donde comprar|proximo terreno|evalua|zonificacion/),
    plan: (c) => ({
      pasos: [{ herramienta: "evaluar_terreno", input: { barrio: c.barrio ?? "Manorá" } }],
      sugerencias: [
        "¿Dónde construye la competencia y dónde no estamos?",
        "¿Cómo están los precios de m² por barrio?",
        "¿Cómo viene la absorción del mercado de departamentos?",
      ],
      componer: (r) => {
        const e = r["evaluar_terreno"];
        if (e.error) return e.error;
        return `Un terreno en **${e.barrio}** (${e.zona}) obtiene **${e.puntaje}/100**: ${e.recomendacion.toLowerCase()}.\n\n${tabla(
          ["Factor", "Valor", "Aporte"],
          e.factores.map((f: any) => [f.nombre, f.valor, `${f.aporte > 0 ? "+" : ""}${f.aporte}`]),
        )}\n\nSobre un terreno tipo de ${fmt(e.superficieTipoM2, 0)} m² saldrían unos ${fmt(e.m2VendiblesEstimados, 0)} m² vendibles (~${e.unidadesEstimadas} unidades), con un ingreso potencial de USD ${fmt(e.ingresoPotencialUsdM)} M.\n\n**Mejores barrios candidatos:**\n\n${tabla(
          ["Barrio", "Puntaje", "m² USD", "Competencia", "Proyectos propios"],
          e.rankingBarrios
            .slice(0, 6)
            .map((b: any) => [
              b.barrio,
              b.puntaje,
              fmt(b.precioM2Usd, 0),
              b.competencia,
              b.fortaleza,
            ]),
        )}\n\n*${e.nota}*`;
      },
    }),
  },
  {
    test: re(/mercado|precio|m2|metro cuadrado|competencia|desarrolladora|absorcion/),
    plan: (c) => ({
      pasos: [
        { herramienta: "consultar_mercado", input: { barrio: c.barrio } },
        grafico({ grafico: "precio_m2_barrio" }),
      ],
      sugerencias: [
        "¿Dónde conviene buscar el próximo terreno?",
        "¿Cómo viene el catálogo de proyectos de Fortaleza?",
        "¿Cómo viene la absorción del mercado de departamentos?",
      ],
      componer: (r) => {
        const m = r["consultar_mercado"];
        return `El m² medio de Asunción está en **USD ${fmt(m.precioM2MedioUsd, 0)}**, con ${m.barrioMasCaro} como barrio más caro (USD ${fmt(m.precioM2MaximoUsd, 0)}/m²). La competencia tiene ${m.edificiosCompetencia} edificios con ${fmt(m.unidadesCompetencia, 0)} unidades, contra ${m.proyectosFortaleza} proyectos de Fortaleza.\n\n${tabla(
          ["Barrio", "USD/m²", "Variación", "Competencia", "Proyectos Fortaleza"],
          m.precios
            .slice(0, 10)
            .map((p: any) => [
              p.barrio,
              fmt(p.precioM2Usd, 0),
              signo(p.variacionPct),
              p.competencia,
              p.fortaleza,
            ]),
        )}\n\n${
          m.barriosSinPresencia.length
            ? `**Barrios donde la competencia construye y Fortaleza no está:** ${m.barriosSinPresencia.map((b: any) => `${b.barrio} (${b.competencia})`).join(", ")}.`
            : ""
        }\n\nLa absorción fue de ${fmt(m.absorcionAnualUnidades, 0)} unidades en 12 meses, con ${fmt(m.mesesDeStock)} meses de stock.\n\n${ILUSTRATIVO}`;
      },
    }),
  },
  {
    test: re(/\bproyecto|\btorre|\bedificio|\bcatalogo|\btipologia|\bunidades\b|\bentregad/),
    plan: (c) => ({
      pasos: [
        { herramienta: "consultar_proyectos", input: c.barrio ? { barrio: c.barrio } : {} },
        grafico({ grafico: "unidades_por_proyecto" }),
      ],
      sugerencias: [
        "¿Qué obras están atrasadas frente al cronograma?",
        "¿Qué tipologías predominan en el catálogo?",
        "¿Dónde conviene buscar el próximo terreno?",
      ],
      componer: (r) => {
        const p = r["consultar_proyectos"];
        const entregados = p.proyectos.filter((x: any) => x.estado === "Entregado");
        const enObra = p.proyectos.filter((x: any) => x.estado === "En construcción");
        return `El catálogo tiene **${entregados.length} proyectos entregados** y **${enObra.length} en construcción**, con ${fmt(
          p.proyectos.reduce((t: number, x: any) => t + x.unidades, 0),
          0,
        )} unidades en total.\n\n${tabla(
          ["Proyecto", "Barrio", "Año", "Estado", "Pisos", "Unidades"],
          p.proyectos
            .slice(-10)
            .map((x: any) => [x.corto, x.barrio, x.anio, x.estado, x.pisos, x.unidades]),
        )}\n\n**Mix por tipología:** ${p.mixTipologias.map((t: any) => `${t.tipologia} ${fmt(t.participacionPct)}%`).join(", ")}.\n\n${p.nota}\n\n${MIXTO}`;
      },
    }),
  },
  {
    test: re(/simul.*plan|cuota|cronograma de aporte|cuanto pagaria|plan de \d+/),
    plan: (c) => {
      const cuotas = Number(c.texto.match(/(\d{2,3})\s*cuotas/)?.[1] ?? 180);
      const pre = Number(
        c.texto.match(/(\d{1,3})\s*cuotas? (?:antes|pre)/)?.[1] ?? Math.round(cuotas / 3),
      );
      return {
        pasos: [
          {
            herramienta: "simular_plan",
            input: {
              valor: 420_000_000,
              cuotas_totales: Math.min(240, Math.max(12, cuotas)),
              cuotas_pre: Math.min(cuotas, Math.max(0, pre)),
              tasa_mensual: 0.009,
            },
          },
        ],
        sugerencias: [
          "¿Cuál es el ticket promedio de cada plan?",
          "¿Cómo se reparte la cartera entre los planes?",
          "¿Qué oferta hace falta para ganar una licitación?",
        ],
        componer: (r) => {
          const s = r["simular_plan"];
          const x = s.resumen;
          return `Para una unidad de **Gs ${fmt(x.valor / 1_000_000, 0)} MM** con ${x.cuotasPre + x.cuotasPost} cuotas (${x.cuotasPre} antes de la adjudicación y ${x.cuotasPost} después, al 0,9% mensual):\n\n${tabla(
            ["Concepto", "Monto"],
            [
              ["Cuota antes de adjudicar", `Gs ${fmt(x.cuotaPre, 0)}`],
              ["Cuota después de adjudicar", `Gs ${fmt(x.cuotaPost, 0)}`],
              ["Total del tramo previo", `Gs ${fmt(x.totalPre / 1_000_000, 0)} MM`],
              ["Total del tramo financiado", `Gs ${fmt(x.totalPost / 1_000_000, 0)} MM`],
              ["Intereses", `Gs ${fmt(x.totalIntereses / 1_000_000, 0)} MM`],
              [
                "Intereses capitalizados en la obra",
                `Gs ${fmt(x.interesesCapitalizados / 1_000_000, 0)} MM`,
              ],
              ["Total pagado", `Gs ${fmt(x.totalPagado / 1_000_000, 0)} MM`],
            ],
          )}\n\nEl tramo previo a la adjudicación no lleva interés. El interés que se deja de cobrar durante la obra se capitaliza y se financia después: es la misma lógica del cuotero que ya usa el equipo.\n\n${ILUSTRATIVO}`;
        },
      };
    },
  },
  {
    test: re(/proyec|forecast|pronost|escenario|cierre|hasta diciembre|backtest|confiable/),
    plan: (c) => ({
      pasos: [
        { herramienta: "proyectar_cartera", input: { plan: c.plan, ajuste_pct: c.ajuste ?? 0 } },
        grafico({ grafico: "forecast_cartera", plan: c.plan, ajuste_pct: c.ajuste ?? 0 }),
      ],
      sugerencias: [
        "¿Cómo viene el crecimiento neto de la cartera?",
        "¿Los aportes alcanzan para el cronograma de obra comprometido?",
        "¿Qué análisis se podrían hacer con la cartera real que hoy no se pueden?",
      ],
      componer: (r) => {
        const p = r["proyectar_cartera"];
        return `La proyección de recaudación${c.plan ? ` del ${nombrePlan[c.plan]}` : ""} para los próximos ${p.meses.length} meses suma **${gs(p.totalBase)}** en el escenario base.\n\n${tabla(
          ["Mes", "Base", "Rango probable (80%)"],
          p.meses.map((m: any) => [
            m.etiqueta,
            gs(m.base),
            `${fmt(m.minimo, 0)} – ${fmt(m.maximo, 0)}`,
          ]),
        )}\n\n${p.ajustePct ? `Con un escenario de **${signo(p.ajustePct)}** llegaría a ${gs(p.totalEscenario)}.\n\n` : ""}**Qué tan confiable es:** entrenando sin los últimos 4 meses y pronosticándolos, el error medio fue de **${fmt(p.mapePct)}%** (MAPE):\n\n${tabla(
          ["Mes", "Real", "Pronóstico", "Error"],
          p.backtest.map((b: any) => [b.mes, gs(b.real), gs(b.pronostico), `${fmt(b.errorPct)}%`]),
        )}\n\n**Método:** ${p.metodo}\n\n${ILUSTRATIVO}`;
      },
    }),
  },
  {
    test: re(/asesor|canal|alta|vendedor/),
    plan: (c) => ({
      pasos: [
        cartera(c, "asesor"),
        { herramienta: "analizar_desercion", input: { agrupar: "asesor" } },
        grafico({ grafico: "cartera_por_asesor", desde: c.desde, hasta: c.hasta }),
      ],
      sugerencias: [
        "Compará la deserción por canal de alta y decime qué cambiarías en la venta.",
        "¿Cómo está repartida la mora por tramo de atraso?",
        "¿Cómo viene el crecimiento neto de la cartera?",
      ],
      componer: (r) => {
        const v = r["consultar_cartera"];
        const d = r["analizar_desercion"];
        const porNombre = new Map(d.desglose.map((x: any) => [x.nombre, x]));
        return `En ${c.etiquetaPeriodo} los asesores recaudaron **${gs(v.cobradoMM)}** en total.\n\n${tabla(
          ["Asesor", "Recaudado", "Part.", "Interanual", "Socios", "Mora / mes", "Deserción"],
          v.desglose.map((x: any) => [
            x.nombre,
            gs(x.cobradoMM),
            `${fmt(x.participacionPct)}%`,
            signo(x.variacionInteranualPct),
            fmt(x.socios, 0),
            `${fmt(x.moraPctFacturacionMensual)}%`,
            `${fmt((porNombre.get(x.nombre) as any)?.desercionPct)}%`,
          ]),
        )}\n\n${ILUSTRATIVO}`;
      },
    }),
  },
  {
    test: re(/plan amplia|plan 20|planes|ticket/),
    plan: (c) => ({
      pasos: [
        cartera(c, "plan"),
        grafico({ grafico: "cartera_por_plan", desde: c.desde, hasta: c.hasta }),
        grafico({ grafico: "ticket_por_plan", desde: c.desde, hasta: c.hasta }),
      ],
      sugerencias: [
        "Simulá un plan de 180 cuotas con 60 cuotas antes de la adjudicación.",
        "¿Cómo está repartida la mora por tramo de atraso?",
        "¿Cómo viene la retención por cohorte de alta?",
      ],
      componer: (r) => {
        const v = r["consultar_cartera"];
        return `En ${c.etiquetaPeriodo} la cartera recaudó **${gs(v.cobradoMM)}** repartidos así entre los planes:\n\n${tabla(
          ["Plan", "Recaudado", "Part.", "Interanual", "Socios", "Mora / mes"],
          v.desglose.map((x: any) => [
            x.nombre,
            gs(x.cobradoMM),
            `${fmt(x.participacionPct)}%`,
            signo(x.variacionInteranualPct),
            fmt(x.socios, 0),
            `${fmt(x.moraPctFacturacionMensual)}%`,
          ]),
        )}\n\nLa cuota media de los activos es de Gs ${fmt(v.cuotaMediaGs, 0)}.\n\n${ILUSTRATIVO}`;
      },
    }),
  },
  {
    test: re(/barrio|donde viven|domicilio|territorio|zona/),
    plan: (c) => ({
      pasos: [
        cartera({ ...c, barrio: undefined }, "barrio"),
        grafico({ grafico: "cartera_por_barrio", desde: c.desde, hasta: c.hasta }),
      ],
      sugerencias: [
        "¿Cómo están los precios de m² por barrio?",
        "¿Dónde conviene buscar el próximo terreno?",
        "Compará los asesores por recaudación, altas y mora.",
      ],
      componer: (r) => {
        const v = r["consultar_cartera"];
        const d = v.desglose.slice(0, 10);
        return `Los socios se concentran en **${d[0].nombre}** (${fmt(d[0].participacionPct)}% de la recaudación), seguido de ${d[1].nombre} y ${d[2].nombre}.\n\n${tabla(
          ["Barrio", "Recaudado", "Part.", "Socios", "Interanual"],
          d.map((x: any) => [
            x.nombre,
            gs(x.cobradoMM),
            `${fmt(x.participacionPct)}%`,
            fmt(x.socios, 0),
            signo(x.variacionInteranualPct),
          ]),
        )}\n\n${ILUSTRATIVO}`;
      },
    }),
  },
  {
    test: re(/crecimiento|altas|neto|concentra|antiguedad|atipic|que paso/),
    plan: (c) => ({
      pasos: [
        {
          herramienta: "analizar_crecimiento",
          input: { desde: c.desde, hasta: c.hasta, plan: c.plan },
        },
        grafico({ grafico: "altas_bajas", desde: c.desde, hasta: c.hasta }),
      ],
      sugerencias: [
        "¿Cómo viene la retención por cohorte de alta?",
        "¿Cómo viene la recaudación de 2026 frente a 2025?",
        "Proyectá la recaudación y explicá las limitaciones del modelo.",
      ],
      componer: (r) => {
        const a = r["analizar_crecimiento"];
        const altas = a.altasYBajas.reduce((t: number, x: any) => t + x.altas, 0);
        const bajas = a.altasYBajas.reduce((t: number, x: any) => t + x.bajas, 0);
        const k = a.concentracion;
        return `En ${c.etiquetaPeriodo} entraron **${fmt(altas, 0)} socios** y se fueron ${fmt(bajas, 0)}: un crecimiento neto de **${fmt(altas - bajas, 0)} contratos**.\n\n${tabla(
          ["Mes", "Altas", "Bajas", "Neto"],
          a.altasYBajas.map((x: any) => [x.mes, x.altas, x.bajas, x.neto]),
        )}\n\n**Antigüedad de los activos:** ${a.antiguedad.map((t: any) => `${t.nombre} ${fmt(t.socios, 0)}`).join(", ")}.\n\n**Concentración:** ${fmt(k.n80, 0)} de ${fmt(k.socios, 0)} socios aportan el 80% de la recaudación; los 100 primeros, el ${fmt(k.top100Pct)}%. No depende de un puñado de contratos.\n\n${
          a.mesesAtipicos.length
            ? `**Meses fuera de lo habitual:** ${a.mesesAtipicos
                .slice(0, 3)
                .map(
                  (m: any) =>
                    `${m.etiqueta} (${signo(m.variacionInteranualPct)}, z = ${fmt(m.z, 2)})`,
                )
                .join(", ")}.\n\n`
            : ""
        }${ILUSTRATIVO}`;
      },
    }),
  },
  {
    test: re(/resumen ejecutivo|oportunidades/),
    plan: (c) => ({
      pasos: [cartera(c, "total"), { herramienta: "detectar_alertas", input: {} }],
      sugerencias: [
        "¿A qué socios en mora conviene contactar primero y cuánta recaudación está en juego?",
        "¿Qué obras están atrasadas frente al cronograma?",
        "¿Dónde conviene buscar el próximo terreno?",
      ],
      componer: (r) => {
        const v = r["consultar_cartera"];
        const a = r["detectar_alertas"].alertas;
        return `**Resumen ejecutivo · ${c.etiquetaPeriodo}.** La cartera recaudó **${gs(v.cobradoMM)}** (${signo(v.variacionInteranualPct)} interanual) con ${fmt(v.activos, 0)} socios activos, ${v.altas} altas y ${v.bajas} bajas. La mora equivale al ${fmt(v.moraPctFacturacionMensual)}% de un mes de facturación y la efectividad de cobranza fue del ${fmt(v.efectividadCobranzaPct)}%.\n\n**Tres oportunidades:**\n\n${oportunidades
          .slice(0, 3)
          .map(
            (o, i) =>
              `${i + 1}. **${o.titulo}** (prioridad ${o.prioridad.toLowerCase()}). ${a[i]?.detalle ?? o.evidencia} *Próximo paso:* ${o.accion}`,
          )
          .join("\n")}\n\n${ILUSTRATIVO}`;
      },
    }),
  },
  {
    test: re(/alerta|atender|urgente|riesgo|prioriz|que hago|primero/),
    plan: () => ({
      pasos: [{ herramienta: "detectar_alertas", input: {} }],
      sugerencias: [
        "¿A qué socios en mora conviene contactar primero y cuánta recaudación está en juego?",
        "¿Qué obras están atrasadas frente al cronograma?",
        "¿Cómo viene la retención por cohorte de alta?",
      ],
      componer: (r) => {
        const a = r["detectar_alertas"].alertas;
        return `Detecté **${a.length} alertas**, ordenadas por severidad:\n\n${a
          .slice(0, 8)
          .map((x: any, i: number) => `${i + 1}. **${x.titulo}** (${x.area}). ${x.detalle}`)
          .join("\n")}`;
      },
    }),
  },
  {
    test: re(/recaudacion|aportes|cartera|cobranza|como viene|evolucion|grafica|mensual|frente a/),
    plan: (c) => ({
      pasos: [
        cartera(c, "mes"),
        grafico({
          grafico: "cartera_mensual",
          desde: PRIMER_PERIODO,
          hasta: c.hasta,
          plan: c.plan,
        }),
      ],
      sugerencias: [
        "Compará los asesores por recaudación, altas y mora.",
        "¿Cómo está repartida la mora por tramo de atraso?",
        "Proyectá la recaudación y explicá las limitaciones del modelo.",
      ],
      componer: (r) => {
        const v = r["consultar_cartera"];
        return `La cartera recaudó **${gs(v.cobradoMM)}** en ${c.etiquetaPeriodo}${c.plan ? ` (${nombrePlan[c.plan]})` : ""}, **${signo(v.variacionInteranualPct)}** frente al mismo período del año anterior (${gs(v.interanualMM)}). Hubo ${fmt(v.activos, 0)} socios activos y la efectividad de cobranza fue del ${fmt(v.efectividadCobranzaPct)}%.\n\n${tabla(
          ["Mes", "Cobrado", "Emitido", "Año anterior"],
          v.desglose.map((m: any) => [
            m.mes,
            gs(m.cobradoMM),
            gs(m.emitidoMM),
            gs(m.anioAnteriorMM),
          ]),
        )}\n\n${ILUSTRATIVO}`;
      },
    }),
  },
];

const sugerenciasGenerales = [
  "¿Cómo viene la recaudación de 2026 frente a 2025?",
  "¿Cómo está repartida la mora por tramo de atraso?",
  "¿Qué alertas atenderías primero?",
];

const pausa = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    setTimeout(resolve, ms);
  });

export async function responderEnDemo(pregunta: string, w: EscritorFide, signal?: AbortSignal) {
  const c = leerContexto(pregunta);
  const intencion = intenciones.find((i) => i.test(c));
  const plan: Plan2 = intencion
    ? intencion.plan(c)
    : {
        pasos: [cartera(c, "total"), { herramienta: "detectar_alertas", input: {} }],
        sugerencias: sugerenciasGenerales,
        componer: (r) => {
          const v = r["consultar_cartera"];
          const a = r["detectar_alertas"].alertas.slice(0, 3);
          return `En modo demo entiendo preguntas sobre la cartera (recaudación, planes, asesores, barrios, crecimiento), la mora y la deserción, las adjudicaciones, la obra, el mercado y el simulador de planes.\n\nMientras tanto, un panorama: en ${c.etiquetaPeriodo} la cartera recaudó **${gs(v.cobradoMM)}** (${signo(v.variacionInteranualPct)} interanual) con ${fmt(v.activos, 0)} socios activos. Alertas principales:\n\n${a.map((x: any) => `- **${x.titulo}**: ${x.detalle}`).join("\n")}\n\n${ILUSTRATIVO}`;
        },
      };

  const resultados: Record<string, any> = {};
  for (const paso of plan.pasos) {
    if (signal?.aborted) return;
    const { resultado, graficos } = await w.herramienta(paso.herramienta, paso.input, async () => {
      await pausa(260, signal);
      return ejecutarHerramienta(paso.herramienta, paso.input);
    });
    resultados[paso.herramienta] ??= resultado;
    for (const g of graficos ?? []) w.grafico(g);
  }

  const texto = `${plan.componer(resultados)}\n\nSiguientes preguntas:\n${plan.sugerencias.map((s) => `- ${s}`).join("\n")}`;
  const id = w.textoInicio();
  // Simula el ritmo de escritura para que la demo se sienta viva.
  const trozos = texto.match(/\S+\s*/g) ?? [texto];
  for (let i = 0; i < trozos.length; i += 4) {
    if (signal?.aborted) break;
    w.textoDelta(id, trozos.slice(i, i + 4).join(""));
    await pausa(14, signal);
  }
  w.textoFin(id);
}
