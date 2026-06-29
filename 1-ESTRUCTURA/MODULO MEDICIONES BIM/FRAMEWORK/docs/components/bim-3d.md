# Componentes — Mediciones BIM 3D

## Árbol de alto nivel
```
BIMPage (/bim)
├── Cabecera (v1.1.0): fila única de menús — HeaderMenu (+ MenuLabel/MenuCheck/MenuAction)
│   · BIMHelpPanel (intro flotante, estados abierto↔"?"↔oculto)
├── BIMViewer (Three.js)  ── shared/ui/BIMViewer/
│   ├── SceneManager · ElementManager (malla, materiales, colorize)
│   ├── SelectionManager (+ SelectionSetsStore)
│   ├── ViewerToolbar → SectionBox · WalkMode · MeasureTool/MeasureManager · BIMViewCube
│   ├── ClipManager · SnapDetector · CameraTween · SavedViewsStore
│   ├── TimelineScrubber + use4dTimeline (4D) · applySmartView · color5d · aggregation
│   ├── BIMContextMenu · urlState (cámara+selección en URL)
│   └── window.__oeBim (puente para paneles/tests)
├── BIMRightPanelTabs (5 pestañas)
│   ├── BIMLinkedBOQPanel (Properties) · BIMLayersPanel (Layers)
│   ├── BIMToolsPanel (Tools) · BIMGroupsPanel (Groups) · ColorByPropertyPanel (Color)
├── BIMFilterPanel · BIMFilterGroupsPanel · BIMDiffPanel · BIMCRSPanel · BIMSnapshotsPopover
└── Modales: AddToBOQModal · CreateTaskFromBIMModal · LinkActivity/Document/RequirementToBIMModal
            · SaveGroupModal · SaveSmartViewModal

FederationsPage (/bim/federations) → FederatedViewer + FederatedViewerScene + FederatedViewerLegend
BIMQuantityRulesPage (/bim/rules) — reglas + sandbox + plantillas
AssetsPage (/assets) → ElementAssetCard · AssetEditModal · AssetDetailDrawer
```

## Visor 3D (`shared/ui/BIMViewer/`) — piezas clave
| Archivo | Rol |
|---|---|
| `BIMViewer.tsx` | orquesta la escena + modos de color (94–170) |
| `SceneManager.ts` / `ElementManager.ts` | escena Three.js; carga malla, materiales, colorize por modo. **v1.1.0:** `dispose()` solo hace `forceContextLoss()` si hay **≥6 contextos WebGL vivos** (`liveWebGLContexts`); evita matar el GPU AMD y el "born-lost context" en remontajes |
| `SelectionManager.ts` | `getSelectedIds/selectByIds/toggleId/clear/onSelectionChange` |
| `MeasureTool.ts` | distancia punto-a-punto + snap a vértice |
| `MeasureManager.ts` + `measureMath.ts` | distance/area/angle + **área por método de Newell 3D**, ángulo, centroide |
| `SnapDetector.ts` | snap vértice/punto-medio/perpendicular (12 px) |
| `SectionBox.ts` / `ClipManager.ts` | caja de sección / planos de corte |
| `WalkMode.ts` | navegación primera persona |
| `BIMViewCube.tsx` / `CameraTween.ts` | orientación / transiciones de cámara |
| `SavedViewsStore.ts` / `SelectionSetsStore.ts` | vistas/selecciones guardadas (localStorage) |
| `use4dTimeline.ts` / `4dStatus.ts` / `TimelineScrubber.tsx` | 4D |
| `applySmartView.ts` / `color5d.ts` / `aggregation.ts` | smart views / rampa de color / agregados |
| `urlState.ts` | serializa cámara + selección en la URL |

## Stores (Zustand)
- `useBIMViewerStore` — `rightPanelTab`, `selectedElementId`, `colorByMode`, `isolatedIds`, `highlightedIds`.
- `useBIMMeasurementsStore` — historial de mediciones por modelo (sobrevive recarga).
- `useBIMGeometryCache` — LRU de geometrías cargadas.
- `SelectionSetsStore` / `SavedViewsStore` — localStorage por modelo, sync entre pestañas.

## Carga de datos (`features/bim/api.ts`)
`fetchBIMElements(modelId, {skeleton,limit,offset})`, `fetchGeometryBlobUrl(modelId)` /
`getGeometryUrl`, `uploadBIMData(...)`, `listLinks/createLink/deleteLink`, `boqApi` (posiciones).
`BIMElementData`: `{id, name, element_type, discipline, category, storey, area_m2?, volume_m3?,
length_m?, properties, classification, quantities, boq_links[], current_pct?}`.

## Formato de geometría
GLB (preferido) / DAE (legacy). Mallas grandes → `BatchedMesh`. `mesh_ref`/id de nodo = ElementId.
Selección dirige `.visible` + overrides de material.
