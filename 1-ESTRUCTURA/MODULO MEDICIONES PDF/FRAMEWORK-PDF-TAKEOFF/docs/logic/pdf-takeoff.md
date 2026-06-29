# Lógica de negocio — PDF Takeoff

> Reglas que **nunca deben romperse** al reconstruir. Cada una respaldada en código y
> en el historial de bugs reales (D-TKC-UP*). Ver también [workflows](../workflows/pdf-takeoff.md).

---

## 1. Escala y recálculo de cantidades (Audit B8)
- La escala es **métrica-canónica**: `unitLabel` siempre `m`; `scale_pixels_per_unit` =
  píxeles por metro. La calibración en ft/in se convierte a metros antes (CalibrationDialog).
- **Modelo por página** (`page-scales.ts`): cada hoja puede tener su propia escala; existe
  una `defaultScale` y overrides `byPage`. Una medición lleva el `scale_pixels_per_unit`
  de **su** página.
- El **servidor recalcula** `measurement_value`, `volume` y `perimeter` desde
  `points × scale` en create/update (no confía en el valor del cliente). Un cliente no
  puede inflar una cantidad.
- `formatMeasurement(value, unit)` (`scale-helpers.ts`) define el texto: vacío si ≤0;
  precisión 4/2/1 decimales según magnitud.

## 2. Mediciones vs anotaciones
- **Mediciones** (`distance, polyline, area, volume, count`) → cuentan en totales y pueden
  ir al BOQ.
- **Anotaciones** (`cloud, arrow, text, rectangle, highlight`) → NO aportan cantidad
  (`ANNOTATION_TYPES` en `takeoff-groups.ts`); su fila usa el **tipo** como subtítulo.
- Grupos por color; `is_deduction` (solo área) resta del total del grupo (área neta).

## 3. Persistencia de mediciones (el núcleo — D-TKC-UP07/UP09/UP09b/UP11)
**Clave = nombre de archivo** (no UUID), porque el UUID cambia al borrar+re-subir/abrir local.
- **Guardar**: `serverDocId = fileName`. Sync a servidor con **debounce 1s** + guardia
  `inFlightSyncRef` anti-duplicados. localStorage con debounce 500ms (clave = filename).
- **Cargar (dual-key)**: consulta `GET /measurements` por **`documentId` y por `fileName`**,
  fusiona y deduplica por `id` de servidor y por `metadata.frontend_id`. Si servidor vacío
  → fallback a localStorage.
- **Setters estables**: el visor debe pasar `setMeasurements`/`setPageScales` **directos**
  (no `(x)=>setX(x)`). Si cambian de identidad cada render, el efecto de carga se re-ejecuta
  y su cleanup pone `cancelled=true` → descarta el resultado → "no se ven" (D-TKC-UP09b).
- **`document_id` fuera de las deps** del efecto de carga: un UUID que llega tras la subida
  no debe re-ejecutar/cancelar la carga.
- **`label` (valor mostrado) se reconstruye** al cargar desde `measurement_value`/`unit`/
  `perimeter`/`volume`/`depth`/`count_value` (no se persiste el texto formateado) —
  `reconstructValueLabel` (D-TKC-UP11). Formatos: distancia `"1.40 m"`, área
  `"0.27 m² (P: 2.30 m)"`, volumen `"V = … m³ (A: … × D: …)"`, conteo `"13 pcs"`.

## 4. Borrado (D-TKC-UP14)
- Borrar una medición DEBE llamar a `DELETE /measurements/{serverId}` en las **3 rutas**:
  botón papelera (`deleteMeasurement`), tecla **Del**, y **Clear all** (`clearAll`). Si no,
  reaparece al refrescar.
- **Undo** de un borrado restaura la medición **sin `serverId`** → el auto-sync la re-crea.
  **Redo** vuelve a borrar la fila re-creada (busca el `serverId` actual).
- Las sugerencias IA (`suggested`) no tienen `serverId` → no se borran del servidor.

## 5. Borrado de documento = cascada (D-TKC-UP08)
- Como `measurement.document_id` no tiene FK, `service.delete_document` borra
  **explícitamente** las mediciones del documento (por UUID **y** por filename) antes de
  eliminar la fila + el PDF. Si no, quedan huérfanas y se acumulan.

## 6. Documentos duplicados / 409
- Subir un PDF con un **filename ya existente en el proyecto** devuelve **409** (gate 4 del
  upload). El frontend muestra `setDuplicateWarning`.

## 7. IA: "Analizar con IA" y "Recognize" (IA propone, humano confirma)
- **Analyze** trabaja sobre `extracted_text` (texto del PDF), NO sobre la geometría.
  Requiere proveedor LLM del usuario (BYO key). El array de partidas puede venir envuelto
  en objeto (`{items:[...]}`) → el backend lo **desenvuelve** (D-TKC-UP16). Errores y "0
  ítems" se muestran con **toast** (D-TKC-UP15/UP16), nunca en silencio.
- **Recognize / plan-read** detecta geometría → mediciones `suggested`/`proposed` que el
  usuario acepta. Nada se persiste hasta aceptar (regla CLAUDE.md #7).

## 8. UX/afordancia (lo que NO debe regresar)
- **Leyenda**: solo el **ojo** alterna visibilidad; el resto de la fila es informativo
  (D-TKC-UP10) — evita ocultar un grupo por un clic accidental.
- **Ítem de medición**: el cuerpo/centro **no** dispara selección; abrir Propiedades = ✏️,
  renombrar = clic en el nombre, valor copiable (D-TKC-UP12).
- **Aviso `beforeunload`** solo si hay algo **sin sincronizar** (no por el mero hecho de
  haber mediciones).

## 9. Invariantes a respetar
1. El valor mostrado nunca debe exceder lo que justifica la geometría (recompute server-side).
2. Reabrir el mismo PDF debe mostrar sus mediciones (dual-key + filename keying).
3. Borrar (medición o documento) debe persistir.
4. Ningún fallo de IA es silencioso.
5. Las anotaciones no contaminan los totales/BOQ.
