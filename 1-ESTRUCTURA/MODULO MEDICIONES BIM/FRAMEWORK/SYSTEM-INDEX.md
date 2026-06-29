# SYSTEM-INDEX — Mediciones BIM 3D (inventario completo)

> Última actualización: 2026-06-28. Módulo `oe_bim_hub` (BIM 3D + cuantificación 5D).

## Documentos del framework
| Documento | Ubicación |
|---|---|
| Proyecto / Arquitectura / Tech-Stack / Coding-Standards | `docs/project.md`, `docs/architecture.md`, `docs/tech-stack.md`, `docs/coding-standards.md` |
| Módulo (índice) | `docs/modules/bim-3d/index.md` |
| UI / pantallas | `docs/ui/bim-3d.md` |
| **Botones / Herramientas** | `docs/ui/buttons/bim-3d.md` |
| Formularios | `docs/ui/forms/bim-3d.md` |
| Lógica de negocio (reglas) | `docs/logic/bim-3d.md` |
| **Algoritmos internos (réplica exacta)** | `docs/logic/bim-3d-internals.md` |
| Workflows | `docs/workflows/bim-3d.md` |
| API | `docs/api/bim-3d.md` |
| Base de datos (descriptivo) | `docs/database/bim-3d.md` |
| **Base de datos (DDL SQL)** | `docs/database/bim-3d-schema.sql` |
| Componentes | `docs/components/bim-3d.md` |
| Permisos | `docs/permissions/bim-3d.md` |
| Eventos / Jobs | `docs/events/bim-3d.md` |
| Dependencias | `docs/dependencies/bim-3d.md` |
| Auditoría | `reports/audit-2026-06-28.md` |

## Código de origen
**Backend** `backend/app/modules/bim_hub/`: manifest.py, models.py (8 tablas), schemas.py (1210),
router.py (5071, 58 endpoints), service.py (3958), repository.py (567), ifc_processor.py (4002),
smart_views.py (736), dataframe_store.py (370), file_storage.py (442), ddc_extras.py (465),
vector_adapter.py (102), events.py, permissions.py, seed.py.
**Frontend** `frontend/src/features/bim/` (~40 archivos) + `frontend/src/shared/ui/BIMViewer/` (~30 archivos).

## Tablas (8)
`oe_bim_model`, `oe_bim_element`, `oe_bim_boq_link`, `oe_bim_quantity_map`, `oe_bim_model_diff`,
`oe_bim_element_group`, `oe_bim_federation`, `oe_bim_federation_model`.

## Endpoints (58) — base `/api/v1/bim_hub/`
modelos/subida, elementos/activos, cuantificación/BOQ (links + quantity-maps/apply), grupos,
smart-views, vector, diff, dataframe (DuckDB), federaciones (+health/type-tree/snapshots), export COBie.

## Frontend
Rutas: `/bim`, `/bim/:modelId`, `/bim/federations`, `/bim/rules`, `/assets`, `/projects/:pid/bim`.
Visor 3D (Three.js): herramientas sección/walk/medir + ViewCube; 5 pestañas (Properties/Layers/Tools/Groups/Color).

## Permisos
`bim.read` (VIEWER) · `create`/`update` (EDITOR) · `delete` (MANAGER).

## Eventos
`bim_hub.element.created/updated/deleted` → índice vectorial. Async: conversión DDC, Parquet, PDF, cleanup.
