// Filtros globales en la URL (?p=ytd&plan=Amplia&ase=A-07&sit=Con+posesión): links compartibles.
import {
  asesores,
  nombresBarrios,
  normalizarFiltros,
  planes,
  presetsPeriodo,
  situaciones,
  type Asesor,
  type FiltrosCartera,
  type Plan,
  type Situacion,
} from "@/lib/data";

export type FiltrosUrl = {
  p?: string;
  plan?: Plan;
  ase?: Asesor;
  sit?: Situacion;
  barrio?: string;
};

export function validarFiltrosUrl(search: Record<string, unknown>): FiltrosUrl {
  const out: FiltrosUrl = {};
  if (typeof search["p"] === "string" && presetsPeriodo.some((x) => x.id === search["p"]))
    out.p = search["p"];
  if (planes.includes(search["plan"] as Plan)) out.plan = search["plan"] as Plan;
  if (typeof search["ase"] === "string" && asesores.includes(search["ase"]))
    out.ase = search["ase"];
  if (situaciones.includes(search["sit"] as Situacion)) out.sit = search["sit"] as Situacion;
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
    asesor: f.ase,
    situacion: f.sit,
    barrio: f.barrio,
  });
}

export const etiquetaPreset = (id?: string) =>
  presetsPeriodo.find((x) => x.id === (id ?? "ytd"))?.label ?? "";
