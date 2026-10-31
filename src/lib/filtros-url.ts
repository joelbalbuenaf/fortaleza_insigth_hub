// Filtros globales en la URL (?p=ytd&plan=Amplia&suc=Villa+Morra&barrio=Recoleta): links compartibles.
import {
  nombresBarrios,
  normalizarFiltros,
  planes,
  presetsPeriodo,
  sucursales,
  type FiltrosCartera,
  type Plan,
  type Sucursal,
} from "@/lib/data";

export type FiltrosUrl = { p?: string; plan?: Plan; suc?: Sucursal; barrio?: string };

export function validarFiltrosUrl(search: Record<string, unknown>): FiltrosUrl {
  const out: FiltrosUrl = {};
  if (typeof search["p"] === "string" && presetsPeriodo.some((x) => x.id === search["p"]))
    out.p = search["p"];
  if (planes.includes(search["plan"] as Plan)) out.plan = search["plan"] as Plan;
  if (sucursales.includes(search["suc"] as Sucursal)) out.suc = search["suc"] as Sucursal;
  if (typeof search["barrio"] === "string" && nombresBarrios.includes(search["barrio"]))
    out.barrio = search["barrio"];
  return out;
}

export function aFiltrosCartera(f: FiltrosUrl): FiltrosCartera {
  const preset = presetsPeriodo.find((x) => x.id === (f.p ?? "ytd")) ?? presetsPeriodo[0];
  return normalizarFiltros({
    desde: preset?.desde,
    hasta: preset?.hasta,
    plan: f.plan,
    sucursal: f.suc,
    barrio: f.barrio,
  });
}

export const etiquetaPreset = (id?: string) =>
  presetsPeriodo.find((x) => x.id === (id ?? "ytd"))?.label ?? "";
