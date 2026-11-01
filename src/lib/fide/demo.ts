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
        const esp = v.desglose.find((x: any) => x.clave === "En espera");
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

**Cómo leer el gráfico:** las barras no siguen el orden del camino del socio sino el peso en la recaudación, y ahí está el punto. Los que esperan son ${fmt(esp?.contratos ?? 0, 0)} contratos y aportan ${fmt(esp?.participacionPct)}%; los que ya recibieron su unidad son ${fmt(pos?.contratos ?? 0, 0)} y aportan ${fmt(pos?.participacionPct)}%. En caja, cada contrato con posesión vale por cerca de tres que esperan.

Eso tiene una consecuencia de gestión: perder un contrato con posesión cuesta el triple que perder uno en espera, y sin embargo la cobranza suele ordenarse por cantidad de cuotas atrasadas, que trata a los dos igual.${
          (porSit.get("Con posesión") as any)?.enMora
            ? ` Hoy hay **${fmt((porSit.get("Con posesión") as any).enMora, 0)} contratos con posesión en mora** —el ${fmt((porSit.get("Con posesión") as any).moraPct)}% de ese grupo—, y cada cuota impaga ahí vale Gs ${fmt((porSit.get("Con posesión") as any).cuotaMensualGs, 0)}.`
            : ""
        }

La situación y el estado de pago son ejes independientes: un contrato con posesión también puede estar en mora, y cuando lo está el saldo pesa más porque su cuota es la alta. Hacia adelante la composición se mueve sola con el cronograma de obra: cada entrega de torre empuja contratos de la barra de la izquierda a la de la derecha, y eso sube la recaudación mensual sin una sola alta nueva.

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
        const tramoPeor = [...m.tramos].sort((a: any, b: any) => b.saldoMM - a.saldoMM)[0];
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
        )}\n\n**Cómo leer el gráfico:** las barras son el saldo impago por tramo de atraso, no la cantidad de socios, y por eso un tramo con pocos contratos puede ser la barra más alta: lo que la levanta es la cuota de cada uno multiplicada por las cuotas que debe. El tramo más pesado hoy es **${tramoPeor.nombre}** con ${gs(tramoPeor.saldoMM)}.\n\nA las 7 cuotas impagas el contrato se cae, así que el tramo de 5–6 es el que menos chance tiene de recuperarse solo y el que conviene atacar primero aunque sean pocos casos. La tabla de contacto no va ordenada por atraso sino por **recaudación mensual en juego** (riesgo × cuota): un contrato con posesión y riesgo medio pesa más que uno en espera con riesgo alto, porque su cuota es casi 3× mayor.\n\nY una aclaración de método que cambia la lectura: la mora se mide sobre el SALDO pendiente al cierre, no como "emitido − cobrado" del período. Si se midiera así, las regularizaciones de meses anteriores entran en la ventana y dejan la mora en casi cero — un número lindo que esconde el problema.\n\n${ILUSTRATIVO}`;
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
        )}\n\n**Cómo leer el gráfico:** cada línea es una camada de altas y muestra qué proporción seguía viva a los 12, 24 y 36 meses. Lo que importa no es dónde termina cada línea sino **dónde baja más rápido**, y en todas la caída está en el primer tramo: el primer año concentra las bajas. Las cohortes que todavía no cumplieron el hito quedan vacías en lugar de mostrar un dato parcial, que siempre se ve mejor de lo que es.\n\nLa diferencia entre **${peor.nombre}** y **${mejor.nombre}** son ${fmt(peor.desercionPct - mejor.desercionPct, 1)} puntos de deserción, y eso se traduce en ${gs(peor.cuotaPerdidaMM)} de cuota mensual perdida solo en el primer grupo. La antigüedad típica al momento de la baja (${peor.mesesHastaLaBaja} meses) dice dónde intervenir: si el contrato se cae antes del año, el problema está en el alta —qué se prometió y cómo se acompañó—, no en la cobranza.\n\nUna baja no es lo mismo que una mora: la mora se recupera, la baja hay que volver a venderla. Por eso conviene mirar este cuadro antes de empujar más altas por el canal que peor retiene.\n\n${ILUSTRATIVO}`;
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
          )}\n\n**Cómo leer el gráfico:** las barras mensuales separan sorteo de licitación, y los meses no son parejos a propósito: los actos se concentran cuando hay unidades para entregar, así que el dibujo sigue al cronograma de obra más que a la demanda. Un mes flojo no significa que la cola se haya frenado.\n\nLa tabla de percentiles es la que sirve para aconsejar a un socio. Dice qué se está ofertando hoy, no qué hace falta para ganar: la oferta ganadora depende de quién se presente en ese acto. Por eso una oferta en el percentil alto mejora mucho las chances y no las garantiza, y por eso la espera se informa como rango observado y nunca como fecha.\n\n`;
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
        )}\n\n**Calce financiero:** de los aportes recaudados, ${gs(o.asignadoMM)} están asignados a estas obras y ${gs(o.ejecutadoMM)} es el costo de lo ya ejecutado, así que el calce global es de ${gs(o.calceMM)}.

**Cómo leer los dos gráficos:** el primero compara avance real contra cronograma, barra contra barra, y lo que hay que mirar es la diferencia, no la altura: una torre al 30% puede estar perfecta y otra al 80%, atrasada. El segundo pone enfrente lo asignado y lo ejecutado de cada obra; donde la barra de ejecutado supera a la de asignado, la obra va por delante del fondeo y se está financiando con los aportes de otros proyectos.

Un desvío de cronograma no es solo un problema de obra: la entrega es la que pasa a los contratos adjudicados a la cuota con posesión, casi 3× la de espera. Cada mes de atraso en una torre es un mes de recaudación que no entra, además del costo de la demora. Por eso conviene mirar juntas la columna de desvío y la cantidad de contratos adjudicados a ese proyecto.\n\n${MIXTO}`;
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
        const minimoM2 = Math.min(...m.precios.map((x: any) => x.precioM2Usd));
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
        }\n\n**Cómo leer el gráfico:** las barras son el precio del m² por barrio, y el salto entre el más caro y el más barato es de ${fmt(m.precioM2MaximoUsd / (minimoM2 || m.precioM2MedioUsd), 1)}×. Un m² caro no es una mala noticia para una desarrolladora: es el precio al que se vende lo que se construye ahí. Lo que encarece el proyecto es el terreno, y el terreno sube cuando el barrio ya está de moda — por eso conviene entrar antes de que la barra suba, no después.\n\nLa absorción fue de **${fmt(m.absorcionAnualUnidades, 0)} unidades en 12 meses**, con ${fmt(m.mesesDeStock)} meses de stock. Ese número es el que pone en contexto a los demás: con ese ritmo, el mercado tarda ${fmt(m.mesesDeStock)} meses en vaciar lo que hoy está en oferta. Por encima de 18–24 meses de stock, sumar unidades compite con el propio inventario; por debajo, hay lugar para construir.\n\n${ILUSTRATIVO}`;
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
        )}\n\n**Mix por tipología:** ${p.mixTipologias.map((t: any) => `${t.tipologia} ${fmt(t.participacionPct)}%`).join(", ")}.\n\n**Cómo leer el gráfico:** cada barra es un proyecto y su altura, las unidades. La dispersión importa más que el total: una torre grande entrega muchos contratos de golpe y mueve la recaudación en un solo mes —cada uno pasa a la cuota con posesión, casi 3× la de espera—, mientras que varias torres chicas reparten ese salto en el tiempo. Para la caja, el tamaño de la torre es tan relevante como la cantidad de torres.\n\n${p.nota}\n\n${MIXTO}`;
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
          )}\n\n**Cómo leer estos números:** la cuota salta de Gs ${fmt(x.cuotaPre, 0)} a Gs ${fmt(x.cuotaPost, 0)} al adjudicar, y ese salto es la parte que hay que explicar bien en la venta: el tramo previo no lleva interés, así que lo que se paga antes de la adjudicación va entero contra el valor de la unidad. El interés que se deja de cobrar durante la obra no se regala: se capitaliza y se financia en el tramo de después, y por eso los intereses capitalizados (Gs ${fmt(x.interesesCapitalizados / 1_000_000, 0)} MM) aparecen separados de los intereses corrientes.

Sobre el total, los intereses son el ${fmt((x.totalIntereses / x.valor) * 100, 1)}% del valor de la unidad. Alargar el plazo baja la cuota pero sube ese porcentaje; adelantar cuotas antes de adjudicar lo baja, porque reduce el saldo que entra al tramo financiado. Son las dos palancas reales, y conviene mostrarlas juntas cuando alguien pide "la cuota más baja".

Ojo con una confusión frecuente: esto es el **simulador de planes**, con sistema francés, y es un producto distinto del aporte del Sistema de Ahorro, donde la administradora fija una cuota única según la situación del contrato y no hay interés. Es la misma lógica del cuotero que ya usa el equipo.\n\n${ILUSTRATIVO}`;
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
        )}\n\n**Cómo leer el gráfico:** la línea llena es lo recaudado y la punteada, el pronóstico; la banda alrededor es el rango probable del 80%, y se ensancha con los meses porque la incertidumbre se acumula. El valor de la línea central no es "lo que va a pasar": es el centro de la banda, y cualquier punto dentro de ella es igual de compatible con lo observado.\n\n**Qué NO incluye este pronóstico:** el calendario de obra. La serie se arma con tendencia y estacionalidad de lo ya recaudado, así que no sabe que cuando se entregue una torre sus contratos adjudicados pasan a la cuota con posesión. Ese salto está calculado aparte, en el panel de entregas de la pestaña Forecast, y se lee al lado de esta curva — nunca sumado adentro, porque mezclarlos daría una precisión que ninguno de los dos cálculos tiene.\n\n**Método:** ${p.metodo}\n\n${ILUSTRATIVO}`;
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
        const pctPos = (x: any) => (x.contratos ? (x.conPosesion / x.contratos) * 100 : 0);
        const lider = v.desglose[0];
        const ultimo = v.desglose[v.desglose.length - 1];
        const peorMora = [...v.desglose].sort(
          (a: any, b: any) => b.moraPctFacturacionMensual - a.moraPctFacturacionMensual,
        )[0];
        const peorDes = d.desglose[0];
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
        )}\n\n**Cómo leer el gráfico:** las barras están ordenadas por recaudación, y la diferencia entre la primera (**${lider.nombre}**, ${gs(lider.cobradoMM)}) y la última (**${ultimo.nombre}**, ${gs(ultimo.cobradoMM)}) es de ${fmt(lider.cobradoMM / (ultimo.cobradoMM || 1), 2)}×. Pero antes de leer eso como desempeño, mirá la composición: ${lider.nombre} tiene ${fmt(pctPos(lider))}% de contratos con posesión y ${ultimo.nombre}, ${fmt(pctPos(ultimo))}%. Como el aporte con posesión es cerca de 3× el de espera, buena parte de la brecha es mix de cartera heredado, no gestión del mes.\n\nLo que sí es gestión está en las dos últimas columnas. **${peorMora.nombre}** arrastra la mora más alta (${fmt(peorMora.moraPctFacturacionMensual)}% de un mes de facturación) y **${peorDes.nombre}**, la peor deserción (${fmt((porNombre.get(peorDes.nombre) as any)?.desercionPct)}%). Ahí una conversación de cobranza y seguimiento rinde más que empujar ventas nuevas, porque el contrato que se cae ya estaba pago y vuelve a costar conseguirlo.\n\n${ILUSTRATIVO}`;
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
        const mayor = v.desglose[0];
        const menor = v.desglose[v.desglose.length - 1];
        const peor = [...v.desglose].sort(
          (a: any, b: any) => b.moraPctFacturacionMensual - a.moraPctFacturacionMensual,
        )[0];
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
        )}\n\n**Cómo leer los dos gráficos:** el primero reparte la recaudación y el segundo muestra la cuota promedio de cada plan. No son lo mismo y conviene cruzarlos: **${mayor.nombre}** pesa ${fmt(mayor.participacionPct)}% de la recaudación con ${fmt(mayor.contratos, 0)} contratos, mientras que **${menor.nombre}** aporta ${fmt(menor.participacionPct)}% con ${fmt(menor.contratos, 0)}.\n\nLa cuota promedio de los activos es de **Gs ${fmt(v.cuotaMediaGs, 0)}**, y las diferencias entre planes no vienen del plan en sí: el aporte lo fija la administradora según la SITUACIÓN del contrato (Gs ${fmt(1655000, 0)} en espera, Gs ${fmt(5000000, 0)} con posesión). Un plan con promedio más alto es, sobre todo, un plan con más contratos ya entregados — suele ser el más antiguo, no el más caro.\n\nLo que sí distingue a los planes es el plazo (240, 180 y 120 cuotas) y la mora: **${peor.nombre}** es el que más arrastra, con ${fmt(peor.moraPctFacturacionMensual)}% de un mes de facturación.\n\n${ILUSTRATIVO}`;
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
        const top3 = d.slice(0, 3).reduce((t: number, x: any) => t + x.participacionPct, 0);
        return `Los socios se concentran en **${d[0].nombre}** (${fmt(d[0].participacionPct)}% de la recaudación), seguido de ${d[1].nombre} y ${d[2].nombre}.\n\n${tabla(
          ["Barrio", "Recaudado", "Part.", "Socios", "Interanual"],
          d.map((x: any) => [
            x.nombre,
            gs(x.cobradoMM),
            `${fmt(x.participacionPct)}%`,
            fmt(x.socios, 0),
            signo(x.variacionInteranualPct),
          ]),
        )}\n\n**Cómo leer el gráfico:** la barra más alta no es necesariamente el barrio con más socios, sino el que más aporta, y las dos cosas se separan cuando cambia el mix entre espera y posesión. Los tres primeros suman **${fmt(top3, 1)}%** de la recaudación, así que la cartera está repartida: ningún barrio la sostiene solo.\n\nEl dato accionable es el cruce con los proyectos. Este desglose dice dónde VIVEN los socios, no dónde están los edificios: si un barrio aporta mucho y no tiene obra de Fortaleza cerca, es demanda que hoy se está mudando a otra zona para comprar. Esa pregunta se contesta con el evaluador de terrenos, que mira el m² y la competencia barrio por barrio.\n\n${ILUSTRATIVO}`;
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
        }**Cómo leer el gráfico:** las barras hacia arriba son altas y las de abajo, bajas; lo que hay que seguir es la distancia entre ambas, que es el crecimiento neto. Un mes con muchas altas y muchas bajas no es un buen mes: es rotación, y la rotación cuesta comisión y arranca de cero la antigüedad.\n\nLa concentración completa la lectura. Que hagan falta ${fmt(k.n80, 0)} contratos para juntar el 80% de la recaudación quiere decir que la cartera no depende de un puñado de socios grandes: es un riesgo bajo y poco común, y conviene decirlo cuando se discute la solidez del sistema.\n\n${ILUSTRATIVO}`;
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
        const meses = [...v.desglose].sort((a: any, b: any) => b.cobradoMM - a.cobradoMM);
        const mejor = meses[0];
        const flojo = meses[meses.length - 1];
        return `La cartera recaudó **${gs(v.cobradoMM)}** en ${c.etiquetaPeriodo}${c.plan ? ` (${nombrePlan[c.plan]})` : ""}, **${signo(v.variacionInteranualPct)}** frente al mismo período del año anterior (${gs(v.interanualMM)}). Hubo ${fmt(v.activos, 0)} socios activos y la efectividad de cobranza fue del ${fmt(v.efectividadCobranzaPct)}%.\n\n${tabla(
          ["Mes", "Cobrado", "Emitido", "Año anterior"],
          v.desglose.map((m: any) => [
            m.mes,
            gs(m.cobradoMM),
            gs(m.emitidoMM),
            gs(m.anioAnteriorMM),
          ]),
        )}\n\n**Cómo leer el gráfico:** son tres series. "Cobrado" es lo que entró, "Emitido" lo que correspondía cobrar y la punteada es el mismo mes del año anterior. La distancia entre las dos primeras es la mora del mes; que corran casi pegadas (${fmt(v.efectividadCobranzaPct)}% de efectividad) dice que la cobranza funciona y que el problema de mora está concentrado en pocos contratos, no repartido en toda la cartera.\n\nLa curva sube por dos motores distintos que conviene no confundir: entran socios nuevos (${fmt(v.altas, 0)} altas contra ${fmt(v.bajas, 0)} bajas en el período) y, sobre todo, cada entrega de torre pasa contratos de la cuota de espera a la de posesión, casi 3× mayor. El mejor mes fue **${mejor.mes}** (${gs(mejor.cobradoMM)}) y el más flojo **${flojo.mes}** (${gs(flojo.cobradoMM)}); esa diferencia es estacionalidad, no una caída de cartera.\n\nOjo con una lectura fácil: el crecimiento interanual de ${signo(v.variacionInteranualPct)} incluye el ajuste anual del aporte, así que no es todo crecimiento de socios. Para separar las dos cosas hay que mirar el neto de altas y bajas aparte.\n\n${ILUSTRATIVO}`;
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
