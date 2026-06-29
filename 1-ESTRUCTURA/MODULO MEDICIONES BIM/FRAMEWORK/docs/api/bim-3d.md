# API — Mediciones BIM 3D

> Base: `/api/v1/bim_hub/`. Router en `backend/app/modules/bim_hub/router.py` (5071 ln, **58 endpoints**: 26 GET, 22 POST, 4 PATCH, 5 DELETE, 1 PUT).
> Auth JWT. Todo gateado por `_verify_project_access` / `_verify_model_access` (IDOR) + permisos `bim.*`.

## Modelos y subida
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/upload/` | `bim.create` | Subir datos (DataFrame Parquet/Excel + DAE/GLB opcional). Procesa en background |
| POST | `/upload-cad/` | `bim.create` | Subir CAD (RVT/IFC/…) → conversión **DDC cad2data** (o parser STEP de respaldo) |
| GET | `/` | `bim.read` | Listar modelos del proyecto (filtros; **excluye dwg/dxf/dgn** del visor 3D) |
| POST | `/` | `bim.create` | Crear registro de modelo (metadata) |
| GET | `/{model_id}` | `bim.read` | Detalle del modelo |
| PATCH | `/{model_id}` | `bim.update` | Actualizar (nombre, disciplina, metadata) |
| DELETE | `/{model_id}` | `bim.delete` | Borrar modelo (cascada elementos, blobs, links) |
| GET | `/models/{id}/geometry/` | `bim.read` | Sirve la geometría GLB/DAE (validación de magic-bytes) |
| GET | `/models/{id}/download/` | `bim.read` | Descargar CAD original |
| POST | `/{id}/retry/` | `bim.update` | Reintentar conversión DDC fallida |
| POST | `/{id}/generate-pdf-sheets/` | `bim.create` | Generar láminas PDF del modelo (async) |
| GET | `/models/{id}/parquet-status/` · POST `/parquet/retry/` | `bim.read`/`update` | Estado/reintento de escritura Parquet |
| POST | `/cleanup-stale/` · `/cleanup-orphans/` | `bim.delete` | Limpiar modelos colgados / blobs huérfanos |

## Elementos y activos
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/models/{id}/elements/` | Listar elementos (paginado; por tipo/storey/disciplina) |
| POST | `/models/{id}/elements/` | Importación masiva (reemplaza existentes) |
| POST | `/models/{id}/elements/by-ids/` | Traer elementos por UUID/stable_id |
| GET | `/elements/{id}` | Un elemento + sus BOQ links |
| GET | `/models/{id}/schema/` | Schema canónico de `BIMElement` (para formularios) |
| GET | `/assets` | **Registro de activos** (`is_tracked_asset`, ISO 19650) |
| PATCH | `/assets/{element_id}/asset-info` | Actualizar metadata de activo (fabricante, garantía, serie) |
| GET | `/models/{id}/export/cobie.xlsx` | Export **COBie 2.4** |

## Cuantificación / BOQ (5D)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/links/` | Listar vínculos BIM↔BOQ (filtros) |
| POST | `/links/` | Crear vínculo elemento ↔ posición BOQ (auto-sync de cantidad) |
| DELETE | `/links/{id}` | Quitar vínculo (re-sincroniza cantidad de la posición) |
| GET | `/quantity-maps/` | Listar reglas de cantidad (org/proyecto) |
| POST | `/quantity-maps/` | Crear regla |
| PATCH | `/quantity-maps/{id}` | Editar regla (filtro, source, multiplier, waste%) |
| POST | `/quantity-maps/apply/` | **Aplicar reglas** a un modelo (`dry_run` por defecto; persistir crea links + posiciones) |

## Grupos, smart views, vector, diff, dataframe
| Método | Ruta | Descripción |
|---|---|---|
| GET/POST/PATCH/DELETE | `/element-groups/[{id}]` | Grupos guardados (estáticos / dinámicos por filtro) |
| GET | `/smart-view-property-catalog/` | Catálogo de propiedades del modelo (para el constructor de reglas) |
| POST | `/smart-view/preview/` | Dry-run de un árbol de reglas (smart view) |
| GET | `/elements/{id}/similar/` | Búsqueda vectorial de elementos similares |
| GET | `/vector/status/` · POST `/vector/reindex/` | Salud / reindexado del índice vectorial |
| GET | `/bim-coverage/` | Desglose de elementos indexados por modelo/tipo/disciplina |
| POST | `/models/{id}/diff/{old_id}` | Calcular **diff** entre versiones (added/deleted/modified por stable_id) |
| GET | `/diffs/{diff_id}` | Diff cacheado |
| GET | `/models/{id}/dataframe/schema/` | Columnas + tipos del Parquet |
| POST | `/models/{id}/dataframe/query/` | Consulta **DuckDB SQL** sobre el Parquet |
| GET | `/models/{id}/dataframe/columns/{col}/values/` | Conteo de valores distintos de una columna |

## Federaciones (multi-modelo)
| Método | Ruta | Descripción |
|---|---|---|
| POST/GET | `/federations/` | Crear / listar federaciones |
| GET/PUT/DELETE | `/federations/{id}` | Detalle / actualizar / borrar (miembros en cascada) |
| POST | `/federations/{id}/models` | Añadir modelo (disciplina, visibilidad, z-order, color) |
| DELETE | `/federations/{id}/models/{model_id}` | Quitar modelo |
| GET | `/federations/{id}/type-tree` | Agregado de IfcClass por miembro |
| GET | `/federations/{id}/health` | Salud (escalera: missing>failed>processing>empty>stale>ready) |
| GET | `/federations/{id}/snapshot` · POST `/snapshot-diff` | Capturar estado / diff de snapshots |

## Contratos clave (schemas.py)
- **`apply_quantity_maps`** → `{matched_elements, rules_applied, links_created, positions_created, skipped_count, results[], skipped[]}`.
  `adjusted_quantity = raw · multiplier · (1 + waste_pct/100)`.
- **`BOQElementLink`**: `{id, bim_element_id, boq_position_id, link_type, confidence, boq_position{ordinal,description,unit,quantity,unit_rate}}`.
- **Smart view rule tree**: `{op: AND|OR, rules:[{field, op, value} | sub-tree]}`; ops string/numéricos;
  guardas: depth≤6, leaves≤100, regex≤200, candidatos≤50.000 (eval en Python).
- **Validación de regla (QR-001)**: `multiplier` finito y >0 (rechaza inf/NaN/`-2`/`1e500`); `waste_pct` 0–100.

## Seguridad
- **IDOR**: `_verify_project_access`/`_verify_model_access` en todo endpoint; 404 indistinguible.
- **Geometría servida** valida magic-bytes (GLB `glTF`, DAE COLLADA) antes de servir.
- **DuckDB query**: allow-list de nombres de columna (anti-inyección).
