import {
  ArrowUpRight,
  Calculator,
  Check,
  Dice5,
  HardHat,
  MapPin,
  Plug,
  TrendingUp,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const soluciones = [
  {
    title: "Salud de cartera",
    icon: TrendingUp,
    category: "Cobranza y retención",
    description:
      "Qué socios están por caerse del plan y cuánta recaudación está en juego, con los factores de riesgo a la vista.",
    outputs: [
      "Mora por tramo de atraso, con el saldo de cada tramo",
      "Scoring de riesgo 0–100 con sus factores explícitos",
      "A quién contactar primero, por recaudación en juego",
    ],
    needs:
      "Usa la cartera ilustrativa. Para producción: el padrón de contratos con sus aportes mes a mes y el registro de gestiones de cobranza.",
    status: "Cartera ilustrativa",
    to: "/soluciones/cartera-salud",
  },
  {
    title: "Radar de adjudicaciones",
    icon: Dice5,
    category: "Sorteo y licitación",
    description:
      "Cómo viene la cola de adjudicación y qué chance tiene un socio en el próximo acto, separando sorteo de licitación.",
    outputs: [
      "Actos mes a mes, separando sorteo y licitación",
      "Oferta ganadora mínima: el corte de cada licitación",
      "Simulador de chance para el próximo acto",
    ],
    needs:
      "El mecanismo es público; los actos son ilustrativos. Para producción: las actas de sorteo y licitación, y las ofertas ganadoras históricas.",
    status: "Mecanismo público · actos ilustrativos",
    to: "/soluciones/adjudicaciones",
  },
  {
    title: "Calce financiero de obra",
    icon: HardHat,
    category: "Obra y fondeo",
    description:
      "Si los aportes alcanzan para el cronograma comprometido, proyecto por proyecto, y dónde la obra va por delante del fondeo.",
    outputs: [
      "Avance de obra contra cronograma, por torre",
      "Aportes asignados contra costo de lo ejecutado",
      "Proyección de caja de obra de los próximos meses",
    ],
    needs:
      "Los proyectos y años de entrega son públicos; el avance y los costos son supuestos. Para producción: certificados de avance y costos por proyecto.",
    status: "Público + ilustrativo",
    to: "/soluciones/obra",
  },
  {
    title: "Evaluador de terrenos",
    icon: MapPin,
    category: "Expansión",
    description:
      "Dónde comprar el próximo terreno en Asunción: demanda del entorno, precio de m², avenidas y competencia cercana.",
    outputs: [
      "Puntaje 0–100 con factores explícitos",
      "Ranking de barrios candidatos",
      "Competencia a 1 km y canibalización con proyectos propios",
    ],
    needs:
      "Modelo ilustrativo. Para producción: precios de m² relevados, un registro de edificios de la competencia, y la verificación de zonificación y títulos.",
    status: "Modelo ilustrativo",
    to: "/soluciones/terrenos",
  },
  {
    title: "Simulador de planes",
    icon: Calculator,
    category: "Comercial",
    description:
      "Cronograma de aportes de un plan: cuotas antes de la adjudicación, saldo financiado después y refuerzos.",
    outputs: [
      "Cuota de cada tramo y cronograma completo",
      "Intereses, incluidos los capitalizados durante la obra",
      "Exportación a CSV y PDF",
    ],
    needs:
      "Es la misma lógica del cuotero que ya usa el equipo, verificada contra su salida. Para producción: los valores y tasas vigentes de cada plan.",
    status: "Lógica verificada contra el cuotero",
    to: "/soluciones/simulador",
  },
] as const;

export function HubSolutions() {
  return (
    <section aria-labelledby="solutions-title" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-chart-4 dark:text-sidebar-primary">
            Inteligencia para decidir
          </p>
          <h2 id="solutions-title" className="mt-1 text-2xl font-bold">
            Soluciones
          </h2>
        </div>
        <span className="text-sm text-muted-foreground">
          5 módulos navegables · catálogo público + cartera ilustrativa
        </span>
      </div>
      <div className="grid gap-4 [grid-auto-rows:1fr] md:grid-cols-2 xl:grid-cols-3">
        {soluciones.map((solucion) => {
          const Icon = solucion.icon;
          return (
            <article
              key={solucion.title}
              className="flex h-full min-w-0 flex-col rounded-lg border bg-card p-5 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="text-right text-xs text-muted-foreground">
                  {solucion.category}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{solucion.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {solucion.description}
              </p>
              <div className="mt-auto pt-5">
                <p className="mb-3 flex items-start gap-2 text-xs text-muted-foreground">
                  <Plug className="size-3.5 shrink-0" />
                  {solucion.status}
                </p>
                <div className="flex gap-2">
                  <Button asChild className="flex-1 justify-between">
                    <Link to={solucion.to as never}>
                      Abrir módulo <ArrowUpRight className="size-4" />
                    </Link>
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline">Detalle</Button>
                    </DialogTrigger>
                    <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
                      <DialogHeader>
                        <DialogTitle className="pr-5 leading-snug">{solucion.title}</DialogTitle>
                        <DialogDescription className="pt-2 leading-relaxed">
                          {solucion.description}
                        </DialogDescription>
                      </DialogHeader>
                      <div>
                        <h4 className="text-sm font-semibold">Qué incluye</h4>
                        <ul className="mt-3 space-y-3 text-sm">
                          {solucion.outputs.map((output) => (
                            <li key={output} className="flex items-start gap-2">
                              <Check className="mt-0.5 size-4 shrink-0 text-success" />
                              {output}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-semibold">Datos y conexiones necesarios</h4>
                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                          {solucion.needs}
                        </p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
