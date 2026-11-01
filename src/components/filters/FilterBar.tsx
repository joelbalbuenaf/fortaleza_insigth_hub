import { useNavigate } from "@tanstack/react-router";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  asesores,
  nombrePlan,
  nombresBarrios,
  planes,
  presetsPeriodo,
  situaciones,
} from "@/lib/data";
import type { FiltrosUrl } from "@/lib/filtros-url";

const TODOS = "__todos";

export type CampoFiltro = "periodo" | "plan" | "asesor" | "situacion" | "barrio";

/** Barra de filtros en una fila sobre los gráficos; escribe en la URL de la página actual. */
export function FilterBar({
  filtros,
  mostrar = ["periodo", "plan", "asesor"],
}: {
  filtros: FiltrosUrl;
  mostrar?: CampoFiltro[];
}) {
  const navigate = useNavigate();
  const set = (cambio: { [K in keyof FiltrosUrl]?: FiltrosUrl[K] | undefined }) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => {
        const next = { ...prev, ...cambio } as Record<string, unknown>;
        for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
        return next;
      },
      replace: true,
    } as never);
  const activos = Boolean(
    filtros.p || filtros.plan || filtros.ase || filtros.sit || filtros.barrio,
  );

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-card print:hidden"
      role="group"
      aria-label="Filtros"
    >
      {mostrar.includes("periodo") && (
        <Select
          value={filtros.p ?? "ytd"}
          onValueChange={(v) => set({ p: v === "ytd" ? undefined : v })}
        >
          <SelectTrigger className="h-9 w-48" aria-label="Período">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {presetsPeriodo.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {mostrar.includes("plan") && (
        <Select
          value={filtros.plan ?? TODOS}
          onValueChange={(v) => set({ plan: v === TODOS ? undefined : (v as FiltrosUrl["plan"]) })}
        >
          <SelectTrigger className="h-9 w-52" aria-label="Plan">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los planes</SelectItem>
            {planes.map((p) => (
              <SelectItem key={p} value={p}>
                {nombrePlan[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {mostrar.includes("asesor") && (
        <Select
          value={filtros.ase ?? TODOS}
          onValueChange={(v) => set({ ase: v === TODOS ? undefined : (v as FiltrosUrl["ase"]) })}
        >
          <SelectTrigger className="h-9 w-44" aria-label="Asesor">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los asesores</SelectItem>
            {asesores.map((a) => (
              <SelectItem key={a} value={a}>
                Asesor {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {mostrar.includes("situacion") && (
        <Select
          value={filtros.sit ?? TODOS}
          onValueChange={(v) => set({ sit: v === TODOS ? undefined : (v as FiltrosUrl["sit"]) })}
        >
          <SelectTrigger className="h-9 w-48" aria-label="Situación del contrato">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Toda la cartera</SelectItem>
            {situaciones.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {mostrar.includes("barrio") && (
        <Select
          value={filtros.barrio ?? TODOS}
          onValueChange={(v) => set({ barrio: v === TODOS ? undefined : v })}
        >
          <SelectTrigger className="h-9 w-48" aria-label="Barrio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los barrios</SelectItem>
            {nombresBarrios.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {activos && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() =>
            set({
              p: undefined,
              plan: undefined,
              ase: undefined,
              sit: undefined,
              barrio: undefined,
            })
          }
        >
          <RotateCcw className="size-3.5" /> Limpiar
        </Button>
      )}
    </div>
  );
}
