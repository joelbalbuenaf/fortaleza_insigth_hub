// Traduce los eventos de Fide (texto, razonamiento, herramientas, gráficos) a partes del
// stream de UI que consume `useChat`.
import type { UIMessage, UIMessageStreamWriter } from "ai";
import type { ChartSpec } from "@/lib/charts";
import { buscarHerramienta, type ResultadoHerramienta } from "./tools";

export type FideUIMessage = UIMessage<never, { chart: ChartSpec }>;

let secuencia = 0;
const nuevoId = (prefijo: string) =>
  `${prefijo}-${Date.now().toString(36)}-${(secuencia++).toString(36)}`;

/** Resumen liviano del resultado para mostrar en el chip de la herramienta. */
function resumenParaUI(nombre: string, input: unknown) {
  return { herramienta: nombre, etiqueta: buscarHerramienta(nombre)?.etiqueta ?? nombre, input };
}

export function crearEscritor(writer: UIMessageStreamWriter<FideUIMessage>) {
  return {
    textoInicio(id = nuevoId("txt")) {
      writer.write({ type: "text-start", id });
      return id;
    },
    textoDelta(id: string, delta: string) {
      writer.write({ type: "text-delta", id, delta });
    },
    textoFin(id: string) {
      writer.write({ type: "text-end", id });
    },
    razonamientoInicio(id = nuevoId("raz")) {
      writer.write({ type: "reasoning-start", id });
      return id;
    },
    razonamientoDelta(id: string, delta: string) {
      writer.write({ type: "reasoning-delta", id, delta });
    },
    razonamientoFin(id: string) {
      writer.write({ type: "reasoning-end", id });
    },
    herramientaInicio(toolCallId: string, nombre: string) {
      writer.write({ type: "tool-input-start", toolCallId, toolName: nombre, dynamic: true });
    },
    /** Muestra la herramienta en curso, la ejecuta y publica su resultado. */
    async herramienta(
      nombre: string,
      input: unknown,
      ejecutar: () => Promise<ResultadoHerramienta> | ResultadoHerramienta,
      toolCallId = nuevoId("tool"),
    ): Promise<ResultadoHerramienta> {
      writer.write({
        type: "tool-input-available",
        toolCallId,
        toolName: nombre,
        input,
        dynamic: true,
      });
      try {
        const r = await ejecutar();
        writer.write({
          type: "tool-output-available",
          toolCallId,
          output: resumenParaUI(nombre, input),
          dynamic: true,
        });
        return r;
      } catch (e) {
        writer.write({
          type: "tool-output-error",
          toolCallId,
          errorText: e instanceof Error ? e.message : String(e),
          dynamic: true,
        });
        throw e;
      }
    },
    grafico(g: ChartSpec) {
      writer.write({ type: "data-chart", id: g.id, data: g });
    },
    error(texto: string) {
      writer.write({ type: "error", errorText: texto });
    },
  };
}

export type EscritorFide = ReturnType<typeof crearEscritor>;
