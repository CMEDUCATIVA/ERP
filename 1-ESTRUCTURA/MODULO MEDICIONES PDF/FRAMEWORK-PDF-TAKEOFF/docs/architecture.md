# Arquitectura — PDF Takeoff

## Visión
Módulo enchufable de un ERP de construcción modular (OpenConstructionERP). Frontend
SPA (React/Vite) + Backend FastAPI + PostgreSQL. El proxy `/api/*` del dev server apunta
a `:8000`.

## Capas
```
Navegador
  └─ /takeoff (TakeoffPage) ──monta──▶ TakeoffViewerModule (canvas pdf.js + dibujo)
        │                                   │
        │ takeoffApi (fetch)                │ useMeasurementPersistence
        ▼                                   ▼
  FastAPI /api/v1/takeoff (router.py)
        │  Depends: RequirePermission, verify_project_access, _get_service
        ▼
  TakeoffService (lógica: upload gates, recompute B8, compare, plan-read)
        ▼
  Repositories (TakeoffRepository, MeasurementRepository, AiTakeoffRunRepository)
        ▼
  PostgreSQL (oe_takeoff_document, oe_takeoff_measurement, oe_ai_takeoff_run, oe_takeoff_cad_extraction_session)
  + disco: ~/.openestimate/takeoff_documents/*.pdf
```

## Principios de diseño del módulo
1. **Geometría → valor server-side** (B8): el servidor recalcula cantidades desde puntos+escala.
2. **Persistencia tolerante**: clave por nombre + dual-key load (el UUID no es estable).
3. **IA propone, humano confirma**: nada de IA se persiste sin confirmación.
4. **Seguridad**: IDOR en todo, fencing del texto al LLM, allow-list de descargas.
5. **Best-effort en integraciones**: cross-links nunca rompen la operación principal.

## Datos en disco
Los PDF se guardan en `~/.openestimate/takeoff_documents/{doc_id}.pdf` (o `doc.file_path`).
