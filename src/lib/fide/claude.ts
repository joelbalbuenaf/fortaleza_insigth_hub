// Fide con Claude: tool runner del SDK oficial con streaming. Las herramientas publican sus
// resultados y gráficos en la UI mientras Claude razona y escribe.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { aMensajesAnthropic } from "./historial";
import { SYSTEM_PROMPT } from "./prompt";
import { herramientas, type ResultadoHerramienta } from "./tools";
import type { FideUIMessage, EscritorFide } from "./writer";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

export const modeloFide = () => process.env["FIDE_MODEL"] || "claude-opus-5-5";

export async function responderConClaude(
  mensajes: FideUIMessage[],
  w: EscritorFide,
  signal?: AbortSignal,
) {
  const client = new Anthropic();
  const effortEnv = process.env["FIDE_EFFORT"] as Effort | undefined;
  const effort: Effort = effortEnv && EFFORTS.includes(effortEnv) ? effortEnv : "medium";

  const tools = herramientas.map((h) =>
    betaZodTool({
      name: h.name,
      description: h.description,
      inputSchema: h.inputSchema,
      eager_input_streaming: true,
      run: async (input, ctx) => {
        const { resultado, graficos } = await w.herramienta(
          h.name,
          input,
          () => (h.run as (i: unknown) => ResultadoHerramienta)(input),
          ctx?.toolUse.id,
        );
        for (const g of graficos ?? []) w.grafico(g);
        return JSON.stringify(resultado);
      },
    }),
  );

  const runner = client.beta.messages.toolRunner(
    {
      model: modeloFide(),
      max_tokens: 32000,
      thinking: { type: "adaptive", display: "summarized" },
      output_config: { effort },
      // Prompt estable cacheado: herramientas + sistema forman el prefijo reutilizable.
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: aMensajesAnthropic(mensajes),
      tools,
      stream: true,
      max_iterations: 8,
      thread: false,
      // Si un clasificador rechaza la consulta, la API reintenta con el modelo de respaldo.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    },
    { signal },
  );

  for await (const stream of runner) {
    // Índice de bloque → id de la parte de texto/razonamiento abierta.
    const abiertos = new Map<number, { tipo: "texto" | "razonamiento"; id: string }>();
    for await (const ev of stream) {
      if (ev.type === "content_block_start") {
        const b = ev.content_block;
        if (b.type === "text") abiertos.set(ev.index, { tipo: "texto", id: w.textoInicio() });
        else if (b.type === "thinking")
          abiertos.set(ev.index, { tipo: "razonamiento", id: w.razonamientoInicio() });
        else if (b.type === "tool_use") w.herramientaInicio(b.id, b.name);
      } else if (ev.type === "content_block_delta") {
        const abierto = abiertos.get(ev.index);
        if (!abierto) continue;
        if (ev.delta.type === "text_delta") w.textoDelta(abierto.id, ev.delta.text);
        else if (ev.delta.type === "thinking_delta" && ev.delta.thinking)
          w.razonamientoDelta(abierto.id, ev.delta.thinking);
      } else if (ev.type === "content_block_stop") {
        const abierto = abiertos.get(ev.index);
        if (abierto) (abierto.tipo === "texto" ? w.textoFin : w.razonamientoFin)(abierto.id);
        abiertos.delete(ev.index);
      }
    }
    const mensaje = await stream.finalMessage();
    const u = mensaje.usage;
    console.info(
      `[fide] ${mensaje.model} stop=${mensaje.stop_reason} in=${u.input_tokens} cache_read=${u.cache_read_input_tokens ?? 0} cache_write=${u.cache_creation_input_tokens ?? 0} out=${u.output_tokens}`,
    );
    if (mensaje.stop_reason === "refusal") {
      const id = w.textoInicio();
      w.textoDelta(
        id,
        "\n\nNo puedo ayudar con esa consulta. Probá reformularla sobre los datos del Hub.",
      );
      w.textoFin(id);
      break;
    }
    if (
      mensaje.stop_reason === "max_tokens" &&
      mensaje.content.some((b) => b.type === "tool_use")
    ) {
      throw new Error(
        "La respuesta se cortó antes de completar una herramienta. Probá con una pregunta más acotada.",
      );
    }
  }
}

/** Mensaje claro en español para los errores de la API. */
export function mensajeDeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError)
    return "La ANTHROPIC_API_KEY no es válida. Revisá el archivo .env.";
  if (e instanceof Anthropic.PermissionDeniedError)
    return "La API key no tiene permiso para usar este modelo.";
  if (e instanceof Anthropic.RateLimitError)
    return "Demasiadas consultas a Claude: esperá unos segundos y reintentá.";
  if (e instanceof Anthropic.BadRequestError) return `Claude rechazó la solicitud: ${e.message}`;
  if (e instanceof Anthropic.APIError && e.status === 529)
    return "Claude está saturado en este momento. Reintentá en un minuto.";
  if (e instanceof Anthropic.APIConnectionError)
    return "No se pudo conectar con Claude. Revisá la conexión a internet.";
  if (e instanceof Error && e.name === "AbortError") return "Consulta cancelada.";
  return e instanceof Error ? e.message : "No se pudo obtener respuesta de Fide.";
}
