# Workflows — Módulo DWG Takeoff

## WF-01: Subir y Medir un Plano

```
INICIO
  │
  ▼
[Usuario sube .dwg/.dxf]
  │  POST /drawings/upload → project_id, file, name, discipline
  ▼
[Backend guarda archivo → status="uploaded"]
  │
  ├── .dxf → ezdxf parser directo (segundos)
  │
  └── .dwg → DDC DwgExporter (3-8 minutos)
       │
       ▼
[oe_dwg_takeoff_drawing: status="processing"]
  │  Frontend: ConversionProgressCard con elapsed time
  │  Polling cada 3.5s a GET /drawings/{id}
  ▼
[oe_dwg_takeoff_drawing_version creado: status="ready"]
  │  Frontend invalida queries → entidades disponibles
  ▼
[Canvas2D: DxfViewer renderiza entidades]
  │
  ▼
[Usuario calibra escala]
  │  Preset (1:50, 1:100) o 2-point calibration
  │  PATCH /drawings/{id}/scale
  ▼
[Usuario selecciona herramienta]
  │  ToolPalette: Distance (D), Area (A), Polyline (P), etc.
  ▼
[Usuario dibuja sobre el plano]
  │  Click → snap-to-entity → preview → confirm
  ▼
[POST /annotations/ → DwgAnnotation creado]
  │  measurement_value + measurement_unit calculados
  ▼
[Usuario vincula a partida BOQ]
  │  ElementInfoPopover → BOQ picker → POST /annotations/{id}/link-boq
  ▼
[Cantidad fluye al presupuesto 💰]
  │
  ▼
FIN
```

---

## WF-02: Comparar Revisiones

```
INICIO
  │
  ▼
[Usuario sube nueva versión del mismo plano]
  │  Nuevo DwgDrawingVersion: version_number = N+1
  ▼
[Usuario abre Compare Drawer]
  │  Botón GitCompare en toolbar
  ▼
[GET /drawings/{id}/versions/]
  │  Lista de versiones para picker A/B
  ▼
[Usuario selecciona from_version (A) y to_version (B)]
  │
  ▼
[POST /drawings/{id}/compare/{to_version_id}?from_version_id=X]
  │  Backend calcula diff:
  │  - Entidades añadidas/eliminadas/modificadas por capa
  │  - Anotaciones añadidas/eliminadas/modificadas
  │  - Impacto en costo (net_cost_impact de anotaciones vinculadas)
  ▼
[DwgDrawingCompareDrawer muestra diff]
  │  Tabla de entidades: layer, change_type, delta
  │  Tabla de anotaciones: label, measurement delta, cost_impact
  │  Onion-skin overlay: transparencia ajustable
  ▼
[Opcional: Crear VariationRequest]
  │  POST /drawings/{id}/compare/create-variation
  │  → Nuevo VariationRequest en estado DRAFT
  │  → Requiere variations.create + dwg_takeoff.read
  ▼
FIN
```

---

## WF-03: Vinculación Cross-Module (4D/Requirements/Documents)

```
INICIO
  │
  ▼
[Usuario selecciona entidades en el plano]
  │  Click simple = 1 entidad; Shift+click = multi-selección
  ▼
[Click derecho → Context Menu]
  │
  ├── "Create Task" → CreateTaskFromDwgModal
  │     └── POST /tasks → nueva tarea con metadata.dwg_entity_ids
  │
  ├── "Link Activity" → LinkActivityToDwgModal
  │     ├── GET /schedules → lista de cronogramas
  │     ├── GET /schedules/{id}/activities → actividades
  │     └── PATCH /activities/{id} → metadata.dwg_entity_ids merge
  │
  ├── "Link Document" → LinkDocumentToDwgModal
  │     ├── GET /documents → lista de documentos
  │     └── PATCH /documents/{id} → metadata.dwg_entity_ids merge
  │
  └── "Link Requirement" → LinkRequirementToDwgModal
        ├── GET /requirements/sets → requirement sets
        ├── GET /requirements/sets/{id} → requirements
        └── PATCH /requirements/{id} → metadata.dwg_entity_ids merge
  ▼
FIN
```

---

## WF-04: Event Bus — Limpieza de BOQ Links

```
[BOQ Module]
  │
  ▼
[Usuario elimina partida BOQ]
  │
  ▼
[Evento: boq.position.deleted]
  │  payload: { position_id: "uuid" }
  ▼
[DWG Takeoff Event Handler]
  │  events.py: _on_boq_position_deleted()
  │  UPDATE oe_dwg_takeoff_annotation
  │  SET linked_boq_position_id = NULL
  │  WHERE linked_boq_position_id = :deleted_id
  ▼
[Anotaciones huérfanas limpiadas]
  │  Ya no apuntan a partidas inexistentes
  │  Caen a estado "measured but not linked"
```

---

## WF-05: Import desde Documents (Deep Link)

```
[Documents / File Manager]
  │
  ▼
[Usuario hace click en "Open in DWG Takeoff"]
  │  Navega a /dwg-takeoff?docId=<uuid>&docName=<name>
  ▼
[DwgTakeoffPage detecta ?docId=]
  │
  ▼
[POST /drawings/from-document/ { document_id }]
  │  Idempotente: si ya existe drawing → devuelve el existente
  │  Si no existe → crea DwgDrawing, lanza conversión
  ▼
[Selecciona el drawing en el viewer]
  │  Polling hasta status="ready"
  ▼
[Plano abierto para medir]
```
