import { BadgeCheck, FlaskConical, Globe } from "lucide-react";

export type FuenteDato = "real" | "publico" | "ilustrativo" | "mixto";

const textos: Record<FuenteDato, string> = {
  real: "Real",
  publico: "Público · sitio Fortaleza",
  ilustrativo: "Ilustrativo",
  mixto: "Público + ilustrativo",
};

const clases: Record<FuenteDato, string> = {
  real: "bg-success/15 text-success",
  publico: "bg-[var(--series-1)]/15 text-[var(--series-1)]",
  ilustrativo: "bg-warning/15 text-warning",
  mixto: "bg-secondary text-secondary-foreground",
};

const titulos: Record<FuenteDato, string> = {
  real: "Datos reales de la cartera de socios",
  publico: "Hecho publicado por Fortaleza en su sitio (nombre, año y estado de los proyectos)",
  ilustrativo: "Supuestos de la demo: no son datos reales",
  mixto: "Combina hechos públicos con supuestos ilustrativos",
};

/** Insignia que distingue hechos públicos, datos reales y supuestos ilustrativos. */
export function FuenteBadge({
  fuente,
  sufijo,
}: {
  fuente: FuenteDato;
  sufijo?: string | undefined;
}) {
  const Icono = fuente === "ilustrativo" ? FlaskConical : fuente === "publico" ? Globe : BadgeCheck;
  return (
    <span
      data-fuente={fuente}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${clases[fuente]}`}
      title={titulos[fuente]}
    >
      <Icono className="size-3" />
      {textos[fuente]}
      {sufijo ? ` · ${sufijo}` : ""}
    </span>
  );
}
