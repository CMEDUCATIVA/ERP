# KNOWLEDGE-GRAPH — Grafo de Conocimiento del Proyecto

> Relaciones entre todos los elementos del sistema. Leer de arriba hacia abajo: Módulos → Pantallas → Componentes → Botones → APIs → Modelos → Tablas → Eventos → Reglas.

---

## 🌳 Árbol Global

```
ERP-DEEP (OpenConstructionERP)
│
├── 🏗️ MÓDULO: oe_projects
│   ├── ──→ Todos los módulos dependen de projects (CASCADE)
│   └── 📄 oe_projects_project
│
├── 📐 GRUPO: Mediciones (Sidebar)
│   │
│   ├── 🏗️ MÓDULO: dwg_takeoff (Mediciones DWG) ✅ DOCUMENTADO
│   │   ├── 🖥️ PANTALLA: /dwg-takeoff → DwgTakeoffPage
│   │   │   ├── 🧩 COMPONENTE: ToolPalette
│   │   │   │   ├── 🔘 BOTÓN: Select (V)
│   │   │   │   ├── 🔘 BOTÓN: Pan (H)
│   │   │   │   ├── 🔘 BOTÓN: Distance (D) → API: POST /annotations
│   │   │   │   ├── 🔘 BOTÓN: Area (A) → API: POST /annotations
│   │   │   │   ├── 🔘 BOTÓN: Calibrate (K) → API: PATCH /scale
│   │   │   │   └── ... (11 tools)
│   │   │   ├── 🧩 COMPONENTE: DxfViewer → Canvas2D Renderer
│   │   │   ├── 🧩 COMPONENTE: LayerPanel
│   │   │   ├── 🧩 COMPONENTE: SheetStrip
│   │   │   └── 🧩 COMPONENTE: CalibrationDialog
│   │   │
│   │   ├── 🌐 API: POST /drawings/upload
│   │   ├── 🌐 API: GET /drawings/{id}/entities
│   │   ├── 🌐 API: POST /annotations/
│   │   ├── 🌐 API: POST /annotations/{id}/link-boq → BOQ
│   │   ├── 🌐 API: POST /compare/create-variation → Variations
│   │   │
│   │   ├── 🗄️ TABLA: oe_dwg_takeoff_drawing
│   │   ├── 🗄️ TABLA: oe_dwg_takeoff_drawing_version
│   │   ├── 🗄️ TABLA: oe_dwg_takeoff_annotation
│   │   │   ├── 🔗 linked_boq_position_id → boq 📊
│   │   │   ├── 🔗 linked_task_id → schedule 📅
│   │   │   └── 🔗 linked_punch_item_id → punchlist 📋
│   │   └── 🗄️ TABLA: oe_dwg_entity_group
│   │
│   ├── 🏗️ MÓDULO: takeoff (PDF/CAD Takeoff) ✅ PARCIALMENTE DOCUMENTADO
│   │   ├── 🖥️ PANTALLA: /takeoff → TakeoffPage
│   │   │   ├── 🧩 COMPONENTE: DropZone → POST /documents/upload/
│   │   │   ├── 🧩 COMPONENTE: TakeoffDocFilmstrip → lista docs subidos
│   │   │   └── 🧩 COMPONENTE: TakeoffViewerModule (lazy) → visor canvas
│   │   │       ├── Prop: initialPdfUrl, initialPdfName, initialDocId
│   │   │       ├── Prop: onOpenRecentDocument → abre doc del servidor
│   │   │       └── Prop: onLocalFileOpened → notifica carga local al padre
│   │   ├── 🌐 API: POST /documents/upload/ (Gate 1-4)
│   │   ├── 🌐 API: GET /documents/ (listado + cross-link sync)
│   │   ├── 🌐 API: DELETE /documents/{id} → borra doc + cross-link
│   │   ├── 🌐 API: POST /measurements/ + GET + PATCH + DELETE
│   │   ├── 🌐 API: POST /plan-read/ (Vision LLM)
│   │   ├── 🗄️ TABLA: oe_takeoff_document
│   │   │   └── 🔗 cross-link → oe_documents_document (upload crea, delete limpia)
│   │   ├── 🗄️ TABLA: oe_takeoff_measurement
│   │   │   └── 🔗 linked_boq_position_id → boq 📊
│   │   ├── 🗄️ TABLA: oe_ai_takeoff_run
│   │   └── 🗄️ TABLA: oe_takeoff_cad_session
│   │   └── 🔗 CadExtractionSession ← usado por dwg_takeoff + bim_hub
│   │
│   └── 🏗️ MÓDULO: bim_hub (BIM 3D Viewer)
│       └── 🔗 Mismo patrón de upload, converter install, filmstrip
│
├── 📄 GRUPO: Documentos
│   └── 🏗️ MÓDULO: documents (Archivos de proyecto)
│       └── 🔗 ← takeoff (cross-link: upload→crea, list→sync, delete→limpia)
│
├── 💰 GRUPO: Presupuesto
│   ├── 🏗️ MÓDULO: boq (Bill of Quantities)
│   │   ├── 🔗 ← dwg_takeoff (linked_boq_position_id)
│   │   ├── 🔗 ← takeoff (PDF measurements)
│   │   ├── 🔗 ← bim_hub (BIM quantities)
│   │   └── 📡 EVENTO: boq.position.deleted → dwg_takeoff cleanup
│   │
│   ├── 🏗️ MÓDULO: costs (Cost Database CWICR)
│   ├── 🏗️ MÓDULO: costmodel
│   ├── 🏗️ MÓDULO: cost_match
│   └── 🏗️ MÓDULO: match_elements
│       └── 🔗 dwg_adapter.py → lee CadExtractionSession
│
├── 📅 GRUPO: Planificación
│   ├── 🏗️ MÓDULO: schedule
│   │   └── 🔗 ← dwg_takeoff (linked_task_id, LinkActivityToDwgModal)
│   └── 🏗️ MÓDULO: progress
│
├── 📄 GRUPO: Documentos
│   └── 🏗️ MÓDULO: documents
│       └── 🔗 ← → dwg_takeoff (from-document/ deep-link, LinkDocumentToDwgModal)
│
├── 🤖 GRUPO: IA
│   └── 🏗️ MÓDULO: ai_estimator
│       └── 🔗 ← dwg_takeoff (extractors.py importa DwgAnnotation)
│
├── 📋 GRUPO: Calidad
│   ├── 🏗️ MÓDULO: punchlist
│   │   └── 🔗 ← dwg_takeoff (linked_punch_item_id)
│   └── 🏗️ MÓDULO: inspections
│
├── 🔄 GRUPO: Cambios
│   └── 🏗️ MÓDULO: variations
│       └── 🔗 ← dwg_takeoff (POST /compare/create-variation)
│
└── 📐 GRUPO: Requerimientos
    └── 🏗️ MÓDULO: bim_requirements
        └── 🔗 ← dwg_takeoff (LinkRequirementToDwgModal)
```

---

## 🔗 Relaciones del Módulo DWG Takeoff

```
dwg_takeoff
  │
  │──[FK CASCADE]──→ oe_projects
  │
  │──[linked_boq_position_id]──→ boq
  │     └── [EVENT: boq.position.deleted] → cleanup
  │
  │──[linked_task_id]──→ schedule
  │     └── [MODAL: LinkActivityToDwgModal]
  │
  │──[linked_punch_item_id]──→ punchlist
  │
  │──[POST /from-document/]──→ documents
  │     └── [DEEP-LINK: ?docId=X]
  │
  │──[MODAL: LinkRequirementToDwgModal]──→ bim_requirements
  │
  │──[POST /compare/create-variation]──→ variations
  │
  │──[MODAL: CreateTaskFromDwgModal]──→ tasks
  │
  │──[IMPORT: DwgAnnotation]──→ ai_estimator
  │
  │──[ADAPTER: dwg_adapter.py]──→ match_elements
  │     └── [lee: CadExtractionSession]
  │
  └──[SHARED: DDC Converter]──→ takeoff/cad
```

---

## 📊 Reglas de negocio (TOP 10)

| # | Regla | Ubicación |
|---|---|---|
| 1 | Mediciones con Numeric(18,6), nunca Float | `docs/logic/dwg-takeoff.md` |
| 2 | unitFactorToMetres() convierte DXF → metros | `docs/logic/dwg-takeoff.md` |
| 3 | effectiveScale = drawingScale × unitFactor | `docs/logic/dwg-takeoff.md` |
| 4 | m²/m³ sin prefijos SI (k/m) | `docs/logic/dwg-takeoff.md` |
| 5 | Detección de self-intersection en polígonos | `docs/logic/dwg-takeoff.md` |
| 6 | Magic byte validation para DWG | `docs/logic/dwg-takeoff.md` |
| 7 | EventBus cleanup de BOQ links huérfanos | `docs/logic/dwg-takeoff.md` |
| 8 | Scale override por anotación | `docs/logic/dwg-takeoff.md` |
| 9 | needs_conversion como estado terminal | `docs/logic/dwg-takeoff.md` |
| 10 | Deep-link from-document idempotente | `docs/logic/dwg-takeoff.md` |
