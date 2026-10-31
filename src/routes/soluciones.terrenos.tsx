import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, MapPin } from "lucide-react";
import { Kpi } from "@/components/AppShell";
import { BotonCsv, Seccion, Tabla } from "@/components/comercial/comun";
import { HubMap, type CapaMapa } from "@/components/map/HubMap";
import { Contenido, EncabezadoSolucion } from "@/components/soluciones/comun";
import { fmtNumero } from "@/lib/export";
import { evaluarTerrenoFn, obtenerTerrenos } from "@/lib/hub/api";
import type { EvaluacionTerreno } from "@/server/terrenos";

type Busqueda = { lat?: number; lng?: number };

export const Route = createFileRoute("/soluciones/terrenos")({
  validateSearch: (s: Record<string, unknown>): Busqueda => {
    const lat = Number(s["lat"]);
    const lng = Number(s["lng"]);
    // Asunción y alrededores.
    return lat < -25.2 && lat > -25.45 && lng < -57.45 && lng > -57.72 ? { lat, lng } : {};
  },
  loader: () => obtenerTerrenos(),
  head: () => ({ meta: [{ title: "Evaluador de terrenos · Hub Fortaleza" }] }),
  component: Page,
});

const colorPuntaje = (p: number) =>
  p >= 70 ? "text-success" : p >= 50 ? "text-warning" : "text-destructive";

function Medidor({ puntaje }: { puntaje: number }) {
  const r = 52;
  const largo = Math.PI * r;
  return (
    <svg viewBox="0 0 120 70" className="w-40" role="img" aria-label={`Puntaje ${puntaje} de 100`}>
      <path
        d="M8 62 A52 52 0 0 1 112 62"
        fill="none"
        stroke="var(--muted)"
        strokeWidth={10}
        strokeLinecap="round"
      />
      <path
        d="M8 62 A52 52 0 0 1 112 62"
        fill="none"
        stroke={
          puntaje >= 70 ? "var(--success)" : puntaje >= 50 ? "var(--warning)" : "var(--destructive)"
        }
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={`${(largo * puntaje) / 100} ${largo}`}
      />
      <text
        x="60"
        y="58"
        textAnchor="middle"
        className="fill-foreground"
        fontSize="22"
        fontWeight={700}
      >
        {puntaje}
      </text>
    </svg>
  );
}

function Page() {
  const inicial = Route.useSearch();
  const d = Route.useLoaderData();
  const mejor = d.ranking[0];
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(
    inicial.lat && inicial.lng
      ? { lat: inicial.lat, lng: inicial.lng }
      : mejor
        ? { lat: mejor.lat, lng: mejor.lng }
        : null,
  );
  const [ev, setEv] = useState<EvaluacionTerreno | null>(null);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    if (!punto) return;
    let vigente = true;
    setCalculando(true);
    evaluarTerrenoFn({ data: punto })
      .then((r) => vigente && setEv(r))
      .finally(() => vigente && setCalculando(false));
    return () => {
      vigente = false;
    };
  }, [punto]);

  const capas: CapaMapa[] = useMemo(
    () => [
      {
        id: "competencia",
        nombre: "Competencia (ilustrativa)",
        color: "var(--series-2)",
        radio: 4,
        puntos: d.competencia.map((c) => ({
          id: c.id,
          lat: c.lat,
          lng: c.lng,
          titulo: c.desarrolladora,
          detalle: `${c.barrio} · ${c.unidades} unidades`,
        })),
      },
      {
        id: "candidatos",
        nombre: "Barrios candidatos",
        color: "var(--series-1)",
        radio: [5, 16],
        puntos: d.ranking.map((b) => ({
          id: b.barrio,
          lat: b.lat,
          lng: b.lng,
          titulo: b.barrio,
          valor: b.puntaje,
          detalle: `Puntaje ${b.puntaje} · ${b.recomendacion}\nUSD ${fmtNumero(b.precioM2Usd, 0)}/m² · ${b.competencia} competidores · ${b.fortaleza} propios`,
        })),
      },
    ],
    [d],
  );

  return (
    <main className="pb-10">
      <EncabezadoSolucion
        categoria="Expansión"
        titulo="Evaluador de terrenos"
        desc="Dónde comprar el próximo terreno en Asunción. Clic en el mapa para evaluar cualquier punto."
        requiere="Modelo ilustrativo: la demanda, los precios de m² y la competencia son supuestos de la demo. No reemplaza un estudio de factibilidad ni la verificación de zonificación, retiros municipales y títulos."
        pregunta="¿Dónde conviene buscar el próximo terreno?"
        fuente="ilustrativo"
      />
      <Contenido>
        <div className="grid gap-6 xl:grid-cols-5">
          <div className="xl:col-span-3">
            <Seccion titulo="Mapa de Asunción">
              <HubMap
                capas={capas}
                alto={480}
                marcador={punto}
                radioKm={1}
                onClickMapa={(p) => setPunto(p)}
                onClickPunto={(capa, id) => {
                  if (capa !== "candidatos") return;
                  const b = d.ranking.find((x) => x.barrio === id);
                  if (b) setPunto({ lat: b.lat, lng: b.lng });
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Clic en cualquier punto del mapa para evaluarlo. El círculo marca el radio de 1 km
                con el que se cuentan competidores y proyectos propios.
              </p>
            </Seccion>
          </div>
          <div className="xl:col-span-2">
            <Seccion titulo="Evaluación del punto">
              {calculando && !ev ? (
                <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Calculando…
                </p>
              ) : ev ? (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <Medidor puntaje={ev.puntaje} />
                    <div className="text-right">
                      <p className={`font-semibold ${colorPuntaje(ev.puntaje)}`}>
                        {ev.recomendacion}
                      </p>
                      <p className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
                        <MapPin className="size-3.5" /> {ev.barrio}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ev.lat}, {ev.lng}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {ev.factores.map((f) => (
                      <li key={f.nombre} className="border-l-2 border-accent pl-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium">{f.nombre}</span>
                          <span
                            className={`shrink-0 text-sm font-semibold tabular-nums ${f.aporte > 0 ? "text-success" : f.aporte < 0 ? "text-destructive" : "text-muted-foreground"}`}
                          >
                            {f.aporte > 0 ? "+" : ""}
                            {f.aporte}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{f.valor}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {f.explicacion}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">m² vendibles estimados</p>
                      <p className="font-semibold">{fmtNumero(ev.m2VendiblesEstimados, 0)} m²</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Unidades estimadas</p>
                      <p className="font-semibold">{ev.unidadesEstimadas}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Ingreso potencial</p>
                      <p className="font-semibold">USD {fmtNumero(ev.ingresoPotencialUsdM)} M</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{ev.nota}</p>
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Hacé clic en el mapa para evaluar un punto.
                </p>
              )}
            </Seccion>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Seccion
            titulo="Ranking de barrios candidatos"
            acciones={<BotonCsv filas={d.ranking} nombre="ranking-barrios" />}
          >
            <Tabla
              alto={420}
              filas={d.ranking}
              clave={(b) => b.barrio}
              onFila={(b) => setPunto({ lat: b.lat, lng: b.lng })}
              columnas={[
                { titulo: "Barrio", valor: (b) => b.barrio },
                { titulo: "Zona", valor: (b) => b.zona },
                {
                  titulo: "Puntaje",
                  valor: (b) => <span className={colorPuntaje(b.puntaje)}>{b.puntaje}</span>,
                  numero: true,
                },
                { titulo: "USD/m²", valor: (b) => fmtNumero(b.precioM2Usd, 0), numero: true },
                { titulo: "Competencia", valor: (b) => b.competencia, numero: true },
                { titulo: "Propios", valor: (b) => b.fortaleza, numero: true },
              ]}
            />
          </Seccion>
          <Seccion
            titulo="Barrios sin presencia de Fortaleza"
            acciones={<BotonCsv filas={d.sinPresencia} nombre="sin-presencia" />}
          >
            <p className="mb-3 text-sm text-muted-foreground">
              Donde la competencia construye y Fortaleza todavía no tiene ningún proyecto.
            </p>
            <Tabla
              alto={360}
              filas={d.sinPresencia}
              clave={(b) => b.barrio}
              columnas={[
                { titulo: "Barrio", valor: (b) => b.barrio },
                { titulo: "Competencia", valor: (b) => b.competencia, numero: true },
                { titulo: "USD/m²", valor: (b) => fmtNumero(b.precioM2Usd, 0), numero: true },
                {
                  titulo: "Proyecto más cercano",
                  valor: (b) => `${b.proyectoMasCercano} (${fmtNumero(b.distanciaKm)} km)`,
                },
              ]}
            />
          </Seccion>
        </div>
      </Contenido>
    </main>
  );
}
