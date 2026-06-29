# Arquitectura — Mediciones BIM 3D

## Capas
```
Navegador
  └─ /bim (BIMPage) ── BIMViewer (Three.js, shared/ui/BIMViewer) + paneles (features/bim)
        │  api.ts (fetch)                         │ stores Zustand (viewer, measurements, geometry)
        ▼                                          ▼
  FastAPI /api/v1/bim_hub (router.py)
        │  Depends: permisos bim.*, _verify_project_access/_verify_model_access, _get_service
        ▼
  BIMHubService (lógica: import, quantity maps, federaciones, diff, grupos, smart views)
        ▼
  Repositories (Model/Element/Link/Map/Diff/Group/Federation)
        ▼
  PostgreSQL (8 tablas)  +  Disco: data/bim/{project}/{model}/ (geometry.glb, elements.parquet, original.*)
        ▼
  DDC cad2data (subproceso) · DuckDB (Parquet) · Vector store (eventos)
```

## Principios de diseño
1. **Geometría/dataframe fuera de BD** (disco; Parquet consultable con DuckDB).
2. **Cantidades canónicas SI** + auto-sync de la cantidad del BOQ desde los links.
3. **IA/regla propone, humano confirma** (dry-run + confidence).
4. **Identidad por `stable_id`** (diff + emparejado fila↔malla).
5. **Seguridad por proyecto** (IDOR en todo; magic-bytes en geometría servida).
6. **Frontera con DWG**: el visor 3D solo recibe modelos con malla real (dwg/dxf/dgn fuera).

## Datos en disco
`data/bim/{project_id}/{model_id}/`: `geometry.glb` (preferida) / `geometry.dae`,
`elements.parquet` (1000+ columnas, ZSTD), `original.{rvt|ifc|…}`.
Abstracción de backend en `file_storage.py` (FS local o S3).
