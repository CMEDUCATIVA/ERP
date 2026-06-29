# Coding Standards — ERP-DEEP

## General

- **Lenguaje principal**: Python (backend), TypeScript (frontend)
- **Control de versiones**: Git con commits convencionales
- **Code review**: PR requerido para merge a main
- **Linting**: Pre-commit hooks (ruff, mypy, eslint)

## Backend (Python)

### Naming
- `snake_case` para funciones, variables, atributos
- `PascalCase` para clases y modelos SQLAlchemy
- `UPPER_CASE` para constantes

### Type Hints
- Obligatorios en todas las firmas públicas
- Usar `| None` (Python 3.10+) en vez de `Optional[X]`
- `Mapped` de SQLAlchemy para columnas ORM

### Estructura de módulo
```
modules/<nombre>/
├── __init__.py
├── manifest.py       ← ModuleManifest
├── models.py         ← ORM models (SQLAlchemy)
├── schemas.py        ← Pydantic schemas
├── router.py         ← FastAPI routes
├── service.py        ← Business logic
├── repository.py     ← Data access
├── permissions.py    ← Permission registry
└── events.py         ← Event bus handlers
```

### Convenciones
- Repositorios son stateless (reciben session en constructor)
- Servicios pueden tener estado (ej: caches internos)
- Nunca lógica de negocio en routers
- Nunca queries SQL directas (usar repositorio)
- Usar `Numeric` para precisión financiera/de mediciones

## Frontend (TypeScript)

### Naming
- `camelCase` para variables, funciones
- `PascalCase` para componentes React y tipos/interfaces
- `kebab-case` para nombres de archivo de features (ej: `dwg-takeoff/`)

### Estructura de feature
```
features/<nombre>/
├── index.ts           ← Barrel export
├── <Feature>Page.tsx  ← Página principal
├── api.ts             ← API calls
├── <Feature>Guide.ts  ← Guía onboarding
├── components/        ← Componentes específicos
├── lib/               ← Lógica de negocio (frontend)
└── __tests__/         ← Tests
```

### Convenciones
- Lazy loading en App.tsx para rutas principales
- API calls aisladas en `api.ts`, nunca en componentes
- Zustand stores para estado global que sobrevive navegación
- React Query para data fetching con caché
- `useMemo`/`useCallback` para optimizaciones cuando necesario
- Componentes funcionales, no clases
- Tipos importados con `type` keyword
