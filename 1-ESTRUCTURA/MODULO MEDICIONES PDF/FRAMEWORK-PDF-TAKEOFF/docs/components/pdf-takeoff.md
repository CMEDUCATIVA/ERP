# Componentes — PDF Takeoff

> Árbol de componentes, estado y hooks. Implementación principal en
> `TakeoffViewerModule.tsx` (~5.944 ln) y `TakeoffPage.tsx` (~2.456 ln).

---

## 1. Árbol de componentes
```
TakeoffPage (/takeoff)
├── Tabs (Measurements | Documents & AI) · Compare · How-it-works modal
├── [Measurements] Suspense → TakeoffViewerModule
│     ├── Toolbar (página/zoom/herramientas/Recognize/Save/Scale/Calibrate/Legend/Undo/Redo/Clear/Load)
│     ├── Canvas base (pdf.js render) + Canvas overlay (dibujo)
│     ├── Text input overlay (herramienta Text)
│     ├── Legend overlay (computeGroupSummaries)
│     ├── Sidebar derecho
│     │     ├── Escala + presets + Active Group select
│     │     ├── Tabs Propiedades | Registro
│     │     ├── [Propiedades] Detalle de medición seleccionada + lista agrupada
│     │     │     └── Measurement item × N  (Nombre · Valor · ✏️ · 🔗 · 🗑️)
│     │     │           └── Link-to-BOQ picker (createPortal → canvas, derecha)
│     │     ├── Sección Anotaciones (color picker, delete)
│     │     └── [Registro] MeasurementLedger
│     └── CalibrationDialog (modal)
└── [Documents & AI] DropZone + DocumentCard × N (+ ElementRow al analizar)
```

## 2. Hooks propios
- **`useMeasurementPersistence({ fileName, documentId, measurements, setMeasurements, pageScales, setPageScales, scale, projectId })`** → `{ hasPersistedData, saveNow, clearPersisted, syncing, syncedToServer }`. Carga dual-key, auto-sync (1s), localStorage (500ms), re-key sin wipe, reshape-PATCH (#194).
- Stores Zustand: `useProjectContextStore` (proyecto activo), `useToastStore` (toasts), `useAuthStore` (token para descargas).
- React Query: `analyzeMutation`, `extractTablesMutation`, `uploadMutation`, `serverDocuments` query.

## 3. Estado clave del visor (useState/useRef)
`fileName`, `documentId`(=initialDocId), `pdfDoc`, `currentPage`, `totalPages`, `zoom`,
`measurements`, `pageScales`, `scale`, `activeTool`, `activeGroup`, `selectedMeasurementId`,
`hiddenGroups`, `collapsedGroups`, `sidebarTab`, `showLegend`, `linkingMeasurementId`,
`editingAnnotationId`, `countLabel`, `annotationColor`, `undoStackRef`/`redoStackRef`,
`annotationCounterRef`, `measurementsRef`, `containerRef` (canvas, destino del portal BOQ).

## 4. Librerías de apoyo
- `data/page-scales.ts` — `PageScales`, `hydratePageScales`, `scaleForPage`, `emptyPageScales`.
- `data/scale-helpers.ts` — `formatMeasurement`, derivación de escala, `toRealDistance`, `pixelDistance`.
- `lib/takeoff-groups.ts` — `computeGroupSummaries`, `formatGroupTotal`, `ANNOTATION_TYPES`.
- `lib/takeoff-shortcuts.ts` — `shortcutToTool`, `shouldHandleShortcut`, `SHORTCUT_LETTER`.
- `components/CalibrationDialog.tsx`, `components/MeasurementLedger.tsx`.

## 5. Componentes auxiliares dentro de TakeoffPage
- **`DocumentCard`** — tarjeta de PDF (ver buttons §F). Estado por doc: `analyzing`,
  `extractingTables`, `uploading`, `uploadError`, `analysis`.
- **`ElementRow`** — fila de partida detectada por IA (checkbox + descripción + cantidad).
- **Filmstrip** de documentos (pin/select/delete).
