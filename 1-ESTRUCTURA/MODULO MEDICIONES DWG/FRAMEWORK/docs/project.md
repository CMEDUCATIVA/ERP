# ERP-DEEP — Visión General del Proyecto

## ¿Qué es?

**OpenConstructionERP (ERP-DEEP)** es un sistema ERP integral para la industria de la construcción. Cubre el ciclo completo de un proyecto de construcción: desde la estimación de costos, mediciones (takeoff), gestión de documentos (CDE), BIM, cronograma, finanzas, licitaciones, control de calidad, seguridad, hasta el cierre del proyecto.

## ¿Por qué existe?

Unificar en una sola plataforma todas las disciplinas de la gestión de proyectos de construcción, eliminando la fragmentación entre herramientas CAD, estimación, programación y gestión documental.

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | React 18 + TypeScript, Vite, Tailwind CSS, Zustand, React Query, i18next |
| **Backend** | Python 3.14+ con FastAPI, SQLAlchemy (async), Alembic |
| **Base de datos** | PostgreSQL |
| **Testing** | Playwright (e2e), Vitest (unit), pytest (backend) |
| **Desktop** | Electron |
| **Mobile** | Capacitor |
| **DevOps** | Docker, GitHub Actions |

## Arquitectura

- **Ports & Adapters (Hexagonal)**: Separación clara entre dominio, aplicación, infraestructura
- **Modular**: ~100+ módulos independientes (cada uno con models, router, service, repository, schemas, permissions, manifest)
- **Event-driven**: EventBus interno para comunicación entre módulos
- **Plugin-ready**: Sistema de módulos cargables con manifiestos

## Módulos principales (backend)

Ver `backend/app/modules/` para la lista completa. Los módulos clave agrupados por dominio:

| Dominio | Módulos |
|---|---|
| **Mediciones** | `dwg_takeoff`, `takeoff`, `cad`, `markups` |
| **Presupuesto** | `boq`, `costs`, `costmodel`, `cost_match` |
| **BIM** | `bim_hub`, `clash`, `bim_requirements`, `pointcloud` |
| **Documentos** | `documents`, `cde`, `file_versions`, `file_approvals`, `file_transmittals` |
| **Proyectos** | `projects`, `contacts`, `teams` |
| **Cronograma** | `schedule`, `schedule_advanced`, `progress` |
| **Finanzas** | `finance`, `eac`, `full_evm`, `payroll` |
| **Calidad** | `inspections`, `ncr`, `punchlist`, `qms` |
| **Seguridad** | `safety`, `hse_advanced` |
| **IA** | `ai`, `ai_agents`, `ai_estimator`, `clash_ai_triage` |
| **Regionales** | `latam_pack`, `us_pack`, `uk_pack`, `dach_pack`, `india_pack`, `asia_pac_pack`, `middle_east_pack`, `russia_pack` |

## Convenciones de código

- **Backend**: Python, type hints obligatorios, Pydantic para schemas, patrón Repository/Service/Router
- **Frontend**: TypeScript estricto, componentes funcionales con hooks, lazy loading, barrels (index.ts)
- **Naming**: snake_case en Python, camelCase en TypeScript, PascalCase para componentes React
- **Testing**: Unit tests junto al código, e2e en directorios dedicados
- **Git**: Commits convencionales, pre-commit hooks (ruff, mypy, eslint)

## Fuente

- Código fuente: `backend/app/`, `frontend/src/`
- Este análisis se basa en la inspección directa del código (no en documentación preexistente)
