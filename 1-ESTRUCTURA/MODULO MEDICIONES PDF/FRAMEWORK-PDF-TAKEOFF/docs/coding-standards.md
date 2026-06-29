# Coding standards — PDF Takeoff

## Frontend (React/TS)
- **i18n obligatorio**: todo string visible vía `t()`; `defaultValue` inline como fallback.
- **Setters estables a hooks**: pasar `setState` directo, no `(x)=>setState(x)` (causó el
  race que cancelaba la carga — D-TKC-UP09b).
- **Efectos con deps correctas**: no meter en deps refs que cambian sin querer recargar.
- **React Query**: invalidar queries relacionadas tras mutaciones.
- **No fallos silenciosos**: `onError` siempre con feedback (toast).
- **JSX balanceado** en componentes grandes (TakeoffViewerModule ~6k líneas): editar con
  parches pequeños, verificar apertura/cierre.
- **createPortal** para overlays anclados a otro contenedor (panel BOQ → canvas).

## Backend (FastAPI)
- **Recompute server-side** de cantidades (no confiar en el cliente) — Audit B8.
- **IDOR**: `verify_project_access` / `_verify_takeoff_doc_access` en TODO endpoint de datos.
- **Fencear** el texto de usuario antes de mandarlo al LLM (anti prompt-injection — AI1).
- **Validar/clampar** salidas del LLM (AI3).
- **Best-effort** en cross-links (sesión propia, `try/except`).
- **No copiar migraciones** en docs; recrear por modelo.

## Convenciones de datos
- Unidades canónicas: `m`, `m2`, `m3`, `pcs` (el frontend muestra `m²`/`m³`).
- `measurement.document_id` = filename (o UUID legacy); clave por nombre.
- `annotation` = nombre; `label` (cliente) = valor formateado (no se persiste).
