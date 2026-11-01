import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, MessageSquareText, Table2 } from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { FuenteBadge } from "@/components/FuenteBadge";
import { Button } from "@/components/ui/button";
import type { ChartSpec } from "@/lib/charts";
import { exportarCsv, fmtNumero, slug } from "@/lib/export";

const serie = (i: number) => `var(--series-${(i % 5) + 1})`;
const MUTED = "var(--series-muted)";

const ejes = {
  fontSize: 11,
  tick: { fill: "var(--muted-foreground)" },
  stroke: "var(--border)",
  tickLine: false,
} as const;

const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--popover-foreground)",
    fontSize: 12,
  },
  labelStyle: { fontWeight: 600, marginBottom: 4 },
} as const;

// El texto de la leyenda usa tinta de texto, no el color de la serie (legibilidad).
const leyenda = {
  wrapperStyle: { fontSize: 12 },
  itemSorter: null,
  formatter: (v: unknown) => <span style={{ color: "var(--foreground)" }}>{String(v)}</span>,
} as const;

const MAX_ETIQUETA = 18;
const corto = (v: unknown) => {
  const s = String(v ?? "");
  return s.length > MAX_ETIQUETA ? `${s.slice(0, MAX_ETIQUETA - 1)}…` : s;
};

/** Ancho real del contenedor, para decidir cómo acomodar las etiquetas del eje X. */
function useAncho() {
  // Ref por callback: vuelve a medir si el contenedor se re-monta (por ejemplo, tras ver la tabla).
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    if (!el) return;
    const obs = new ResizeObserver(([e]) => setAncho(e?.contentRect.width ?? 0));
    obs.observe(el);
    return () => obs.disconnect();
  }, [el]);
  return [setEl, ancho] as const;
}

const PX_POR_LETRA = 6.3; // texto de 11 px
const SENO_40 = Math.sin((40 * Math.PI) / 180);

/**
 * Acomoda las etiquetas del eje X según el espacio por categoría: horizontales si entran,
 * inclinadas a 40° si no, y salteadas si aun inclinadas se pisan.
 */
function disposicionEjeX(etiquetas: string[], ancho: number, mostrarTodas: boolean) {
  const largo = Math.min(MAX_ETIQUETA, Math.max(1, ...etiquetas.map((e) => e.length)));
  const anchoTexto = largo * PX_POR_LETRA;
  const porCategoria = (Math.max(ancho, 200) - 64) / Math.max(1, etiquetas.length);
  const inclinar = anchoTexto > porCategoria * 0.9;
  // Inclinada, cada etiqueta ocupa en horizontal ~ su alto / sen(40°).
  const salteo = inclinar ? Math.max(0, Math.ceil(18 / porCategoria) - 1) : 0;
  return {
    inclinar,
    interval: mostrarTodas ? salteo : ("preserveStartEnd" as const),
    alto: inclinar ? Math.round(16 + anchoTexto * SENO_40) : 28,
  };
}

/** Renderiza un ChartSpec (datos ya calculados por la capa de datos). */
export function ChartView({
  spec,
  alto = 288,
  conAcciones = true,
  onPreguntar,
}: {
  spec: ChartSpec;
  alto?: number;
  conAcciones?: boolean;
  /** Si se pasa, "Preguntar a Fide" llama a esto en lugar de abrir el chat. */
  onPreguntar?: (pregunta: string) => void;
}) {
  const [tabla, setTabla] = useState(false);
  const formato = (v: unknown) => `${fmtNumero(v, 2)} ${spec.unidad}`;
  const [contenedor, ancho] = useAncho();

  // Banda del intervalo (mínimo/máximo) → un área de rango; el resto, series normales.
  const banda = spec.series.filter((s) => s.estilo === "banda");
  const normales = spec.series.filter((s) => s.estilo !== "banda");
  const color = (clave: string, i: number) => (clave === "anioAnterior" ? MUTED : serie(i));

  let grafico: React.ReactNode;
  if (spec.tipo === "torta") {
    const clave = spec.series[0]?.clave ?? "valor";
    grafico = (
      <PieChart>
        <Pie
          data={spec.datos}
          dataKey={clave}
          nameKey={spec.x}
          innerRadius="52%"
          outerRadius="80%"
          paddingAngle={1}
          stroke="var(--card)"
          strokeWidth={2}
          label={({ percent }: { percent?: number }) => `${Math.round((percent ?? 0) * 100)}%`}
          labelLine={false}
          fontSize={11}
        >
          {spec.datos.map((d, i) => (
            <Cell
              key={String(d[spec.x])}
              fill={/otros/i.test(String(d[spec.x])) ? MUTED : serie(i)}
            />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} formatter={(v) => formato(v)} />
        <Legend {...leyenda} />
      </PieChart>
    );
  } else if (spec.tipo === "dispersion") {
    const y = spec.series[0]?.clave ?? "valor";
    grafico = (
      <ScatterChart margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          type="number"
          dataKey={spec.x}
          name="Competidores a 3 km"
          {...ejes}
          allowDecimals={false}
        />
        <YAxis
          type="number"
          dataKey={y}
          name={spec.series[0]?.nombre ?? ""}
          width={44}
          {...ejes}
          unit="%"
        />
        <ZAxis range={[48, 48]} />
        <Tooltip
          {...tooltipStyle}
          cursor={{ strokeDasharray: "3 3" }}
          formatter={(v, n) => [
            String(n).startsWith("Comp") ? fmtNumero(v, 0) : `${fmtNumero(v)}%`,
            n,
          ]}
        />
        <Scatter
          data={spec.datos}
          fill={serie(0)}
          fillOpacity={0.75}
          stroke="var(--card)"
          strokeWidth={1}
        />
      </ScatterChart>
    );
  } else {
    const barras = spec.tipo === "barras";
    // El eje Y se ensancha con la magnitud: una cuota en guaraníes son nueve caracteres
    // ("2.200.000") y con el ancho fijo de antes quedaba cortada por la izquierda.
    const maximoY = Math.max(
      0,
      ...spec.datos.flatMap((d) => spec.series.map((se) => Math.abs(Number(d[se.clave]) || 0))),
    );
    const anchoY = maximoY >= 1_000_000 ? 76 : maximoY >= 100_000 ? 62 : 52;
    const eje = disposicionEjeX(
      spec.datos.map((d) => String(d[spec.x] ?? "")),
      ancho,
      barras,
    );
    grafico = (
      <ComposedChart
        data={spec.datos}
        margin={{ top: 8, right: 16, bottom: 4, left: eje.inclinar ? 8 : 0 }}
      >
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={spec.x}
          {...ejes}
          interval={eje.interval}
          minTickGap={4}
          tickFormatter={corto}
          angle={eje.inclinar ? -40 : 0}
          textAnchor={eje.inclinar ? "end" : "middle"}
          height={eje.alto}
        />
        <YAxis
          width={anchoY}
          {...ejes}
          // Con valores chicos (un operador retira < 1 ML/mes) hacen falta decimales en el eje.
          tickFormatter={(v) => fmtNumero(v, Math.abs(v) < 10 ? 2 : 0)}
          // Barras siempre desde cero; líneas y áreas ajustadas al rango para ver la variación.
          domain={barras ? [0, "auto"] : ["auto", "auto"]}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v) => (Array.isArray(v) ? v.map(formato).join(" – ") : formato(v))}
        />
        {normales.length + (banda.length ? 1 : 0) > 1 && <Legend {...leyenda} />}
        {banda.length === 2 && (
          <Area
            dataKey={(d: Record<string, number | undefined>) =>
              d[banda[0]?.clave ?? ""] === undefined
                ? undefined
                : [d[banda[0]?.clave ?? ""], d[banda[1]?.clave ?? ""]]
            }
            name="Rango probable (80%)"
            fill="var(--series-band)"
            stroke="none"
            isAnimationActive={false}
          />
        )}
        {normales.map((s, i) => {
          const c = color(s.clave, i);
          if (barras)
            return (
              <Bar
                key={s.clave}
                dataKey={s.clave}
                name={s.nombre}
                fill={c}
                {...(spec.apilado ? { stackId: "a" } : {})}
                radius={spec.apilado && i < normales.length - 1 ? 0 : [4, 4, 0, 0]}
                maxBarSize={44}
                stroke="var(--card)"
                strokeWidth={spec.apilado ? 1 : 0}
              />
            );
          if (spec.tipo === "area" && i === 0)
            return (
              <Area
                key={s.clave}
                dataKey={s.clave}
                name={s.nombre}
                stroke={c}
                strokeWidth={2}
                fill={c}
                fillOpacity={0.14}
                dot={false}
                activeDot={{ r: 4 }}
              />
            );
          return (
            <Line
              key={s.clave}
              dataKey={s.clave}
              name={s.nombre}
              stroke={c}
              strokeWidth={s.estilo === "punteada" ? 1.5 : 2}
              {...(s.estilo === "punteada" ? { strokeDasharray: "5 4" } : {})}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          );
        })}
      </ComposedChart>
    );
  }

  return (
    <figure className="min-w-0" aria-label={spec.titulo}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <figcaption className="text-sm font-semibold leading-snug">
          {spec.titulo}
          <span className="ml-2 inline-flex flex-wrap items-center gap-1.5 align-middle">
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {spec.unidad}
            </span>
            <FuenteBadge fuente={spec.fuente ?? "ilustrativo"} />
          </span>
        </figcaption>
        {conAcciones && (
          <div className="flex shrink-0 gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              title={tabla ? "Ver gráfico" : "Ver datos"}
              aria-label={tabla ? "Ver gráfico" : "Ver datos"}
              onClick={() => setTabla((t) => !t)}
            >
              <Table2 className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              title="Descargar CSV"
              aria-label="Descargar CSV"
              onClick={() => exportarCsv(spec.datos, slug(spec.titulo))}
            >
              <Download className="size-4" />
            </Button>
            {spec.pregunta &&
              (onPreguntar ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title="Preguntar a Fide"
                  aria-label="Preguntar a Fide"
                  onClick={() => onPreguntar(spec.pregunta ?? "")}
                >
                  <MessageSquareText className="size-4" />
                </Button>
              ) : (
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  title="Preguntar a Fide"
                >
                  <Link to="/chat" search={{ q: spec.pregunta }} aria-label="Preguntar a Fide">
                    <MessageSquareText className="size-4" />
                  </Link>
                </Button>
              ))}
          </div>
        )}
      </div>
      {tabla ? (
        <div className="max-h-72 overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted text-left">
              <tr>
                <th className="p-2">{spec.x}</th>
                {spec.series.map((s) => (
                  <th key={s.clave} className="p-2 text-right">
                    {s.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {spec.datos.map((d, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{String(d[spec.x] ?? "")}</td>
                  {spec.series.map((s) => (
                    <td key={s.clave} className="p-2 text-right tabular-nums">
                      {d[s.clave] === null || d[s.clave] === undefined
                        ? "—"
                        : fmtNumero(d[s.clave], 2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={contenedor} style={{ height: alto }} className="w-full">
          <ResponsiveContainer>{grafico}</ResponsiveContainer>
        </div>
      )}
      {spec.nota && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{spec.nota}</p>
      )}
    </figure>
  );
}
