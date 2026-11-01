import { Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  MessageSquareText,
  Minus,
  Presentation,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import logo from "@/assets/fide.svg";
import logoFortalezaBlanco from "@/assets/logo-fortaleza-blanco.png";
import { CommandPalette, abrirPaleta } from "@/components/CommandPalette";
import { FuenteBadge, type FuenteDato } from "@/components/FuenteBadge";
import { SesionUsuario } from "@/components/SesionUsuario";
import { ThemeToggle } from "@/components/ThemeToggle";
import { fmtNumero } from "@/lib/export";
import { navReportes, navSoluciones } from "@/lib/navegacion";

const navTodo = [
  ...navReportes,
  ...navSoluciones,
  { to: "/chat", label: "Habla con tus datos", icon: MessageSquareText },
] as const;

function EnlaceNav({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <Link
      to={to as never}
      activeOptions={{ exact: to === "/" }}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent"
      activeProps={{ className: "bg-sidebar-accent text-sidebar-primary font-semibold" }}
    >
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex print:hidden">
        <div className="h-1.5 bg-brand-stripe" />
        <div className="px-5 pb-4 pt-5">
          <img
            src={logoFortalezaBlanco}
            alt="Fortaleza Inmuebles"
            width={185}
            height={62}
            className="h-11 w-auto self-start"
          />
          <p className="mt-3 font-display text-xs font-bold uppercase tracking-widest text-sidebar-primary">
            Hub Analítico
          </p>
        </div>
        <button
          onClick={abrirPaleta}
          className="mx-3 mb-3 flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-left text-xs text-sidebar-foreground/80 transition hover:bg-sidebar-accent"
        >
          <Search className="size-3.5" />
          <span className="flex-1">Buscar o preguntar…</span>
          <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px]">Ctrl K</kbd>
        </button>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {navReportes.map((n) => (
            <EnlaceNav key={n.to} {...n} />
          ))}
          <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest opacity-60">
            Soluciones · demo
          </p>
          {navSoluciones.map((n) => (
            <EnlaceNav key={n.to} {...n} />
          ))}
          <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest opacity-60">
            Propuesta
          </p>
          <EnlaceNav
            to={"/presentacion" as never}
            label="Presentación ejecutiva"
            icon={Presentation as never}
          />
        </nav>
        <div className="m-3 flex items-center gap-2">
          <Link
            to="/chat"
            className="flex flex-1 items-center gap-3 rounded-xl bg-sidebar-accent p-3"
          >
            <img
              src={logo}
              alt="Fide"
              width={40}
              height={40}
              className="size-10 rounded-lg bg-white object-cover object-top p-0.5"
            />
            <div>
              <p className="text-sm font-semibold text-sidebar-accent-foreground">Fide</p>
              <p className="text-xs opacity-70">Tu agente de datos</p>
            </div>
          </Link>
          <ThemeToggle />
        </div>
        <SesionUsuario />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <nav className="flex items-center gap-2 overflow-x-auto bg-sidebar p-3 md:hidden print:hidden">
          <img
            src={logoFortalezaBlanco}
            alt="Fortaleza Inmuebles"
            width={90}
            height={30}
            className="h-7 w-auto shrink-0"
          />
          {navTodo.map(({ to, label }) => (
            <Link
              key={to}
              to={to as never}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs text-sidebar-foreground"
              activeOptions={{ exact: to === "/" }}
              activeProps={{ className: "bg-sidebar-accent text-sidebar-primary" }}
            >
              {label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
        {children}
      </div>
      <CommandPalette />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  desc,
  periodo = "Ene–Sep 2026",
  fuente = "real",
  acciones,
}: {
  eyebrow: string;
  title: string;
  desc: string;
  periodo?: string;
  fuente?: FuenteDato;
  acciones?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 px-6 pb-4 pt-8 md:px-10">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-chart-4 dark:text-sidebar-primary">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{title}</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">{desc}</p>
        <p className="mt-2">
          <FuenteBadge fuente={fuente} sufijo={periodo} />
        </p>
      </div>
      {acciones && <div className="flex flex-wrap gap-2 print:hidden">{acciones}</div>}
    </header>
  );
}

function Sparkline({ valores }: { valores: number[] }) {
  if (valores.length < 2) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const rango = max - min || 1;
  const puntos = valores
    .map((v, i) => `${(i / (valores.length - 1)) * 100},${26 - ((v - min) / rango) * 22}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 28" className="h-7 w-24" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={puntos}
        fill="none"
        stroke="var(--series-1)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function Kpi({
  label,
  value,
  hint,
  delta,
  deltaLabel = "interanual",
  serie,
  invertir = false,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Variación en %; verde si mejora (o si baja, con `invertir`). */
  delta?: number | null;
  deltaLabel?: string;
  serie?: number[];
  invertir?: boolean;
}) {
  const bueno = delta === null || delta === undefined ? null : invertir ? delta < 0 : delta > 0;
  const Icono = !delta ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {serie && <Sparkline valores={serie} />}
      </div>
      <p className="mt-1 whitespace-nowrap font-display text-2xl font-bold xl:text-3xl">{value}</p>
      {delta !== undefined && delta !== null && (
        <p
          className={`mt-1 flex items-center gap-1 text-xs font-medium ${bueno ? "text-success" : "text-destructive"}`}
        >
          <Icono className="size-3.5" />
          {delta > 0 ? "+" : ""}
          {fmtNumero(delta)}%{" "}
          <span className="font-normal text-muted-foreground">{deltaLabel}</span>
        </p>
      )}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  children,
  className = "",
  acciones,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  acciones?: ReactNode;
}) {
  return (
    <section className={`min-w-0 rounded-xl border bg-card p-5 shadow-card ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {acciones}
      </div>
      {children}
    </section>
  );
}
