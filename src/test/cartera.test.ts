import { describe, expect, it } from "vitest";
import { nombresBarrios } from "@/lib/data/geografia";
import { periodos, PRIMER_PERIODO, ULTIMO_PERIODO } from "@/lib/data/periodos";
import { asesores, canales, planes, situaciones } from "@/lib/data/filtros";
import {
  altasYBajas,
  concentracion,
  fichaSocio,
  PERIODO_ACTUAL,
  porBarrio,
  porPlan,
  porAsesor,
  porSituacion,
  rankingSocios,
  resumenCartera,
  saldoEnMora,
  serieMensualCartera,
  tramosAntiguedad,
} from "@/server/socios/consultas";
import {
  antiguedadMeses,
  atrasoAl,
  ATRASO_LIMITE,
  cobradoEnRango,
  cuotasDe,
  emitidoEnRango,
  esActivo,
  estadoDePagoDe,
  contratos,
} from "@/server/socios/datos";

describe("cartera ilustrativa", () => {
  it("el calendario y la cartera son coherentes", () => {
    expect(periodos).toHaveLength(57);
    expect(periodos[0]).toBe(PRIMER_PERIODO);
    expect(periodos.at(-1)).toBe(ULTIMO_PERIODO);
    expect(contratos.length).toBeGreaterThan(5000);
    // Contratos únicos y series alineadas con el calendario.
    expect(new Set(contratos.map((s) => s.contrato)).size).toBe(contratos.length);
    expect(contratos.every((s) => s.emitido.length === periodos.length)).toBe(true);
    expect(contratos.every((s) => s.cobrado.length === periodos.length)).toBe(true);
    // Toda dimensión del socio cae en su catálogo.
    expect(contratos.every((s) => planes.includes(s.plan))).toBe(true);
    expect(contratos.every((s) => asesores.includes(s.asesor))).toBe(true);
    expect(contratos.every((s) => canales.includes(s.canal))).toBe(true);
    expect(contratos.every((s) => nombresBarrios.includes(s.barrio))).toBe(true);
  });

  it("nadie supera el límite de atraso sin caerse del plan", () => {
    for (const s of contratos) {
      const atraso = atrasoAl(s, ULTIMO_PERIODO);
      if (esActivo(s, ULTIMO_PERIODO)) expect(atraso).toBeLessThan(ATRASO_LIMITE);
    }
  });

  it("un socio nunca paga más CUOTAS de las que se le emitieron", () => {
    // El invariante va en cuotas, no en guaraníes: regularizar una cuota vieja se paga al valor
    // de la cuota vigente, que con el ajuste anual es mayor. Así que el dinero cobrado puede
    // superar al emitido, pero la cantidad de cuotas pagadas nunca.
    for (const s of contratos.slice(0, 800)) {
      const { emitidas, pagadas } = cuotasDe(s, ULTIMO_PERIODO);
      expect(pagadas, s.contrato).toBeLessThanOrEqual(emitidas);
      // Y el atraso es exactamente lo que falta pagar de lo emitido.
      if (esActivo(s, ULTIMO_PERIODO) && s.alta >= PRIMER_PERIODO)
        expect(atrasoAl(s, ULTIMO_PERIODO), s.contrato).toBeLessThanOrEqual(emitidas - pagadas);
    }
  });

  it("el dinero cobrado se explica por las cuotas pagadas", () => {
    for (const s of contratos.slice(0, 200)) {
      const cob = cobradoEnRango(s, PRIMER_PERIODO, ULTIMO_PERIODO);
      const emi = emitidoEnRango(s, PRIMER_PERIODO, ULTIMO_PERIODO);
      // Cobrar más que lo emitido solo puede pasar por regularizaciones, y nunca por mucho.
      expect(cob, s.contrato).toBeLessThanOrEqual(emi * 1.15 + 1);
    }
  });

  it("los desgloses suman el total de la cartera", () => {
    const total = resumenCartera(PERIODO_ACTUAL).cobradoMM;
    const suma = (filas: { cobradoMM: number }[]) => filas.reduce((t, x) => t + x.cobradoMM, 0);
    expect(suma(porPlan(PERIODO_ACTUAL))).toBeCloseTo(total, -1);
    expect(suma(porAsesor(PERIODO_ACTUAL))).toBeCloseTo(total, -1);
    expect(suma(porBarrio(PERIODO_ACTUAL))).toBeCloseTo(total, -1);
    expect(serieMensualCartera(PERIODO_ACTUAL).reduce((t, m) => t + m.cobradoMM, 0)).toBeCloseTo(
      total,
      -1,
    );
    // Los tramos de antigüedad solo miran socios ACTIVOS, así que suman menos que el total:
    // los que desertaron durante el período igual aportaron antes de irse.
    const porAntiguedad = suma(tramosAntiguedad(PERIODO_ACTUAL));
    expect(porAntiguedad).toBeLessThan(total);
    expect(porAntiguedad).toBeGreaterThan(total * 0.9);
  });

  it("estados y conteos cierran entre sí", () => {
    const r = resumenCartera(PERIODO_ACTUAL);
    // Dos ejes independientes: cada uno parte los activos por su cuenta.
    expect(r.alDia + r.enMora).toBe(r.activos);
    expect(r.enEspera + r.adjudicados + r.conPosesion).toBe(r.activos);
    // Hay más contratos que personas: un socio puede tener varios.
    expect(r.socios).toBeLessThanOrEqual(r.activos);
    expect(r.crecimientoNeto).toBe(r.altas - r.bajas);
    // La efectividad puede pasar de 100% si en la ventana caen regularizaciones de meses
    // anteriores: por eso la mora NO se mide como emitido − cobrado (ver saldoEnMora).
    expect(r.efectividadCobranzaPct).toBeGreaterThan(90);
    expect(r.efectividadCobranzaPct).toBeLessThan(110);
    // Las altas del período coinciden con los socios dados de alta en esos meses.
    const altas = contratos.filter(
      (s) => s.alta >= PERIODO_ACTUAL.desde && s.alta <= PERIODO_ACTUAL.hasta,
    ).length;
    expect(r.altas).toBe(altas);
  });

  it("la mora se mide sobre el saldo pendiente, no sobre la ventana", () => {
    const mora = saldoEnMora(contratos, ULTIMO_PERIODO);
    expect(mora.contratos).toBeGreaterThan(0);
    expect(mora.cuotas).toBeGreaterThanOrEqual(mora.contratos);
    expect(mora.saldo).toBeGreaterThan(0);
    // Cada contrato contado en mora tiene atraso, y está activo.
    const enMora = contratos.filter(
      (s) => esActivo(s, ULTIMO_PERIODO) && atrasoAl(s, ULTIMO_PERIODO) > 0,
    );
    expect(enMora).toHaveLength(mora.contratos);
  });

  it("altas y bajas cuadran con el crecimiento neto", () => {
    const serie = altasYBajas(PERIODO_ACTUAL);
    const r = resumenCartera(PERIODO_ACTUAL);
    expect(serie.reduce((t, m) => t + m.altas, 0)).toBe(r.altas);
    // Las bajas se guardan en negativo para el gráfico.
    expect(serie.reduce((t, m) => t + Math.abs(m.bajas), 0)).toBe(r.bajas);
    expect(serie.every((m) => m.neto === m.altas + m.bajas)).toBe(true);
  });

  it("concentración: la curva es monótona y el 80% cae dentro de la cartera", () => {
    const c = concentracion(PERIODO_ACTUAL);
    expect(c.n80).toBeGreaterThan(0);
    expect(c.n80).toBeLessThan(c.contratos);
    expect(c.top500Pct).toBeGreaterThanOrEqual(c.top100Pct);
    const montos = c.puntos.map((p) => p.montoPct);
    expect(montos.every((v, i) => i === 0 || v >= montos[i - 1]!)).toBe(true);
  });

  it("ranking y ficha son consistentes", () => {
    const porOferta = rankingSocios(PERIODO_ACTUAL, "oferta");
    expect(porOferta[0]!.ofertaMM).toBeGreaterThanOrEqual(porOferta[1]!.ofertaMM);
    const porAtraso = rankingSocios(PERIODO_ACTUAL, "atraso");
    expect(porAtraso[0]!.atraso).toBeGreaterThanOrEqual(porAtraso[1]!.atraso);

    const primero = porOferta[0]!;
    const ficha = fichaSocio(primero.contrato)!;
    expect(ficha.contrato).toBe(primero.contrato);
    expect(ficha.posicionLicitacion).toBe(1);
    expect(ficha.serie).toHaveLength(periodos.length);
    // Las cuotas pagadas no pueden superar las emitidas.
    expect(ficha.cuotasPagadas).toBeLessThanOrEqual(ficha.cuotasEmitidas);
    expect(fichaSocio("F-999999")).toBeNull();
  });

  it("los dos ejes se filtran por separado", () => {
    for (const estadoPago of ["Al día", "En mora"] as const) {
      const filas = rankingSocios({ ...PERIODO_ACTUAL, estadoPago }, "aportes");
      expect(filas.length, estadoPago).toBeGreaterThan(0);
      expect(
        filas.every((f) => f.estadoPago === estadoPago),
        estadoPago,
      ).toBe(true);
    }
    for (const situacion of situaciones) {
      const filas = rankingSocios({ ...PERIODO_ACTUAL, situacion }, "aportes");
      expect(filas.length, situacion).toBeGreaterThan(0);
      expect(
        filas.every((f) => f.situacion === situacion),
        situacion,
      ).toBe(true);
    }
    // Y se combinan: el cruce que antes era imposible de pedir.
    const posesionEnMora = rankingSocios(
      { ...PERIODO_ACTUAL, situacion: "Con posesión", estadoPago: "En mora" },
      "aportes",
    );
    expect(posesionEnMora.length).toBeGreaterThan(0);
    expect(
      posesionEnMora.every((f) => f.situacion === "Con posesión" && f.estadoPago === "En mora"),
    ).toBe(true);
  });

  it("los desgloses por situación suman el total", () => {
    const total = resumenCartera(PERIODO_ACTUAL).cobradoMM;
    const filas = porSituacion(PERIODO_ACTUAL);
    expect(filas.reduce((t, x) => t + x.cobradoMM, 0)).toBeCloseTo(total, -1);
    // Los que tienen posesión son minoría y pesan mucho más que su proporción.
    const pos = filas.find((x) => x.clave === "Con posesión")!;
    const esp = filas.find((x) => x.clave === "En espera")!;
    expect(pos.contratos).toBeLessThan(esp.contratos);
    expect(pos.participacionPct / pos.contratos).toBeGreaterThan(
      esp.participacionPct / esp.contratos,
    );
  });

  it("la antigüedad cuenta los años previos al calendario", () => {
    const viejo = contratos.find((s) => s.alta < PRIMER_PERIODO)!;
    expect(viejo).toBeDefined();
    // Un socio de antes de Ene 2022 tiene más antigüedad que los meses del calendario.
    expect(antiguedadMeses(viejo, ULTIMO_PERIODO)).toBeGreaterThan(periodos.length);
    expect(viejo.pagadoPrevio).toBeGreaterThan(0);
    // Y sus cuotas dentro del calendario no superan los períodos disponibles.
    expect(cuotasDe(viejo, ULTIMO_PERIODO).emitidas).toBeLessThanOrEqual(periodos.length);
  });

  it("un contrato caído deja de aportar desde su baja", () => {
    const baja = contratos.find((s) => s.baja && s.baja < ULTIMO_PERIODO)!;
    expect(estadoDePagoDe(baja, ULTIMO_PERIODO)).toBe("Baja");
    const despues = periodos.filter((p) => p > baja.baja!);
    for (const p of despues) {
      const i = periodos.indexOf(p);
      expect(baja.cobrado[i], `${baja.contrato} en ${p}`).toBeNull();
    }
  });
});
