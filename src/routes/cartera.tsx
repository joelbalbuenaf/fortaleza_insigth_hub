import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MessageSquareText, Printer } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { FilterBar, type CampoFiltro } from "@/components/filters/FilterBar";
import {
  Desercion,
  Estadistica,
  Forecast,
  Mora,
  Resumen,
  Sucursales,
  Territorio,
} from "@/components/cartera/Pestanas";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { etiquetaRango } from "@/lib/data/periodos";
import { obtenerCartera, type TabCartera } from "@/lib/hub/api";
import { validarFiltrosUrl, type FiltrosUrl } from "@/lib/filtros-url";

const pestanas: { id: TabCartera; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "territorio", label: "Territorio" },
  { id: "sucursales", label: "Sucursales y canales" },
  { id: "mora", label: "Mora" },
  { id: "desercion", label: "Deserción" },
  { id: "forecast", label: "Forecast" },
  { id: "estadistica", label: "Estadística" },
];

const filtrosPorPestana: Record<TabCartera, CampoFiltro[]> = {
  resumen: ["periodo", "plan", "sucursal"],
  territorio: ["periodo", "plan"],
  sucursales: ["periodo", "plan"],
  mora: ["periodo", "plan", "sucursal"],
  desercion: [],
  forecast: ["plan"],
  estadistica: ["periodo", "plan"],
};

type Busqueda = FiltrosUrl & { tab?: TabCartera; aj?: number };

export const Route = createFileRoute("/cartera")({
  validateSearch: (search: Record<string, unknown>): Busqueda => {
    const tab = pestanas.find((p) => p.id === search["tab"])?.id;
    const aj = Number(search["aj"]);
    return {
      ...validarFiltrosUrl(search),
      ...(tab && tab !== "resumen" ? { tab } : {}),
      ...(Number.isFinite(aj) && aj !== 0
        ? { aj: Math.max(-30, Math.min(30, Math.round(aj))) }
        : {}),
    };
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => obtenerCartera({ data: deps }),
  head: () => ({
    meta: [
      { title: "Cartera de aportes · Fortaleza" },
      {
        name: "description",
        content:
          "Recaudación del Sistema de Ahorro: territorio, sucursales, mora, deserción y forecast.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const search = Route.useSearch();
  const datos = Route.useLoaderData();
  const navigate = useNavigate();
  const tab = search.tab ?? "resumen";
  const mostrar = filtrosPorPestana[tab];

  return (
    <main className="pb-10">
      <PageHeader
        eyebrow="Sistema de Ahorro"
        title="Cartera de aportes"
        desc="Recaudación, crecimiento de la cartera, mora, deserción y proyección."
        periodo={etiquetaRango(datos.filtros.desde, datos.filtros.hasta)}
        fuente="ilustrativo"
        acciones={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> PDF
            </Button>
            <Button asChild>
              <Link to="/chat">
                <MessageSquareText /> Consultar a Fide
              </Link>
            </Button>
          </>
        }
      />
      <div className="space-y-6 px-6 md:px-10">
        <Tabs
          value={tab}
          onValueChange={(v) =>
            void navigate({
              to: ".",
              search: (prev: Record<string, unknown>) => ({
                ...prev,
                tab: v === "resumen" ? undefined : v,
                aj: undefined,
              }),
              replace: true,
            } as never)
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="overflow-x-auto pb-1">
              <TabsList className="w-max">
                {pestanas.map((p) => (
                  <TabsTrigger key={p.id} value={p.id}>
                    {p.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {mostrar.length > 0 && <FilterBar filtros={search} mostrar={mostrar} />}
          </div>
        </Tabs>
        {datos.tab === "resumen" && <Resumen datos={datos} />}
        {datos.tab === "territorio" && <Territorio datos={datos} />}
        {datos.tab === "sucursales" && <Sucursales datos={datos} />}
        {datos.tab === "mora" && <Mora datos={datos} />}
        {datos.tab === "desercion" && <Desercion datos={datos} />}
        {datos.tab === "forecast" && <Forecast datos={datos} />}
        {datos.tab === "estadistica" && <Estadistica datos={datos} />}
      </div>
    </main>
  );
}
