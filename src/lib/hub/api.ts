// Server functions del Hub: el único puente entre src/server/ y el navegador.
// El middleware de src/start.ts exige sesión para todas. Devuelven vistas ya calculadas.
import { createServerFn } from "@tanstack/react-start";
import { PRIMER_PERIODO, ULTIMO_PERIODO, desplazar } from "@/lib/data/periodos";
import { aFiltrosCartera, type FiltrosUrl } from "@/lib/filtros-url";
import { detectarAlertas } from "@/server/alertas";
import {
  distribucionOfertas,
  esperaPorCohorte,
  resumenAdjudicaciones,
  serieAdjudicaciones,
  simularAdjudicacion,
  ultimosAdjudicados,
} from "@/server/adjudicaciones";
import { construirGrafico, proyeccionCartera } from "@/server/graficos";
import {
  barriosSinPresencia,
  competencia,
  desarrolladoras,
  porDesarrolladora,
  preciosPorBarrio,
  resumenMercado,
  serieAbsorcion,
} from "@/server/mercado";
import {
  estadoDeObra,
  mixTipologias,
  PROPORCION_A_OBRA,
  proyeccionCaja,
  resumenObra,
  unidadesPorProyecto,
} from "@/server/obra";
import {
  altasYBajas,
  concentracion,
  fichaSocio,
  mesesAtipicos,
  PERIODO_ACTUAL,
  porBarrio,
  porPlan,
  porSucursal,
  rankingSocios,
  resumenCartera,
  serieMensualCartera,
  tramosAntiguedad,
  type EstadoSocioFiltro,
  type OrdenSocios,
} from "@/server/socios/consultas";
import {
  cohortesDesercion,
  desercionPor,
  evolucionMora,
  moraPorTramo,
  prioridadDeContacto,
  resumenRiesgo,
} from "@/server/socios/mora";
import { evaluarTerreno, rankingBarrios } from "@/server/terrenos";
import { FUENTE_CARTERA } from "@/server/socios/datos";
import { FUENTE_PUBLICA } from "@/lib/data/proyectos";

// ── Inicio ───────────────────────────────────────────────────────────────────────────

export const obtenerInicio = createServerFn({ method: "GET" }).handler(async () => {
  const r = resumenCartera(PERIODO_ACTUAL);
  const obra = resumenObra();
  const adj = resumenAdjudicaciones();
  return {
    fuente: FUENTE_CARTERA,
    fuentePublica: FUENTE_PUBLICA,
    resumen: r,
    sparkline: serieMensualCartera({
      desde: desplazar(ULTIMO_PERIODO, -11),
      hasta: ULTIMO_PERIODO,
    }).map((m) => m.cobradoMM),
    obra,
    adjudicaciones: adj,
    mora: moraPorTramo(),
    riesgo: resumenRiesgo(),
    alertas: detectarAlertas(),
    graficoCartera: construirGrafico({
      grafico: "cartera_mensual",
      desde: PRIMER_PERIODO,
      hasta: ULTIMO_PERIODO,
    }),
  };
});

// ── Cartera ──────────────────────────────────────────────────────────────────────────

export type TabCartera =
  "resumen" | "territorio" | "sucursales" | "mora" | "desercion" | "forecast" | "estadistica";

type EntradaCartera = FiltrosUrl & { tab?: TabCartera; aj?: number };

export const obtenerCartera = createServerFn({ method: "GET" })
  .validator((d: EntradaCartera) => d)
  .handler(async ({ data }) => {
    const f = aFiltrosCartera(data);
    const tab = data.tab ?? "resumen";
    const base = { fuente: FUENTE_CARTERA, filtros: f };
    switch (tab) {
      case "resumen":
        return {
          ...base,
          tab: "resumen" as const,
          resumen: resumenCartera(f),
          sparkline: serieMensualCartera(f).map((m) => m.cobradoMM),
          graficos: {
            mensual: construirGrafico({ ...f, grafico: "cartera_mensual", desde: PRIMER_PERIODO }),
            planes: construirGrafico({ ...f, grafico: "cartera_por_plan" }),
            sucursales: construirGrafico({ ...f, grafico: "cartera_por_sucursal" }),
            altasBajas: construirGrafico({ ...f, grafico: "altas_bajas" }),
          },
          planes: porPlan(f),
        };
      case "territorio": {
        const barrios = porBarrio({ ...f, barrio: undefined });
        const precios = new Map(preciosPorBarrio.map((p) => [p.barrio, p]));
        return {
          ...base,
          tab: "territorio" as const,
          barrios,
          mapa: barrios
            .map((b) => ({ ...b, ...(precios.get(b.clave) ?? {}) }))
            .filter((b): b is typeof b & { lat: number; lng: number } =>
              Boolean(precios.get(b.clave)),
            ),
          grafico: construirGrafico({ ...f, grafico: "cartera_por_barrio", limite: 14 }),
          seleccion: f.barrio
            ? {
                resumen: resumenCartera(f),
                socios: rankingSocios(f, "aportes").slice(0, 30),
              }
            : null,
        };
      }
      case "sucursales":
        return {
          ...base,
          tab: "sucursales" as const,
          sucursales: porSucursal(f),
          desercion: desercionPor("sucursal"),
          canales: desercionPor("canal"),
          graficos: {
            sucursales: construirGrafico({ ...f, grafico: "cartera_por_sucursal" }),
            ticket: construirGrafico({ ...f, grafico: "ticket_por_plan" }),
          },
        };
      case "mora":
        return {
          ...base,
          tab: "mora" as const,
          resumen: resumenCartera(f),
          tramos: moraPorTramo(f),
          evolucion: evolucionMora(f),
          graficos: {
            tramos: construirGrafico({ ...f, grafico: "mora_tramos" }),
            evolucion: construirGrafico({ ...f, grafico: "mora_evolucion" }),
          },
        };
      case "desercion":
        return {
          ...base,
          tab: "desercion" as const,
          cohortes: cohortesDesercion(),
          porCanal: desercionPor("canal"),
          porPlan: desercionPor("plan"),
          graficos: {
            cohortes: construirGrafico({ grafico: "desercion_cohortes" }),
            altasBajas: construirGrafico({ ...f, grafico: "altas_bajas" }),
          },
        };
      case "forecast": {
        const ajuste = Math.max(-30, Math.min(30, Number(data.aj ?? 0) || 0));
        const { proyeccion } = proyeccionCartera(f.plan, ajuste);
        return {
          ...base,
          tab: "forecast" as const,
          ajuste,
          proyeccion,
          grafico: construirGrafico({
            grafico: "forecast_cartera",
            plan: f.plan,
            ajuste_pct: ajuste,
          }),
        };
      }
      case "estadistica": {
        const { puntos: _p, ...c } = concentracion(f);
        return {
          ...base,
          tab: "estadistica" as const,
          concentracion: c,
          atipicos: mesesAtipicos(),
          antiguedad: tramosAntiguedad(f),
          altasBajas: altasYBajas(f),
          graficos: {
            concentracion: construirGrafico({ ...f, grafico: "concentracion_cartera" }),
            antiguedad: construirGrafico({ ...f, grafico: "antiguedad_socios" }),
          },
        };
      }
    }
  });

// ── Socios ───────────────────────────────────────────────────────────────────────────

export type EntradaSocios = FiltrosUrl & {
  q?: string;
  estado?: EstadoSocioFiltro;
  canal?: string;
  orden?: OrdenSocios;
  c?: string;
};

/** Filas que se mandan al navegador. La cartera tiene miles de contratos: recortar es parte de
 *  la server function, no de la pantalla, o el HTML de la página se va a varios megas. */
const MAX_FILAS = 300;

export const obtenerSocios = createServerFn({ method: "GET" })
  .validator((d: EntradaSocios) => d)
  .handler(async ({ data }) => {
    const f = aFiltrosCartera(data);
    const todas = rankingSocios(
      { ...f, busqueda: data.q, estado: data.estado, canal: data.canal },
      data.orden ?? "aportes",
    );
    return {
      fuente: FUENTE_CARTERA,
      filtros: f,
      resumen: resumenCartera(f),
      filas: todas.slice(0, MAX_FILAS),
      coincidencias: todas.length,
      maximo: MAX_FILAS,
      ficha: data.c ? fichaSocio(data.c, f) : null,
    };
  });

// ── Proyectos y obra ─────────────────────────────────────────────────────────────────

export const obtenerProyectos = createServerFn({ method: "GET" }).handler(async () => ({
  fuente: FUENTE_PUBLICA,
  resumen: resumenObra(),
  proyectos: unidadesPorProyecto(),
  obras: estadoDeObra(),
  tipologias: mixTipologias(),
  graficos: {
    unidades: construirGrafico({ grafico: "unidades_por_proyecto" }),
    avance: construirGrafico({ grafico: "avance_obra" }),
    tipologias: construirGrafico({ grafico: "mix_tipologias" }),
  },
}));

export const obtenerObra = createServerFn({ method: "GET" }).handler(async () => ({
  resumen: resumenObra(),
  // Se expone acá para que la pantalla no tenga que importar src/server/ (rompería la frontera).
  proporcionAObra: PROPORCION_A_OBRA,
  obras: estadoDeObra(),
  caja: proyeccionCaja(12),
  graficos: {
    avance: construirGrafico({ grafico: "avance_obra" }),
    calce: construirGrafico({ grafico: "calce_obra" }),
  },
}));

// ── Mercado y terrenos ───────────────────────────────────────────────────────────────

export const obtenerMercado = createServerFn({ method: "GET" })
  .validator((d: FiltrosUrl) => d)
  .handler(async ({ data }) => {
    const f = aFiltrosCartera(data);
    return {
      resumen: resumenMercado(),
      precios: [...preciosPorBarrio].sort((a, b) => b.precioM2Usd - a.precioM2Usd),
      sinPresencia: barriosSinPresencia(),
      absorcion: serieAbsorcion(f.desde, f.hasta),
      graficos: {
        precios: construirGrafico({ grafico: "precio_m2_barrio" }),
        competencia: construirGrafico({ grafico: "competencia_barrio" }),
        absorcion: construirGrafico({ ...f, grafico: "absorcion" }),
      },
    };
  });

export const obtenerTerrenos = createServerFn({ method: "GET" }).handler(async () => ({
  ranking: rankingBarrios(),
  competencia: competencia.map(({ id, desarrolladora, lat, lng, barrio, unidades }) => ({
    id,
    desarrolladora,
    lat,
    lng,
    barrio,
    unidades,
  })),
  desarrolladoras: [...desarrolladoras],
  sinPresencia: barriosSinPresencia(),
}));

export const evaluarTerrenoFn = createServerFn({ method: "POST" })
  .validator((d: { lat: number; lng: number }) => ({ lat: Number(d.lat), lng: Number(d.lng) }))
  .handler(async ({ data }) => evaluarTerreno(data));

// ── Soluciones ───────────────────────────────────────────────────────────────────────

export const obtenerSaludCartera = createServerFn({ method: "GET" })
  .validator((d: FiltrosUrl) => d)
  .handler(async ({ data }) => {
    const f = aFiltrosCartera(data);
    return {
      filtros: f,
      resumen: resumenCartera(f),
      riesgo: resumenRiesgo(f),
      contactar: prioridadDeContacto(f, 25),
      tramos: moraPorTramo(f),
      cohortes: cohortesDesercion(),
      porCanal: desercionPor("canal"),
      graficos: {
        tramos: construirGrafico({ ...f, grafico: "mora_tramos" }),
        evolucion: construirGrafico({ ...f, grafico: "mora_evolucion" }),
      },
    };
  });

export const obtenerAdjudicaciones = createServerFn({ method: "GET" })
  .validator((d: FiltrosUrl) => d)
  .handler(async ({ data }) => {
    const f = aFiltrosCartera(data);
    return {
      filtros: f,
      resumen: resumenAdjudicaciones(f),
      mensual: serieAdjudicaciones(f),
      cohortes: esperaPorCohorte(),
      percentiles: distribucionOfertas(),
      ultimos: ultimosAdjudicados(15),
      graficos: {
        mensual: construirGrafico({ ...f, grafico: "adjudicaciones_mensuales" }),
        espera: construirGrafico({ grafico: "espera_adjudicacion" }),
        ofertas: construirGrafico({ ...f, grafico: "oferta_licitatoria" }),
      },
    };
  });

export const simularAdjudicacionFn = createServerFn({ method: "POST" })
  .validator(
    (d: { pagadoGs?: number; puntos?: number; antiguedadMeses?: number; contrato?: string }) => d,
  )
  .handler(async ({ data }) =>
    simularAdjudicacion({
      pagadoGs: data.pagadoGs,
      puntos: data.puntos,
      antiguedadMeses: data.antiguedadMeses,
      contrato: data.contrato,
    }),
  );
