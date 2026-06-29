# MANIFEST — Framework Mediciones BIM 3D

Framework de Context Engineering del módulo **`oe_bim_hub`** (visor BIM 3D + cuantificación 5D),
generado con `SKILL-PLANIFICADOR-V2.md`. Documenta el módulo **completo** para reconstruirlo o
desarrollarlo con seguridad sin re-analizar el código.

## Identidad
- Backend: `oe_bim_hub` v0.1.0, `category=core`, `depends=["oe_users","oe_projects","oe_boq"]`, auto_install=True.
- API base: `/api/v1/bim_hub/` (58 endpoints). Frontend: `/bim`, `/bim/federations`, `/bim/rules`, `/assets`.
- Visor 3D: Three.js (`frontend/src/shared/ui/BIMViewer/`).
- 8 tablas; permisos `bim.read/create/update/delete` (delete=MANAGER).

## Estructura
```
FRAMEWORK/
├── MANIFEST.md · SYSTEM-INDEX.md · CONTEXT-MAP.md · KNOWLEDGE-GRAPH.md · CHANGELOG.md
├── docs/
│   ├── project · architecture · tech-stack · coding-standards
│   ├── modules/bim-3d/index.md
│   ├── ui/bim-3d.md · ui/buttons/bim-3d.md
│   ├── logic/bim-3d.md · workflows/bim-3d.md
│   ├── api/bim-3d.md · database/bim-3d.md · database/bim-3d-schema.sql
│   ├── components/bim-3d.md · permissions/bim-3d.md · events/bim-3d.md · dependencies/bim-3d.md
├── templates/ · checklists/ · reports/ · metadata/
```

## Alcance / frontera
Este framework documenta el **BIM 3D** (`oe_bim_hub`). El **2D DWG/DXF** tiene su propio framework
(`../../MODULO MEDICIONES DWG/FRAMEWORK/`) y el **PDF** el suyo
(`../../MODULO MEDICIONES PDF/FRAMEWORK-PDF-TAKEOFF/`). dwg/dxf/dgn se excluyen del visor BIM 3D.

## Principios (Planificador)
Nunca inventar; todo respaldado en código; no modificar código; documentación modular para agentes de IA.
