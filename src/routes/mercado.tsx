import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Kpi, PageHeader } from "@/components/AppShell";
import { ChartView } from "@/components/charts/ChartView";
import { BotonCsv, Seccion, Tabla, Variacion } from "@/components/comercial/comun";
import { FilterBar } from "@/components/filters/FilterBar";
import { HubMap, type CapaMapa } from "@/components/map/HubMap";
import { etiquetaRango } from "@/lib/data/periodos";
import { fmtNumero } from "@/lib/export";
import { aFiltrosCartera, validarFiltrosUrl } from "@/lib/filtros-url";
import { obtenerMercado } from "@/lib/hub/api";

export const Route = createFileRoute("/mercado")({
  validateSearch: validarFiltrosUrl,
  loaderDeps: ({ search: { p } }) => (p ? { p } : {}),
  loader: ({ deps }) => obtenerMercado({ data: deps }),
  head: () => ({
    meta: [
      { title: "Mercado · Fortaleza" },
      {
        name: "description",
        content: "Precio de m² por barrio de Asunción, competencia y absorción del mercado.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const search = Route.useSearch();
  const d = Route.useLoaderData();
  const f = aFiltrosCartera(search);
  const r = d.resumen;

  const capas: CapaMapa[] = [
    {
      id: "precios",
      nombre: "Precio de m² por barrio",
      color: "var(--series-4)",
      radio: [6, 24],
      puntos: d.precios.map((p) => ({
        id: p.barrio,
        lat: p.lat,
        lng: p.lng,
        titulo: p.barrio,
        valor: p.precioM2Usd,
        detalle: `USD ${fmtNumero(p.precioM2Usd, 0)}/m² · ${p.variacionPct > 0 ? "+" : ""}${fmtNumero(p.variacionPct)}% interanual\n${p.competencia} edificios de la competencia · ${p.fortaleza} de Fortaleza`,
      })),
    },
  ];

  return (
    <main className="pb-10">
      <PageHeader
        eyebrow="Reportes"
        title="Mercado"
        desc="Precio de m² por barrio de Asunción, competencia por desarrolladora y absorción de departamentos."
        periodo={etiquetaRango(f.desde, f.hasta)}
        fuente="ilustrativo"
        acciones={<FilterBar filtros={search} mostrar={["periodo"]} />}
      />
      <div className="space-y-6 px-6 md:px-10">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="m² medio de Asunción"
            value={`USD ${fmtNumero(r.precioM2MedioUsd, 0)}`}
            hint={`Máximo: ${r.barrioMasCaro}, USD ${fmtNumero(r.precioM2MaximoUsd, 0)}/m²`}
          />
          <Kpi
            label="Edificios de la competencia"
            value={fmtNumero(r.edificiosCompetencia, 0)}
            hint={`${fmtNumero(r.unidadesCompetencia, 0)} unidades · ${r.proyectosFortaleza} proyectos de Fortaleza`}
          />
          <Kpi
            label="Absorción · 12 meses"
            value={`${fmtNumero(r.absorcionAnualUnidades, 0)} unidades`}
            hint={`${fmtNumero(r.mesesDeStock)} meses de stock`}
          />
          <Kpi
            label="Barrios sin presencia"
            value={fmtNumero(r.barriosSinPresencia, 0)}
            hint="Con competencia construyendo y sin proyectos propios"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <Seccion titulo="Precio de m² en el mapa">
              <HubMap capas={capas} alto={420} />
            </Seccion>
          </div>
          <div className="space-y-6 xl:col-span-2">
            <Seccion titulo="Competencia por desarrolladora">
              <ChartView spec={d.graficos.competencia} alto={240} />
            </Seccion>
            <Seccion titulo="Absorción mensual">
              <ChartView spec={d.graficos.absorcion} alto={240} />
            </Seccion>
          </div>
        </div>

        <Seccion titulo="Precio de m² por barrio">
          <ChartView spec={d.graficos.precios} />
        </Seccion>

        <div className="grid gap-6 xl:grid-cols-2">
          <Seccion titulo="Barrios" acciones={<BotonCsv filas={d.precios} nombre="precios-m2" />}>
            <Tabla
              alto={420}
              filas={d.precios}
              clave={(p) => p.barrio}
              columnas={[
                { titulo: "Barrio", valor: (p) => p.barrio },
                { titulo: "Zona", valor: (p) => p.zona },
                { titulo: "USD/m²", valor: (p) => fmtNumero(p.precioM2Usd, 0), numero: true },
                {
                  titulo: "Interanual",
                  valor: (p) => <Variacion pct={p.variacionPct} />,
                  numero: true,
                },
                { titulo: "Competencia", valor: (p) => p.competencia, numero: true },
                { titulo: "Fortaleza", valor: (p) => p.fortaleza, numero: true },
              ]}
            />
          </Seccion>
          <Seccion
            titulo="Dónde construye la competencia y Fortaleza no"
            acciones={
              <div className="flex gap-2">
                <BotonCsv filas={d.sinPresencia} nombre="barrios-sin-presencia" />
                <Link
                  to="/soluciones/terrenos"
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"
                >
                  Evaluar <ArrowRight className="size-3" />
                </Link>
              </div>
            }
          >
            <p className="mb-3 text-sm text-muted-foreground">
              Barrios con 4 o más edificios de la competencia (ilustrativos) y ningún proyecto de
              Fortaleza.
            </p>
            <Tabla
              alto={360}
              filas={d.sinPresencia}
              clave={(b) => b.barrio}
              columnas={[
                { titulo: "Barrio", valor: (b) => b.barrio },
                { titulo: "Competencia", valor: (b) => b.competencia, numero: true },
                { titulo: "USD/m²", valor: (b) => fmtNumero(b.precioM2Usd, 0), numero: true },
                {
                  titulo: "Proyecto más cercano",
                  valor: (b) => `${b.proyectoMasCercano} (${fmtNumero(b.distanciaKm)} km)`,
                },
              ]}
            />
          </Seccion>
        </div>
      </div>
    </main>
  );
}
