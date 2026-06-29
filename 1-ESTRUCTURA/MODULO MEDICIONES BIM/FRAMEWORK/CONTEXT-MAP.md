# CONTEXT-MAP — Mediciones BIM 3D

> "Si voy a modificar X, ¿qué leo primero?" Cargar el **mínimo** suficiente.

| Tipo de tarea | Leer (en orden) |
|---|---|
| **Cuantificación / BOQ (5D)** | `docs/logic/bim-3d.md` §1-§6 → `docs/api/bim-3d.md` (links, quantity-maps) → `docs/ui/buttons/bim-3d.md` E/F |
| **Medición 3D** | `docs/ui/buttons/bim-3d.md` C → `docs/components/bim-3d.md` (MeasureTool/Manager) → `docs/logic/bim-3d.md` §14 |
| **Visor 3D / herramienta** | `docs/components/bim-3d.md` → `docs/ui/buttons/bim-3d.md` A/B → código `shared/ui/BIMViewer/` |
| **Subida / conversión** | `docs/workflows/bim-3d.md` W1 → `docs/logic/bim-3d.md` §7-§8 → `docs/events/bim-3d.md` |
| **Diff de versiones** | `docs/logic/bim-3d.md` §9 → `docs/api/bim-3d.md` (diff) → `docs/workflows/bim-3d.md` W5 |
| **Federaciones** | `docs/logic/bim-3d.md` §12-§13 → `docs/api/bim-3d.md` (federations) → `docs/ui/bim-3d.md` |
| **Smart views / grupos** | `docs/logic/bim-3d.md` §10-§11 → `docs/api/bim-3d.md` |
| **Cambio de API/BD** | `docs/api/bim-3d.md` → `docs/database/bim-3d.md` (+ `.sql`) → `docs/logic/bim-3d.md` |
| **Permisos** | `docs/permissions/bim-3d.md` → `docs/api/bim-3d.md` |
| **Impacto de un cambio** | `docs/dependencies/bim-3d.md` → `docs/logic/bim-3d.md` → `KNOWLEDGE-GRAPH.md` |
| **Réplica exacta / algoritmos** (medición Newell, sync unit-aware, diff, geometry hash, pipeline IFC) | `docs/logic/bim-3d-internals.md` |
| **Formularios** (Add to BOQ, reglas, activo, subida) | `docs/ui/forms/bim-3d.md` |

Frontera: dwg/dxf/dgn NO son BIM 3D — ver framework DWG. PDF tiene su propio framework.
