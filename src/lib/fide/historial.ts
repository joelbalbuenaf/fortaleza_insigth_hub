import type Anthropic from "@anthropic-ai/sdk";
import type { FideUIMessage } from "./writer";

const MAX_MENSAJES = 16;
const MAX_CARACTERES = 6000;

/** Texto de un mensaje de UI; los gráficos mostrados se resumen para que el modelo los recuerde. */
export function textoDeMensaje(m: FideUIMessage): string {
  const partes: string[] = [];
  for (const p of m.parts) {
    if (p.type === "text") partes.push(p.text);
    else if (p.type === "data-chart") partes.push(`[Gráfico mostrado: ${p.data.titulo}]`);
  }
  return partes.join("\n").slice(0, MAX_CARACTERES).trim();
}

/** Convierte el historial de la UI a mensajes de la API: solo texto, últimos turnos, empezando por usuario. */
export function aMensajesAnthropic(mensajes: FideUIMessage[]): Anthropic.Beta.BetaMessageParam[] {
  const salida: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of mensajes.slice(-MAX_MENSAJES)) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const texto = textoDeMensaje(m);
    if (!texto) continue;
    salida.push({ role: m.role, content: texto });
  }
  while (salida.length && salida[0]?.role !== "user") salida.shift();
  return salida;
}

export function ultimaPregunta(mensajes: FideUIMessage[]): string {
  const u = [...mensajes].reverse().find((m) => m.role === "user");
  return u ? textoDeMensaje(u) : "";
}
