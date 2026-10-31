import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MessageSquareText } from "lucide-react";
import { Kpi, PageHeader } from "@/components/AppShell";
import { ChartView } from "@/components/charts/ChartView";
import { BotonCsv, Seccion, Tabla } from "@/components/comercial/comun";
import { FuenteBadge } from "@/components/FuenteBadge";
import { HubMap, type CapaMapa } from "@/components/map/HubMap";
import { Button } from "@/components/ui/button";
import { proyectos, PROYECTOS_ENTREGADOS_SEGUN_SITIO } from "@/lib/data/proyectos";
import { fmtNumero } from "@/lib/export";
import { obtenerProyectos } from "@/lib/hub/api";

export const Route = createFileRoute("/proyectos")({
  loader: () => obtenerProyectos(),
  head: () => ({
    meta: [
      { title: "Proyectos y obra · Fortaleza" },
      {
        name: "description",
        content: "Catálogo de proyectos de Fortaleza Inmuebles y avance de las torres en obra.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const d = Route.useLoaderData();
  const r = d.resumen;

  const capas: CapaMapa[] = [
    {
      id: "entregados",
      nombre: "Entregados",
      color: "var(--series-muted)",
      radio: [6, 18],
      puntos: proyectos
        .filter((p) => p.estado === "Entregado")
        .map((p) => ({
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          titulo: p.nombre,
          valor: p.unidades,
          detalle: `${p.barrio} · entregado en ${p.anio}\n${p.pisos} pisos · ${p.unidades} unidades (supuesto)`,
        })),
    },
    {
      id: "obra",
      nombre: "En construcción",
      color: "var(--series-1)",
      radio: [8, 22],
      puntos: proyectos
        .filter((p) => p.estado === "En construcción")
        .map((p) => ({
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          titulo: p.nombre,
          valor: p.unidades,
          detalle: `${p.barrio} · entrega prevista ${p.anio}\n${p.pisos} pisos · ${p.unidades} unidades (supuesto)`,
        })),
    },
  ];

  return (
    <main className="pb-10">
      <PageHeader
        eyebrow="Catálogo"
        title="Proyectos y obra"
        desc="Los proyectos de Fortaleza en el mapa de Asunción, y el avance de las torres en construcción."
        periodo="Ene–Sep 2026"
        fuente="mixto"
        acciones={
          <Button asChild>
            <Link to="/chat" search={{ q: "¿Qué obras están atrasadas frente al cronograma?" }}>
              <MessageSquareText /> Analizar con Fide
            </Link>
          </Button>
        }
      />
      <div className="space-y-6 px-6 md:px-10">
        <p className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-xs leading-relaxed">
          <FuenteBadge fuente="publico" />
          <span>
            Nombre, año de entrega y estado salen del sitio de Fortaleza. Los pisos, unidades,
            tipologías y el avance de obra son <strong>supuestos de la demo</strong>. El sitio
            informa {PROYECTOS_ENTREGADOS_SEGUN_SITIO} proyectos entregados pero nombra menos: este
            catálogo cubre los nombrados.
          </span>
        </p>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Proyectos entregados"
            value={fmtNumero(r.entregadas, 0)}
            hint={`${PROYECTOS_ENTREGADOS_SEGUN_SITIO} según el sitio de Fortaleza`}
          />
          <Kpi
            label="En construcción"
            value={fmtNumero(r.proyectosEnObra, 0)}
            hint={`${fmtNumero(r.unidadesEnObra, 0)} unidades en obra`}
          />
          <Kpi
            label="Avance medio de obra"
            value={`${fmtNumero(r.avanceMedioPct)}%`}
            hint={`${r.atrasadas} atrasada${r.atrasadas === 1 ? "" : "s"} · ${r.enAtencion} en atención`}
          />
          <Kpi
            label="Costo estimado en obra"
            value={`Gs ${fmtNumero(r.costoTotalMM, 0)} MM`}
            hint="Supuesto, a partir de m² y costo por m²"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <Seccion titulo="Proyectos en el mapa">
              <HubMap capas={capas} alto={460} />
              <p className="mt-2 text-xs text-muted-foreground">
                Tamaño = unidades. Los puntos están en el centro del barrio asignado, no en la
                ubicación real de la obra.
              </p>
            </Seccion>
          </div>
          <div className="space-y-6 xl:col-span-2">
            <Seccion titulo="Mix por tipología">
              <ChartView spec={d.graficos.tipologias} alto={240} />
            </Seccion>
            <Seccion titulo="Avance vs. cronograma">
              <ChartView spec={d.graficos.avance} alto={240} />
            </Seccion>
          </div>
        </div>

        <Seccion titulo="Unidades por proyecto">
          <ChartView spec={d.graficos.unidades} />
        </Seccion>

        <Seccion
          titulo="Catálogo"
          acciones={
            <div className="flex gap-2">
              <BotonCsv filas={d.proyectos} nombre="proyectos" />
              <Link
                to="/soluciones/obra"
                className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
              >
                Calce financiero <ArrowRight className="size-3" />
              </Link>
            </div>
          }
        >
          <Tabla
            alto={460}
            filas={d.proyectos}
            clave={(p) => p.id}
            columnas={[
              { titulo: "Proyecto", valor: (p) => <span title={p.completo}>{p.nombre}</span> },
              { titulo: "Barrio", valor: (p) => p.barrio },
              { titulo: "Año", valor: (p) => p.anio, numero: true },
              {
                titulo: "Estado",
                valor: (p) => (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.estado === "En construcción" ? "bg-[var(--series-1)]/15 text-[var(--series-1)]" : "bg-muted text-muted-foreground"}`}
                  >
                    {p.estado}
                  </span>
                ),
              },
              { titulo: "Pisos", valor: (p) => p.pisos, numero: true },
              { titulo: "Unidades", valor: (p) => fmtNumero(p.unidades, 0), numero: true },
              { titulo: "m²", valor: (p) => fmtNumero(p.m2, 0), numero: true },
            ]}
          />
        </Seccion>

        <Seccion
          titulo="Tipologías"
          acciones={<BotonCsv filas={d.tipologias} nombre="tipologias" />}
        >
          <Tabla
            filas={d.tipologias}
            clave={(t) => t.tipologia}
            columnas={[
              { titulo: "Tipología", valor: (t) => t.tipologia },
              { titulo: "m² típicos", valor: (t) => t.m2, numero: true },
              { titulo: "Unidades", valor: (t) => fmtNumero(t.unidades, 0), numero: true },
              {
                titulo: "Participación",
                valor: (t) => `${fmtNumero(t.participacionPct)}%`,
                numero: true,
              },
            ]}
          />
        </Seccion>
      </div>
    </main>
  );
}
