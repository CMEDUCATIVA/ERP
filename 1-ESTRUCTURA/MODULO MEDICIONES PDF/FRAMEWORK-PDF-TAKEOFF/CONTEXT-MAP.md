# CONTEXT-MAP — PDF Takeoff

> "Si voy a modificar X, ¿qué leo primero?" Cargar el **mínimo** suficiente.

| Tipo de tarea | Leer (en orden) |
|---|---|
| **Bug de persistencia** (no se ven/no guardan/reaparecen al refrescar) | `docs/logic/pdf-takeoff.md` §3-§5 → `docs/components/pdf-takeoff.md` (hook) → código `useMeasurementPersistence.ts` |
| **Botón / acción UI** | `docs/ui/buttons/pdf-takeoff.md` → `docs/ui/pdf-takeoff.md` → código `TakeoffViewerModule.tsx`/`TakeoffPage.tsx` |
| **Nueva herramienta de medición** | `docs/logic/pdf-takeoff.md` §1-§2 → `docs/ui/buttons/pdf-takeoff.md` A.3/A.4 → `scale-helpers.ts` |
| **Cambio de API/medición** | `docs/api/pdf-takeoff.md` → `docs/database/pdf-takeoff.md` → `docs/logic/pdf-takeoff.md` |
| **Cambio de BD** | `docs/database/pdf-takeoff.md` → `docs/api/pdf-takeoff.md` → `docs/logic/pdf-takeoff.md` |
| **IA (analyze/recognize/plan-read)** | `docs/workflows/pdf-takeoff.md` W5-W7 → `docs/api/pdf-takeoff.md` §1/§3 → `docs/logic/pdf-takeoff.md` §7 |
| **BOQ link** | `docs/workflows/pdf-takeoff.md` W3 → `docs/ui/buttons/pdf-takeoff.md` D → `docs/dependencies/pdf-takeoff.md` |
| **Permisos** | `docs/permissions/pdf-takeoff.md` → `docs/api/pdf-takeoff.md` |
| **Reconstruir el módulo entero** | `docs/modules/pdf-takeoff/index.md` → `reports/pdf-takeoff-rebuild-spec.md` → todos los `docs/*/pdf-takeoff.md` |
| **Réplica exacta / algoritmos** (escala 72dpi, recompute B8, reconstrucción de label, dual-key, reconocimiento) | `docs/logic/pdf-takeoff-internals.md` |
| **Borrado (medición/documento)** | `docs/logic/pdf-takeoff.md` §4-§5 → `docs/workflows/pdf-takeoff.md` W4 |

Regla: no abras DWG (`oe_dwg_takeoff`); es otro módulo, otro framework.
