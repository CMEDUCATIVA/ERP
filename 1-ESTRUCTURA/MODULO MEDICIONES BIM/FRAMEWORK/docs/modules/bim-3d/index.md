# Módulo: Mediciones BIM 3D (`oe_bim_hub`)

> Framework de Context Engineering del módulo BIM 3D (visor + cuantificación 5D).
> Generado con `SKILL-PLANIFICADOR-V2.md`. Todo respaldado en código.

## Identidad
| Atributo | Valor |
|---|---|
| **Módulo backend** | `oe_bim_hub` — `backend/app/modules/bim_hub/` |
| **Manifest** | `name="oe_bim_hub"`, v0.1.0, `category="core"`, `depends=["oe_users","oe_projects","oe_boq"]`, `auto_install=True` |
| **Display name** | BIM Hub |
| **Permisos** | `bim.read` (VIEWER), `bim.create`/`update` (EDITOR), `bim.delete` (MANAGER) |
| **Ruta API base** | `/api/v1/bim_hub/` (58 endpoints) |
| **Rutas frontend** | `/bim`, `/bim/:modelId`, `/bim/federations`, `/bim/rules`, `/assets`, `/projects/:pid/bim[/:modelId]` |
| **Visor 3D** | Three.js — `frontend/src/shared/ui/BIMViewer/` |

## ¿Qué hace y por qué existe?
Importar modelos **BIM/CAD 3D** (RVT, IFC, …), visualizarlos en un **visor 3D**, **medir** sobre
ellos (distancia/área/ángulo), y **cuantificar**: extraer cantidades de los elementos (área m²,
volumen m³, longitud m, peso kg, conteo) y **vincularlas a partidas del presupuesto (BOQ)** para
alimentar el **5D (costo)**. Incluye **federaciones** (multi-modelo coordinado), **4D** (cronograma),
**smart views**, **diff de versiones**, **registro de activos (ISO 19650)** y **export COBie**.

Principio rector: **la IA/regla propone, el humano confirma** (dry-run → revisar → persistir).

## Usuarios
- **Estimador / QS**: extrae cantidades y las liga al BOQ (5D).
- **Coordinador BIM**: federa modelos por disciplina, detecta cambios (diff), revisa salud.
- **Arquitecto/Ingeniero**: mide, aísla, colorea por propiedad, navega (walk mode).
- **Gestor de activos**: mantiene el registro de activos operativos.

## Dos planos: visor 3D vs cuantificación
1. **Visor 3D** (`shared/ui/BIMViewer/`): escena Three.js, herramientas (sección, walk, medir),
   selección, colores por propiedad, 4D, federación.
2. **Cuantificación / 5D** (`features/bim/`): selección de elementos → **Add to BOQ**, reglas de
   cantidad (`BIMQuantityRulesPage`), panel de BOQ vinculado.

## Mapa de archivos
**Backend** (`backend/app/modules/bim_hub/`): `manifest.py`, `models.py` (8 tablas),
`schemas.py` (1210), `router.py` (5071, 58 endpoints), `service.py` (3958),
`repository.py` (567), `ifc_processor.py` (4002, parser IFC/STEP + DDC), `smart_views.py` (736),
`dataframe_store.py` (370, Parquet/DuckDB), `file_storage.py` (442, geometría/CAD),
`ddc_extras.py` (465, firmas de geometría), `vector_adapter.py` (102), `events.py`, `permissions.py`, `seed.py`.

**Frontend** (`frontend/src/features/bim/`): `BIMPage.tsx`, `AssetsPage.tsx`, `FederationsPage.tsx`,
`BIMQuantityRulesPage.tsx`, `api.ts`, paneles (`BIMRightPanelTabs`, `BIMToolsPanel`, `BIMLayersPanel`,
`BIMGroupsPanel`, `BIMLinkedBOQPanel`, `ColorByPropertyPanel`, `BIMFilterPanel`, `BIMDiffPanel`,
`BIMCRSPanel`, `BIMSnapshotsPopover`), `FederatedViewer.tsx`, modales (`AddToBOQModal`,
`CreateTaskFromBIMModal`, `LinkActivity/Document/RequirementToBIMModal`, `AssetEditModal`).
**Visor** (`frontend/src/shared/ui/BIMViewer/`): `BIMViewer.tsx`, `ViewerToolbar.tsx`,
`MeasureTool.ts`, `MeasureManager.ts`, `measureMath.ts`, `SnapDetector.ts`, `SectionBox.ts`,
`ClipManager.ts`, `SelectionManager.ts`, `SelectionSetsStore.ts`, `SavedViewsStore.ts`,
`BIMViewCube.tsx`, `WalkMode.ts`, `TimelineScrubber.tsx`, `use4dTimeline.ts`, `SceneManager.ts`,
`ElementManager.ts`, `applySmartView.ts`, `color5d.ts`, `urlState.ts`.

## Modelo de datos (resumen → [database](../../database/bim-3d.md))
8 tablas: `oe_bim_model`, `oe_bim_element` (+ asset register), `oe_bim_boq_link`,
`oe_bim_quantity_map`, `oe_bim_model_diff`, `oe_bim_element_group`, `oe_bim_federation`,
`oe_bim_federation_model`.

## Invariantes clave (LEER — detalle en [logic](../../logic/bim-3d.md))
1. **Cantidades canónicas SI** en `element.quantities` (area_m2, volume_m3, length_m, weight_kg).
2. **Cantidad del BOQ se auto-sincroniza** desde los `BOQElementLink` (`_sync_boq_quantity_from_links`).
3. **IA propone / humano confirma**: reglas de cantidad con dry-run y `confidence`.
4. **Solo modelos 3D** en el visor (DWG/DXF/DGN se filtran → módulo DWG aparte).
5. **IDOR**: todo pasa por `_verify_project_access` / `_verify_model_access`.
6. **Identidad por `stable_id`** (GUID IFC o ElementId Revit) — clave de diff y de mesh.

## Documentos relacionados
[UI](../../ui/bim-3d.md) · [**Botones/Herramientas**](../../ui/buttons/bim-3d.md) · [Formularios](../../ui/forms/bim-3d.md) ·
[API](../../api/bim-3d.md) · [Base de datos](../../database/bim-3d.md) · [DDL](../../database/bim-3d-schema.sql) ·
[Lógica](../../logic/bim-3d.md) · [**Algoritmos internos**](../../logic/bim-3d-internals.md) · [Workflows](../../workflows/bim-3d.md) ·
[Componentes](../../components/bim-3d.md) · [Permisos](../../permissions/bim-3d.md) ·
[Dependencias](../../dependencies/bim-3d.md) · [Eventos](../../events/bim-3d.md)
