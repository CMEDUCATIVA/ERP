# Lógica de Negocio — Módulo DWG Takeoff

## Reglas fundamentales

### 1. Precisión de Mediciones (NUNCA ROMPER)

**Regla**: Todas las mediciones usan `Numeric(18,6)` en base de datos, nunca `Float`.

**Por qué existe**: `Float` (IEEE 754) acumula error binario en sumas. Una partida BOQ con 200 anotaciones podría tener centavos de deriva. `Numeric` es decimal exacto.

**Qué nunca debe romperse**: Si se migra una columna de medición a Float, el BOQ total será incorrecto para proyectos grandes.

---

### 2. Conversión de Unidades DXF → Metros (NUNCA ROMPER)

**Regla**: `unitFactorToMetres()` convierte la unidad del header DXF ($INSUNITS) a metros.

| Unidad DXF | Factor |
|---|---|
| `mm` | 0.001 |
| `cm` | 0.01 |
| `m` | 1.0 |
| `inches` | 0.0254 |
| `feet` | 0.3048 |

**Por qué existe**: Planos en mm sin calibrar mostrarían "12000 m" para una pared de 12 metros. Sin este factor, las mediciones son inútiles.

**Qué nunca debe romperse**: Si se quita esta conversión, todos los archivos en mm darán valores 1000x.

---

### 3. Escala: Denominador Compuesto (NUNCA ROMPER)

**Regla**: `effectiveScale = drawingScale × unitFactorToMetres(units)`

- `drawingScale`: 1:50 → 50, 1:100 → 100 (paper scale)
- `unitFactor`: mm → 0.001, m → 1.0 (DXF unit)

**Por qué existe**: Una línea de 1000 unidades en un plano 1:100 en mm = 1000 × 100 × 0.001 = 100 metros reales.

---

### 4. Unidades Compuestas sin Prefijo SI (NUNCA ROMPER)

**Regla**: `m²` y `m³` NUNCA reciben prefijos k/M/G.

**Por qué existe**: `1 km² = 1,000,000 m²` (no 1,000). Mostrar `1500 m²` como `1.50 km²` es un error de factor 1,000,000.

**Qué nunca debe romperse**: `formatMeasurement()` tiene `isCompositeUnit()` para detectar y bloquear el escalado.

---

### 5. Polígonos Auto-Intersectantes (NUNCA SILENCIAR)

**Regla**: `calculateAreaSafe()` detecta self-intersections y reporta `degenerate: 'self_intersecting'`.

**Por qué existe**: La fórmula Shoelace devuelve 0 para un "bowtie" perfecto — el usuario cree que midió 0 m² cuando en realidad el polígono cubre área real.

**Qué nunca debe romperse**: La UI debe mostrar advertencia, no silenciarla.

---

### 6. Validación de Magic Bytes DWG

**Regla**: `_sniff_dwg_version()` lee los primeros 6 bytes del archivo. Si no empieza con `AC####`, se rechaza.

**Por qué existe**: PDFs/ZIPs renombrados como `.dwg` (error común) causaban 90s de procesamiento DDC fallido con error "empty output" incomprensible.

---

### 7. Event Bus: Cleanup de BOQ Links

**Regla**: Cuando se elimina una partida BOQ, el evento `boq.position.deleted` dispara `_on_boq_position_deleted()` que limpia `linked_boq_position_id` en todas las anotaciones vinculadas.

**Por qué existe**: Sin esto, las anotaciones apuntan a partidas inexistentes — el "jump to linked position" falla y los rollups de cantidades incluyen filas huérfanas.

---

### 8. Escala por Anotación (Scale Override)

**Regla**: `DwgAnnotation.scale_override` permite que una anotación individual tenga su propia escala, independiente del drawing.

**Por qué existe**: Un plano 1:100 puede tener un detalle 1:20 en la misma hoja. Sin override, las mediciones del detalle serían incorrectas.

---

### 9. Estados del Drawing

**Regla**: El backend puede devolver `needs_conversion` como estado terminal (no transitorio).

**Por qué existe**: Si el DDC converter no está instalado en el servidor, un .dwg nunca pasará de `uploaded`/`processing` a `ready`. `needs_conversion` es la señal definitiva para mostrar el CTA de instalar converter, en vez de un spinner eterno.

**Estados**:
```
uploaded → processing → ready
                      → empty
                      → error
needs_conversion (terminal)
```

---

### 10. Deep-Link Idempotente desde Documents

**Regla**: `POST /drawings/from-document/` es idempotente por documento. Si ya existe un drawing para ese documento, devuelve el existente.

**Por qué existe**: Evita duplicados si el usuario hace "Open in DWG Takeoff" múltiples veces.

---

### 11. Conversión sin lock prolongado (NUNCA ROMPER) — DWG-FIX-01

**Regla**: en `_process_dwg`, la transición a `status="processing"` se **confirma (commit)**
ANTES de lanzar el subproceso DDC (30–120 s).

**Por qué existe**: `update_fields` solo hace `flush` (no commit), y la tarea de background usa
una sola sesión que confirma al final. Sin el commit temprano, el `UPDATE` de "processing"
retiene un **lock de fila** sobre el plano durante toda la conversión → un `PATCH /scale/`
concurrente se bloquea y el cliente aborta a los 30 s. Además, el estado "processing" no era
visible al polling (READ COMMITTED) hasta el commit final.

**Qué nunca debe romperse**: una operación rápida (guardar escala, capas, borrar) no debe quedar
bloqueada por la conversión. No revertir el commit por-transición a una transacción única que
envuelva el subproceso.

---

### 12. Unicidad de subida por filename (DWG-FIX-02)

**Regla**: `upload_drawing` rechaza con **409** si ya existe un plano con el mismo `filename`
en el proyecto (`DwgDrawingRepository.count_by_filename_in_project`).

**Por qué existe**: sin gate, el mismo archivo re-subido creaba filas idénticas (el filmstrip
mostraba 3 tarjetas "PLANOS CURSO DE METRADOS"), agravado por el timeout de escala que hacía
*parecer* fallida la subida y el usuario reintentaba. Espeja el gate de PDF (D-TKC-UP04).

**Frontend**: pre-check por filename + caja de aviso ámbar + fallback al 409; tras borrar un
plano se puede re-subir el mismo nombre.

---

### 13. Borrado en cascada al Documents hub (DWG-FIX-03)

**Regla**: `delete_drawing` elimina también el `Document` cross-linked
(`metadata.source_module="dwg_takeoff"` + `source_id=<drawing_id>`) además del archivo,
entidades, thumbnails y la fila del plano.

**Por qué existe**: el upload crea un `Document` que apunta al **mismo** blob en disco; al
borrar el plano (y su archivo), dejar el `Document` lo deja huérfano apuntando a un archivo
inexistente y visible en "Archivos del proyecto". Best-effort: un fallo aquí nunca bloquea el
borrado. Espeja PDF D-TKC-UP06.

---

### 14. BlockId ≠ Layout/Espacio (DWG-FIX-04)

**Regla**: en el parser DDC, solo `*Model_Space` y `*Paper_Space[n]` son espacios/layouts
reales. Todo `BlockId` que no empiece por `*Paper_Space` se **colapsa a `*Model_Space`**.

**Por qué existe**: el `BlockId` que entrega DDC es el **registro de bloque dueño**, no un
layout. Los bloques anónimos de cota (`*D####`), hatches (`*U####`) y nombrados (`_Dot`) se
listaban como cientos de "láminas" en el sheet strip, y sus entidades quedaban fuera de
`*Model_Space` (el filtro las ocultaba). Solo aplica al path DDC (DWG); el path ezdxf (DXF)
usa `doc.layouts` reales y no necesita esto.

**Qué nunca debe romperse**: el sheet strip debe mostrar solo Model + láminas de papel reales
(y ocultarse si solo hay Model). Ver `docs/logic/dwg-takeoff-internals.md` §7.
