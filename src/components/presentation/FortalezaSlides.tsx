import type { ReactNode } from "react";
import logo from "@/assets/logo-fortaleza.png";
import logoBlanco from "@/assets/logo-fortaleza-blanco.png";
import { presentationSlides } from "@/lib/presentation-data";
import {
  PROYECTOS_ENTREGADOS_SEGUN_SITIO,
  PROYECTOS_EN_OBRA_SEGUN_SITIO,
} from "@/lib/data/proyectos";

/**
 * Las seis diapositivas de la propuesta. No muestran cifras de la cartera: la cartera de la demo
 * es ilustrativa y una diapositiva es exactamente el lugar donde un número inventado se confunde
 * con un dato. Los únicos números son los públicos del sitio de Fortaleza.
 */
function Layout({
  index,
  children,
  dark = false,
}: {
  index: number;
  children: ReactNode;
  dark?: boolean;
}) {
  const slide = presentationSlides[index];
  return (
    <section
      className={`slide-content fz-slide ${dark ? "slide-dark" : ""}`}
      aria-label={slide?.title}
    >
      <header className="slide-header">
        <span className="slide-kicker">
          {index === 0
            ? "Propuesta · Hub Analítico"
            : `${String(index).padStart(2, "0")} — ${slide?.chapter}`}
        </span>
        <img src={dark ? logoBlanco : logo} alt="Fortaleza Inmuebles" style={{ height: 54 }} />
      </header>
      {children}
      <footer className="fz-footer">
        <span>Fortaleza Inmuebles · Hub Analítico</span>
        <span>
          Datos ilustrativos · {index + 1} / {presentationSlides.length}
        </span>
      </footer>
    </section>
  );
}

function Portada({ index }: { index: number }) {
  return (
    <Layout index={index} dark>
      <div className="fz-rule" />
      <h1 className="slide-title-lg" style={{ maxWidth: 1500 }}>
        Decidir con la cartera a la vista
      </h1>
      <p className="slide-body-lg" style={{ maxWidth: 1150, marginTop: 36, opacity: 0.85 }}>
        Un Hub que reúne la cartera del Sistema de Ahorro, las adjudicaciones y el avance de obra en
        una sola pantalla — y un agente que responde preguntas sobre esos datos.
      </p>
      <div className="fz-stats">
        <div>
          <p className="fz-stat-value">1992</p>
          <p className="fz-stat-label">Año de fundación del sistema</p>
        </div>
        <div>
          <p className="fz-stat-value">{PROYECTOS_ENTREGADOS_SEGUN_SITIO}</p>
          <p className="fz-stat-label">Proyectos entregados</p>
        </div>
        <div>
          <p className="fz-stat-value">{PROYECTOS_EN_OBRA_SEGUN_SITIO}</p>
          <p className="fz-stat-label">Torres en construcción</p>
        </div>
      </div>
      <p className="fz-note">
        Las tres cifras son públicas, del sitio de Fortaleza. Todo lo demás que se vea en esta demo
        —socios, aportes, mora, adjudicaciones, avance de obra— es un supuesto generado para mostrar
        la herramienta.
      </p>
    </Layout>
  );
}

function Problema({ index }: { index: number }) {
  const silos = [
    {
      n: "Cobranza",
      t: "¿Quién se está cayendo del plan?",
      d: "La mora se mira por planilla y por asesor. Saber cuánta recaudación está en riesgo se arma a mano.",
    },
    {
      n: "Adjudicaciones",
      t: "¿Cuándo le toca a cada socio?",
      d: "Las actas quedan en el expediente de cada acto. La espera típica y el corte de la licitación no se miran como serie.",
    },
    {
      n: "Obra",
      t: "¿Los aportes alcanzan?",
      d: "El avance de obra y la recaudación viven en lugares distintos, así que el calce se calcula tarde.",
    },
  ];
  return (
    <Layout index={index}>
      <div className="fz-rule" />
      <h1 className="slide-title" style={{ maxWidth: 1400, lineHeight: 1.02 }}>
        La cartera se mira de a pedazos
      </h1>
      <p
        className="slide-body"
        style={{ maxWidth: 1300, marginTop: 24, color: "var(--slide-muted)" }}
      >
        Tres preguntas que el negocio se hace todos los meses, y que hoy requieren juntar
        información de fuentes separadas.
      </p>
      <div className="fz-grid-3">
        {silos.map((s, i) => (
          <article key={s.n} className="fz-card">
            <span className="fz-card-num">{String(i + 1).padStart(2, "0")}</span>
            <h2 className="slide-subtitle" style={{ fontSize: 38 }}>
              {s.t}
            </h2>
            <p className="slide-caption" style={{ color: "var(--slide-muted)" }}>
              {s.d}
            </p>
            <span className="fz-chip" style={{ marginTop: "auto", alignSelf: "flex-start" }}>
              {s.n}
            </span>
          </article>
        ))}
      </div>
      <p className="fz-note">
        Es un escenario ilustrativo, no un diagnóstico verificado de Fortaleza: el piloto debería
        medir cuánto tarda hoy una respuesta a cada una de estas preguntas.
      </p>
    </Layout>
  );
}

function Propuesta({ index }: { index: number }) {
  const modulos = [
    {
      t: "Salud de cartera",
      p: "Quién se está cayendo y cuánto cuesta",
      d: "Mora por tramo de atraso, scoring de riesgo con factores a la vista y una lista de contactos ordenada por recaudación en juego.",
    },
    {
      t: "Radar de adjudicaciones",
      p: "Cómo viene la cola y qué chance hay",
      d: "Actos mes a mes separando sorteo y licitación, oferta ganadora mínima y un simulador del próximo acto.",
    },
    {
      t: "Calce financiero de obra",
      p: "Si los aportes alcanzan",
      d: "Avance contra cronograma por torre, aportes asignados contra obra ejecutada y proyección de caja.",
    },
  ];
  return (
    <Layout index={index}>
      <div className="fz-rule" />
      <h1 className="slide-title" style={{ maxWidth: 1400, lineHeight: 1.02 }}>
        Tres preguntas que el Hub responde
      </h1>
      <div className="fz-grid-3">
        {modulos.map((m) => (
          <article key={m.t} className="fz-card">
            <span className="fz-chip" style={{ alignSelf: "flex-start" }}>
              {m.t}
            </span>
            <h2 className="slide-subtitle" style={{ fontSize: 40 }}>
              {m.p}
            </h2>
            <p className="slide-caption" style={{ color: "var(--slide-muted)" }}>
              {m.d}
            </p>
          </article>
        ))}
      </div>
      <p className="fz-note">
        Hay además dos módulos de apoyo: el evaluador de terrenos y el simulador de planes, que
        reusa la misma lógica del cuotero que ya usa el equipo. Y Fide, el agente, que responde
        sobre todo lo anterior con las mismas herramientas que alimentan las pantallas.
      </p>
    </Layout>
  );
}

function Cartera({ index }: { index: number }) {
  const factores = [
    { n: "Atraso actual", v: "4 cuotas", a: "+45" },
    { n: "Antigüedad", v: "1 año 2 m", a: "+10" },
    { n: "Cumplimiento histórico", v: "78% (11/14)", a: "+13" },
    { n: "Canal de alta", v: "Web", a: "+14" },
  ];
  return (
    <Layout index={index}>
      <div className="fz-rule" />
      <h1 className="slide-title" style={{ maxWidth: 1400, lineHeight: 1.02 }}>
        Cobranza con prioridades, no con listas
      </h1>
      <div className="fz-two">
        <div>
          <p className="slide-body" style={{ marginBottom: 28 }}>
            La lista no se ordena por atraso: se ordena por <strong>recaudación en juego</strong>,
            que es riesgo por cuota. Un socio de riesgo medio con cuota alta puede importar más que
            uno de riesgo alto con cuota chica.
          </p>
          <table className="fz-table">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Atraso</th>
                <th>Riesgo</th>
                <th>En juego</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["F-1024xx", "4", "82 · Alto", "Gs 3,1 M"],
                ["F-1008xx", "2", "61 · Alto", "Gs 2,4 M"],
                ["F-1015xx", "3", "58 · Medio", "Gs 2,2 M"],
              ].map((f) => (
                <tr key={f[0]}>
                  <td>{f[0]}</td>
                  <td>{f[1]}</td>
                  <td>{f[2]}</td>
                  <td>{f[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <p className="slide-body" style={{ marginBottom: 24 }}>
            Y el puntaje se abre: cada factor muestra cuánto suma y por qué, para poder discutirlo.
          </p>
          {factores.map((f) => (
            <div key={f.n} className="fz-factor">
              <span>
                <strong>{f.n}</strong>
                <br />
                <span style={{ color: "var(--slide-muted)" }}>{f.v}</span>
              </span>
              <span className="fz-factor-aporte">{f.a}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="fz-note">
        Los contratos y los números de esta diapositiva son de ejemplo. El scoring no es un modelo
        entrenado: es una suma de factores explícitos, elegida para poder explicarla.
      </p>
    </Layout>
  );
}

function Adjudicaciones({ index }: { index: number }) {
  return (
    <Layout index={index} dark>
      <div className="fz-rule" />
      <h1 className="slide-title" style={{ maxWidth: 1500 }}>
        Adjudicar es probabilidad, no promesa
      </h1>
      <div className="fz-two">
        <article className="fz-card">
          <span className="fz-card-num">Sorteo</span>
          <p className="slide-body">
            Se extrae una bolilla de cada contenedor para formar el número de contrato. Todos los
            socios al día tienen <strong>la misma probabilidad</strong>, sin importar su antigüedad
            ni cuánto pagaron.
          </p>
          <p className="slide-caption" style={{ color: "var(--slide-muted)" }}>
            El Hub lo calcula como cupos del acto sobre contratos elegibles.
          </p>
        </article>
        <article className="fz-card">
          <span className="fz-card-num">Licitación</span>
          <p className="slide-body">
            Se abren los sobres ante escribano y gana la mejor oferta, que combina{" "}
            <strong>pagos realizados y puntos de beneficios</strong>.
          </p>
          <p className="slide-caption" style={{ color: "var(--slide-muted)" }}>
            El Hub muestra el corte del mes: qué oferta hizo falta para entrar.
          </p>
        </article>
      </div>
      <p className="fz-note">
        El simulador describe el <strong>próximo acto</strong>, no un plazo de adjudicación. Es una
        regla del producto y también del agente: Fide tiene prohibido devolver una fecha de
        adjudicación o una rentabilidad, porque el sistema no las promete.
      </p>
    </Layout>
  );
}

function Proximos({ index }: { index: number }) {
  const datos = [
    "Padrón de contratos con los aportes mes a mes (emitido y cobrado).",
    "Actas de adjudicación: sorteos, licitaciones y ofertas ganadoras.",
    "Certificados de avance de obra y costos por proyecto.",
    "Definición de accesos: con datos reales, la cartera son datos personales.",
  ];
  return (
    <Layout index={index}>
      <div className="fz-rule" />
      <h1 className="slide-title" style={{ maxWidth: 1400, lineHeight: 1.02 }}>
        Qué hace falta para pasar a producción
      </h1>
      <p className="slide-body" style={{ maxWidth: 1300, marginTop: 24 }}>
        Las pantallas, las herramientas y el agente ya están. Lo que cambia es el origen de los
        datos: hoy se generan, y pasarían a leerse.
      </p>
      <ul className="fz-list">
        {datos.map((d) => (
          <li key={d}>
            <span className="fz-check">✓</span>
            <span>{d}</span>
          </li>
        ))}
      </ul>
      <p className="fz-note">
        Mientras no haya datos reales, cada pantalla y cada respuesta del agente va rotulada como
        ilustrativa. Eso no es un detalle de la demo: es cómo está construido el Hub, y lo que
        permite mostrarlo sin que un supuesto se confunda con un dato.
      </p>
    </Layout>
  );
}

const diapositivas = [Portada, Problema, Propuesta, Cartera, Adjudicaciones, Proximos];

export function FortalezaSlide({ index }: { index: number }) {
  const Componente = diapositivas[index] ?? diapositivas[0]!;
  return <Componente index={index} />;
}
