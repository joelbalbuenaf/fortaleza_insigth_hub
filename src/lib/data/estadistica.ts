// Estadística descriptiva e inferencial simple (funciones puras, sin datos).

export const media = (v: number[]) => v.reduce((s, x) => s + x, 0) / (v.length || 1);

export function desvio(v: number[]) {
  const m = media(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, v.length - 1));
}

/** Coeficiente de correlación de Pearson. */
export function correlacion(x: number[], y: number[]) {
  const mx = media(x);
  const my = media(y);
  let num = 0;
  let dx = 0;
  let dy = 0;
  x.forEach((xi, i) => {
    const yi = y[i] ?? 0;
    num += (xi - mx) * (yi - my);
    dx += (xi - mx) ** 2;
    dy += (yi - my) ** 2;
  });
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

/** Regresión lineal simple y = a + b·x con R². */
export function regresion(x: number[], y: number[]) {
  const mx = media(x);
  const my = media(y);
  const b =
    x.reduce((s, xi, i) => s + (xi - mx) * ((y[i] ?? 0) - my), 0) /
    (x.reduce((s, xi) => s + (xi - mx) ** 2, 0) || 1);
  const a = my - b * mx;
  const r = correlacion(x, y);
  return { a, b, r, r2: r * r };
}

export const fuerzaCorrelacion = (r: number) => {
  const a = Math.abs(r);
  return a >= 0.7 ? "fuerte" : a >= 0.4 ? "moderada" : a >= 0.2 ? "débil" : "muy débil o nula";
};
