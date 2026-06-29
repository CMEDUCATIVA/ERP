# Botones y Herramientas — Mediciones BIM 3D

> Catálogo de acciones del visor 3D y de la cuantificación. Respaldado en
> `ViewerToolbar.tsx`, `BIMViewer.tsx`, los paneles y modales, y `api.ts`.

## 0. Cabecera de página (`BIMPage` header — v1.1.0)
Una **sola fila** sobre el visor (no confundir con la `ViewerToolbar` flotante dentro del canvas).
`+ Añadir modelo` y `Filtrar` (más usado, con badge de visibles) son botones sueltos; `Aislar`
(contextual, al seleccionar) va al lado de `Filtrar`. El resto se agrupa en **menús desplegables**
(`HeaderMenu`), cada uno con badge de conteo de toggles activos:

| Menú | `data-testid` | Contiene |
|---|---|---|
| **Paneles** | `bim-menu-panels` | Resumen · Presupuesto vinculado · Búsqueda de propiedades · Instantáneas · Vistas Inteligentes · Comparar versiones |
| **Selección** | `bim-menu-selection` | Dimensiones (bbox) · Ficha de activo (overlays al seleccionar) |
| **Apariencia** | `bim-menu-appearance` | *Colorear por* (select) + *Calidad de render* (Rápida/Predet./Visual/Recorrido) |
| **Ir a** | `bim-menu-goto` | Reglas · Ver en el mapa · Explorador de datos (saltos a otros módulos) |
| **Ayuda** | `bim-menu-help` | Recorrido guiado (`ModuleHelpButton`) · Cómo funciona (`ModuleGuideButton`) |

- Ítems toggle = `menuitemcheckbox` (varios a la vez, **no** cierran el menú); `Colorear`/`Calidad` =
  selección única. Cierre por **click-fuera** y `Esc`.
- Apilamiento: cabecera `z-50`, desplegables `z-50` → sobre visor y paneles.
- Componentes: `features/bim/HeaderMenu.tsx` (`HeaderMenu` + `MenuLabel`/`MenuCheck`/`MenuAction`).

## 0b. Panel de ayuda flotante (`BIMHelpPanel` — v1.1.0)
Intro del módulo como panel **flotante** arriba-derecha (media anchura, `z-40`), no banner en flujo.
Estados: **abierto** (arranca siempre, solo por sesión) ↔ **círculo "?"** (minimizado, `data-testid`
`bim-help-fab`) → **desaparece a los 10 s**. Auto-minimiza una vez a los **60 s**; `[—]`/`[✕]`
encogen igual; reapertura **solo** por el "?". Sustituye a `DismissibleInfo` solo en BIM.

## A. Barra del visor 3D (`ViewerToolbar`, flotante)
| Botón | Icono | Acción | Notas |
|---|---|---|---|
| **Sección (Section Box)** | Crop | Caja AABB que recorta el modelo | sub-acciones: *Fit a selección*, *Fit a todo*, *Reset*; `Esc` sale |
| **Walk mode** | Move3d | Navegación primera persona | `WASD`/flechas, `Space`/`Shift` arriba/abajo, `Shift+W` sprint; slider de velocidad |
| **Medir** | Ruler | Medición sobre la malla | clic puntos; clic derecho cancela; `Esc` sale (ver §C) |
| **ViewCube** | — | Orientar la cámara (top/front/iso…) | `BIMViewCube` |
| **Home / Fit** | — | Encadre / vista inicial | |
| **Colores** | Palette | Cambia el modo de color | (panel Color) |

## B. Cámara base
Orbit / Pan / Zoom (OrbitControls). Al activar Walk/Medir, el host puede **vetar** y desactivar
OrbitControls (`onBeforeToolEnable`).

## C. Medición (clave del módulo)
**`MeasureTool`** (simple): distancia punto-a-punto.
- Clic 1 → raycast + **snap a vértice** (≤8 px) → marcador amarillo.
- Clic 2 → emite `{pointA, pointB, distance, axisProjections}` → línea discontinua + etiqueta.
- Etiqueta: `"X.XXX m"` (≥1 m) o `"XXXX mm"` (<1 m). `clearAll()` borra todas.

**`MeasureManager`** (avanzado): `distance | area | angle`.
- **distance**: 2 clics.
- **area**: ≥3 clics (doble clic / Enter cierra) → área m² (**método de Newell 3D**) + perímetro m.
- **angle**: 3 clics → ángulo en el vértice central (grados).
- Snap por **`SnapDetector`** (≤12 px): vértice (cuadrado), punto-medio (círculo), perpendicular (rombo).
- Math en `measureMath.ts` (`angleBetween3`, `polygonArea3`, `polygonPerimeter3`, `centroid3`).
- Persisten en `useBIMMeasurementsStore` (por modelo); badge de conteo en el panel Tools.

## D. Panel Properties (`BIMLinkedBOQPanel`) — del elemento seleccionado
| Botón | Acción | API / módulo |
|---|---|---|
| **Add to BOQ** | abre `AddToBOQModal` | crea `BOQElementLink` → BOQ |
| **Unlink** (por link) | quita el vínculo | `DELETE /links/{id}` (re-sync cantidad) |
| **+ Nueva tarea** | `CreateTaskFromBIMModal` | módulo Tasks |
| **+ Vincular documento** | `LinkDocumentToBIMModal` | módulo Documents |
| **+ Vincular actividad** | `LinkActivityToBIMModal` | módulo Schedule (4D) |
| **+ Vincular requisito** | `LinkRequirementToBIMModal` | módulo Requirements |

## E. AddToBOQModal (cuantificación → 5D)
| Pestaña / control | Acción | API |
|---|---|---|
| **Vincular a posición existente** | buscar posición → clic | `createLink()` por elemento |
| **Crear posición nueva** | form (descripción, unidad, cantidad, tarifa, ordinal, clasificación) | `boqApi.addPosition()` + `createLink()` |
| Cantidad sugerida | `suggestQuantityFromBIM(elements, unit)` (volumen→área→longitud→conteo) | — |
| (modo masivo) | agrega totales; 1 posición + 1 link por elemento | invalida `['bim-elements']` |

## F. BIMQuantityRulesPage (reglas masivas)
| Control | Acción |
|---|---|
| Filtro (tipo de elemento + propiedades) | define a qué elementos aplica |
| Fuente de cantidad | area_m2 / volume_m3 / length_m / weight_kg / count / custom |
| Unidad + `waste_factor_pct` + `multiplier` | ajuste |
| Destino | **existente** (posición) o **auto_create** (crea posición) |
| **Sandbox / Preview** | `runSandbox()` muestra elementos que matchean antes de aplicar (`checkUnitSafety`) |
| **Aplicar** | `POST /quantity-maps/apply/` (dry-run → persistir) |
| Plantillas | Muros-área · Losas-volumen · Puertas-conteo · Ventanas-conteo |

## G. Panel Layers (`BIMLayersPanel`)
Por categoría: **toggle ojo** (visibilidad) + **slider de opacidad**; *Show all / Hide all*.

## H. Panel Groups (`BIMGroupsPanel`)
Por grupo: **Aislar**, **Resaltar**, **Link a BOQ**, **Borrar**; **+ Nuevo** (criterio de filtro).

## I. Panel Tools (`BIMToolsPanel`)
Herramienta de medición · **Saved Views** (cámaras: restaurar/borrar, `SavedViewsStore`) ·
**Selection Sets** (selecciones nombradas con color, `SelectionSetsStore`, localStorage por modelo).

## J. Menú contextual del visor (`BIMContextMenu`)
Aislar / ocultar / fantasma (ghost) del elemento, link a BOQ, guardar como grupo/selección.

## K. Federación (`FederatedViewer`)
**Frame all** · **Discipline color** (toggle) · **Reset view** · toggle de visibilidad por miembro ·
aislar por IfcClass.

## L. Subida (`uploadBIMData`)
Form: nombre, disciplina, tipo (cad/data), profundidad de conversión (RVT), generar láminas PDF,
archivo de geometría DAE opcional → `POST /upload/` o `/upload-cad/`. Indicador de progreso DDC.

## Reglas de afordancia
- **Borrado de modelo** requiere **MANAGER** (caro de recrear).
- **IA/regla propone, humano confirma**: el "Apply" tiene dry-run; revisar en el BOQ.
- **Cantidad ligada se auto-sincroniza** desde los links (no editar a mano).
