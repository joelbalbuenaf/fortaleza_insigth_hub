// Acceso con usuario y contraseña, SIEMPRE por variables de entorno (HUB_USUARIO, HUB_CLAVE):
// el Hub muestra datos de socios, así que no hay credenciales por defecto en el código.
// La sesión es una cookie HttpOnly firmada con HMAC-SHA256. Solo usa Web Crypto, así que el
// módulo puede importarse desde start.ts sin arrastrar APIs de Node al cliente.

export const COOKIE_SESION = "hub_sesion";
const DURACION_S = 7 * 24 * 60 * 60;

/** Rutas accesibles sin sesión. */
const PUBLICAS = [
  "/login",
  "/api/login",
  "/api/logout",
  "/api/salud",
  "/favicon.png",
  "/robots.txt",
];
export const esRutaPublica = (pathname: string) => PUBLICAS.includes(pathname);

const env = (k: string) => (typeof process !== "undefined" ? process.env[k] : undefined);

const usuarioHub = () => env("HUB_USUARIO") ?? "";
const claveHub = () => env("HUB_CLAVE") ?? "";

/** Sin credenciales no hay acceso posible: el middleware rechaza todo y el login siempre falla. */
export const authConfigurada = () => Boolean(usuarioHub() && claveHub());

/**
 * Falla el arranque si faltan las credenciales. Se llama desde start.ts: preferimos un servidor
 * que no levanta a uno que sirve datos de socios sin pedir nada.
 */
export function exigirCredenciales() {
  if (!authConfigurada())
    throw new Error(
      "Faltan HUB_USUARIO y HUB_CLAVE: el Hub no arranca sin credenciales (ver .env.example).",
    );
}

const codificador = new TextEncoder();

function base64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function desdeBase64url(texto: string) {
  return atob(texto.replace(/-/g, "+").replace(/_/g, "/"));
}

// Sin HUB_SECRETO se deriva de las credenciales: cambiar la clave invalida las sesiones.
const secreto = () => env("HUB_SECRETO") || `${usuarioHub()}:${claveHub()}:fortaleza-hub`;

async function firmar(texto: string) {
  const clave = await crypto.subtle.importKey(
    "raw",
    codificador.encode(secreto()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", clave, codificador.encode(texto)));
}

/** Comparación en tiempo constante (sobre firmas de igual largo). */
function iguales(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Compara usuario y clave firmando ambos lados, para no filtrar información por tiempos. */
export async function credencialesValidas(usuario: string, clave: string) {
  const [a, b] = await Promise.all([
    firmar(`${usuario}\u0000${clave}`),
    firmar(`${usuarioHub()}\u0000${claveHub()}`),
  ]);
  return authConfigurada() && iguales(a, b);
}

export async function crearSesion(usuario: string) {
  const datos = base64url(
    codificador.encode(
      JSON.stringify({ u: usuario, exp: Math.floor(Date.now() / 1000) + DURACION_S }),
    ),
  );
  return `${datos}.${await firmar(datos)}`;
}

/** Devuelve el usuario de una sesión válida y vigente, o null. */
export async function verificarSesion(cookies: string | null): Promise<string | null> {
  const token = cookies
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_SESION}=`))
    ?.slice(COOKIE_SESION.length + 1);
  const [datos, firma] = token?.split(".") ?? [];
  if (!datos || !firma || !iguales(firma, await firmar(datos))) return null;
  try {
    const { u, exp } = JSON.parse(desdeBase64url(datos)) as { u: string; exp: number };
    return exp > Date.now() / 1000 ? u : null;
  } catch {
    return null;
  }
}

const esHttps = (request: Request) =>
  request.headers.get("x-forwarded-proto") === "https" || request.url.startsWith("https:");

export function cookieSesion(token: string, request: Request) {
  return `${COOKIE_SESION}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DURACION_S}${esHttps(request) ? "; Secure" : ""}`;
}

export function cookieBorrada(request: Request) {
  return `${COOKIE_SESION}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${esHttps(request) ? "; Secure" : ""}`;
}

/** Solo rutas internas como destino después del login (evita redirecciones abiertas). */
export const destinoSeguro = (next: unknown) =>
  typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
