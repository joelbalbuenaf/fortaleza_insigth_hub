## Convenciones del proyecto

- Node 22 (nvm). Instalar con `npm install` (el `.npmrc` del repo activa `legacy-peer-deps`).
- `HUB_USUARIO` y `HUB_CLAVE` son **obligatorias**: `src/start.ts` aborta el arranque si faltan.
  No agregar credenciales por defecto en el código: el Hub muestra la cartera de socios.
- **Dos niveles de veracidad, y no se mezclan en un mismo número**: `publico` (catálogo de
  proyectos: nombre, año, estado y dirección, del sitio de Fortaleza) e `ilustrativo` (todo lo
  demás: socios, aportes, mora, deserción, adjudicaciones, obra, mercado). `mixto` es estructura
  pública con cantidades supuestas. Todo gráfico (`ChartSpec.fuente`), pantalla (`PageHeader
  fuente`) y resultado de herramienta declara su fuente.
- La cartera vive solo en `src/server/` (la import-protection de Vite falla el build si el
  cliente la importa). Las pantallas la reciben por server functions (`src/lib/hub/api.ts`)
  protegidas por el login. Desde componentes, importar de `src/server/` solo con `import type`.
  Si un componente necesita una constante del servidor, pasarla por la respuesta de la server
  function, no importarla (ver `proporcionAObra` en `obtenerObra`).
- Las etiquetas de las herramientas viven en `src/lib/fide/etiquetas.ts`, no en `tools.ts`: el
  chip del chat las necesita en el cliente y `tools.ts` importa `src/server/`.
- **Unidades**: los aportes se guardan en guaraníes y se muestran en millones de guaraníes
  (Gs MM); los precios de m² en USD. Socios, unidades y adjudicaciones son conteos: nunca se
  suman con montos. Período actual: Ene–Sep 2026 vs. Ene–Sep 2025; el calendario va de Ene 2022 a
  Sep 2026 (`src/lib/data/periodos.ts`).
- **La mora se mide sobre el SALDO pendiente al cierre** (cuotas impagas valorizadas, ver
  `saldoEnMora`), no como "emitido − cobrado" de una ventana: las regularizaciones de meses
  anteriores caen dentro de la ventana y la dejan en casi cero. Por eso la efectividad de
  cobranza puede pasar del 100% en un período, y está bien.
- Regularizar una cuota vieja se paga **al valor de la cuota vigente**, no al de entonces: el
  dinero cobrado de un socio puede superar al emitido, aunque la cantidad de cuotas pagadas nunca.
  El invariante va en cuotas, no en guaraníes.
- A las 7 cuotas impagas (`ATRASO_LIMITE`) el contrato se cae. La población de pago es **bimodal**
  a propósito (una mayoría cumplidora y una minoría irregular): con una sola distribución la mora
  del agregado queda irrealmente cerca de cero.
- Los socios que entraron antes de Ene 2022 traen su historia en `pagadoPrevio` y su antigüedad
  se mide con `mesesEntre`, no con el índice del calendario. Sus adjudicaciones quedan **sin
  proyecto**: el sitio dice tener 17 proyectos entregados pero nombra 12, así que esas unidades no
  están en el catálogo y cargárselas a los que sí están los dejaría 100% adjudicados de arranque.
- La unidad del modelo es el **contrato**, no la persona (`socioId` agrupa). Todo conteo dice cuál
  de los dos es; nunca se mezclan en una misma cifra.
- **Situación** (`En espera` / `Adjudicado` / `Con posesión`) y **estado de pago** (`Al día` /
  `En mora` / `Finalizado` / `Baja`) son ejes INDEPENDIENTES y se calculan con funciones distintas
  (`situacionDe` y `estadoDePagoDe`). Antes era un solo estado donde "Adjudicado" pisaba a
  "En mora" y la mora de los adjudicados no se contaba en ningún indicador: no volver a mezclarlos.
- El aporte mensual lo fija la administradora y depende **solo de la situación**
  (`APORTE_ESPERA` / `APORTE_POSESION`, `aporteDelMes` los deflacta hacia atrás con `AJUSTE_ANUAL`).
  No varía por socio, plan ni barrio: en un sistema de ahorro eso contradice el esfuerzo común.
- La posesión llega con la **entrega de la torre adjudicada** (diciembre del año del catálogo), no
  con la adjudicación. Las adjudicaciones consumen unidades del catálogo y no pueden pasarse.
- Un contrato que completó su plan sale del padrón activo (`planFinalizado`), salvo que quede
  debiendo: esa deuda es cobrable y tiene que seguir apareciendo en la mora.
- El **efecto de las entregas** sobre la recaudación va SIEMPRE aparte de la proyección
  estadística: `proyectarSerie` es tendencia + estacionalidad y no conoce el cronograma de obra.
  Sumarlos en una sola curva inventa una precisión que ninguno de los dos cálculos tiene.
- **Fide** (`POST /api/chat`): con `ANTHROPIC_API_KEY` usa Claude con herramientas
  (`src/lib/fide/`); sin key responde en modo demo con las mismas herramientas, sin IA. Los hilos
  se guardan en localStorage.
- **Gráficos**: Fide solo elige qué graficar; los valores siempre los calcula el servidor
  (`src/server/graficos.ts`). Nunca graficar números generados por el modelo.
- **Tres reglas del prompt que no se negocian** (y que `src/test/fide.test.ts` verifica):
  no prometer rentabilidades ni plazos de adjudicación (la espera es probabilística: sorteo con
  igual chance para todos los socios al día, licitación por oferta); identificar socios por
  número de contrato y nunca por nombre; declarar la fuente de cada cifra.
- El **simulador de planes** (`src/lib/fide/simulador.ts`) es un porteo del cuotero Flask
  (`cuotero_prime/app.py: generate_full_schedule`). Se mantiene su aritmética a propósito, incluida
  la capitalización del interés del tramo de obra y los dos saldos en paralelo. Si se toca, correr
  `src/test/simulador.test.ts`: compara contra la salida del Python fila por fila.
- La presentación ejecutiva vive en `/presentacion`, fuera de `AppShell`; un `ScaledSlide` de
  1920×1080 sirve para lienzo, vista general e impresión. Las diapositivas **no muestran cifras
  de la cartera**: es el lugar donde un número inventado se confunde con un dato.
- Mapas: MapLibre GL con teselas OpenFreeMap (sin key). Los proyectos y los socios se ubican en
  el centro del barrio con un desplazamiento chico, no en su dirección real.
- **Marca**: paleta oficial de Fortaleza en tokens CSS (`#00544d` primario, `#faa61a` acento,
  `#f26522` secundario). Los logos oficiales están en `src/assets/logo-fortaleza.png` (color) y
  `logo-fortaleza-blanco.png` (fondos oscuros). La paleta de series de los gráficos
  (`--series-*`) NO es la de marca a propósito: está validada para daltonismo y contraste.
  `src/assets/fide.svg` es el único placeholder que queda.
- **Calce de obra**: los aportes se asignan mes a mes, solo a las torres que estaban en
  construcción ese mes, y al ritmo en que su cronograma consume la plata (con un adelanto
  acotado y tope por costo). Lo que no absorben va a `reserva`. Sin eso aparecían dos absurdos:
  aportes asignados mayores al costo total de las obras, y una torre 5% construida figurando 96%
  fondeada. `src/test/obra.test.ts` cubre ambos.
- Los montos en Gs MM llegan a 14 caracteres: `Kpi` baja el cuerpo por tramos de largo para que
  entren en un renglón. Al agregar una métrica nueva, verificar que `scrollWidth <= clientWidth`.
- Las diapositivas usan un lienzo fijo de 1920×1080 con `overflow: hidden`: si el contenido
  desborda, el pie desaparece sin avisar. Al editarlas, medir el `scrollHeight` del
  `.slide-content` contra su `clientHeight`.
