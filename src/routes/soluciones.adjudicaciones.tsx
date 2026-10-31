import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Dice5, Gavel, Loader2 } from "lucide-react";
import { Kpi } from "@/components/AppShell";
import { ChartView } from "@/components/charts/ChartView";
import { BotonCsv, Seccion, Tabla } from "@/components/comercial/comun";
import { FilterBar } from "@/components/filters/FilterBar";
import { Contenido, EncabezadoSolucion } from "@/components/soluciones/comun";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtNumero } from "@/lib/export";
import { validarFiltrosUrl } from "@/lib/filtros-url";
import { obtenerAdjudicaciones, simularAdjudicacionFn } from "@/lib/hub/api";

export const Route = createFileRoute("/soluciones/adjudicaciones")({
  validateSearch: validarFiltrosUrl,
  loaderDeps: ({ search: { p } }) => (p ? { p } : {}),
  loader: ({ deps }) => obtenerAdjudicaciones({ data: deps }),
  head: () => ({ meta: [{ title: "Radar de adjudicaciones · Hub Fortaleza" }] }),
  component: Page,
});

type Simulacion = Awaited<ReturnType<typeof simularAdjudicacionFn>>;

function Page() {
  const search = Route.useSearch();
  const d = Route.useLoaderData();
  const r = d.resumen;

  const [antiguedad, setAntiguedad] = useState(48);
  const [pagado, setPagado] = useState(150);
  const [puntos, setPuntos] = useState(48);
  const [sim, setSim] = useState<Simulacion | null>(null);
  const [calculando, setCalculando] = useState(false);

  const simular = () => {
    setCalculando(true);
    void simularAdjudicacionFn({
      data: { antiguedadMeses: antiguedad, pagadoGs: pagado * 1_000_000, puntos },
    })
      .then(setSim)
      .finally(() => setCalculando(false));
  };

  return (
    <main className="pb-10">
      <EncabezadoSolucion
        categoria="Sorteo y licitación"
        titulo="Radar de adjudicaciones"
        desc="Cómo viene la cola de adjudicación, qué oferta está ganando las licitaciones y qué chance tiene un socio en el próximo acto."
        requiere="El mecanismo es público (sorteo por bolillas y licitación ante escribano); los actos y las ofertas son ilustrativos. Para producción hacen falta las actas de adjudicación y las ofertas ganadoras históricas."
        pregunta="¿Cómo viene la cola de adjudicación y qué espera tienen los socios?"
        fuente="ilustrativo"
      />
      <Contenido>
        <FilterBar filtros={search} mostrar={["periodo"]} />

        <p className="grid gap-3 rounded-lg border bg-card p-4 text-sm leading-relaxed shadow-card md:grid-cols-2">
          <span className="flex gap-3">
            <Dice5 className="mt-0.5 size-5 shrink-0 text-[var(--series-1)]" />
            <span>
              <strong>Sorteo.</strong> Se extrae una bolilla de cada contenedor para formar el
              número de contrato. Todos los socios al día tienen la misma probabilidad, sin importar
              su antigüedad ni cuánto pagaron.
            </span>
          </span>
          <span className="flex gap-3">
            <Gavel className="mt-0.5 size-5 shrink-0 text-[var(--series-2)]" />
            <span>
              <strong>Licitación.</strong> Se abren los sobres ante escribano y gana la mejor
              oferta, que combina los pagos realizados con los puntos de beneficios.
            </span>
          </span>
        </p>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Adjudicadas en el período"
            value={fmtNumero(r.adjudicados, 0)}
            hint={`${r.porSorteo} por sorteo · ${r.porLicitacion} por licitación`}
          />
          <Kpi
            label="Espera media"
            value={r.esperaMediaMeses === null ? "—" : `${fmtNumero(r.esperaMediaMeses)} meses`}
            hint={`Entre ${r.esperaMinimaMeses} y ${r.esperaMaximaMeses} meses`}
          />
          <Kpi
            label="Elegibles en espera"
            value={fmtNumero(r.elegiblesEnEspera, 0)}
            hint={`${fmtNumero(r.adjudicadosPorMes)} adjudicaciones por mes`}
          />
          <Kpi
            label="Cola al ritmo actual"
            value={
              r.aniosParaVaciarLaCola === null ? "—" : `${fmtNumero(r.aniosParaVaciarLaCola)} años`
            }
            hint="Es una división, no un plazo prometido"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Seccion titulo="Actos por mes">
            <ChartView spec={d.graficos.mensual} />
          </Seccion>
          <Seccion titulo="Oferta ganadora en licitación">
            <ChartView spec={d.graficos.ofertas} />
          </Seccion>
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <Seccion titulo="Simulador del próximo acto">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ant">Antigüedad (meses)</Label>
                  <Input
                    id="ant"
                    type="number"
                    min={0}
                    max={300}
                    value={antiguedad}
                    onChange={(e) => setAntiguedad(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pag">Pagos acumulados (Gs MM)</Label>
                  <Input
                    id="pag"
                    type="number"
                    min={0}
                    value={pagado}
                    onChange={(e) => setPagado(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pts">Puntos de beneficios</Label>
                  <Input
                    id="pts"
                    type="number"
                    min={0}
                    max={300}
                    value={puntos}
                    onChange={(e) => setPuntos(Number(e.target.value))}
                  />
                </div>
                <Button onClick={simular} disabled={calculando}>
                  {calculando && <Loader2 className="size-4 animate-spin" />}
                  Calcular chance
                </Button>
              </div>

              {sim && (
                <div className="mt-5 border-t pt-4">
                  {sim.elegible ? (
                    <>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Por sorteo</p>
                          <p className="font-display text-2xl font-bold">
                            {fmtNumero(sim.probabilidadSorteoPct, 2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Por licitación</p>
                          <p className="font-display text-2xl font-bold">
                            {fmtNumero(sim.probabilidadLicitacionPct)}%
                          </p>
                        </div>
                      </div>
                      <dl className="mt-4 grid gap-1.5 text-sm">
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Su oferta</dt>
                          <dd className="font-semibold">Gs {fmtNumero(sim.ofertaMM, 0)} MM</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Posición en la cola</dt>
                          <dd className="font-semibold">
                            {fmtNumero(sim.posicionEnLaCola, 0)} de {fmtNumero(sim.elegibles, 0)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Oferta para entrar hoy</dt>
                          <dd className="font-semibold">
                            Gs {fmtNumero(sim.ofertaParaEntrarMM, 0)} MM
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-muted-foreground">Cupos del próximo acto</dt>
                          <dd className="font-semibold">
                            {sim.cupos.sorteo} sorteo · {sim.cupos.licitacion} licitación
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        {sim.nota}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-warning">{sim.motivo}</p>
                  )}
                </div>
              )}
            </Seccion>
          </div>
          <div className="space-y-6 xl:col-span-3">
            <Seccion titulo="Distribución de ofertas de los elegibles">
              <Tabla
                filas={d.percentiles}
                clave={(p) => p.percentil}
                columnas={[
                  { titulo: "Percentil", valor: (p) => p.percentil },
                  {
                    titulo: "Oferta",
                    valor: (p) => `Gs ${fmtNumero(p.ofertaMM, 0)} MM`,
                    numero: true,
                  },
                ]}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Para ganar una licitación hay que estar arriba del corte del mes, que depende de
                cuántos cupos se asignen y de las ofertas de los demás.
              </p>
            </Seccion>
            <Seccion titulo="Espera por año de alta">
              <ChartView spec={d.graficos.espera} alto={240} />
            </Seccion>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Seccion
            titulo="Cohortes"
            acciones={<BotonCsv filas={d.cohortes} nombre="espera-cohortes" />}
          >
            <Tabla
              filas={d.cohortes}
              clave={(c) => c.cohorte}
              columnas={[
                { titulo: "Año de alta", valor: (c) => c.cohorte },
                { titulo: "Adjudicados", valor: (c) => c.adjudicados, numero: true },
                {
                  titulo: "% de la cohorte",
                  valor: (c) => `${fmtNumero(c.adjudicadosPct)}%`,
                  numero: true,
                },
                {
                  titulo: "Espera media",
                  valor: (c) =>
                    c.esperaMediaMeses === null ? "—" : `${fmtNumero(c.esperaMediaMeses)} m`,
                  numero: true,
                },
                {
                  titulo: "Por sorteo",
                  valor: (c) => `${fmtNumero(c.porSorteoPct)}%`,
                  numero: true,
                },
              ]}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Las cohortes recientes tuvieron menos tiempo de ser adjudicadas: su espera media está
              subestimada por construcción.
            </p>
          </Seccion>
          <Seccion
            titulo="Últimas adjudicaciones"
            acciones={<BotonCsv filas={d.ultimos} nombre="adjudicados" />}
          >
            <Tabla
              alto={360}
              filas={d.ultimos}
              clave={(a) => a.contrato}
              columnas={[
                {
                  titulo: "Contrato",
                  valor: (a) => <span className="font-mono text-xs">{a.contrato}</span>,
                },
                { titulo: "Mes", valor: (a) => a.etiqueta },
                { titulo: "Vía", valor: (a) => a.via },
                { titulo: "Espera", valor: (a) => `${a.esperaMeses} m`, numero: true },
                {
                  titulo: "Oferta",
                  valor: (a) => `Gs ${fmtNumero(a.ofertaMM, 0)} MM`,
                  numero: true,
                },
              ]}
            />
          </Seccion>
        </div>
      </Contenido>
    </main>
  );
}
