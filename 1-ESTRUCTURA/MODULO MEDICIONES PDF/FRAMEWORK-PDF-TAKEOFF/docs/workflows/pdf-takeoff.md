# Workflows — PDF Takeoff

> Flujos completos de extremo a extremo. Botón→handler→API→servicio→tabla.

---

## W1. Subir y medir un plano
1. Usuario arrastra/elige un PDF (DropZone o "Load new PDF") → `handleFilesSelected`/`handleFileUpload`.
2. `POST /documents/upload/?project_id=` → 4 gates (tipo/tamaño, parseo, texto, **409 si filename duplicado**) → crea `oe_takeoff_document` + cross-link en Documents hub.
3. `onSuccess`: `setViewerDoc({id, url, name})`, pin `?doc=<id>&tab=measurements`.
4. El visor carga el PDF (pdf.js) → `setFileName`.
5. Usuario **Calibra** (2 clics + dimensión conocida) → escala de la página.
6. Dibuja con Distance/Area/etc. → cada medición se añade al estado; auto-sync (1s) →
   `POST /measurements/bulk/` → `oe_takeoff_measurement` (recompute B8).
7. Estado "Synced".

## W2. Reabrir / refrescar (persistencia)
1. Refresh → `?doc=<id>` → restore effect reabre el documento.
2. Visor pone `documentId` y `fileName`.
3. `useMeasurementPersistence` carga **dual-key**: `GET /measurements?document_id=<uuid>` +
   `GET /measurements?document_id=<filename>` → fusiona/deduplica → `setMeasurements`.
4. Se reconstruye el `label` (valor) de cada fila desde campos numéricos.
**Invariante**: las mediciones del PDF reaparecen aunque cambie el UUID (clave por nombre).

## W3. Vincular una medición al BOQ
1. 🔗 en la fila → `handleOpenLinkToBoq(id)` → panel dentro del canvas (derecha).
2. Elegir proyecto + BOQ (`GET /boq/boqs/`) → cargar posiciones.
3. **Pick existing**: clic en una posición → `handleLinkToPosition` → `POST /measurements/{id}/link-to-boq/` (push de cantidad).
4. **Create new**: `handleCreateAndLink` → crea posición con la cantidad y vincula.
5. La fila muestra el ordinal vinculado; `Unlink` lo quita (`PATCH linked=null`).

## W4. Borrar (persistente)
- Medición: papelera/Del/Clear all → `deleteMeasurement`/`clearAll` → `DELETE /measurements/{serverId}` → fuera del estado y del servidor.
- Documento: X del DocumentCard/filmstrip → `handleRemoveDocument` → `DELETE /documents/{id}` → cascada borra sus mediciones + PDF + cross-link.

## W5. Analizar con IA (texto → partidas)
1. "Analizar con IA" → `analyzeMutation` → `POST /documents/{id}/analyze/`.
2. Backend: lee `extracted_text` → resuelve proveedor LLM del usuario → fencea texto →
   `call_ai` → `extract_json` → **desenvuelve array si viene en objeto** → valida/clampa →
   devuelve `{elements, summary}`.
3. Frontend: guarda `analysis` (elementos pre-seleccionados); si 0 ítems → **toast** info; si
   error → **toast** con el motivo. Usuario marca elementos → **Add N to BOQ**.

## W6. Plan-read (geometría → mediciones, visión LLM)
1. `POST /plan-read/` (doc, page, scale, mode) → crea `AiTakeoffRun` (cost gate por usuario).
2. Poll `GET /plan-read/runs/{id}` hasta `done`.
3. `GET /plan-read/runs/{id}/proposals` → mediciones `proposed`.
4. Usuario confirma → `POST /plan-read/runs/{id}/accept` → mediciones billables.

## W7. Recognize (offline, sin LLM)
- Botón **Recognize** → `POST /documents/{id}/recognize/?page=` → candidatos
  (vector con PyMuPDF, o raster con OpenCV si la página es escaneada) → mediciones
  `suggested` en el canvas → aceptar/rechazar inline.

## W8. Comparar dos PDFs (revisión)
- **Compare** → `POST /measurements/compare/?from_document_id=&to_document_id=` →
  added/removed/modified + impacto de costo. Opcional `POST /measurements/create-variation`
  (permiso `variations.create`) → crea orden de cambio.
