# UI — Módulo DWG Takeoff

## Pantalla principal: `/dwg-takeoff`

### Layout

```
┌────────────────────────────────────────────────────────┐
│  Header (compartido)                                   │
│  [Project Selector]  [DWG Takeoff]  [Offline Badge]    │
├────────────────────────────────────────────────────────┤
│  Toolbar                                               │
│  [Select(V)] [Pan(H)] [Distance(D)] [Line(L)] ...      │
│  [Color: 🔴🟡🟢🔵🟣🟧]  [Undo] [Redo] [Snap] ...      │
├──────────────────────┬─────────────────────────────────┤
│                      │  Panel Derecho                  │
│   Canvas2D           │  ┌─ Layers ──────────────────┐  │
│   (DxfViewer)        │  │ ☑ A-WALL       (120 ents) │  │
│                      │  │ ☑ A-DOOR       (45 ents)  │  │
│   [Grid AutoCAD]     │  │ ☐ A-FURN       (89 ents)  │  │
│   [Entidades DXF]    │  │ ☑ USER_MARKUP  (12 anns)  │  │
│   [Anotaciones]      │  └───────────────────────────┘  │
│                      │  ┌─ Annotations ─────────────┐  │
│                      │  │ 📏 Distance 12.5m          │  │
│                      │  │ 📐 Area 45.2m²             │  │
│                      │  │ 📌 Text: "Column C4"       │  │
│                      │  └───────────────────────────┘  │
│                      │  ┌─ Properties ──────────────┐  │
│                      │  │ Type: LWPOLYLINE           │  │
│                      │  │ Layer: A-WALL              │  │
│                      │  │ Perimeter: 24.5m           │  │
│                      │  │ Area: 45.2m²               │  │
│                      │  │ Closed: Yes                │  │
│                      │  └───────────────────────────┘  │
├──────────────────────┴─────────────────────────────────┤
│  Filmstrip (SheetStrip)                                │
│  [📄 Planta Baja] [📄 Planta Alta] [📄 Sección A] ...│
│  [➕ Upload]                                           │
└────────────────────────────────────────────────────────┘
```

### Estados de la pantalla

| Estado | Condición | UI |
|---|---|---|
| **Empty (sin proyecto)** | `projectId === ''` | Hero: "Select a project" |
| **Empty (sin planos)** | `drawings.length === 0` | Upload card + GridBackground |
| **Loading** | `loadingDrawings === true` | Spinner |
| **Converting** | `drawingStatus === 'processing'` | ConversionProgressCard con elapsed time |
| **Needs Conversion** | `drawingStatus === 'needs_conversion'` | "Convert with cad2data" CTA |
| **Error** | `drawingStatus === 'error'` | Error card con error_message |
| **Empty drawing** | `drawingStatus === 'empty'` | "0 entities found" |
| **Ready** | `drawingStatus === 'ready'` | Canvas2D con entidades + herramientas |
| **Deep-link importing** | `importingDocId !== null` | "Opening document…" |
| **Compare mode** | `showCompare === true` | DwgDrawingCompareDrawer overlay |

---

## Paleta de herramientas

| Herramienta | Icono | Atajo | Descripción |
|---|---|---|---|
| Select | MousePointer2 | `V` | Seleccionar entidades |
| Pan | Hand | `H` | Mover el plano |
| Distance | Ruler | `D` | Medir distancia entre 2 puntos |
| Line | Minus | `L` | Medir línea simple |
| Polyline | Spline | `P` | Medir polilínea (múltiples clicks) |
| Area | PenTool | `A` | Medir área (polígono cerrado) |
| Rectangle | Square | `R` | Medir área rectangular |
| Circle | Circle | `C` | Medir círculo click+arrastre |
| Arrow | ArrowRight | — | Anotar con flecha |
| Text pin | Type | `T` | Anotar con texto |
| Calibrate | Crosshair | `K` | Calibrar escala (2 puntos) |

**Colores**: 6 presets (rojo, ámbar, verde, azul, violeta, rosa)

---

## Panel derecho (tabs)

| Tab | Contenido |
|---|---|
| **Layers** | Lista de capas con toggle visible/no visible, entity count, color dot, search |
| **Annotations** | Lista de anotaciones con tipo, valor medido, texto, acciones (edit, delete, link) |
| **Properties** | Propiedades de la entidad seleccionada: tipo, capa, color, mediciones |
| **Summary** | Resumen agregado: total entities, total layers, extent |
| **Scale** | Ajuste de escala: preset (1:1, 1:50, 1:100, etc.), custom, o calibrate button |

---

## Modales

| Modal | Disparador | Función |
|---|---|---|
| `CalibrationDialog` | Botón "Calibrate" / tool K | Input de distancia real entre 2 puntos |
| `CreateTaskFromDwgModal` | Click derecho → "Create Task" | Crear tarea vinculada a entidades |
| `LinkDocumentToDwgModal` | Click derecho → "Link Document" | Vincular documento existente |
| `LinkActivityToDwgModal` | Click derecho → "Link Activity" | Vincular actividad de cronograma |
| `LinkRequirementToDwgModal` | Click derecho → "Link Requirement" | Vincular requerimiento |
| `DwgDrawingCompareDrawer` | Botón GitCompare | Comparar revisiones A/B |
| `ElementInfoPopover` | Click en entidad | Ver/editar BOQ link, propiedades |
| `ConfirmDialog` | Botón delete | Confirmar eliminación |

---

## Indicadores globales

| Indicador | Ubicación | Función |
|---|---|---|
| `DwgUploadIndicator` | Layout (junto a BIM indicator) | Progreso de uploads en background |
| `OfflineReadyBadge` | Toolbar derecha | Estado del converter local (🟢/🟡) |
| `ConverterInstallProgressBar` | Tooltip del badge | Progreso de instalación DDC |

---

## Cambios de UX e i18n (2026-06-28)

- **Afordancia de visibilidad**: en `LayerPanel` y `EntityNameFilter` **solo el ojo** alterna
  mostrar/ocultar (la fila es un `<div>` inerte; el ojo es un `<button>` con `data-testid`
  `dwg-layer-eye-toggle` / `dwg-name-eye-toggle`). Antes la fila completa alternaba. Mismo
  principio que la leyenda del PDF (D-TKC-UP10).
- **Aviso de duplicado**: caja **ámbar** en la cabecera (`data-testid="dwg-duplicate-warning"`)
  con pre-check por filename + fallback al 409, en vez de un toast rojo con el JSON crudo.
- **Filmstrip**: el nombre del plano se trunca a **12 caracteres + "…"** (`FILMSTRIP_NAME_MAX`)
  con `title` del nombre completo, para no tapar el botón eliminar.
- **Panel derecho**: ancho `w-72` → **`w-96`** (288 → 384 px).
- **Tipos de entidad localizados**: en `EntityNameFilter` y en "Por tipo" del Resumen, los
  tipos se muestran traducidos (LINE→Línea, CIRCLE→Círculo, HATCH→Achurado…) vía claves
  `dwg_takeoff.etype_*`; los nombres de bloque reales y tipos desconocidos pasan sin traducir.
- **i18n**: módulo localizado al español (hero, modal de subida, card de conversión, filmstrip,
  panel derecho completo: pestañas + LayerPanel + EntityNameFilter + pestaña Resumen). Claves en
  `frontend/src/app/locales/es.ts` bajo `dwg_takeoff.*`.
