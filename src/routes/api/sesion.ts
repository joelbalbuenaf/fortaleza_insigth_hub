import { createFileRoute } from "@tanstack/react-router";
import { authConfigurada, verificarSesion } from "@/lib/auth";

// Quién está conectado (para mostrarlo en la barra lateral). Protegida por el middleware.
export const Route = createFileRoute("/api/sesion")({
  server: {
    handlers: {
      GET: async ({ request }) =>
        Response.json({
          protegido: authConfigurada(),
          usuario: await verificarSesion(request.headers.get("cookie")),
        }),
    },
  },
});
