# Eventos / Jobs / Async — Mediciones BIM 3D

## Backend — Event bus (`events.py`)
Indexado del vector store de elementos:
- `bim_hub.element.created` → `_index_element()` (embed/re-embed) — `vector_adapter.BIMElementVectorAdapter`.
- `bim_hub.element.updated` → `_index_element()` (re-embed).
- `bim_hub.element.deleted` → `_delete_element_vector()` (quita del índice).

Colección vector: `oe_bim_elements`. Texto embebido: name, element_type, category, discipline,
storey, material, family, type, classification (`vector_adapter.to_text`).

## Backend — tareas async (background)
- **Conversión DDC** (`_process_cad_in_background`): subproceso cad2data (RVT/IFC→Excel+COLLADA);
  el modelo transita `processing → ready|failed`. `_LAST_DDC_FAILURE` guarda contexto del fallo.
- **Import validation** (`_run_import_validation`): verifica conteo>0, geometría disponible, columnas.
- **Escritura Parquet** (`dataframe_store`): estado pending/done/failed (`/parquet-status`, `/parquet/retry`).
- **Generación de láminas PDF** (`/generate-pdf-sheets/`): async.
- **Cleanup**: `/cleanup-stale/` (modelos colgados en processing) y `/cleanup-orphans/` (blobs sin fila).

## Backend — limpieza de huérfanos (al borrar elementos/modelo)
`_strip_orphaned_bim_links`: al reimportar/borrar elementos, limpia referencias colgantes en
Task/Activity/Requirement/Schedule (sesión compartida, antes de los eventos de vector delete).

## Frontend — async / estado
- **Polling de conversión**: el front consulta el estado del modelo hasta `ready`/`failed`.
- **React Query**: invalida `['bim-elements']` tras link/unlink; `['bim-models']` tras subir/borrar.
- **Geometría**: carga GLB/DAE (cache LRU `useBIMGeometryCache`).
- **4D**: `use4dTimeline` recalcula estado por fecha del scrubber.
- **URL state**: cámara + selección persistidas en la URL (`urlState`, deep-link).
- **window.__oeBim**: puente para que paneles/tests accedan a los managers del visor.
