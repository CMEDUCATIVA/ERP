# Checklists — Mediciones BIM 3D

## Nueva funcionalidad / API
- [ ] Leer `docs/modules/bim-3d/index.md` + el área (api/logic/ui).
- [ ] ¿Nuevo endpoint? permiso `bim.*` + IDOR (`_verify_project_access`/`_verify_model_access`) + schema.
- [ ] ¿Toca cantidades? respetar claves SI + `_sync_boq_quantity_from_links`.
- [ ] ¿Reglas? validar multiplier>0/waste 0–100; dry-run + confidence.
- [ ] Invalidar React Query (`['bim-elements']`/`['bim-models']`); estados loading/empty/error.
- [ ] Tests (vitest del visor) + typecheck. Actualizar SYSTEM-INDEX/CHANGELOG.

## Bug
- [ ] Clasificar: conversión / visor 3D / cuantificación / federación / diff / permisos.
- [ ] ¿"marcado ready sin malla"? revisar `is_non_3d_format` + magic-bytes geometría.
- [ ] ¿Cantidad BOQ mal? revisar links + `_sync_boq_quantity_from_links`.
- [ ] ¿Diff raro? revisar `stable_id` + `geometry_hash`.
- [ ] Parche mínimo; sin tocar lógica ajena. Validar + actualizar doc.

## Nueva pantalla/herramienta del visor
- [ ] Documentar en `ui/bim-3d.md` + `ui/buttons/bim-3d.md` (handler · API · resultado).
- [ ] Manager desacoplado (Scene/Element/Selection/Measure…); puente `window.__oeBim` si aplica.

## Nueva tabla
- [ ] Documentar en `database/bim-3d.md` + DDL en `bim-3d-schema.sql`. No copiar migración.
