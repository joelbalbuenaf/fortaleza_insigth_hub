import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapaLibre, MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// El worker de MapLibre es autocontenido: se sirve como archivo para que funcione con Vite.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { MapPin } from "lucide-react";

export type PuntoMapa = {
  id: string;
  lat: number;
  lng: number;
  titulo: string;
  detalle?: string;
  /** Para escalar el tamaño del círculo. */
  valor?: number;
  /** Color propio del punto (variable CSS o color); si no, el de la capa. */
  color?: string;
};

export type CapaMapa = {
  id: string;
  nombre: string;
  /** Variable CSS (--series-1) o color. */
  color: string;
  puntos: PuntoMapa[];
  /** Radio fijo en px, o [min, max] para escalar por `valor`. */
  radio?: number | [number, number];
};

const ESTILO = "https://tiles.openfreemap.org/styles/positron";
const PARAGUAY: [[number, number], [number, number]] = [
  [-62.7, -27.7],
  [-54.2, -19.3],
];

const cacheColores = new Map<string, string>();

/** Resuelve variables CSS y colores modernos (oklch) a rgb, que es lo que entiende MapLibre. */
function resolverColor(c: string) {
  if (typeof document === "undefined") return "#2a78d6";
  const nombre = c.startsWith("var(") ? c.slice(4, -1) : c;
  const valor = nombre.startsWith("--")
    ? getComputedStyle(document.documentElement).getPropertyValue(nombre).trim()
    : nombre;
  if (!valor) return "#2a78d6";
  const enCache = cacheColores.get(valor);
  if (enCache) return enCache;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return valor;
  ctx.fillStyle = valor;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  const rgb = `rgb(${r}, ${g}, ${b})`;
  cacheColores.set(valor, rgb);
  return rgb;
}

function geojson(capa: CapaMapa) {
  return {
    type: "FeatureCollection" as const,
    features: capa.puntos.map((p) => ({
      type: "Feature" as const,
      id: undefined,
      geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id,
        titulo: p.titulo,
        detalle: p.detalle ?? "",
        valor: p.valor ?? 0,
        color: resolverColor(p.color ?? capa.color),
      },
    })),
  };
}

function circuloGeo(lat: number, lng: number, radioKm: number) {
  const pasos = 64;
  const coords: [number, number][] = [];
  for (let i = 0; i <= pasos; i++) {
    const a = (i / pasos) * 2 * Math.PI;
    coords.push([
      lng + (radioKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a),
      lat + (radioKm / 110.57) * Math.sin(a),
    ]);
  }
  return {
    type: "Feature" as const,
    geometry: { type: "Polygon" as const, coordinates: [coords] },
    properties: {},
  };
}

export function HubMap({
  capas,
  alto = 460,
  onClickMapa,
  onClickPunto,
  marcador,
  radioKm,
  encuadre,
}: {
  capas: CapaMapa[];
  alto?: number;
  onClickMapa?: (p: { lat: number; lng: number }) => void;
  onClickPunto?: (capaId: string, puntoId: string) => void;
  marcador?: { lat: number; lng: number } | null;
  radioKm?: number;
  /** Encuadra el mapa a estos puntos (por ejemplo, al filtrar un departamento). */
  encuadre?: { lat: number; lng: number }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLibre | null>(null);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState("");
  // Callbacks actuales sin re-registrar eventos del mapa.
  const callbacks = useRef({ onClickMapa, onClickPunto });
  callbacks.current = { onClickMapa, onClickPunto };

  useEffect(() => {
    let cancelado = false;
    let instancia: MapaLibre | null = null;
    import("maplibre-gl")
      .then((maplibregl) => {
        if (cancelado || !ref.current) return;
        maplibregl.setWorkerUrl(workerUrl);
        const m = new maplibregl.Map({
          container: ref.current,
          style: ESTILO,
          bounds: PARAGUAY,
          fitBoundsOptions: { padding: 20 },
          attributionControl: { compact: true },
        });
        instancia = m;
        m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        m.on("load", () => {
          if (!cancelado) {
            mapa.current = m;
            setListo(true);
          }
        });
        m.on("error", (e) => {
          if (!mapa.current)
            setError(`No se pudo cargar el mapa base (${e.error?.message ?? "sin conexión"}).`);
        });
        const popup = new maplibregl.Popup({ closeButton: false, offset: 10, maxWidth: "280px" });
        m.on("click", (e: MapMouseEvent) => {
          const capasIds = (m.getStyle().layers ?? [])
            .filter((l) => l.id.startsWith("capa-"))
            .map((l) => l.id);
          const f = m.queryRenderedFeatures(e.point, { layers: capasIds })[0];
          if (f && m) {
            const props = f.properties as { id: string; titulo: string; detalle: string };
            const contenido = document.createElement("div");
            const t = document.createElement("strong");
            t.textContent = props.titulo;
            const d = document.createElement("div");
            d.style.cssText = "white-space:pre-line;margin-top:4px;color:#52514e";
            d.textContent = props.detalle;
            contenido.append(t, d);
            popup.setLngLat(e.lngLat).setDOMContent(contenido).addTo(m);
            callbacks.current.onClickPunto?.(f.layer.id.replace("capa-", ""), props.id);
          } else {
            popup.remove();
            callbacks.current.onClickMapa?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          }
        });
        m.on("mousemove", (e) => {
          if (!m) return;
          const capasIds = m
            .getStyle()
            .layers.filter((l) => l.id.startsWith("capa-"))
            .map((l) => l.id);
          const hay = m.queryRenderedFeatures(e.point, { layers: capasIds }).length > 0;
          m.getCanvas().style.cursor = hay || callbacks.current.onClickMapa ? "pointer" : "";
        });
      })
      .catch(() => setError("No se pudo cargar el componente de mapa."));
    return () => {
      cancelado = true;
      instancia?.remove();
      mapa.current = null;
    };
  }, []);

  // Sincroniza capas de puntos.
  useEffect(() => {
    const m = mapa.current;
    if (!listo || !m) return;
    for (const capa of capas) {
      const fuente = `fuente-${capa.id}`;
      const datos = geojson(capa);
      const existente = m.getSource(fuente) as GeoJSONSource | undefined;
      if (existente) existente.setData(datos);
      else {
        m.addSource(fuente, { type: "geojson", data: datos });
        const valores = capa.puntos.map((p) => p.valor ?? 0);
        const [rMin, rMax] = Array.isArray(capa.radio)
          ? capa.radio
          : [capa.radio ?? 5, capa.radio ?? 5];
        const vMin = Math.min(...valores, 0);
        const vMax = Math.max(...valores, 1);
        m.addLayer({
          id: `capa-${capa.id}`,
          type: "circle",
          source: fuente,
          paint: {
            "circle-color": ["get", "color"],
            "circle-opacity": 0.85,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
            "circle-radius":
              rMin === rMax || vMax === vMin
                ? rMin
                : ["interpolate", ["linear"], ["get", "valor"], vMin, rMin, vMax, rMax],
          },
        });
      }
    }
    // Quita capas que ya no están.
    for (const l of m.getStyle().layers) {
      if (l.id.startsWith("capa-") && !capas.some((c) => `capa-${c.id}` === l.id)) {
        m.removeLayer(l.id);
        m.removeSource(`fuente-${l.id.replace("capa-", "")}`);
      }
    }
  }, [capas, listo]);

  // Marcador de sitio + radio de análisis.
  useEffect(() => {
    const m = mapa.current;
    if (!listo || !m) return;
    const datos = {
      type: "FeatureCollection" as const,
      features: marcador ? [circuloGeo(marcador.lat, marcador.lng, radioKm ?? 5)] : [],
    };
    const fuente = m.getSource("radio") as GeoJSONSource | undefined;
    if (fuente) fuente.setData(datos);
    else {
      m.addSource("radio", { type: "geojson", data: datos });
      m.addLayer({
        id: "radio-relleno",
        type: "fill",
        source: "radio",
        paint: { "fill-color": "#2a78d6", "fill-opacity": 0.08 },
      });
      m.addLayer({
        id: "radio-borde",
        type: "line",
        source: "radio",
        paint: { "line-color": "#2a78d6", "line-width": 1.5, "line-dasharray": [2, 2] },
      });
    }
    if (marcador)
      m.flyTo({
        center: [marcador.lng, marcador.lat],
        zoom: Math.max(m.getZoom(), 10.5),
        duration: 600,
      });
  }, [marcador, radioKm, listo]);

  // Encuadre a un conjunto de puntos.
  useEffect(() => {
    const m = mapa.current;
    // Sin la prop no se toca la vista (por ejemplo, el evaluador maneja su propio zoom).
    if (!listo || !m || encuadre === undefined) return;
    if (!encuadre.length) {
      m.fitBounds(PARAGUAY, { padding: 20, duration: 500 });
      return;
    }
    const lats = encuadre.map((p) => p.lat);
    const lngs = encuadre.map((p) => p.lng);
    m.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 50, maxZoom: 11, duration: 500 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, JSON.stringify(encuadre)]);

  return (
    <div className="relative overflow-hidden rounded-lg border bg-muted" style={{ height: alto }}>
      <div ref={ref} className="h-full w-full" aria-label="Mapa" />
      {capas.length > 0 && (
        <div className="pointer-events-none absolute left-2 top-2 flex max-w-[75%] flex-wrap gap-2 rounded-md bg-card/90 px-2 py-1 text-[11px] shadow-sm">
          {capas.map((c) => (
            <span key={c.id} className="flex items-center gap-1">
              <span
                className="inline-block size-2.5 rounded-full border border-white"
                style={{ background: c.color }}
              />
              {c.nombre}
            </span>
          ))}
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
          <MapPin className="size-8" />
          {error}
        </div>
      )}
    </div>
  );
}
