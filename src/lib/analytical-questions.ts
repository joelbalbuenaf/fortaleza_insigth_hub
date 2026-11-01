// Preguntas sugeridas para Fide. Llegan al navegador: sin números de contrato ni cifras reales.
export const categoriasPreguntas = {
  Cartera: [
    "¿Cómo viene la recaudación de 2026 frente a 2025?",
    "Compará los asesores por recaudación, altas y mora.",
    "¿Cómo viene el crecimiento neto de la cartera?",
    "¿Cómo se reparte la cartera entre los planes?",
    "¿De qué barrios vienen los socios?",
    "¿Qué tan concentrada está la recaudación?",
  ],
  "Mora y deserción": [
    "¿Cómo está repartida la mora por tramo de atraso?",
    "¿A qué socios en mora conviene contactar primero y cuánta recaudación está en juego?",
    "¿La mora viene subiendo o bajando?",
    "Compará la deserción por canal de alta y decime qué cambiarías en la venta.",
    "¿Cómo viene la retención por cohorte de alta?",
    "¿Qué factores explican el riesgo de deserción y dónde se concentra?",
  ],
  Adjudicaciones: [
    "¿Cómo vienen los actos de adjudicación mes a mes?",
    "¿Cuánto esperan los socios hasta adjudicarse?",
    "¿Qué oferta hace falta para ganar una licitación?",
    "¿Cómo viene la cola de adjudicación y qué espera tienen los socios?",
    "Simulá la chance de adjudicación de un socio con 4 años de antigüedad.",
  ],
  "Proyectos y obra": [
    "¿Qué obras están atrasadas frente al cronograma?",
    "¿Los aportes alcanzan para el cronograma de obra comprometido?",
    "¿Cómo viene el catálogo de proyectos de Fortaleza?",
    "¿Qué tipologías predominan en el catálogo?",
  ],
  "Mercado y terrenos": [
    "¿Cómo están los precios de m² por barrio?",
    "¿Dónde conviene buscar el próximo terreno?",
    "¿Dónde construye la competencia y dónde no estamos?",
    "Evaluá un terreno en Manorá.",
    "¿Cómo viene la absorción del mercado de departamentos?",
  ],
  "Planes y simulación": [
    "Simulá un plan de 180 cuotas con 60 cuotas antes de la adjudicación.",
    "¿Cuál es el ticket promedio de cada plan?",
    "Proyectá la recaudación y explicá las limitaciones del modelo.",
  ],
  Oportunidades: [
    "Prepará un resumen ejecutivo con tres oportunidades, evidencia y próximos pasos.",
    "¿Qué alertas atenderías primero?",
    "¿Qué análisis se podrían hacer con la cartera real que hoy no se pueden?",
  ],
};

/** Oportunidades de trabajo sobre la cartera (sin cifras: las calcula Fide al preguntar). */
export const oportunidades = [
  {
    titulo: "Rescatar a los socios con 3 o más cuotas impagas",
    evidencia: "A las siete cuotas el contrato se cae, y ese tramo casi no se recupera solo.",
    accion: "Contactar por orden de recaudación en juego, no por orden de atraso.",
    pregunta:
      "¿A qué socios en mora conviene contactar primero y cuánta recaudación está en juego?",
    prioridad: "Alta",
  },
  {
    titulo: "Corregir la retención del canal web",
    evidencia: "El canal con peor deserción pierde socios en el primer año.",
    accion: "Sumar contacto humano en el alta y seguimiento en los primeros 12 meses.",
    pregunta: "Compará la deserción por canal de alta y decime qué cambiarías en la venta.",
    prioridad: "Alta",
  },
  {
    titulo: "Alinear el fondeo con el cronograma de obra",
    evidencia: "Hay proyectos donde la obra ejecutada va por delante de los aportes asignados.",
    accion: "Revisar el ritmo de adjudicación y la asignación de aportes por proyecto.",
    pregunta: "¿Los aportes alcanzan para el cronograma de obra comprometido?",
    prioridad: "Media",
  },
  {
    titulo: "Elegir el próximo terreno donde no estamos",
    evidencia: "Hay barrios con competencia construyendo y sin ningún proyecto de Fortaleza.",
    accion: "Evaluar terrenos en esos barrios antes de que se encarezca el m².",
    pregunta: "¿Dónde conviene buscar el próximo terreno?",
    prioridad: "Media",
  },
];
