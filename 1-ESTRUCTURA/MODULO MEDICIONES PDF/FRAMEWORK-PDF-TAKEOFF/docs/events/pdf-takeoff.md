# Eventos / Jobs / Async — PDF Takeoff

## 1. Frontend (debounces, listeners, async)
- **Auto-sync a servidor**: `setTimeout` 1s (`serverSyncRef`) + guardia `inFlightSyncRef`.
- **Auto-save localStorage**: `setTimeout` 500ms (`debounceRef`).
- **Reshape-PATCH** (#194): `setTimeout` 400ms (`patchTimerRef`) + `inFlightPatchRef` — al
  reformar una medición ya sincronizada, PATCH solo de geometría (recompute server-side).
- **`beforeunload`**: aviso de cambios sin guardar **solo si `!syncedToServer`**.
- **Keydown global**: atajos de herramienta (V/D/P/A/O/C/R/T/H/W/X), Ctrl+Z/Y (undo/redo),
  Del/Backspace (borrar medición o vértice), Esc (cancelar dibujo).
- **Wheel/touch**: zoom; gestos pinch.
- **React Query invalidation**: `['unified-markups']` tras crear/sync; `['documents']` tras
  subir/borrar; `serverDocuments` refetch.

## 2. Backend (tareas en segundo plano)
- **Plan-read** es asíncrono: `POST /plan-read/` crea un `AiTakeoffRun` en estado `queued`;
  el trabajo (rasterizar + visión LLM) corre en segundo plano y actualiza `status`. El
  frontend hace **polling** de `GET /plan-read/runs/{id}`.
- **Instalación de convertidores**: descarga en `ThreadPoolExecutor`; progreso en memoria
  (`/converters/{id}/install-progress/`, polling cada 500ms).
- **Cost gate** de plan-read: gasto por usuario ventaneado (`rolling_spend_usd`).

## 3. Cross-link Documents hub
Al subir/listar/borrar un documento, el router mantiene el cross-link en
`oe_documents_document` con `source_module='takeoff'`, `source_id=<uuid>` — en sesión
**independiente** (best-effort; nunca rompe la operación principal).
