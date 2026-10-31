// Catálogo de proyectos de Fortaleza Inmuebles.
//
// DOS NIVELES DE VERACIDAD EN UN MISMO REGISTRO, y conviene no confundirlos:
//   - PÚBLICO (fuente: fortalezainmuebles.com, consultado el 31/10/2026): nombre, año y estado.
//     La dirección está solo donde el sitio la publica.
//   - ILUSTRATIVO: pisos, unidades, tipologías y coordenadas. El sitio informa rangos para el
//     conjunto (torres de 8 a 38 pisos, 16 a 240 unidades) pero no el detalle por proyecto, así
//     que los valores de acá son supuestos dentro de esos rangos. Las coordenadas son el centro
//     del barrio con un desplazamiento chico, no la ubicación real de la obra.
//
// El sitio informa 17 proyectos entregados y 5 en construcción, pero nombra menos: este catálogo
// cubre los nombrados. `PROYECTOS_ENTREGADOS_SEGUN_SITIO` guarda la cifra que ellos publican.

import { barrios, normalizar } from "./geografia";
import { crearAzar, entre, redondear } from "./random";

export const FUENTE_PUBLICA = "Catálogo público · fortalezainmuebles.com (31/10/2026)";
export const PROYECTOS_ENTREGADOS_SEGUN_SITIO = 17;
export const PROYECTOS_EN_OBRA_SEGUN_SITIO = 5;

export type EstadoProyecto = "Entregado" | "En construcción";

type ProyectoPublico = {
  id: string;
  /** PÚBLICO. */
  nombre: string;
  /** PÚBLICO: año de entrega (entregados) o de entrega prevista (en obra). */
  anio: number;
  /** PÚBLICO. */
  estado: EstadoProyecto;
  /** PÚBLICO solo donde el sitio la publica; si no, undefined. */
  direccion?: string;
  /** ILUSTRATIVO: barrio asignado para poder ubicarlo en el mapa. */
  barrio: string;
  /** ILUSTRATIVO. */
  pisos: number;
  /** ILUSTRATIVO. */
  unidades: number;
};

// Ordenados por año. Los cuatro primeros son los proyectos fundacionales de la empresa (1992).
const catalogo: ProyectoPublico[] = [
  {
    id: "f1",
    nombre: "Fortaleza I",
    anio: 1995,
    estado: "Entregado",
    barrio: "Catedral",
    pisos: 8,
    unidades: 16,
  },
  {
    id: "f2",
    nombre: "Fortaleza II",
    anio: 1999,
    estado: "Entregado",
    barrio: "La Encarnación",
    pisos: 10,
    unidades: 24,
  },
  {
    id: "f3",
    nombre: "Fortaleza III",
    anio: 2012,
    estado: "Entregado",
    barrio: "Ciudad Nueva",
    pisos: 12,
    unidades: 36,
  },
  {
    id: "f4",
    nombre: "Fortaleza IV",
    anio: 2012,
    estado: "Entregado",
    barrio: "Jara",
    pisos: 12,
    unidades: 40,
  },
  {
    id: "f5",
    nombre: "Fortaleza V",
    anio: 2016,
    estado: "Entregado",
    barrio: "San Roque",
    pisos: 14,
    unidades: 52,
  },
  {
    id: "alberdi",
    nombre: "Fortaleza Alberdi",
    anio: 2018,
    estado: "Entregado",
    barrio: "Catedral",
    pisos: 16,
    unidades: 64,
  },
  {
    id: "milano",
    nombre: "Fortaleza Milano",
    anio: 2020,
    estado: "Entregado",
    barrio: "Villa Morra",
    pisos: 18,
    unidades: 72,
  },
  {
    id: "25mayo",
    nombre: "Fortaleza 25 de Mayo",
    anio: 2021,
    estado: "Entregado",
    barrio: "Ciudad Nueva",
    pisos: 20,
    unidades: 88,
  },
  {
    id: "azara",
    nombre: "Fortaleza Azara",
    anio: 2022,
    estado: "Entregado",
    barrio: "Jara",
    pisos: 22,
    unidades: 96,
  },
  {
    id: "estigarribia",
    nombre: "Fortaleza Mcal. Estigarribia",
    anio: 2022,
    estado: "Entregado",
    barrio: "Mcal. Estigarribia",
    pisos: 24,
    unidades: 110,
  },
  {
    id: "boggiani",
    nombre: "Fortaleza Boggiani",
    anio: 2023,
    estado: "Entregado",
    direccion: "Avda. Boggiani",
    barrio: "Recoleta",
    pisos: 28,
    unidades: 148,
  },
  {
    id: "molas",
    nombre: "Fortaleza Molas López",
    anio: 2025,
    estado: "Entregado",
    direccion: "Avda. Dr. Felipe Molas López",
    barrio: "Villa Morra",
    pisos: 30,
    unidades: 168,
  },
  {
    id: "carmelitas-t1",
    nombre: "Fortaleza Carmelitas · Torre 1",
    anio: 2027,
    estado: "En construcción",
    direccion: "Avda. Molas López",
    barrio: "Carmelitas",
    pisos: 32,
    unidades: 184,
  },
  {
    id: "carmelitas-t2",
    nombre: "Fortaleza Carmelitas · Torre 2",
    anio: 2027,
    estado: "En construcción",
    direccion: "Avda. Molas López",
    barrio: "Carmelitas",
    pisos: 32,
    unidades: 176,
  },
  {
    id: "san-martin",
    nombre: "Fortaleza San Martín",
    anio: 2028,
    estado: "En construcción",
    direccion: "Avda. San Martín",
    barrio: "Ycuá Satí",
    pisos: 34,
    unidades: 208,
  },
  {
    id: "lomas",
    nombre: "Fortaleza Lomas",
    anio: 2029,
    estado: "En construcción",
    direccion: "Avda. Dr. Felipe Molas López",
    barrio: "Las Mercedes",
    pisos: 36,
    unidades: 224,
  },
  {
    id: "pellegrini",
    nombre: "Fortaleza Pellegrini",
    anio: 2029,
    estado: "En construcción",
    direccion: "Avda. Molas López",
    barrio: "Mburucuyá",
    pisos: 38,
    unidades: 240,
  },
];

export type Proyecto = ProyectoPublico & {
  lat: number;
  lng: number;
  /** ILUSTRATIVO: reparto de unidades por tipología. */
  tipologias: { tipologia: Tipologia; unidades: number; m2: number }[];
  /** Nombre corto para ejes de gráficos ("Fortaleza Carmelitas · Torre 1" → "Carmelitas T1"). */
  corto: string;
};

export const tipologias = [
  "Monoambiente",
  "1 dormitorio",
  "2 dormitorios",
  "3 dormitorios",
] as const;
export type Tipologia = (typeof tipologias)[number];

/** m² típicos por tipología (ilustrativos). */
const M2: Record<Tipologia, number> = {
  Monoambiente: 38,
  "1 dormitorio": 52,
  "2 dormitorios": 76,
  "3 dormitorios": 112,
};

// Mix por tipología: las torres chicas y viejas son más de 2–3 dormitorios; las nuevas y altas
// cargan a monoambiente y 1 dormitorio (producto de inversión).
function mixDe(p: ProyectoPublico): number[] {
  const nuevo = p.unidades >= 100;
  return nuevo ? [0.3, 0.38, 0.24, 0.08] : [0.12, 0.3, 0.42, 0.16];
}

const acorta = (nombre: string) =>
  nombre
    .replace(/^Fortaleza\s+/, "")
    .replace(/\s*·\s*Torre\s*(\d)/, " T$1")
    .trim();

export const proyectos: Proyecto[] = catalogo.map((p) => {
  const azar = crearAzar(`proyecto-${p.id}`);
  const barrio = barrios.find((b) => b.nombre === p.barrio);
  const pesos = mixDe(p);
  // Reparto entero que suma exactamente las unidades del proyecto.
  const exactos = pesos.map((w) => p.unidades * w);
  const base = exactos.map(Math.floor);
  let resto = p.unidades - base.reduce((s, v) => s + v, 0);
  for (const { i } of exactos
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)) {
    if (resto <= 0) break;
    base[i] = (base[i] ?? 0) + 1;
    resto--;
  }
  return {
    ...p,
    corto: acorta(p.nombre),
    lat: redondear((barrio?.lat ?? -25.29) + entre(azar, -0.004, 0.004), 4),
    lng: redondear((barrio?.lng ?? -57.6) + entre(azar, -0.004, 0.004), 4),
    tipologias: tipologias.map((t, i) => ({
      tipologia: t,
      unidades: base[i] ?? 0,
      m2: M2[t],
    })),
  };
});

export const proyectosEnObra = proyectos.filter((p) => p.estado === "En construcción");
export const proyectosEntregados = proyectos.filter((p) => p.estado === "Entregado");

/** Total de unidades del catálogo (ilustrativo: las unidades por proyecto son supuestas). */
export const unidadesTotales = proyectos.reduce((s, p) => s + p.unidades, 0);

export function buscarProyecto(texto: string): Proyecto | undefined {
  const q = normalizar(texto);
  if (!q) return undefined;
  return (
    proyectos.find((p) => p.id === q) ??
    proyectos.find((p) => normalizar(p.nombre).includes(q)) ??
    proyectos.find((p) => normalizar(p.corto).includes(q))
  );
}
