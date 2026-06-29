# SKILL Framework — MANIFEST

## Identidad

- **Nombre**: ERP-DEEP Context Engineering Framework
- **Versión**: 1.0.0
- **Propietario**: CMPROYECTOS BIM / TAKEOFF
- **Propósito**: Memoria permanente del sistema para agentes de IA (Skill Desarrollador, Skill Planificador)
- **Fecha de creación**: 2026-07-17
- **Ubicación**: `1-ESTRUCTURA/SKILL/`

## Estructura

```
SKILL/
├── MANIFEST.md              ← Este archivo
├── SYSTEM-INDEX.md          ← Inventario completo del proyecto
├── CONTEXT-MAP.md           ← Qué documentos leer según tipo de tarea
├── KNOWLEDGE-GRAPH.md       ← Grafo de conocimiento (relaciones)
├── CHANGELOG.md             ← Historial de cambios de documentación
├── docs/
│   ├── project.md           ← Visión general del proyecto
│   ├── architecture.md      ← Arquitectura del sistema
│   ├── tech-stack.md        ← Stack tecnológico
│   ├── coding-standards.md  ← Convenciones y patrones
│   ├── modules/             ← Documentación por módulo
│   │   └── dwg-takeoff/     ← Módulo Mediciones DWG
│   ├── ui/                  ← Pantallas, botones, formularios
│   │   ├── buttons/
│   │   └── forms/
│   ├── logic/               ← Reglas de negocio
│   ├── workflows/           ← Workflows completos
│   ├── permissions/         ← Permisos, roles, políticas
│   ├── database/            ← Tablas y relaciones
│   ├── api/                 ← Endpoints y contratos
│   ├── components/          ← Componentes reutilizables
│   ├── events/              ← Eventos, listeners, jobs, queues
│   └── dependencies/        ← Dependencias entre módulos
├── templates/               ← Templates para nueva documentación
├── checklists/              ← Checklists para tareas comunes
├── reports/                 ← Informes de auditoría
└── metadata/                ← Metadatos del framework
```

## Principios

1. **Basado en código real** — nada inventado; todo respaldado por el código fuente
2. **Modular** — cada documento cubre una unidad de conocimiento
3. **Reutilizable por IA** — diseñado para ser consumido por agentes
4. **Mantenible** — actualizaciones incrementales, no reescrituras
5. **No destructivo** — preservar documentación existente, ampliar no eliminar

## Módulos documentados

| Módulo | Estado | Última actualización |
|---|---|---|
| dwg-takeoff (Mediciones DWG) | ✅ Documentado | 2026-07-17 |
