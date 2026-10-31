import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Grid2X2,
  Maximize,
  Minimize,
  Printer,
  StickyNote,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScaledSlide } from "@/components/presentation/ScaledSlide";
import { FortalezaSlide } from "@/components/presentation/FortalezaSlides";
import { normalizeSlide, presentationSlides } from "@/lib/presentation-data";

export const Route = createFileRoute("/presentacion")({
  validateSearch: (search: Record<string, unknown>) => ({
    slide: normalizeSlide(search["slide"]),
    print: search["print"] === true || search["print"] === "true",
  }),
  head: () => ({
    meta: [
      { title: "Propuesta · Hub Analítico Fortaleza" },
      {
        name: "description",
        content:
          "Propuesta del Hub Analítico de Fortaleza Inmuebles: cartera, adjudicaciones y obra en una sola pantalla.",
      },
      { property: "og:title", content: "Propuesta · Hub Analítico Fortaleza" },
      {
        property: "og:description",
        content:
          "Tres preguntas que el Hub responde: quién se cae del plan, cuándo se adjudica y si los aportes alcanzan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Presentation,
});

function Presentation() {
  const { slide, print } = Route.useSearch();
  const navigate = Route.useNavigate();
  const index = slide - 1;
  const [grid, setGrid] = useState(false);
  const [notes, setNotes] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const touchStart = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const go = (value: number) => {
    void navigate({ search: { slide: normalizeSlide(value), print: false }, replace: true });
  };
  useEffect(() => {
    document.title = `${slide}/6 — ${presentationSlides[index]?.title}`;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        go(slide + 1);
      }
      if (event.key === "ArrowLeft") go(slide - 1);
      if (event.key === "Escape") {
        setGrid(false);
        setPresenting(false);
        if (document.fullscreenElement) void document.exitFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slide]);
  useEffect(() => {
    const change = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    document.addEventListener("fullscreenchange", change);
    return () => {
      document.removeEventListener("fullscreenchange", change);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const fullscreen = async () => {
    if (presenting) {
      if (document.fullscreenElement) await document.exitFullscreen();
      setPresenting(false);
    } else {
      setGrid(false);
      setPresenting(true);
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        /* Keep immersive view if fullscreen is unavailable. */
      }
    }
  };
  const exportPdf = () => {
    window.open("/presentacion?print=true&slide=1", "_blank", "noopener");
  };
  if (print)
    return (
      <main className="deck-print">
        <div className="deck-print-toolbar">
          <Button onClick={() => window.print()}>
            <Printer /> Guardar como PDF
          </Button>
          <p>Destino: Guardar como PDF</p>
        </div>
        {presentationSlides.map((_, i) => (
          <FortalezaSlide index={i} key={i} />
        ))}
      </main>
    );
  return (
    <main
      className={`deck-app ${presenting ? "deck-presenting" : ""} ${cursorHidden && presenting ? "deck-cursor-hidden" : ""}`}
      onMouseMove={() => {
        setCursorHidden(false);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCursorHidden(true), 2500);
      }}
    >
      <header className="deck-toolbar">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" title="Volver al Hub">
            <Link to="/">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold">Hub Analítico Fortaleza</p>
            <p className="text-xs text-muted-foreground">Propuesta ejecutiva</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Ver todas las diapositivas"
            aria-label="Ver todas las diapositivas"
            onClick={() => setGrid(!grid)}
          >
            <Grid2X2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Notas del presentador"
            aria-label="Notas del presentador"
            onClick={() => setNotes(!notes)}
          >
            <StickyNote />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Exportar PDF"
            aria-label="Exportar PDF"
            onClick={exportPdf}
          >
            <Printer />
          </Button>
          <Button
            onClick={fullscreen}
            className="deck-present-button"
            title="Presentar"
            aria-label={presenting ? "Salir de presentación" : "Presentar"}
          >
            {presenting ? <Minimize /> : <Maximize />}
            <span>Presentar</span>
          </Button>
        </div>
      </header>
      {grid ? (
        <div className="deck-grid">
          {presentationSlides.map((item, i) => (
            <Button
              key={item.title}
              variant="ghost"
              className={`deck-grid-item ${index === i ? "deck-grid-selected" : ""}`}
              onClick={() => {
                go(i + 1);
                setGrid(false);
              }}
            >
              <div className="deck-grid-preview">
                <ScaledSlide>
                  <FortalezaSlide index={i} />
                </ScaledSlide>
              </div>
              <span>
                {i + 1}. {item.title}
              </span>
            </Button>
          ))}
        </div>
      ) : (
        <div
          className="deck-stage"
          onTouchStart={(e) => {
            touchStart.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const end = e.changedTouches[0]?.clientX;
            if (
              touchStart.current !== null &&
              end !== undefined &&
              Math.abs(end - touchStart.current) > 50
            )
              go(slide + (end < touchStart.current ? 1 : -1));
            touchStart.current = null;
          }}
        >
          <ScaledSlide>
            <FortalezaSlide index={index} />
          </ScaledSlide>
        </div>
      )}
      {notes && !presenting && (
        <aside className="deck-notes">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Notas del presentador</h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Cerrar notas"
              onClick={() => setNotes(false)}
            >
              <X />
            </Button>
          </div>
          <p>{presentationSlides[index]?.notes}</p>
        </aside>
      )}
      <footer className="deck-navigation">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Diapositiva anterior"
          disabled={slide === 1}
          onClick={() => go(slide - 1)}
        >
          <ArrowLeft />
        </Button>
        <span className="text-sm tabular-nums">
          {slide} <span className="text-muted-foreground">/ 6</span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Diapositiva siguiente"
          disabled={slide === 6}
          onClick={() => go(slide + 1)}
        >
          <ArrowRight />
        </Button>
        <Button asChild variant="link" className="ml-4">
          <Link to="/">
            Abrir Hub <ArrowRight />
          </Link>
        </Button>
      </footer>
    </main>
  );
}
