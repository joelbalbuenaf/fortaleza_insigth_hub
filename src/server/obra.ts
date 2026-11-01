// Avance de obra y calce financiero por proyecto (solo servidor).
//
// La estructura es PÚBLICA (nombres, estado y año de entrega previsto, del sitio de Fortaleza);
// el avance, los costos y la asignación de aportes son ILUSTRATIVOS.
//
// El calce es la pregunta de fondo del negocio: los aportes de los socios financian la
// construcción, así que lo que importa no es sólo cuánto entra, sino si lo que entra alcanza
// para el cronograma de obra comprometido.
import {
  desplazar,
  etiquetaCorta,
  mesesEntre,
  periodos,
  rango,
  ULTIMO_PERIODO,
} from "@/lib/data/periodos";
import { proyectos, proyectosEnObra, type Proyecto } from "@/lib/data/proyectos";
import { crearAzar, entre, redondear } from "@/lib/data/random";
import { cobrado, contratos } from "./socios/datos";
import { serieMensualCartera } from "./socios/consultas";

const mm = (guaranies: number, d = 0) => redondear(guaranies / 1_000_000, d);

/** Costo de construcción por m², en guaraníes (ILUSTRATIVO). */
const COSTO_M2_GS = 6_800_000;
/** Qué proporción de lo recaudado va a obra; el resto es terreno, estructura comercial y gastos. */
export const PROPORCION_A_OBRA = 0.72;

export type EstadoObra = {
  id: string;
  nombre: string;
  corto: string;
  barrio: string;
  anioEntrega: number;
  pisos: number;
  unidades: number;
  m2Totales: number;
  /** Costo total estimado de la obra, en Gs MM. */
  costoMM: number;
  /** Avance de obra ejecutado, en %. */
  avancePct: number;
  /** Avance que correspondería según el cronograma, en %. */
  avancePlanPct: number;
  /** Diferencia en puntos: negativa = atrasada. */
  desvioPuntos: number;
  /** Aportes ya asignados a este proyecto, en Gs MM. */
  asignadoMM: number;
  /** Costo de lo ya ejecutado, en Gs MM. */
  ejecutadoMM: number;
  /** Asignado − ejecutado: positivo = fondeada; negativo = la obra va por delante del fondeo. */
  calceMM: number;
  /** Meses que faltan para la entrega prevista. */
  mesesRestantes: number;
  estado: "En plazo" | "Atención" | "Atrasada";
};

const m2De = (p: Proyecto) => p.tipologias.reduce((t, x) => t + x.unidades * x.m2, 0);

/**
 * Cronograma teórico: una obra de torre arranca despacio (fundaciones), acelera en estructura y
 * vuelve a frenar en terminaciones. Se modela con una curva S sobre los meses de obra.
 */
function avanceTeorico(fraccionTiempo: number) {
  const t = Math.max(0, Math.min(1, fraccionTiempo));
  return redondear((1 / (1 + Math.exp(-10 * (t - 0.5)))) * 100, 1);
}

/** Meses de obra de una torre, según su cantidad de pisos. */
const mesesDeObra = (pisos: number) => Math.round(26 + pisos * 0.9);

const costoDe = (p: Proyecto) => m2De(p) * COSTO_M2_GS;
/** Ventana de obra de un proyecto: desde que arranca hasta la entrega (diciembre del año). */
function ventanaDeObra(p: Proyecto) {
  const fin = `${p.anio}-12`;
  return { inicio: desplazar(fin, -mesesDeObra(p.pisos)), fin };
}

/** Cuánto de su costo consume una obra en un mes dado de su cronograma, en guaraníes. */
function costoDelMes(costo: number, meses: number, mesDeObra: number) {
  const antes = avanceTeorico((mesDeObra - 1) / meses);
  const ahora = avanceTeorico(mesDeObra / meses);
  return (costo * (ahora - antes)) / 100;
}

/** Cuánto puede adelantarse el fondeo respecto del ritmo del cronograma. */
const ADELANTO_MAXIMO = 1.2;

/**
 * Reparte, mes a mes, la plata que va a obra entre los proyectos que estaban EN CONSTRUCCIÓN ese
 * mes, al ritmo en que el cronograma la consume.
 *
 * Tres cosas que el modelo tiene que respetar, y que fueron apareciendo de a una:
 *
 *  - **Mensual, no sobre el acumulado.** En el calendario Fortaleza entregó cuatro torres, y esa
 *    obra también se pagó con estos aportes. Repartir todo lo recaudado entre las cinco torres
 *    que siguen en obra les asignaba plata ya gastada y dejaba el calce positivo por
 *    construcción, o sea sin significado.
 *  - **Al ritmo del cronograma.** Una obra no absorbe plata más rápido de lo que la gasta: en
 *    cada mes puede tomar hasta lo que su curva de avance consume ese mes, con un adelanto
 *    acotado. Sin esto, una torre que entrega en 2029 y está 5% construida aparecía 96% fondeada.
 *  - **Con tope por costo.** A una obra nunca se le asigna más que lo que cuesta.
 *
 * Lo que ningún proyecto absorbe va a `reserva`: en el negocio es lo que financia los terrenos y
 * las torres que todavía no arrancaron.
 */
function asignacionPorProyecto(hasta: string) {
  const ventanas = proyectos.map((p) => ({
    id: p.id,
    costo: costoDe(p),
    meses: mesesDeObra(p.pisos),
    ...ventanaDeObra(p),
  }));
  const asignado = new Map<string, number>(proyectos.map((p) => [p.id, 0]));
  let reserva = 0;

  for (const periodo of rango(periodos[0]!, hasta)) {
    let disponible = contratos.reduce((t, s) => t + cobrado(s, periodo), 0) * PROPORCION_A_OBRA;
    if (disponible <= 0) continue;

    // Cupo del mes de cada obra activa: lo que su cronograma consume, más el adelanto permitido.
    const cupos = ventanas
      .filter((v) => v.inicio <= periodo && periodo <= v.fin)
      .map((v) => {
        const mesDeObra = mesesEntre(v.inicio, periodo) + 1;
        const porCronograma = costoDelMes(v.costo, v.meses, mesDeObra) * ADELANTO_MAXIMO;
        const porCosto = v.costo - (asignado.get(v.id) ?? 0);
        return { id: v.id, cupo: Math.max(0, Math.min(porCronograma, porCosto)) };
      })
      .filter((x) => x.cupo > 1);

    const cupoTotal = cupos.reduce((t, x) => t + x.cupo, 0);
    if (cupoTotal > 0) {
      const reparto = Math.min(disponible, cupoTotal);
      for (const { id, cupo } of cupos)
        asignado.set(id, (asignado.get(id) ?? 0) + (reparto * cupo) / cupoTotal);
      disponible -= reparto;
    }
    reserva += disponible;
  }
  return { asignado, reserva };
}

export function estadoDeObra(hasta = ULTIMO_PERIODO): EstadoObra[] {
  const { asignado } = asignacionPorProyecto(hasta);

  return proyectosEnObra.map((p) => {
    const azar = crearAzar(`obra-${p.id}`);
    const m2 = m2De(p);
    const costo = costoDe(p);
    const meses = mesesDeObra(p.pisos);
    // La entrega prevista es en diciembre del año publicado.
    const finPrevisto = `${p.anio}-12`;
    const mesesRestantes = mesesEntre(hasta, finPrevisto);
    const transcurridos = meses - mesesRestantes;
    const plan = avanceTeorico(transcurridos / meses);
    // Desvío propio de cada obra: algunas van bien, otras se atrasan.
    const desvio = entre(azar, -11, 5);
    const avance = redondear(Math.max(0, Math.min(100, plan + desvio)), 1);

    const asignadoAlProyecto = asignado.get(p.id) ?? 0;
    const ejecutado = (costo * avance) / 100;
    const calce = asignadoAlProyecto - ejecutado;
    const desvioPuntos = redondear(avance - plan, 1);

    return {
      id: p.id,
      nombre: p.nombre,
      corto: p.corto,
      barrio: p.barrio,
      anioEntrega: p.anio,
      pisos: p.pisos,
      unidades: p.unidades,
      m2Totales: m2,
      costoMM: mm(costo),
      avancePct: avance,
      avancePlanPct: plan,
      desvioPuntos,
      asignadoMM: mm(asignadoAlProyecto),
      ejecutadoMM: mm(ejecutado),
      calceMM: mm(calce),
      mesesRestantes,
      estado: desvioPuntos <= -8 ? "Atrasada" : desvioPuntos <= -3 ? "Atención" : "En plazo",
    };
  });
}

/** Resumen de la obra en curso. */
export function resumenObra(hasta = ULTIMO_PERIODO) {
  const obras = estadoDeObra(hasta);
  const { reserva } = asignacionPorProyecto(hasta);
  const costo = obras.reduce((t, o) => t + o.costoMM, 0);
  const asignado = obras.reduce((t, o) => t + o.asignadoMM, 0);
  const ejecutado = obras.reduce((t, o) => t + o.ejecutadoMM, 0);
  return {
    fuente: "mixto" as const,
    proyectosEnObra: obras.length,
    unidadesEnObra: obras.reduce((t, o) => t + o.unidades, 0),
    costoTotalMM: costo,
    asignadoMM: asignado,
    ejecutadoMM: ejecutado,
    calceMM: redondear(asignado - ejecutado, 0),
    /** Aportes que la obra en curso no absorbe: financian terrenos y proyectos por arrancar. */
    reservaMM: mm(reserva),
    avanceMedioPct: obras.length
      ? redondear(obras.reduce((t, o) => t + o.avancePct, 0) / obras.length, 1)
      : 0,
    atrasadas: obras.filter((o) => o.estado === "Atrasada").length,
    enAtencion: obras.filter((o) => o.estado === "Atención").length,
    /** Entregadas según el catálogo público del sitio. */
    entregadas: proyectos.filter((p) => p.estado === "Entregado").length,
  };
}

/**
 * Proyección de caja de obra: lo que entraría por aportes contra lo que habría que ejecutar en
 * los próximos meses. No es un flujo de fondos auditado; es una referencia para ver si el ritmo
 * de recaudación acompaña el cronograma.
 */
export function proyeccionCaja(meses = 12) {
  const serie = serieMensualCartera({
    desde: periodos[Math.max(0, periodos.length - 6)]!,
    hasta: ULTIMO_PERIODO,
  });
  // Ritmo reciente de recaudación mensual que va a obra.
  const ritmo = serie.length
    ? (serie.reduce((t, m) => t + m.cobradoMM, 0) / serie.length) * PROPORCION_A_OBRA
    : 0;
  const obras = estadoDeObra();
  let acumulado = obras.reduce((t, o) => t + o.calceMM, 0);

  return Array.from({ length: meses }, (_, k) => {
    // Lo que habría que ejecutar el mes k+1 según el cronograma de cada obra.
    const necesario = obras.reduce((t, o) => {
      const total = mesesDeObra(o.pisos);
      const transcurridos = total - o.mesesRestantes + k + 1;
      const antes = avanceTeorico((transcurridos - 1) / total);
      const ahora = avanceTeorico(transcurridos / total);
      return t + (o.costoMM * (ahora - antes)) / 100;
    }, 0);
    acumulado += ritmo - necesario;
    const periodo = desplazar(ULTIMO_PERIODO, k + 1);
    return {
      periodo,
      mes: etiquetaCorta(periodo),
      numero: k + 1,
      ingresoObraMM: redondear(ritmo, 0),
      necesarioMM: redondear(necesario, 0),
      saldoMM: redondear(acumulado, 0),
    };
  });
}

/** Unidades por proyecto, con su estado. Estructura pública, cantidades ilustrativas. */
export function unidadesPorProyecto() {
  return proyectos.map((p) => ({
    id: p.id,
    nombre: p.corto,
    completo: p.nombre,
    barrio: p.barrio,
    anio: p.anio,
    estado: p.estado,
    unidades: p.unidades,
    pisos: p.pisos,
    m2: m2De(p),
  }));
}

/** Mix de unidades por tipología en todo el catálogo. */
export function mixTipologias() {
  const mapa = new Map<string, { unidades: number; m2: number }>();
  for (const p of proyectos)
    for (const t of p.tipologias) {
      const actual = mapa.get(t.tipologia) ?? { unidades: 0, m2: t.m2 };
      mapa.set(t.tipologia, { unidades: actual.unidades + t.unidades, m2: t.m2 });
    }
  const total = [...mapa.values()].reduce((t, v) => t + v.unidades, 0);
  return [...mapa.entries()].map(([tipologia, v]) => ({
    tipologia,
    nombre: tipologia,
    unidades: v.unidades,
    m2: v.m2,
    participacionPct: total ? redondear((v.unidades / total) * 100, 1) : 0,
  }));
}
