# UI / Pantallas — Mediciones BIM 3D

> Botones/herramientas detallados en [buttons](buttons/bim-3d.md).

## Rutas (App.tsx, lazy)
| Ruta | Componente | Propósito |
|---|---|---|
| `/bim` · `/bim/:modelId` | `BIMPage` | **Visor 3D principal** + cuantificación |
| `/projects/:pid/bim[/:modelId]` | `BIMPage` | Visor con proyecto en la URL |
| `/bim/federations` | `FederationsPage` | Coordinación multi-modelo (federaciones) |
| `/bim/rules` (alias `/bim/quantity-rules`) | `BIMQuantityRulesPage` | Constructor de **reglas de cantidad** + linking masivo |
| `/assets` | `AssetsPage` | Registro de activos vinculados (ISO 19650) |

## BIMPage — layout (cabecera v1.1.0)
```
┌──────────────────────────────────────────────────────────────────────┐
│ Cabecera (1 fila, z-50):  +Añadir · 🔻Filtrar · [Aislar] · ▦Paneles▾  │
│                           ⌖Selección▾ · 🎨Apariencia▾ · ↗Ir a▾ · ?Ayuda▾│
├───────────────────────────────────────────────┬───────────────┐      │
│  Visor 3D (Three.js)            ╭─Ayuda(z-40)─╮│ Panel derecho │      │
│  ┌ ViewerToolbar (flotante):    │ flotante ↔ ?││ (5 pestañas)  │      │
│  │ Sección · Walk · Medir ·     ╰─────────────╯│ Properties    │      │
│  │ ViewCube · Home/Fit · color                 │ Layers/Tools  │      │
│  │  [malla GLB/DAE, selección, ghost/isolate]  │ Groups/Color  │      │
│  └ TimelineScrubber (4D, si hay cronograma)    │               │      │
├───────────────────────────────────────────────┴───────────────┘      │
│  Tarjetas de modelo (nombre truncado 12) · conversión · subir         │
└────────────────────────────────────────────────────────────────────────┘
```
- **Cabecera**: fila única con menús agrupados (ver [buttons §0](buttons/bim-3d.md)). z-50 → los
  desplegables se pintan sobre el visor y los paneles.
- **Panel de ayuda** (`BIMHelpPanel`, z-40): flotante arriba-derecha; abierto ↔ círculo "?" ↔ oculto.

## Estados de la pantalla
| Estado | Condición | UI |
|---|---|---|
| Sin modelo | proyecto sin modelos 3D | landing / subir |
| Convirtiendo | `status='processing'` | tarjeta de progreso DDC |
| Necesita converter | `status='needs_converter'` | CTA "Instalar converter" (`InstallConverterPrompt`) |
| Error | `status='failed'/'error'` | `BIMConverterStatusBanner` con motivo |
| Listo | `status='ready'` | visor 3D con la malla + herramientas |
| Cargando geometría | fetch GLB/DAE | spinner (estado vacío manejado: malla 404 = estado esperado) |
| Modo medición | herramienta Medir activa | snapping + etiquetas |
| 4D activo | scrubber con fecha | elementos coloreados por estado de cronograma |

## Panel derecho — 5 pestañas (`BIMRightPanelTabs`)
| Pestaña | Componente | Contenido |
|---|---|---|
| **Properties** | `BIMLinkedBOQPanel` | datos del elemento + posiciones BOQ ligadas + "Add to BOQ" + "+ Tarea/Documento/Actividad/Requisito" |
| **Layers** | `BIMLayersPanel` | visibilidad/opacidad por categoría (ojo + slider), Show/Hide all |
| **Tools** | `BIMToolsPanel` | herramienta de medición, **Saved Views**, **Selection Sets** |
| **Groups** | `BIMGroupsPanel` | grupos guardados (aislar/resaltar/link BOQ/borrar) |
| **Color** | `ColorByPropertyPanel` | modo de color: default/disciplina/storey/tipo/validación/cobertura BOQ/doc/progreso/5D/4D |

## Modos de color (visor)
default · discipline · storey · type · validation (rojo/ámbar/verde/gris) · boq_coverage (verde/rojo) ·
document_coverage · by_progress (rampa 0→100%) · 5d_cost · 4d_schedule.

## FederationsPage / FederatedViewer
Escena multi-modelo (`FederatedViewerScene`): añadir miembros (GLB), aislar por IfcClass, frame all,
color por disciplina, toggle de visibilidad por miembro; leyenda (`FederatedViewerLegend`) con
disciplina + conteo. Salud por miembro (escalera de severidad).

## AssetsPage / BIMQuantityRulesPage
- **AssetsPage**: lista de elementos `is_tracked_asset`; `AssetEditModal` / `AssetDetailDrawer`.
- **BIMQuantityRulesPage**: definir reglas (filtro tipo/propiedad, fuente de cantidad, unidad, waste,
  destino existente/auto-create), **sandbox** de previsualización, plantillas (Muros/Losas/Puertas/Ventanas).

## i18n
Claves bajo `bim.*` en `frontend/src/app/locales/*.ts`. (Estado de traducción al español: no auditado
en este framework.)
