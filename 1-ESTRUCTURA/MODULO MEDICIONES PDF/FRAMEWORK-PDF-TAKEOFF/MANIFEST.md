# FRAMEWORK-PDF-TAKEOFF — MANIFEST

## Identidad
- **Nombre**: Framework de Context Engineering — Módulo Mediciones PDF (PDF Takeoff)
- **Versión**: 1.0.0
- **Propietario**: CMPROYECTOS BIM
- **Propósito**: Memoria permanente y **spec de reconstrucción desde cero** del módulo
  PDF Takeoff (`oe_takeoff`), para que cualquier equipo/IA pueda rehacerlo en otro
  proyecto con todo el detalle (UI, botones, API, BD, lógica, workflows).
- **Fecha**: 2026-06-28
- **Base del código documentado**: OpenConstructionERP / ERP-DEEP, módulo `oe_takeoff`.
- **Generado con**: `1-ESTRUCTURA/SKILL-PLANIFICADOR-V2.md`.

## Alcance
SOLO el módulo **PDF Takeoff** (`oe_takeoff`, ruta `/takeoff` + módulo enchufable
`pdf-takeoff` en `/takeoff-viewer`). NO cubre el módulo hermano **DWG Takeoff**
(`oe_dwg_takeoff`), que está documentado en el otro framework de la carpeta
`MODULO MEDICIONES PDF/FRAMEWORK/` (ojo: ese, pese al nombre de carpeta, documenta DWG).

## Estructura
```
FRAMEWORK-PDF-TAKEOFF/
├── MANIFEST.md              ← este archivo
├── SYSTEM-INDEX.md          ← inventario completo (qué hay y dónde se documenta)
├── CONTEXT-MAP.md           ← qué leer según el tipo de tarea
├── KNOWLEDGE-GRAPH.md       ← grafo: pantalla→botón→handler→API→servicio→tabla
├── CHANGELOG.md             ← historial de cambios documentados (D-TKC-*)
├── docs/
│   ├── project.md           ├── architecture.md   ├── tech-stack.md   ├── coding-standards.md
│   ├── modules/pdf-takeoff/index.md
│   ├── ui/pdf-takeoff.md            ├── ui/buttons/pdf-takeoff.md   ├── ui/forms/pdf-takeoff.md
│   ├── logic/pdf-takeoff.md         ├── workflows/pdf-takeoff.md
│   ├── api/pdf-takeoff.md           ├── database/pdf-takeoff.md
│   ├── components/pdf-takeoff.md    ├── permissions/pdf-takeoff.md
│   ├── events/pdf-takeoff.md        └── dependencies/pdf-takeoff.md
├── templates/   ├── checklists/   ├── reports/   └── metadata/
```

## Principios
1. **Basado en código real** — nada inventado; todo respaldado por archivos/líneas.
2. **Reconstruible** — el objetivo es rehacer el módulo de cero, no solo describirlo.
3. **Modular y para IA** — cada documento es una unidad de conocimiento.
4. **No destructivo** — ampliar, no borrar; preservar historial.

## Estado de cobertura
| Área | Estado |
|---|---|
| Módulo / arquitectura | ✅ |
| UI (pantallas) | ✅ |
| Botones (catálogo completo) | ✅ |
| Formularios | ✅ |
| API | ✅ |
| Base de datos | ✅ |
| Lógica de negocio | ✅ |
| Workflows | ✅ |
| Componentes | ✅ |
| Permisos | ✅ |
| Dependencias | ✅ |
| Eventos | ✅ |
