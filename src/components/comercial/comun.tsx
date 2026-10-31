import type { ReactNode } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportarCsv } from "@/lib/export";

export function Seccion({
  titulo,
  children,
  acciones,
}: {
  titulo: string;
  children: ReactNode;
  acciones?: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border bg-card p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{titulo}</h2>
        {acciones}
      </div>
      {children}
    </section>
  );
}

export function BotonCsv({ filas, nombre }: { filas: object[]; nombre: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => exportarCsv(filas, nombre)}>
      <Download className="size-3.5" /> CSV
    </Button>
  );
}

/** Tabla simple con encabezado fijo; las columnas numéricas se alinean a la derecha. */
export function Tabla<T>({
  columnas,
  filas,
  clave,
  onFila,
  seleccionada,
  alto,
}: {
  columnas: { titulo: string; valor: (f: T) => ReactNode; numero?: boolean }[];
  filas: T[];
  clave: (f: T) => string;
  onFila?: (f: T) => void;
  seleccionada?: string | undefined;
  alto?: number;
}) {
  return (
    <div className="overflow-auto rounded-lg border" style={alto ? { maxHeight: alto } : undefined}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {columnas.map((c) => (
              <th
                key={c.titulo}
                className={`whitespace-nowrap p-2.5 ${c.numero ? "text-right" : ""}`}
              >
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const k = clave(f);
            return (
              <tr
                key={k}
                onClick={onFila ? () => onFila(f) : undefined}
                className={`border-t ${onFila ? "cursor-pointer hover:bg-muted/60" : ""} ${seleccionada === k ? "bg-secondary" : ""}`}
              >
                {columnas.map((c) => (
                  <td
                    key={c.titulo}
                    className={`p-2.5 ${c.numero ? "text-right tabular-nums" : ""}`}
                  >
                    {c.valor(f)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Píldora de estado con texto (nunca solo color). */
export function Cumplimiento({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return <span className="text-muted-foreground">—</span>;
  const clase =
    pct >= 100
      ? "bg-success/15 text-success"
      : pct >= 95
        ? "bg-warning/15 text-warning"
        : "bg-destructive/10 text-destructive";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${clase}`}>
      {pct.toLocaleString("es-PY", { maximumFractionDigits: 1 })}%
    </span>
  );
}

export function Variacion({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={pct >= 0 ? "text-success" : "text-destructive"}>
      {pct > 0 ? "+" : ""}
      {pct.toLocaleString("es-PY", { maximumFractionDigits: 1 })}%
    </span>
  );
}
