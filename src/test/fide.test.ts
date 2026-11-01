import { describe, expect, it } from "vitest";
import { graficosDisponibles } from "@/lib/charts";
import { APORTE_ESPERA, APORTE_POSESION, asesores, situaciones } from "@/lib/data/filtros";
import { separarSugerencias } from "@/components/fide/FideMessage";
import { responderEnDemo } from "@/lib/fide/demo";
import { etiquetaDe, etiquetasHerramientas } from "@/lib/fide/etiquetas";
import { aMensajesAnthropic } from "@/lib/fide/historial";
import { ejecutarHerramienta, herramientas } from "@/lib/fide/tools";
import { SYSTEM_PROMPT } from "@/lib/fide/prompt";
import type { EscritorFide } from "@/lib/fide/writer";
import type { ChartSpec } from "@/lib/charts";
import { construirGrafico } from "@/server/graficos";
import { PERIODO_ACTUAL, rankingSocios } from "@/server/socios/consultas";

const primero = rankingSocios(PERIODO_ACTUAL, "oferta")[0]!;

function escritorFalso() {
  const texto: string[] = [];
  const herramientasUsadas: string[] = [];
  const graficos: ChartSpec[] = [];
  const w = {
    textoInicio: () => "t",
    textoDelta: (_: string, d: string) => texto.push(d),
    textoFin: () => {},
    razonamientoInicio: () => "r",
    razonamientoDelta: () => {},
    razonamientoFin: () => {},
    herramientaInicio: () => {},
    herramienta: async (nombre: string, _input: unknown, ejecutar: () => unknown) => {
      herramientasUsadas.push(nombre);
      return ejecutar();
    },
    grafico: (g: ChartSpec) => graficos.push(g),
    error: () => {},
  } as unknown as EscritorFide;
  return { w, texto: () => texto.join(""), herramientasUsadas, graficos };
}

describe("herramientas de Fide", () => {
  it("cada herramienta corre con una entrada mínima válida", () => {
    const entradas: Record<string, unknown> = {
      consultar_cartera: { agrupar: "plan" },
      ranking_socios: { orden: "atraso", limite: 5 },
      buscar_socio: { contrato: primero.contrato },
      proyectar_cartera: { ajuste_pct: 5 },
      simular_adjudicacion: { antiguedad_meses: 48, pagado_gs: 100_000_000, puntos: 40 },
      simular_plan: { valor: 420_000_000, cuotas_totales: 180, cuotas_pre: 60 },
      evaluar_terreno: { barrio: "Villa Morra" },
      crear_grafico: { grafico: "cartera_mensual" },
    };
    for (const h of herramientas) {
      const r = ejecutarHerramienta(h.name, entradas[h.name] ?? {});
      expect(r.resultado, h.name).toBeTruthy();
    }
  });

  it("rechaza entradas inválidas", () => {
    expect(() => ejecutarHerramienta("consultar_cartera", { agrupar: "planeta" })).toThrow();
    expect(() => ejecutarHerramienta("simular_plan", { valor: 10 })).toThrow();
    expect(() => ejecutarHerramienta("no_existe", {})).toThrow();
  });

  it("toda herramienta tiene etiqueta en el módulo que usa el cliente", () => {
    // etiquetas.ts es el único lugar que la UI puede importar sin romper la frontera de datos.
    for (const h of herramientas) expect(etiquetasHerramientas[h.name], h.name).toBeTruthy();
    expect(Object.keys(etiquetasHerramientas)).toHaveLength(herramientas.length);
    expect(etiquetaDe("inexistente")).toBe("inexistente");
  });

  it("todos los gráficos del catálogo se construyen y declaran su fuente", () => {
    for (const g of graficosDisponibles) {
      const spec = construirGrafico({ grafico: g });
      expect(spec.datos.length, g).toBeGreaterThan(0);
      expect(spec.series.length, g).toBeGreaterThan(0);
      expect(["real", "publico", "ilustrativo", "mixto"], g).toContain(spec.fuente);
      expect(spec.titulo, g).toBeTruthy();
      expect(spec.unidad, g).toBeTruthy();
    }
    // La estructura pública con cantidades supuestas se declara "mixto"; la cartera, "ilustrativo".
    expect(construirGrafico({ grafico: "unidades_por_proyecto" }).fuente).toBe("mixto");
    expect(construirGrafico({ grafico: "cartera_mensual" }).fuente).toBe("ilustrativo");
  });

  it("el prompt prohíbe prometer plazos y nombrar socios", () => {
    expect(SYSTEM_PROMPT).toContain("Nunca presentes rentabilidades");
    expect(SYSTEM_PROMPT).toContain("nunca por nombre");
    expect(SYSTEM_PROMPT).toContain("ILUSTRATIVO");
    // El catálogo de gráficos viaja en el prompt, así que Fide no puede inventar uno.
    for (const g of graficosDisponibles) expect(SYSTEM_PROMPT).toContain(g);
  });

  it("el prompt exige leer cada gráfico en el texto", () => {
    // Sin esto el modelo manda el gráfico y resuelve con una línea; el gráfico lo dibuja el
    // sistema, pero la interpretación es lo único que el modelo aporta.
    expect(SYSTEM_PROMPT).toContain("NUNCA dejes un gráfico mudo");
    expect(SYSTEM_PROMPT).toContain("LECTURA");
    expect(SYSTEM_PROMPT).toContain("composición");
  });

  it("el prompt nombra las tres situaciones y los dos aportes", () => {
    for (const s of situaciones) expect(SYSTEM_PROMPT).toContain(s);
    // Los valores van desde la constante, así que no pueden quedar desfasados del modelo.
    expect(SYSTEM_PROMPT).toContain(APORTE_ESPERA.toLocaleString("es-PY"));
    expect(SYSTEM_PROMPT).toContain(APORTE_POSESION.toLocaleString("es-PY"));
    // Y aclara que los dos ejes son independientes, que es el error fácil de cometer.
    expect(SYSTEM_PROMPT).toContain("puede estar en mora");
    // El asesor y el canal de alta son dos cosas distintas: el prompt lo dice.
    expect(SYSTEM_PROMPT).toContain("CANAL DE ALTA");
    expect(SYSTEM_PROMPT).toContain(asesores[0]!);
  });

  it("las herramientas cortan por asesor y por situación, y agrupan por situación", () => {
    const porSituacion = ejecutarHerramienta("consultar_cartera", { agrupar: "situacion" })
      .resultado as { desglose: { clave: string; contratos: number }[] };
    expect(porSituacion.desglose.map((d) => d.clave).sort()).toEqual([...situaciones].sort());

    const unAsesor = ejecutarHerramienta("consultar_cartera", {
      agrupar: "total",
      asesor: asesores[3],
    }).resultado as { contratos: number };
    const todos = ejecutarHerramienta("consultar_cartera", { agrupar: "total" }).resultado as {
      contratos: number;
    };
    expect(unAsesor.contratos).toBeGreaterThan(0);
    expect(unAsesor.contratos).toBeLessThan(todos.contratos);

    // El cruce que el modelo viejo no podía responder.
    const mora = ejecutarHerramienta("analizar_mora", {}).resultado as {
      porSituacion: { situacion: string; enMora: number; cuotaMensualGs: number }[];
    };
    const pos = mora.porSituacion.find((x) => x.situacion === "Con posesión")!;
    expect(pos.enMora).toBeGreaterThan(0);
    expect(pos.cuotaMensualGs).toBe(APORTE_POSESION);

    const desercion = ejecutarHerramienta("analizar_desercion", { agrupar: "situacion" })
      .resultado as { desglose: { clave: string }[] };
    expect(desercion.desglose.map((d) => d.clave).sort()).toEqual([...situaciones].sort());

    // Filtrar por situación y por estado de pago a la vez devuelve solo ese cruce.
    const ranking = ejecutarHerramienta("ranking_socios", {
      orden: "atraso",
      situacion: "Con posesión",
      estado_pago: "En mora",
      limite: 5,
    }).resultado as { socios: { situacion: string; estadoPago: string }[] };
    expect(ranking.socios.length).toBeGreaterThan(0);
    expect(
      ranking.socios.every((s) => s.situacion === "Con posesión" && s.estadoPago === "En mora"),
    ).toBe(true);
  });
});

describe("modo demo", () => {
  const casos: [string, string][] = [
    ["¿Cómo viene la recaudación de 2026 frente a 2025?", "consultar_cartera"],
    ["¿Cómo está repartida la mora por tramo de atraso?", "analizar_mora"],
    ["Compará la deserción por canal de alta", "analizar_desercion"],
    ["¿Cómo vienen los actos de adjudicación mes a mes?", "consultar_adjudicaciones"],
    ["Simulá la chance de adjudicación de un socio con 4 años", "simular_adjudicacion"],
    ["¿Qué obras están atrasadas frente al cronograma?", "analizar_obra"],
    ["¿Dónde conviene buscar el próximo terreno?", "evaluar_terreno"],
    ["¿Cómo están los precios de m² por barrio?", "consultar_mercado"],
    ["¿Cómo viene el catálogo de proyectos?", "consultar_proyectos"],
    ["Simulá un plan de 180 cuotas con 60 cuotas antes de la adjudicación", "simular_plan"],
    ["Proyectá la recaudación y explicá las limitaciones", "proyectar_cartera"],
    ["Compará los asesores por recaudación", "consultar_cartera"],
    [
      "¿De qué se compone la recaudación entre los que esperan y los que tienen posesión?",
      "consultar_cartera",
    ],
    ["¿Cómo viene el crecimiento neto de la cartera?", "analizar_crecimiento"],
    ["¿Qué alertas atenderías primero?", "detectar_alertas"],
    ["Prepará un resumen ejecutivo con tres oportunidades", "detectar_alertas"],
  ];
  for (const [pregunta, herramienta] of casos)
    // Cada caso corre las herramientas de verdad sobre toda la cartera: el default de 5 s queda
    // justo y la suite se pone intermitente.
    it(`responde: ${pregunta}`, { timeout: 30_000 }, async () => {
      const f = escritorFalso();
      await responderEnDemo(pregunta, f.w);
      expect(f.herramientasUsadas).toContain(herramienta);
      const { texto, sugerencias } = separarSugerencias(f.texto());
      expect(sugerencias).toHaveLength(3);
      // Una respuesta no es una tabla suelta: quien pregunta ya tiene los números en las
      // pantallas, lo que no tiene es la lectura. Y un gráfico sin texto que lo lea es trabajo
      // a medias, así que el piso sube cuando la respuesta trae gráficos.
      expect(texto.length, `${pregunta} (${f.graficos.length} gráficos)`).toBeGreaterThan(
        f.graficos.length ? 1000 : 600,
      );
      // Fuera de las tablas tiene que haber prosa, no solo filas de datos.
      const prosa = texto
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("|"))
        .join(" ");
      expect(prosa.length, pregunta).toBeGreaterThan(400);
    });

  it("responde a un número de contrato con su ficha", async () => {
    const f = escritorFalso();
    await responderEnDemo(`¿Cómo viene el contrato ${primero.contrato}?`, f.w);
    expect(f.herramientasUsadas).toContain("buscar_socio");
    expect(f.texto()).toContain(primero.contrato);
  });

  it("no promete plazos de adjudicación", async () => {
    const f = escritorFalso();
    await responderEnDemo("¿Cuándo me toca la adjudicación?", f.w);
    const texto = f.texto().toLowerCase();
    expect(texto).toContain("no es un plazo");
  });

  it("explica qué falta para trabajar con la cartera real", async () => {
    const f = escritorFalso();
    await responderEnDemo("¿Qué análisis no se pueden hacer con estos datos?", f.w);
    expect(f.texto()).toContain("ilustrativa");
  });

  it("sin intención reconocida da un panorama y no se cae", async () => {
    const f = escritorFalso();
    await responderEnDemo("asdfgh qwerty", f.w);
    expect(f.herramientasUsadas).toContain("consultar_cartera");
    expect(separarSugerencias(f.texto()).sugerencias).toHaveLength(3);
  });
});

describe("historial", () => {
  it("convierte a mensajes de la API empezando por el usuario y resume gráficos", () => {
    const msgs = aMensajesAnthropic([
      { id: "a", role: "assistant", parts: [{ type: "text", text: "hola" }] },
      { id: "b", role: "user", parts: [{ type: "text", text: "¿recaudación?" }] },
      {
        id: "c",
        role: "assistant",
        parts: [
          { type: "data-chart", data: construirGrafico({ grafico: "cartera_mensual" }) },
          { type: "text", text: "Listo" },
        ],
      },
    ]);
    expect(msgs[0]?.role).toBe("user");
    expect(String(msgs[1]?.content)).toContain("[Gráfico mostrado:");
  });
});
