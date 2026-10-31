import { describe, expect, it } from "vitest";
import { correlacion, regresion } from "@/lib/data/estadistica";
import { FILTROS_POR_DEFECTO, normalizarFiltros } from "@/lib/data/filtros";
import { avenidas, barrios, nombresBarrios } from "@/lib/data/geografia";
import { mesesEntre, periodos, ULTIMO_PERIODO } from "@/lib/data/periodos";
import {
  proyectos,
  proyectosEnObra,
  PROYECTOS_ENTREGADOS_SEGUN_SITIO,
  unidadesTotales,
} from "@/lib/data/proyectos";
import { detectarAlertas } from "@/server/alertas";
import {
  esperaPorCohorte,
  distribucionOfertas,
  resumenAdjudicaciones,
  simularAdjudicacion,
} from "@/server/adjudicaciones";
import { proyeccionCartera } from "@/server/graficos";
import {
  barriosSinPresencia,
  competencia,
  preciosPorBarrio,
  resumenMercado,
} from "@/server/mercado";
import { estadoDeObra, mixTipologias, proyeccionCaja, resumenObra } from "@/server/obra";
import {
  cohortesDesercion,
  desercionPor,
  moraPorTramo,
  prioridadDeContacto,
  resumenRiesgo,
} from "@/server/socios/mora";
import { socios } from "@/server/socios/datos";
import { evaluarTerreno, puntoDeBarrio, rankingBarrios } from "@/server/terrenos";

describe("catálogo público de proyectos", () => {
  it("cada proyecto tiene barrio válido, coordenadas en Asunción y tipologías que suman", () => {
    expect(proyectos.length).toBeGreaterThan(10);
    for (const p of proyectos) {
      expect(nombresBarrios, p.nombre).toContain(p.barrio);
      expect(p.lat, p.nombre).toBeLessThan(-25.2);
      expect(p.lat, p.nombre).toBeGreaterThan(-25.45);
      expect(p.lng, p.nombre).toBeLessThan(-57.45);
      expect(p.lng, p.nombre).toBeGreaterThan(-57.72);
      // El reparto por tipología suma exactamente las unidades del proyecto.
      expect(
        p.tipologias.reduce((t, x) => t + x.unidades, 0),
        p.nombre,
      ).toBe(p.unidades);
      // Los rangos que publica el sitio: 8 a 38 pisos, 16 a 240 unidades.
      expect(p.pisos, p.nombre).toBeGreaterThanOrEqual(8);
      expect(p.pisos, p.nombre).toBeLessThanOrEqual(38);
      expect(p.unidades, p.nombre).toBeGreaterThanOrEqual(16);
      expect(p.unidades, p.nombre).toBeLessThanOrEqual(240);
    }
    expect(mixTipologias().reduce((t, x) => t + x.unidades, 0)).toBe(unidadesTotales);
    // El catálogo nombra menos proyectos de los que el sitio dice tener entregados.
    expect(proyectos.filter((p) => p.estado === "Entregado").length).toBeLessThanOrEqual(
      PROYECTOS_ENTREGADOS_SEGUN_SITIO,
    );
  });

  it("las adjudicaciones no superan las unidades del catálogo", () => {
    const adjudicados = socios.filter((s) => s.adjudicado).length;
    expect(adjudicados).toBeGreaterThan(0);
    expect(adjudicados).toBeLessThan(unidadesTotales);
  });
});

describe("geografía de Asunción", () => {
  it("barrios y avenidas están en rango y sin duplicados", () => {
    expect(new Set(nombresBarrios).size).toBe(barrios.length);
    for (const b of barrios) {
      expect(b.lat).toBeLessThan(-25.2);
      expect(b.lat).toBeGreaterThan(-25.45);
      expect(b.peso).toBeGreaterThan(0);
      expect(b.nivel).toBeGreaterThan(0);
    }
    expect(avenidas.length).toBeGreaterThan(5);
    for (const a of avenidas) expect(a.puntos.length).toBeGreaterThanOrEqual(3);
  });

  it("normaliza filtros inválidos", () => {
    expect(
      normalizarFiltros({
        desde: "2030-01",
        plan: "Inexistente" as never,
        barrio: "Narnia",
        sucursal: "Marte" as never,
      }),
    ).toEqual(FILTROS_POR_DEFECTO);
    expect(normalizarFiltros({ desde: "2026-09", hasta: "2026-01" })).toMatchObject({
      desde: "2026-01",
      hasta: "2026-09",
    });
  });
});

describe("mora y deserción", () => {
  it("los tramos de atraso cubren el rango sin solaparse", () => {
    const tramos = moraPorTramo();
    expect(tramos).toHaveLength(3);
    for (const t of tramos) {
      expect(t.cuotas).toBeGreaterThanOrEqual(t.socios);
      expect(t.saldoMM).toBeGreaterThanOrEqual(0);
    }
    // El tramo de más atraso es el de mayor riesgo de caída.
    expect(tramos.at(-1)!.riesgoDeCaida).toBe("alto");
  });

  it("las cohortes solo informan hitos ya cumplidos", () => {
    const cohortes = cohortesDesercion();
    expect(cohortes.length).toBeGreaterThan(2);
    for (const c of cohortes) {
      // La supervivencia no puede crecer con el tiempo.
      if (c.vivos12 !== null && c.vivos24 !== null)
        expect(c.vivos24).toBeLessThanOrEqual(c.vivos12);
      if (c.vivos24 !== null && c.vivos36 !== null)
        expect(c.vivos36).toBeLessThanOrEqual(c.vivos24);
    }
    // La cohorte más reciente todavía no cumplió 12 meses completos: va en null, no en un parcial.
    expect(cohortes.at(-1)!.vivos12).toBeNull();
  });

  it("la deserción por canal distingue los canales", () => {
    const canal = desercionPor("canal");
    expect(canal.length).toBeGreaterThan(3);
    // Viene ordenada de peor a mejor retención.
    expect(canal[0]!.desercionPct).toBeGreaterThanOrEqual(canal.at(-1)!.desercionPct);
    for (const c of canal) expect(c.bajas).toBeLessThanOrEqual(c.socios);
  });

  it("el scoring de riesgo está acotado y expone sus factores", () => {
    const resumen = resumenRiesgo();
    expect(resumen.map((r) => r.nivel)).toEqual(["Alto", "Medio", "Bajo"]);
    expect(resumen.reduce((t, r) => t + r.sociosPct, 0)).toBeCloseTo(100, 0);

    const contactar = prioridadDeContacto(undefined, 10);
    expect(contactar).toHaveLength(10);
    for (const c of contactar) {
      expect(c.puntaje).toBeGreaterThanOrEqual(0);
      expect(c.puntaje).toBeLessThanOrEqual(100);
      expect(c.factores.length).toBeGreaterThanOrEqual(5);
      expect(c.atraso).toBeGreaterThan(0);
    }
    // Ordenados por recaudación en juego, no por puntaje.
    expect(contactar[0]!.enJuegoGs).toBeGreaterThanOrEqual(contactar[1]!.enJuegoGs);
  });
});

describe("adjudicaciones", () => {
  it("el resumen cierra y la espera tiene rango", () => {
    const r = resumenAdjudicaciones();
    expect(r.porSorteo + r.porLicitacion).toBe(r.adjudicados);
    expect(r.esperaMinimaMeses!).toBeLessThanOrEqual(r.esperaMediaMeses!);
    expect(r.esperaMediaMeses!).toBeLessThanOrEqual(r.esperaMaximaMeses!);
    expect(r.elegiblesEnEspera).toBeGreaterThan(0);
  });

  it("los percentiles de oferta son monótonos", () => {
    const p = distribucionOfertas();
    expect(p).toHaveLength(6);
    expect(p.every((x, i) => i === 0 || x.ofertaMM >= p[i - 1]!.ofertaMM)).toBe(true);
  });

  it("el sorteo no depende de la antigüedad y la licitación sí de la oferta", () => {
    const flaco = simularAdjudicacion({ antiguedadMeses: 12, pagadoGs: 20_000_000, puntos: 12 });
    const grueso = simularAdjudicacion({
      antiguedadMeses: 200,
      pagadoGs: 900_000_000,
      puntos: 190,
    });
    expect(flaco.elegible).toBe(true);
    // Misma chance en el sorteo: es el punto del mecanismo.
    expect(flaco.probabilidadSorteoPct).toBe(grueso.probabilidadSorteoPct);
    // Pero la posición en la cola de licitación sí cambia.
    expect(grueso.posicionEnLaCola!).toBeLessThan(flaco.posicionEnLaCola!);
    // Y nunca devuelve un plazo.
    expect(JSON.stringify(grueso)).not.toMatch(/a[ñn]os para adjudicar|le toca en/i);
  });

  it("rechaza a quien no llega a la antigüedad mínima", () => {
    const nuevo = simularAdjudicacion({ antiguedadMeses: 2 });
    expect(nuevo.elegible).toBe(false);
    expect(nuevo.motivo).toContain("antigüedad");
    expect(nuevo.probabilidadTotalPct).toBe(0);
  });

  it("las cohortes recientes tienen menos adjudicados", () => {
    const c = esperaPorCohorte();
    expect(c.at(-1)!.adjudicadosPct).toBeLessThan(c[0]!.adjudicadosPct);
  });
});

describe("obra y calce financiero", () => {
  it("cada obra tiene avance acotado y cronograma comparable", () => {
    const obras = estadoDeObra();
    expect(obras).toHaveLength(proyectosEnObra.length);
    for (const o of obras) {
      expect(o.avancePct).toBeGreaterThanOrEqual(0);
      expect(o.avancePct).toBeLessThanOrEqual(100);
      expect(o.desvioPuntos).toBeCloseTo(o.avancePct - o.avancePlanPct, 1);
      expect(o.calceMM).toBeCloseTo(o.asignadoMM - o.ejecutadoMM, -1);
      // La obra no puede ejecutar más que su costo total.
      expect(o.ejecutadoMM).toBeLessThanOrEqual(o.costoMM + 1);
      expect(o.mesesRestantes).toBeGreaterThan(0);
    }
  });

  it("el resumen de obra suma las obras y el calce es consistente", () => {
    const obras = estadoDeObra();
    const r = resumenObra();
    expect(r.proyectosEnObra).toBe(obras.length);
    expect(r.unidadesEnObra).toBe(obras.reduce((t, o) => t + o.unidades, 0));
    expect(r.calceMM).toBeCloseTo(r.asignadoMM - r.ejecutadoMM, -1);
    expect(r.atrasadas).toBe(obras.filter((o) => o.estado === "Atrasada").length);
  });

  it("la proyección de caja acumula mes a mes", () => {
    const caja = proyeccionCaja(6);
    expect(caja).toHaveLength(6);
    for (let i = 1; i < caja.length; i++) {
      const esperado = caja[i - 1]!.saldoMM + caja[i]!.ingresoObraMM - caja[i]!.necesarioMM;
      expect(caja[i]!.saldoMM).toBeCloseTo(esperado, -1);
    }
    // Los meses son consecutivos y posteriores al último del calendario.
    expect(mesesEntre(ULTIMO_PERIODO, caja[0]!.periodo)).toBe(1);
  });
});

describe("mercado y terrenos", () => {
  it("los precios de m² están en rango y la competencia se ubica en barrios", () => {
    for (const p of preciosPorBarrio) {
      expect(p.precioM2Usd).toBeGreaterThan(600);
      expect(p.precioM2Usd).toBeLessThan(4000);
    }
    expect(competencia.length).toBeGreaterThan(100);
    for (const c of competencia) expect(nombresBarrios).toContain(c.barrio);
    const r = resumenMercado();
    expect(r.edificiosCompetencia).toBe(competencia.length);
  });

  it("los barrios sin presencia no tienen proyectos propios", () => {
    for (const b of barriosSinPresencia()) {
      const proyectosAhi = proyectos.filter((p) => p.barrio === b.barrio);
      expect(proyectosAhi, b.barrio).toHaveLength(0);
      expect(b.competencia).toBeGreaterThanOrEqual(4);
    }
  });

  it("el evaluador de terrenos acota el puntaje y explica los factores", () => {
    const punto = puntoDeBarrio("Villa Morra")!;
    expect(punto).toBeDefined();
    const e = evaluarTerreno(punto);
    expect(e.puntaje).toBeGreaterThanOrEqual(0);
    expect(e.puntaje).toBeLessThanOrEqual(100);
    expect(e.factores).toHaveLength(5);
    expect(e.barrio).toBe("Villa Morra");
    expect(e.nota).toContain("ilustrativo");
    // El ranking cubre todos los barrios y viene ordenado.
    const ranking = rankingBarrios();
    expect(ranking).toHaveLength(barrios.length);
    expect(ranking[0]!.puntaje).toBeGreaterThanOrEqual(ranking.at(-1)!.puntaje);
  });
});

describe("forecast de la cartera", () => {
  it("proyecta con intervalo, escenario y backtest", () => {
    const { proyeccion: base } = proyeccionCartera();
    const { proyeccion: alta } = proyeccionCartera(undefined, 10);
    expect(base.meses).toHaveLength(8);
    expect(base.meses.every((m) => m.minimo < m.base && m.base < m.maximo)).toBe(true);
    expect(base.backtest).toHaveLength(4);
    expect(base.mapePct).toBeGreaterThan(0);
    // Hay cuatro años completos en el calendario: 2022, 2023, 2024 y 2025.
    expect(base.aniosEstacionalidad).toBe(4);
    expect(alta.totalEscenario).toBeCloseTo(base.totalBase * 1.1, -1);
    // Los meses proyectados siguen al último del calendario.
    expect(mesesEntre(ULTIMO_PERIODO, base.meses[0]!.periodo)).toBe(1);
  });
});

describe("alertas", () => {
  it("todas se calculan, declaran su fuente y apuntan a una pantalla", () => {
    const alertas = detectarAlertas();
    expect(alertas.length).toBeGreaterThan(6);
    // Vienen ordenadas por severidad.
    const peso = { alta: 0, media: 1, baja: 2 };
    expect(
      alertas.every((a, i) => i === 0 || peso[a.severidad] >= peso[alertas[i - 1]!.severidad]),
    ).toBe(true);
    for (const a of alertas) {
      expect(["publico", "ilustrativo", "mixto"], a.id).toContain(a.fuente);
      expect(a.enlace, a.id).toMatch(/^\//);
      expect(a.pregunta.length, a.id).toBeGreaterThan(10);
      expect(a.detalle.length, a.id).toBeGreaterThan(20);
    }
    // Mientras la cartera sea ilustrativa, hay una alerta que lo dice.
    expect(alertas.some((a) => a.id === "datos-ilustrativos")).toBe(true);
  });
});

describe("estadística", () => {
  it("correlación y regresión", () => {
    expect(correlacion([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 5);
    expect(correlacion([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 5);
    const r = regresion([1, 2, 3, 4], [3, 5, 7, 9]);
    expect(r.b).toBeCloseTo(2, 5);
    expect(r.a).toBeCloseTo(1, 5);
    expect(r.r2).toBeCloseTo(1, 5);
  });

  it("el calendario tiene cuatro años completos", () => {
    const porAnio = new Map<string, number>();
    for (const p of periodos) porAnio.set(p.slice(0, 4), (porAnio.get(p.slice(0, 4)) ?? 0) + 1);
    expect([...porAnio.values()].filter((n) => n === 12)).toHaveLength(4);
  });
});
