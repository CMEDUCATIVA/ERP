# Base de Datos — Módulo DWG Takeoff

> **DDL SQL estructurado** (CREATE TABLE + índices + FKs): [`dwg-takeoff-schema.sql`](dwg-takeoff-schema.sql).
> Modelos en `backend/app/modules/dwg_takeoff/models.py`. Abajo, descripción de columnas.

## Tablas

### 1. `oe_dwg_takeoff_drawing`

Plano CAD subido al sistema.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | Identificador único |
| `project_id` | UUID (FK → oe_projects_project.id) | Proyecto al que pertenece (CASCADE) |
| `name` | String(500) | Nombre descriptivo |
| `filename` | String(500) | Nombre del archivo original |
| `file_format` | String(10) | `dxf` o `dwg` |
| `file_path` | String(1000) | Ruta en disco |
| `size_bytes` | Integer | Tamaño del archivo |
| `status` | String(50) | `uploaded`, `processing`, `ready`, `empty`, `needs_conversion`, `error` |
| `discipline` | String(100) nullable | Disciplina (architectural, structural, etc.) |
| `sheet_number` | String(100) nullable | Número de lámina |
| `thumbnail_key` | String(500) nullable | Clave del thumbnail SVG |
| `error_message` | Text nullable | Mensaje de error cuando status=error |
| `scale_denominator` | Numeric(10,6) | Escala del plano (1.0 = sin escala) |
| `scale_mode` | String(30) | `preset`, `calibrated`, `per_annotation` |
| `metadata` | JSON | Metadatos extensibles |
| `created_by` | String(255) | Usuario creador |
| `created_at` | DateTime | Fecha de creación |
| `updated_at` | DateTime | Fecha de actualización |

**Índices**: `ix_dwg_drawing_project_status` (project_id, status)

---

### 2. `oe_dwg_takeoff_drawing_version`

Versión parseada de un plano (entidades extraídas).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | Identificador único |
| `drawing_id` | UUID (FK → oe_dwg_takeoff_drawing.id) | Plano padre (CASCADE) |
| `version_number` | Integer | Número secuencial de versión |
| `layers` | JSON | Lista de capas detectadas |
| `entities_key` | String(500) nullable | Ruta al archivo de entidades en disco |
| `entity_count` | Integer | Número de entidades |
| `extents` | JSON | Extensiones del dibujo (bounding box) |
| `units` | String(50) nullable | Unidad DXF (`mm`, `cm`, `m`, `inches`, `feet`) |
| `status` | String(50) | `processing`, `ready` |
| `metadata` | JSON | Metadatos extensibles |
| `created_at` | DateTime | Fecha de creación |
| `updated_at` | DateTime | Fecha de actualización |

---

### 3. `oe_dwg_takeoff_annotation`

Anotaciones/mediciones del usuario sobre el plano.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | Identificador único |
| `project_id` | UUID (FK → oe_projects_project.id) | Proyecto (CASCADE) |
| `drawing_id` | UUID (FK → oe_dwg_takeoff_drawing.id) | Plano (CASCADE) |
| `drawing_version_id` | UUID nullable (FK → oe_dwg_takeoff_drawing_version.id) | Versión (SET NULL) |
| `annotation_type` | String(50) | Tipo: `distance`, `area`, `rectangle`, `circle`, `polyline`, `line`, `arrow`, `text_pin` |
| `geometry` | JSON | Geometría (puntos, radio, etc.) |
| `text` | Text nullable | Texto de la anotación |
| `color` | String(20) | Color hex |
| `line_width` | Integer | Grosor de línea (legacy int) |
| `thickness` | Numeric(10,6) | Grosor de línea (float) |
| `layer_name` | String(100) | Capa virtual (default: `USER_MARKUP`) |
| `measurement_value` | Numeric(18,6) nullable | Valor medido |
| `measurement_unit` | String(20) nullable | Unidad (`m`, `m2`) |
| `scale_override` | Numeric(10,6) nullable | Escala específica de la anotación |
| **CROSS-MODULE LINKS** | | |
| `linked_boq_position_id` | String(255) nullable | → Partida BOQ |
| `linked_task_id` | String(255) nullable | → Actividad de cronograma |
| `linked_punch_item_id` | String(255) nullable | → Punch item |
| `created_by` | String(255) | Usuario creador |
| `metadata` | JSON | Metadatos extensibles |
| `created_at` | DateTime | Fecha de creación |
| `updated_at` | DateTime | Fecha de actualización |

**Índices**:
- `ix_dwg_annotation_drawing_type` (drawing_id, annotation_type)
- `ix_dwg_annotation_linked_task` (linked_task_id)
- `ix_dwg_annotation_linked_punch` (linked_punch_item_id)

---

### 4. `oe_dwg_entity_group`

Grupos de entidades guardados (selección múltiple).

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | UUID (PK) | Identificador único |
| `drawing_id` | UUID (FK → oe_dwg_takeoff_drawing.id) | Plano (CASCADE) |
| `name` | String(200) | Nombre del grupo |
| `entity_ids` | JSON | Lista de IDs de entidades |
| `metadata` | JSON | Metadatos extensibles |
| `created_by` | String(255) | Usuario creador |
| `created_at` | DateTime | Fecha de creación |
| `updated_at` | DateTime | Fecha de actualización |

**Índices**: `ix_dwg_entity_group_drawing` (drawing_id)

---

## Relaciones

```
oe_projects_project (1) ──CASCADE── (N) oe_dwg_takeoff_drawing
                                          │
                                          │ 1:N (CASCADE)
                                          ▼
                                oe_dwg_takeoff_drawing_version
                                          │
                                          │ 1:N (SET NULL)
                                          ▼
                                oe_dwg_takeoff_annotation ──→ BOQ position (string link)
                                                          ──→ Schedule activity (string link)
                                                          ──→ Punchlist item (string link)
                                          │
                                          │ 1:N (CASCADE)
                                          ▼
                                oe_dwg_entity_group
```

## Notas de diseño

- **Numeric(18,6)** para mediciones — evita deriva de punto flotante en sumas acumulativas
- **Numeric(10,6)** para escalas/grosores — precisión suficiente sin overhead
- Los cross-module links son `String(255)`, no UUID FKs — flexibilidad de acoplamiento laxo
- El event listener `boq.position.deleted` limpia `linked_boq_position_id` en anotaciones huérfanas
