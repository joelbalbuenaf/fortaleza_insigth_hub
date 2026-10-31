import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { esRutaPublica, exigirCredenciales, verificarSesion } from "./lib/auth";
import { renderErrorPage } from "./lib/error-page";

// Sin HUB_USUARIO y HUB_CLAVE el servidor no levanta: el Hub muestra datos de socios.
exigirCredenciales();

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Exige sesión en todo el Hub salvo en las rutas públicas (login, salud, favicon).
const authMiddleware = createMiddleware().server(
  async ({ next, request, pathname, handlerType }) => {
    if (esRutaPublica(pathname)) return next();
    if (await verificarSesion(request.headers.get("cookie"))) return next();
    if (pathname.startsWith("/api/") || handlerType === "serverFn")
      return new Response("Sesión requerida", { status: 401 });
    const destino = pathname + new URL(request.url).search;
    return new Response(null, {
      status: 302,
      headers: { location: `/login?next=${encodeURIComponent(destino)}` },
    });
  },
);

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, authMiddleware, csrfMiddleware],
}));
