export const presentationSlides = [
  {
    title: "Decidir con la cartera a la vista",
    chapter: "Hub Analítico",
    notes:
      "Apertura. La propuesta es un Hub que pone la cartera del Sistema de Ahorro, las adjudicaciones y la obra en una sola pantalla. Aclarar de entrada que la cartera de la demo es ilustrativa y que lo único público es el catálogo de proyectos.",
  },
  {
    title: "La cartera se mira de a pedazos",
    chapter: "El problema",
    notes:
      "Escenario ilustrativo, no un diagnóstico verificado de Fortaleza. La idea: cobranza, adjudicaciones y obra viven en planillas distintas, así que nadie ve la foto completa ni a tiempo. En el piloto habría que medir cuánto tarda hoy una respuesta a estas preguntas.",
  },
  {
    title: "Tres preguntas que el Hub responde",
    chapter: "La propuesta",
    notes:
      "Quién se está cayendo del plan y cuánto cuesta; cuándo se adjudica y con qué chance; si los aportes alcanzan para la obra comprometida. Cada una tiene su módulo y su herramienta en Fide. Acordar criterios de aceptación antes de ampliar.",
  },
  {
    title: "Cobranza con prioridades, no con listas",
    chapter: "Salud de cartera",
    notes:
      "El scoring ordena por recaudación en juego, no por orden de atraso, y muestra sus factores para que una persona pueda discutirlos. No es un modelo entrenado: es una suma de factores explícitos. Con la cartera real se puede medir si la gestión de cobranza funcionó.",
  },
  {
    title: "Adjudicar es probabilidad, no promesa",
    chapter: "Adjudicaciones",
    notes:
      "El sorteo da la misma chance a todos los socios al día; la licitación ordena por oferta. El simulador describe el PRÓXIMO acto, no un plazo. Es importante decirlo así frente a socios: el Hub no promete fechas y el agente tiene prohibido inventarlas.",
  },
  {
    title: "Qué hace falta para pasar a producción",
    chapter: "Próximos pasos",
    notes:
      "Padrón de contratos con aportes mes a mes, actas de adjudicación, certificados de avance de obra y costos por proyecto. Las mismas pantallas y herramientas funcionan sin cambios: solo cambia el origen de los datos. Definir también accesos, porque pasan a ser datos personales.",
  },
] as const;

export function normalizeSlide(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(1, Math.min(presentationSlides.length, parsed)) : 1;
}
