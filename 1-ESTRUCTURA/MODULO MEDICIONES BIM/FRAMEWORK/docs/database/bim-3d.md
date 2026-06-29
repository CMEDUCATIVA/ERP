# Base de Datos — Mediciones BIM 3D

> Modelos en `backend/app/modules/bim_hub/models.py`. **DDL estructurado**: [`bim-3d-schema.sql`](bim-3d-schema.sql).
> 8 tablas. Geometría y dataframes **NO** van en BD (ver §Almacenamiento de archivos).

## Tablas

### 1. `oe_bim_model` — modelo BIM/CAD importado (1 por versión de archivo)
| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `project_id` | UUID (index) | proyecto |
| `name` | String(255) | |
| `discipline` | String(50) nullable | arquitectura/estructura/MEP… |
| `model_format` | String(20) nullable | rvt/ifc/… (dwg/dxf/dgn se filtran del visor 3D) |
| `version` | String(20) default "1" | |
| `status` | String(50) default "processing" | processing→ready/complete/done · failed/error · needs_conversion |
| `element_count` / `storey_count` | Integer | cache para listados rápidos |
| `bounding_box` | JSON | |
| `original_file_id` / `canonical_file_path` | String | refs al archivo en disco |
| `parent_model_id` | UUID FK→self (SET NULL) | **versionado** (diff entre versiones) |
| `error_message` | Text | contexto de fallo DDC |
| `created_by` | UUID | |
| `metadata_` (col `metadata`) | JSON | |
| `elements` | relación 1:N CASCADE | |

### 2. `oe_bim_element` — elemento extraído + **registro de activos** (ISO 19650)
| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `model_id` | UUID FK→model (CASCADE, index) | |
| `stable_id` | String(255) | **GUID IFC / ElementId Revit** (identidad de diff y mesh) |
| `element_type` | String(100) index | IfcWall, IfcSlab… |
| `name` / `storey` / `discipline` | String (index) | |
| `properties` | JSON | todas las propiedades (familia, material, fire rating…) |
| `quantities` | JSON | **canónico SI**: area_m2, volume_m3, length_m, weight_kg, count |
| `geometry_hash` | String(64) | SHA-256 de vértices redondeados (detección de cambios) |
| `bounding_box` | JSON · `mesh_ref` String(500) | `mesh_ref` = id del nodo COLLADA/GLB |
| `lod_variants` | JSON | mallas alternativas |
| `asset_info` | JSON | manufacturer, model, serial, warranty_until, commissioned_at, asset_tag… |
| `is_tracked_asset` | Boolean (index) | filtra la página `/assets` |
| `boq_links` | relación 1:N CASCADE | |

Índices: `ix_bim_element_model_stable (model_id, stable_id)`, `ix_bim_element_tracked (is_tracked_asset)`.

### 3. `oe_bim_boq_link` — vínculo elemento ↔ partida BOQ
| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `boq_position_id` | UUID (index) | posición del BOQ (sin FK formal al módulo BOQ) |
| `bim_element_id` | UUID FK→element (CASCADE, index) | |
| `link_type` | String(50) default "manual" | manual/rule/auto |
| `confidence` | String(10) nullable | high/medium/low |
| `rule_id` | String(100) nullable | regla que lo creó |
| `created_by` · `metadata_` | UUID · JSON | |
| **UNIQUE** | (boq_position_id, bim_element_id) | idempotente |

### 4. `oe_bim_quantity_map` — regla de cantidad (BIM→BOQ)
`org_id?`, `project_id?`, `name` (+`name_translations`), `element_type_filter` (IfcClass o `*`),
`property_filter` JSON, **`quantity_source`** (area_m2 / volume_m3 / `property:xxx` / count),
`multiplier` (Decimal>0), `unit`, `waste_factor_pct` (0–100), `boq_target` JSON
(`{position_id}` / `{position_ordinal}` / `{auto_create}`), `is_active`.

### 5. `oe_bim_model_diff` — diff cacheado entre dos versiones
`old_model_id` FK, `new_model_id` FK (UNIQUE par), `diff_summary` JSON (added/deleted/modified/unchanged),
`diff_details` JSON. Matching por `stable_id`; cambio por `geometry_hash` + propiedades/quantities.

### 6. `oe_bim_element_group` — selección guardada (estática o dinámica)
`project_id` (req), `model_id?` (scope), `name` (UNIQUE por proyecto), `is_dynamic`
(true→recalcula de `filter_criteria`; false→`element_ids` es la verdad), `element_ids` JSON,
`element_count`, `color`.

### 7. `oe_bim_federation` — federación (N modelos coordinados)
`project_id` (index), `name`, `description`, `origin_offset` JSON `{x,y,z}`, `shared_units` (m/mm/ft),
`members` 1:N CASCADE (ordenado por z_order).

### 8. `oe_bim_federation_model` — join federación ↔ modelo (N:M)
`federation_id` FK (CASCADE), `bim_model_id` FK (CASCADE), **UNIQUE** (federation_id, bim_model_id),
`discipline`, `color_hint`, `visible`, `z_order`.

## Relaciones
```
oe_projects ◄── oe_bim_model (project_id) ──CASCADE──► oe_bim_element ──CASCADE──► oe_bim_boq_link ──► oe_boq_position (string link)
                     │ parent_model_id (self, SET NULL = versionado)         oe_bim_element ◄── oe_bim_model_diff (old/new)
                     └─◄ oe_bim_federation_model ►── oe_bim_federation
oe_bim_quantity_map (reglas) ─aplica→ crea oe_bim_boq_link + posiciones BOQ
oe_bim_element_group (selección)
```

## Almacenamiento de archivos (NO en BD)
`data/bim/{project_id}/{model_id}/`:
- `geometry.glb` (preferida, ~8.8× más rápida) / `geometry.dae` (legacy) — malla 3D.
- `elements.parquet` — DataFrame DDC completo (1000+ columnas, ZSTD; consultable con DuckDB).
- `original.{rvt|ifc|…}` — archivo CAD original (re-export, descarga).
`file_storage.py` abstrae el backend (FS local o S3). `dataframe_store.py` lee/escribe Parquet.
