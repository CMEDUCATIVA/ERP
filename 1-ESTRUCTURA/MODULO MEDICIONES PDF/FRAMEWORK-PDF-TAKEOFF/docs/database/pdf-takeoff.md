# Base de datos — PDF Takeoff

> Modelos en `backend/app/modules/takeoff/models.py`. SQLAlchemy async + PostgreSQL.
> **DDL SQL estructurado** (CREATE TABLE + índices + FKs): [`pdf-takeoff-schema.sql`](pdf-takeoff-schema.sql).
> Abajo, descripción de columnas. **FKs**: `document/measurement/ai_run.project_id` →
> `oe_projects_project` (ON DELETE CASCADE); `document.owner_id` → `oe_users_user`.
> `measurement.document_id` NO tiene FK (clave por filename o UUID).

---

## 1. `oe_takeoff_document` — PDF subido
| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `filename` | String(500) | nombre del archivo |
| `pages` | Integer | nº de páginas |
| `size_bytes` | Integer | tamaño |
| `content_type` | String(100) | `application/pdf` |
| `status` | String | estado de procesamiento |
| `project_id` | UUID (index) | proyecto (nullable en datos legacy) |
| `owner_id` | UUID (index) | dueño |
| `file_path` | String(1000) | ruta en disco del PDF |
| `extracted_text` | Text | **texto extraído** (lo usa "Analizar con IA") |
| `page_data` | JSON list | metadatos por página (capa de texto, etc.) |
| `analysis` | JSON dict | último análisis IA |
| `metadata_` | JSON dict | extra |
| `created_at` / `updated_at` | DateTime | |

## 2. `oe_takeoff_measurement` — medición/anotación
> **`document_id` es `String(255)` SIN FK** → clave de persistencia por **nombre** o UUID
> (ver [logic](pdf-takeoff.md)). Por eso el borrado de documento NO cascada por FK: se
> hace explícito en el servicio.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `project_id` | UUID (index) | |
| `document_id` | **String(255) (index), nullable** | UUID del doc **o** filename |
| `page` | Integer | 1-indexed |
| `type` | String(50) | distance, polyline, area, volume, count, cloud, arrow, text, rectangle, highlight |
| `group_name` | String(100) | grupo de color (default `General`) |
| `group_color` | String(20) | hex (default `#3B82F6`) |
| `annotation` | String(500) | **nombre** editable ("Distance 2") |
| `points` | JSON list | `[{x,y},...]` |
| `measurement_value` | Numeric | cantidad principal (recalc server-side B8) |
| `measurement_unit` | String(20) | `m` / `m2` / `m3` / `pcs` (canónico) |
| `depth` | Numeric | profundidad (volumen) |
| `volume` | Numeric | volumen |
| `perimeter` | Numeric | perímetro (área/polilínea) |
| `count_value` | Integer | conteo |
| `is_deduction` | Boolean | área vacía (resta del total del grupo) |
| `scale_pixels_per_unit` | Float | calibración de la página al crear |
| `linked_boq_position_id` | String(255) | posición BOQ vinculada |
| `source` | String | `manual` / `ai_plan_read` |
| `confidence` | Float | confianza IA (si aplica) |
| `review_status` | String | `confirmed` / `proposed` / `rejected` |
| `metadata_` | JSON dict | incluye `frontend_id`, `area`, `text`, `width`, `height`, `linked_boq_id`, `linked_position_ordinal`, `linked_position_label` |
| `created_by` | String(255) | |
| `created_at` / `updated_at` | DateTime | |

## 3. `oe_ai_takeoff_run` — corrida de lectura de plano por IA
`id`, `project_id`, `document_id` (String 255), `page`, `mode` (`rooms`...), `user_id`,
`status` (`queued`...), `scale_pixels_per_unit`, `do_cost_match`, `provider`,
`model_used`, `total_tokens`, `cost_usd_estimate`, `duration_ms`, `proposal_count`,
`accepted_count`, `validation_report` JSON, `failure_reason`, `metadata_`.

## 4. `oe_takeoff_cad_session` — sesión de extracción CAD (periferia)
`session_id` (unique), `user_id`, `filename`, `file_format` (rvt/ifc/dwg/dgn),
`element_count`, `elements_data` JSON, `columns_metadata` JSON, `project_id`,
`display_name`, `is_permanent`, `expires_at`, `session_ttl_days`, `bim_model_id`.

## 5. Relaciones (lógicas, sin FK formal salvo proyecto/owner)
```
oe_takeoff_document (id, filename) ◄┄┄ (por convención, no FK)
        ▲                                  oe_takeoff_measurement.document_id
        │                                    (= document UUID  O  = filename)
oe_ai_takeoff_run.document_id ┄┄┄┘
oe_takeoff_measurement.linked_boq_position_id ──▶ oe_boq_position.id (BOQ)
```
- `measurement.project_id` ↔ proyecto activo (gateado por permisos).
- `measurement.linked_boq_position_id` → posición del presupuesto (módulo BOQ).
- El **cross-link** con el hub de Documentos (`oe_documents_document`) se mantiene
  best-effort desde el router (upload/list/delete).
