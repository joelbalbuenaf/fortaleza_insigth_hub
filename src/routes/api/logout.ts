import { createFileRoute } from "@tanstack/react-router";
import { cookieBorrada } from "@/lib/auth";

export const Route = createFileRoute("/api/logout")({
  server: {
    handlers: {
      POST: ({ request }) =>
        Response.json({ ok: true }, { headers: { "set-cookie": cookieBorrada(request) } }),
    },
  },
});
