# CONTEXT-MAP — Qué documentos cargar según la tarea

> **Regla de oro**: Cargar el contexto MÍNIMO suficiente. Nunca cargar todo.

---

## Tareas por tipo

### 🔧 Implementar nueva funcionalidad en un módulo existente

```
[OBLIGATORIO]
├── docs/project.md
├── docs/architecture.md
├── docs/coding-standards.md
├── docs/modules/<modulo>/index.md
├── docs/dependencies/<modulo>.md
└── docs/logic/<modulo>.md

[CONDICIONAL]
├── docs/database/<modulo>.md (si toca DB)
├── docs/api/<modulo>.md (si toca API)
├── docs/permissions/<modulo>.md (si cambian permisos)
└── docs/workflows/<modulo>.md (si cambian flows)
```

### 🐛 Arreglar un bug

```
[OBLIGATORIO]
├── docs/modules/<modulo>/index.md
├── docs/logic/<modulo>.md
└── docs/dependencies/<modulo>.md

[CONDICIONAL]
├── docs/workflows/<modulo>.md (si es bug de flujo)
├── docs/ui/<modulo>.md (si es bug de UI)
└── docs/database/<modulo>.md (si es bug de datos)
```

### 🔄 Refactorizar

```
[OBLIGATORIO]
├── docs/architecture.md
├── docs/coding-standards.md
├── docs/dependencies/<modulo>.md
└── docs/modules/<modulo>/index.md

[CONDICIONAL]
├── docs/components/<modulo>.md (si es refactor de frontend)
└── docs/events/<modulo>.md (si cambian eventos)
```

### 🗄️ Agregar/modificar tabla

```
[OBLIGATORIO]
├── docs/database/<modulo>.md
├── docs/dependencies/<modulo>.md
└── docs/modules/<modulo>/index.md
```

### 🌐 Agregar/modificar API endpoint

```
[OBLIGATORIO]
├── docs/api/<modulo>.md
├── docs/permissions/<modulo>.md
└── docs/modules/<modulo>/index.md
```

### 🎨 Modificar UI/pantalla

```
[OBLIGATORIO]
├── docs/ui/<modulo>.md
├── docs/components/<modulo>.md
└── docs/modules/<modulo>/index.md
```

### 📋 Agregar nuevo módulo

```
[OBLIGATORIO]
├── docs/project.md
├── docs/architecture.md
├── docs/tech-stack.md
├── docs/coding-standards.md
└── templates/module-template.md (como guía)

[CREAR]
├── docs/modules/<nuevo>/index.md
├── docs/database/<nuevo>.md
├── docs/api/<nuevo>.md
├── docs/permissions/<nuevo>.md
├── docs/logic/<nuevo>.md
├── docs/workflows/<nuevo>.md
├── docs/ui/<nuevo>.md
├── docs/components/<nuevo>.md
├── docs/events/<nuevo>.md
└── docs/dependencies/<nuevo>.md
```

### 🔗 Modificar dependencias entre módulos

```
[OBLIGATORIO]
├── docs/dependencies/<modulo-a>.md
├── docs/dependencies/<modulo-b>.md
├── docs/events/<modulo-a>.md
└── docs/events/<modulo-b>.md
```

### ⚡ Revisar impacto de un cambio

```
[OBLIGATORIO]
├── docs/dependencies/<modulo>.md (matriz de impacto)
├── docs/logic/<modulo>.md (reglas que nunca deben romperse)
└── KNOWLEDGE-GRAPH.md (relaciones globales)
```

---

## Mapa rápido: Módulo → Archivos

| Módulo | Archivos disponibles |
|---|---|
| `dwg-takeoff` | `docs/modules/dwg-takeoff/index.md`, `docs/database/dwg-takeoff.md`, `docs/database/dwg-takeoff-schema.sql`, `docs/api/dwg-takeoff.md`, `docs/permissions/dwg-takeoff.md`, `docs/workflows/dwg-takeoff.md`, `docs/logic/dwg-takeoff.md`, **`docs/logic/dwg-takeoff-internals.md`** (algoritmos), `docs/ui/dwg-takeoff.md`, `docs/ui/buttons/dwg-takeoff.md`, `docs/components/dwg-takeoff.md`, `docs/events/dwg-takeoff.md`, `docs/dependencies/dwg-takeoff.md` |

> **Réplica exacta / algoritmos** (parseo DXF, medición, calibración, diff de versiones,
> impacto de costo, conversión DWG): cargar `docs/logic/dwg-takeoff-internals.md`.
