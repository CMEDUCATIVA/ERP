# Coding standards — Mediciones BIM 3D

## Backend (FastAPI)
- **IDOR en todo endpoint**: `_verify_project_access` / `_verify_model_access` (404 indistinguible).
- **Cantidades canónicas SI** en `element.quantities`; no inventar unidades.
- **Auto-sync de cantidad BOQ** desde links (`_sync_boq_quantity_from_links`); no editar a mano si está ligada.
- **Validar/clampar** entradas de reglas (multiplier>0 finito, waste 0–100) — rechazar inf/NaN/inyección.
- **Atomicidad por regla** (`begin_nested`); idempotencia de links (UNIQUE pos+elem).
- **Geometría/dataframe a disco** (`file_storage`/`dataframe_store`), no a BD. DuckDB con allow-list de columnas.
- **Magic-bytes** al servir geometría (GLB/DAE).
- **No copiar migraciones** en docs; recrear por modelo.

## Frontend (React/TS/Three.js)
- **i18n** vía `t()` (claves `bim.*`); `defaultValue` como fallback.
- **Managers del visor** desacoplados (SceneManager/ElementManager/SelectionManager/MeasureManager…);
  el puente `window.__oeBim` expone managers a paneles/tests.
- **React Query**: invalidar `['bim-elements']`/`['bim-models']` tras mutaciones.
- **Estado del visor** en Zustand (no en componentes pesados); cámara+selección en la URL (`urlState`).
- **Mediciones** son de inspección; la cuantificación al BOQ usa `element.quantities`.
- **No fallos silenciosos**: estados de error/empty/loading explícitos (geometry 404 = estado esperado).

## Convenciones de datos
- `stable_id` = GUID IFC / ElementId Revit (identidad de diff y mesh).
- `mesh_ref` = id de nodo COLLADA/GLB (coincide con ElementId).
- Modelos 3D solo: dwg/dxf/dgn fuera (`is_non_3d_format`).
