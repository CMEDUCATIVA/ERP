# Tech Stack — Mediciones BIM 3D

## Backend
- Python 3.12+, **FastAPI**, **SQLAlchemy 2 async**, asyncpg, **PostgreSQL 16** (embebido en dev).
- **DDC cad2data** (converters externos RVT/IFC → Excel + COLLADA); parser **STEP/IFC** propio
  (`ifc_processor.py`) como respaldo.
- **pyarrow** (Parquet) + **DuckDB** (consultas SQL sobre `elements.parquet`).
- **Vector store** (búsqueda semántica de elementos), **COBie** exporter.
- CLI: `openconstructionerp serve --port 8000`.

## Frontend
- **React 18 + TypeScript + Vite**.
- **Three.js** — visor 3D (`shared/ui/BIMViewer/`): escena, raycasting, BatchedMesh, GLB/DAE loaders,
  OrbitControls, sección/clipping, walk mode, measure.
- **React Query** (datos), **Zustand** (estado del visor/mediciones/cache).
- Tailwind, lucide-react, i18next.
- Tests: vitest (muchos en `BIMViewer/__tests__/`).

## Formatos
- Modelos: RVT, IFC (3D). Excluidos del 3D: DWG/DXF/DGN (módulo DWG).
- Geometría: GLB (preferida), DAE/glTF (legacy). Datos: Parquet (ZSTD).

## Comandos
- Backend: `openconstructionerp serve --port 8000`. Frontend: `npm run dev`.
- Validación: `npm.cmd run typecheck`, `npx vitest run <archivo>`.
