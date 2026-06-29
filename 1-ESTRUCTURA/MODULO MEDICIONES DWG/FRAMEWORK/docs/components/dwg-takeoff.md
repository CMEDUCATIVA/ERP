# Componentes — Módulo DWG Takeoff

## Árbol de componentes

```
DwgTakeoffPage
├── OfflineReadyBadge
├── ToolPalette
│   └── 11 Tool Buttons + 6 Color Buttons
├── DxfViewer (Canvas2D)
│   ├── GridBackground
│   ├── AnnotationOverlay
│   │   └── MarkupCommentsDrawer
│   ├── ElementInfoPopover (shared/ui)
│   └── EntityContextMenu
├── LayerPanel
├── EntityNameFilter
├── SheetStrip
├── CalibrationDialog
├── DwgDrawingCompareDrawer
├── CreateTaskFromDwgModal
├── LinkDocumentToDwgModal
├── LinkActivityToDwgModal
├── LinkRequirementToDwgModal
└── DwgUploadIndicator (shared/ui, global)
```

## Componentes específicos

### DxfViewer
- **Tipo**: Canvas2D renderer (componente principal)
- **Props**: entities, annotations, scale, activeTool, selectedEntityIds, hiddenEntityIds, snapModes, calibration, calibrationStep, ...
- **Eventos emitidos**: `onEntitySelect`, `onEntityContextMenu`, `onCalibrationPoint`, `onAnnotationCreate`, `onAnnotationUpdate`
- **Renderiza**: Entidades DXF (LINE, LWPOLYLINE, ARC, CIRCLE, TEXT, INSERT, HATCH) + Anotaciones + Grid + Calibración

### ToolPalette
- **Tipo**: Toolbar horizontal
- **Props**: activeTool, onToolChange, activeColor, onColorChange
- **Tools**: select, pan, distance, line, polyline, area, rectangle, circle, arrow, text_pin, calibrate
- **Colores**: 6 presets

### LayerPanel
- **Tipo**: Panel lateral con lista de capas
- **Props**: layers, visibleLayers, onToggleLayer, allLayers
- **Features**: Search, toggle visible/no visible, entity count, color dot

### SheetStrip
- **Tipo**: Filmstrip horizontal inferior
- **Props**: drawings, selectedDrawingId, onSelectDrawing
- **Features**: Thumbnails, upload button, drag-and-drop zone

### CalibrationDialog
- **Tipo**: Modal para input de calibración
- **Steps**: 0=idle, 1=waiting_point_A, 2=waiting_point_B, 3=modal_open
- **Features**: Presets (1:1, 1:50, 1:100, etc.), custom value, unit selector

### DwgDrawingCompareDrawer
- **Tipo**: Drawer lateral para comparar revisiones
- **Features**: Picker A/B de versiones, tablas de diff (entities + annotations), onion-skin overlay, botón "Create Variation"

---

## Componentes compartidos usados

| Componente | Shared UI | Función |
|---|---|---|
| `Badge` | `@/shared/ui` | Etiquetas de estado |
| `ConfirmDialog` | `@/shared/ui` | Confirmación de eliminación |
| `DismissibleInfo` | `@/shared/ui` | Banners informativos |
| `ElementInfoPopover` | `@/shared/ui` | Popup de propiedades de entidad |
| `ModuleGuideButton` | `@/shared/ui` | Botón de guía onboarding |
| `DwgUploadIndicator` | `@/shared/ui` | Indicador global de uploads |
| `ConverterInstallProgressBar` | `@/features/bim` | Barra de instalación de converter |

## Stores

| Store | Scope | Función |
|---|---|---|
| `useDwgUploadStore` | Global (Zustand) | Estado de uploads DWG |
| `useProjectContextStore` | Global | Proyecto activo |
| `useToastStore` | Global | Notificaciones toast |
| `useAuthStore` | Global | Token de autenticación |
