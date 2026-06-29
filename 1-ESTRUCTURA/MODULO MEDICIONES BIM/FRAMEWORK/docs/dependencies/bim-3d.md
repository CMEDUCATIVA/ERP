# Dependencias — Mediciones BIM 3D

## Dependencias del manifest (obligatorias)
`oe_bim_hub` `depends=["oe_users", "oe_projects", "oe_boq"]`.
- **oe_projects** — todo recurso pertenece a un proyecto (IDOR gate).
- **oe_users** — `created_by`, permisos/roles.
- **oe_boq** — las cantidades se vinculan a posiciones del presupuesto (5D).

## Integraciones (acoplamiento lógico)
| Con | Cómo | Dirección |
|---|---|---|
| **BOQ** | `BOQElementLink.boq_position_id`; `apply_quantity_maps` crea/sincroniza posiciones; `_sync_boq_quantity_from_links` | BIM → BOQ |
| **Schedule (4D)** | `LinkActivityToBIMModal`; fechas en elemento → `use4dTimeline`; cleanup de links huérfanos | BIM ↔ Schedule |
| **Tasks** | `CreateTaskFromBIMModal`; cleanup de refs | BIM → Tasks |
| **Documents** | `LinkDocumentToBIMModal`; modo color `document_coverage` | BIM → Documents |
| **Requirements** | `LinkRequirementToBIMModal`; modo color `validation` | BIM → Requirements |
| **Validation** | pasada de validación al importar (`ValidationReportRepository`) | BIM → Validation |
| **Progress** | porcentaje de avance por elemento (`current_pct`) → modo color `by_progress` | Progress → BIM |
| **Vector store / IA** | índice `oe_bim_elements` (búsqueda semántica) | BIM → Vector |
| **Takeoff/CAD converters** | DDC cad2data (compartido con DWG/PDF takeoff) | BIM → converters |
| **DWG Takeoff** | dwg/dxf/dgn se **excluyen** del BIM 3D y van al módulo DWG | frontera |

## Dependencias técnicas (recrear)
- **Backend**: FastAPI, SQLAlchemy async, PostgreSQL; **DDC cad2data** (converters RVT/IFC), parser
  STEP propio (`ifc_processor`), **pyarrow + DuckDB** (Parquet), vector store, COBie exporter.
- **Frontend**: React + TS, **Three.js** (visor 3D), React Query, Zustand, GLB/DAE loaders.

## Impacto de cambios
| Si cambias… | Revisa… |
|---|---|
| `element.quantities` (claves) | extracción de cantidad, push BOQ, modos de color, smart views |
| `_sync_boq_quantity_from_links` | integridad de cantidad/costo del BOQ |
| `apply_quantity_maps` / validación de regla | linking masivo, posiciones auto-creadas, confidence |
| `stable_id` / `geometry_hash` | diff de versiones, emparejado fila↔malla |
| `is_non_3d_format` | qué modelos entran al visor 3D (frontera con DWG) |
| Formato de geometría (GLB/DAE) | `BIMViewer`, carga, magic-bytes |
| Esquema de federación | `FederatedViewer`, health, type-tree, snapshots |
