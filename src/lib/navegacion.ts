import {
  Building2,
  Calculator,
  Coins,
  Dice5,
  HardHat,
  LayoutGrid,
  MapPin,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";

export const navReportes = [
  { to: "/", label: "Inicio", icon: LayoutGrid },
  { to: "/cartera", label: "Cartera de aportes", icon: Coins },
  { to: "/socios", label: "Socios", icon: Users },
  { to: "/proyectos", label: "Proyectos y obra", icon: Building2 },
  { to: "/mercado", label: "Mercado", icon: Store },
] as const;

export const navSoluciones = [
  { to: "/soluciones/cartera-salud", label: "Salud de cartera", icon: TrendingUp },
  { to: "/soluciones/adjudicaciones", label: "Radar de adjudicaciones", icon: Dice5 },
  { to: "/soluciones/obra", label: "Calce financiero de obra", icon: HardHat },
  { to: "/soluciones/terrenos", label: "Evaluador de terrenos", icon: MapPin },
  { to: "/soluciones/simulador", label: "Simulador de planes", icon: Calculator },
] as const;
