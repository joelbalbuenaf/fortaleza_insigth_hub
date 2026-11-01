// Alertas del Hub: qué requiere atención hoy. Todas se calculan sobre los datos, no hay ninguna
// escrita a mano. Mientras la cartera sea ilustrativa, todas van rotuladas como tales.
import { etiquetaPeriodo, ULTIMO_PERIODO } from "@/lib/data/periodos";
import { resumenAdjudicaciones, serieAdjudicaciones } from "./adjudicaciones";
import { estadoDeObra } from "./obra";
import { barriosSinPresencia, resumenMercado } from "./mercado";
import { cohortesDesercion, desercionPor, moraPorTramo, resumenRiesgo } from "./socios/mora";
import { mesesAtipicos, PERIODO_ACTUAL, porAsesor, resumenCartera } from "./socios/consultas";

export type Severidad = "alta" | "media" | "baja";
export type Area = "Cartera" | "Mora" | "Adjudicaciones" | "Obra" | "Mercado";

export type Alerta = {
  id: string;
  severidad: Severidad;
  area: Area;
  fuente: "publico" | "ilustrativo" | "mixto";
  titulo: string;
  detalle: string;
  /** Pregunta sugerida para profundizar con Fide. */
  pregunta: string;
  enlace: string;
};

const peso: Record<Severidad, number> = { alta: 0, media: 1, baja: 2 };
const n = (v: number, d = 1) => v.toLocaleString("es-PY", { maximumFractionDigits: d });
const signo = (v: number) => `${v > 0 ? "+" : ""}${n(v)}`;

export function detectarAlertas(): Alerta[] {
  const out: Alerta[] = [];
  const r = resumenCartera(PERIODO_ACTUAL);

  // ── Mora ────────────────────────────────────────────────────────────────────────────
  const tramos = moraPorTramo();
  const graves = tramos.filter((t) => t.riesgoDeCaida !== "bajo");
  const contratosGraves = graves.reduce((t, x) => t + x.contratos, 0);
  const sociosGraves = graves.reduce((t, x) => t + x.socios, 0);
  if (contratosGraves > 0)
    out.push({
      id: "mora-grave",
      severidad: contratosGraves > 150 ? "alta" : "media",
      area: "Mora",
      fuente: "ilustrativo",
      titulo: `${contratosGraves} contratos con 3 o más cuotas impagas`,
      detalle: `Saldo de Gs ${n(
        graves.reduce((t, x) => t + x.saldoMM, 0),
        0,
      )} MM en manos de ${sociosGraves} socios. A las ${7} cuotas el contrato se cae: es el grupo con menos chance de recuperarse solo.`,
      pregunta:
        "¿A qué socios en mora conviene contactar primero y cuánta recaudación está en juego?",
      enlace: "/soluciones/cartera-salud",
    });

  const riesgo = resumenRiesgo();
  const alto = riesgo.find((x) => x.nivel === "Alto");
  if (alto && alto.contratos > 0)
    out.push({
      id: "riesgo-alto",
      severidad: "media",
      area: "Mora",
      fuente: "ilustrativo",
      titulo: `${alto.contratos} contratos con riesgo alto de caerse del plan`,
      detalle: `Son el ${n(alto.contratosPct)}% de los activos, de ${alto.socios} socios distintos, y representan Gs ${n(alto.cuotaMensualMM, 0)} MM de cuota mensual. Atraso promedio: ${n(alto.atrasoPromedio)} cuotas.`,
      pregunta: "¿Qué factores explican el riesgo de deserción y dónde se concentra?",
      enlace: "/soluciones/cartera-salud",
    });

  // ── Deserción ───────────────────────────────────────────────────────────────────────
  const porCanal = desercionPor("canal");
  const peorCanal = porCanal[0];
  const mejorCanal = porCanal[porCanal.length - 1];
  if (peorCanal && mejorCanal && peorCanal.desercionPct > mejorCanal.desercionPct * 1.5)
    out.push({
      id: "desercion-canal",
      severidad: "media",
      area: "Cartera",
      fuente: "ilustrativo",
      titulo: `El canal ${peorCanal.clave} deserta ${n(peorCanal.desercionPct / Math.max(mejorCanal.desercionPct, 0.1))}× más que ${mejorCanal.clave}`,
      detalle: `${n(peorCanal.desercionPct)}% contra ${n(mejorCanal.desercionPct)}%. Las bajas del canal se caen en promedio a los ${peorCanal.mesesHastaLaBaja} meses.`,
      pregunta: "Compará la deserción por canal de alta y decime qué cambiarías en la venta.",
      enlace: "/cartera?tab=desercion",
    });

  const cohortes = cohortesDesercion().filter((c) => c.vivos12 !== null);
  const ultimaCohorte = cohortes[cohortes.length - 1];
  const previa = cohortes[cohortes.length - 2];
  if (ultimaCohorte && previa && ultimaCohorte.vivos12! < previa.vivos12! - 2)
    out.push({
      id: "cohorte-empeora",
      severidad: "media",
      area: "Cartera",
      fuente: "ilustrativo",
      titulo: `La cohorte ${ultimaCohorte.cohorte} retiene ${n(previa.vivos12! - ultimaCohorte.vivos12!)} puntos menos al año`,
      detalle: `${n(ultimaCohorte.vivos12!)}% sigue activo a los 12 meses, contra ${n(previa.vivos12!)}% de la cohorte ${previa.cohorte}.`,
      pregunta: "¿Cómo viene la retención por cohorte de alta?",
      enlace: "/cartera?tab=desercion",
    });

  // ── Cartera ─────────────────────────────────────────────────────────────────────────
  if (r.variacionInteranualPct !== null)
    out.push({
      id: "recaudacion",
      severidad: r.variacionInteranualPct < 0 ? "alta" : "baja",
      area: "Cartera",
      fuente: "ilustrativo",
      titulo: `Recaudación ${signo(r.variacionInteranualPct)}% interanual en Ene–Sep 2026`,
      detalle: `Gs ${n(r.cobradoMM, 0)} MM contra Gs ${n(r.interanualMM ?? 0, 0)} MM un año antes, con ${n(r.activos, 0)} socios activos y un crecimiento neto de ${r.crecimientoNeto} contratos.`,
      pregunta: "¿Qué explica la variación de la recaudación de este año?",
      enlace: "/cartera",
    });

  const asesores = porAsesor(PERIODO_ACTUAL);
  const cae = asesores.filter(
    (s) => s.variacionInteranualPct !== null && s.variacionInteranualPct < 10,
  );
  if (cae.length)
    out.push({
      id: "asesores-flojas",
      severidad: "baja",
      area: "Cartera",
      fuente: "ilustrativo",
      titulo: `${cae.length} asesor${cae.length === 1 ? "" : "es"} crece${cae.length === 1 ? "" : "n"} menos que la cartera`,
      detalle: `La cartera creció ${signo(r.variacionInteranualPct ?? 0)}%; ${cae
        .slice(0, 3)
        .map((s) => `${s.nombre} (${signo(s.variacionInteranualPct ?? 0)}%)`)
        .join(", ")}.`,
      pregunta: "Compará los asesores por recaudación, altas y mora.",
      enlace: "/cartera?tab=asesores",
    });

  for (const m of mesesAtipicos().slice(0, 1))
    out.push({
      id: `atipico-${m.periodo}`,
      severidad: "media",
      area: "Cartera",
      fuente: "ilustrativo",
      titulo: `${m.etiqueta}: recaudación ${signo(m.variacionInteranualPct)}% interanual`,
      detalle: `Gs ${n(m.cobradoMM, 0)} MM en el mes, fuera de lo habitual (z = ${n(m.z, 2)}).`,
      pregunta: `¿Qué pasó con la recaudación en ${m.etiqueta}?`,
      enlace: "/cartera?tab=estadistica",
    });

  // ── Obra ────────────────────────────────────────────────────────────────────────────
  const obras = estadoDeObra();
  const atrasadas = obras.filter((o) => o.estado === "Atrasada");
  if (atrasadas.length)
    out.push({
      id: "obra-atrasada",
      severidad: "alta",
      area: "Obra",
      fuente: "mixto",
      titulo: `${atrasadas.length} obra${atrasadas.length === 1 ? "" : "s"} atrasada${atrasadas.length === 1 ? "" : "s"} frente al cronograma`,
      detalle: `${atrasadas
        .map((o) => `${o.corto} (${n(o.desvioPuntos)} puntos, entrega ${o.anioEntrega})`)
        .join("; ")}. Los proyectos y sus años de entrega son públicos; el avance es ilustrativo.`,
      pregunta: "¿Cómo viene el avance de obra contra el cronograma y qué proyectos preocupan?",
      enlace: "/soluciones/obra",
    });

  const descalzadas = obras.filter((o) => o.calceMM < 0);
  if (descalzadas.length)
    out.push({
      id: "obra-calce",
      severidad: "media",
      area: "Obra",
      fuente: "ilustrativo",
      titulo: `${descalzadas.length} proyecto${descalzadas.length === 1 ? "" : "s"} con la obra por delante del fondeo`,
      detalle: `Faltarían Gs ${n(Math.abs(descalzadas.reduce((t, o) => t + o.calceMM, 0)), 0)} MM para cubrir lo ya ejecutado: ${descalzadas.map((o) => o.corto).join(", ")}.`,
      pregunta: "¿Los aportes alcanzan para el cronograma de obra comprometido?",
      enlace: "/soluciones/obra",
    });

  // ── Adjudicaciones ──────────────────────────────────────────────────────────────────
  const adj = resumenAdjudicaciones();
  if (adj.aniosParaVaciarLaCola !== null)
    out.push({
      id: "cola-adjudicacion",
      severidad: adj.aniosParaVaciarLaCola > 12 ? "media" : "baja",
      area: "Adjudicaciones",
      fuente: "ilustrativo",
      titulo: `${n(adj.elegiblesEnEspera, 0)} contratos elegibles esperando adjudicación`,
      detalle: `Al ritmo de ${n(adj.adjudicadosPorMes)} adjudicaciones por mes, la cola actual tardaría unos ${n(adj.aniosParaVaciarLaCola)} años. Es una división, no un plazo prometido: la cola crece con las altas y el ritmo depende de las obras.`,
      pregunta: "¿Cómo viene la cola de adjudicación y qué espera tienen los socios?",
      enlace: "/soluciones/adjudicaciones",
    });

  const serie = serieAdjudicaciones();
  const ultimo = serie[serie.length - 1];
  const previo = serie[serie.length - 2];
  if (ultimo && previo && ultimo.total < previo.total * 0.7)
    out.push({
      id: "adjudicaciones-bajan",
      severidad: "baja",
      area: "Adjudicaciones",
      fuente: "ilustrativo",
      titulo: `Las adjudicaciones de ${etiquetaPeriodo(ultimo.periodo)} cayeron a ${ultimo.total}`,
      detalle: `Contra ${previo.total} el mes anterior (${ultimo.sorteo} por sorteo y ${ultimo.licitacion} por licitación).`,
      pregunta: "¿Cómo vienen los actos de adjudicación mes a mes?",
      enlace: "/soluciones/adjudicaciones",
    });

  // ── Mercado ─────────────────────────────────────────────────────────────────────────
  const sinPresencia = barriosSinPresencia();
  if (sinPresencia.length)
    out.push({
      id: "barrios-sin-presencia",
      severidad: "baja",
      area: "Mercado",
      fuente: "ilustrativo",
      titulo: `${sinPresencia.length} barrios con competencia y sin proyectos de Fortaleza`,
      detalle: `Principales: ${sinPresencia
        .slice(0, 3)
        .map((b) => `${b.barrio} (${b.competencia} edificios)`)
        .join(", ")}. Competencia inventada para la demo.`,
      pregunta: "¿Dónde conviene buscar el próximo terreno?",
      enlace: "/soluciones/terrenos",
    });

  const mercado = resumenMercado();
  out.push({
    id: "precio-m2",
    severidad: "baja",
    area: "Mercado",
    fuente: "ilustrativo",
    titulo: `m² medio de Asunción en USD ${n(mercado.precioM2MedioUsd, 0)}`,
    detalle: `El barrio más caro es ${mercado.barrioMasCaro} (USD ${n(mercado.precioM2MaximoUsd, 0)}/m²). Absorción de ${n(mercado.absorcionAnualUnidades, 0)} unidades en 12 meses y ${n(mercado.mesesDeStock)} meses de stock.`,
    pregunta: "¿Cómo están los precios de m² por barrio?",
    enlace: "/mercado",
  });

  // Dato de contexto: hoy TODA la cartera es ilustrativa, y conviene que se vea.
  out.push({
    id: "datos-ilustrativos",
    severidad: "media",
    area: "Cartera",
    fuente: "ilustrativo",
    titulo: "La cartera de este Hub es ilustrativa",
    detalle: `Socios, aportes, mora, adjudicaciones y obra son supuestos generados para la demo (${etiquetaPeriodo(ULTIMO_PERIODO)} es el último mes). Lo único público es el catálogo de proyectos. Con la cartera real, las mismas pantallas y herramientas funcionan sin cambios.`,
    pregunta: "¿Qué análisis se podrían hacer con la cartera real que hoy no se pueden?",
    enlace: "/proyectos",
  });

  return out.sort((a, b) => peso[a.severidad] - peso[b.severidad]);
}
