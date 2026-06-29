# Algoritmos internos — DWG Takeoff (para réplica exacta)

> El "20% algorítmico" que falta en `logic/dwg-takeoff.md` (reglas) para reconstruir
> **al decimal**. Cada sección está respaldada en el archivo fuente indicado. No inventar:
> si algo no está aquí, leer el archivo citado.

---

## 1. Parseo DXF — `dxf_processor.py::parse_dxf(file_path)`
Usa **ezdxf** (`ezdxf.readfile`). Dependencia opcional: si no está, `_require_ezdxf()` lanza
`ImportError` con mensaje claro. Devuelve `{layers, entities, extents, units, entity_count, skipped_count, layouts}`.

### 1.1 Capas
Por cada `doc.layers`: `{name, color=_aci_to_hex(layer.color), visible, entity_count:0}`.
**Regla de visibilidad (BUG-005)**: por defecto **visible**; solo se oculta si el archivo marca
`is_off` o `is_frozen` *explícitamente*. Cada bit se lee en su propio `try/except` (ezdxf 1.4 a
veces lanza en capas malformadas, y una excepción colapsaba toda la expresión a `False` → lienzo vacío).

### 1.2 Color ACI → hex (`_aci_to_hex`)
Tabla mínima AutoCAD Color Index: `1 #ff0000`, `2 #ffff00`, `3 #00ff00`, `4 #00ffff`,
`5 #0000ff`, `6 #ff00ff`, `7 #ffffff`, `8 #808080`, `9 #c0c0c0`; fallback `#ffffff`.
**ByLayer/ByBlock**: si `color` de la entidad es `0` o `256` → usar el color de su capa.

### 1.3 Serialización por entidad (`_serialize_entity`)
`{entity_type, layer, color, geometry_data, layout}`. `geometry_data` por tipo:
- **LINE**: `{start{x,y}, end{x,y}}`
- **CIRCLE**: `{center{x,y}, radius}`
- **ARC**: `{center, radius, start_angle=radians(dxf.start_angle), end_angle=radians(dxf.end_angle)}` ← **se guardan en radianes**
- **LWPOLYLINE/POLYLINE**: `{points:[{x,y}], closed}` (LW: `get_points("xy")`; POLYLINE: `vertex.dxf.location`)
- **TEXT**: `{insert, text, height, rotation}` · **MTEXT**: `{insert, text=plain_text(), height=char_height}`
- **INSERT**: `{insert, block_name, x_scale, y_scale, rotation}`
- **ELLIPSE**: `{center, major_axis, ratio}` · **SPLINE**: `{control_points}`
- **HATCH**: `{pattern_name}` · **DIMENSION**: `{dimension_type, text_override}`

Se recorren **TODOS los layouts** (`doc.layouts`: Model, Layout1…). Si se omite >10% de entidades
(`skipped_count/total`), se loguea warning. Cada entidad omitida no rompe el parseo.

### 1.4 Extents
Se calculan **desde las entidades parseadas** (más fiable que `msp.get_extents`): se acumulan
puntos de `start/end`, `points`, `center±radius`, `insertion_point` → `min/max x,y`. Si no hay
puntos → fallback `(0,0)–(1000,1000)`.

### 1.5 Unidades (`$INSUNITS`)
Mapa: `0 unitless, 1 inches, 2 feet, 3 miles, 4 mm, 5 cm, 6 m, 7 km`. **Si `unitless`** →
`infer_units_from_extents(extents)` (ver §7): un dibujo cuya mayor extensión ≥ 1000 unidades se
asume **mm** (un edificio de 1000+ leído como metros sería 1 km — absurdo). Sin esto, un DXF en
mm sin header se lee 1000× grande.

### 1.6 Thumbnail SVG (`generate_svg_thumbnail`)
`RenderContext(doc)` + `SVGBackend` + `Frontend(...).draw_layout(msp)`. ezdxf cambió la API:
intenta `backend.get_string(Page(0,0))` (autofit), cae a `get_string()`, luego a
`get_xml_root()` + `ElementTree.tostring`. En cualquier error → SVG placeholder "DXF Preview Unavailable".

---

## 2. Medición de entidades DXF — `dxf_processor.py::calculate_entity_measurement(entity)`
Devuelve valor en **unidades de dibujo** (luego el front aplica escala+unidad):
- **LINE** → `√(dx²+dy²)`
- **CIRCLE** → `2·π·r` (circunferencia)
- **ARC** → `r·angle`, con `angle = end−start` (ya en radianes); si `<0` sumar `2π`.
  **Bugfix C3**: NO volver a aplicar `radians()` (un 90° salía ~0).
- **LWPOLYLINE/POLYLINE** → suma de segmentos; si `closed` y >2 puntos, sumar el cierre.

---

## 3. Matemática de medición frontend — `lib/measurement.ts`
Estas son las fórmulas que el lienzo usa al dibujar (en píxeles/world-space, antes de escalar):
- **`calculateDistance(p1,p2)`** = `√(dx²+dy²)`.
- **`calculateArea(points)`** = Shoelace: `|Σ(xi·yj − xj·yi)| / 2`. ⚠️ Un polígono que se
  autointersecta ("bowtie") puede dar 0.
- **`calculateAreaSafe(points)`** → `{area, degenerate}` con `degenerate ∈
  {too_few_points, self_intersecting, zero, null}`. **Usar SIEMPRE que el área vaya al usuario/BOQ**
  (D-TKC-015). La autointersección se detecta con test de cruce de segmentos no adyacentes
  (`orient`/`onSeg`/`segmentsIntersect`/`isSelfIntersecting`).
- **`calculatePerimeter(vertices, closed)`** = Σ longitudes de segmento (`getSegmentLengths`).
- **`polygonCentroid`** (media de vértices, para etiqueta), **`pointInPolygon`** (ray-casting),
  **`pointToSegmentDistance`** (proyección clamped t∈[0,1], para hit-test).
- **`unitFactorToMetres(units)`**: `mm 0.001`, `cm 0.01`, `m 1`, `km 1000`, `in 0.0254`,
  `ft 0.3048`, `miles 1609.344`, default `1`.
- **`formatMeasurement(value, unit)`**: **regla clave (D-TKC-006)** — unidades **compuestas**
  (`²`/`³`) **nunca** se prefijan con k/m (1500 m² ≠ 1.50 km²): se muestran con precisión fija
  adaptativa (`<0.01`→`toPrecision(2)`, `<1`→4 dec, `<1000`→2 dec, resto miles agrupados).
  Lineales sí: `≥1000`→`k`, `<0.01`→`m` (mili), resto 2 dec.

---

## 4. Calibración 2 puntos — `lib/calibration.ts`
- **`deriveScale(A, B, realLength, realUnit)`** → `{ unitsPerPixel = realLength / pixelDistance(A,B), unit }`.
  Lanza `ZeroPixelDistanceError` si los puntos coinciden o `realLength ≤ 0`.
- `pixelDistance` = `Math.hypot`. `UNIT_TO_METRES`: `m 1, mm 0.001, ft 0.3048, in 0.0254` (multiplicativo, sin offset).
- **`formatWithUnit(pixels, scale)`** = `pixels·unitsPerPixel` + unidad; sin calibrar → `"NN px (uncal)"`.
- **`formatAreaWithUnit`** = `pixels²·unitsPerPixel²` + `²`. Precisión `formatNumeric`:
  `≥1000`→`k`, `<0.01`→4 dec, `<1`→3 dec, resto 2 dec.
- Se persiste por **drawing+layout** en `calibration-store.ts` (`CalibrationState` con `pointA/B`
  para redibujar la línea de referencia tras recargar). La escala "oficial" del plano vive en
  el servidor (`scale_denominator`, `scale_mode`).

---

## 5. Comparación de versiones — `service.py::compare_drawing_versions`
Ambas versiones deben pertenecer al mismo `drawing_id` (si no, 404). Dos diffs:

### 5.1 Diff de entidades (`_compute_entity_diff`)
Las entidades **no tienen identidad estable** entre re-parseos → se compara el **perfil de capas**
(conteo por capa). Por cada capa de `union(from, to)`: `added` (solo en nueva), `removed` (solo en
vieja), `modified` (conteo distinto), `unchanged`. Filas ordenadas por nombre (determinista).
`entity_id` de la fila = **nombre de capa**, `delta = new_count − old_count`.

### 5.2 Delta de anotaciones (`_compute_annotation_delta`)
Las anotaciones SÍ tienen identidad (`drawing_version_id`). Se emparejan por
**`metadata.compare_key`** si existe; si no, por `id:{uuid}`. `added`/`removed`/`modified`
(cambió `measurement_value`)/`unchanged`. Para una anotación en **ambas** versiones, **vinculada a
BOQ** y con valor cambiado → impacto de costo.

### 5.3 Impacto de costo (`_calculate_cost_impact`)
`(new − old) · unit_rate`, Decimal, quantize a 2 decimales **ROUND_HALF_UP** (igual que los
rollups del BOQ). `None` si falta un valor, o el rate es 0/no parseable. La tarifa se resuelve con
`_resolve_position_rate(position_id, project_id)` que **verifica que la posición BOQ pertenezca al
proyecto** (seguridad cross-tenant: una posición ajena → "sin tarifa", nunca precia contra otro
tenant). Best-effort: cualquier fallo → `(None, None)` (la comparación degrada a "sin costo", nunca 500).
`net_cost_impact` = suma de impactos; `cost_currency` = moneda base del proyecto (nunca mezcla monedas).

---

## 6. Crear variación desde diff — `service.py::create_variation_from_versions`
**No recomputa** el diff: llama a `compare_drawing_versions` (única fuente de verdad) y moldea su
summary. Crea un **`VariationRequest` en estado `draft`** (IA propone, humano confirma),
`classification="scope_change"`, `estimated_cost_impact = net_cost_impact`, `currency` = moneda base.
`description` = narrativa determinista (`_build_revision_narrative`, sin IA: "N layers added, M
removed…; K annotations…; P priced changed"). `metadata.source = "dwg_revision_compare"` con
`drawing_id`, par de versiones y `changed_annotation_ids` (trazable e idempotente: el par de
versiones es único). Import perezoso de `variations` (el módulo DWG no depende de él en import-time).

---

## 7. Conversión DWG→DXF e inferencia de unidades — `ddc_dwg_parser.py`
- Un `.dwg` se convierte a DXF con el **converter DDC** (DwgExporter) en background; el estado del
  plano transita `uploaded → processing → ready|empty|needs_conversion|error` (el front hace poll).
- **Commit por transición de estado (DWG-FIX-01)**: `_process_dwg` confirma `status="processing"`
  ANTES del subproceso DDC para no retener un lock de fila durante 30–120 s (si no, un
  `PATCH /scale/` concurrente se bloquea y expira a los 30 s) y para que el polling vea "processing".
- **BlockId ≠ layout (DWG-FIX-04)**: DDC entrega cada entidad con su `BlockId` (registro de bloque
  dueño), NO un layout. Solo `*Model_Space` y `*Paper_Space[n]` son espacios reales; todo `BlockId`
  que no empiece por `*Paper_Space` (cotas `*D####`, hatches `*U####`, bloques `_Dot`…) se
  **colapsa a `*Model_Space`** antes de etiquetar la entidad y construir `layout_set`. Sin esto el
  sheet strip se inunda de cientos de bloques como si fueran láminas. (El path ezdxf usa
  `doc.layouts` reales — §1.1 — y no necesita este colapso.)
- **`infer_units_from_extents(extents)`**: si la mayor extensión ≥ 1000 → `"mm"`; si no → `None`
  (se mantiene "unidades crudas = metros"). Protege contra extents nulos/cero/no finitos. Lo usa
  tanto el parser DDC como `parse_dxf` (§1.5) para no leer 1000× grande un mm sin header.

---

## 8. Render del lienzo (resumen — detalle en los archivos)
> Documentado a nivel de enfoque; para transformaciones exactas leer los archivos.
- **`lib/dxf-renderer.ts`**: Canvas 2D. Soporta LINE, LWPOLYLINE, ARC, CIRCLE, ELLIPSE, TEXT,
  POINT, INSERT, HATCH. Color por tabla **ACI** (0–9) → hex, o hex directo, fallback `#CCCCCC`.
  **Culling** por viewport (`isInViewport`, margen 200px + radio) antes de dibujar.
- **`lib/viewport.ts`**: estado `{centerX, centerY, scale(px/unidad), offsetX, offsetY}` +
  `zoomToFit`, `applyZoom`, `applyPan`, `screenToWorld`, `worldToScreen`.
- **`lib/snap.ts`**: snapping endpoint/midpoint (intersection pendiente). **`lib/ortho.ts`**:
  orto-lock con `Shift` (0/45/90/135°). **`lib/undo-stack.ts`**: pila de snapshots de anotaciones
  (Ctrl+Z/Y). **`lib/group-aggregation.ts`**: agregados por grupo. **`lib/pdf-export.ts`**: export del viewport.

---

## 9. Lo que aún requiere el archivo fuente (no documentable sin perder fidelidad)
- Cuerpo completo de `service.py` (2294 ln): orquestación de upload, versionado, gates IDOR
  `_gate_by_drawing/annotation/group`, persistencia de entidades a disco (`entities_key`).
- `ddc_dwg_parser.py` (912 ln): invocación concreta del converter, manejo de errores/timeouts.
- Transformaciones exactas de `viewport.ts`/`dxf-renderer.ts`/`snap.ts` (geometría de pantalla).
- Claves i18n `dwg_takeoff.*` y textos de error literales.
