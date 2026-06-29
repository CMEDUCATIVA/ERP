# SYSTEM-INDEX — PDF Takeoff (inventario completo)

> Última actualización: 2026-06-28. Solo módulo `oe_takeoff` (Mediciones PDF).

## Documentos del framework
| Documento | Ubicación |
|---|---|
| Proyecto | `docs/project.md` |
| Arquitectura | `docs/architecture.md` |
| Tech Stack | `docs/tech-stack.md` |
| Coding Standards | `docs/coding-standards.md` |
| Módulo (índice/spec) | `docs/modules/pdf-takeoff/index.md` |
| UI / pantallas | `docs/ui/pdf-takeoff.md` |
| **Botones (catálogo)** | `docs/ui/buttons/pdf-takeoff.md` |
| Formularios | `docs/ui/forms/pdf-takeoff.md` |
| Lógica de negocio (reglas) | `docs/logic/pdf-takeoff.md` |
| **Algoritmos internos (réplica exacta)** | `docs/logic/pdf-takeoff-internals.md` |
| Workflows | `docs/workflows/pdf-takeoff.md` |
| API | `docs/api/pdf-takeoff.md` |
| Base de datos (descriptivo) | `docs/database/pdf-takeoff.md` |
| **Base de datos (DDL SQL)** | `docs/database/pdf-takeoff-schema.sql` |
| Componentes | `docs/components/pdf-takeoff.md` |
| Permisos | `docs/permissions/pdf-takeoff.md` |
| Dependencias | `docs/dependencies/pdf-takeoff.md` |
| Eventos/Jobs | `docs/events/pdf-takeoff.md` |
| Spec reconstrucción | `reports/pdf-takeoff-rebuild-spec.md` |
| Auditoría | `reports/audit-2026-06-28.md` |

## Archivos de código (origen)
**Backend** `backend/app/modules/takeoff/`: manifest.py, models.py, schemas.py, router.py,
service.py, repository.py, plan_read.py, recognize.py, raster_recognize.py, manifest_verifier.py.
**Frontend**: `features/takeoff/TakeoffPage.tsx`, `features/takeoff/api.ts`,
`features/takeoff/lib/{takeoff-groups,takeoff-shortcuts}.ts`,
`features/takeoff/components/{CalibrationDialog,MeasurementLedger}.tsx`,
`features/takeoff/takeoffGuide.ts`, `modules/pdf-takeoff/{TakeoffViewerModule,manifest,useMeasurementPersistence}.ts(x)`,
`modules/pdf-takeoff/data/{page-scales,scale-helpers}.ts`.

## Tablas (4)
`oe_takeoff_document`, `oe_takeoff_measurement`, `oe_ai_takeoff_run`, `oe_takeoff_cad_session`.

## Endpoints (~47) — base `/api/v1/takeoff/`
documents (8), measurements (11), plan-read (5), recognize (1), converters (6), cad-data/cad-group (15+).
Detalle en `docs/api/pdf-takeoff.md`.

## Permisos
`takeoff.read|create|update|delete` (+ `variations.create`).

## Rutas frontend
`/takeoff` (página) · `/takeoff-viewer` (módulo `pdf-takeoff`).
