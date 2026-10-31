// Cartera de socios del Sistema de Ahorro Fortaleza. Datos ILUSTRATIVOS generados con un PRNG
// sembrado: las mismas cifras en servidor, cliente y tests.
//
// Vive en src/server/ a propósito. Hoy no hay datos reales, pero cuando lleguen van a ser datos
// personales (nombre, mora, saldo) y la import-protection de Vite ya impide que este módulo
// llegue al JavaScript del navegador: el build falla si un componente lo importa sin `import type`.
//
// Modelo del negocio (público, del sitio de Fortaleza): el socio aporta una cuota mensual fija
// que financia la construcción; la unidad se adjudica por sorteo o licitación, con un plazo
// máximo de 20 años. Mientras no se adjudica, el socio solo aporta.
//
// Tres series paralelas por socio, para que la mora sea auditable y no una etiqueta pegada:
//   emitido[i]  cuota que correspondía ese mes
//   cobrado[i]  lo que efectivamente entró (0 = mes impago; más que la cuota = regularización)
//   atraso[i]   cuotas impagas pendientes al cierre de ese mes
// Un mes impago no condena al socio: la mayoría regulariza en los meses siguientes, y el atraso
// sostenido (siete cuotas) hace caer el contrato.
//
// Ojo con medir la mora como "emitido − cobrado" sobre una ventana: las regularizaciones de meses
// anteriores caen dentro de la ventana y la dejan casi en cero. La mora se mide sobre el SALDO
// pendiente al cierre (serie `atraso`), que es lo que mora.ts calcula.
import type { Canal, Plan, Sucursal } from "@/lib/data/filtros";
import { barrios } from "@/lib/data/geografia";
import {
  desplazar,
  indiceDePeriodo,
  mesesEntre,
  periodos,
  PRIMER_PERIODO,
} from "@/lib/data/periodos";
import { crearAzar, entre, type Azar } from "@/lib/data/random";

export const FUENTE_CARTERA = "Cartera ilustrativa · Sistema de Ahorro Fortaleza";

export type EstadoSocio = "Al día" | "En mora" | "Adjudicado" | "Desertado";
export type ViaAdjudicacion = "Sorteo" | "Licitación";

export type Socio = {
  /** Número de contrato: la cartera se identifica por contrato, nunca por nombre. */
  contrato: string;
  plan: Plan;
  sucursal: Sucursal;
  canal: Canal;
  barrio: string;
  /** Período de alta (AAAA-MM); puede ser anterior al calendario. */
  alta: string;
  /** Cuota mensual al momento del alta, en guaraníes (se ajusta una vez por año). */
  aporteMensual: number;
  /** Cuotas del plan (240 = 20 años). */
  cuotasPlan: number;
  /** Puntos de beneficios: una cuota paga, un punto. Suman a la oferta licitatoria. */
  puntos: number;
  /** Aportes pagados antes del calendario, en guaraníes (los socios viejos traen su historia). */
  pagadoPrevio: number;
  adjudicado: string | null;
  via: ViaAdjudicacion | null;
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
/** Cartera que ya venía de antes de Ene 2022 (el sistema arrancó en 1992). */
const SOCIOS_HISTORICOS = 2600;
/** Atraso que hace caer el contrato: siete cuotas impagas pendientes. */
export const ATRASO_LIMITE = 7;
/** Ajuste anual de la cuota. */
export const AJUSTE_ANUAL = 0.085;

const PESO_PLAN: Record<Plan, number> = { Amplia: 42, "Plan 20": 50, Adicional: 8 };
const CUOTAS_PLAN: Record<Plan, number> = { Amplia: 180, "Plan 20": 240, Adicional: 120 };
const APORTE_BASE: Record<Plan, number> = {
  Amplia: 2_350_000,
  "Plan 20": 1_480_000,
  Adicional: 790_000,
};
const PESO_SUCURSAL: Record<Sucursal, number> = {
  "Casa Central": 30,
  "Villa Morra": 22,
  "Mcal. López": 16,
  "San Lorenzo": 14,
  "Ciudad del Este": 11,
  Encarnación: 7,
};
const PESO_CANAL: Record<Canal, number> = {
  Asesor: 46,
  Web: 18,
  Referido: 20,
  "App Fideliza": 11,
  Eventos: 5,
};

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
const nivelBarrio = Object.fromEntries(barrios.map((b) => [b.nombre, b.nivel])) as Record<
  string,
  number
>;

/**
 * Perfil de pago del socio. La población es BIMODAL a propósito: la gran mayoría paga casi
 * todos los meses, y una minoría irregular arrastra atrasos y concentra la mora. Con una sola
 * distribución (todos "bastante cumplidores") la mora del agregado queda irrealmente cerca de
 * cero, porque las regularizaciones tapan los impagos mes a mes.
 */
const PROPORCION_IRREGULARES = 0.13;

function perfilDe(azar: Azar, canal: Canal) {
  const irregular = azar() < PROPORCION_IRREGULARES;
  const porCanal = canal === "Referido" || canal === "Asesor" ? 0.01 : -0.012;
  return irregular
    ? // Paga 3 de cada 4 meses y regulariza con desgano: acumula atraso.
      { pagaProb: Math.min(0.93, 0.74 + azar() * 0.1 + porCanal), regularizaProb: 0.3 }
    : // Paga casi siempre y, si falla un mes, lo cubre enseguida.
      { pagaProb: Math.min(0.999, 0.975 + azar() * 0.023 + porCanal), regularizaProb: 0.78 };
}

/**
 * Riesgo de abandonar el plan en un mes dado. El primer año concentra la deserción; la cuota
 * alta y los canales menos consultivos la empeoran, y el atraso acumulado la dispara.
 */
function riesgoBaja(plan: Plan, canal: Canal, mesesDesdeAlta: number, atraso: number): number {
  const base = mesesDesdeAlta <= 12 ? 0.009 : mesesDesdeAlta <= 36 ? 0.0035 : 0.0014;
  const porPlan = plan === "Amplia" ? 1.3 : plan === "Adicional" ? 1.1 : 1;
  const porCanal =
    canal === "Web" ? 1.4 : canal === "Eventos" ? 1.25 : canal === "Referido" ? 0.7 : 1;
  return base * porPlan * porCanal * (1 + atraso * 0.9);
}

function construirSocios(): Socio[] {
  const azar = crearAzar("cartera-fortaleza");
  const out: Socio[] = [];
  let n = 1;

  const nuevoSocio = (alta: string, antiguo: boolean): Socio => {
    const plan = elegirPonderado(azar, PESO_PLAN);
    const canal: Canal = antiguo ? "Asesor" : elegirPonderado(azar, PESO_CANAL);
    const barrio = elegirPonderado(azar, pesosBarrio);
    // Años respecto de 2022: negativo para quien entró antes del calendario, así su cuota de
    // alta es la de entonces y los ajustes anuales la traen hasta el valor de hoy.
    const anios = Number(alta.slice(0, 4)) - 2022;
    const aporte =
      APORTE_BASE[plan] *
      (nivelBarrio[barrio] ?? 1) *
      (1 + AJUSTE_ANUAL) ** anios *
      entre(azar, 0.85, 1.2);
    return {
      contrato: `F-${String(100000 + n++)}`,
      plan,
      sucursal: elegirPonderado(azar, PESO_SUCURSAL),
      canal,
      barrio,
      alta,
      aporteMensual: Math.round(aporte / 10_000) * 10_000,
      cuotasPlan: CUOTAS_PLAN[plan],
      puntos: 0,
      pagadoPrevio: 0,
      adjudicado: null,
      via: null,
      baja: null,
      emitido: periodos.map(() => null),
      cobrado: periodos.map(() => null),
      atraso: periodos.map(() => null),
    };
  };

  for (let i = 0; i < SOCIOS_HISTORICOS; i++) {
    const mesesAtras = Math.floor(entre(azar, 1, 150));
    const s = nuevoSocio(desplazar(PRIMER_PERIODO, -mesesAtras), true);
    // Su historia previa: cuotas pagadas (con alguna impaga) y los puntos que eso le dio.
    const pagadasPrevias = Math.round(mesesAtras * entre(azar, 0.84, 1));
    s.puntos = pagadasPrevias;
    // La cuota fue ajustándose a lo largo de esos meses: se valoriza al promedio del tramo.
    s.pagadoPrevio = Math.round(pagadasPrevias * s.aporteMensual * (1 + AJUSTE_ANUAL / 2));
    out.push(s);
  }

  periodos.forEach((periodo, i) => {
    const cantidad = Math.round(
      ALTAS_POR_MES *
        (1 + (i / periodos.length) * 0.55) *
        (ESTACIONALIDAD_ALTAS[Number(periodo.slice(5, 7)) - 1] ?? 1) *
        entre(azar, 0.88, 1.12),
    );
    for (let k = 0; k < cantidad; k++) out.push(nuevoSocio(periodo, false));
  });

  for (const s of out) {
    const azarSocio = crearAzar(`socio-${s.contrato}`);
    const { pagaProb, regularizaProb } = perfilDe(azarSocio, s.canal);
    let atraso = 0;
    for (let i = Math.max(0, indiceDePeriodo(s.alta)); i < periodos.length; i++) {
      const periodo = periodos[i]!;
      const mesesDesdeAlta = mesesEntre(s.alta, periodo) + 1;
      if (mesesDesdeAlta > s.cuotasPlan) break; // plan cumplido
      if (azarSocio() < riesgoBaja(s.plan, s.canal, mesesDesdeAlta, atraso)) {
        s.baja = periodo;
        break;
      }
      // La cuota se ajusta una vez al año desde el alta.
      const cuota =
        Math.round(
          (s.aporteMensual * (1 + AJUSTE_ANUAL) ** Math.floor((mesesDesdeAlta - 1) / 12)) / 1000,
        ) * 1000;
      s.emitido[i] = cuota;

      if (azarSocio() < pagaProb) {
        // Paga la del mes y, si arrastra atraso, puede regularizar una cuota más. La cuota vieja
        // se paga al valor VIGENTE, no al de entonces: por eso el dinero cobrado de un socio
        // puede superar al emitido, aunque la cantidad de cuotas pagadas nunca lo haga.
        const regulariza = atraso > 0 && azarSocio() < regularizaProb ? 1 : 0;
        s.cobrado[i] = cuota * (1 + regulariza);
        atraso -= regulariza;
        s.puntos += 1;
      } else {
        s.cobrado[i] = 0;
        atraso += 1;
      }
      s.atraso[i] = atraso;
      if (atraso >= ATRASO_LIMITE) {
        s.baja = periodo;
        break;
      }
    }
  }

  adjudicar(out, azar);
  return out;
}

// ── Adjudicaciones ─────────────────────────────────────────────────────────────────────
// Dos mecanismos, tal como los describe Fortaleza en su sitio:
//   - SORTEO: se extrae una bolilla de cada contenedor para formar el número de contrato, así
//     que todos los socios al día tienen la misma probabilidad, sin importar su antigüedad.
//   - LICITACIÓN: se abren los sobres ante escribano y gana la mejor oferta, que combina los
//     pagos realizados con los puntos de beneficios.
// El reparto mensual y la cantidad son ILUSTRATIVOS, pero acotados por el catálogo: en estos
// 57 meses Fortaleza entregó cuatro torres y tiene cinco en obra, así que el techo de lo
// adjudicable ronda las 1.550 unidades (~27 por mes).

const ADJUDICACIONES_POR_MES = 17;
/** Del total mensual, cuánto se asigna por sorteo (el resto va a licitación). */
export const PROPORCION_SORTEO = 0.55;
/** Cuánto vale un punto de beneficios dentro de la oferta licitatoria, en guaraníes. */
export const VALOR_PUNTO = 220_000;
/** Antigüedad mínima para entrar al acto. */
export const ANTIGUEDAD_MINIMA = 6;

/** Oferta licitatoria de un socio: pagos realizados + puntos de beneficios. */
export function ofertaLicitatoria(s: Socio, hasta: string) {
  return s.pagadoPrevio + cobradoEnRango(s, PRIMER_PERIODO, hasta) + s.puntos * VALOR_PUNTO;
}

/** ¿Puede entrar al acto de adjudicación de este mes? */
export function esElegible(s: Socio, periodo: string) {
  return (
    !s.adjudicado &&
    !(s.baja && s.baja <= periodo) &&
    s.alta <= periodo &&
    atrasoAl(s, periodo) === 0 &&
    antiguedadMeses(s, periodo) >= ANTIGUEDAD_MINIMA
  );
}

function adjudicar(lista: Socio[], azar: Azar) {
  periodos.forEach((periodo, i) => {
    const elegibles = lista.filter((s) => esElegible(s, periodo));
    if (!elegibles.length) return;

    const total = Math.round(
      ADJUDICACIONES_POR_MES * (1 + (i / periodos.length) * 0.8) * entre(azar, 0.85, 1.15),
    );
    const porSorteo = Math.round(total * PROPORCION_SORTEO);

    const sorteados = new Set<string>();
    for (let k = 0; k < porSorteo && sorteados.size < elegibles.length; k++) {
      const s = elegibles[Math.floor(azar() * elegibles.length)]!;
      if (sorteados.has(s.contrato)) continue;
      sorteados.add(s.contrato);
      s.adjudicado = periodo;
      s.via = "Sorteo";
    }

    elegibles
      .filter((s) => !s.adjudicado)
      .map((s) => ({ s, oferta: ofertaLicitatoria(s, periodo) }))
      .sort((a, b) => b.oferta - a.oferta)
      .slice(0, Math.max(0, total - sorteados.size))
      .forEach(({ s }) => {
        s.adjudicado = periodo;
        s.via = "Licitación";
      });
  });
}

// ── Utilidades de lectura ──────────────────────────────────────────────────────────────
// Declaraciones de función a propósito: `adjudicar` corre mientras se construye el módulo y
// necesita estas utilidades antes de que se evalúe cualquier `const` de más abajo.

export function cobrado(s: Socio, periodo: string) {
  return s.cobrado[indiceDePeriodo(periodo)] ?? 0;
}

export function emitido(s: Socio, periodo: string) {
  return s.emitido[indiceDePeriodo(periodo)] ?? 0;
}

function sumarRango(serie: (number | null)[], desde: string, hasta: string) {
  let total = 0;
  for (let i = Math.max(0, indiceDePeriodo(desde)); i <= indiceDePeriodo(hasta); i++)
    total += serie[i] ?? 0;
  return total;
}

export function cobradoEnRango(s: Socio, desde: string, hasta: string) {
  return sumarRango(s.cobrado, desde, hasta);
}

export function emitidoEnRango(s: Socio, desde: string, hasta: string) {
  return sumarRango(s.emitido, desde, hasta);
}

/** Cuotas impagas pendientes al cierre del período (0 = al día). */
export function atrasoAl(s: Socio, hasta: string) {
  const fin = Math.min(indiceDePeriodo(hasta), periodos.length - 1);
  for (let i = fin; i >= 0; i--) {
    const a = s.atraso[i];
    if (a !== null && a !== undefined) return a;
  }
  return 0;
}

/** Cuotas emitidas y pagadas dentro del calendario, hasta el período dado. */
export function cuotasDe(s: Socio, hasta: string) {
  const fin = Math.min(indiceDePeriodo(hasta), periodos.length - 1);
  let emitidas = 0;
  let pagadas = 0;
  for (let i = Math.max(0, indiceDePeriodo(s.alta)); i <= fin; i++) {
    const e = s.emitido[i];
    if (e === null || e === undefined) continue;
    emitidas++;
    if ((s.cobrado[i] ?? 0) > 0) pagadas++;
  }
  return { emitidas, pagadas };
}

/** Antigüedad en meses al cierre del período (cuenta también los años previos al calendario). */
export function antiguedadMeses(s: Socio, hasta: string) {
  return Math.max(0, mesesEntre(s.alta, hasta) + 1);
}

/** Activo = ya entró a la cartera y sigue aportando. Los adjudicados siguen aportando su saldo. */
export function esActivo(s: Socio, hasta: string) {
  return s.alta <= hasta && !(s.baja && s.baja <= hasta);
}

export function estadoDe(s: Socio, hasta: string): EstadoSocio {
  if (s.baja && s.baja <= hasta) return "Desertado";
  if (s.adjudicado && s.adjudicado <= hasta) return "Adjudicado";
  return atrasoAl(s, hasta) >= 1 ? "En mora" : "Al día";
}

export const socios: Socio[] = construirSocios();
