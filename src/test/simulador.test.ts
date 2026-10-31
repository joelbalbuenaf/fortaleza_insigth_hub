import { describe, expect, it } from "vitest";
import { generarCronograma, sumarMeses } from "@/lib/fide/simulador";
import golden from "./golden-cuotero.json";

// Las referencias las genera el cuotero Flask (cuotero_prime/app.py). El porteo tiene que dar
// los mismos números: si esto falla, el cronograma del Hub no coincide con el que ya usa el
// equipo. Regenerar con scripts/golden-cuotero.py si cambia la lógica del original.
type Caso = {
  nombre: string;
  entrada: {
    price: number;
    n_pre: number;
    total_cuotas: number;
    rate: number;
    start_date: string;
    freq: number;
    refuerzos: { period: number; amount: number }[];
    manual?: { period: number; amount: number }[];
  };
  cuotas: {
    periodo: number;
    fecha: string;
    tramo: string;
    cuota: number;
    interes: number;
    amortizacion: number;
    saldo: number;
  }[];
  summary: Record<string, number>;
};

const TRAMO: Record<string, string> = {
  "Pre-entrega": "Pre-adjudicación",
  "Post-entrega": "Post-adjudicación",
  Refuerzo: "Refuerzo",
};

describe("simulador de planes: porteo del cuotero", () => {
  for (const caso of golden as Caso[])
    it(`coincide con el Python: ${caso.nombre}`, () => {
      const { filas, resumen } = generarCronograma({
        valor: caso.entrada.price,
        cuotasPre: caso.entrada.n_pre,
        cuotasTotales: caso.entrada.total_cuotas,
        tasa: caso.entrada.rate,
        inicio: caso.entrada.start_date,
        frecuencia: caso.entrada.freq,
        refuerzos: caso.entrada.refuerzos.map((r) => ({ periodo: r.period, monto: r.amount })),
        overrides: (caso.entrada.manual ?? []).map((m) => ({ periodo: m.period, monto: m.amount })),
      });

      expect(filas).toHaveLength(caso.cuotas.length);
      caso.cuotas.forEach((esperada, i) => {
        const fila = filas[i]!;
        const donde = `${caso.nombre} fila ${i + 1} (período ${esperada.periodo}, ${esperada.tramo})`;
        expect(fila.periodo, donde).toBe(esperada.periodo);
        expect(fila.fecha, donde).toBe(esperada.fecha);
        expect(fila.tramo, donde).toBe(TRAMO[esperada.tramo]);
        expect(fila.monto, donde).toBeCloseTo(esperada.cuota, 2);
        expect(fila.interes, donde).toBeCloseTo(esperada.interes, 2);
        expect(fila.amortizacion, donde).toBeCloseTo(esperada.amortizacion, 2);
        expect(fila.saldo, donde).toBeCloseTo(esperada.saldo, 2);
      });

      expect(resumen.cuotasPre).toBe(caso.summary["n_pre"]);
      expect(resumen.cuotasPost).toBe(caso.summary["n_post"]);
      expect(resumen.refuerzos).toBe(caso.summary["n_ref"]);
      expect(resumen.totalPre).toBeCloseTo(caso.summary["total_pre"]!, 2);
      expect(resumen.totalPost).toBeCloseTo(caso.summary["total_post"]!, 2);
      expect(resumen.totalRefuerzos).toBeCloseTo(caso.summary["total_ref"]!, 2);
      expect(resumen.totalIntereses).toBeCloseTo(caso.summary["total_interest"]!, 2);
    });

  it("sumarMeses conserva el día cuando el mes lo permite", () => {
    expect(sumarMeses(new Date("2024-01-31T00:00:00"), 1, 31).getDate()).toBe(29); // 2024 bisiesto
    expect(sumarMeses(new Date("2025-01-31T00:00:00"), 1, 31).getDate()).toBe(28);
    expect(sumarMeses(new Date("2025-01-31T00:00:00"), 2, 31).getDate()).toBe(31);
  });
});
