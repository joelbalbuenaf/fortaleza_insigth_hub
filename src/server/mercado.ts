// Mercado inmobiliario de Asunción: precios por barrio, edificios de la competencia y absorción.
// Todo ILUSTRATIVO: nombres de desarrolladoras inventados, precios supuestos, ubicaciones
// aproximadas alrededor de barrios reales. No sale de ningún relevamiento.
import { barrios, normalizar, type Barrio } from "@/lib/data/geografia";
import { dentroDeRadio, masCercano, type Punto } from "@/lib/data/geo";
import { etiquetaCorta, periodos, rango } from "@/lib/data/periodos";
import { proyectos } from "@/lib/data/proyectos";
import { crearAzar, elegir, entre, redondear, type Azar } from "@/lib/data/random";

/** Precio de m² de referencia en Asunción, en USD (ilustrativo). */
const PRECIO_M2_BASE = 1450;

export type PrecioBarrio = {
  barrio: string;
  zona: string;
  precioM2Usd: number;
  /** Variación interanual del precio, en %. */
  variacionPct: number;
  /** Edificios de la competencia en el barrio. */
  competencia: number;
  /** Proyectos de Fortaleza en el barrio (catálogo público). */
  fortaleza: number;
  lat: number;
  lng: number;
};

function construirPrecios(): PrecioBarrio[] {
  const azar = crearAzar("precios-m2");
  return barrios.map((b) => {
    const precio = PRECIO_M2_BASE * b.nivel * entre(azar, 0.93, 1.07);
    return {
      barrio: b.nombre,
      zona: b.zona,
      precioM2Usd: Math.round(precio / 10) * 10,
      variacionPct: redondear(entre(azar, 1.5, 11.5) * (b.nivel > 1.2 ? 1.15 : 1), 1),
      competencia: 0,
      fortaleza: proyectos.filter((p) => p.barrio === b.nombre).length,
      lat: b.lat,
      lng: b.lng,
    };
  });
}

// ── Competencia ────────────────────────────────────────────────────────────────────────

/** Desarrolladoras de la competencia: nombres INVENTADOS para la demo. */
export const desarrolladoras = [
  "Altamira Desarrollos",
  "Kuarahy Urbano",
  "Grupo Takuary",
  "Vista Norte",
  "Yvoty Propiedades",
  "Otros",
] as const;
export type Desarrolladora = (typeof desarrolladoras)[number];

const EDIFICIOS_POR_DESARROLLADORA: Record<Desarrolladora, number> = {
  "Altamira Desarrollos": 34,
  "Kuarahy Urbano": 27,
  "Grupo Takuary": 22,
  "Vista Norte": 18,
  "Yvoty Propiedades": 15,
  Otros: 41,
};

export type EdificioCompetencia = Punto & {
  id: string;
  desarrolladora: Desarrolladora;
  barrio: string;
  pisos: number;
  unidades: number;
  precioM2Usd: number;
  estado: "En pozo" | "En construcción" | "Terminado";
};

function ubicarCerca(azar: Azar, b: Barrio, dispersion = 0.006): Punto {
  return {
    lat: redondear(b.lat + entre(azar, -dispersion, dispersion), 4),
    lng: redondear(b.lng + entre(azar, -dispersion, dispersion), 4),
  };
}

function elegirBarrioPonderado(azar: Azar, pesos: (b: Barrio) => number): Barrio {
  const total = barrios.reduce((t, b) => t + pesos(b), 0);
  let r = azar() * total;
  for (const b of barrios) {
    r -= pesos(b);
    if (r <= 0) return b;
  }
  return barrios[barrios.length - 1]!;
}

function construirCompetencia(): EdificioCompetencia[] {
  const azar = crearAzar("competencia-edificios");
  const out: EdificioCompetencia[] = [];
  let n = 1;
  for (const d of desarrolladoras) {
    for (let i = 0; i < EDIFICIOS_POR_DESARROLLADORA[d]; i++) {
      // La competencia se concentra donde hay más poder adquisitivo: se pondera al cuadrado.
      const b = elegirBarrioPonderado(azar, (x) => x.peso * x.nivel ** 2);
      const pisos = Math.round(entre(azar, 6, 30));
      out.push({
        id: `C-${String(n++).padStart(3, "0")}`,
        desarrolladora: d,
        barrio: b.nombre,
        pisos,
        unidades: Math.round(pisos * entre(azar, 3, 7)),
        precioM2Usd: Math.round((PRECIO_M2_BASE * b.nivel * entre(azar, 0.9, 1.15)) / 10) * 10,
        estado: elegir(azar, ["En pozo", "En construcción", "Terminado"] as const),
        ...ubicarCerca(azar, b),
      });
    }
  }
  return out;
}

export const competencia = construirCompetencia();

export const preciosPorBarrio: PrecioBarrio[] = construirPrecios().map((p) => ({
  ...p,
  competencia: competencia.filter((c) => c.barrio === p.barrio).length,
}));

export function precioDe(barrio: string) {
  const n = normalizar(barrio);
  return preciosPorBarrio.find((p) => normalizar(p.barrio) === n);
}

/** Edificios de la competencia por desarrolladora, para el gráfico y la tabla. */
export function porDesarrolladora(barrio?: string) {
  const lista = competencia.filter((c) => !barrio || c.barrio === barrio);
  return desarrolladoras.map((d) => {
    const propios = lista.filter((c) => c.desarrolladora === d);
    return {
      desarrolladora: d,
      nombre: d,
      edificios: propios.length,
      unidades: propios.reduce((t, c) => t + c.unidades, 0),
      precioM2Medio: propios.length
        ? Math.round(propios.reduce((t, c) => t + c.precioM2Usd, 0) / propios.length)
        : 0,
    };
  });
}

/**
 * Barrios donde la competencia construye y Fortaleza no tiene ningún proyecto: dónde mirar para
 * el próximo terreno. Es un cruce entre un hecho público (el catálogo) y datos inventados (la
 * competencia), así que vale como ejercicio, no como diagnóstico de mercado.
 */
export function barriosSinPresencia(minimoCompetencia = 4) {
  return preciosPorBarrio
    .filter((p) => p.fortaleza === 0 && p.competencia >= minimoCompetencia)
    .map((p) => {
      const cercano = masCercano({ lat: p.lat, lng: p.lng }, proyectos);
      return {
        barrio: p.barrio,
        zona: p.zona,
        competencia: p.competencia,
        precioM2Usd: p.precioM2Usd,
        variacionPct: p.variacionPct,
        proyectoMasCercano: cercano?.corto ?? "—",
        distanciaKm: redondear(cercano?.distanciaKm ?? 0, 1),
      };
    })
    .sort((a, b) => b.competencia - a.competencia);
}

// ── Absorción del mercado ──────────────────────────────────────────────────────────────

/** Unidades vendidas por mes en el mercado de departamentos de Asunción (ilustrativo). */
export const absorcion = (() => {
  const azar = crearAzar("absorcion");
  return periodos.map((periodo, i) => {
    const mes = Number(periodo.slice(5, 7));
    // Verano flojo, segundo semestre fuerte.
    const estacional = [0.82, 0.88, 1.05, 1.02, 1.0, 0.95, 0.92, 1.05, 1.12, 1.15, 1.1, 0.94];
    const base = 210 * (1 + (i / periodos.length) * 0.35);
    const unidades = Math.round(base * (estacional[mes - 1] ?? 1) * entre(azar, 0.9, 1.1));
    return {
      periodo,
      mes: etiquetaCorta(periodo),
      unidades,
      /** Meses de stock: cuánto tardaría en venderse la oferta disponible al ritmo actual. */
      mesesDeStock: redondear(entre(azar, 14, 26), 1),
    };
  });
})();

export function serieAbsorcion(desde: string, hasta: string) {
  const dentro = new Set(rango(desde, hasta));
  return absorcion.filter((a) => dentro.has(a.periodo));
}

export function resumenMercado() {
  const precios = preciosPorBarrio.map((p) => p.precioM2Usd);
  const ultimos12 = absorcion.slice(-12);
  return {
    fuente: "ilustrativo" as const,
    precioM2MedioUsd: Math.round(precios.reduce((t, p) => t + p, 0) / precios.length),
    precioM2MaximoUsd: Math.max(...precios),
    barrioMasCaro:
      [...preciosPorBarrio].sort((a, b) => b.precioM2Usd - a.precioM2Usd)[0]?.barrio ?? "—",
    edificiosCompetencia: competencia.length,
    unidadesCompetencia: competencia.reduce((t, c) => t + c.unidades, 0),
    proyectosFortaleza: proyectos.length,
    absorcionAnualUnidades: ultimos12.reduce((t, a) => t + a.unidades, 0),
    mesesDeStock: redondear(
      ultimos12.reduce((t, a) => t + a.mesesDeStock, 0) / (ultimos12.length || 1),
      1,
    ),
    barriosSinPresencia: barriosSinPresencia().length,
  };
}

/** Competidores a menos de `radioKm` de un punto. */
export const competidoresCerca = (p: Punto, radioKm: number) =>
  dentroDeRadio(p, competencia, radioKm);
