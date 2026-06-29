# Formularios — Mediciones BIM 3D

## F1. Subir modelo (`uploadBIMData`)
| Campo | Tipo | Notas |
|---|---|---|
| Nombre del modelo | texto | |
| Disciplina | select | arquitectura/estructura/MEP/… |
| Tipo de subida | cad / data | CAD (RVT/IFC) → DDC; data (CSV/XLSX) directo |
| Profundidad de conversión | select | standard/medium/complete (solo RVT) |
| Generar láminas PDF | checkbox | solo RVT |
| Archivo de geometría (DAE) | file opcional | para subidas de tipo data |
→ `POST /upload-cad/` o `/upload/`. Respuesta: `{model_id, status, element_count, error_message?, converter_id?}`.

## F2. Add to BOQ (`AddToBOQModal`) — 2 pestañas
**Vincular a posición existente**
| Campo | Acción |
|---|---|
| Búsqueda de posición | filtra por descripción/ordinal (oculta cabeceras de sección) |
| Fila de posición (clic) | crea `BOQElementLink` por elemento (`createLink`) |

**Crear posición nueva**
| Campo | Validación |
|---|---|
| Descripción | requerido |
| Unidad | select (m²/m³/m/conteo/custom) — **determina el sync de cantidad** (ver internals §3) |
| Cantidad | sugerida por `suggestQuantityFromBIM` (volumen→área→longitud→conteo) |
| Tarifa unitaria | número (costo = cantidad × tarifa) |
| Ordinal · Clasificación | opcional (clasificación se hereda del 1er elemento) |
→ `boqApi.addPosition()` + `createLink()` por elemento. Modo masivo: agrega totales; invalida `['bim-elements']`.

## F3. Regla de cantidad (`BIMQuantityRulesPage`)
| Campo | Tipo / validación |
|---|---|
| Nombre | texto |
| `element_type_filter` | texto (IfcClass o `*`, p. ej. "Wall*, IfcWall*") |
| `property_filter` | filas clave=valor |
| `quantity_source` | select: area_m2 / volume_m3 / length_m / weight_kg / count / custom |
| `custom_quantity_source` | texto (si custom; admite `property:xxx`) |
| `multiplier` | Decimal **>0**, finito, ≤1e15 (rechaza inf/NaN/`-2`/`1e500`) |
| `unit` | texto (m²/pcs/…) |
| `waste_factor_pct` | Decimal **0–100** |
| Destino | existente (posición) **o** auto_create (con tarifa) |
| `is_active` | checkbox |
Acciones: **Sandbox/Preview** (`runSandbox` + `checkUnitSafety`) → **Aplicar** (`/quantity-maps/apply/`, dry-run→persistir).
Plantillas: Muros-área · Losas-volumen · Puertas-conteo · Ventanas-conteo.

## F4. Editar activo (`AssetEditModal`)
Campos de `asset_info`: manufacturer, model, serial_number, warranty_until, commissioned_at,
operational_status, parent_system_id, asset_tag → `PATCH /assets/{element_id}/asset-info`.
Al poblar `asset_info`, `is_tracked_asset` se activa (también toggle manual).

## F5. Guardar grupo / smart view
- **`SaveGroupModal`**: nombre (único por proyecto), criterio de filtro, estático/dinámico, color →
  `POST /element-groups/`.
- **`SaveSmartViewModal`**: nombre + estado de cámara + árbol de filtro (smart view).

## F6. Federación (`FederationsPage`)
Crear: nombre, descripción, `origin_offset {x,y,z}`, `shared_units`. Añadir miembro: modelo,
disciplina, color_hint, visible, z_order → `POST /federations/{id}/models`.
