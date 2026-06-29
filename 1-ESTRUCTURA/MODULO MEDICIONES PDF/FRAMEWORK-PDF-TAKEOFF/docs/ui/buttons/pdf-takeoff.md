# Botones — PDF Takeoff (catálogo completo)

> Formato por botón: **Ubicación · Acción · Handler/Evento · API · Resultado · Notas**.
> Todo respaldado en `TakeoffViewerModule.tsx` y `TakeoffPage.tsx`.

---

## A. Barra de herramientas del visor (sobre el canvas)

### A.1 Navegación de página
| Botón | Acción | Handler | Notas |
|---|---|---|---|
| **◀ Previous page** | Página anterior | `setCurrentPage(p-1)` | `disabled` en página 1. Resetea dibujo en curso. |
| **Page jump `1/N`** | Salta a página | `<details>` + input | Muestra `current/total`. |
| **▶ Next page** | Página siguiente | `setCurrentPage(p+1)` | `disabled` en última. |

### A.2 Zoom
| Botón | Acción | Handler |
|---|---|---|
| **Zoom out** | Reduce zoom | `setZoom(z/1.1)` (mín 0.25) |
| **`100%`** | Indicador (no botón) | muestra `zoom` |
| **Zoom in** | Aumenta zoom | `setZoom(z*1.1)` (máx 4.0) |
| **Fit (Maximize)** | Ajustar a pantalla | recalcula zoom para encajar el PDF |

### A.3 Herramientas de MEDICIÓN (cuentan en totales; van al grupo activo)
Cada una hace `selectTool(tool)`; `aria-pressed` indica activa; tienen atajo de teclado.
| Botón | Atajo | `data-tool` | Qué dibuja |
|---|---|---|---|
| **Select** | `V` | `select` | Seleccionar/mover/editar vértices |
| **Distance** | `D` | `distance` | Recta entre 2 puntos → longitud |
| **Polyline** | `P` | `polyline` | Polilínea (doble clic para cerrar) → longitud |
| **Area** | `A` | `area` | Polígono → área (m²) + perímetro |
| **Rectangle** | `E` | `rectarea` | Rectángulo → área |
| **Volume** | `O` | `volume` | Polígono + profundidad → volumen (m³) |
| **Count** | `C` | `count` | Puntos → conteo (categoría = `countLabel`) |

### A.4 Herramientas de ANOTACIÓN (NO cuentan en totales; `label` vacío)
| Botón | Atajo | `data-tool` | Qué dibuja |
|---|---|---|---|
| **Cloud** | `W` | `cloud` | Nube de revisión (doble clic para cerrar) |
| **Arrow** | `X` | `arrow` | Flecha |
| **Text** | `T` | `text` | Texto (input inline) |
| **Rectangle** | `R` | `rectangle` | Rectángulo anotación |
| **Highlight** | `H` | `highlight` | Resaltado |

### A.5 Acciones especiales de la toolbar
| Botón | Acción | Handler | API | Resultado |
|---|---|---|---|---|
| **Recognize** (✨ violeta) | Detección **offline** de geometría de la página | `handleRecognize` | `POST /documents/{id}/recognize/` | Crea mediciones `suggested` (sin persistir) para aceptar/rechazar |
| **Save PDF** (✓ verde) | Exporta PDF con mediciones/markups | `handleExportPdf` | — (genera en cliente) | Descarga PDF |
| **Scale** | Abre ajuste de escala manual | `setSettingScale(true)` | — | Permite fijar px↔unidad |
| **Calibrate** | Calibración por 2 clics (marcar dimensión conocida) | `setCalibrationMode(true)` | — | Abre `CalibrationDialog` tras 2 puntos |
| **Calibrate badge** (ámbar ⚠️) | Aviso "plano no calibrado" → calibrar | igual que Calibrate | — | Solo visible si la página no está calibrada |
| **Legend** | Muestra/oculta overlay de leyenda | `setShowLegend(v=>!v)` | — | `aria-pressed` |
| **Undo** | Deshacer (Ctrl+Z) | `handleUndo` | a veces `DELETE`/recreate | Revierte última op (pila `undoStackRef`) |
| **Redo** | Rehacer (Ctrl+Y) | `handleRedo` | — | Pila `redoStackRef` |
| **Clear all** (🗑️) | Borra TODAS las mediciones | `setShowClearConfirm(true)` → `clearAll` | `DELETE /measurements/{id}` por cada una | **Con confirmación**. Persiste el borrado (D-TKC-UP14) |
| **Load new PDF** (input file) | Cargar PDF local | `handleFileUpload` → `onLocalFileOpened` | sube vía `POST /documents/upload/` | Abre el PDF en el visor |

## B. Panel lateral derecho

### B.1 Cabecera de escala / grupo
| Elemento | Acción |
|---|---|
| **Presets `1:10 / 1:20 / 1:25 / 1:50`** | Fijan la escala rápida de la página |
| **Active Group `<select>`** | Grupo activo donde caen nuevas mediciones (General, Structural, Electrical, Plumbing, HVAC, Finishing, Excavation, Concrete) |
| **Tabs `Propiedades` / `Registro`** | `setSidebarTab('properties' \| 'ledger')`. Persiste en `localStorage('takeoff.sidebarTab')` |

### B.2 Cabecera "Measurements (N)"
| Botón | Acción | Handler |
|---|---|---|
| **Synced / Syncing** | Indicador de estado (no botón) | `syncedToServer` / `syncing` |
| **Save measurements** (💾) | Guardado manual inmediato | `saveNow` (localStorage + `bulkCreate`) |

### B.3 Cabecera de grupo (en la lista)
| Botón | Acción | Handler |
|---|---|---|
| **Collapse/Expand (chevron)** | Plegar grupo | `toggleGroupCollapse(group)` |
| **Hide/Show (ojo)** | Ocultar grupo en el plano | `toggleGroupVisibility(group)` (set `hiddenGroups`) |

### B.4 Ítem de medición (fila) — **diseño consolidado (D-TKC-UP12)**
> El **cuerpo de la fila NO tiene onClick** (centro libre, valor copiable). Layout:
> `[●] Nombre  Valor(copiable)        [✏️] [🔗] [🗑️]`
| Elemento | Acción | Handler | API |
|---|---|---|---|
| **Nombre** (texto) | Editar nombre (rename) | `startEditAnnotation(m)` | (sync) |
| **Valor** (`m.label`) | Texto seleccionable/copiable | — (`select-text`) | — |
| **✏️ Editar propiedades** | Selecciona la medición → abre panel Propiedades | `setSelectedMeasurementId(toggle)` | — |
| **🔗 Link to BOQ** | Abre el selector de BOQ (panel dentro del canvas, derecha) | `handleOpenLinkToBoq(id)` | — |
| **🗑️ Eliminar** | Borra la medición | `deleteMeasurement(id)` | `DELETE /measurements/{serverId}` | Persiste (D-TKC-UP14) |
| **Accept ✓ / Reject ✗** | (solo `suggested`) aceptar/rechazar sugerencia IA | `acceptSuggestion`/`rejectSuggestion` | — |

### B.5 Pie del grupo (panel Propiedades)
| Botón | Acción | Handler | Notas |
|---|---|---|---|
| **Add N to BOQ** | Empuja las seleccionadas a una posición/nueva | `onAddToBOQ` | `disabled` si 0 seleccionadas; aviso si no hay BOQ |
| **Annotation color** (`<input type=color>`) | Cambia color de anotación | (set color) | Solo anotaciones |

## C. Overlay de Leyenda (abajo-izq del canvas)
| Botón | Acción | Handler | Notas |
|---|---|---|---|
| **Hide legend (X)** | Oculta toda la leyenda | `setShowLegend(false)` | |
| **Legend row — eye toggle** | Ocultar/mostrar ese grupo | `toggleGroupVisibility(group)` | **Solo el ojo** alterna (D-TKC-UP10); el resto de la fila es informativo |

## D. Selector "Link to BOQ" (panel dentro del canvas, derecha — D-TKC-UP13)
Se abre con 🔗. Vía `createPortal` al `containerRef` del canvas, `absolute right-3`, 380px.
| Elemento | Acción | Handler | API |
|---|---|---|---|
| **Close (X)** | Cierra | `setLinkingMeasurementId(null)` | — |
| **Project `<select>`** | Elige proyecto | `handlePickerProjectChange` | `GET /boq/boqs/?project_id=` |
| **BOQ `<select>`** | Elige presupuesto | `handlePickerBoqChange` | carga posiciones |
| **Pick existing / + Create new** | Modo | `setLinkPickerMode` | — |
| **Search** | Filtra posiciones | `setLinkPickerSearch` | — |
| **Fila de posición** | Vincula y empuja cantidad | `handleLinkToPosition(id,pos)` | `POST /measurements/{id}/link-to-boq/` |
| **Unlink** | Desvincula | `handleUnlinkMeasurement(id)` | `PATCH /measurements/{id}` (linked=null) |
| **Create position & link** | Crea posición nueva con la cantidad | `handleCreateAndLink(id)` | crea posición + link |

## E. Tabs y cabecera de la página `/takeoff`
| Botón | Acción | Handler |
|---|---|---|
| **Measurements** (tab) | Vista de medición | `setActiveTab('measurements')` |
| **Documents & AI** (tab) | Gestión de PDFs / IA | `setActiveTab('documents')` |
| **Compare** | Comparar dos PDFs (delta de costo) | abre drawer de comparación → `POST /measurements/compare/` |
| **How it works** (🎓) | Guía del módulo | abre modal de `takeoffGuide` |

## F. Tarjeta de documento (pestaña Documents & AI) — `DocumentCard`
| Botón | Acción | Handler | API | Notas |
|---|---|---|---|---|
| **Analizar con IA** (✨ primario) | LLM lee el **texto** del PDF → partidas | `handleAnalyze` → `analyzeMutation` | `POST /documents/{id}/analyze/` | Requiere proveedor IA (tu clave). `onError`/`onSuccess(0)` muestran toast (D-TKC-UP15/UP16) |
| **Extraer tablas** (secundario) | Extrae tablas → partidas | `handleExtractTables` | `POST /documents/{id}/extract-tables/` | Igual feedback de error |
| **Ver** (ghost, ojo) | Abre el PDF en el visor | `onView` → `handleOpenDocInViewer` | sirve `GET /documents/{id}/download/` | |
| **X (Eliminar)** | Borra el documento **y sus mediciones (cascada)** | `handleRemoveDocument` | `DELETE /documents/{id}` | ⚠️ **Sin confirmación** — riesgo de pérdida (mejora pendiente) |
| **Select all / Deselect all** | (tras analizar) marca/desmarca elementos | `onSelectAll`/`onDeselectAll` | — | |
| **Checkbox por elemento** | Incluir/excluir partida | `onToggleElement` | — | |

## G. Filmstrip / tira de documentos
| Botón | Acción | Handler |
|---|---|---|
| **Doc (click)** | Abre en el visor | `onSelectDoc` → `handleOpenDocInViewer` |
| **Pin** | Fija el doc arriba | `togglePin` (localStorage) |
| **✕ (borrar)** | Borra el documento | `onDeleteDoc` → `handleRemoveDocument` |
| **Upload new** | Subir | abre input file |

## Reglas de afordancia aprendidas (no repetir errores)
- **Leyenda**: solo el **ojo** oculta; el resto de la fila informativo (D-TKC-UP10).
- **Ítem de medición**: el centro **no** dispara nada (era el bug de abrir Propiedades por error, D-TKC-UP12); editar nombre = clic en el nombre; abrir Propiedades = ✏️.
- **Borrados** siempre llaman al backend (D-TKC-UP14).
- **Errores de IA** nunca silenciosos: toast con el motivo (D-TKC-UP15/UP16).
