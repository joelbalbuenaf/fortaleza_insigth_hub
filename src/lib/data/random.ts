// Utilidades determinísticas: los mismos datos de demo en servidor, cliente y tests.

export type Azar = () => number;

function hashTexto(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32: PRNG pequeño y suficiente para datos de demo.
export function crearAzar(semilla: string): Azar {
  let s = hashTexto(semilla);
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const entre = (azar: Azar, min: number, max: number) => min + azar() * (max - min);

export function redondear(n: number, decimales = 1): number {
  const f = 10 ** decimales;
  return Math.round(n * f) / f;
}

// Reparte un total según pesos con el método del resto mayor: las partes redondeadas suman
// exactamente el total, así los desgloses cuadran con los totales.
export function repartir(total: number, pesos: number[], decimales = 1): number[] {
  const f = 10 ** decimales;
  const unidades = Math.round(total * f);
  const suma = pesos.reduce((s, p) => s + p, 0);
  if (suma <= 0) return pesos.map(() => 0);
  const exactos = pesos.map((p) => (unidades * p) / suma);
  const base = exactos.map(Math.floor);
  let resto = unidades - base.reduce((s, v) => s + v, 0);
  const orden = exactos
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of orden) {
    if (resto <= 0) break;
    base[i] = (base[i] ?? 0) + 1;
    resto--;
  }
  return base.map((v) => v / f);
}

export function elegir<T>(azar: Azar, opciones: readonly T[]): T {
  const v = opciones[Math.floor(azar() * opciones.length)];
  if (v === undefined) throw new Error("elegir: lista vacía");
  return v;
}
