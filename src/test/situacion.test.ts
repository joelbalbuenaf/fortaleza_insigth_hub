// El eje que define al Sistema de Ahorro: dónde está cada contrato en el camino hacia su unidad,
// y qué aporta según eso. Los dos ejes —situación y estado de pago— son independientes, y antes
// estaban mezclados en un solo estado donde "Adjudicado" tapaba a "En mora".
import { describe, expect, it } from "vitest";
import { APORTE_ESPERA, APORTE_POSESION, situaciones } from "@/lib/data/filtros";
import { ULTIMO_PERIODO, periodos } from "@/lib/data/periodos";
import { proyectos, unidadesTotales } from "@/lib/data/proyectos";
import {
  aporteDelMes,
  atrasoAl,
  contratos,
  emitido,
  esActivo,
  estadoDePagoDe,
  planFinalizado,
  situacionDe,
  sociosActivos,
} from "@/server/socios/datos";
import {
  efectoEntregas,
  PERIODO_ACTUAL,
  porAsesor,
  porPlan,
  porSituacion,
  rankingSocios,
  resumenCartera,
} from "@/server/socios/consultas";
import { desercionPor, moraPorSituacion, moraPorTramo, resumenRiesgo } from "@/server/socios/mora";

const H = ULTIMO_PERIODO;
const activos = contratos.filter((c) => esActivo(c, H));

describe("situación del contrato y estado de pago", () => {
  it("son ejes independientes: hay contratos con posesión en mora y se cuentan como mora", () => {
    const conPosesion = activos.filter((c) => situacionDe(c, H) === "Con posesión");
    const enMoraConPosesion = conPosesion.filter((c) => atrasoAl(c, H) >= 1);
    // Este es el caso que el modelo viejo perdía: "Adjudicado" pisaba a "En mora".
    expect(enMoraConPosesion.length).toBeGreaterThan(0);
    expect(enMoraConPosesion.every((c) => estadoDePagoDe(c, H) === "En mora")).toBe(true);

    const r = resumenCartera(PERIODO_ACTUAL);
    // Cada eje parte los activos por su cuenta, sin solaparse ni dejar huecos.
    expect(r.alDia + r.enMora).toBe(r.activos);
    expect(r.enEspera + r.adjudicados + r.conPosesion).toBe(r.activos);
    // Y el cruce se puede pedir, que es el punto.
    expect(
      moraPorSituacion(PERIODO_ACTUAL).find((x) => x.situacion === "Con posesión")!.enMora,
    ).toBe(enMoraConPosesion.length);
  });

  it("el aporte depende solo de la situación, y el de posesión es cerca de 3× el de espera", () => {
    expect(aporteDelMes(H, false)).toBe(APORTE_ESPERA);
    expect(aporteDelMes(H, true)).toBe(APORTE_POSESION);
    // La relación se mantiene en toda la serie, porque ambos se deflactan igual.
    for (const periodo of periodos.filter((_, i) => i % 7 === 0)) {
      const espera = aporteDelMes(periodo, false);
      const posesion = aporteDelMes(periodo, true);
      expect(posesion / espera).toBeCloseTo(APORTE_POSESION / APORTE_ESPERA, 2);
    }
    // Y todo contrato emite exactamente el valor de su situación en ese mes.
    for (const c of activos.slice(0, 1200)) {
      const emi = emitido(c, H);
      if (emi === 0) continue;
      expect(emi, c.contrato).toBe(aporteDelMes(H, situacionDe(c, H) === "Con posesión"));
    }
  });

  it("las adjudicaciones no superan las unidades de su proyecto", () => {
    const porProyecto = new Map<string, number>();
    for (const c of contratos)
      if (c.proyecto) porProyecto.set(c.proyecto, (porProyecto.get(c.proyecto) ?? 0) + 1);
    expect(porProyecto.size).toBeGreaterThan(0);
    for (const [id, adjudicados] of porProyecto) {
      const proyecto = proyectos.find((p) => p.id === id)!;
      expect(proyecto, id).toBeDefined();
      expect(adjudicados, proyecto.nombre).toBeLessThanOrEqual(proyecto.unidades);
    }
    expect([...porProyecto.values()].reduce((t, n) => t + n, 0)).toBeLessThanOrEqual(
      unidadesTotales,
    );
  });

  it("la posesión sigue a la entrega de la torre, nunca la precede", () => {
    const conProyecto = contratos.filter((c) => c.proyecto && c.posesion);
    expect(conProyecto.length).toBeGreaterThan(0);
    for (const c of conProyecto) {
      const anio = proyectos.find((p) => p.id === c.proyecto)!.anio;
      // La entrega se toma a diciembre del año que publica el catálogo.
      expect(c.posesion, c.contrato).toBe(`${anio}-12`);
      // Y nunca antes de la adjudicación.
      expect(c.posesion! >= c.adjudicado!, c.contrato).toBe(true);
    }
    // Un contrato cuya torre no se entregó todavía está Adjudicado, no Con posesión.
    const pendiente = conProyecto.find((c) => c.posesion! > H);
    if (pendiente) expect(situacionDe(pendiente, H)).toBe("Adjudicado");
  });

  it("todo contrato pertenece a un socio y hay socios con varios contratos", () => {
    expect(contratos.every((c) => /^S-\d{5}$/.test(c.socioId))).toBe(true);
    const porSocio = new Map<string, number>();
    for (const c of contratos) porSocio.set(c.socioId, (porSocio.get(c.socioId) ?? 0) + 1);
    expect([...porSocio.values()].reduce((t, n) => t + n, 0)).toBe(contratos.length);
    expect(porSocio.size).toBeLessThan(contratos.length);
    expect([...porSocio.values()].some((n) => n > 1)).toBe(true);
    // Los conteos de personas y de contratos no se confunden.
    expect(sociosActivos(H)).toBeLessThan(activos.length);
    expect(resumenCartera(PERIODO_ACTUAL).socios).toBe(sociosActivos(H));
  });

  it("el desglose por situación cubre toda la cartera y explica la recaudación", () => {
    const filas = porSituacion(PERIODO_ACTUAL);
    expect(filas.map((f) => f.clave).sort()).toEqual([...situaciones].sort());
    const total = resumenCartera(PERIODO_ACTUAL);
    expect(filas.reduce((t, f) => t + f.cobradoMM, 0)).toBeCloseTo(total.cobradoMM, -1);
    expect(filas.reduce((t, f) => t + f.contratos, 0)).toBe(total.activos);
    const pos = filas.find((f) => f.clave === "Con posesión")!;
    expect(pos.cobradoMM).toBeCloseTo(total.cobradoPosesionMM, -1);
    // Minoría de contratos, porción grande de la plata: es la lectura que habilita el eje.
    expect(pos.contratos / total.activos).toBeLessThan(0.5);
    expect(pos.participacionPct).toBeGreaterThan((pos.contratos / total.activos) * 100);
  });

  it("la deserción por situación usa la situación al terminar el contrato", () => {
    const filas = desercionPor("situacion");
    expect(filas.map((f) => f.clave).sort()).toEqual([...situaciones].sort());
    expect(filas.reduce((t, f) => t + f.contratos, 0)).toBe(contratos.length);
    expect(filas.reduce((t, f) => t + f.bajas, 0)).toBe(contratos.filter((c) => c.baja).length);
  });

  it("el efecto de las entregas es aritmética del cronograma, no una proyección", () => {
    const e = efectoEntregas();
    expect(e.saltoPorContratoGs).toBe(APORTE_POSESION - APORTE_ESPERA);
    expect(e.contratosPendientes).toBeGreaterThan(0);
    // Ninguna entrega pendiente cae dentro del calendario ya transcurrido.
    expect(e.entregas.every((x) => x.periodo > H)).toBe(true);
    // Los contratos de las entregas son exactamente los pendientes, y el acumulado es monótono.
    expect(e.entregas.reduce((t, x) => t + x.contratos, 0)).toBe(e.contratosPendientes);
    const acum = e.entregas.map((x) => x.acumuladoMensualMM);
    expect(acum.every((v, i) => i === 0 || v >= acum[i - 1]!)).toBe(true);
  });

  it("el ranking expone las dos dimensiones por contrato", () => {
    const filas = rankingSocios(PERIODO_ACTUAL, "aportes");
    expect(filas.length).toBeGreaterThan(0);
    for (const f of filas.slice(0, 50)) {
      expect(situaciones).toContain(f.situacion);
      expect(["Al día", "En mora", "Finalizado", "Baja"]).toContain(f.estadoPago);
      // Mientras el plan sigue emitiendo, la cuota es exactamente la de su situación.
      if (f.estadoPago === "Al día" || f.estadoPago === "En mora")
        expect(f.cuotaGs, f.contrato).toBe(
          aporteDelMes(PERIODO_ACTUAL.hasta, f.situacion === "Con posesión"),
        );
    }
  });
});

describe("final del plan", () => {
  it("un contrato que terminó de pagar sale del padrón activo, salvo que quede debiendo", () => {
    const finalizados = contratos.filter((c) => !c.baja && planFinalizado(c, H));
    expect(finalizados.length).toBeGreaterThan(0);
    for (const c of finalizados) {
      // Después de la última cuota del plan no se emite nada más.
      expect(emitido(c, H), c.contrato).toBe(0);
      const debe = atrasoAl(c, H) > 0;
      expect(esActivo(c, H), c.contrato).toBe(debe);
      expect(estadoDePagoDe(c, H), c.contrato).toBe(debe ? "En mora" : "Finalizado");
    }
    // Y nadie en el padrón activo tiene el plan terminado y pago: ahí está el punto del corte.
    expect(activos.filter((c) => planFinalizado(c, H) && atrasoAl(c, H) === 0)).toHaveLength(0);
  });
});

describe("contratos y socios no se confunden", () => {
  // La unidad del modelo es el contrato; "socios" son personas distintas. Mezclarlos da números
  // que parecen razonables y no lo son, así que cada campo dice cuál de los dos cuenta.
  it("todo desglose trae los dos conteos, y los socios nunca superan a los contratos", () => {
    const cortes = [
      porSituacion(PERIODO_ACTUAL),
      porAsesor(PERIODO_ACTUAL),
      porPlan(PERIODO_ACTUAL),
    ];
    for (const filas of cortes)
      for (const f of filas) {
        expect(f.contratos, f.nombre).toBeGreaterThan(0);
        expect(f.socios, f.nombre).toBeGreaterThan(0);
        expect(f.socios, f.nombre).toBeLessThanOrEqual(f.contratos);
      }
    // Los contratos de un corte suman el padrón activo; los socios no, porque una persona con
    // contratos en dos planes aparece en los dos grupos.
    const porPlanFilas = porPlan(PERIODO_ACTUAL);
    const activosTotal = resumenCartera(PERIODO_ACTUAL).activos;
    expect(porPlanFilas.reduce((t, f) => t + f.contratos, 0)).toBe(activosTotal);
    expect(porPlanFilas.reduce((t, f) => t + f.socios, 0)).toBeGreaterThanOrEqual(
      resumenCartera(PERIODO_ACTUAL).socios,
    );
  });

  it("mora, riesgo y deserción cuentan contratos, y dicen aparte cuántas personas son", () => {
    for (const t of moraPorTramo(PERIODO_ACTUAL)) {
      expect(t.socios, t.nombre).toBeLessThanOrEqual(t.contratos);
      // Las cuotas impagas nunca pueden ser menos que los contratos en mora de ese tramo.
      expect(t.cuotas, t.nombre).toBeGreaterThanOrEqual(t.contratos);
    }
    for (const n of resumenRiesgo(PERIODO_ACTUAL))
      expect(n.socios, n.nivel).toBeLessThanOrEqual(n.contratos);
    for (const d of desercionPor("canal")) {
      expect(d.socios, d.nombre).toBeLessThanOrEqual(d.contratos);
      expect(d.bajas, d.nombre).toBeLessThanOrEqual(d.contratos);
    }
  });
});
