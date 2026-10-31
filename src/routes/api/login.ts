import { createFileRoute } from "@tanstack/react-router";
import { authConfigurada, cookieSesion, credencialesValidas, crearSesion } from "@/lib/auth";

const VENTANA_MS = 15 * 60_000;
const MAX_FALLIDOS = 8;
const fallidos = new Map<string, number[]>();

export const Route = createFileRoute("/api/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Sin credenciales configuradas nadie entra (start.ts ya aborta el arranque).
        if (!authConfigurada())
          return Response.json(
            { error: "El Hub no tiene credenciales configuradas." },
            { status: 503 },
          );
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
        const ahora = Date.now();
        const recientes = (fallidos.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
        if (recientes.length >= MAX_FALLIDOS)
          return Response.json(
            { error: "Demasiados intentos fallidos. Probá de nuevo en 15 minutos." },
            { status: 429 },
          );

        const body = (await request.json().catch(() => null)) as {
          usuario?: unknown;
          clave?: unknown;
        } | null;
        const usuario = typeof body?.usuario === "string" ? body.usuario.trim() : "";
        const clave = typeof body?.clave === "string" ? body.clave : "";

        if (!(await credencialesValidas(usuario, clave))) {
          fallidos.set(ip, [...recientes, ahora]);
          // Pequeña demora para frenar intentos automáticos.
          await new Promise((r) => setTimeout(r, 400));
          return Response.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
        }
        fallidos.delete(ip);
        return Response.json(
          { ok: true },
          { headers: { "set-cookie": cookieSesion(await crearSesion(usuario), request) } },
        );
      },
    },
  },
});
