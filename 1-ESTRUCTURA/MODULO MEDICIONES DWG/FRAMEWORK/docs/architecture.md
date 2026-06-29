# Arquitectura del Sistema — ERP-DEEP

## Estilo arquitectónico

**Arquitectura Hexagonal (Ports & Adapters)** con patrón modular.

```
┌─────────────────────────────────────────────────┐
│                  FRONTEND                        │
│  React + TypeScript + Vite + Tailwind            │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │ Features │ │  Shared  │ │   Stores     │    │
│  │ (módulos)│ │  UI/lib  │ │  (Zustand)   │    │
│  └──────────┘ └──────────┘ └──────────────┘    │
│         │              │              │          │
│         └──────────────┼──────────────┘          │
│                        │ HTTP/SSE                │
└────────────────────────┼────────────────────────┘
                         │
┌────────────────────────┼────────────────────────┐
│                  BACKEND                         │
│  FastAPI + SQLAlchemy (async) + Pydantic         │
│  ┌──────────────────────────────────────────┐   │
│  │              API Layer (router.py)        │   │
│  │  ┌────────┐ ┌────────┐ ┌──────────────┐  │   │
│  │  │Schemas │ │  Auth  │ │ IDOR Gates   │  │   │
│  │  │(Pydantic)│ │(JWT)  │ │ (per-project)│  │   │
│  │  └────────┘ └────────┘ └──────────────┘  │   │
│  └──────────────────────────────────────────┘   │
│                      │                          │
│  ┌──────────────────────────────────────────┐   │
│  │          Service Layer (service.py)       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │Business  │ │Validation│ │Conversion│  │   │
│  │  │  Logic   │ │  Rules   │ │ Pipeline │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘  │   │
│  └──────────────────────────────────────────┘   │
│                      │                          │
│  ┌──────────────────────────────────────────┐   │
│  │       Repository Layer (repository.py)    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │DrawingRepo│ │VersionRepo│ │AnnotRepo │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘  │   │
│  └──────────────────────────────────────────┘   │
│                      │                          │
│  ┌──────────────────────────────────────────┐   │
│  │           ORM Layer (models.py)           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │DwgDrawing│ │DwgVersion│ │DwgAnnot  │  │   │
│  │  └──────────┘ └──────────┘ └──────────┘  │   │
│  └──────────────────────────────────────────┘   │
│                      │                          │
│  ┌──────────────────────────────────────────┐   │
│  │            Event Bus (events.py)          │   │
│  │  Subscribe/Publish between modules        │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                         │
                    ┌────┴────┐
                    │ PostgreSQL │
                    └──────────┘
```

## Patrones identificados

| Patrón | Uso |
|---|---|
| **Repository** | Cada módulo tiene su propio repositorio de acceso a datos |
| **Service Layer** | Lógica de negocio aislada en servicios |
| **Module Manifest** | Cada módulo declara metadata, dependencias, permisos |
| **Event Bus** | Comunicación desacoplada entre módulos (pub/sub) |
| **Lazy Loading** | Frontend usa `React.lazy()` para rutas |
| **Zustand Stores** | Estado global que sobrevive navegación |
| **React Query** | Caché y fetching declarativo |
| **IDOR Gates** | Cada endpoint backend verifica pertenencia al proyecto |
| **Numeric precision** | Mediciones usan `Numeric(18,6)` en vez de `Float` |

## Flujo de datos típico

```
Usuario → React Component → API call (api.ts) →
  → FastAPI Router (router.py) → IDOR Gate → Service (service.py) →
    → Repository (repository.py) → SQLAlchemy → PostgreSQL
```

## Comunicación entre módulos

- **Frontend**: Estados globales (Zustand), React Query cache, props
- **Backend**: Event Bus (`app.core.events.event_bus`), imports directos de modelos
- **Cruce de datos**: Anotaciones DWG pueden referenciar BOQ positions, Tasks, Punch items vía ID

## Convenciones de seguridad

1. **IDOR Protection**: Todo endpoint verifica que el recurso pertenece al proyecto del usuario
2. **404 indistinguible**: Recursos no autorizados devuelven 404 (no 403) para evitar probing
3. **CASCADE/SET NULL**: FK constraints definen comportamiento ante borrados
4. **Event cleanup**: Listeners limpian referencias huérfanas (ej: BOQ delete → clear annotation links)
