import { useState } from "react";
import {
  Brain,
  Check,
  ChevronDown,
  Copy,
  CornerDownRight,
  Loader2,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { ChartView } from "@/components/charts/ChartView";
import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { etiquetaDe } from "@/lib/fide/etiquetas";
import type { FideUIMessage } from "@/lib/fide/writer";

/** Separa el bloque final "Siguientes preguntas:" del texto de la respuesta. */
export function separarSugerencias(texto: string) {
  const m = texto.match(/\n*\**Siguientes preguntas:?\**\s*\n((?:\s*[-•*]\s.+\n?)+)\s*$/i);
  if (!m) return { texto, sugerencias: [] as string[] };
  const sugerencias = (m[1] ?? "")
    .split("\n")
    .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
  return { texto: texto.slice(0, m.index).trimEnd(), sugerencias };
}

type Parte = FideUIMessage["parts"][number];

function detalleInput(input: unknown) {
  if (!input || typeof input !== "object") return "";
  return Object.entries(input as Record<string, unknown>)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");
}

function ChipHerramienta({ parte }: { parte: Extract<Parte, { type: "dynamic-tool" }> }) {
  const listo = parte.state === "output-available";
  const error = parte.state === "output-error";
  const detalle = detalleInput(parte.input);
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
      {error ? (
        <TriangleAlert className="size-3.5 shrink-0 text-destructive" />
      ) : listo ? (
        <Check className="size-3.5 shrink-0 text-success" />
      ) : (
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
      )}
      <Wrench className="size-3 shrink-0 opacity-60" />
      <span className="font-medium text-foreground">{etiquetaDe(parte.toolName)}</span>
      {detalle && <span className="truncate">{detalle}</span>}
    </div>
  );
}

function Razonamiento({ texto, enCurso }: { texto: string; enCurso: boolean }) {
  return (
    <Collapsible className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground print:hidden">
      <CollapsibleTrigger className="flex w-full items-center gap-2 font-medium">
        <Brain className="size-3.5" />
        {enCurso ? "Fide está razonando…" : "Ver razonamiento"}
        <ChevronDown className="ml-auto size-3.5" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 whitespace-pre-wrap leading-relaxed">
        {texto}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function FideMessage({
  mensaje,
  ultimo,
  enCurso,
  onPreguntar,
}: {
  mensaje: FideUIMessage;
  ultimo: boolean;
  enCurso: boolean;
  onPreguntar: (texto: string) => void;
}) {
  const [copiado, setCopiado] = useState(false);
  if (mensaje.role === "user")
    return (
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
        {mensaje.parts.map((p, i) =>
          p.type === "text" ? (
            <p key={i} className="whitespace-pre-wrap">
              {p.text}
            </p>
          ) : null,
        )}
      </div>
    );

  const textoCompleto = mensaje.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
  const sugerencias = separarSugerencias(textoCompleto).sugerencias;
  const herramientas = mensaje.parts.filter((p) => p.type === "dynamic-tool");

  return (
    <div className="group min-w-0 space-y-3">
      {herramientas.length > 0 && (
        <div className="grid gap-1.5 print:hidden">
          {herramientas.map((p) => (
            <ChipHerramienta key={p.toolCallId} parte={p} />
          ))}
        </div>
      )}
      {mensaje.parts.map((p, i) => {
        if (p.type === "reasoning" && p.text.trim())
          return (
            <Razonamiento key={i} texto={p.text} enCurso={enCurso && p.state === "streaming"} />
          );
        if (p.type === "data-chart")
          return (
            <div key={p.id ?? i} className="rounded-xl border bg-card p-4 shadow-card">
              <ChartView spec={p.data} onPreguntar={onPreguntar} />
            </div>
          );
        if (p.type === "text") {
          const { texto } = separarSugerencias(p.text);
          return texto.trim() ? (
            <div key={i} className="min-w-0">
              <MessageResponse className="fide-md">{texto}</MessageResponse>
            </div>
          ) : null;
        }
        return null;
      })}
      {!enCurso && textoCompleto && (
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => {
              void navigator.clipboard.writeText(separarSugerencias(textoCompleto).texto);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 1500);
            }}
          >
            {copiado ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copiado ? "Copiado" : "Copiar"}
          </Button>
        </div>
      )}
      {ultimo && !enCurso && sugerencias.length > 0 && (
        <div className="grid gap-2 border-t pt-3 sm:grid-cols-3 print:hidden">
          {sugerencias.map((s) => (
            <Button
              key={s}
              variant="outline"
              className="h-auto justify-start whitespace-normal p-2.5 text-left text-xs leading-snug"
              onClick={() => onPreguntar(s)}
            >
              <CornerDownRight className="mt-0.5 size-3.5 shrink-0 self-start" />
              {s}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
