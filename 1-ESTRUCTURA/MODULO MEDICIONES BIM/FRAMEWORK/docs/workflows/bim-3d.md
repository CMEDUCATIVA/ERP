# Workflows — Mediciones BIM 3D

## W1. Subir y procesar un modelo
1. `uploadBIMData` → `POST /upload-cad/` (RVT/IFC) o `/upload/` (DataFrame + DAE).
2. Backend: **DDC cad2data** convierte → Excel (propiedades/cantidades) + COLLADA (malla); fallback
   parser STEP de IFC. Estado `processing` → `ready` (o `failed`/`needs_converter`).
3. Se extraen `BIMElement` (stable_id, type, properties, **quantities SI**, geometry_hash, mesh_ref).
4. Geometría → `geometry.glb`; dataframe → `elements.parquet`; CAD → `original.*`.
5. El visor 3D lista solo modelos **ready** (dwg/dxf/dgn excluidos).

## W2. Visualizar y medir
1. `BIMPage` abre el modelo → `GET /models/{id}/geometry/` (GLB/DAE) → escena Three.js.
2. Herramientas: **Sección**, **Walk**, **Medir** (distancia/área/ángulo con snap).
3. Selección de elementos (click/ctrl/shift) → panel Properties; URL guarda cámara+selección (`urlState`).
4. Colorear por propiedad (disciplina/progreso/cobertura BOQ…).

## W3. Cuantificar un elemento → BOQ (5D, manual)
1. Seleccionar elemento(s) → **Add to BOQ** (`AddToBOQModal`).
2. Vincular a posición existente **o** crear nueva (cantidad sugerida de `element.quantities`).
3. `createLink()` por elemento → `BOQElementLink` → `_sync_boq_quantity_from_links` recalcula la
   cantidad de la posición. El usuario asigna tarifa → costo = cantidad × tarifa.

## W4. Cuantificar por reglas (masivo)
1. `BIMQuantityRulesPage`: definir regla (filtro tipo+propiedad, `quantity_source`, unidad, waste, multiplier).
2. **Sandbox** previsualiza elementos que matchean (`checkUnitSafety`).
3. `POST /quantity-maps/apply/` con **dry_run** → preview (`matched/skipped/results`).
4. Aplicar (persistir): por regla (savepoint) → resolver/auto-crear posición → crear links →
   sincronizar cantidad → estampar `confidence`. Revisar en el BOQ.

## W5. Comparar versiones (diff)
1. Subir nueva versión (mismo `parent_model_id`).
2. `POST /models/{newId}/diff/{oldId}` → empareja por `stable_id`; modified si cambia
   `geometry_hash`/quantities/properties → `{added, deleted, modified, unchanged}` (cacheado).
3. `BIMDiffPanel` muestra el resultado (impacto de cantidades/costo).

## W6. Federar modelos (coordinación)
1. `FederationsPage`: crear federación → añadir modelos (`POST /federations/{id}/models`, disciplina/z-order/color).
2. `FederatedViewer` carga los GLB de cada miembro y los compone con `origin_offset`.
3. `GET /federations/{id}/health` → salud por miembro; `type-tree` agrega IfcClass; snapshots + diff.

## W7. 4D (cronograma)
1. Vincular elementos a actividades (`LinkActivityToBIMModal`) → fechas en el elemento.
2. `TimelineScrubber` + `use4dTimeline`: arrastrar fecha → colorea por estado
   (not_started/in_progress/completed/not_scheduled, `4dStatus.ts`).

## W8. Activos (ISO 19650)
1. Un elemento con `asset_info` poblado → `is_tracked_asset=true` → aparece en `/assets`.
2. `AssetEditModal` actualiza fabricante/garantía/serie (`PATCH /assets/{id}/asset-info`).
3. Export **COBie** (`GET /models/{id}/export/cobie.xlsx`).

## W9. Búsqueda semántica
1. Eventos `bim_hub.element.*` indexan los elementos en el vector store (`vector_adapter`).
2. `GET /elements/{id}/similar/` → elementos comparables; `GET /vector/status` / `reindex`.
