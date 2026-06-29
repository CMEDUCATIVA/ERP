# Botones — DWG Takeoff (catálogo completo)

> Cada botón/acción de `/dwg-takeoff`, respaldado en `DwgTakeoffPage.tsx` (~6116 ln),
> sus componentes (`components/*`), `api.ts` y el router real `dwg_takeoff/router.py`.
> Formato: **Ubicación · Acción · Handler · API real · Notas**.

---

## A. Paleta de herramientas (`ToolPalette`, sobre el canvas, arriba-izq)
11 herramientas; cada una `selectTool(id)`, `aria-pressed` marca la activa.

| Botón | Icono | Atajo | Tipo | Qué hace |
|---|---|---|---|---|
| **Select** | MousePointer2 | `V` | — | Seleccionar/mover entidades (multi-select) |
| **Pan** | Hand | `H` | — | Desplazar el lienzo |
| **Distance** | Ruler | `D` | medición | Distancia entre 2 puntos → longitud (m) |
| **Line** | Minus | `L` | anotación | Línea (multi-clic, Esc cierra) |
| **Polyline** | Spline | `P` | medición | Polilínea cerrada → área (m²) + perímetro (m) |
| **Area** | PenTool | `A` | medición | Polígono → área (m²) |
| **Rectangle** | Square | `R` | medición | Rectángulo → área (m²) |
| **Circle** | Circle | `C` | medición | Círculo → área (m²) + circunferencia (m) |
| **Arrow** | ArrowRight | — | anotación | Flecha (2 puntos) |
| **Text pin** | Type | `T` | anotación | Pin con texto (popup: etiqueta, color, tamaño) |
| **Calibrate** | Crosshair | `K` | escala | 2 clics + distancia real → fija escala |

**Paleta de color**: 6 presets — `#ef4444` rojo, `#f59e0b` ámbar, `#22c55e` esmeralda,
`#3b82f6` azul, `#8b5cf6` violeta, `#ec4899` rosa. **Modificadores**: `Shift` = orto-lock
(0/45/90°); snaps endpoint/midpoint (intersection "próximamente").

## B. Barra de historial / snap (arriba-izq, junto a la paleta)
| Botón | Handler | Notas |
|---|---|---|
| **Undo** (`Undo2`) | `handleUndo` (Ctrl+Z) | `disabled` si no hay pila; `data-testid="dwg-undo"` |
| **Redo** (`Redo2`) | `handleRedo` (Ctrl+Y / Ctrl+Shift+Z) | `data-testid="dwg-redo"` |
| **Snap menu** (`Target`) | abre dropdown | verde si hay snap activo; `dwg-snap-menu-toggle` |
| ▸ Endpoint snap | toggle `snapModes.endpoint` | `dwg-snap-endpoint` |
| ▸ Midpoint snap | toggle `snapModes.midpoint` | `dwg-snap-midpoint` |
| ▸ Intersection snap | (deshabilitado) | próximamente |

## C. Barra superior-derecha (sobre el canvas)
| Botón | Handler | API real | Notas |
|---|---|---|---|
| **Module guide** (🎓) | abre guía `dwgTakeoffGuide` | — | `ModuleGuideButton` |
| **Compare** (`GitCompare`) | `setShowCompare(true)` | — (abre drawer) | `disabled` sin plano; `dwg-compare-button` |
| **Download PDF** (`FileDown`) | `handleDownloadCanvasPdf` | export en cliente (`lib/pdf-export`) | `disabled` sin plano; `dwg-download-pdf` |
| **Offline Ready badge** | toggle hint / instalar converter | `GET /offline-readiness/` · `POST /v1/takeoff/converters/dwg/install/` | 🟢/🟡; invalida `dwg-offline-readiness`, `bim-converters` |

## D. Panel derecho — cabecera Summary + 5 pestañas
Pestañas (`setRightTab`): **Layers · Annotations · Properties · Scale · Summary**
(`dwg-right-tab-*`). KPIs siempre visibles: nº entidades, Σ área, Σ distancia.

### D.1 Tab **Layers**
| Botón | Handler | Notas |
|---|---|---|
| **Show all / Hide all** (capas) | `onShowAll`/`onHideAll` | `LayerPanel` |
| **Toggle por capa** | set visibilidad | persiste: `PATCH /drawings/{id}/layers` |
| **Show all / Hide all** (tipos) | `onShowAllNames`/`onHideAllNames` | `EntityNameFilter` (TEXT/LINE/CIRCLE…) |

### D.2 Tab **Annotations**
| Elemento | Handler | API real |
|---|---|---|
| **Fila de anotación** (clic) | `setSelectedAnnotationId` | — |
| **🗑️ Eliminar** (`Trash2`) | confirm → `deleteAnnotationMutation` | `DELETE /annotations/{id}` |

### D.3 Tab **Properties** — entidad seleccionada + sección "Attach To"
Muestra tipo, capa, color, id, longitud/área/perímetro/radio según entidad.
**Attach To** (5 integraciones cross-módulo):
| Botón | Icono | Handler | Destino / API |
|---|---|---|---|
| **Link to BOQ** | Link2 (azul) | `handleOpenLinkToBoq(id)` | abre picker BOQ (panel §E) → `POST /annotations/{id}/link-boq/` |
| **+ New Task** | ListChecks (ámbar) | abre `CreateTaskFromDwgModal` | módulo **Tasks**: `POST /v1/tasks/` (metadata `dwg_drawing_id`, `dwg_entity_ids`) |
| **+ Link Document** | FileText (violeta) | abre `LinkDocumentToDwgModal` | módulo **Documents**: `PATCH /v1/documents/{id}` (merge metadata) |
| **+ Link Activity** | CalendarDays (esmeralda) | abre `LinkActivityToDwgModal` | módulo **Schedule**: `PATCH /v1/schedule/schedules/{sid}/activities/{aid}` |
| **+ Link Requirement** | ClipboardCheck (violeta) | abre `LinkRequirementToDwgModal` | módulo **Requirements** |

### D.4 Tab **Scale** (`ScaleTab`) — 3 modos
| Modo | Controles | Persistencia |
|---|---|---|
| **Preset** | selector 1:10/1:20/1:50/1:100/1:200… + input denominador | `PATCH /drawings/{id}/scale/` (`scale_denominator`, `scale_mode`) |
| **Calibrated** | **Pick two points** (`onStartCalibration`) + distancia real + unidad (m/cm/mm) + **Apply Calibration** (`dwg-scale-calibrate-apply`) | idem PATCH scale; calibración en localStorage `calibration-store` |
| **Per-annotation** | input denominador por anotación (`scale_override`) | en cada anotación |

### D.5 Tab **Summary** (`SummaryTab`)
| Botón | Handler | API real |
|---|---|---|
| **Export CSV** (`Download`) | `handleExportCsv` / `onExportCsv` | cliente (columnas: type, text, value, unit, linked_boq_position_id) — `dwg-summary-export` |
| **Export PDF** | `onExportPdf` | cliente — `dwg-summary-export-pdf` |
| KPI cards (4) + desglose **por capa** y **por tipo** | — | no interactivos |

## E. Panel "Link to BOQ" (anclado a la derecha, dentro del canvas)
Se abre con **Link to BOQ** o desde el menú contextual.
| Elemento | Handler | API real |
|---|---|---|
| **Close (X)** | `setLinkingEntityId(null)` | — |
| **Project select** | carga BOQs | query `projects-for-boq-picker` / `boqs-for-boq-picker` |
| **BOQ select** | carga posiciones | — |
| **Pick existing / + Create new** | `setLinkPickerMode` | "create" deshabilitado sin BOQ |
| **Fila de posición** (clic) | `handleCreateAndLink(entityId)` | crea `text_pin` en el centroide + `POST /annotations/{id}/link-boq/` (opc. `push_quantity`) |
| (resultado) | invalida `annotations-dwg-{id}`, `boq-positions` | |

## F. Menú contextual (clic derecho sobre entidad) — `DwgContextMenu`
| Acción | Icono | Handler | Destino |
|---|---|---|---|
| **Hide** | EyeOff | `onHide` (hiddenEntityIds) | selección |
| **Isolate** | Eye | `onIsolate` | selección |
| **Link to BOQ** | Link2 | `onLink` | panel §E |
| **Save as group** | FolderPlus | `onSaveAsGroup` | `POST /groups/` (RFC 11) |
| **+ New task** | CheckSquare | `onCreateTask` | Tasks |
| **+ Link activity** | CalendarDays | `onLinkSchedule` | Schedule |
| **+ Link document** | FileText | `onLinkDocument` | Documents |
| **+ Link requirement** | ClipboardCheck | `onLinkRequirement` | Requirements |

## G. Compare drawer (`DwgDrawingCompareDrawer`)
| Elemento | Acción | API real |
|---|---|---|
| **Before / After** selects | elegir versiones | `GET /drawings/{id}/versions/` |
| **Hide unchanged** | filtra sin cambios | — |
| **Onion-skin + opacidad** | overlay visual | `onOverlayChange({enabled,opacity})` |
| Tabs **Entities / Annotations / Summary** | diff por capa / por anotación (con impacto de costo) | `POST /drawings/{id}/compare/{other_version_id}` |
| **Create Variation** (`FilePlus2`) | crea variación *borrador* | `POST /drawings/{id}/compare/create-variation` (permiso `variations.create`) |

## H. Filmstrip de planos (`SheetStrip`, abajo) + Upload
| Botón | Acción | API real |
|---|---|---|
| **Plano (clic)** | abre en el visor | `GET /drawings/{id}` (poll de estado) |
| **➕ Upload** | abre modal | — |
| Drop zone / file input | elegir DWG/DXF | `dwg-modal-drop-zone` |
| Form (Name + Discipline) + **Upload** | `onUpload` → `uploadDrawing` | `POST /drawings/upload/?project_id=&name=&discipline=` |

## I. Indicador de subida global (`DwgUploadIndicator`, abajo-der)
| Elemento | Acción | Notas |
|---|---|---|
| Job (uploading→converting→ready/error) | `useDwgUploadStore.startUpload` + `pollUntilReady` | poll `GET /drawings/{id}` 3.5s→15s, timeout 20 min |
| **Cancel / Dismiss** | cancela/oculta job | auto-dismiss: éxito 8s, error 5 min |
| **Open** | navega a `/dwg-takeoff?project_id=&drawing_id=` | |

## Reglas de afordancia (consistentes con el módulo PDF)
- **Borrados** siempre llaman al backend (`DELETE /annotations/{id}`); confirm previo.
- **IA/automatización propone, humano confirma**: "Create Variation" produce un *borrador*.
- **Escala con fuente de verdad en el servidor** (`scale_denominator` en el plano), no solo localStorage.
- Mediciones en `Numeric(18,6)` para no acumular deriva de float al sumar al BOQ.
