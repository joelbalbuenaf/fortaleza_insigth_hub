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
          label="Socios activos"
          value={fmtNumero(r.activos, 0)}
          hint={`${fmtNumero(r.altas, 0)} altas · ${fmtNumero(r.bajas, 0)} bajas · neto ${r.crecimientoNeto > 0 ? "+" : ""}${fmtNumero(r.crecimientoNeto, 0)}`}
        />
        <Kpi
          label="Cuota media"
          value={`Gs ${fmtNumero(r.cuotaMediaGs, 0)}`}
          hint={`${fmtNumero(r.adjudicadosEnPeriodo, 0)} unidades adjudicadas en el período`}
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
        <Seccion titulo="Por sucursal">
          <ChartView spec={datos.graficos.sucursales} />
        </Seccion>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
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

export function Sucursales({ datos }: { datos: DatosDe<"sucursales"> }) {
  const desercion = new Map(datos.desercion.map((d) => [d.clave, d]));
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <Seccion titulo="Recaudación por sucursal">
          <ChartView spec={datos.graficos.sucursales} />
        </Seccion>
        <Seccion titulo="Cuota promedio por plan">
          <ChartView spec={datos.graficos.ticket} />
        </Seccion>
      </div>
      <Seccion
        titulo="Sucursales"
        acciones={<BotonCsv filas={datos.sucursales} nombre="sucursales" />}
      >
        <Tabla
          filas={datos.sucursales}
          clave={(s) => s.clave}
          columnas={[
            { titulo: "Sucursal", valor: (s) => s.nombre },
            { titulo: "Recaudado", valor: (s) => gs(s.cobradoMM), numero: true },
            { titulo: "Part.", valor: (s) => `${fmtNumero(s.participacionPct)}%`, numero: true },
            {
              titulo: "Interanual",
              valor: (s) => <Variacion pct={s.variacionInteranualPct} />,
              numero: true,
            },
            { titulo: "Socios", valor: (s) => fmtNumero(s.socios, 0), numero: true },
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
          label="Socios con atraso"
          value={fmtNumero(r.enMora, 0)}
          hint={`${fmtNumero(r.moraSociosPct)}% de los activos`}
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
            { titulo: "Socios", valor: (t) => fmtNumero(t.socios, 0), numero: true },
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
    </div>
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
            label="Socios que aportan el 80%"
            value={`${fmtNumero(c.n80, 0)} de ${fmtNumero(c.socios, 0)}`}
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

export function EstadoSocio({ estado }: { estado: string }) {
  const clase =
    estado === "Adjudicado"
      ? "bg-[var(--series-1)]/15 text-[var(--series-1)]"
      : estado === "En mora"
        ? "bg-warning/15 text-warning"
        : estado === "Desertado"
          ? "bg-destructive/10 text-destructive"
          : "bg-success/15 text-success";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${clase}`}>{estado}</span>
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
        { titulo: "Sucursal", valor: (s) => s.sucursal },
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
        { titulo: "Estado", valor: (s) => <EstadoSocio estado={s.estado} /> },
      ]}
    />
  );
}
