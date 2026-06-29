# Algoritmos internos — PDF Takeoff (para réplica exacta)

> El "20% algorítmico" que complementa [logic](pdf-takeoff.md) (reglas) para reconstruir
> **al decimal**. Cada sección respaldada en el archivo fuente. No inventar: si algo no
> está aquí, leer el archivo citado.

---

## 1. Invariante de escala (la base de TODO) — `data/scale-helpers.ts`
Los puntos de medición se guardan en **unidades de usuario PDF** (1 pt = 1/72 pulgada), porque
el canvas captura `(clientX − rect.left) / zoom` y el ancho CSS del canvas es `pdfWidth · zoom`
a escala base 1.0. Constantes: `PDF_POINTS_PER_INCH = 72`, `METERS_PER_INCH = 0.0254`.

- **`presetScale(ratio)`** (botones 1:10…1:1000): `pixelsPerUnit = 72 / (0.0254 · ratio)`,
  `unitLabel = 'm'` siempre (los planos imperiales se manejan por calibración, no por preset — D-TKC-016).
  `ratio ≤ 0` → `{pixelsPerUnit:0, invalid:true}`.
- **`ratioFromScale(scale)`** (inverso): `ratio = 72 / (pixelsPerUnit · 0.0254)`, redondeado, ≥1.
- **`deriveScale(pixelLength, realLength)`**: `pixelsPerUnit = pixelLength / realLength`
  (realLength **en metros**). **Contrato métrico-canónico (D-TKC-016)**: `unitLabel` siempre `'m'`;
  `CalibrationDialog` convierte ft/in a metros con `toMeters()` ANTES de llamar. La unidad original
  se muestra aparte (no se pierde).
- **Escala inválida (D-TKC-010)**: si `pixel ≤ 0` o `real ≤ 0` → `{pixelsPerUnit:0, invalid:true}`
  (NUNCA 1px=1m silencioso, que convertía 28.346 px en "28.346 m"). Todos los consumidores tratan
  `pixelsPerUnit ≤ 0` como "sin escala" → 0 / "—" y el visor re-pide calibrar.
- `UNIT_TO_METERS`: `m 1, mm 0.001, ft 0.3048, in 0.0254`. `toMeters`/`fromMeters` multiplicativos.

## 2. Geometría frontend (al dibujar) — `data/scale-helpers.ts`
- `pixelDistance(x1,y1,x2,y2)` = `√((x2−x1)²+(y2−y1)²)`.
- `toRealDistance(pixelDist, scale)` = `pixelDist / pixelsPerUnit` (0 si escala ≤0).
- `polygonAreaPixels(points)` = **Shoelace** `|Σ(xi·yj − xj·yi)|/2` (≥3 puntos).
- `toRealArea(pixelArea, scale)` = `pixelArea / pixelsPerUnit²` (÷ escala², no escala).
- `polygonPerimeterPixels(points)` = Σ `pixelDistance` de aristas (cerrado).
- **`formatMeasurement(value, unit)`**: degenerados (no finito, ≤0) → `''` (no "0 m²"). Reales:
  `<0.001`→`toPrecision(2)`, `<1`→4 dec, `<100`→2 dec, resto 1 dec (un detalle de 9 mm sigue visible — D-TKC-007).

## 3. Recálculo server-side (Audit B8) — `service.py::recompute_measurement_value`
**El servidor NO confía en el `measurement_value` del cliente** (un cliente podía dibujar un
rectángulo diminuto y reclamar 9999 m² que fluía al BOQ). Deriva el valor de `(points × scale)`:

| Tipo | Cálculo (server) |
|---|---|
| `distance` / `polyline` | `_polyline_length(xy) / scale` |
| `area` | `_shoelace_area(xy) / scale²` |
| `volume` | base = `_shoelace_area(xy) / scale²` (la profundidad se multiplica aparte) |
| `count` | `float(count_value)` (ignora puntos; si `count_value ≥ 0`) |
| `cloud/arrow/text/rectangle/highlight` | echo del `client_value` (anotaciones sin geometría medible) |

Requisitos para recomputar geometría: `scale > 0` y `≥2` puntos; si no → fallback `client_value`.
Tipo desconocido → preserva `client_value` (no lo anula).

### 3.1 Volumen (`recompute_volume_value`)
`volume = base_area · depth` desde la misma geometría, con `depth ≥ 0`. Solo se recomputa el
tipo `volume`; otros → echo. Volumen cliente **negativo se clampa a `None`** (no envenena el BOQ).
Cierra el hueco que B8 dejó abierto en la columna `volume` (la que lee `_pick_takeoff_value` al
empujar al BOQ).

## 4. Reconstrucción del label al cargar (D-TKC-UP11) — `useMeasurementPersistence.ts::reconstructValueLabel`
El **valor mostrado** (`label`) NO se persiste; se reconstruye desde los campos numéricos del
servidor replicando el formato de creación por tipo (si no, al recargar mostraba el nombre dos
veces: "Distance 6 / Distance 6"):

- `distance`/`polyline` → `formatMeasurement(value, base)` → "1.40 m"
- `area` → `"<area> (P: <perimeter>)"` → "0.27 m² (P: 2.30 m)"
- `volume` → `"V = <vol> (A: <area> × D: <depth>)"` (área de `metadata.area`)
- `count` → `"<round(count)> pcs"`
- anotaciones → `''` (su fila usa el tipo, no el label)

`base` = unidad lineal (quita `²`/`³`). `fromApiFormat` usa `label: reconstructValueLabel(r)`;
`annotation` sigue siendo el **nombre** editable; `id = metadata.frontend_id || r.id`; `serverId = r.id`.

## 5. Carga dual-key + merge (D-TKC-UP07) — `useMeasurementPersistence.ts::loadData`
Las mediciones de un documento pueden vivir bajo su **UUID** o su **filename** (filas escritas
antes de que la subida en background asignara UUID, o tras un 409 de duplicado). El efecto:
1. Construye `keys = [documentId?, fileName≠documentId?]` (o `serverDocId` si vacío).
2. `Promise.all(keys.map(k => takeoffApi.list(projectId, k).catch(()=>[])))`.
3. **Merge dedup**: por `id` de servidor primero, luego por `metadata.frontend_id`. Las filas por
   UUID ganan a las de filename (UUID va primero).
4. Si hay datos: `geometrySigRef` siembra la firma geométrica (no re-PATCHear filas que ya
   coinciden, #194), reconstruye escala por página desde los ratios del servidor (`pageScalesFromServer`),
   `setMeasurements(mapped)`. Si no → fallback a localStorage (`hydratePageScales` promueve `data.scale`
   legacy a default por página).

**Regla crítica de deps**: `documentId` **NO** está en las deps del efecto (la identidad es por
filename). Un UUID que llega DESPUÉS del filename (drop local → subida) no debe re-ejecutar el
efecto: hacerlo cancelaba la carga en vuelo → lista vacía ("Measurements (0)" con el PDF visible).
La carga lee el `documentId` más reciente desde el closure para la consulta dual-key.

## 6. Sincronización (debounce + guardia) — `useMeasurementPersistence.ts`
- **localStorage**: auto-save con debounce **500ms** (clave = `fileName`).
- **Servidor**: `syncMeasurementsToServer` con `serverDocId = fileName`; guardia
  **`inFlightSyncRef`** (si ya hay un sync en vuelo, retorna sin solapar → evita duplicados).
  `toApiFormat(m, projectId, serverDocId, pageScales)`.
- (#194) reshape-PATCH con `geometrySignature` para PATCHear solo geometría cambiada.

## 7. Reconocimiento offline (vector, issue #194) — `recognize.py`
Complemento **offline y determinista** del analizador LLM. Lee la capa vectorial del PDF
(`page.get_drawings()` de PyMuPDF — coords ya en puntos PDF, mismo espacio que el front, sin
transformar) y propone candidatos. **Nada se persiste** (CLAUDE.md regla 7: IA propone, humano confirma).
Umbrales:
- `_MIN_SEGMENT_PX = 18.0` (trazo mínimo; filtra hatching/ticks/ruido) → candidatos `distance`.
- `_MIN_AREA_PX2 = 600.0` (área mínima de loop cerrado; filtra glifos/símbolos) → candidatos `area`.
- `_SYMBOL_MAX_DIAG_PX = 46.0` (formas pequeñas = símbolos contables) + `_MIN_CLUSTER = 3`
  (cluster de símbolos casi idénticos) → candidatos `count`.
- `_MAX_CANDIDATES = 40` (tope para no saturar el panel de revisión).
Cada candidato lleva `confidence` honesto y `reason` legible. Módulo puro/sin BD (testeable con tuplas).
El reconocimiento **raster** (PDF escaneado) usa OpenCV en `raster_recognize.py` (extra `cv`).

## 8. IA de texto (`analyze`) — `router.py::analyze_document` (ya en [logic](pdf-takeoff.md) §7)
Sobre `extracted_text`; **fencea** el texto antes del LLM (AI1); si `extract_json` devuelve un
**dict**, **desenvuelve la primera lista** (`items/elements/positions/rows/results/data`) antes de
descartar (D-TKC-UP16); valida/clampa cantidades del LLM (AI3).

## 9. Lo que aún requiere el archivo fuente
- Cuerpo completo de `TakeoffViewerModule.tsx` (~5944 ln): dibujo en canvas, hit-test
  (`data/hit-test.ts`), undo/redo, render de leyenda/items, portal del picker BOQ.
- `raster_recognize.py`: pipeline OpenCV concreto (umbralizado, contornos).
- Orquestación completa de `service.py` (upload gates, cross-link Documents, `_pick_takeoff_value`).
- Claves i18n `takeoff.*` / `takeoff_viewer.*` literales.
