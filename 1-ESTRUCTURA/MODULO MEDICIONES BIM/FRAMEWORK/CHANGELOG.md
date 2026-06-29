# CHANGELOG — Framework Mediciones BIM 3D

## [BIM 1.1.0] — 2026-06-28
### Fixed — Visor 3D "3D view unavailable" (WebGL born-lost context)
- Causa raíz: `SceneManager.dispose()` llamaba **siempre** a `renderer.forceContextLoss()`.
  En GPUs AMD con el workaround de Chrome `exit_on_context_lost`, eso **mata el proceso GPU**;
  el doble montaje de React StrictMode (dev) o un *navegar y volver* rápido dejaba al siguiente
  renderer con un contexto **perdido al nacer** → `getMaxPrecision` lee `null.precision` → throw →
  el visor caía al fallback "3D view unavailable".
- Arreglo: `forceContextLoss()` ahora es **condicional** — solo si hay **≥6 contextos WebGL vivos**
  (sesiones pesadas multi-modelo, riesgo real de "Too many active WebGL contexts"). En el caso normal
  (1-2 contextos) se omite y `renderer.dispose()` + GC liberan el contexto, manteniendo el GPU vivo.
  Contador a nivel de módulo `liveWebGLContexts` (++ al crear el renderer, -- en dispose).
  Archivos: `SceneManager.ts` (96, dispose), `BIMViewer.tsx` (efecto de init / fallback).

### Changed — Cabecera de BIMPage: una sola fila con menús agrupados
- Las ~17 acciones de la cabecera, antes en 2 filas de iconos con etiquetas que aparecían/desaparecían
  a 1900px, se reorganizan en **una fila** con **menús desplegables** por función:
  **Paneles · Selección · Apariencia · Ir a · Ayuda**. `+ Añadir modelo` y `Filtrar` (el más usado,
  con su contador de visibles) quedan **sueltos**; **Aislar** (contextual) va al lado de Filtrar.
- Cada disparador de menú muestra un **badge de conteo** de toggles activos (el estado no se oculta).
  Ítems `menuitemcheckbox` (toggles, no cierran el menú) / `menuitemradio`/`menuitem`.
- Nuevo componente reutilizable `features/bim/HeaderMenu.tsx` (`HeaderMenu`, `MenuLabel`,
  `MenuCheck`, `MenuAction`): dropdown accesible, cierra por click-fuera y `Esc`.
- **Tour/guía reapuntados** a los disparadores de menú (los botones ahora viven dentro):
  `ProductTour.tsx` pasos 4-7 → `bim-menu-panels`/`-selection`/`-goto`; `bimGuide.ts` (Summary→
  `bim-menu-panels`, Color-by→`bim-menu-appearance`).

### Changed — Panel de introducción ahora flotante (`BIMHelpPanel`)
- El intro/ayuda de BIM deja de ser un banner en flujo (que empujaba el visor) y pasa a **panel
  flotante** arriba-derecha, a media anchura, sobre el canvas. Nuevo `features/bim/BIMHelpPanel.tsx`
  (sustituye a `DismissibleInfo` **solo en BIM**; el compartido no se toca).
- Estados: **abierto** (arranca siempre así, solo por sesión, sin localStorage) ↔ **círculo "?"**
  (minimizado) → **desaparece** a los 10 s. Auto-minimiza una vez a los **60 s**; `[—]` y `[✕]`
  hacen lo mismo (encoger). Reapertura **solo** por el "?" (sin reingreso por menú/barra superior).

### Changed — Apilamiento (z-index) y detalles UI
- Cabecera `relative z-20` → **`z-50`** y desplegables a `z-50`, para que los menús se pinten
  **encima del visor y de los paneles** (antes quedaban tapados). `BIMHelpPanel` a `z-40`.
- Nombre de modelo en la tarjeta truncado a **12 caracteres + "…"** (con nombre completo en `title`),
  igual que el filmstrip DWG.

### Notas
- No cambia la lógica de negocio ni la API: solo presentación, apilamiento y ciclo de vida del
  contexto WebGL. i18n añadido: `bim.menu_*`, `bim.help_*`.

## [BIM 1.0.0] — 2026-06-28
### Added
- Creación del framework del módulo **BIM 3D** (`oe_bim_hub`), siguiendo `SKILL-PLANIFICADOR-V2.md`.
- Análisis completo (backend ~17.8k líneas + frontend ~70 archivos incl. visor Three.js).
- Documentos: módulo/índice, UI, **botones/herramientas** (medición 3D, Add to BOQ, reglas),
  API (**58 endpoints**, verificado), base de datos (8 tablas) + **DDL SQL**, lógica (16 reglas) +
  **algoritmos internos**, **formularios**, workflows (9), componentes, permisos (con jerarquía), eventos, dependencias.
- Raíz: MANIFEST, SYSTEM-INDEX, CONTEXT-MAP, KNOWLEDGE-GRAPH. Templates, checklists, reports, metadata.

### Verificado en código (v1.0)
- Endpoints: **58** (26 GET, 22 POST, 4 PATCH, 5 DELETE, 1 PUT) — `grep` sobre `router.py`.
- Algoritmos clave leídos: medición Newell (`measureMath.ts`), sync **unit-aware** del BOQ
  (`_sync_boq_quantity_from_links`: E-XMOD-003/D-TKC-005/D-TKC-028), `_extract_quantity`,
  confidence ≥0.9/≥0.6, `compute_diff`, `geometry_signature`.

### Hechos clave documentados (respaldados en código)
- 8 tablas; permisos `delete=MANAGER` (upload BIM caro de recrear).
- Pipeline DDC cad2data (RVT/IFC→Excel+COLLADA) + parser STEP de respaldo; geometría GLB/DAE; Parquet+DuckDB.
- Cuantificación: `quantities` SI → `BOQElementLink` → auto-sync de cantidad BOQ; reglas con dry-run + confidence.
- Visor 3D: medición distance/area/angle con snapping; sección, walk, federaciones, 4D, diff, smart views, activos ISO 19650.
- Frontera: dwg/dxf/dgn excluidos del visor 3D (van al módulo DWG).

### Notas de fidelidad
- Conteos de endpoints (~55) y referencias de línea provienen del análisis de `router.py`/`service.py`;
  verificar contra el código para precisión exacta. No se modificó código (Planificador).
