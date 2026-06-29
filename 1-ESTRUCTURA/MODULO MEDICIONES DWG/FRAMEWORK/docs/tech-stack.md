# Tech Stack — ERP-DEEP

## Frontend

| Tecnología | Versión | Uso |
|---|---|---|
| **React** | 18.x | UI framework |
| **TypeScript** | 5.x | Lenguaje |
| **Vite** | 5.x | Bundler/dev server |
| **Tailwind CSS** | 3.x | Estilos |
| **Zustand** | — | Estado global |
| **React Query (TanStack)** | 5.x | Data fetching/caché |
| **React Router** | 6.x | Navegación SPA |
| **i18next** | — | Internacionalización (20+ idiomas) |
| **Lucide React** | — | Iconografía |
| **date-fns** | — | Formateo de fechas |
| **clsx** | — | Clases condicionales |
| **Vitest** | — | Unit testing |
| **Playwright** | — | E2E testing |
| **ESLint** | 9.x | Linting |

## Backend

| Tecnología | Versión | Uso |
|---|---|---|
| **Python** | 3.14+ | Lenguaje |
| **FastAPI** | — | Framework HTTP |
| **SQLAlchemy** | 2.x (async) | ORM |
| **Alembic** | — | Migraciones |
| **Pydantic** | 2.x | Validación/schemas |
| **PostgreSQL** | — | Base de datos |
| **ezdxf** | — | Parser DXF |
| **DDC Converters** | externo | Conversión DWG/IFC/RVT |
| **pytest** | — | Testing backend |

## Desktop / Mobile

| Tecnología | Uso |
|---|---|
| **Electron** | Desktop app |
| **Capacitor** | Mobile wrapper |

## DevOps

| Tecnología | Uso |
|---|---|
| **Docker** | Contenedores |
| **Docker Compose** | Orquestación local |
| **GitHub Actions** | CI/CD |
| **Makefile** | Tareas de build |
| **pre-commit** | Hooks de calidad |

## Librerías clave por módulo (backend)

| Módulo | Dependencias |
|---|---|
| `dwg_takeoff` | ezdxf, DDC DwgExporter |
| `bim_hub` | DDC Converters (IFC/RVT) |
| `ai_estimator` | OpenAI/Anthropic SDKs |
| `documents` | PDF processing, image handling |
| `takeoff` | ezdxf, pandas (Excel) |
| `pointcloud` | Open3D, numpy |
