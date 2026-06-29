# Spec de reconstrucción desde cero — PDF Takeoff

> Orden recomendado para rehacer el módulo en un proyecto nuevo. Cada paso enlaza el doc
> con el detalle.

## Paso 0 — Prerrequisitos
- ERP modular con `oe_projects` + sistema de permisos + módulo BOQ + módulo AI (BYO key).
- Stack: ver [tech-stack](../docs/tech-stack.md).

## Paso 1 — Backend: modelo + manifest
1. Crear 4 tablas (ver [database](../docs/database/pdf-takeoff.md)): `oe_takeoff_document`,
   `oe_takeoff_measurement` (**`document_id` String(255) SIN FK**), `oe_ai_takeoff_run`,
   `oe_takeoff_cad_extraction_session`.
2. `manifest.py`: `name="oe_takeoff"`, `depends=["oe_projects","oe_cad"]`.
3. Definir permisos `takeoff.{read,create,update,delete}`.

## Paso 2 — Backend: schemas + repositorios + servicio
- Schemas (Create/Update/Response/BulkCreate, AnalysisResult). Repos (Takeoff/Measurement/AiRun).
- Servicio con **recompute server-side** (B8) en create/update; `delete_document` en
  **cascada** (borra mediciones por uuid+filename); gates de upload (incl. 409 duplicado).

## Paso 3 — Backend: router (~47 endpoints)
- Implementar grupos documents / measurements / plan-read / recognize (ver [api](../docs/api/pdf-takeoff.md)).
- IDOR en todos (`verify_project_access`); fencing del texto al LLM; desenvolver array en analyze.

## Paso 4 — Frontend: visor (núcleo)
- `TakeoffViewerModule.tsx`: pdf.js + canvas overlay + toolbar (ver [buttons](../docs/ui/buttons/pdf-takeoff.md) A) + sidebar (B) + leyenda (C) + picker BOQ (D, vía createPortal al canvas).
- `useMeasurementPersistence`: **clave por nombre**, **dual-key load**, auto-sync 1s + guardia,
  localStorage 500ms, reconstrucción de `label`, setters **estables**.
- `data/page-scales.ts` + `data/scale-helpers.ts` (formatMeasurement, escala por página).

## Paso 5 — Frontend: página `/takeoff`
- `TakeoffPage.tsx`: tabs Measurements/Documents&AI, Compare, DropZone + `DocumentCard`
  (Analizar con IA / Extraer tablas / Ver / borrar — con toasts de error y 0 ítems).
- Registrar ruta en App/Header/routeIcons/projectJourney; manifest del módulo `pdf-takeoff`.

## Paso 6 — Integraciones
- BOQ (link-to-boq, create-position), Documents hub (cross-link), Markups (invalidate),
  AI (analyze/plan-read), Variations (create-variation).

## Paso 7 — Reglas que NO deben romperse (checklist)
- [ ] Reabrir el mismo PDF muestra sus mediciones (dual-key + nombre).
- [ ] Borrar (medición/documento) persiste tras refresh.
- [ ] Setters estables al hook (no race de carga).
- [ ] `label` (valor) se reconstruye al cargar.
- [ ] Leyenda: solo el ojo oculta. Ítem: centro libre, ✏️ Propiedades.
- [ ] Recompute server-side de cantidades.
- [ ] IA: sin fallos silenciosos; desenvolver array; fencing del texto.
- [ ] Anotaciones no cuentan en totales/BOQ.

## Paso 8 — QA
- vitest del hook de persistencia; typecheck; prueba manual de los 8 workflows.
