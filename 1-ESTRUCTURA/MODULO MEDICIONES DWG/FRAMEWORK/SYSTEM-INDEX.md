# SYSTEM-INDEX — DWG Takeoff (inventario completo)

> Última actualización: 2026-06-28. Framework del módulo **`oe_dwg_takeoff`** (Mediciones DWG).
> Nota: este framework documenta **solo DWG/DXF**. El módulo PDF (`oe_takeoff`) tiene su
> propio framework en `../../MODULO MEDICIONES PDF/FRAMEWORK-PDF-TAKEOFF/`.

## Documentos del framework
| Documento | Ubicación |
|---|---|
| Proyecto | `docs/project.md` |
| Arquitectura | `docs/architecture.md` |
| Tech Stack | `docs/tech-stack.md` |
| Coding Standards | `docs/coding-standards.md` |
| Módulo (índice) | `docs/modules/dwg-takeoff/index.md` |
| UI / pantallas | `docs/ui/dwg-takeoff.md` |
| **Botones (catálogo)** | `docs/ui/buttons/dwg-takeoff.md` |
| Lógica de negocio (reglas) | `docs/logic/dwg-takeoff.md` |
| **Algoritmos internos (réplica exacta)** | `docs/logic/dwg-takeoff-internals.md` |
| Workflows | `docs/workflows/dwg-takeoff.md` |
| API | `docs/api/dwg-takeoff.md` |
| Base de datos (descriptivo) | `docs/database/dwg-takeoff.md` |
| **Base de datos (DDL SQL)** | `docs/database/dwg-takeoff-schema.sql` |
| Componentes | `docs/components/dwg-takeoff.md` |
| Permisos | `docs/permissions/dwg-takeoff.md` |
| Dependencias | `docs/dependencies/dwg-takeoff.md` |
| Eventos/Jobs | `docs/events/dwg-takeoff.md` |
| Auditoría | `reports/audit-2026-07-17.md`, `reports/analysis-2026-06-28.md` |

## Identidad
`oe_dwg_takeoff` v1.0.0 · `category=extension` · `depends=["oe_projects"]` ·
**auto_install=True** · ruta frontend `/dwg-takeoff`.

## Archivos de código (origen)
**Backend** `backend/app/modules/dwg_takeoff/`: `manifest.py` (16), `models.py` (227),
`schemas.py` (406), `router.py` (938, 23 endpoints), `service.py` (2294),
`repository.py` (243), `permissions.py` (16), `events.py` (100),
`dxf_processor.py` (433, parser DXF ezdxf), `ddc_dwg_parser.py` (912, DWG→DXF vía DDC).

**Frontend** `frontend/src/features/dwg-takeoff/`: `DwgTakeoffPage.tsx` (6116),
`api.ts` (584), `DwgDrawingCompareDrawer.tsx`, `CreateTaskFromDwgModal.tsx`,
`LinkActivityToDwgModal.tsx`, `LinkDocumentToDwgModal.tsx`, `LinkRequirementToDwgModal.tsx`,
`dwgTakeoffGuide.ts`, y `components/{ToolPalette,DxfViewer,LayerPanel,CalibrationDialog,SheetStrip,…}`,
`lib/{measurement,calibration,dxf-renderer,viewport,snap,undo-stack,pdf-export}.ts`.
Global: `stores/useDwgUploadStore.ts`, `shared/ui/DwgUploadIndicator.tsx`.

## Tablas (4)
`oe_dwg_takeoff_drawing`, `oe_dwg_takeoff_drawing_version`, `oe_dwg_takeoff_annotation`,
`oe_dwg_entity_group` (RFC 11). FKs reales a `oe_projects_project` (CASCADE).

## Endpoints (23) — base `/v1/dwg_takeoff/`
drawings (8: upload, from-document, list, get, delete, entities, thumbnail, download),
versions/compare (3: versions, compare/{ver}, compare/create-variation), layers (1),
annotations (5: create, list, patch, delete, link-boq), groups (3), pins (1), offline-readiness (1).
Detalle en `docs/api/dwg-takeoff.md`.

## Herramientas frontend (11) y pestañas (5)
Tools: select, pan, distance, line, polyline, area, rectangle, circle, arrow, text_pin, calibrate.
Tabs panel derecho: Layers · Annotations · Properties · Scale · Summary.

## Permisos
`dwg_takeoff.read` (VIEWER) · `create` (EDITOR) · `update` (EDITOR) · **`delete` (MANAGER)**
(+ `variations.create` para create-variation).

## Eventos
Suscribe **`boq.position.deleted`** → limpia `linked_boq_position_id` colgante (idempotente,
no-throw). Tarea async: conversión DWG→DXF en background (poll de estado).

## Integraciones cross-módulo
BOQ (link + push cantidad), **Tasks** (new task), **Documents** (link), **Schedule** (link
activity), **Requirements** (link), **Variations** (create-variation desde diff), Punchlist
(`linked_punch_item_id`), converters DDC compartidos con BIM/`oe_takeoff`.

## Templates (5) y checklists
Templates: `module`, `api`, `ui`, `workflow`, `logic`. Checklists: ver `checklists/README.md`.
