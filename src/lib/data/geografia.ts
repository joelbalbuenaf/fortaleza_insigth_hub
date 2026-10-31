// Geografía de Asunción para el Hub. Las coordenadas de los barrios son aproximadas (centro del
// barrio, redondeadas); los pesos de demanda y de poder adquisitivo son ILUSTRATIVOS.
// Fortaleza opera solo en Asunción: no hay departamentos, el territorio son barrios.

export type Zona = "Centro" | "Centro histórico" | "Norte" | "Este" | "Sur";

export type Barrio = {
  nombre: string;
  zona: Zona;
  lat: number;
  lng: number;
  /** Peso ilustrativo de demanda de departamentos (se normaliza). */
  peso: number;
  /** >1 = más poder adquisitivo; mueve el precio de m² y el ticket del plan. */
  nivel: number;
};

export const barrios: Barrio[] = [
  // ── Corredor Molas López / Villa Morra: donde está la mayoría de los proyectos ──
  { nombre: "Villa Morra", zona: "Este", lat: -25.2935, lng: -57.5675, peso: 10, nivel: 1.35 },
  { nombre: "Carmelitas", zona: "Norte", lat: -25.2795, lng: -57.5775, peso: 9, nivel: 1.4 },
  { nombre: "Recoleta", zona: "Este", lat: -25.2985, lng: -57.5795, peso: 8, nivel: 1.25 },
  { nombre: "Las Mercedes", zona: "Este", lat: -25.3045, lng: -57.5885, peso: 6, nivel: 1.15 },
  { nombre: "Mburucuyá", zona: "Este", lat: -25.2875, lng: -57.5485, peso: 6, nivel: 1.3 },
  { nombre: "Ycuá Satí", zona: "Norte", lat: -25.2745, lng: -57.5595, peso: 5, nivel: 1.3 },
  { nombre: "Manorá", zona: "Norte", lat: -25.2695, lng: -57.5475, peso: 5, nivel: 1.35 },
  { nombre: "Los Laureles", zona: "Este", lat: -25.2865, lng: -57.5885, peso: 4, nivel: 1.2 },
  { nombre: "Santa María", zona: "Norte", lat: -25.2745, lng: -57.5365, peso: 4, nivel: 1.25 },
  { nombre: "Mcal. Estigarribia", zona: "Este", lat: -25.2995, lng: -57.5575, peso: 4, nivel: 1.1 },
  // ── Centro y eje Mcal. López ──
  { nombre: "Ciudad Nueva", zona: "Centro", lat: -25.2795, lng: -57.6265, peso: 5, nivel: 1.0 },
  { nombre: "Jara", zona: "Centro", lat: -25.2885, lng: -57.6065, peso: 5, nivel: 1.05 },
  {
    nombre: "La Encarnación",
    zona: "Centro histórico",
    lat: -25.2825,
    lng: -57.6365,
    peso: 3,
    nivel: 0.9,
  },
  {
    nombre: "Catedral",
    zona: "Centro histórico",
    lat: -25.2805,
    lng: -57.6425,
    peso: 2,
    nivel: 0.85,
  },
  { nombre: "Pinozá", zona: "Centro", lat: -25.2905, lng: -57.5955, peso: 3, nivel: 1.0 },
  { nombre: "Ita Pytã Punta", zona: "Norte", lat: -25.2665, lng: -57.6065, peso: 2, nivel: 1.1 },
  // ── Sur ──
  { nombre: "Sajonia", zona: "Sur", lat: -25.3085, lng: -57.6275, peso: 4, nivel: 0.85 },
  { nombre: "San Roque", zona: "Centro", lat: -25.2895, lng: -57.6265, peso: 3, nivel: 0.95 },
  { nombre: "Herrera", zona: "Sur", lat: -25.3025, lng: -57.6155, peso: 3, nivel: 0.9 },
  { nombre: "Obrero", zona: "Sur", lat: -25.3065, lng: -57.6425, peso: 2, nivel: 0.75 },
  { nombre: "Tacumbú", zona: "Sur", lat: -25.3185, lng: -57.6385, peso: 2, nivel: 0.7 },
  { nombre: "Virgen de Fátima", zona: "Sur", lat: -25.3255, lng: -57.6035, peso: 2, nivel: 0.8 },
  {
    nombre: "Bernardino Caballero",
    zona: "Sur",
    lat: -25.3305,
    lng: -57.5885,
    peso: 2,
    nivel: 0.8,
  },
  { nombre: "Madame Lynch", zona: "Este", lat: -25.3185, lng: -57.5675, peso: 3, nivel: 0.85 },
];

export const nombresBarrios = barrios.map((b) => b.nombre);
export const zonas: Zona[] = ["Centro histórico", "Centro", "Norte", "Este", "Sur"];

export function buscarBarrio(nombre: string): Barrio | undefined {
  const n = normalizar(nombre);
  return barrios.find((b) => normalizar(b.nombre) === n);
}

/**
 * Avenidas troncales de Asunción como polilíneas, para estimar exposición y tráfico en el
 * evaluador de terrenos. Trazas aproximadas: sirven para medir distancia, no para navegar.
 */
export const avenidas: { nombre: string; puntos: [number, number][] }[] = [
  {
    nombre: "Avda. Dr. Felipe Molas López",
    puntos: [
      [-25.2755, -57.5805],
      [-25.2885, -57.5775],
      [-25.2995, -57.5745],
      [-25.3095, -57.5715],
    ],
  },
  {
    nombre: "Avda. Boggiani",
    puntos: [
      [-25.2905, -57.5905],
      [-25.2985, -57.5775],
      [-25.3065, -57.5645],
      [-25.3125, -57.5535],
    ],
  },
  {
    nombre: "Avda. Mcal. López",
    puntos: [
      [-25.2825, -57.6355],
      [-25.2875, -57.6055],
      [-25.2935, -57.5775],
      [-25.2985, -57.5475],
      [-25.3025, -57.5265],
    ],
  },
  {
    nombre: "Avda. España",
    puntos: [
      [-25.2825, -57.6295],
      [-25.2855, -57.6055],
      [-25.2895, -57.5825],
      [-25.2925, -57.5655],
    ],
  },
  {
    nombre: "Avda. Aviadores del Chaco",
    puntos: [
      [-25.2905, -57.5705],
      [-25.2825, -57.5595],
      [-25.2735, -57.5485],
      [-25.2665, -57.5395],
    ],
  },
  {
    nombre: "Avda. San Martín",
    puntos: [
      [-25.2695, -57.5885],
      [-25.2825, -57.5825],
      [-25.2955, -57.5765],
      [-25.3065, -57.5715],
    ],
  },
  {
    nombre: "Avda. Santísima Trinidad",
    puntos: [
      [-25.2725, -57.5975],
      [-25.2805, -57.5855],
      [-25.2885, -57.5745],
    ],
  },
  {
    nombre: "Avda. Eusebio Ayala",
    puntos: [
      [-25.2955, -57.6165],
      [-25.3055, -57.5945],
      [-25.3155, -57.5705],
      [-25.3215, -57.5495],
    ],
  },
  {
    nombre: "Avda. Artigas",
    puntos: [
      [-25.2695, -57.6155],
      [-25.2825, -57.6105],
      [-25.2955, -57.6065],
    ],
  },
  {
    nombre: "Costanera Norte",
    puntos: [
      [-25.2665, -57.6365],
      [-25.2645, -57.6165],
      [-25.2675, -57.5975],
    ],
  },
];

export function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
