# API — PDF Takeoff

> Base: `/api/v1/takeoff/`. Implementado en `backend/app/modules/takeoff/router.py`.
> Auth: JWT. Casi todo gateado por `RequirePermission(...)` + `verify_project_access`.

---

## 1. Documentos
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/documents/upload/` | `takeoff.create` | Sube un PDF (multipart). 4 *gates*: tipo/tamaño, parseo, texto, **duplicado de filename por proyecto (409)**. Recibe `?project_id=`. Crea cross-link en Documents hub. |
| GET | `/documents/` | `takeoff.read` | Lista documentos del proyecto (`?project_id=`). Sincroniza cross-link. |
| GET | `/documents/{doc_id}` | `takeoff.read` | Metadatos de un documento (incluye auditoría de capa de texto). |
| GET | `/documents/{doc_id}/download/` | `takeoff.read` | Sirve el PDF (con check de path). |
| DELETE | `/documents/{doc_id}` | `takeoff.delete` | Borra documento + PDF en disco + **mediciones (cascada)** + limpia cross-link. |
| POST | `/documents/{doc_id}/extract-tables/` | `takeoff.create` | Extrae tablas → `AnalysisResult` (elements + summary). |
| POST | `/documents/{doc_id}/analyze/` | `takeoff.create` | **Analizar con IA**: envía `extracted_text` al LLM del usuario → partidas. Desenvuelve array si viene en objeto (D-TKC-UP16). |
| POST | `/documents/{doc_id}/recognize/` | `takeoff.read` | Reconocimiento **offline** (vector/raster) → candidatos de medición. |

## 2. Mediciones (CRUD + utilidades)
| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/measurements/` | `takeoff.read` | Lista por `project_id` (+ filtros `document_id`, `page`, `group`, `type`, `offset`, `limit`). **Clave del dual-key load.** |
| POST | `/measurements/` | `takeoff.create` | Crea una medición. Recalcula `measurement_value` server-side (Audit B8). |
| POST | `/measurements/bulk/` | `takeoff.create` | Crea en lote (≤2000). Verifica acceso por cada `project_id` del batch (Audit B4). |
| GET | `/measurements/{id}` | `takeoff.read` | Una medición. |
| PATCH | `/measurements/{id}` | `takeoff.update` | Actualiza. Recalcula geometría si cambian `points/scale/type/count/depth` (B8). Acepta `document_id` (re-key). |
| DELETE | `/measurements/{id}` | `takeoff.delete` | Borra una medición. |
| GET | `/measurements/summary/` | `takeoff.read` | Stats por grupo/tipo. |
| GET | `/measurements/export/` | `takeoff.read` | Exporta CSV/JSON (`?format=`). |
| POST | `/measurements/{id}/link-to-boq/` | `takeoff.update` | Vincula a posición BOQ (`{boq_position_id, push_quantity}`). |
| POST | `/measurements/compare/` | `takeoff.read` | Compara 2 documentos (`?from_document_id`, `?to_document_id`) → added/removed/modified + impacto de costo. |
| POST | `/measurements/create-variation` | `variations.create` | Crea una variación (orden de cambio) desde la comparación. |

## 3. Plan-read (lectura de plano por visión LLM, issue #194)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/plan-read/meta` | Disponibilidad/proveedor de plan-read. |
| POST | `/plan-read/` | Lanza una corrida (`document_id`, `page`, `scale_pixels_per_unit`, `mode`). Crea `AiTakeoffRun`. |
| GET | `/plan-read/runs/{run_id}` | Estado de la corrida. |
| GET | `/plan-read/runs/{run_id}/proposals` | Mediciones `proposed` minteadas por la corrida. |
| POST | `/plan-read/runs/{run_id}/accept` | Confirma propuestas seleccionadas → mediciones billables. |

## 4. Convertidores CAD (DDC) y CAD-data (compartido con BIM/CAD)
`/converters/` (status/install/uninstall/verify/progress), `/cad-extract/`, `/cad-columns/`,
`/cad-group/*` (create-boq, export, elements), `/cad-data/*` (describe, value-counts,
elements, aggregate, missingness, save, from-bim-model, sessions),
`/sessions/{id}/save-to-project/`. *(Periferia del módulo; el visor PDF no los usa
directamente — son del flujo CAD/BIM que comparte router.)*

## 5. Contratos clave (schemas — `schemas.py`)
- **`TakeoffMeasurementCreate`**: `project_id`, `document_id?`, `page`, `type`, `group_name`,
  `group_color`, `annotation?`, `points[]`, `measurement_value?`, `measurement_unit`,
  `depth?`, `volume?`, `perimeter?`, `count_value?`, `scale_pixels_per_unit?`,
  `is_deduction`, `linked_boq_position_id?`, `metadata{frontend_id,...}`.
- **`TakeoffMeasurementUpdate`**: parcial; incluye `document_id?` (permite re-key).
- **`TakeoffMeasurementResponse`**: lo anterior + `id`, `created_by/at`, `updated_at`,
  `source`, `confidence?`, `review_status?`.
- **`TakeoffMeasurementBulkCreate`**: `{ measurements: [...] }` (1..2000).
- **`AnalysisResult`** (analyze/extract): `{ elements[], summary{ total_elements, categories } }`.

## 6. Notas de seguridad implementadas
- **IDOR** en todos los list/create/update/delete: `verify_project_access` / `_verify_takeoff_doc_access`.
- **AI1**: el texto del PDF se *fencea* antes de mandarlo al LLM (anti prompt-injection).
- **AI3**: se validan/clampan `quantity`/`unit_rate` del LLM.
- **A2/A9/A11**: descargas de convertidores con allow-list de host, cap de tamaño, O_NOFOLLOW.
