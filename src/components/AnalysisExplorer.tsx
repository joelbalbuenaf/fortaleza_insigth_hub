import { useState } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { categoriasPreguntas, oportunidades } from "@/lib/analytical-questions";

export function AnalysisExplorer({
  onAsk,
  disabled = false,
}: {
  onAsk: (text: string) => void;
  disabled?: boolean;
}) {
  const [category, setCategory] = useState("Red de operadores");
  const [search, setSearch] = useState("");
  const entries = Object.entries(categoriasPreguntas);
  const questions = (
    search ? entries.flatMap(([, v]) => v) : (entries.find(([k]) => k === category)?.[1] ?? [])
  ).filter((q) => q.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return (
    <div className="w-full space-y-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display font-semibold">Explorar análisis</h3>
        <span className="text-xs text-muted-foreground">
          {entries.flatMap(([, v]) => v).length} preguntas sugeridas
        </span>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          aria-label="Buscar preguntas"
          placeholder="Buscar preguntas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {entries.map(([k]) => (
          <Button
            size="sm"
            key={k}
            variant={category === k ? "default" : "ghost"}
            onClick={() => {
              setCategory(k);
              setSearch("");
            }}
          >
            {k}
          </Button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {questions.map((q) => (
          <Button
            key={q}
            disabled={disabled}
            variant="outline"
            onClick={() => onAsk(q)}
            className="h-auto min-h-14 justify-between whitespace-normal p-3 text-left leading-relaxed"
          >
            {q}
            <ArrowUpRight className="shrink-0" />
          </Button>
        ))}
      </div>
      {questions.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay sugerencias para esta búsqueda.</p>
      )}
      {category === "Oportunidades" && !search && (
        <div className="space-y-3 border-t pt-4">
          {oportunidades.map((o) => (
            <div key={o.titulo} className="border-l-2 border-accent pl-4">
              <p className="text-sm font-semibold">
                {o.titulo}{" "}
                <span className="ml-2 text-xs text-muted-foreground">
                  Prioridad {o.prioridad.toLowerCase()}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{o.evidencia}</p>
              <p className="mt-1 text-sm">{o.accion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
