import { createFileRoute } from "@tanstack/react-router";
import { Kpi } from "@/components/AppShell";
import { ChartView } from "@/components/charts/ChartView";
import { BotonCsv, Seccion, Tabla } from "@/components/comercial/comun";
import { Contenido, EncabezadoSolucion } from "@/components/soluciones/comun";
import { fmtNumero } from "@/lib/export";
import { obtenerObra } from "@/lib/hub/api";

export const Route = createFileRoute("/soluciones/obra")({
  loader: () => obtenerObra(),
  head: () => ({ meta: [{ title: "Calce financiero de obra · Hub Fortaleza" }] }),
  component: Page,
});

const gs = (v: number | null | undefined) => `Gs ${fmtNumero(v, 0)} MM`;

function Page() {
  const d = Route.useLoaderData();
  const r = d.resumen;
  const primerNegativo = d.caja.find((m) => m.saldoMM < 0);

  return (
    <main className="pb-10">
      <EncabezadoSolucion
        categoria="Obra y fondeo"
        titulo="Calce financiero de obra"
        desc="Si los aportes alcanzan para el cronograma comprometido, torre por torre, y en qué mes el fondeo se quedaría corto."
        requiere="Los proyectos y sus años de entrega son públicos; el avance, los costos y la asignación de aportes son supuestos. Para producción hacen falta los certificados de avance y los costos reales por proyecto."
        pregunta="¿Los aportes alcanzan para el cronograma de obra comprometido?"
        fuente="mixto"
      />
      <Contenido>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Kpi
            label="Costo total en obra"
            value={gs(r.costoTotalMM)}
            hint={`${r.proyectosEnObra} torres · ${fmtNumero(r.unidadesEnObra, 0)} unidades`}
          />
          <Kpi
            label="Aportes asignados"
            value={gs(r.asignadoMM)}
            hint={`${fmtNumero(d.proporcionAObra * 100, 0)}% de lo recaudado va a obra`}
          />
          <Kpi
            label="Obra ejecutada"
            value={gs(r.ejecutadoMM)}
            hint={`Avance medio ${fmtNumero(r.avanceMedioPct)}%`}
          />
          <Kpi
            label="Calce global"
            value={gs(r.calceMM)}
            hint={
              r.calceMM >= 0
                ? "Los aportes cubren lo ejecutado"
                : "La obra va por delante del fondeo"
            }
          />
          <Kpi
            label="Reserva"
            value={gs(r.reservaMM)}
            hint="Aportes que la obra en curso no absorbe: terrenos y torres por arrancar"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Seccion titulo="Avance de obra vs. cronograma">
            <ChartView spec={d.graficos.avance} />
          </Seccion>
          <Seccion titulo="Aportes asignados vs. obra ejecutada">
            <ChartView spec={d.graficos.calce} />
          </Seccion>
        </div>

        <Seccion titulo="Obras en curso" acciones={<BotonCsv filas={d.obras} nombre="obras" />}>
          <Tabla
            filas={d.obras}
            clave={(o) => o.id}
            columnas={[
              { titulo: "Proyecto", valor: (o) => <span title={o.nombre}>{o.corto}</span> },
              { titulo: "Barrio", valor: (o) => o.barrio },
              { titulo: "Entrega", valor: (o) => o.anioEntrega, numero: true },
              { titulo: "Unidades", valor: (o) => fmtNumero(o.unidades, 0), numero: true },
              { titulo: "Avance", valor: (o) => `${fmtNumero(o.avancePct)}%`, numero: true },
              {
                titulo: "Cronograma",
                valor: (o) => `${fmtNumero(o.avancePlanPct)}%`,
                numero: true,
              },
              {
                titulo: "Desvío",
                valor: (o) => (
                  <span className={o.desvioPuntos < 0 ? "text-destructive" : "text-success"}>
                    {o.desvioPuntos > 0 ? "+" : ""}
                    {fmtNumero(o.desvioPuntos)} pts
                  </span>
                ),
                numero: true,
              },
              { titulo: "Asignado", valor: (o) => gs(o.asignadoMM), numero: true },
              { titulo: "Ejecutado", valor: (o) => gs(o.ejecutadoMM), numero: true },
              {
                titulo: "Calce",
                valor: (o) => (
                  <span className={o.calceMM < 0 ? "text-destructive" : "text-success"}>
                    {gs(o.calceMM)}
                  </span>
                ),
                numero: true,
              },
              {
                titulo: "Estado",
                valor: (o) => (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      o.estado === "Atrasada"
                        ? "bg-destructive/10 text-destructive"
                        : o.estado === "Atención"
                          ? "bg-warning/15 text-warning"
                          : "bg-success/15 text-success"
                    }`}
                  >
                    {o.estado}
                  </span>
                ),
              },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Calce = aportes asignados − costo de lo ya ejecutado. Negativo significa que la
            construcción avanzó más rápido que el fondeo, no que falte plata en caja.
          </p>
        </Seccion>

        <Seccion
          titulo="Proyección de caja de obra · 12 meses"
          acciones={<BotonCsv filas={d.caja} nombre="caja-obra" />}
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Lo que entraría por aportes al ritmo reciente contra lo que habría que ejecutar según el
            cronograma de cada torre.
            {primerNegativo
              ? ` Con estos supuestos, el saldo se vuelve negativo en el mes ${primerNegativo.numero} (${primerNegativo.mes}).`
              : " Con estos supuestos, el saldo se mantiene positivo en todo el horizonte."}
          </p>
          <Tabla
            filas={d.caja}
            clave={(m) => String(m.numero)}
            columnas={[
              { titulo: "Mes", valor: (m) => `${m.numero}. ${m.mes}` },
              { titulo: "Ingreso a obra", valor: (m) => gs(m.ingresoObraMM), numero: true },
              { titulo: "Necesario", valor: (m) => gs(m.necesarioMM), numero: true },
              {
                titulo: "Saldo acumulado",
                valor: (m) => (
                  <span className={m.saldoMM < 0 ? "text-destructive" : ""}>{gs(m.saldoMM)}</span>
                ),
                numero: true,
              },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            No es un flujo de fondos auditado: supone que el ritmo de recaudación se mantiene y que
            el cronograma se ejecuta según la curva teórica de cada torre.
          </p>
        </Seccion>
      </Contenido>
    </main>
  );
}
