# Metadatos del Framework

## Información general

| Campo | Valor |
|---|---|
| **framework_version** | 1.2.0 |
| **created_at** | 2026-07-17 |
| **updated_at** | 2026-06-28 (DWG 1.2.0: bugfixes lock/duplicado/cascada/layouts + UX ojo-toggle + i18n español) |
| **created_by** | Skill Planificador V2.0 (Kun) |
| **project** | ERP-DEEP (OpenConstructionERP) |
| **workspace** | `1-ESTRUCTURA/MODULO MEDICIONES DWG/FRAMEWORK/` |
| **source_code** | `backend/app/modules/dwg_takeoff/`, `frontend/src/features/dwg-takeoff/` |

## Estadísticas

| Métrica | Valor |
|---|---|
| **Módulos totales** | ~100+ (backend/app/modules/) |
| **Módulos documentados** | 1 (dwg-takeoff) |
| **Documentos creados** | 21 archivos .md (incl. catálogo de botones) |
| **Templates** | 5 |
| **Checklists** | `checklists/README.md` |
| **Reglas de negocio** | 14 (10 + 4 nuevas: lock-conversión, unicidad, cascada-borrado, BlockId≠layout) |
| **Workflows** | 5 |
| **Endpoints documentados** | 23 (verificados contra `router.py`) |
| **Tablas documentadas** | 4 |
| **Herramientas de dibujo** | 11 · **Pestañas panel** | 5 |

## Estado de cobertura

| Categoría | Total | Documentado | % |
|---|---|---|---|
| Módulos | ~100 | 1 | 1% |
| Pantallas | ~50+ | 1 | 2% |
| Tablas | ~200+ | 4 | 2% |
| APIs | ~500+ | 22 | 4% |

## Próximos pasos

1. Documentar módulo `boq` (Presupuesto)
2. Documentar módulo `bim_hub` (BIM 3D)
3. Documentar módulo `takeoff` (Mediciones PDF/CAD)
4. Documentar módulo `documents` (CDE)
5. Expandir cobertura progresivamente
