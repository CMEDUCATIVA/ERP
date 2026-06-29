# Dependencias — Módulo DWG Takeoff

## Grafo de dependencias

```
                    ┌──────────────┐
                    │  oe_projects │  ← Dependencia obligatoria (Manifest)
                    └──────┬───────┘
                           │ CASCADE
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │ dwg_takeoff│  │   boq      │  │  documents │
   └─────┬──────┘  └─────┬──────┘  └─────┬──────┘
         │               │               │
         │ linked_boq    │               │ from-document
         │ _position_id  │               │ deep-link
         │               │               │
         ▼               ▼               ▼
   ┌─────────────────────────────────────────┐
   │         oe_dwg_takeoff_annotation       │
   │  ┌──────────────────────────────────┐   │
   │  │ linked_boq_position_id → boq     │   │
   │  │ linked_task_id → schedule        │   │
   │  │ linked_punch_item_id → punchlist │   │
   │  └──────────────────────────────────┘   │
   └─────────────────────────────────────────┘
         │               │               │
         ▼               ▼               ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ schedule │  │punchlist │  │variations│
   └──────────┘  └──────────┘  └────┬─────┘
                                     │
                                     │ POST compare/create-variation
                                     ▼
                              ┌────────────┐
                              │ Variation  │
                              │ Request    │
                              └────────────┘

Módulos consumidores (leen DwgAnnotation):
   ┌──────────────┐  ┌────────────────┐
   │ ai_estimator │  │ match_elements │
   └──────────────┘  └────────────────┘
```

## Matriz de dependencias

| Módulo | Tipo | Dirección | Mecanismo |
|---|---|---|---|
| `oe_projects` | Hard (FK CASCADE) | ← depende | Manifest `depends=["oe_projects"]` |
| `boq` | Soft (string link) | → vinculado | `linked_boq_position_id` + event `boq.position.deleted` |
| `schedule` | Soft (string link) | → vinculado | `linked_task_id` + `LinkActivityToDwgModal` |
| `punchlist` | Soft (string link) | → vinculado | `linked_punch_item_id` |
| `documents` | Soft (API) | ← → bidireccional | `POST /from-document/` + `LinkDocumentToDwgModal` |
| `bim_requirements` | Soft (metadata) | → vinculado | `LinkRequirementToDwgModal` |
| `variations` | Soft (API) | → produce | `POST /compare/create-variation` |
| `ai_estimator` | Soft (import) | ← consume | `extractors.py` importa `DwgAnnotation` |
| `match_elements` | Soft (adapter) | ← consume | `dwg_adapter.py` lee datos de conversión |
| `takeoff/cad` | Soft (shared infra) | ← depende | `ddc_dwg_parser.py`, `CadExtractionSession` |
| `bim_hub` | Conceptual (hermano) | ↔ mismo grupo | Sidebar grouping, mismo patrón de upload |

## Impacto de cambios

| Cambio en... | Impacta a... |
|---|---|
| `DwgDrawing` schema | `versions`, `annotations`, `entity_groups`, `documents` deep-link |
| `DwgAnnotation.geometry` | Renderizado canvas (frontend), AI estimator, BOQ linking |
| `DwgAnnotation.linked_boq_position_id` | BOQ rollups, event cleanup |
| `scale_denominator` | TODAS las mediciones (multiplicador global) |
| `unitFactorToMetres()` | TODAS las mediciones (conversión de unidades) |
| `ddc_dwg_parser.py` | Pipeline de conversión, CadExtractionSession, match_elements |
| `router.py` endpoints | Frontend api.ts, todos los consumidores REST |
