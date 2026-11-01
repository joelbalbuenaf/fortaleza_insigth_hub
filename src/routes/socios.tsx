import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MessageSquareText, Search, X } from "lucide-react";
import { Kpi, PageHeader } from "@/components/AppShell";
import { EstadoSocio, SituacionContrato, TablaSocios } from "@/components/cartera/Pestanas";
import { BotonCsv, Seccion, Tabla } from "@/components/comercial/comun";
import { FilterBar } from "@/components/filters/FilterBar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { canales } from "@/lib/data";
import { etiquetaRango } from "@/lib/data/periodos";
import { fmtNumero } from "@/lib/export";
import { validarFiltrosUrl, type FiltrosUrl } from "@/lib/filtros-url";
import { obtenerSocios, type EntradaSocios } from "@/lib/hub/api";

/** Cómo viene pagando. La situación del contrato (en espera / adjudicado / con posesión) es el
 *  otro eje y va en la barra de filtros, porque son independientes. */
const estados = ["Al día", "En mora", "Baja"] as const;
const ordenes = [
  { id: "aportes", label: "Más aportes" },
  { id: "oferta", label: "Mejor oferta licitatoria" },
  { id: "antiguedad", label: "Más antiguos" },
  { id: "atraso", label: "Más atraso" },
  { id: "contrato", label: "Número de contrato" },
] as const;

const texto = (v: unknown, max = 40) => {
  const t = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  return t ? t.slice(0, max) : undefined;
};
const deLista = <T extends string>(v: unknown, lista: readonly T[]) =>
  lista.includes(v as T) ? (v as T) : undefined;

export const Route = createFileRoute("/socios")({
  validateSearch: (s: Record<string, unknown>): EntradaSocios => {
    const r: EntradaSocios = { ...validarFiltrosUrl(s) };
    const q = texto(s["q"]);
    const c = texto(s["c"], 20);
    const estado = deLista(s["estado"], estados);
    const canal = deLista(s["canal"], canales);
    const orden = deLista(
      s["orden"],
      ordenes.map((o) => o.id),
    );
    if (q) r.q = q;
    if (c) r.c = c;
    if (estado) r.estado = estado;
    if (canal) r.canal = canal;
    if (orden && orden !== "aportes") r.orden = orden;
    return r;
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => obtenerSocios({ data: deps }),
  head: () => ({
    meta: [
      { title: "Socios · Fortaleza" },
      {
        name: "description",
        content:
          "Contratos del Sistema de Ahorro: antigüedad, aportes, atraso y posición en la cola de licitación.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  const search = Route.useSearch();
  const datos = Route.useLoaderData();
  const navigate = useNavigate();
  const ir = (cambio: { [K in keyof EntradaSocios]?: EntradaSocios[K] | undefined }) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => {
        const next: Record<string, unknown> = { ...prev, ...cambio };
        for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
        return next;
      },
      replace: true,
    } as never);

  const [q, setQ] = useState(search.q ?? "");
  useEffect(() => setQ(search.q ?? ""), [search.q]);
  // La búsqueda se aplica con una pausa breve para no recalcular en cada tecla.
  useEffect(() => {
    if ((search.q ?? "") === q.trim()) return;
    const t = setTimeout(() => ir({ q: q.trim() || undefined }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const r = datos.resumen;
  const ficha = datos.ficha;
  const filtrosActivos = Boolean(search.q || search.estado || search.canal);
  const periodo = etiquetaRango(datos.filtros.desde, datos.filtros.hasta);

  return (
    <main className="pb-10">
      <PageHeader
        eyebrow="Cartera"
        title="Socios"
        desc="La unidad es el contrato, y un socio puede tener varios. Buscá por número de contrato, plan, asesor o barrio, filtrá y abrí la ficha."
        periodo={periodo}
        fuente="ilustrativo"
      />
      <div className="space-y-6 px-6 md:px-10">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Socios activos"
            value={`${fmtNumero(r.activos, 0)} de ${fmtNumero(r.socios, 0)}`}
            hint={`${fmtNumero(r.alDia, 0)} al día · ${fmtNumero(r.enMora, 0)} en mora`}
          />
          <Kpi
            label="Con posesión"
            value={fmtNumero(r.conPosesion, 0)}
            hint={`${fmtNumero(r.adjudicados, 0)} adjudicados esperando la entrega · ${fmtNumero(r.enEspera, 0)} en espera`}
          />
          <Kpi
            label="Aportado en el período"
            value={`Gs ${fmtNumero(r.cobradoMM, 0)} MM`}
            delta={r.variacionInteranualPct}
          />
          <Kpi
            label="Cuota media"
            value={`Gs ${fmtNumero(r.cuotaMediaGs, 0)}`}
            hint="Socios activos al cierre del período"
          />
        </div>

        {ficha && (
          <section className="rounded-xl border-2 border-primary/30 bg-card p-5 shadow-card dark:border-sidebar-primary/40">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-muted-foreground">{ficha.contrato}</p>
                <h2 className="text-lg font-semibold">
                  {ficha.plan} · asesor {ficha.asesor}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {ficha.barrio} · alta en {ficha.altaEtiqueta} · canal {ficha.canal}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <SituacionContrato situacion={ficha.situacion} />
                <EstadoSocio estado={ficha.estadoPago} />
                <Link
                  to="/chat"
                  search={{ q: `¿Cómo viene el contrato ${ficha.contrato}?` }}
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <MessageSquareText className="size-3.5" /> Preguntar a Fide
                </Link>
                <button
                  type="button"
                  onClick={() => ir({ c: undefined })}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                  aria-label="Cerrar ficha"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi
                label={`Aportado · ${periodo}`}
                value={`Gs ${fmtNumero(ficha.aportadoMM, 1)} MM`}
                hint={`Total histórico: Gs ${fmtNumero(ficha.aportadoTotalMM, 0)} MM`}
              />
              <Kpi
                label="Cuotas pagadas"
                value={`${ficha.cuotasPagadas} de ${ficha.cuotasEmitidas}`}
                hint={`Atraso actual: ${ficha.atraso} cuota${ficha.atraso === 1 ? "" : "s"}`}
              />
              <Kpi
                label="Cola de licitación"
                value={`${fmtNumero(ficha.posicionLicitacion, 0)}° de ${fmtNumero(ficha.totalEnCola, 0)}`}
                hint={`Oferta: Gs ${fmtNumero(ficha.ofertaMM, 0)} MM · ${ficha.puntos} puntos`}
              />
              <Kpi
                label="Avance del plan"
                value={`${fmtNumero(ficha.avancePlanPct)}%`}
                hint={`${ficha.antiguedadMeses} de ${ficha.cuotasPlan} cuotas`}
              />
            </div>
            {ficha.adjudicado ? (
              <p className="mt-4 rounded-lg bg-secondary px-4 py-2.5 text-sm">
                Unidad adjudicada en <strong>{ficha.adjudicado}</strong> por {ficha.via}.
              </p>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
                Todavía no adjudicado. La posición en la cola solo aplica a la licitación: en el
                sorteo, todos los socios al día tienen la misma probabilidad.
              </p>
            )}
          </section>
        )}

        <Seccion
          titulo={`${fmtNumero(datos.coincidencias, 0)} socios`}
          acciones={<BotonCsv filas={datos.filas} nombre="socios" />}
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Contrato, plan, asesor o barrio"
                className="pl-8"
                aria-label="Buscar socio"
              />
            </div>
            <Selector
              etiqueta="Orden"
              valor={search.orden ?? "aportes"}
              opciones={ordenes.map((o) => ({ id: o.id, label: o.label }))}
              onCambio={(v) =>
                ir({ orden: v === "aportes" ? undefined : (v as EntradaSocios["orden"]) })
              }
            />
            <Selector
              etiqueta="Pago"
              valor={search.estado ?? ""}
              opciones={[{ id: "", label: "Todos" }, ...estados.map((e) => ({ id: e, label: e }))]}
              onCambio={(v) => ir({ estado: (v || undefined) as EntradaSocios["estado"] })}
            />
            <Selector
              etiqueta="Canal"
              valor={search.canal ?? ""}
              opciones={[{ id: "", label: "Todos" }, ...canales.map((c) => ({ id: c, label: c }))]}
              onCambio={(v) => ir({ canal: v || undefined })}
            />
            <FilterBar
              filtros={search as FiltrosUrl}
              mostrar={["periodo", "plan", "asesor", "situacion"]}
            />
            {filtrosActivos && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  ir({ q: undefined, estado: undefined, canal: undefined });
                }}
                className="text-xs font-medium text-primary hover:underline dark:text-sidebar-primary"
              >
                Limpiar filtros
              </button>
            )}
          </div>
          {datos.filas.length ? (
            <TablaSocios
              filas={datos.filas}
              alto={560}
              seleccionada={search.c}
              onFila={(s) => ir({ c: s.contrato === search.c ? undefined : s.contrato })}
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Ningún socio coincide con los filtros.
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {datos.coincidencias > datos.maximo
              ? `Se muestran los primeros ${datos.maximo} de ${fmtNumero(datos.coincidencias, 0)} que coinciden. `
              : ""}
            La cartera se identifica por número de contrato: no guarda nombres.
          </p>
        </Seccion>

        <p className="text-xs text-muted-foreground">
          Fuente: {datos.fuente}. Cartera ilustrativa; con datos reales serían datos personales y
          esta pantalla solo debería verse con sesión autorizada.
        </p>
      </div>
    </main>
  );
}

const TODOS = "__todos";

function Selector({
  etiqueta,
  valor,
  opciones,
  onCambio,
}: {
  etiqueta: string;
  valor: string;
  opciones: { id: string; label: string }[];
  onCambio: (v: string) => void;
}) {
  return (
    <Select value={valor || TODOS} onValueChange={(v) => onCambio(v === TODOS ? "" : v)}>
      <SelectTrigger className="h-9 w-48" aria-label={etiqueta}>
        <span className="text-muted-foreground">{etiqueta}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opciones.map((o) => (
          <SelectItem key={o.id || TODOS} value={o.id || TODOS}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
