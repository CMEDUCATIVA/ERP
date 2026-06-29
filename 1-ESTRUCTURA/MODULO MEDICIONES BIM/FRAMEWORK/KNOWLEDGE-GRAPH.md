# KNOWLEDGE-GRAPH — Mediciones BIM 3D

> Cadenas pantalla → herramienta → API → servicio → tabla, con impacto.

## Subir y procesar
```
uploadBIMData → POST /upload-cad/ → BIMHubService._process_cad_in_background
   → DDC cad2data (Excel+COLLADA) | parser STEP fallback
   → extrae BIMElement (stable_id, quantities SI, geometry_hash, mesh_ref)
   → geometry.glb + elements.parquet (disco) ; status processing→ready
   → eventos bim_hub.element.created → índice vectorial
Impacto: visor 3D, cuantificación, diff, búsqueda.
```

## Cuantificar elemento → BOQ (5D)
```
Seleccionar → Add to BOQ (AddToBOQModal) → createLink → POST /links/
   → oe_bim_boq_link (UNIQUE pos+elem) → _sync_boq_quantity_from_links
   → oe_boq_position.quantity = Σ element.quantities[source]
Impacto: 5D costo; cantidad ligada se mantiene en sync.
```

## Reglas de cantidad (masivo)
```
BIMQuantityRulesPage → sandbox → POST /quantity-maps/apply/ (dry_run)
   → apply_quantity_maps (savepoint por regla): match (tipo+propiedad) → extract → ·multiplier·(1+waste)
   → resolver/auto-crear posición → links → sync cantidad → confidence
Impacto: posiciones BOQ auto-creadas; revisar (IA propone, humano confirma).
```

## Medición 3D
```
ViewerToolbar [Medir] → MeasureTool/MeasureManager (SnapDetector)
   → distance/area/angle (measureMath) → useBIMMeasurementsStore
Impacto: inspección (NO cuantifica el BOQ por sí mismo).
```

## Diff de versiones
```
nueva versión (parent_model_id) → POST /models/{new}/diff/{old}
   → emparejar por stable_id; modified si cambia geometry_hash/quantities/properties
   → oe_bim_model_diff (cacheado por par)
Impacto: BIMDiffPanel; impacto de cambios en cantidad/costo.
```

## Federación
```
FederationsPage → POST /federations/{id}/models → FederatedViewerScene (GLB por miembro + origin_offset)
   → /health (escalera severidad) · /type-tree (IfcClass) · /snapshot-diff
Impacto: coordinación multi-disciplina (overlay; no borra modelos).
```

## Nodos
Pantallas: /bim, /bim/federations, /bim/rules, /assets.
Visor: SceneManager, ElementManager, SelectionManager, MeasureManager, SectionBox, WalkMode, ViewCube, urlState.
Servicios: BIMHubService; Repos: Model/Element/Link/Map/Diff/Group/Federation.
Tablas: model, element, boq_link, quantity_map, model_diff, element_group, federation, federation_model.
Permisos: bim.read/create/update/delete.
Integra: BOQ, Schedule(4D), Tasks, Documents, Requirements, Validation, Progress, Vector, DDC converters.
