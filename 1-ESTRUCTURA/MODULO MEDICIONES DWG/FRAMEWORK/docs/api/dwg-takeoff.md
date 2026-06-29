# API — Módulo DWG Takeoff

## Base URL

`/v1/dwg_takeoff/`

## Autenticación

Bearer token (JWT) requerido en todas las rutas. IDOR protection en cada endpoint.

**Total: 23 endpoints** (8 drawings + 3 versions/compare + 1 layers + 5 annotations +
3 groups + 1 pins + 1 download está contado en drawings + 1 system).

---

## Endpoints

### Drawings

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `POST` | `/drawings/upload/` | `dwg_takeoff.create` | Subir DWG/DXF (multipart). **409** si el `filename` ya existe en el proyecto (DWG-FIX-02) |
| `GET` | `/drawings/?project_id=X` | `dwg_takeoff.read` | Listar planos del proyecto |
| `GET` | `/drawings/{id}` | `dwg_takeoff.read` | Obtener plano (incluye latest_version) |
| `DELETE` | `/drawings/{id}` | `dwg_takeoff.delete` | Eliminar plano + archivo + entidades + thumbnails **+ Document cross-linked del hub** (cascada, DWG-FIX-03) |
| `POST` | `/drawings/from-document/` | `dwg_takeoff.create` | Crear drawing desde Document |
| `PATCH` | `/drawings/{id}/scale/` | `dwg_takeoff.update` | Actualizar escala |
| `GET` | `/drawings/{id}/entities/` | `dwg_takeoff.read` | Entidades parseadas (?layers= filtro) |
| `GET` | `/drawings/{id}/thumbnail/` | `dwg_takeoff.read` | SVG thumbnail |
| `GET` | `/drawings/{id}/download/` | `dwg_takeoff.read` | Descarga el archivo DWG/DXF original (path security check) |

### Drawing Versions

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/drawings/{id}/versions/` | `dwg_takeoff.read` | Listar versiones del plano |
| `POST` | `/drawings/{id}/compare/{to_version_id}` | `dwg_takeoff.read` | Comparar dos versiones |
| `POST` | `/drawings/{id}/compare/create-variation` | `dwg_takeoff.read` + `variations.create` | Crear VariationRequest desde diff |

### Layers

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `PATCH` | `/drawings/{id}/layers` | `dwg_takeoff.update` | Actualizar visibilidad de capas |

### Annotations

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `POST` | `/annotations/` | `dwg_takeoff.create` | Crear anotación |
| `GET` | `/annotations/?drawing_id=X&limit=500` | `dwg_takeoff.read` | Listar anotaciones |
| `PATCH` | `/annotations/{id}` | `dwg_takeoff.update` | Actualizar anotación |
| `DELETE` | `/annotations/{id}` | `dwg_takeoff.delete` | Eliminar anotación |
| `POST` | `/annotations/{id}/link-boq/` | `dwg_takeoff.update` | Vincular a partida BOQ |

### Entity Groups

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `POST` | `/groups/` | `dwg_takeoff.create` | Crear grupo de entidades |
| `GET` | `/groups/?drawing_id=X` | `dwg_takeoff.read` | Listar grupos |
| `DELETE` | `/groups/{id}` | `dwg_takeoff.delete` | Eliminar grupo |

### Pins

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/pins/?drawing_id=X` | `dwg_takeoff.read` | Listar pins (task/punchlist) |

### System

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `GET` | `/offline-readiness/` | `dwg_takeoff.read` | Estado del converter local |

---

## Schemas principales

### DwgDrawingResponse
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "name": "string",
  "filename": "string",
  "file_format": "dxf|dwg",
  "status": "uploaded|processing|ready|empty|needs_conversion|error",
  "discipline": "string|null",
  "scale_denominator": 1.0,
  "scale_mode": "preset|calibrated|per_annotation",
  "thumbnail_key": "string|null",
  "error_message": "string|null",
  "latest_version": { "..." },
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### CreateAnnotationPayload
```json
{
  "project_id": "uuid",
  "drawing_id": "uuid",
  "annotation_type": "distance|area|rectangle|circle|polyline|line|arrow|text_pin",
  "geometry": { "points": [...], "radius": 0 },
  "text": "string|null",
  "color": "#ef4444",
  "thickness": 2.0,
  "layer_name": "USER_MARKUP",
  "measurement_value": 12.5,
  "measurement_unit": "m",
  "scale_override": null
}
```

### DwgDrawingDiffResponse
```json
{
  "drawing_id": "uuid",
  "from_version_id": "uuid",
  "to_version_id": "uuid",
  "entity_rows": [{ "change_type": "added|removed|modified", "entity_id": "...", "layer": "..." }],
  "annotation_rows": [{ "change_type": "...", "annotation_id": "...", "cost_impact": "1500.00" }],
  "summary": {
    "entities": { "added": 5, "removed": 2, "modified": 3, "unchanged": 140 },
    "annotations": { "added": 1, "removed": 0, "modified": 2, "unchanged": 8 },
    "net_cost_impact": "1500.00",
    "cost_currency": "EUR"
  }
}
```

---

## IDOR Protection

Cada endpoint que recibe un ID de recurso pasa por uno de estos gatekeepers:
- `_gate_by_drawing(drawing_id, user_id, service, session)` → verifica proyecto
- `_gate_by_annotation(annotation_id, user_id, service, session)` → verifica proyecto
- `_gate_by_group(group_id, user_id, service, session)` → verifica proyecto

404 indistinguible para recursos inexistentes y no autorizados — sin fuga de información.
