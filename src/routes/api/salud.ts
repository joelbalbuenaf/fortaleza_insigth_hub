import { createFileRoute } from "@tanstack/react-router";

// Health check público para Render (no requiere sesión).
export const Route = createFileRoute("/api/salud")({
  server: { handlers: { GET: () => Response.json({ ok: true }) } },
});
