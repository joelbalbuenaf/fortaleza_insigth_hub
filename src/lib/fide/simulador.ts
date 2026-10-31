// Simulador de planes: cronograma de aportes de un socio.
//
// Porteo fiel del cuotero Flask (cuotero_prime/app.py: generate_full_schedule,
// solve_post_payment, add_months_preserving_day). Los tests comparan contra la salida del Python
// fila por fila, así que la aritmética se mantiene igual a propósito, incluidas las partes que
// uno escribiría distinto desde cero:
//
//   - Se llevan DOS saldos en paralelo: `saldo` nominal (lo que ve el socio) y `saldoVp`, el
//     capital a valor presente sobre el que se calcula el interés del tramo post-adjudicación.
//   - Los refuerzos del tramo post se descuentan a valor presente; la diferencia entre el monto
//     y su valor presente se informa como interés ahorrado en la fila del refuerzo.
//   - Durante la obra se cobra menos que lo que correspondería a un plan sin interés
//     (valor/cuotasPre contra valor/cuotasTotales). Ese faltante mensual devenga interés simple
//     por los meses que faltan hasta la adjudicación, y se CAPITALIZA sumándose al capital que
//     se financia después. Es la lógica de simulador_obras.xlsx; sin esto los números no
//     coinciden con los que el equipo ya usa.
//   - Los refuerzos se emiten como filas propias del cronograma, no fusionados en la cuota.
//
// Adaptación al Sistema de Ahorro Fortaleza: el tramo "pre-entrega" del cuotero son los aportes
// mensuales mientras el socio espera la adjudicación; el "post-entrega" es el saldo financiado
// una vez adjudicada la unidad.

export type Refuerzo = { periodo: number; monto: number };
export type Override = { periodo: number; monto: number };

export type EntradaSimulacion = {
  /** Valor de la unidad, en guaraníes. */
  valor: number;
  /** Cuotas antes de la adjudicación (sin interés). */
  cuotasPre: number;
  /** Cuotas totales del plan. */
  cuotasTotales: number;
  /** Tasa periódica del tramo post-adjudicación (decimal: 0.009 = 0,9% mensual). */
  tasa: number;
  /** Fecha de la primera cuota (ISO AAAA-MM-DD). */
  inicio: string;
  /** Meses entre cuotas. */
  frecuencia?: number;
  refuerzos?: Refuerzo[];
  /** Cuotas con monto fijado a mano. */
  overrides?: Override[];
};

export type Tramo = "Pre-adjudicación" | "Post-adjudicación" | "Refuerzo";

export type FilaCronograma = {
  periodo: number;
  fecha: string;
  tramo: Tramo;
  monto: number;
  amortizacion: number;
  interes: number;
  saldo: number;
};

export type ResumenCronograma = {
  valor: number;
  cuotasPre: number;
  cuotasPost: number;
  refuerzos: number;
  cuotaPre: number;
  cuotaPost: number;
  totalPre: number;
  totalPost: number;
  totalRefuerzos: number;
  totalIntereses: number;
  interesesCapitalizados: number;
  totalPagado: number;
};

export type Cronograma = { filas: FilaCronograma[]; resumen: ResumenCronograma };

const r2 = (v: number) => Math.round(v * 100) / 100;
const centavos = (v: number) => Math.round(v * 100);

/** Avanza `meses` manteniendo el día inicial si el mes lo permite (31 ene + 1 mes → 28/29 feb). */
export function sumarMeses(fecha: Date, meses: number, diaInicial: number): Date {
  const out = new Date(fecha.getTime());
  out.setDate(1);
  out.setMonth(out.getMonth() + meses);
  const ultimo = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(diaInicial, ultimo));
  return out;
}

const fechaISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Cuota fija que amortiza `capital` en `cuotas` períodos a la tasa dada.
 *
 * Búsqueda binaria de 60 iteraciones sobre el saldo final, igual que el original. Se podría usar
 * la fórmula cerrada del sistema francés, pero se mantiene el método del cuotero para que el
 * resultado sea idéntico hasta el último centavo.
 */
export function resolverCuotaPost(capital: number, cuotas: number, tasa: number): number {
  if (cuotas <= 0) return 0;
  const saldoFinal = (pago: number) => {
    let saldo = capital;
    for (let i = 1; i <= cuotas; i++) {
      const interes = Math.max(0, saldo * tasa);
      saldo -= pago - interes;
    }
    return saldo;
  };
  let bajo = 0;
  let alto = capital * (1 + tasa) ** (cuotas + 1);
  for (let k = 0; k < 60; k++) {
    const medio = (bajo + alto) / 2;
    if (saldoFinal(medio) > 0) bajo = medio;
    else alto = medio;
  }
  return r2((bajo + alto) / 2);
}

export function generarCronograma(entrada: EntradaSimulacion): Cronograma {
  const {
    valor,
    cuotasPre,
    cuotasTotales,
    tasa,
    inicio,
    frecuencia = 1,
    refuerzos = [],
    overrides = [],
  } = entrada;

  const cuotasPost = Math.max(cuotasTotales - cuotasPre, 0);

  // Refuerzos y overrides por período.
  const refuerzosPorPeriodo = new Map<number, number[]>();
  for (const x of refuerzos) {
    const p = Math.trunc(x.periodo);
    if (p < 1 || !Number.isFinite(x.monto)) continue;
    refuerzosPorPeriodo.set(p, [...(refuerzosPorPeriodo.get(p) ?? []), x.monto]);
  }
  const overridePorPeriodo = new Map<number, number>();
  for (const x of overrides) {
    const p = Math.trunc(x.periodo);
    if (p < 1 || !Number.isFinite(x.monto)) continue;
    overridePorPeriodo.set(p, x.monto);
  }
  const totalRefuerzos = refuerzos.reduce(
    (t, x) => t + (Number.isFinite(x.monto) ? x.monto : 0),
    0,
  );

  // ── Cuota del tramo pre-adjudicación ────────────────────────────────────────────────
  const totalPreEsperado =
    cuotasTotales > 0 && cuotasPre > 0
      ? cuotasPost === 0
        ? valor - totalRefuerzos
        : (valor * cuotasPre) / cuotasTotales
      : 0;
  const overridesPre = [...overridePorPeriodo.entries()].filter(([p]) => p >= 1 && p <= cuotasPre);
  const sumaOverridesPre = overridesPre.reduce((t, [, m]) => t + m, 0);
  const cuotasPreLibres = cuotasPre - overridesPre.length;
  const cuotaPre =
    cuotasPreLibres > 0 ? (totalPreEsperado - sumaOverridesPre) / cuotasPreLibres : 0;
  const principalPre = sumaOverridesPre + cuotaPre * cuotasPreLibres;

  // ── Capital a financiar después de la adjudicación ──────────────────────────────────
  let refuerzosPre = 0;
  let refuerzosVp = 0;
  const vpPorPeriodo = new Map<number, number>();
  for (const [p, montos] of refuerzosPorPeriodo)
    for (const monto of montos) {
      if (p <= cuotasPre) {
        refuerzosPre += monto;
      } else {
        const vp = tasa > 0 ? monto / (1 + tasa) ** (p - cuotasPre) : monto;
        refuerzosVp += vp;
        vpPorPeriodo.set(p, (vpPorPeriodo.get(p) ?? 0) + vp);
      }
    }

  // Interés del tramo de obra que se capitaliza (ver cabecera del archivo).
  let interesesCapitalizados = 0;
  if (cuotasPre > 0 && cuotasPost > 0 && tasa > 0) {
    const faltanteMensual = valor / cuotasPre - valor / cuotasTotales;
    interesesCapitalizados = (faltanteMensual * tasa * cuotasPre * (cuotasPre + 1)) / 2;
  }
  const capitalPost = Math.max(
    0,
    valor - principalPre - refuerzosPre - refuerzosVp + interesesCapitalizados,
  );
  const cuotaPost = resolverCuotaPost(capitalPost, cuotasPost, tasa);

  // ── Recorrido del cronograma ────────────────────────────────────────────────────────
  const base = new Date(`${inicio}T00:00:00`);
  const fechaBase = Number.isNaN(base.getTime()) ? new Date() : base;
  const diaInicial = fechaBase.getDate();

  const filas: FilaCronograma[] = [];
  const indicesPreLibres: number[] = [];
  let saldo = valor;
  let saldoVp = capitalPost;
  let fecha = fechaBase;

  for (let i = 1; i <= cuotasTotales; i++) {
    // El interés capitalizado entra al saldo nominal justo al empezar el tramo financiado.
    if (i === cuotasPre + 1 && interesesCapitalizados > 0) saldo += interesesCapitalizados;

    for (const monto of refuerzosPorPeriodo.get(i) ?? []) {
      const financiado = i > cuotasPre && tasa > 0 && cuotasPost > 0;
      const amortizacion = financiado ? (vpPorPeriodo.get(i) ?? monto) : monto;
      const interes = financiado ? monto - amortizacion : 0;
      saldo -= amortizacion;
      filas.push({
        periodo: i,
        fecha: fechaISO(fecha),
        tramo: "Refuerzo",
        monto,
        amortizacion,
        interes,
        saldo: r2(saldo),
      });
    }

    if (i <= cuotasPre) {
      const monto = overridePorPeriodo.get(i) ?? cuotaPre;
      saldo -= monto;
      filas.push({
        periodo: i,
        fecha: fechaISO(fecha),
        tramo: "Pre-adjudicación",
        monto,
        amortizacion: monto,
        interes: 0,
        saldo: r2(saldo),
      });
      if (!overridePorPeriodo.has(i)) indicesPreLibres.push(filas.length - 1);
    } else {
      const monto = overridePorPeriodo.get(i) ?? cuotaPost;
      const interes = Math.max(0, saldoVp * tasa);
      const amortizacion = monto - interes;
      saldoVp -= amortizacion;
      saldo -= amortizacion;
      filas.push({
        periodo: i,
        fecha: fechaISO(fecha),
        tramo: "Post-adjudicación",
        monto,
        amortizacion,
        interes,
        saldo: r2(saldo),
      });
    }

    fecha = sumarMeses(fecha, frecuencia, diaInicial);
  }

  // Limpieza de residuos de redondeo, igual que el original.
  for (const fila of filas) if (Math.abs(fila.saldo) < 0.005) fila.saldo = 0;
  const ultima = filas[filas.length - 1];
  if (ultima && Math.abs(ultima.saldo) < 1) ultima.saldo = 0;

  // Sin tramo financiado, el residuo del reparto se ajusta en la última cuota flexible.
  if (cuotasPost === 0 && indicesPreLibres.length) {
    const objetivo = centavos(valor - totalRefuerzos);
    const puesto = filas
      .filter((x) => x.tramo === "Pre-adjudicación")
      .reduce((t, x) => t + centavos(x.amortizacion), 0);
    const residuo = objetivo - puesto;
    if (residuo !== 0) {
      const idx = indicesPreLibres[indicesPreLibres.length - 1]!;
      const delta = residuo / 100;
      filas[idx]!.monto += delta;
      filas[idx]!.amortizacion += delta;
      let acumulado = valor;
      for (const fila of filas) {
        acumulado -= fila.amortizacion;
        fila.saldo = Math.abs(acumulado) < 0.005 ? 0 : r2(acumulado);
      }
    }
  }

  const sumaPorTramo = (tramo: Tramo, campo: "amortizacion" | "interes" | "monto") =>
    filas.filter((x) => x.tramo === tramo).reduce((t, x) => t + centavos(x[campo]), 0) / 100;

  return {
    filas,
    resumen: {
      valor: r2(valor),
      cuotasPre: filas.filter((x) => x.tramo === "Pre-adjudicación").length,
      cuotasPost: filas.filter((x) => x.tramo === "Post-adjudicación").length,
      refuerzos: filas.filter((x) => x.tramo === "Refuerzo").length,
      cuotaPre: r2(cuotaPre),
      cuotaPost,
      totalPre: sumaPorTramo("Pre-adjudicación", "amortizacion"),
      totalPost: sumaPorTramo("Post-adjudicación", "amortizacion"),
      totalRefuerzos: sumaPorTramo("Refuerzo", "amortizacion"),
      totalIntereses: filas.reduce((t, x) => t + centavos(x.interes), 0) / 100,
      interesesCapitalizados: r2(interesesCapitalizados),
      totalPagado: filas.reduce((t, x) => t + centavos(x.monto), 0) / 100,
    },
  };
}
