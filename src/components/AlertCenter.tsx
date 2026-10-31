import { Link } from "@tanstack/react-router";
import { AlertOctagon, AlertTriangle, ArrowRight, Info, MessageSquareText } from "lucide-react";
import { FuenteBadge } from "@/components/FuenteBadge";
import type { Alerta, Severidad } from "@/server/alertas";

const estilo: Record<Severidad, { icono: typeof Info; texto: string; clase: string }> = {
  alta: { icono: AlertOctagon, texto: "Alta", clase: "text-destructive bg-destructive/10" },
  media: { icono: AlertTriangle, texto: "Media", clase: "text-warning bg-warning/15" },
  baja: { icono: Info, texto: "Baja", clase: "text-muted-foreground bg-muted" },
};

function separarEnlace(enlace: string) {
  const [to, query] = enlace.split("?");
  return { to: to ?? "/", search: Object.fromEntries(new URLSearchParams(query ?? "")) };
}

/** "Qué requiere atención hoy": alertas calculadas sobre los datos, con acceso a Fide. */
export function AlertCenter({ alertas, limite = 6 }: { alertas: Alerta[]; limite?: number }) {
  return (
    <ul className="divide-y">
      {alertas.slice(0, limite).map((a) => {
        const e = estilo[a.severidad];
        const Icono = e.icono;
        const destino = separarEnlace(a.enlace);
        return (
          <li key={a.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
            <span
              className={`inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${e.clase}`}
            >
              <Icono className="size-3.5" /> {e.texto}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {a.titulo}
                <span className="ml-2 text-xs font-normal text-muted-foreground">{a.area}</span>
                {a.fuente === "ilustrativo" && (
                  <span className="ml-2 align-middle">
                    <FuenteBadge fuente="ilustrativo" />
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">{a.detalle}</p>
            </div>
            <div className="flex shrink-0 gap-1 print:hidden">
              <Link
                to={destino.to as never}
                search={destino.search as never}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted"
              >
                Ver <ArrowRight className="size-3" />
              </Link>
              <Link
                to="/chat"
                search={{ q: a.pregunta }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-muted dark:text-sidebar-primary"
              >
                <MessageSquareText className="size-3" /> Fide
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
