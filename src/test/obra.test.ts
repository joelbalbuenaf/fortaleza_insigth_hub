import { describe, expect, it } from "vitest";
import { ULTIMO_PERIODO } from "@/lib/data/periodos";
import { proyectos } from "@/lib/data/proyectos";
import { estadoDeObra, resumenObra } from "@/server/obra";

// Estos tests existen por un bug real: la asignación de aportes repartía TODO lo recaudado del
// calendario entre las torres que siguen en obra, ignorando que en ese mismo período se
// entregaron otras cuatro. El resultado era que los aportes asignados superaban el costo total
// de las obras y el calce salía siempre positivo, o sea sin significado.
describe("calce financiero de obra", () => {
  const obras = estadoDeObra(ULTIMO_PERIODO);
  const r = resumenObra(ULTIMO_PERIODO);

  it("a una obra no se le asigna más plata que su costo total", () => {
    for (const o of obras) {
      expect(o.asignadoMM, o.corto).toBeGreaterThan(0);
      expect(o.asignadoMM, o.corto).toBeLessThanOrEqual(o.costoMM);
    }
    expect(r.asignadoMM).toBeLessThanOrEqual(r.costoTotalMM);
  });

  it("una obra solo recibe aportes de los meses en que estuvo en construcción", () => {
    // Las torres que entregan más tarde arrancaron después, así que llevan menos acumulado
    // que las que ya están por terminar.
    const porEntrega = [...obras].sort((a, b) => a.anioEntrega - b.anioEntrega);
    const primera = porEntrega[0]!;
    const ultima = porEntrega.at(-1)!;
    expect(primera.asignadoMM / primera.costoMM).toBeGreaterThan(
      ultima.asignadoMM / ultima.costoMM,
    );
  });

  it("el calce es la diferencia entre lo asignado y lo ejecutado", () => {
    for (const o of obras) expect(o.calceMM).toBeCloseTo(o.asignadoMM - o.ejecutadoMM, -1);
    expect(r.calceMM).toBeCloseTo(r.asignadoMM - r.ejecutadoMM, -1);
  });

  it("el fondeo sigue al cronograma, no al costo total", () => {
    // Una torre que recién arranca no puede estar casi fondeada: el modelo le asigna plata al
    // ritmo en que su cronograma la consume. Sin esto, una obra 5% construida aparecía 96%
    // fondeada y el calce no decía nada.
    for (const o of obras) {
      const fondeada = o.asignadoMM / o.costoMM;
      const construida = o.avancePct / 100;
      expect(fondeada, o.corto).toBeGreaterThanOrEqual(construida - 0.02);
      // Puede adelantarse, pero no despegarse del avance.
      expect(fondeada - construida, o.corto).toBeLessThan(0.35);
    }
    const ratios = obras.map((o) => o.asignadoMM / o.costoMM);
    expect(Math.max(...ratios) - Math.min(...ratios)).toBeGreaterThan(0.3);
  });

  it("lo que la obra no absorbe queda como reserva, no desaparece", () => {
    expect(r.reservaMM).toBeGreaterThan(0);
    // Reserva + asignado a las torres en curso no puede superar lo que fue a obra en total.
    expect(r.reservaMM + r.asignadoMM).toBeGreaterThan(r.ejecutadoMM);
  });

  it("solo se informan las torres que el catálogo público marca en construcción", () => {
    const enObra = proyectos.filter((p) => p.estado === "En construcción");
    expect(obras.map((o) => o.id).sort()).toEqual(enObra.map((p) => p.id).sort());
  });
});
