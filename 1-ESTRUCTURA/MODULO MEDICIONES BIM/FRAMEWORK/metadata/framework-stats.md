# Metadata — Framework Mediciones BIM 3D

| Campo | Valor |
|---|---|
| **framework_version** | 1.1.0 |
| **created_at** | 2026-06-28 |
| **updated_at** | 2026-06-28 (v1.1.0: WebGL fix + cabecera con menús + panel ayuda flotante) |
| **created_by** | Skill Planificador V2.0 |
| **módulo** | `oe_bim_hub` (BIM 3D + cuantificación 5D) |
| **source_code** | `backend/app/modules/bim_hub/`, `frontend/src/features/bim/`, `frontend/src/shared/ui/BIMViewer/` |
| **workspace** | `1-ESTRUCTURA/MODULO MEDICIONES BIM/FRAMEWORK/` |

## Estadísticas
| Métrica | Valor |
|---|---|
| Documentos | 5 raíz + 16 docs (incl. internals + forms) + 3 templates + 1 checklist + 1 report + este |
| Tablas | 8 |
| Endpoints | **58** (verificado: 26 GET, 22 POST, 4 PATCH, 5 DELETE, 1 PUT) |
| Reglas de negocio | 16 + internals |
| Workflows | 9 |
| Permisos | 4 (`bim.read/create/update/delete`, delete=MANAGER) |
| Backend | ~17.8k líneas (router 5071, ifc_processor 4002, service 3958, schemas 1210…) |
| Frontend | ~40 archivos `features/bim` + ~30 `shared/ui/BIMViewer` (Three.js) |

## Frontera con otros frameworks
- **DWG 2D**: `../../MODULO MEDICIONES DWG/FRAMEWORK/` (dwg/dxf/dgn excluidos del BIM 3D).
- **PDF**: `../../MODULO MEDICIONES PDF/FRAMEWORK-PDF-TAKEOFF/`.

## Cambios en v1.1.0 (sesión 2026-06-28)
- **Fix WebGL** "3D view unavailable" (born-lost context): `forceContextLoss()` condicional a
  `liveWebGLContexts ≥ 6` en `SceneManager.dispose()` (ver `docs/logic/bim-3d-internals.md §10`).
- **Cabecera BIMPage** → fila única con menús agrupados; nuevos `features/bim/HeaderMenu.tsx` y
  `features/bim/BIMHelpPanel.tsx` (intro flotante). Tour/guía reapuntados a los disparadores de menú.
- Apilamiento z-index (cabecera/menús `z-50`, ayuda `z-40`); nombre de modelo truncado a 12.
- Docs tocados: CHANGELOG, `ui/buttons/bim-3d.md` (§0/§0b), `ui/bim-3d.md`, `components/bim-3d.md`,
  `logic/bim-3d-internals.md` (§10).

## Completado en v1.0 (antes pendiente)
- ✅ `docs/logic/bim-3d-internals.md` (algoritmos: medición Newell, sync unit-aware, diff, geometry hash, pipeline IFC).
- ✅ `docs/ui/forms/bim-3d.md` (formularios).
- ✅ Conteo de endpoints verificado contra `router.py` (**58**).

## Pendiente opcional
- Verificación línea-a-línea del cuerpo de `ifc_processor.py` (4002) / `service.py` (3958) para réplica al 100%.
- Auditoría i18n al español del módulo BIM.
