import { createFileRoute } from "@tanstack/react-router";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import { mensajeDeError, modeloFide, responderConClaude } from "@/lib/fide/claude";
import { responderEnDemo } from "@/lib/fide/demo";
import { ultimaPregunta } from "@/lib/fide/historial";
import { crearEscritor, type FideUIMessage } from "@/lib/fide/writer";

const MAX_BYTES = 400_000;
const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 20;
const consultas = new Map<string, number[]>();

// Límite simple en memoria por IP: suficiente para una demo en un solo servidor.
function limitar(ip: string) {
  const ahora = Date.now();
  const recientes = (consultas.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  recientes.push(ahora);
  consultas.set(ip, recientes);
  return recientes.length > MAX_POR_VENTANA;
}

const usarClaude = () => Boolean(process.env["ANTHROPIC_API_KEY"]);

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      GET: () =>
        Response.json(usarClaude() ? { modo: "claude", modelo: modeloFide() } : { modo: "demo" }),
      POST: async ({ request }) => {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
        if (limitar(ip))
          return new Response("Demasiadas consultas, esperá un momento.", { status: 429 });
        if (Number(request.headers.get("content-length") ?? 0) > MAX_BYTES)
          return new Response("La conversación es demasiado larga. Empezá una nueva.", {
            status: 413,
          });

        const body = (await request.json().catch(() => null)) as {
          messages?: FideUIMessage[];
        } | null;
        if (!body || !Array.isArray(body.messages) || !body.messages.length)
          return new Response("Solicitud inválida", { status: 400 });
        const mensajes = body.messages;

        const stream = createUIMessageStream<FideUIMessage>({
          execute: async ({ writer }) => {
            const w = crearEscritor(writer);
            if (usarClaude()) await responderConClaude(mensajes, w, request.signal);
            else await responderEnDemo(ultimaPregunta(mensajes), w, request.signal);
          },
          onError: (e) => {
            console.error(e);
            return mensajeDeError(e);
          },
        });
        return createUIMessageStreamResponse({ stream });
      },
    },
  },
});
