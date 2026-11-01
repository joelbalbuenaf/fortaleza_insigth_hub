import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessageSquareText } from "lucide-react";
import { Kpi } from "@/components/AppShell";
import { ChartView } from "@/components/charts/ChartView";
import { HubMap, type CapaMapa } from "@/components/map/HubMap";
import { Slider } from "@/components/ui/slider";
import { oportunidades } from "@/lib/analytical-questions";
import { fmtNumero } from "@/lib/export";
import type { obtenerCartera } from "@/lib/hub/api";
import { BotonCsv, Seccion, Tabla, Variacion } from "@/components/comercial/comun";

type Datos = Awaited<ReturnType<typeof obtenerCartera>>;
export type DatosDe<T extends Datos["tab"]> = Extract<Datos, { tab: T }>;

const gs = (v: number | null | undefined) => `Gs ${fmtNumero(v, 0)} MM`;

export function Resumen({ datos }: { datos: DatosDe<"resumen"> }) {
  const r = datos.resumen;
  // Los que ya recibieron su unidad son pocos y pesan mucho: su aporte es cerca de 3× el de
  // quien espera. Es la lectura que el KPI tiene que dejar ver de entrada.
  const pctPosesion = r.activos ? (r.conPosesion / r.activos) * 100 : 0;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Recaudado en el período"
          value={gs(r.cobradoMM)}
          delta={r.variacionInteranualPct}
          serie={datos.sparkline}
          hint={`vs. ${gs(r.interanualMM)} un año antes`}
        />
        <Kpi
          label="Efectividad de cobranza"
          value={`${fmtNumero(r.efectividadCobranzaPct)}%`}
          hint={`${gs(r.cobradoMM)} cobrados de ${gs(r.emitidoMM)} emitidos`}
        />
        <Kpi
          label="Contratos activos"
          value={fmtNumero(r.activos, 0)}
          hint={`de ${fmtNumero(r.socios, 0)} socios · ${fmtNumero(r.altas, 0)} altas · ${fmtNumero(r.bajas, 0)} bajas`}
        />
        <Kpi
          label="Con posesión"
          value={fmtNumero(r.conPosesion, 0)}
          hint={`${fmtNumero(pctPosesion, 1)}% de los activos y ${gs(r.cobradoPosesionMM)} de lo recaudado`}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Seccion titulo="Recaudación mensual">
          <ChartView spec={datos.graficos.mensual} />
        </Seccion>
        <Seccion titulo="Altas y bajas de socios">
          <ChartView spec={datos.graficos.altasBajas} />
        </Seccion>
        <Seccion titulo="Por plan">
          <ChartView spec={datos.graficos.planes} />
        </Seccion>
        <Seccion titulo="Por asesor">
          <ChartView spec={datos.graficos.asesores} />
        </Seccion>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Seccion
          titulo="Composición de la cartera"
          acciones={<BotonCsv filas={datos.composicion} nombre="composicion-cartera" />}
        >
          <ChartView spec={datos.graficos.composicion} />
          <Tabla
            filas={datos.composicion}
            clave={(c) => c.clave}
            columnas={[
              { titulo: "Situación", valor: (c) => <SituacionContrato situacion={c.nombre} /> },
              { titulo: "Contratos", valor: (c) => fmtNumero(c.contratos, 0), numero: true },
              { titulo: "Recaudado", valor: (c) => gs(c.cobradoMM), numero: true },
              { titulo: "Part.", valor: (c) => `${fmtNumero(c.participacionPct)}%`, numero: true },
              {
                titulo: "Mora / mes",
                valor: (c) => `${fmtNumero(c.moraPctFacturacionMensual)}%`,
                numero: true,
              },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            El aporte mensual lo fija la administradora y depende solo de la situación: quien tiene
            posesión de su unidad paga cerca de 3× quien todavía espera. La cuota media de los
            activos hoy es de Gs {fmtNumero(r.cuotaMediaGs, 0)}.
          </p>
        </Seccion>
        <Seccion
          titulo="Planes"
          acciones={<BotonCsv filas={datos.planes} nombre="cartera-por-plan" />}
        >
          <Tabla
            filas={datos.planes}
            clave={(p) => p.clave}
            columnas={[
              { titulo: "Plan", valor: (p) => p.nombre },
              { titulo: "Recaudado", valor: (p) => gs(p.cobradoMM), numero: true },
              { titulo: "Part.", valor: (p) => `${fmtNumero(p.participacionPct)}%`, numero: true },
              { titulo: "Socios", valor: (p) => fmtNumero(p.socios, 0), numero: true },
              {
                titulo: "Interanual",
                valor: (p) => <Variacion pct={p.variacionInteranualPct} />,
                numero: true,
              },
            ]}
          />
        </Seccion>
        <Seccion titulo="Oportunidades">
          <div className="grid gap-3">
            {oportunidades.map((o) => (
              <div key={o.titulo} className="rounded-lg border-l-4 border-accent bg-muted/40 p-3">
                <p className="text-sm font-semibold">
                  {o.titulo}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Prioridad {o.prioridad.toLowerCase()}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{o.accion}</p>
                <Link
                  to="/chat"
                  search={{ q: o.pregunta }}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary dark:text-sidebar-primary"
                >
                  <MessageSquareText className="size-3.5" /> Analizar con Fide
                </Link>
              </div>
            ))}
          </div>
        </Seccion>
      </div>
    </div>
  );
}

export function Territorio({ datos }: { datos: DatosDe<"territorio"> }) {
  const navigate = useNavigate();
  const sel = datos.filtros.barrio;
  const elegir = (barrio?: string) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, barrio }),
      replace: true,
    } as never);

  const capas: CapaMapa[] = [
    {
      id: "barrios",
      nombre: "Recaudación por barrio del socio",
      color: "var(--series-1)",
      radio: [7, 30],
      puntos: datos.mapa.map((b) => ({
        id: b.clave,
        lat: b.lat,
        lng: b.lng,
        titulo: b.nombre,
        valor: b.cobradoMM,
        detalle: `${gs(b.cobradoMM)} · ${fmtNumero(b.participacionPct)}% de la cartera\n${fmtNumero(b.socios, 0)} socios`,
      })),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Seccion titulo="Dónde viven los socios">
            <HubMap
              capas={capas}
              alto={470}
              onClickPunto={(_, id) => elegir(id === sel ? undefined : id)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Tamaño = recaudación del barrio. Los círculos están en el centro del barrio, no en el
              domicilio del socio. Clic para filtrar.
            </p>
          </Seccion>
        </div>
        <div className="xl:col-span-2">
          <Seccion
            titulo="Barrios"
            acciones={<BotonCsv filas={datos.barrios} nombre="cartera-por-barrio" />}
          >
            <Tabla
              alto={470}
              filas={datos.barrios}
              clave={(b) => b.clave}
              seleccionada={sel}
              onFila={(b) => elegir(b.clave === sel ? undefined : b.clave)}
              columnas={[
                { titulo: "Barrio", valor: (b) => b.nombre },
                { titulo: "Recaudado", valor: (b) => gs(b.cobradoMM), numero: true },
                {
                  titulo: "Part.",
                  valor: (b) => `${fmtNumero(b.participacionPct)}%`,
                  numero: true,
                },
                { titulo: "Socios", valor: (b) => fmtNumero(b.socios, 0), numero: true },
              ]}
            />
          </Seccion>
        </div>
      </div>
      <Seccion titulo="Recaudación por barrio">
        <ChartView spec={datos.grafico} />
      </Seccion>
      {sel && datos.seleccion && (
        <Seccion
          titulo={`Socios de ${sel} · ${fmtNumero(datos.seleccion.resumen.activos, 0)} activos`}
          acciones={<BotonCsv filas={datos.seleccion.socios} nombre={`socios-${sel}`} />}
        >
          <TablaSocios filas={datos.seleccion.socios} alto={360} />
        </Seccion>
      )}
    </div>
  );
}

export function Asesores({ datos }: { datos: DatosDe<"asesores"> }) {
  const desercion = new Map(datos.desercion.map((d) => [d.clave, d]));
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Seccion titulo="Recaudación por asesor">
          <ChartView spec={datos.graficos.asesores} />
        </Seccion>
        <Seccion titulo="Cuota promedio por plan">
          <ChartView spec={datos.graficos.ticket} />
        </Seccion>
      </div>
      <Seccion titulo="Asesores" acciones={<BotonCsv filas={datos.asesores} nombre="asesores" />}>
        <Tabla
          filas={datos.asesores}
          clave={(s) => s.clave}
          columnas={[
            { titulo: "Asesor", valor: (s) => s.nombre },
            { titulo: "Recaudado", valor: (s) => gs(s.cobradoMM), numero: true },
            { titulo: "Part.", valor: (s) => `${fmtNumero(s.participacionPct)}%`, numero: true },
            {
              titulo: "Interanual",
              valor: (s) => <Variacion pct={s.variacionInteranualPct} />,
              numero: true,
            },
            { titulo: "Contratos", valor: (s) => fmtNumero(s.contratos, 0), numero: true },
            { titulo: "Socios", valor: (s) => fmtNumero(s.socios, 0), numero: true },
            {
              // Parte de lo que recauda un asesor no es gestión: es el mix de su cartera, porque
              // un contrato con posesión aporta cerca de 3× uno en espera.
              titulo: "Con posesión",
              valor: (s) =>
                `${fmtNumero(s.conPosesion, 0)} (${fmtNumero(
                  s.contratos ? (s.conPosesion / s.contratos) * 100 : 0,
                  0,
                )}%)`,
              numero: true,
            },
            {
              titulo: "Mora / mes",
              valor: (s) => `${fmtNumero(s.moraPctFacturacionMensual)}%`,
              numero: true,
            },
            {
              titulo: "Deserción",
              valor: (s) => `${fmtNumero(desercion.get(s.clave)?.desercionPct)}%`,
              numero: true,
            },
          ]}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Antes de leer el ranking como desempeño, mirá la columna "Con posesión": un asesor con más
          contratos entregados recauda más por el aporte, no necesariamente porque venda o cobre
          mejor.
        </p>
      </Seccion>
      <Seccion
        titulo="Canales de alta"
        acciones={<BotonCsv filas={datos.canales} nombre="canales" />}
      >
        <Tabla
          filas={datos.canales}
          clave={(c) => c.clave}
          columnas={[
            { titulo: "Canal", valor: (c) => c.nombre },
            { titulo: "Socios", valor: (c) => fmtNumero(c.socios, 0), numero: true },
            { titulo: "Bajas", valor: (c) => fmtNumero(c.bajas, 0), numero: true },
            { titulo: "Deserción", valor: (c) => `${fmtNumero(c.desercionPct)}%`, numero: true },
            { titulo: "Cuota perdida", valor: (c) => gs(c.cuotaPerdidaMM), numero: true },
            { titulo: "Meses hasta la baja", valor: (c) => c.mesesHastaLaBaja, numero: true },
          ]}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          El canal con peor retención pierde socios en el primer año: ahí es donde una mejora en el
          alta rinde más.
        </p>
      </Seccion>
    </div>
  );
}

export function Mora({ datos }: { datos: DatosDe<"mora"> }) {
  const r = datos.resumen;
  const ultimo = datos.evolucion[datos.evolucion.length - 1];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Saldo en mora"
          value={gs(r.moraSaldoMM)}
          hint={`${fmtNumero(r.moraCuotas, 0)} cuotas impagas pendientes`}
        />
        <Kpi
          label="Sobre un mes de facturación"
          value={`${fmtNumero(r.moraPctFacturacionMensual)}%`}
          hint={`Al cierre: ${fmtNumero(ultimo?.pctFacturacion)}% de lo emitido en el mes`}
        />
        <Kpi
          label="Contratos con atraso"
          value={fmtNumero(r.enMora, 0)}
          hint={`${fmtNumero(r.moraContratosPct)}% de los activos`}
        />
        <Kpi
          label="Efectividad de cobranza"
          value={`${fmtNumero(r.efectividadCobranzaPct)}%`}
          hint="Cobrado sobre emitido en el período"
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Seccion titulo="Saldo por tramo de atraso">
          <ChartView spec={datos.graficos.tramos} />
        </Seccion>
        <Seccion titulo="Evolución de la mora">
          <ChartView spec={datos.graficos.evolucion} />
        </Seccion>
      </div>
      <Seccion
        titulo="Tramos de atraso"
        acciones={<BotonCsv filas={datos.tramos} nombre="mora-tramos" />}
      >
        <Tabla
          filas={datos.tramos}
          clave={(t) => t.tramo}
          columnas={[
            { titulo: "Tramo", valor: (t) => t.nombre },
            { titulo: "Contratos", valor: (t) => fmtNumero(t.socios, 0), numero: true },
            { titulo: "Cuotas", valor: (t) => fmtNumero(t.cuotas, 0), numero: true },
            { titulo: "Saldo", valor: (t) => gs(t.saldoMM), numero: true },
            {
              titulo: "Riesgo de caída",
              valor: (t) => (
                <span
                  className={
                    t.riesgoDeCaida === "alto"
                      ? "text-destructive"
                      : t.riesgoDeCaida === "medio"
                        ? "text-warning"
                        : "text-muted-foreground"
                  }
                >
                  {t.riesgoDeCaida}
                </span>
              ),
            },
            {
              titulo: "",
              valor: () => (
                <Link
                  to="/soluciones/cartera-salud"
                  className="text-xs font-semibold text-primary dark:text-sidebar-primary"
                >
                  A quién contactar →
                </Link>
              ),
            },
          ]}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          A las 7 cuotas impagas el contrato se cae. La mora se mide sobre el saldo pendiente al
          cierre, no como la diferencia entre emitido y cobrado del período: las regularizaciones de
          meses anteriores caen dentro de la ventana y la dejarían en casi cero.
        </p>
      </Seccion>
      <Seccion
        titulo="Mora por situación del contrato"
        acciones={<BotonCsv filas={datos.porSituacion} nombre="mora-por-situacion" />}
      >
        <Tabla
          filas={datos.porSituacion}
          clave={(x) => x.situacion}
          columnas={[
            { titulo: "Situación", valor: (x) => <SituacionContrato situacion={x.situacion} /> },
            { titulo: "Contratos", valor: (x) => fmtNumero(x.contratos, 0), numero: true },
            {
              titulo: "Cuota / mes",
              valor: (x) => `Gs ${fmtNumero(x.cuotaMensualGs, 0)}`,
              numero: true,
            },
            { titulo: "En mora", valor: (x) => fmtNumero(x.enMora, 0), numero: true },
            { titulo: "% en mora", valor: (x) => `${fmtNumero(x.moraPct)}%`, numero: true },
            { titulo: "Saldo", valor: (x) => gs(x.saldoMM), numero: true },
            {
              titulo: "Atraso medio",
              valor: (x) => `${fmtNumero(x.atrasoPromedio)} cuotas`,
              numero: true,
            },
          ]}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          La situación y el estado de pago son ejes independientes: quien ya tiene posesión también
          puede atrasarse, y cuando lo hace el saldo pesa más porque su cuota es la alta. El
          porcentaje va dentro de cada grupo, que son poblaciones distintas.
        </p>
      </Seccion>
    </div>
  );
}

export function Desercion({ datos }: { datos: DatosDe<"desercion"> }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Seccion titulo="Retención por cohorte de alta">
          <ChartView spec={datos.graficos.cohortes} />
        </Seccion>
        <Seccion titulo="Altas y bajas">
          <ChartView spec={datos.graficos.altasBajas} />
        </Seccion>
      </div>
      <Seccion titulo="Cohortes" acciones={<BotonCsv filas={datos.cohortes} nombre="cohortes" />}>
        <Tabla
          filas={datos.cohortes}
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
              titulo: "A 24 m",
              valor: (c) => (c.vivos24 === null ? "—" : `${fmtNumero(c.vivos24)}%`),
              numero: true,
            },
            {
              titulo: "A 36 m",
              valor: (c) => (c.vivos36 === null ? "—" : `${fmtNumero(c.vivos36)}%`),
              numero: true,
            },
            {
              titulo: "Deserción hasta hoy",
              valor: (c) => `${fmtNumero(c.desercionActualPct)}%`,
              numero: true,
            },
          ]}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Las cohortes que todavía no cumplieron el hito quedan en “—” en lugar de mostrar un dato
          parcial, que siempre se ve mejor de lo que es.
        </p>
      </Seccion>
      <div className="grid gap-6 xl:grid-cols-2">
        <Seccion titulo="Deserción por canal de alta">
          <Tabla
            filas={datos.porCanal}
            clave={(c) => c.clave}
            columnas={[
              { titulo: "Canal", valor: (c) => c.nombre },
              { titulo: "Deserción", valor: (c) => `${fmtNumero(c.desercionPct)}%`, numero: true },
              { titulo: "Bajas", valor: (c) => fmtNumero(c.bajas, 0), numero: true },
              { titulo: "Meses hasta la baja", valor: (c) => c.mesesHastaLaBaja, numero: true },
            ]}
          />
        </Seccion>
        <Seccion titulo="Deserción por plan">
          <Tabla
            filas={datos.porPlan}
            clave={(p) => p.clave}
            columnas={[
              { titulo: "Plan", valor: (p) => p.nombre },
              { titulo: "Deserción", valor: (p) => `${fmtNumero(p.desercionPct)}%`, numero: true },
              { titulo: "Bajas", valor: (p) => fmtNumero(p.bajas, 0), numero: true },
              { titulo: "Cuota perdida", valor: (p) => gs(p.cuotaPerdidaMM), numero: true },
            ]}
          />
        </Seccion>
      </div>
      <Seccion
        titulo="Deserción por situación del contrato"
        acciones={<BotonCsv filas={datos.porSituacion} nombre="desercion-por-situacion" />}
      >
        <Tabla
          filas={datos.porSituacion}
          clave={(x) => x.clave}
          columnas={[
            { titulo: "Situación", valor: (x) => <SituacionContrato situacion={x.nombre} /> },
            { titulo: "Contratos", valor: (x) => fmtNumero(x.socios, 0), numero: true },
            { titulo: "Bajas", valor: (x) => fmtNumero(x.bajas, 0), numero: true },
            { titulo: "Deserción", valor: (x) => `${fmtNumero(x.desercionPct)}%`, numero: true },
            { titulo: "Cuota perdida", valor: (x) => gs(x.cuotaPerdidaMM), numero: true },
            { titulo: "Meses hasta la baja", valor: (x) => x.mesesHastaLaBaja, numero: true },
          ]}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          La situación es la que tenía el contrato cuando terminó: la baja si se cayó, el cierre del
          calendario si sigue vivo. Así la pregunta que responde es si se abandona esperando la
          unidad o ya viviendo en ella — no dónde está hoy quien se fue hace años.
        </p>
      </Seccion>
    </div>
  );
}

export function Forecast({ datos }: { datos: DatosDe<"forecast"> }) {
  const navigate = useNavigate();
  const p = datos.proyeccion;
  const [ajuste, setAjuste] = useState(datos.ajuste);
  useEffect(() => setAjuste(datos.ajuste), [datos.ajuste]);
  const aplicar = (v: number) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, aj: v || undefined }),
      replace: true,
    } as never);

  return (
    <div className="space-y-6">
      <Seccion titulo="Proyección de recaudación">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <span className="text-sm text-muted-foreground">Escenario</span>
          <Slider
            value={[ajuste]}
            min={-30}
            max={30}
            step={1}
            onValueChange={(v) => setAjuste(v[0] ?? 0)}
            onValueCommit={(v) => aplicar(v[0] ?? 0)}
            aria-label="Ajuste del escenario"
            className="max-w-xs"
          />
          <span className="w-14 text-sm font-semibold tabular-nums">
            {ajuste > 0 ? "+" : ""}
            {ajuste}%
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Kpi label={`Base · ${p.meses.length} meses`} value={gs(p.totalBase)} />
          <Kpi
            label="Escenario"
            value={gs(p.totalEscenario)}
            hint={
              datos.ajuste
                ? `${datos.ajuste > 0 ? "+" : ""}${datos.ajuste}% sobre la base`
                : "Igual a la base"
            }
          />
          <Kpi
            label="Error del backtest (MAPE)"
            value={`${fmtNumero(p.mapePct)}%`}
            hint="Últimos 4 meses, pronosticados sin verlos"
          />
        </div>
        <div className="mt-6">
          <ChartView spec={datos.grafico} alto={320} />
        </div>
      </Seccion>
      <div className="grid gap-6 xl:grid-cols-2">
        <Seccion
          titulo="Proyección con intervalo del 80%"
          acciones={<BotonCsv filas={p.meses} nombre="forecast-cartera" />}
        >
          <Tabla
            filas={p.meses}
            clave={(m) => m.periodo}
            columnas={[
              { titulo: "Mes", valor: (m) => m.etiqueta },
              { titulo: "Base", valor: (m) => gs(m.base), numero: true },
              { titulo: "Mínimo", valor: (m) => gs(m.minimo), numero: true },
              { titulo: "Máximo", valor: (m) => gs(m.maximo), numero: true },
              { titulo: "Escenario", valor: (m) => gs(m.escenario), numero: true },
            ]}
          />
        </Seccion>
        <Seccion titulo="Backtest: pronóstico vs. real">
          <Tabla
            filas={p.backtest}
            clave={(b) => b.periodo}
            columnas={[
              { titulo: "Mes", valor: (b) => b.mes },
              { titulo: "Real", valor: (b) => gs(b.real), numero: true },
              { titulo: "Pronóstico", valor: (b) => gs(b.pronostico), numero: true },
              { titulo: "Error", valor: (b) => `${fmtNumero(b.errorPct)}%`, numero: true },
            ]}
          />
        </Seccion>
      </div>
      <p className="rounded-lg border border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Método.</strong> Tendencia lineal sobre la serie mensual
        desestacionalizada, con índices estacionales promediados sobre {p.aniosEstacionalidad} años
        completos, e intervalo de predicción del 80% según el error del ajuste. Es una referencia,
        no una predicción validada ni un compromiso.
      </p>
      <Entregas datos={datos.entregas} />
    </div>
  );
}

/**
 * Efecto de las entregas sobre la recaudación mensual. Va APARTE de la proyección de arriba a
 * propósito: la proyección es tendencia + estacionalidad y no conoce el cronograma de obra,
 * mientras que esto es aritmética sobre el calendario de entregas. Sumarlas en una sola curva
 * daría una precisión que ninguno de los dos cálculos tiene.
 */
function Entregas({ datos }: { datos: DatosDe<"forecast">["entregas"] }) {
  const e = datos.entregas;
  const ultimo = e[e.length - 1];
  return (
    <Seccion
      titulo="Efecto de las próximas entregas"
      acciones={<BotonCsv filas={e} nombre="efecto-entregas" />}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi
          label="Contratos esperando su entrega"
          value={fmtNumero(datos.contratosPendientes, 0)}
          hint="Adjudicados cuya torre todavía no se entregó"
        />
        <Kpi
          label="Salto por contrato"
          value={`Gs ${fmtNumero(datos.saltoPorContratoGs, 0)}`}
          hint={`De Gs ${fmtNumero(datos.aporteEsperaGs, 0)} a Gs ${fmtNumero(datos.aportePosesionGs, 0)} al mes`}
        />
        <Kpi
          label="Recaudación mensual adicional"
          value={gs(ultimo?.acumuladoMensualMM)}
          hint="Cuando se hayan entregado todas las torres del cronograma"
        />
      </div>
      <div className="mt-6">
        <Tabla
          filas={e}
          clave={(x) => x.periodo}
          columnas={[
            { titulo: "Entrega", valor: (x) => x.mes },
            { titulo: "Proyectos", valor: (x) => x.proyectos.join(", ") },
            { titulo: "Contratos", valor: (x) => fmtNumero(x.contratos, 0), numero: true },
            { titulo: "Socios", valor: (x) => fmtNumero(x.socios, 0), numero: true },
            {
              titulo: "Más por mes",
              valor: (x) => gs(x.incrementoMensualMM),
              numero: true,
            },
            {
              titulo: "Acumulado",
              valor: (x) => gs(x.acumuladoMensualMM),
              numero: true,
            },
          ]}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Cuando se entrega una torre, sus contratos adjudicados toman posesión y pasan a la cuota
        alta. Es aritmética sobre el cronograma, no una proyección estadística, así que
        deliberadamente no está sumado a la curva de arriba: esa serie es tendencia y
        estacionalidad, y no conoce el calendario de obra. Las fechas de entrega son del catálogo
        público; el reparto de contratos por proyecto es ilustrativo.
      </p>
    </Seccion>
  );
}

export function Estadistica({ datos }: { datos: DatosDe<"estadistica"> }) {
  const c = datos.concentracion;
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Seccion titulo="Concentración de la recaudación">
            <ChartView spec={datos.graficos.concentracion} alto={300} />
          </Seccion>
        </div>
        <div className="space-y-4 xl:col-span-2">
          <Kpi
            label="Contratos que aportan el 80%"
            value={`${fmtNumero(c.n80, 0)} de ${fmtNumero(c.contratos, 0)}`}
          />
          <Kpi
            label="Peso de los 100 primeros"
            value={`${fmtNumero(c.top100Pct)}%`}
            hint={`Los 500 primeros: ${fmtNumero(c.top500Pct)}%`}
          />
        </div>
      </div>
      <Seccion titulo="Antigüedad de los socios activos">
        <ChartView spec={datos.graficos.antiguedad} />
      </Seccion>
      <Seccion
        titulo="Meses con recaudación fuera de lo habitual"
        acciones={<BotonCsv filas={datos.atipicos} nombre="meses-atipicos" />}
      >
        {datos.atipicos.length ? (
          <Tabla
            filas={datos.atipicos}
            clave={(a) => a.periodo}
            columnas={[
              { titulo: "Mes", valor: (a) => a.etiqueta },
              { titulo: "Recaudado", valor: (a) => gs(a.cobradoMM), numero: true },
              {
                titulo: "Var. interanual",
                valor: (a) => <Variacion pct={a.variacionInteranualPct} />,
                numero: true,
              },
              { titulo: "z", valor: (a) => fmtNumero(a.z, 2), numero: true },
              {
                titulo: "",
                valor: (a) => (
                  <Link
                    to="/chat"
                    search={{ q: `¿Qué pasó con la recaudación en ${a.etiqueta}?` }}
                    className="text-xs font-semibold text-primary dark:text-sidebar-primary"
                  >
                    Preguntar
                  </Link>
                ),
              },
            ]}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay meses fuera de lo habitual (|z| ≥ 1,8).
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Un mes es atípico si su variación interanual se aleja más de 1,8 desvíos estándar del
          promedio.
        </p>
      </Seccion>
    </div>
  );
}

// ── Tabla de socios, compartida ────────────────────────────────────────────────────────

type FilaSocio = DatosDe<"territorio">["seleccion"] extends { socios: (infer T)[] } | null
  ? T
  : never;

/** Cómo viene pagando el contrato. Es independiente de la situación: uno con posesión puede
 *  estar en mora, y antes eso quedaba tapado por el estado "Adjudicado". */
export function EstadoSocio({ estado }: { estado: string }) {
  const clase =
    estado === "En mora"
      ? "bg-warning/15 text-warning"
      : estado === "Baja"
        ? "bg-destructive/10 text-destructive"
        : "bg-success/15 text-success";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${clase}`}>{estado}</span>
  );
}

/** Dónde está el contrato en el camino hacia su unidad. */
export function SituacionContrato({ situacion }: { situacion: string }) {
  const clase =
    situacion === "Con posesión"
      ? "bg-[var(--series-2)]/15 text-[var(--series-2)]"
      : situacion === "Adjudicado"
        ? "bg-[var(--series-1)]/15 text-[var(--series-1)]"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${clase}`}>
      {situacion}
    </span>
  );
}

export function TablaSocios({
  filas,
  alto,
  seleccionada,
  onFila,
}: {
  filas: FilaSocio[];
  alto?: number;
  seleccionada?: string | undefined;
  onFila?: (f: FilaSocio) => void;
}) {
  return (
    <Tabla
      {...(alto ? { alto } : {})}
      {...(onFila ? { onFila } : {})}
      filas={filas}
      clave={(s) => s.contrato}
      seleccionada={seleccionada}
      columnas={[
        {
          titulo: "Contrato",
          valor: (s) => <span className="font-mono text-xs">{s.contrato}</span>,
        },
        { titulo: "Plan", valor: (s) => s.plan },
        { titulo: "Asesor", valor: (s) => s.asesor },
        { titulo: "Alta", valor: (s) => s.altaEtiqueta },
        { titulo: "Antigüedad", valor: (s) => `${s.antiguedadMeses} m`, numero: true },
        { titulo: "Cuota", valor: (s) => `Gs ${fmtNumero(s.cuotaGs, 0)}`, numero: true },
        { titulo: "Aportado", valor: (s) => `Gs ${fmtNumero(s.aportadoMM, 1)} MM`, numero: true },
        {
          titulo: "Atraso",
          valor: (s) =>
            s.atraso > 0 ? (
              <span className="text-destructive">{s.atraso}</span>
            ) : (
              <span className="text-muted-foreground">0</span>
            ),
          numero: true,
        },
        { titulo: "Situación", valor: (s) => <SituacionContrato situacion={s.situacion} /> },
        { titulo: "Pago", valor: (s) => <EstadoSocio estado={s.estadoPago} /> },
      ]}
    />
  );
}
