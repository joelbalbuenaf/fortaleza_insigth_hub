export type Punto = { lat: number; lng: number };

const R_TIERRA_KM = 6371;
const rad = (g: number) => (g * Math.PI) / 180;

export function distanciaKm(a: Punto, b: Punto): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_TIERRA_KM * Math.asin(Math.sqrt(h));
}

export function dentroDeRadio<T extends Punto>(centro: Punto, puntos: T[], radioKm: number) {
  return puntos
    .map((p) => ({ ...p, distanciaKm: distanciaKm(centro, p) }))
    .filter((p) => p.distanciaKm <= radioKm)
    .sort((a, b) => a.distanciaKm - b.distanciaKm);
}

export function masCercano<T extends Punto>(centro: Punto, puntos: T[]) {
  let mejor: (T & { distanciaKm: number }) | undefined;
  for (const p of puntos) {
    const d = distanciaKm(centro, p);
    if (!mejor || d < mejor.distanciaKm) mejor = { ...p, distanciaKm: d };
  }
  return mejor;
}

/** Distancia aproximada (km) de un punto a una polilínea [lat, lng][]; suficiente a escala país. */
export function distanciaARutaKm(p: Punto, puntos: [number, number][]): number {
  const kx = 111.32 * Math.cos(rad(p.lat));
  const ky = 110.57;
  let mejor = Infinity;
  for (let i = 0; i < puntos.length - 1; i++) {
    const [aLat, aLng] = puntos[i] ?? [0, 0];
    const [bLat, bLng] = puntos[i + 1] ?? [0, 0];
    const ax = (aLng - p.lng) * kx;
    const ay = (aLat - p.lat) * ky;
    const bx = (bLng - p.lng) * kx;
    const by = (bLat - p.lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    mejor = Math.min(mejor, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return mejor;
}
