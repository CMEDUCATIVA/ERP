# KNOWLEDGE-GRAPH — PDF Takeoff

> Relaciones pantalla → botón → handler → API → servicio → tabla, con impacto.

## Cadenas principales

### Dibujar y guardar una medición
```
Toolbar [Distance] → selectTool('distance') → (clics en canvas) → add Measurement (estado)
   → useMeasurementPersistence auto-sync(1s) → takeoffApi.bulkCreate
   → POST /measurements/bulk/ → MeasurementRepository.create_bulk (recompute B8)
   → oe_takeoff_measurement
Impacto: totales del grupo, leyenda, push a BOQ.
```

### Reabrir documento
```
?doc=<id> → restore effect → setViewerDoc → TakeoffViewerModule (documentId, fileName)
   → useMeasurementPersistence load DUAL-KEY → GET /measurements?document_id=<uuid>
                                            + GET /measurements?document_id=<filename>
   → fromApiFormat + reconstructValueLabel → setMeasurements
Impacto: visibilidad de mediciones (clave por nombre).
```

### Eliminar medición
```
Ítem [🗑️] → deleteMeasurement(id) → DELETE /measurements/{serverId} (+ pushUndo)
Tecla Del / Clear all → misma persistencia
Impacto: persiste el borrado (no reaparece). Undo recrea (sin serverId).
```

### Vincular a BOQ
```
Ítem [🔗] → handleOpenLinkToBoq → picker(canvas) → fila posición → handleLinkToPosition
   → POST /measurements/{id}/link-to-boq/ → oe_takeoff_measurement.linked_boq_position_id
   → push de cantidad a oe_boq_position
Impacto: 5D costo.
```

### Borrar documento
```
DocumentCard [X] → handleRemoveDocument → DELETE /documents/{id}
   → service.delete_document → borra PDF + measurement_repo.delete_for_document(uuid,filename)
   → oe_takeoff_document (–) + oe_takeoff_measurement (cascada) + cross-link Documents (–)
Impacto: pérdida de datos (⚠️ sin confirmación — mejora pendiente).
```

### Analizar con IA
```
DocumentCard [Analizar con IA] → analyzeMutation → POST /documents/{id}/analyze/
   → lee extracted_text → call_ai(LLM usuario) → extract_json (+desenvolver objeto)
   → {elements, summary}  → analysis (estado) → ElementRow × N → Add to BOQ
Impacto: partidas sugeridas; toasts en error/0 ítems.
```

## Nodos
Pantallas: `/takeoff`, `/takeoff-viewer`.
Stores: `useProjectContextStore`, `useToastStore`, `useAuthStore`.
Hook: `useMeasurementPersistence`.
Servicios: `TakeoffService`; Repos: `Takeoff/Measurement/AiTakeoffRun`.
Tablas: document, measurement, ai_run, cad_extraction_session.
Permisos: `takeoff.{read,create,update,delete}`, `variations.create`.
Integra: BOQ, Documents hub, Markups, AI, Variations, Cost/Match.
