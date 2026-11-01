// Cartera del Sistema de Ahorro Fortaleza. Datos ILUSTRATIVOS generados con un PRNG sembrado:
// las mismas cifras en servidor, cliente y tests.
//
// Vive en src/server/ a propósito. Hoy no hay datos reales, pero cuando lleguen van a ser datos
// personales (nombre, mora, saldo) y la import-protection de Vite ya impide que este módulo
// llegue al JavaScript del navegador: el build falla si un componente lo importa sin `import type`.
//
// ── El modelo ─────────────────────────────────────────────────────────────────────────
//
// La unidad es el CONTRATO, no la persona: un socio puede tener varios. Cada contrato aporta una
// cuota mensual que fija la administradora y que depende de UNA sola cosa, su situación:
//
//   En espera    → aporta APORTE_ESPERA    y todavía no salió adjudicado
//   Adjudicado   → salió adjudicado por sorteo o licitación, y espera la entrega de su torre
//   Con posesión → recibió la unidad; su aporte pasa a APORTE_POSESION (hoy, 3× más)
//
// La situación es independiente del ESTADO DE PAGO (al día / en mora / baja). Antes estaban
// mezclados en un solo campo y "Adjudicado" pisaba a "En mora", así que la mora de los
// adjudicados no se contaba en ningún indicador.
//
// Tres series paralelas por contrato, para que la mora sea auditable y no una etiqueta pegada:
//   emitido[i]  cuota que correspondía ese mes
//   cobrado[i]  lo que efectivamente entró (0 = mes impago; más que la cuota = regularización)
//   atraso[i]   cuotas impagas pendientes al cierre de ese mes
// Un mes impago no condena al contrato: la mayoría regulariza en los meses siguientes, y el
// atraso sostenido (siete cuotas) lo hace caer.
//
// Ojo con medir la mora como "emitido − cobrado" sobre una ventana: las regularizaciones de meses
// anteriores caen dentro de la ventana y la dejan casi en cero. La mora se mide sobre el SALDO
// pendiente al cierre (serie `atraso`), que es lo que mora.ts calcula.
import {
  APORTE_ESPERA,
  APORTE_POSESION,
  asesores,
  type Canal,
  type Plan,
  type Situacion,
} from "@/lib/data/filtros";
import { barrios } from "@/lib/data/geografia";
import {
  anioDe,
  desplazar,
  indiceDePeriodo,
  mesesEntre,
  periodos,
  PRIMER_PERIODO,
  ULTIMO_PERIODO,
} from "@/lib/data/periodos";
import { proyectos } from "@/lib/data/proyectos";
import { crearAzar, entre, type Azar } from "@/lib/data/random";

export const FUENTE_CARTERA = "Cartera ilustrativa · Sistema de Ahorro Fortaleza";

export type EstadoPago = "Al día" | "En mora" | "Finalizado" | "Baja";
export type ViaAdjudicacion = "Sorteo" | "Licitación";

export type Contrato = {
  /** Número de contrato: la cartera se identifica por contrato, nunca por nombre. */
  contrato: string;
  /** Persona titular. Un socio puede tener varios contratos. */
  socioId: string;
  plan: Plan;
  /** Asesor que lo atiende, por código. */
  asesor: string;
  canal: Canal;
  barrio: string;
  /** Período de alta (AAAA-MM); puede ser anterior al calendario. */
  alta: string;
  /** Cuotas del plan (240 = 20 años). */
  cuotasPlan: number;
  /** Puntos de beneficios: una cuota paga, un punto. Suman a la oferta licitatoria. */
  puntos: number;
  /** Aportes pagados antes del calendario, en guaraníes (los contratos viejos traen su historia). */
  pagadoPrevio: number;
  /** Período de adjudicación, o null si sigue en espera. */
  adjudicado: string | null;
  via: ViaAdjudicacion | null;
  /** Proyecto de la unidad adjudicada (id del catálogo público). */
  proyecto: string | null;
  /** Período en que toma posesión: la entrega de su torre. */
  posesion: string | null;
  /** Período en que se dio de baja, o null. */
  baja: string | null;
  emitido: (number | null)[];
  cobrado: (number | null)[];
  atraso: (number | null)[];
};

// ── Parámetros del generador (todos ilustrativos) ──────────────────────────────────────

const ALTAS_POR_MES = 95;
/** Estacionalidad de las altas: flojo en enero y julio, fuerte en marzo y octubre. */
const ESTACIONALIDAD_ALTAS = [0.72, 0.95, 1.22, 1.1, 1.05, 0.9, 0.78, 1.0, 1.12, 1.25, 1.15, 0.86];
/** Contratos que ya venían de antes de Ene 2022 (el sistema arrancó en 1992). */
const CONTRATOS_HISTORICOS = 2600;
/** Atraso que hace caer el contrato: siete cuotas impagas pendientes. */
export const ATRASO_LIMITE = 7;
/** Ajuste anual del aporte. */
export const AJUSTE_ANUAL = 0.085;

const PESO_PLAN: Record<Plan, number> = { Amplia: 42, "Plan 20": 50, Adicional: 8 };
const CUOTAS_PLAN: Record<Plan, number> = { Amplia: 180, "Plan 20": 240, Adicional: 120 };
const PESO_CANAL: Record<Canal, number> = {
  Oficina: 46,
  Web: 18,
  Referido: 20,
  "App Fideliza": 11,
  Eventos: 5,
};
/** Cuántos contratos tiene un socio: la mayoría uno, algunos más. */
const CONTRATOS_POR_SOCIO = [
  { cantidad: 1, peso: 76 },
  { cantidad: 2, peso: 16 },
  { cantidad: 3, peso: 6 },
  { cantidad: 4, peso: 2 },
];

function elegirPonderado<T extends string>(azar: Azar, pesos: Record<T, number>): T {
  const entradas = Object.entries(pesos) as [T, number][];
  const total = entradas.reduce((s, [, w]) => s + w, 0);
  let r = azar() * total;
  for (const [k, w] of entradas) {
    r -= w;
    if (r <= 0) return k;
  }
  return entradas[entradas.length - 1]![0];
}

const pesosBarrio = Object.fromEntries(barrios.map((b) => [b.nombre, b.peso])) as Record<
  string,
  number
>;

/**
 * Aporte del mes según la situación del contrato. Lo fija la administradora, así que no depende
 * del socio, del plan ni del barrio. Los valores son los vigentes; para los meses anteriores se
 * deflactan con el ajuste anual, que se aplica en enero.
 */
export function aporteDelMes(periodo: string, conPosesion: boolean) {
  const base = conPosesion ? APORTE_POSESION : APORTE_ESPERA;
  const anios = anioDe(ULTIMO_PERIODO) - anioDe(periodo);
  return Math.round(base / (1 + AJUSTE_ANUAL) ** anios / 1000) * 1000;
}

/**
 * Perfil de pago del contrato. La población es BIMODAL a propósito: la gran mayoría paga casi
 * todos los meses, y una minoría irregular arrastra atrasos y concentra la mora. Con una sola
 * distribución (todos "bastante cumplidores") la mora del agregado queda irrealmente cerca de
 * cero, porque las regularizaciones tapan los impagos mes a mes.
 */
const PROPORCION_IRREGULARES = 0.13;

function perfilDe(azar: Azar, canal: Canal) {
  const irregular = azar() < PROPORCION_IRREGULARES;
  const porCanal = canal === "Referido" || canal === "Oficina" ? 0.01 : -0.012;
  return irregular
    ? // Paga 3 de cada 4 meses y regulariza con desgano: acumula atraso.
      { pagaProb: Math.min(0.93, 0.74 + azar() * 0.1 + porCanal), regularizaProb: 0.3 }
    : // Paga casi siempre y, si falla un mes, lo cubre enseguida.
      { pagaProb: Math.min(0.999, 0.975 + azar() * 0.023 + porCanal), regularizaProb: 0.78 };
}

/**
 * Riesgo de abandonar el plan en un mes dado. El primer año concentra la deserción, el atraso la
 * dispara, y quien ya tiene la unidad casi no se va: tiene mucho más que perder.
 */
function riesgoBaja(
  plan: Plan,
  canal: Canal,
  mesesDesdeAlta: number,
  atraso: number,
  situacion: Situacion,
): number {
  const base = mesesDesdeAlta <= 12 ? 0.009 : mesesDesdeAlta <= 36 ? 0.0035 : 0.0014;
  const porPlan = plan === "Amplia" ? 1.3 : plan === "Adicional" ? 1.1 : 1;
  const porCanal =
    canal === "Web" ? 1.4 : canal === "Eventos" ? 1.25 : canal === "Referido" ? 0.7 : 1;
  const porSituacion = situacion === "Con posesión" ? 0.25 : situacion === "Adjudicado" ? 0.5 : 1;
  return base * porPlan * porCanal * porSituacion * (1 + atraso * 0.9);
}

// ── Adjudicaciones ─────────────────────────────────────────────────────────────────────
// Dos mecanismos, tal como los describe Fortaleza en su sitio:
//   - SORTEO: se extrae una bolilla de cada contenedor para formar el número de contrato, así
//     que todos los contratos al día tienen la misma probabilidad, sin importar su antigüedad.
//   - LICITACIÓN: se abren los sobres ante escribano y gana la mejor oferta, que combina los
//     pagos realizados con los puntos de beneficios.
// La unidad adjudicada sale del catálogo público: cada acto consume unidades de la torre más
// próxima a entregarse que todavía tenga disponibles. Por eso las adjudicaciones de un proyecto
// nunca pueden superar sus unidades, y la posesión llega recién con la entrega de esa torre.

const ADJUDICACIONES_POR_MES = 17;
/** Del total mensual, cuánto se asigna por sorteo (el resto va a licitación). */
export const PROPORCION_SORTEO = 0.55;
/** Cuánto vale un punto de beneficios dentro de la oferta licitatoria, en guaraníes. */
export const VALOR_PUNTO = 220_000;
/** Antigüedad mínima para entrar al acto. */
export const ANTIGUEDAD_MINIMA = 6;

/** Entrega de un proyecto: diciembre del año que publica el catálogo. */
const entregaDe = (id: string) => {
  const p = proyectos.find((x) => x.id === id);
  return p ? `${p.anio}-12` : null;
};

type Cupo = { id: string; entrega: string; disponibles: number };

/** Unidades disponibles por torre, de la más próxima a entregarse a la más lejana. */
function cuposDelCatalogo(): Cupo[] {
  return proyectos
    .map((p) => ({ id: p.id, entrega: `${p.anio}-12`, disponibles: p.unidades }))
    .sort((a, b) => a.entrega.localeCompare(b.entrega));
}

/** Torre más próxima a entregarse que todavía tenga unidades, a partir del período dado. */
function tomarUnidad(cupos: Cupo[], desde: string): Cupo | null {
  const cupo = cupos.find((c) => c.disponibles > 0 && c.entrega >= desde);
  if (!cupo) return null;
  cupo.disponibles--;
  return cupo;
}

function construirCartera(): Contrato[] {
  const azar = crearAzar("cartera-fortaleza");
  const out: Contrato[] = [];
  const cupos = cuposDelCatalogo();
  let nContrato = 1;
  let nSocio = 1;

  const nuevoContrato = (socioId: string, alta: string, antiguo: boolean): Contrato => {
    const plan = elegirPonderado(azar, PESO_PLAN);
    return {
      contrato: `F-${String(100000 + nContrato++)}`,
      socioId,
      plan,
      asesor: asesores[Math.floor(azar() * asesores.length)]!,
      canal: antiguo ? "Oficina" : elegirPonderado(azar, PESO_CANAL),
      barrio: elegirPonderado(azar, pesosBarrio),
      alta,
      cuotasPlan: CUOTAS_PLAN[plan],
      puntos: 0,
      pagadoPrevio: 0,
      adjudicado: null,
      via: null,
      proyecto: null,
      posesion: null,
      baja: null,
      emitido: periodos.map(() => null),
      cobrado: periodos.map(() => null),
      atraso: periodos.map(() => null),
    };
  };

  /** Una persona con sus contratos: todos comparten asesor y barrio, que son de la persona. */
  const nuevoSocio = (alta: string, antiguo: boolean): Contrato[] => {
    const socioId = `S-${String(10000 + nSocio++)}`;
    const cuantos = elegirPonderado(
      azar,
      Object.fromEntries(CONTRATOS_POR_SOCIO.map((c) => [String(c.cantidad), c.peso])),
    );
    const primero = nuevoContrato(socioId, alta, antiguo);
    const lista = [primero];
    for (let k = 1; k < Number(cuantos); k++) {
      const extra = nuevoContrato(socioId, alta, antiguo);
      extra.asesor = primero.asesor;
      extra.barrio = primero.barrio;
      extra.canal = primero.canal;
      lista.push(extra);
    }
    return lista;
  };

  // Cartera previa al calendario. Los más antiguos ya salieron adjudicados hace años y viven en
  // torres entregadas: son los que hoy aportan el valor de posesión.
  const historicos: Contrato[] = [];
  while (historicos.length < CONTRATOS_HISTORICOS) {
    const mesesAtras = Math.floor(entre(azar, 1, 150));
    for (const c of nuevoSocio(desplazar(PRIMER_PERIODO, -mesesAtras), true)) {
      // Su historia previa: cuotas pagadas (con alguna impaga) y los puntos que eso le dio.
      const pagadasPrevias = Math.round(mesesAtras * entre(azar, 0.84, 1));
      c.puntos = pagadasPrevias;
      c.pagadoPrevio = Math.round(pagadasPrevias * aporteDelMes(c.alta, false));
      // Cuanto más antiguo, más chance de haber salido adjudicado antes del calendario.
      //
      // Estos NO consumen unidades del catálogo: sus torres se entregaron hace años y en muchos
      // casos ni figuran por nombre en el sitio, que informa 17 proyectos entregados mientras
      // nombra 12. Si gastaran cupo, el catálogo se agotaba y las adjudicaciones del calendario
      // se cortaban a mitad de camino. Por eso quedan sin `proyecto`.
      if (azar() < Math.min(0.8, mesesAtras / 150)) {
        c.adjudicado = desplazar(c.alta, Math.floor(entre(azar, 6, Math.max(7, mesesAtras))));
        c.via = azar() < PROPORCION_SORTEO ? "Sorteo" : "Licitación";
        // Entre la adjudicación y la entrega pasaban dos o tres años.
        c.posesion = desplazar(c.adjudicado, Math.floor(entre(azar, 24, 40)));
      }
      historicos.push(c);
    }
  }
  out.push(...historicos);

  periodos.forEach((periodo, i) => {
    const cantidad = Math.round(
      ALTAS_POR_MES *
        (1 + (i / periodos.length) * 0.55) *
        (ESTACIONALIDAD_ALTAS[Number(periodo.slice(5, 7)) - 1] ?? 1) *
        entre(azar, 0.88, 1.12),
    );
    let creados = 0;
    while (creados < cantidad) {
      const lista = nuevoSocio(periodo, false);
      out.push(...lista);
      creados += lista.length;
    }
  });

  recorrerCalendario(out, azar, cupos);
  return out;
}

/**
 * Recorre el calendario mes a mes sobre toda la cartera: emite la cuota que corresponde a la
 * situación de cada contrato, cobra, y al final del mes corre el acto de adjudicación.
 *
 * Tiene que ser un solo recorrido por mes y no uno por contrato: la adjudicación cambia la cuota
 * desde la entrega en adelante, y la elegibilidad del acto depende del atraso de ese mes. Son
 * mutuamente dependientes, así que el orden del calendario es el único que cierra.
 */
function recorrerCalendario(lista: Contrato[], azar: Azar, cupos: Cupo[]) {
  const estado = lista.map((c) => {
    const azarContrato = crearAzar(`contrato-${c.contrato}`);
    return { c, azar: azarContrato, ...perfilDe(azarContrato, c.canal), atraso: 0, activo: true };
  });

  periodos.forEach((periodo, i) => {
    for (const e of estado) {
      if (!e.activo || e.c.alta > periodo) continue;
      const mesesDesdeAlta = mesesEntre(e.c.alta, periodo) + 1;
      if (mesesDesdeAlta > e.c.cuotasPlan) {
        e.activo = false; // plan cumplido
        continue;
      }
      const situacion = situacionDe(e.c, periodo);
      if (e.azar() < riesgoBaja(e.c.plan, e.c.canal, mesesDesdeAlta, e.atraso, situacion)) {
        e.c.baja = periodo;
        e.activo = false;
        continue;
      }

      const cuota = aporteDelMes(periodo, situacion === "Con posesión");
      e.c.emitido[i] = cuota;

      if (e.azar() < e.pagaProb) {
        // Paga la del mes y, si arrastra atraso, puede regularizar una cuota más. La cuota vieja
        // se paga al valor VIGENTE, no al de entonces: por eso el dinero cobrado de un contrato
        // puede superar al emitido, aunque la cantidad de cuotas pagadas nunca lo haga.
        const regulariza = e.atraso > 0 && e.azar() < e.regularizaProb ? 1 : 0;
        e.c.cobrado[i] = cuota * (1 + regulariza);
        e.atraso -= regulariza;
        e.c.puntos += 1;
      } else {
        e.c.cobrado[i] = 0;
        e.atraso += 1;
      }
      e.c.atraso[i] = e.atraso;
      if (e.atraso >= ATRASO_LIMITE) {
        e.c.baja = periodo;
        e.activo = false;
      }
    }

    adjudicarEnElMes(lista, periodo, i, azar, cupos);
  });
}

/** Oferta licitatoria de un contrato: pagos realizados + puntos de beneficios. */
export function ofertaLicitatoria(c: Contrato, hasta: string) {
  return c.pagadoPrevio + cobradoEnRango(c, PRIMER_PERIODO, hasta) + c.puntos * VALOR_PUNTO;
}

/** ¿Puede entrar al acto de adjudicación de este mes? */
export function esElegible(c: Contrato, periodo: string) {
  return (
    !c.adjudicado &&
    !(c.baja && c.baja <= periodo) &&
    c.alta <= periodo &&
    atrasoAl(c, periodo) === 0 &&
    antiguedadMeses(c, periodo) >= ANTIGUEDAD_MINIMA
  );
}

function adjudicarEnElMes(
  lista: Contrato[],
  periodo: string,
  i: number,
  azar: Azar,
  cupos: Cupo[],
) {
  const elegibles = lista.filter((c) => esElegible(c, periodo));
  if (!elegibles.length) return;

  const total = Math.round(
    ADJUDICACIONES_POR_MES * (1 + (i / periodos.length) * 0.8) * entre(azar, 0.85, 1.15),
  );
  const porSorteo = Math.round(total * PROPORCION_SORTEO);

  const asignar = (c: Contrato, via: ViaAdjudicacion) => {
    const cupo = tomarUnidad(cupos, periodo);
    if (!cupo) return false; // sin unidades disponibles no hay acto
    c.adjudicado = periodo;
    c.via = via;
    c.proyecto = cupo.id;
    c.posesion = cupo.entrega > periodo ? cupo.entrega : periodo;
    return true;
  };

  let asignados = 0;
  const sorteados = new Set<string>();
  for (let k = 0; k < porSorteo && sorteados.size < elegibles.length; k++) {
    const c = elegibles[Math.floor(azar() * elegibles.length)]!;
    if (sorteados.has(c.contrato)) continue;
    sorteados.add(c.contrato);
    if (!asignar(c, "Sorteo")) return;
    asignados++;
  }

  const porLicitacion = Math.max(0, total - asignados);
  const candidatos = elegibles
    .filter((c) => !c.adjudicado)
    .map((c) => ({ c, oferta: ofertaLicitatoria(c, periodo) }))
    .sort((a, b) => b.oferta - a.oferta)
    .slice(0, porLicitacion);
  for (const { c } of candidatos) if (!asignar(c, "Licitación")) return;
}

// ── Utilidades de lectura ──────────────────────────────────────────────────────────────
// Declaraciones de función a propósito: el recorrido del calendario corre mientras se construye
// el módulo y necesita estas utilidades antes de que se evalúe cualquier `const` de más abajo.

export function cobrado(c: Contrato, periodo: string) {
  return c.cobrado[indiceDePeriodo(periodo)] ?? 0;
}

export function emitido(c: Contrato, periodo: string) {
  return c.emitido[indiceDePeriodo(periodo)] ?? 0;
}

function sumarRango(serie: (number | null)[], desde: string, hasta: string) {
  let total = 0;
  for (let i = Math.max(0, indiceDePeriodo(desde)); i <= indiceDePeriodo(hasta); i++)
    total += serie[i] ?? 0;
  return total;
}

export function cobradoEnRango(c: Contrato, desde: string, hasta: string) {
  return sumarRango(c.cobrado, desde, hasta);
}

export function emitidoEnRango(c: Contrato, desde: string, hasta: string) {
  return sumarRango(c.emitido, desde, hasta);
}

/** Cuotas impagas pendientes al cierre del período (0 = al día). */
export function atrasoAl(c: Contrato, hasta: string) {
  const fin = Math.min(indiceDePeriodo(hasta), periodos.length - 1);
  for (let i = fin; i >= 0; i--) {
    const a = c.atraso[i];
    if (a !== null && a !== undefined) return a;
  }
  return 0;
}

/** Cuotas emitidas y pagadas dentro del calendario, hasta el período dado. */
export function cuotasDe(c: Contrato, hasta: string) {
  const fin = Math.min(indiceDePeriodo(hasta), periodos.length - 1);
  let emitidas = 0;
  let pagadas = 0;
  for (let i = Math.max(0, indiceDePeriodo(c.alta)); i <= fin; i++) {
    const e = c.emitido[i];
    if (e === null || e === undefined) continue;
    emitidas++;
    if ((c.cobrado[i] ?? 0) > 0) pagadas++;
  }
  return { emitidas, pagadas };
}

/** Antigüedad en meses al cierre del período (cuenta también los años previos al calendario). */
export function antiguedadMeses(c: Contrato, hasta: string) {
  return Math.max(0, mesesEntre(c.alta, hasta) + 1);
}

/** Último mes en que el plan emite cuota: después, el contrato terminó de pagar. */
export function finDelPlan(c: Contrato) {
  return desplazar(c.alta, c.cuotasPlan - 1);
}

/** Ya pasó la última cuota del plan: en `finDelPlan` todavía se emite, después no. */
export function planFinalizado(c: Contrato, hasta: string) {
  return finDelPlan(c) < hasta;
}

/**
 * Activo = está en la cartera, aporta y se le puede cobrar.
 *
 * Quedan afuera los que se dieron de baja y los que ya completaron su plan: un contrato de 180
 * cuotas que empezó en 2011 terminó de pagar y no es parte de la base que aporta este mes.
 * Contarlo como activo infla el padrón y hunde la cuota media. La excepción es el que terminó
 * el plan debiendo: sigue activo mientras arrastre cuotas impagas, porque esa deuda es cobrable
 * y tiene que seguir apareciendo en la mora.
 */
export function esActivo(c: Contrato, hasta: string) {
  if (c.alta > hasta || (c.baja && c.baja <= hasta)) return false;
  return !planFinalizado(c, hasta) || atrasoAl(c, hasta) > 0;
}

/**
 * Situación del contrato: dónde está en el camino hacia su unidad. Es independiente del estado
 * de pago, así que un contrato con posesión también puede estar en mora.
 */
export function situacionDe(c: Contrato, hasta: string): Situacion {
  if (c.posesion && c.posesion <= hasta) return "Con posesión";
  if (c.adjudicado && c.adjudicado <= hasta) return "Adjudicado";
  return "En espera";
}

/** Estado de pago, independiente de la situación. */
export function estadoDePagoDe(c: Contrato, hasta: string): EstadoPago {
  if (c.baja && c.baja <= hasta) return "Baja";
  // La mora va antes que el final del plan: terminar de pagar debiendo cuotas no borra la deuda.
  if (atrasoAl(c, hasta) >= 1) return "En mora";
  return planFinalizado(c, hasta) ? "Finalizado" : "Al día";
}

/** Entrega prevista de la torre adjudicada, para los que esperan posesión. */
export function entregaPrevista(c: Contrato) {
  return c.proyecto ? entregaDe(c.proyecto) : null;
}

export const contratos: Contrato[] = construirCartera();

/** Personas distintas con al menos un contrato activo. */
export function sociosActivos(hasta: string) {
  return new Set(contratos.filter((c) => esActivo(c, hasta)).map((c) => c.socioId)).size;
}
