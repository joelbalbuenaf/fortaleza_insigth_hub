// Nombre visible de cada herramienta mientras corre.
//
// Vive aparte de tools.ts a propósito: el chip de la UI necesita estas etiquetas en el cliente, y
// tools.ts importa src/server/, así que importarlo desde un componente rompería la frontera de
// datos (la import-protection de Vite falla el build). Acá no hay datos, solo texto.
export const etiquetasHerramientas: Record<string, string> = {
  consultar_cartera: "Consultando la cartera",
  analizar_crecimiento: "Analizando el crecimiento",
  buscar_socio: "Buscando socio",
  ranking_socios: "Armando ranking de socios",
  proyectar_cartera: "Proyectando la recaudación",
  analizar_mora: "Analizando la mora",
  analizar_desercion: "Analizando la deserción",
  riesgo_de_desercion: "Calculando riesgo de deserción",
  consultar_adjudicaciones: "Revisando adjudicaciones",
  simular_adjudicacion: "Simulando adjudicación",
  consultar_proyectos: "Revisando proyectos",
  analizar_obra: "Revisando la obra",
  simular_plan: "Simulando un plan",
  consultar_mercado: "Revisando el mercado",
  evaluar_terreno: "Evaluando un terreno",
  detectar_alertas: "Buscando alertas",
  crear_grafico: "Preparando gráfico",
};

export const etiquetaDe = (nombre: string) => etiquetasHerramientas[nombre] ?? nombre;
