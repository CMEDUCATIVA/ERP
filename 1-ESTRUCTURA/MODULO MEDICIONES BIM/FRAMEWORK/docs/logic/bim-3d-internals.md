# Algoritmos internos — Mediciones BIM 3D (para réplica exacta)

> El "20% algorítmico" que complementa [logic](bim-3d.md). Cada sección respaldada en el
> archivo fuente. No inventar; si algo no está aquí, leer el archivo citado.

---

## 1. Matemática de medición 3D — `shared/ui/BIMViewer/measureMath.ts`
Funciones puras sobre `{x,y,z}` (Three.Vector3 encaja estructuralmente):
- **`distance3(a,b)`** = `√(dx²+dy²+dz²)`.
- **`polygonArea3(points)`** = **método de Newell** (NO Shoelace): suma vectorial del área;
  `|N|/2` con `N=(Σ(yi−yj)(zi+zj), Σ(zi−zj)(xi+xj), Σ(xi−xj)(yi+yj))`. Da el área real de cualquier
  polígono **planar** sin importar su orientación 3D, y degrada sin NaN para sets casi-planares. ≥3 puntos.
- **`polygonPerimeter3(points)`** = Σ `distance3` del bucle cerrado (≥2 puntos).
- **`angleBetween3(a,b,c)`** = ángulo interior en `b` (rayos b→a, b→c), `acos(clamp(dot/(l1·l2)))·180/π`,
  en `[0,180]`; 0 si un rayo es degenerado.
- **`centroid3(points)`** = media (ancla la etiqueta de área).

> Las mediciones del visor son de **inspección** (no cuantifican el BOQ; eso usa `element.quantities`).

## 2. Extracción de cantidad — `service.py::_extract_quantity(element, source)`
- `source = "property:xxx"` → `element.properties[xxx]`.
- `source = "count"` → `Decimal("1")`.
- en otro caso → `element.quantities[source]` (area_m2, volume_m3, length_m, weight_kg…).
- Valor `None` → `None` (omite); parse a `Decimal(str(value))` (InvalidOperation → `None`).

## 3. Sincronización **unit-aware** de la cantidad del BOQ — `service.py::_sync_boq_quantity_from_links`
**El más importante.** `Position.quantity` se recalcula desde los links **según la unidad de la posición**
(`normalize_unit_token`):
| Unidad | Cantidad |
|---|---|
| `m3`/`m³` | Σ `volume_m3` |
| `m2`/`m²` | Σ `area_m2` |
| `m`/`lfm`/`lm` | Σ `length_m` |
| `kg` | Σ `weight_kg` |
| `t` (tonelada) | Σ `weight_kg ÷ 1000` (**D-TKC-005**) |
| `pcs`/`St`/`ea`/`lsum`/… (conteo) | **nº de elementos enlazados** (1 por elemento) (**E-XMOD-003**) |

**Invariantes (defectos cerrados en v1.9.0):**
- **E-XMOD-003**: una posición de conteo NUNCA toma volumen/área/peso → no más "7.5 pcs de muros".
- **D-TKC-005**: tonelada divide kg/1000 (4000 kg → 4 t, no 4000 t).
- **D-TKC-028**: si **no** existe cantidad dimensionalmente correcta para la unidad, la posición se
  **deja intacta** (preserva el valor manual del estimador; nunca "primer numérico no nulo").

> Esto reemplaza la simplificación "Σ quantities[source]" del doc de reglas: el push respeta la unidad.

## 4. Aplicar reglas de cantidad — `service.py::apply_quantity_maps`
Por cada elemento × regla: match (`element_type_filter` + `property_filter`) → `_extract_quantity` →
`adjusted = raw · multiplier · (1 + waste_pct/100)`. Persistir (no dry-run):
- **Savepoint por regla** (`begin_nested`): el fallo de una no revierte otras.
- Resolver/auto-crear posición; crear `BOQElementLink` (idempotente por UNIQUE pos+elem;
  `IntegrityError` ignorado).
- `_sync_boq_quantity_from_links` (§3) tras crear los links.
- **Confidence** (`_match_quality_confidence`): `ratio = matched/(matched+skipped)` →
  **`≥0.9` high · `≥0.6` medium · else low**. Se estampa en la posición auto-creada (espeja `draftConfidence` del front).

## 5. Diff entre versiones — `service.py::compute_diff(new, old)`
- Cachea por par `(old, new)` (`diff_repo.get_by_pair`); si existe, lo devuelve.
- Carga elementos de ambos (límite 50.000), indexa por `stable_id`.
- `added = new−old`, `deleted = old−new`, `common = ∩`.
- Para cada `common`: **modified** si difiere `geometry_hash`, `element_type`, `quantities` o
  `properties` (registra `{field, old, new}`); si no, `unchanged`.
- `diff_summary = {unchanged, modified, added, deleted}`; `diff_details` con los cambios.

## 6. Firma de geometría — `ddc_extras.py::geometry_signature(element)`
`SignatureV1` **idempotente** entre re-conversiones del mismo modelo: vértices **redondeados** a
`_VERTEX_DECIMALS` (absorbe jitter sub-mm), **deduplicados y ordenados** antes de hashear (re-orden de
índices no cuenta como cambio). Describe malla (hash), volumen, área de superficie, centroide y bbox.
Es la base de `element.geometry_hash` usado por el diff (§5).

## 7. Pipeline IFC/CAD — `ifc_processor.py` + `service.py::_process_cad_in_background`
- **Primario**: DDC cad2data (RVT Exporter) → **Excel** (DataFrame 1000+ columnas: id, propiedades,
  cantidades) + **COLLADA** (malla). **Identidad**: id de nodo COLLADA = `Revit Element.Id.IntegerValue`
  = columna ID del Excel → se usa como `mesh_ref` (empareja fila↔malla en el visor).
- **Respaldo**: parser STEP de IFC (sin IfcOpenShell) → extrae ~70 IfcClass (IfcWall, IfcSlab,
  IfcColumn, IfcDoor, IfcSpace…), genera cajas COLLADA simplificadas para preview.
- **Fallo DDC**: `_LAST_DDC_FAILURE` guarda `{reason, exit_code, stderr, converter_version, rvt_info}`
  → el router lo usa para el mensaje y el CTA de reinstalar.
- Estado: `processing → ready` (o `failed`/`needs_converter`). Validación async (`_run_import_validation`):
  conteo>0, geometría disponible, columnas.

## 8. Smart views — `smart_views.py`
Árbol `{op: AND|OR, rules:[{field, op, value} | sub-árbol]}`. Ops string (`=,!=,contains,starts_with,
ends_with,regex,in,not_in,is_empty,is_not_empty`) y numéricos (`=,!=,>,<,>=,<=,between,in,not_in,…`).
Campos: top-level (`id,name,element_type,discipline,storey,category`) y anidados
(`properties.*, quantities.*, geometry.*, identity.*`). **Guardas**: depth ≤6, hojas ≤100, regex ≤200,
string ≤80, listas ≤200. **Eval en Python** sobre filas pre-cargadas (no SQL), candidatos ≤50.000 (<50 ms).

## 9. Parquet / DuckDB — `dataframe_store.py`
`elements.parquet`: todas las columnas DDC como **string** (sin coerción), normalizadas (NBSP,
"None"/"null"→None); row group 50.000; compresión **ZSTD**; estadísticas on. Consulta con **DuckDB**
(SQL completo; allow-list de nombres de columna anti-inyección) o fallback pyarrow.

## 10. Ciclo de vida del contexto WebGL — `SceneManager.ts` / `BIMViewer.tsx` (v1.1.0)
El navegador limita los contextos WebGL simultáneos (~8-16). Para no agotarlos, `dispose()`
históricamente forzaba `renderer.forceContextLoss()` siempre. Pero en GPUs **AMD** con el workaround
de Chrome `exit_on_context_lost`, esa pérdida de contexto **mata el proceso GPU**; con el doble
montaje de React StrictMode (dev) o un *navegar y volver* rápido, el siguiente renderer nacía con el
contexto perdido → `getMaxPrecision()` lee `null.precision` → `throw` → fallback "3D no disponible".

**Algoritmo (corregido):**
- Contador a nivel de módulo `liveWebGLContexts`: `++` tras crear el `WebGLRenderer`; `=max(0,−1)` en `dispose()`.
- En `dispose()`: `forceContextLoss()` **solo si** `liveWebGLContexts ≥ MAX_SAFE_LIVE_CONTEXTS (=6)`
  (sesiones pesadas multi-modelo). En el caso normal (1-2) se omite → `renderer.dispose()` + GC liberan
  el contexto sin matar el GPU → el remontaje obtiene un contexto vivo.
- `BIMViewer.tsx`: el `try/catch` del init mantiene el fallback `webglError` solo cuando el contexto
  realmente no se puede crear (no por el born-lost transitorio, ya evitado en origen).

## 11. Lo que aún requiere el archivo fuente
- Cuerpo completo de `ifc_processor.py` (4002 ln): parseo STEP exacto, decodificación de escapes,
  generación de COLLADA de respaldo.
- `service.py` (3958 ln): orquestación de import, federaciones (health/type-tree/snapshot-diff),
  COBie exporter, cleanup de huérfanos.
- Transformaciones del visor (`SceneManager`/`ElementManager`/`SectionBox`/`WalkMode`) y claves i18n `bim.*`.
