# CHANGELOG — FRAMEWORK-PDF-TAKEOFF

## [1.1.0] — 2026-06-28
### Added
- **`docs/logic/pdf-takeoff-internals.md`** — algoritmos internos para réplica **al decimal**:
  invariante de escala 72dpi (`presetScale`/`deriveScale`/`ratioFromScale`, escala inválida
  D-TKC-010/016), geometría frontend (shoelace, perímetro, `formatMeasurement` D-TKC-007),
  **recálculo server-side B8** (`recompute_measurement_value`/`recompute_volume_value`),
  reconstrucción de label (D-TKC-UP11), carga **dual-key** + merge dedup (D-TKC-UP07),
  sync con debounce/`inFlightSyncRef`, reconocimiento offline vectorial (`recognize.py`,
  umbrales) + raster (OpenCV), y desenvoltura del JSON del LLM (D-TKC-UP16).
- Enlazado desde SYSTEM-INDEX y CONTEXT-MAP ("réplica exacta / algoritmos").
- Paridad con el framework DWG (que ya tiene `dwg-takeoff-internals.md`).

---

## [1.0.0] — 2026-06-28
### Added
- Creación del framework dedicado al módulo **PDF Takeoff** (`oe_takeoff`), separado del
  framework de DWG (que documentaba `oe_dwg_takeoff` pese a estar en la carpeta "MEDICIONES PDF").
- Documentación completa para reconstruir el módulo de cero: módulo/spec, UI, **botones
  (catálogo completo)**, formularios, lógica, workflows, API, base de datos, componentes,
  permisos, dependencias, eventos.
- Archivos raíz: MANIFEST, SYSTEM-INDEX, CONTEXT-MAP, KNOWLEDGE-GRAPH.
- `reports/pdf-takeoff-rebuild-spec.md` (pasos de reconstrucción) + auditoría.

### Historial de decisiones del módulo (consolidado de la sesión de desarrollo)
> Estas son las correcciones reales que definieron el comportamiento documentado.
- **D-TKC-UP07** Persistencia: clave por nombre + carga dual-key (UUID + filename).
- **D-TKC-UP08** Borrar documento → **cascada** elimina sus mediciones.
- **D-TKC-UP09 / UP09b** Clave por nombre como en la build de referencia; **fix del race**:
  pasar setters de React estables (envolverlos cancelaba la carga → "no se ven").
- **D-TKC-UP11** El `label` (valor) se **reconstruye** desde campos numéricos al cargar.
- **D-TKC-UP10** Leyenda: solo el **ojo** alterna visibilidad.
- **D-TKC-UP12** Ítem de medición: centro libre/copiable; ✏️ abre Propiedades; nombre edita.
- **D-TKC-UP13** Selector "Link to BOQ" como panel **dentro del canvas** (createPortal), más ancho.
- **D-TKC-UP14** Borrado de medición **persiste** (papelera/Del/Clear all) + undo/redo coherentes.
- **D-TKC-UP15 / UP16** "Analizar con IA" nunca silencioso: toast en error/0 ítems; backend
  **desenvuelve** array dentro de objeto (DeepSeek).
- i18n: añadida `takeoff_viewer.help_extended` (es).

### Pendientes documentados
- Confirmación antes de borrar un documento (hoy la X borra doc + mediciones sin confirmar).
- Pluralización "1 página/páginas" en `DocumentCard`.
- Contador de nombres que se reinicia al recargar (nombres "Distance 1" repetidos).
