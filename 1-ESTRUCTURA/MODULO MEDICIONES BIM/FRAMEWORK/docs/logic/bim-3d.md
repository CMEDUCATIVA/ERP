# Lógica de Negocio — Mediciones BIM 3D

> Reglas que NUNCA deben romperse. Respaldadas en `service.py`, `ifc_processor.py`,
> `smart_views.py`, `models.py` y el visor (`shared/ui/BIMViewer/`).

## 1. Cantidades canónicas SI (NUNCA ROMPER)
`element.quantities` usa claves canónicas: **`area_m2`, `volume_m3`, `length_m`, `weight_kg`, `count`**.
Toda extracción de cantidad y todo push al BOQ parten de aquí. La federación puede mostrar otra
unidad, pero las cantidades de los miembros siguen siendo SI.

## 2. Identidad por `stable_id` (NUNCA ROMPER)
Cada elemento se identifica por `stable_id` = **GUID IFC** o **ElementId de Revit**. Es la clave de:
(a) el **diff** entre versiones, (b) el emparejado fila↔malla (`mesh_ref` = id de nodo COLLADA/GLB,
que coincide con el ElementId). Sin identidad estable, el diff y el 3D se desincronizan.

## 3. La cantidad del BOQ se auto-sincroniza **según la unidad** (NUNCA ROMPER)
`_sync_boq_quantity_from_links(position_id)` recalcula `Position.quantity` desde los links **según
la unidad de la posición** (no un `source` fijo): `m3`→Σvolume_m3, `m2`→Σarea_m2, `m/lfm`→Σlength_m,
`kg`→Σweight_kg, `t`→Σweight_kg/1000, **conteo (pcs/St/ea)→nº de elementos**. Invariantes:
**E-XMOD-003** (conteo nunca toma volumen/área/peso), **D-TKC-005** (tonelada ÷1000), **D-TKC-028**
(si no hay cantidad dimensionalmente correcta, **deja la posición intacta** — preserva el valor manual).
Se llama al crear/borrar un link. Detalle exacto: [internals §3](bim-3d-internals.md).

## 4. IA/regla propone, humano confirma
`apply_quantity_maps` tiene **dry-run por defecto**: calcula el preview sin persistir. Al persistir,
estampa `confidence` (high/medium/low según `matched/(matched+skipped)`) en la posición auto-creada.
El usuario revisa en el BOQ antes de asignar costo. (CLAUDE.md regla 7.)

## 5. Validación de reglas de cantidad (QR-001)
`multiplier`: finito, **>0**, ≤1e15 (rechaza `inf`, `NaN`, `-2` que invertiría signo, `1e500`,
`__import__`). `waste_factor_pct`: 0–100. `adjusted = raw · multiplier · (1 + waste/100)`. Un
elemento sin la propiedad fuente se **omite con motivo** (no rompe los demás).

## 6. Atomicidad por regla (savepoint)
Al aplicar reglas, cada una corre en `session.begin_nested()`: el fallo de una no revierte las
otras. El `IntegrityError` por link duplicado (UNIQUE pos+elem) se ignora (idempotente).

## 7. Solo modelos 3D en el visor (NUNCA ROMPER)
`is_non_3d_format()` filtra **dwg/dxf/dgn** del listado/visor BIM 3D (esos van al módulo DWG). Evita
entregar al visor un modelo cuya geometría 3D no puede existir (404 "marcado ready pero sin malla").

## 8. Ciclo de vida del modelo
`processing → ready|complete|done` · `failed|error` · `needs_converter`. Solo modelos **ready**
aparecen en el visor 3D. `error_message` guarda contexto DDC (versión, exit_code, stderr, rvt_info).
`needs_converter` es **terminal** (sin converter instalado) → CTA de instalar, no spinner eterno.

## 9. Diff por geometry_hash + propiedades
Comparar dos versiones: emparejar por `stable_id`; un elemento es **modified** si cambia
`geometry_hash` (SHA-256 de vértices redondeados a ~0.1 mm, `ddc_extras.py`), `quantities` o
`properties`. `added`/`deleted` por diferencia de conjuntos de `stable_id`. Se cachea por par (old,new).

## 10. Grupos: dinámico vs estático
`is_dynamic=true` → los miembros se recalculan de `filter_criteria` en cada lectura (cache en
`element_ids`). `is_dynamic=false` → `element_ids` es la verdad y no se recalcula. Nombre único por proyecto.

## 11. Smart views: árbol de reglas seguro
Árbol tipado `{op: AND|OR, rules:[…]}` con ops string (`contains`, `regex`, `in`…) y numéricos
(`between`, `>=`…). Guardas: profundidad ≤6, hojas ≤100, regex ≤200 chars, campos string ≤80,
listas ≤200, candidatos ≤50.000. **Se evalúa en Python** sobre filas pre-cargadas (no SQL) → <50 ms.

## 12. Federación = overlay (no copia)
Una federación referencia N modelos (N:M) con `z_order`, `discipline`, `color_hint`, `visible` y un
`origin_offset` compartido. Borrar la federación **no** borra los modelos (solo las filas de join).
Un modelo debe pertenecer al mismo proyecto que la federación; duplicado → 409.

## 13. Salud de federación (peor miembro gana)
Escalera de severidad: `missing > failed > processing > empty > stale > ready`. `stale` = un miembro
lleva ≥14 días sin actualizarse respecto al más nuevo. El estado de cabecera = el peor miembro.

## 14. Medición 3D (visor)
- **MeasureTool**: distancia punto-a-punto con **snap a vértice** (8 px); etiqueta en m/mm.
- **MeasureManager**: `distance | area | angle` — área (polígono ≥3 puntos, **método de Newell 3D** +
  perímetro), ángulo (3 puntos, vértice en el central). Snap por `SnapDetector` (vértice/punto-medio/perpendicular, 12 px).
- Las mediciones del visor son **de inspección** (no cuantifican el BOQ por sí mismas; la
  cuantificación al BOQ usa `element.quantities`).

## 15. Geometría y dataframe fuera de BD
Malla (GLB/DAE), `elements.parquet` (1000+ columnas) y el CAD original viven en disco
(`file_storage.py`), no en BD. El Parquet se consulta con **DuckDB** (allow-list de columnas).

## 16. Seguridad (IDOR + magic-bytes)
Todo endpoint pasa por `_verify_project_access`/`_verify_model_access` (404 indistinguible). La
geometría servida valida magic-bytes (GLB `glTF`, DAE COLLADA) — cierra el "XML servido como DAE".
