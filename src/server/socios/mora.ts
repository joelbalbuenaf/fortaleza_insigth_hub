// Mora, deserción y riesgo de abandono (solo servidor). Datos ILUSTRATIVOS.
//
// Tres miradas distintas y conviene no confundirlas:
//   - MORA: cuotas impagas pendientes hoy. Es un stock.
//   - DESERCIÓN: contratos que ya se cayeron. Es un hecho consumado.
//   - RIESGO: socios que todavía están, pero se parecen a los que desertaron. Es una predicción,
//     y el scoring expone sus factores para que una persona pueda discutirla.
import { nombrePlan, situaciones, type Canal, type Plan, type Situacion } from "@/lib/data/filtros";
import { etiquetaPeriodo, periodos, rango, desplazar, ULTIMO_PERIODO } from "@/lib/data/periodos";
import { redondear } from "@/lib/data/random";
import {
  antiguedadMeses,
  aporteDelMes,
  atrasoAl,
  ATRASO_LIMITE,
  cobradoEnRango,
  cuotasDe,
  emitido,
  esActivo,
  contratos,
  situacionDe,
  type Contrato,
} from "./datos";
import { filtrar, PERIODO_ACTUAL, type FiltroCartera } from "./consultas";

const mm = (guaranies: number, d = 0) => redondear(guaranies / 1_000_000, d);

/** Contratos por persona, contado una sola vez: el scoring se corre sobre miles de contratos. */
const contratosPorSocio = contratos.reduce(
  (m, c) => m.set(c.socioId, (m.get(c.socioId) ?? 0) + 1),
  new Map<string, number>(),
);

/** Cuota vigente del socio al cierre del período. */
function cuotaVigente(s: Contrato, hasta: string) {
  return emitido(s, hasta) || aporteDelMes(hasta, situacionDe(s, hasta) === "Con posesión");
}

// ── Mora por tramo de atraso ───────────────────────────────────────────────────────────

const TRAMOS = [
  { clave: "1-2", nombre: "1 a 2 cuotas", min: 1, max: 2 },
  { clave: "3-4", nombre: "3 a 4 cuotas", min: 3, max: 4 },
  { clave: "5-6", nombre: "5 a 6 cuotas", min: 5, max: ATRASO_LIMITE - 1 },
] as const;

export function moraPorTramo(f: FiltroCartera = PERIODO_ACTUAL) {
  const activos = filtrar(f).filter((s) => esActivo(s, f.hasta));
  return TRAMOS.map((t) => {
    const lista = activos.filter((s) => {
      const a = atrasoAl(s, f.hasta);
      return a >= t.min && a <= t.max;
    });
    return {
      tramo: t.clave,
      nombre: t.nombre,
      socios: lista.length,
      cuotas: lista.reduce((n, s) => n + atrasoAl(s, f.hasta), 0),
      saldoMM: mm(lista.reduce((n, s) => n + atrasoAl(s, f.hasta) * cuotaVigente(s, f.hasta), 0)),
      // A más atraso, menos chance de recuperar: es el tramo que hay que atacar primero.
      riesgoDeCaida: t.min >= 5 ? "alto" : t.min >= 3 ? "medio" : "bajo",
    };
  });
}

/**
 * Mora comparada por situación del contrato: ¿se atrasa más el que todavía espera su unidad o el
 * que ya la recibió? Son poblaciones distintas — el que tiene posesión paga una cuota tres veces
 * mayor y ya recibió lo que esperaba — así que el porcentaje se calcula dentro de cada grupo.
 */
export function moraPorSituacion(f: FiltroCartera = PERIODO_ACTUAL) {
  const activos = filtrar(f).filter((s) => esActivo(s, f.hasta));
  return situaciones.map((situacion) => {
    const lista = activos.filter((s) => situacionDe(s, f.hasta) === situacion);
    const enMora = lista.filter((s) => atrasoAl(s, f.hasta) >= 1);
    const emi = lista.reduce((t, s) => t + emitido(s, f.hasta), 0);
    const saldo = enMora.reduce((t, s) => t + atrasoAl(s, f.hasta) * cuotaVigente(s, f.hasta), 0);
    return {
      situacion,
      contratos: lista.length,
      enMora: enMora.length,
      moraPct: lista.length ? redondear((enMora.length / lista.length) * 100, 1) : 0,
      saldoMM: mm(saldo),
      /** Saldo en mora sobre lo que ese grupo factura en el mes. */
      pctFacturacion: emi ? redondear((saldo / emi) * 100, 1) : 0,
      cuotaMensualGs: aporteDelMes(f.hasta, situacion === "Con posesión"),
      atrasoPromedio: enMora.length
        ? redondear(enMora.reduce((t, s) => t + atrasoAl(s, f.hasta), 0) / enMora.length, 1)
        : 0,
    };
  });
}

/** Evolución mensual de la mora: saldo y % sobre lo emitido del mes. */
export function evolucionMora(f: FiltroCartera = PERIODO_ACTUAL) {
  const lista = filtrar(f);
  return rango(f.desde, f.hasta).map((periodo) => {
    const activos = lista.filter((s) => esActivo(s, periodo));
    const saldo = activos.reduce((t, s) => t + atrasoAl(s, periodo) * cuotaVigente(s, periodo), 0);
    const emi = activos.reduce((t, s) => t + emitido(s, periodo), 0);
    return {
      periodo,
      mes: etiquetaPeriodo(periodo),
      saldoMM: mm(saldo),
      pctFacturacion: emi ? redondear((saldo / emi) * 100, 1) : 0,
      sociosEnMora: activos.filter((s) => atrasoAl(s, periodo) > 0).length,
    };
  });
}

// ── Deserción por cohorte de alta ──────────────────────────────────────────────────────

/**
 * Supervivencia por cohorte: de los socios que entraron en cada año, qué proporción seguía
 * activa a los 12, 24 y 36 meses. Solo se cuentan las cohortes que ya tuvieron tiempo de
 * cumplir el hito; si no, el dato queda en null en lugar de mentir con un número parcial.
 */
export function cohortesDesercion() {
  const ultimo = periodos[periodos.length - 1]!;
  const anios = [...new Set(contratos.map((s) => Number(s.alta.slice(0, 4))))]
    .filter((a) => a >= 2022)
    .sort();

  return anios.map((anio) => {
    const cohorte = contratos.filter((s) => Number(s.alta.slice(0, 4)) === anio);
    const hito = (meses: number) => {
      // ¿Toda la cohorte llegó a cumplir ese hito dentro del calendario?
      const corte = desplazar(`${anio}-12`, meses);
      if (corte > ultimo) return null;
      const vivos = cohorte.filter((s) => !s.baja || s.baja > desplazar(s.alta, meses)).length;
      return redondear((vivos / cohorte.length) * 100, 1);
    };
    return {
      cohorte: String(anio),
      socios: cohorte.length,
      vivos12: hito(12),
      vivos24: hito(24),
      vivos36: hito(36),
      // Deserción observada hasta hoy, sin importar el hito.
      desercionActualPct: redondear(
        (cohorte.filter((s) => s.baja).length / cohorte.length) * 100,
        1,
      ),
    };
  });
}

/** Deserción agrupada por una dimensión del socio, para ver dónde se pierde más.
 *
 *  Para `situacion` se toma la del contrato en el momento en que terminó — la baja si se cayó, el
 *  cierre del calendario si sigue vivo — porque la pregunta es si se desertó esperando la unidad o
 *  ya viviendo en ella, y no dónde está hoy el que se fue hace tres años. */
export type DimensionDesercion = "plan" | "canal" | "asesor" | "situacion";

const claveDesercion = (s: Contrato, dimension: DimensionDesercion) =>
  dimension === "situacion" ? situacionDe(s, s.baja ?? ULTIMO_PERIODO) : String(s[dimension]);

export function desercionPor(dimension: DimensionDesercion) {
  const claves =
    dimension === "situacion"
      ? [...situaciones]
      : [...new Set(contratos.map((s) => claveDesercion(s, dimension)))].sort();
  return claves
    .map((clave) => {
      const lista = contratos.filter((s) => claveDesercion(s, dimension) === clave);
      const bajas = lista.filter((s) => s.baja);
      return {
        clave: String(clave),
        nombre: dimension === "plan" ? nombrePlan[clave as Plan] : String(clave),
        socios: lista.length,
        bajas: bajas.length,
        desercionPct: lista.length ? redondear((bajas.length / lista.length) * 100, 1) : 0,
        /** Cuánto aportaba por mes lo que se perdió. */
        cuotaPerdidaMM: mm(bajas.reduce((t, s) => t + cuotaVigente(s, s.baja!), 0)),
        /** Antigüedad típica al momento de la baja. */
        mesesHastaLaBaja: bajas.length
          ? Math.round(bajas.reduce((t, s) => t + antiguedadMeses(s, s.baja!), 0) / bajas.length)
          : 0,
      };
    })
    .sort((a, b) => b.desercionPct - a.desercionPct);
}

// ── Riesgo de deserción (scoring con factores explícitos) ──────────────────────────────

export type FactorRiesgo = { nombre: string; valor: string; aporte: number; explicacion: string };

/** Peso del canal de alta en el riesgo, según lo que muestra la deserción observada. */
const RIESGO_CANAL: Record<Canal, number> = {
  Web: 14,
  Eventos: 10,
  "App Fideliza": 6,
  Oficina: 2,
  Referido: 0,
};

/**
 * Puntaje 0–100 de riesgo de que el socio abandone el plan. No es un modelo entrenado: es una
 * suma de factores explícitos, elegidos porque son los que mueven la deserción en estos datos.
 * Se muestra con sus factores justamente para que se pueda discutir cada uno.
 */
export function riesgoDeSocio(s: Contrato, hasta: string) {
  const atraso = atrasoAl(s, hasta);
  const antiguedad = antiguedadMeses(s, hasta);
  const { emitidas, pagadas } = cuotasDe(s, hasta);
  const cumplimiento = emitidas ? pagadas / emitidas : 1;

  const fAtraso = Math.min(45, atraso * 13);
  const fAntiguedad = antiguedad <= 12 ? 20 : antiguedad <= 36 ? 10 : antiguedad <= 60 ? 4 : 0;
  const fCumplimiento = Math.min(20, Math.round((1 - cumplimiento) * 60));
  const fCanal = RIESGO_CANAL[s.canal];
  const fPlan = s.plan === "Amplia" ? 6 : s.plan === "Adicional" ? 3 : 0;
  // La situación tira para los dos lados y conviene verlo separado: quien ya tiene su unidad
  // tiene mucho más que perder (baja el riesgo), pero su cuota es cerca de 3× la de espera y
  // sostenerla es más difícil (lo sube). Se exponen como dos factores, no como uno neto.
  const situacion = situacionDe(s, hasta);
  const fSituacion = situacion === "Con posesión" ? -22 : situacion === "Adjudicado" ? -18 : 0;
  const fCuotaAlta = situacion === "Con posesión" ? 10 : 0;

  const puntaje = Math.max(
    0,
    Math.min(100, fAtraso + fAntiguedad + fCumplimiento + fCanal + fPlan + fSituacion + fCuotaAlta),
  );

  const factores: FactorRiesgo[] = [
    {
      nombre: "Atraso actual",
      valor: `${atraso} cuota${atraso === 1 ? "" : "s"}`,
      aporte: Math.round(fAtraso),
      explicacion: `Con ${ATRASO_LIMITE} cuotas impagas el contrato se cae; es el factor que más pesa.`,
    },
    {
      nombre: "Antigüedad",
      valor: `${Math.floor(antiguedad / 12)} a ${antiguedad % 12} m`,
      aporte: fAntiguedad,
      explicacion: "El primer año concentra la mayoría de las bajas.",
    },
    {
      nombre: "Cumplimiento histórico",
      valor: `${redondear(cumplimiento * 100, 1)}% (${pagadas}/${emitidas})`,
      aporte: fCumplimiento,
      explicacion: "Cuotas pagadas sobre emitidas desde el alta.",
    },
    {
      nombre: "Canal de alta",
      valor: s.canal,
      aporte: fCanal,
      explicacion: "Los referidos y la venta por asesor retienen mejor que la web y los eventos.",
    },
    {
      nombre: "Plan",
      valor: nombrePlan[s.plan],
      aporte: fPlan,
      explicacion: "La cuota más alta del Plan Amplia es más difícil de sostener.",
    },
    ...(fSituacion
      ? [
          {
            nombre: "Situación",
            valor:
              situacion === "Con posesión"
                ? `Con posesión desde ${etiquetaPeriodo(s.posesion!)}`
                : `Adjudicado en ${etiquetaPeriodo(s.adjudicado!)}`,
            aporte: fSituacion,
            explicacion:
              situacion === "Con posesión"
                ? "Ya vive en su unidad: es quien más tiene que perder si abandona."
                : "Ya tiene unidad asignada y espera la entrega: tiene mucho más que perder.",
          },
        ]
      : []),
    ...(fCuotaAlta
      ? [
          {
            nombre: "Cuota de posesión",
            valor: `Gs ${cuotaVigente(s, hasta).toLocaleString("es-PY")} al mes`,
            aporte: fCuotaAlta,
            explicacion:
              "El aporte con posesión es cerca de 3× el de espera, y sostenerlo es más difícil.",
          },
        ]
      : []),
  ];

  return {
    contrato: s.contrato,
    socioId: s.socioId,
    /** Contratos que tiene la misma persona: contactarla es una sola gestión, no varias. */
    contratosDelSocio: contratosPorSocio.get(s.socioId) ?? 1,
    plan: s.plan,
    asesor: s.asesor,
    situacion,
    canal: s.canal,
    barrio: s.barrio,
    atraso,
    antiguedadMeses: antiguedad,
    cuotaGs: cuotaVigente(s, hasta),
    aportadoMM: mm(s.pagadoPrevio + cobradoEnRango(s, periodos[0]!, hasta), 1),
    puntaje,
    nivel: puntaje >= 60 ? "Alto" : puntaje >= 35 ? "Medio" : "Bajo",
    factores,
  };
}

export type RiesgoSocio = ReturnType<typeof riesgoDeSocio>;

/**
 * Socios a contactar, ordenados por lo que está en juego: riesgo × cuota mensual. Un socio de
 * riesgo medio con cuota alta puede importar más que uno de riesgo alto con cuota chica.
 */
export function prioridadDeContacto(f: FiltroCartera = PERIODO_ACTUAL, limite = 25) {
  const activos = filtrar(f).filter((s) => esActivo(s, f.hasta) && atrasoAl(s, f.hasta) > 0);
  return activos
    .map((s) => {
      const r = riesgoDeSocio(s, f.hasta);
      return {
        ...r,
        /** Recaudación mensual en juego, en guaraníes. */
        enJuegoGs: Math.round((r.puntaje / 100) * r.cuotaGs),
      };
    })
    .sort((a, b) => b.enJuegoGs - a.enJuegoGs)
    .slice(0, limite);
}

/** Resumen de la cartera por nivel de riesgo, con la recaudación mensual asociada. */
export function resumenRiesgo(f: FiltroCartera = PERIODO_ACTUAL) {
  const activos = filtrar(f).filter((s) => esActivo(s, f.hasta));
  const niveles = ["Alto", "Medio", "Bajo"] as const;
  const conRiesgo = activos.map((s) => riesgoDeSocio(s, f.hasta));
  return niveles.map((nivel) => {
    const lista = conRiesgo.filter((r) => r.nivel === nivel);
    return {
      nivel,
      socios: lista.length,
      sociosPct: activos.length ? redondear((lista.length / activos.length) * 100, 1) : 0,
      cuotaMensualMM: mm(lista.reduce((t, r) => t + r.cuotaGs, 0)),
      atrasoPromedio: lista.length
        ? redondear(lista.reduce((t, r) => t + r.atraso, 0) / lista.length, 1)
        : 0,
    };
  });
}
