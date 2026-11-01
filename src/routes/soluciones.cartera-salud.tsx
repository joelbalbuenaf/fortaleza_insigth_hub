import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquareText } from "lucide-react";
import { Kpi } from "@/components/AppShell";
import { ChartView } from "@/components/charts/ChartView";
import { EstadoSocio, SituacionContrato } from "@/components/cartera/Pestanas";
import { BotonCsv, Seccion, Tabla } from "@/components/comercial/comun";
import { FilterBar } from "@/components/filters/FilterBar";
import { Contenido, EncabezadoSolucion } from "@/components/soluciones/comun";
import { fmtNumero } from "@/lib/export";
import { validarFiltrosUrl } from "@/lib/filtros-url";
import { obtenerSaludCartera } from "@/lib/hub/api";

export const Route = createFileRoute("/soluciones/cartera-salud")({
  validateSearch: validarFiltrosUrl,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => obtenerSaludCartera({ data: deps }),
  head: () => ({ meta: [{ title: "Salud de cartera · Hub Fortaleza" }] }),
  component: Page,
});

const colorNivel = (nivel: string) =>
  nivel === "Alto" ? "text-destructive" : nivel === "Medio" ? "text-warning" : "text-success";

function Page() {
  const search = Route.useSearch();
  const d = Route.useLoaderData();
  const [sel, setSel] = useState<string | undefined>(d.contactar[0]?.contrato);
  const elegido = d.contactar.find((x) => x.contrato === sel) ?? d.contactar[0];
  const enJuegoTotal = d.contactar.reduce((t, x) => t + x.enJuegoGs, 0);

  return (
    <main className="pb-10">
      <EncabezadoSolucion
        categoria="Cobranza y retención"
        titulo="Salud de cartera"
        desc="Qué socios están por caerse del plan, por qué, y cuánta recaudación está en juego."
        requiere="El scoring no es un modelo entrenado: es una suma de factores explícitos sobre la cartera ilustrativa. Para producción hace falta el padrón real de contratos y el registro de gestiones de cobranza."
        pregunta="¿A qué socios en mora conviene contactar primero y cuánta recaudación está en juego?"
        fuente="ilustrativo"
      />
      <Contenido>
        <FilterBar filtros={search} mostrar={["periodo", "plan", "asesor", "situacion"]} />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {d.riesgo.map((n) => (
            <Kpi
              key={n.nivel}
              label={`Riesgo ${n.nivel.toLowerCase()}`}
              value={fmtNumero(n.socios, 0)}
              hint={`${fmtNumero(n.sociosPct)}% de los activos · Gs ${fmtNumero(n.cuotaMensualMM, 0)} MM de cuota mensual`}
            />
          ))}
          <Kpi
            label="En juego al mes"
            value={`Gs ${fmtNumero(enJuegoTotal / 1_000_000, 0)} MM`}
            hint={`Entre los ${d.contactar.length} socios a contactar primero`}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Seccion titulo="Saldo en mora por tramo">
            <ChartView spec={d.graficos.tramos} />
          </Seccion>
          <Seccion titulo="Evolución de la mora">
            <ChartView spec={d.graficos.evolucion} />
          </Seccion>
        </div>

        <div className="grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <Seccion
              titulo="A quién contactar primero"
              acciones={<BotonCsv filas={d.contactar} nombre="contactar" />}
            >
              <p className="mb-3 text-sm text-muted-foreground">
                Ordenados por <strong>recaudación mensual en juego</strong> (riesgo × cuota), no por
                orden de atraso: un socio de riesgo medio con cuota alta puede importar más que uno
                de riesgo alto con cuota chica.
              </p>
              <Tabla
                alto={420}
                filas={d.contactar}
                clave={(x) => x.contrato}
                seleccionada={sel}
                onFila={(x) => setSel(x.contrato)}
                columnas={[
                  {
                    titulo: "Contrato",
                    valor: (x) => <span className="font-mono text-xs">{x.contrato}</span>,
                  },
                  { titulo: "Asesor", valor: (x) => x.asesor },
                  {
                    titulo: "Situación",
                    valor: (x) => <SituacionContrato situacion={x.situacion} />,
                  },
                  { titulo: "Atraso", valor: (x) => x.atraso, numero: true },
                  { titulo: "Cuota", valor: (x) => `Gs ${fmtNumero(x.cuotaGs, 0)}`, numero: true },
                  {
                    titulo: "Riesgo",
                    valor: (x) => (
                      <span className={colorNivel(x.nivel)}>
                        {x.puntaje} · {x.nivel}
                      </span>
                    ),
                    numero: true,
                  },
                  {
                    titulo: "En juego",
                    valor: (x) => `Gs ${fmtNumero(x.enJuegoGs, 0)}`,
                    numero: true,
                  },
                  {
                    // Un socio con varios contratos se contacta una vez, no una por contrato.
                    titulo: "Contratos del socio",
                    valor: (x) => x.contratosDelSocio,
                    numero: true,
                  },
                ]}
              />
            </Seccion>
          </div>
          <div className="xl:col-span-2">
            {elegido && (
              <Seccion titulo={`Por qué ${elegido.contrato} está en riesgo`}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className={`font-display text-3xl font-bold ${colorNivel(elegido.nivel)}`}>
                      {elegido.puntaje}
                      <span className="text-base font-normal text-muted-foreground">/100</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Riesgo {elegido.nivel.toLowerCase()}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">{elegido.plan}</p>
                    <p className="font-semibold">{elegido.barrio}</p>
                  </div>
                </div>
                <ul className="space-y-3">
                  {elegido.factores.map((f) => (
                    <li key={f.nombre} className="border-l-2 border-accent pl-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium">{f.nombre}</span>
                        <span
                          className={`shrink-0 text-sm font-semibold tabular-nums ${f.aporte > 0 ? "text-destructive" : f.aporte < 0 ? "text-success" : "text-muted-foreground"}`}
                        >
                          {f.aporte > 0 ? "+" : ""}
                          {f.aporte}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{f.valor}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {f.explicacion}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-3 text-xs font-semibold">
                  <Link
                    to="/socios"
                    search={{ c: elegido.contrato }}
                    className="text-primary dark:text-sidebar-primary"
                  >
                    Ver ficha completa →
                  </Link>
                  <Link
                    to="/chat"
                    search={{ q: `¿Cómo viene el contrato ${elegido.contrato}?` }}
                    className="inline-flex items-center gap-1 text-primary dark:text-sidebar-primary"
                  >
                    <MessageSquareText className="size-3.5" /> Preguntar a Fide
                  </Link>
                </div>
              </Seccion>
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Seccion titulo="Retención por cohorte de alta">
            <Tabla
              filas={d.cohortes}
              clave={(c) => c.cohorte}
              columnas={[
                { titulo: "Cohorte", valor: (c) => c.cohorte },
                { titulo: "Socios", valor: (c) => fmtNumero(c.socios, 0), numero: true },
                {
                  titulo: "Activos a 12 m",
                  valor: (c) => (c.vivos12 === null ? "—" : `${fmtNumero(c.vivos12)}%`),
                  numero: true,
                },
                {
                  titulo: "Deserción hasta hoy",
                  valor: (c) => `${fmtNumero(c.desercionActualPct)}%`,
                  numero: true,
                },
              ]}
            />
          </Seccion>
          <Seccion titulo="Deserción por canal de alta">
            <Tabla
              filas={d.porCanal}
              clave={(c) => c.clave}
              columnas={[
                { titulo: "Canal", valor: (c) => c.nombre },
                {
                  titulo: "Deserción",
                  valor: (c) => `${fmtNumero(c.desercionPct)}%`,
                  numero: true,
                },
                {
                  titulo: "Cuota perdida",
                  valor: (c) => `Gs ${fmtNumero(c.cuotaPerdidaMM, 0)} MM`,
                  numero: true,
                },
                { titulo: "Meses hasta la baja", valor: (c) => c.mesesHastaLaBaja, numero: true },
              ]}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Donde la deserción llega temprano, el problema está en el alta, no en la cobranza.
            </p>
          </Seccion>
        </div>
      </Contenido>
    </main>
  );
}
