// Evaluador de terrenos: dónde conviene comprar el próximo terreno en Asunción.
//
// Modelo ILUSTRATIVO con factores explícitos. La idea no es que el puntaje sea exacto, sino que
// cada punto sumado o restado se pueda discutir: por eso cada factor devuelve su valor medido,
// su aporte al puntaje y una explicación en una línea.
import { avenidas, barrios, normalizar } from "@/lib/data/geografia";
import {
  dentroDeRadio,
  distanciaARutaKm,
  distanciaKm,
  masCercano,
  type Punto,
} from "@/lib/data/geo";
import { proyectos } from "@/lib/data/proyectos";
import { redondear } from "@/lib/data/random";
import { competencia, precioDe, preciosPorBarrio } from "./mercado";

export type FactorTerreno = {
  nombre: string;
  valor: string;
  aporte: number;
  explicacion: string;
};

const n = (v: number, d = 1) => v.toLocaleString("es-PY", { maximumFractionDigits: d });

/** Superficie típica de un terreno para una torre, en m² (ilustrativa). */
const SUPERFICIE_TIPO_M2 = 1200;
/** Cuántos m² vendibles salen por m² de terreno (relación de aprovechamiento ilustrativa). */
const M2_VENDIBLES_POR_M2 = 7.5;

export function evaluarTerreno(p: Punto) {
  const barrio = masCercano(p, barrios);
  const precio = barrio ? precioDe(barrio.nombre) : undefined;

  // Demanda del entorno: barrios cercanos ponderados por distancia y nivel.
  const demanda = barrios.reduce(
    (t, b) => t + b.peso * b.nivel * Math.exp(-distanciaKm(p, b) / 2.2),
    0,
  );
  const avenida = avenidas
    .map((a) => ({ nombre: a.nombre, km: distanciaARutaKm(p, a.puntos) }))
    .sort((a, b) => a.km - b.km)[0];
  const competidores = dentroDeRadio(p, competencia, 1);
  const propios = dentroDeRadio(p, proyectos, 1);

  const fDemanda = Math.min(35, demanda * 1.9);
  const fPrecio = precio ? Math.min(20, ((precio.precioM2Usd - 1100) / 700) * 20) : 0;
  // Estar sobre una avenida importa mucho en Asunción: visibilidad y acceso.
  const fAvenida = avenida ? Math.max(0, 18 - avenida.km * 14) : 0;
  const fCompetencia = -Math.min(18, competidores.length * 2.6);
  // Canibalización: dos torres propias muy cerca compiten por los mismos socios.
  const fCanibal = -Math.min(
    20,
    propios.reduce((t, x) => t + 11 * Math.exp(-x.distanciaKm / 0.6), 0),
  );

  const puntaje = Math.round(
    Math.max(0, Math.min(100, 32 + fDemanda + fPrecio + fAvenida + fCompetencia + fCanibal)),
  );

  const factores: FactorTerreno[] = [
    {
      nombre: "Demanda del entorno",
      valor: `${n(demanda, 2)} índice`,
      aporte: Math.round(fDemanda),
      explicacion: `Barrios cercanos ponderados por distancia y poder adquisitivo; el más próximo es ${barrio?.nombre ?? "—"} a ${n(barrio?.distanciaKm ?? 0)} km.`,
    },
    {
      nombre: "Precio de m² de la zona",
      valor: precio ? `USD ${n(precio.precioM2Usd, 0)}/m²` : "—",
      aporte: Math.round(fPrecio),
      explicacion:
        "Un m² más caro sostiene una cuota más alta, que es lo que financia la obra. Precio ilustrativo.",
    },
    {
      nombre: "Cercanía a avenida",
      valor: avenida ? `${n(avenida.km, 2)} km` : "—",
      aporte: Math.round(fAvenida),
      explicacion: avenida ? `Distancia a ${avenida.nombre}.` : "Sin avenida troncal cerca.",
    },
    {
      nombre: "Competencia (1 km)",
      valor: `${competidores.length} edificios`,
      aporte: Math.round(fCompetencia),
      explicacion: competidores.length
        ? `Desarrolladoras: ${[...new Set(competidores.map((c) => c.desarrolladora))].slice(0, 3).join(", ")}. Competencia ilustrativa.`
        : "Sin competidores a 1 km (según la competencia ilustrativa).",
    },
    {
      nombre: "Canibalización (1 km)",
      valor: `${propios.length} proyecto${propios.length === 1 ? "" : "s"} Fortaleza`,
      aporte: Math.round(fCanibal),
      explicacion: propios.length
        ? `El más cercano: ${propios[0]?.corto} a ${n(propios[0]?.distanciaKm ?? 0, 2)} km.`
        : "Sin proyectos propios a 1 km.",
    },
  ];

  const m2Vendibles = SUPERFICIE_TIPO_M2 * M2_VENDIBLES_POR_M2;
  const ingresoUsd = m2Vendibles * (precio?.precioM2Usd ?? 1400);

  return {
    fuente: "ilustrativo" as const,
    lat: redondear(p.lat, 4),
    lng: redondear(p.lng, 4),
    barrio: barrio?.nombre ?? "—",
    zona: barrio?.zona ?? "—",
    puntaje,
    recomendacion:
      puntaje >= 70 ? "Terreno atractivo" : puntaje >= 50 ? "Evaluar en detalle" : "Poco atractivo",
    factores,
    /** Sobre un terreno tipo de 1.200 m². */
    superficieTipoM2: SUPERFICIE_TIPO_M2,
    m2VendiblesEstimados: Math.round(m2Vendibles),
    unidadesEstimadas: Math.round(m2Vendibles / 68),
    ingresoPotencialUsdM: redondear(ingresoUsd / 1_000_000, 1),
    competidores: competidores.slice(0, 8).map((c) => ({
      desarrolladora: c.desarrolladora,
      km: redondear(c.distanciaKm, 2),
      unidades: c.unidades,
    })),
    nota: "Modelo ilustrativo: la demanda, los precios y la competencia son supuestos de la demo. No reemplaza un estudio de factibilidad, ni la verificación de zonificación, retiros municipales y títulos.",
  };
}

export type EvaluacionTerreno = ReturnType<typeof evaluarTerreno>;

/** Busca el centro de un barrio por nombre, para evaluar sin coordenadas. */
export function puntoDeBarrio(nombre: string): Punto | undefined {
  const q = normalizar(nombre);
  const b = barrios.find((x) => normalizar(x.nombre).includes(q));
  return b ? { lat: b.lat, lng: b.lng } : undefined;
}

/**
 * Ranking de barrios como candidatos para el próximo terreno: se evalúa el centro de cada uno.
 * Sirve para abrir el mapa con una recomendación inicial en lugar de una pantalla vacía.
 */
export function rankingBarrios() {
  return preciosPorBarrio
    .map((p) => {
      const e = evaluarTerreno({ lat: p.lat, lng: p.lng });
      return {
        barrio: p.barrio,
        zona: p.zona,
        lat: p.lat,
        lng: p.lng,
        puntaje: e.puntaje,
        recomendacion: e.recomendacion,
        precioM2Usd: p.precioM2Usd,
        competencia: p.competencia,
        fortaleza: p.fortaleza,
      };
    })
    .sort((a, b) => b.puntaje - a.puntaje);
}
