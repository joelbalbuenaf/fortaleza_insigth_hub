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
import { nombrePlan, nombresBarrios, planes, presetsPeriodo, sucursales } from "@/lib/data";
import type { FiltrosUrl } from "@/lib/filtros-url";

const TODOS = "__todos";

export type CampoFiltro = "periodo" | "plan" | "sucursal" | "barrio";

/** Barra de filtros en una fila sobre los gráficos; escribe en la URL de la página actual. */
export function FilterBar({
  filtros,
  mostrar = ["periodo", "plan", "sucursal"],
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
  const activos = Boolean(filtros.p || filtros.plan || filtros.suc || filtros.barrio);

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
      {mostrar.includes("sucursal") && (
        <Select
          value={filtros.suc ?? TODOS}
          onValueChange={(v) => set({ suc: v === TODOS ? undefined : (v as FiltrosUrl["suc"]) })}
        >
          <SelectTrigger className="h-9 w-48" aria-label="Sucursal">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas las sucursales</SelectItem>
            {sucursales.map((s) => (
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
          onClick={() => set({ p: undefined, plan: undefined, suc: undefined, barrio: undefined })}
        >
          <RotateCcw className="size-3.5" /> Limpiar
        </Button>
      )}
    </div>
  );
}
