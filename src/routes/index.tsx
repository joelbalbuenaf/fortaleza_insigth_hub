import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Coins,
  MessageSquareText,
  Search,
  Store,
  Users,
} from "lucide-react";
import { Kpi, Panel } from "@/components/AppShell";
import { AlertCenter } from "@/components/AlertCenter";
import { ChartView } from "@/components/charts/ChartView";
import { abrirPaleta } from "@/components/CommandPalette";
import { FuenteBadge } from "@/components/FuenteBadge";
import { HubSolutions } from "@/components/HubSolutions";
import { fmtNumero } from "@/lib/export";
import { obtenerInicio } from "@/lib/hub/api";
import logo from "@/assets/fide.svg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hub Analítico Fortaleza" },
      {
        name: "description",
        content:
          "Cartera del Sistema de Ahorro, adjudicaciones, obra y mercado, con Fide para preguntarle a los datos.",
      },
      { property: "og:title", content: "Hub Analítico Fortaleza" },
      { property: "og:type", content: "website" },
    ],
  }),
  loader: () => obtenerInicio(),
  component: Index,
});

const secciones = [
  {
    to: "/cartera",
    t: "Cartera de aportes",
    d: "Recaudación, territorio, mora, deserción y forecast.",
    icon: Coins,
  },
  {
    to: "/socios",
    t: "Socios",
    d: "Contratos, antigüedad, atraso y cola de licitación.",
    icon: Users,
  },
  {
    to: "/proyectos",
    t: "Proyectos y obra",
    d: "Catálogo público y avance de las torres en construcción.",
    icon: Building2,
  },
  {
    to: "/mercado",
    t: "Mercado",
    d: "Precio de m² por barrio, competencia y absorción.",
    icon: Store,
  },
] as const;

function Index() {
  const d = Route.useLoaderData();
  const r = d.resumen;
  const altas = d.alertas.filter((a) => a.severidad === "alta").length;
  const moraSocios = d.mora.reduce((t, x) => t + x.socios, 0);
  const riesgoAlto = d.riesgo.find((x) => x.nivel === "Alto");

  return (
    <main className="space-y-8 p-6 md:p-10">
      <section className="bg-hero relative overflow-hidden rounded-2xl p-8 text-white md:p-12">
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-brand-stripe" />
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sidebar-primary">
          Fortaleza Inmuebles S.A.
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold md:text-5xl">Hub Analítico</h1>
        <p className="mt-3 max-w-xl opacity-80">
          La cartera del Sistema de Ahorro, las adjudicaciones y el avance de obra en un solo lugar
          — con Fide para preguntarle a los datos en lenguaje natural.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/chat"
            className="inline-flex items-center gap-2 rounded-lg bg-sidebar-primary px-4 py-2.5 text-sm font-semibold text-sidebar-primary-foreground"
          >
            <MessageSquareText className="size-4" /> Preguntar a Fide
          </Link>
          <button
            onClick={abrirPaleta}
            className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-4 py-2.5 text-sm font-semibold"
          >
            <Search className="size-4" /> Buscar · Ctrl K
          </button>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <FuenteBadge fuente="ilustrativo" sufijo="Ene–Sep 2026" />
        <span>{d.fuente}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Recaudación · Ene–Sep 2026"
          value={`Gs ${fmtNumero(r.cobradoMM, 0)} MM`}
          delta={r.variacionInteranualPct}
          serie={d.sparkline}
          hint={`vs. Gs ${fmtNumero(r.interanualMM, 0)} MM en Ene–Sep 2025`}
        />
        <Kpi
          label="Socios activos"
          value={fmtNumero(r.activos, 0)}
          hint={`${fmtNumero(r.altas, 0)} altas y ${fmtNumero(r.bajas, 0)} bajas · neto ${r.crecimientoNeto > 0 ? "+" : ""}${fmtNumero(r.crecimientoNeto, 0)}`}
        />
        <Kpi
          label="Mora"
          value={`${fmtNumero(r.moraPctFacturacionMensual)}%`}
          deltaLabel="de un mes de facturación"
          hint={`${moraSocios} socios con atraso · saldo Gs ${fmtNumero(r.moraSaldoMM, 0)} MM`}
        />
        <Kpi
          label="Obra en curso"
          value={`${fmtNumero(d.obra.avanceMedioPct)}%`}
          hint={`${d.obra.proyectosEnObra} torres · ${d.obra.atrasadas} atrasada${d.obra.atrasadas === 1 ? "" : "s"} · ${fmtNumero(d.obra.unidadesEnObra, 0)} unidades`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <Panel
          title={`Qué requiere atención hoy · ${d.alertas.length} alertas (${altas} altas)`}
          className="xl:col-span-3"
        >
          <AlertCenter alertas={d.alertas} limite={7} />
        </Panel>
        <div className="space-y-6 xl:col-span-2">
          <Panel title="Recaudación mensual">
            <ChartView spec={d.graficoCartera} alto={240} />
          </Panel>
          <Panel title="Adjudicaciones y riesgo">
            <dl className="grid gap-3 text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Adjudicadas en el período</dt>
                <dd className="font-semibold tabular-nums">
                  {d.adjudicaciones.adjudicados} unidades
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Sorteo / licitación</dt>
                <dd className="font-semibold tabular-nums">
                  {d.adjudicaciones.porSorteo} / {d.adjudicaciones.porLicitacion}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Socios elegibles en espera</dt>
                <dd className="font-semibold tabular-nums">
                  {fmtNumero(d.adjudicaciones.elegiblesEnEspera, 0)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">Riesgo alto de deserción</dt>
                <dd className="font-semibold tabular-nums">
                  {riesgoAlto ? `${riesgoAlto.socios} socios` : "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              La espera de adjudicación es probabilística: el sorteo da la misma chance a todos los
              socios al día, y la licitación ordena por oferta. No hay un plazo prometido.
            </p>
          </Panel>
        </div>
      </div>

      <HubSolutions />

      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Reportes</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {secciones.map(({ to, t, d: desc, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-4 rounded-xl border bg-card p-5 shadow-card transition hover:border-accent"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                <Icon className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-display font-semibold">{t}</span>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
            </Link>
          ))}
        </div>
      </section>

      <Link
        to="/chat"
        className="flex flex-col items-center gap-6 rounded-2xl border-2 border-accent bg-card p-6 shadow-card md:flex-row"
      >
        <img src={logo} alt="Fide" width={96} height={96} loading="lazy" className="size-24" />
        <div className="flex-1 text-center md:text-left">
          <h2 className="text-2xl font-bold">Hablá con tus datos</h2>
          <p className="text-muted-foreground">
            Preguntale a <strong className="text-foreground">Fide</strong> sobre recaudación, mora,
            deserción, adjudicaciones, obra o mercado. Responde con cifras, gráficos y próximos
            pasos.
          </p>
        </div>
        <span className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
          Conversar con Fide
        </span>
      </Link>
    </main>
  );
}
