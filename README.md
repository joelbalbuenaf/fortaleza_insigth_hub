# Hub Analítico Fortaleza · Fide

Hub de inteligencia comercial para **Fortaleza Inmuebles S.A.**, desarrolladora de Asunción que
opera el Sistema de Ahorro Fortaleza: reportes de cartera, cinco módulos de soluciones, una
presentación ejecutiva y **Fide**, un agente que responde preguntas sobre los datos con cifras,
gráficos y próximos pasos.

> **Los datos de este Hub son ilustrativos.**
>
> - **Público**: el catálogo de proyectos (nombre, año de entrega, estado y dirección) sale del
>   sitio de Fortaleza, consultado el 31/10/2026. Insignia *"Público · sitio Fortaleza"*.
> - **Ilustrativo**: todo lo demás. Socios, aportes, mora, deserción, adjudicaciones, avance de
>   obra, costos, mercado y precios de m² son supuestos generados con un PRNG sembrado, para
>   mostrar la herramienta sin datos reales. Insignia *"Ilustrativo"*.
> - Los pisos, unidades y tipologías por proyecto también son supuestos, aunque el proyecto sea
>   real: el sitio informa rangos para el conjunto (8 a 38 pisos, 16 a 240 unidades), no el
>   detalle de cada torre.
>
> Cuando llegue la cartera real, lo único que cambia es el origen de los datos: las pantallas,
> las herramientas y el agente funcionan sin tocar nada.

## Cómo funciona el negocio

Esto es público, del sitio de Fortaleza, y es lo que el Hub modela:

- Los socios aportan una **cuota mensual fija**. Ese dinero financia la construcción de
  edificios; los terrenos y las obras están a nombre del consorcio de inversores por escritura
  pública.
- La unidad se adjudica por **sorteo** (se extrae una bolilla de cada contenedor para formar el
  número de contrato, así que todos los socios al día tienen la misma probabilidad) o por
  **licitación** (se abren los sobres ante escribano y gana la mejor oferta, que combina los
  pagos realizados con los puntos de beneficios).
- El plazo máximo para recibir la unidad en Asunción es de **20 años**. Los planes son Plan
  Amplia, Plan 20 y productos adicionales.

De ahí sale el eje analítico: la métrica central es la **cartera de aportes** (recaudación,
crecimiento, mora, deserción), no la venta de unidades.

## Qué incluye

| Área | Contenido |
| --- | --- |
| Inicio | KPIs de la cartera (Ene–Sep 2026 vs. 2025), centro de alertas calculadas, accesos a módulos y reportes |
| Cartera de aportes | Resumen, territorio por barrio, sucursales y canales, mora, deserción por cohorte, forecast con backtest, estadística |
| Socios | Los contratos de la cartera: búsqueda, filtros, ficha con serie de 57 meses y posición en la cola de licitación |
| Proyectos y obra | Catálogo público en el mapa de Asunción, avance contra cronograma, mix por tipología |
| Mercado | Precio de m² por barrio, competencia por desarrolladora, absorción, barrios sin presencia |
| Soluciones | Salud de cartera · Radar de adjudicaciones · Calce financiero de obra · Evaluador de terrenos · Simulador de planes |
| Fide (`/chat`) | Agente con 17 herramientas sobre los datos; los gráficos los calcula el servidor |
| Presentación (`/presentacion`) | Propuesta ejecutiva de 6 diapositivas, exportable a PDF |

Extras: filtros en la URL (links compartibles), paleta de comandos (**Ctrl + K**), modo oscuro,
exportación CSV y PDF.

## Requisitos

- Node 22 (con nvm: `nvm install 22 && nvm use 22`)
- npm (el `.npmrc` del repo activa `legacy-peer-deps`)

## Puesta en marcha

```sh
npm install
cp .env.example .env      # HUB_USUARIO y HUB_CLAVE son obligatorias
npm run dev               # http://localhost:8080
```

**El servidor no arranca sin `HUB_USUARIO` y `HUB_CLAVE`.** Es a propósito: el Hub muestra la
cartera de socios, así que no hay credenciales por defecto en el código.

### Fide: modo Claude o modo demo

- **Con `ANTHROPIC_API_KEY`** en `.env`: Fide usa Claude (`claude-opus-5` por defecto) con
  herramientas, razonamiento visible y caché del prompt. Variables opcionales: `FIDE_MODEL`,
  `FIDE_EFFORT` (`low` · `medium` · `high` · `xhigh` · `max`).
- **Sin key**: modo demo. Interpreta la pregunta con reglas y responde con las mismas
  herramientas y datos, sin IA y sin costo. El chat muestra qué modo está activo.

En ambos modos los valores de los gráficos los calcula el servidor: Fide solo elige qué graficar.
Con `ANTHROPIC_API_KEY`, lo que Fide consulta se envía a la API de Anthropic para responder.

Tres reglas del prompt que no se negocian, y que los tests verifican:

1. **Nunca presenta rentabilidades ni plazos de adjudicación como promesa.** La adjudicación es
   por sorteo y licitación: la espera es probabilística. El simulador describe el próximo acto,
   no una fecha.
2. **Los socios se identifican por número de contrato, nunca por nombre**, y no vuelca listados
   completos sin que la pregunta lo requiera.
3. **Declara la fuente de cada cifra**: público (catálogo de proyectos) o ilustrativo (el resto).

### Cuando llegue la cartera real

Hoy la cartera se genera en `src/server/socios/datos.ts`. Para cargar datos reales hay que
reemplazar ese módulo por un ETL o un conector, conservando la forma de las tres series por socio
(`emitido`, `cobrado`, `atraso`). Lo que haría falta:

- Padrón de contratos con los aportes mes a mes (emitido y cobrado).
- Actas de adjudicación: sorteos, licitaciones y ofertas ganadoras.
- Certificados de avance de obra y costos por proyecto.
- Definición de accesos: con datos reales, la cartera son **datos personales**.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (puerto 8080) |
| `npm run build` | Build de producción (nitro, preset `node-server`; otro preset con `NITRO_PRESET`) |
| `npm start` | Sirve el build (`PORT`, por defecto 3000) |
| `npm test` | Tests (Vitest) |
| `npm run lint` / `npm run typecheck` | ESLint + Prettier / TypeScript |

Con Docker: `docker build -t fortaleza-hub . && docker run -p 3000:3000 -e HUB_USUARIO=... -e HUB_CLAVE=... fortaleza-hub`.

## Arquitectura

```
src/server/          SOLO SERVIDOR (la import-protection de Vite lo bloquea en el navegador):
  socios/datos.ts    la cartera: un socio por contrato, con emitido/cobrado/atraso por mes
  socios/consultas.ts resumen, series, desgloses, ranking, ficha, concentración, atípicos
  socios/mora.ts     tramos de atraso, cohortes de deserción, scoring de riesgo con factores
  adjudicaciones.ts  sorteo y licitación, espera por cohorte, simulación del próximo acto
  obra.ts            avance vs. cronograma, calce financiero, proyección de caja
  mercado.ts         precio de m² por barrio, competencia, absorción
  terrenos.ts        evaluador de terrenos con factores explícitos
  alertas.ts         alertas calculadas sobre los datos, ordenadas por severidad
  graficos.ts        constructor de los 22 gráficos del catálogo
src/lib/hub/api.ts   server functions: el único puente entre src/server/ y las pantallas
src/lib/data/        piezas sin datos de cartera: calendario, barrios de Asunción, catálogo
                     público de proyectos, forecast, estadística, filtros
src/lib/fide/        agente: herramientas, prompt, Claude (tool runner), modo demo, simulador
src/routes/          páginas (TanStack Start, loaders → server functions) y /api/*
src/components/      ChartView, HubMap (MapLibre), filtros, alertas, chat, pestañas, slides
scripts/             golden-cuotero.py: genera las referencias del simulador desde el cuotero
```

**Reglas de datos** (ver `AGENTS.md`): aportes en guaraníes, mostrados en millones (Gs MM);
socios, unidades y adjudicaciones son conteos y nunca se suman con montos; la mora se mide sobre
el saldo pendiente al cierre, no como emitido − cobrado de una ventana; cada gráfico y pantalla
lleva su insignia de fuente. El build falla si código de cliente importa `src/server/`.

El simulador de planes (`src/lib/fide/simulador.ts`) es un **porteo del cuotero Flask** del
equipo, y los tests comparan su salida contra la del Python fila por fila. Para regenerar las
referencias:

```sh
cd /home/administrator/cuotero_prime
./venv/bin/python /home/administrator/fortaleza-hub/scripts/golden-cuotero.py \
  > /home/administrator/fortaleza-hub/src/test/golden-cuotero.json
```

Mapas: MapLibre GL con teselas de OpenFreeMap (no requiere key).

## Marca

Los colores y los logos son los oficiales de Fortaleza, tomados de su sitio el 31/10/2026:

| Token | Color | Uso |
| --- | --- | --- |
| Primario | `#00544d` verde petróleo | Barra lateral, botones, títulos |
| Acento | `#faa61a` dorado | Estado activo, llamados a la acción, regla de las diapositivas |
| Secundario | `#f26522` naranja | Advertencias |
| Alerta | `#f44404` | Errores y severidad alta |
| Verde claro | `#35926a` | Series de marca y positivos |

La franja de marca (`bg-brand-stripe`) reproduce los cuatro cuadrantes del isotipo: verde, teal,
dorado y naranja. Todo vive en tokens CSS (`src/styles.css`, bloques `:root` y `.dark`), así que
cambiar la paleta es editar un solo lugar.

Los logos están en `src/assets/`: `logo-fortaleza.png` (color, para fondos claros) y
`logo-fortaleza-blanco.png` (para fondos oscuros: barra lateral, login y diapositivas oscuras).
El favicon es el oficial del sitio.

**La paleta categórica de los gráficos (`--series-1` … `--series-5`) no es la de marca** y es a
propósito: está validada para daltonismo, banda de luminosidad y contraste. Mezclarla con los
colores institucionales haría que dos series distintas se confundan entre sí.

`src/assets/fide.svg` sí es provisorio: es un avatar armado con la paleta de Fortaleza, a
reemplazar cuando exista el definitivo del agente.
