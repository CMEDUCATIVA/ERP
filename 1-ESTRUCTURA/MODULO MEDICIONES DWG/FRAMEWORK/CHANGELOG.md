# CHANGELOG — Framework de Context Engineering

## [DWG 1.2.0] — 2026-06-28

### Cambios de código en el módulo `oe_dwg_takeoff` (sesión de desarrollo)
Se corrigieron bugs reales y se localizó la UI al español. Documentado aquí + reglas
nuevas en `docs/logic/dwg-takeoff.md` (11–14), internals y API actualizados.

**Backend — bugs corregidos**
- **DWG-FIX-01 · Lock de fila durante la conversión (timeout del PATCH de escala).**
  La conversión en background usaba una sola transacción que envolvía el subproceso DDC
  (30–120 s): `update_fields(status="processing")` tomaba un **lock de fila** sobre el plano
  y no confirmaba hasta el final, así que un `PATCH /drawings/{id}/scale/` concurrente se
  bloqueaba y el cliente abortaba a los 30 s ("Request timeout … scale/"). **Fix**:
  `_process_dwg` hace `await self.session.commit()` **tras** la transición a `processing` y
  **antes** del subproceso → libera el lock y hace visible "processing" al polling
  (`service.py`).
- **DWG-FIX-02 · Subida duplicada de DWG.** `upload_drawing` no validaba duplicados. **Fix**:
  gate **409** por `filename` + `project_id` (nuevo `DwgDrawingRepository.count_by_filename_in_project`),
  falla rápido antes de leer el archivo. Espeja el gate de PDF (D-TKC-UP04).
- **DWG-FIX-03 · Borrar plano dejaba huérfano en "Archivos del proyecto".** `delete_drawing`
  borraba archivo + entidades + thumbnails + fila, pero **no** el `Document` cross-linked.
  **Fix**: elimina también el `Document` con `metadata.source_module="dwg_takeoff"` +
  `source_id` (best-effort, filtrado en Python por `project_id`). Espeja PDF D-TKC-UP06.
- **DWG-FIX-04 · El sheet strip listaba bloques como "layouts".** El parser DDC usaba
  `BlockId` (registro de bloque dueño) como layout → cientos de pestañas `*D####` (cotas),
  `*U####` (hatches), `_Dot`. **Fix**: en `ddc_dwg_parser`, colapsar todo `BlockId` que no
  empiece por `*Paper_Space` a **`*Model_Space`** → la tira muestra solo Model + láminas
  reales (y se auto-oculta si solo hay Model). El path ezdxf/DXF ya era correcto.

**Frontend — UX**
- **Escala**: el `PATCH /scale/` se dispara **solo si `status==='ready'`** (no durante
  `processing`), evitando el timeout (`DwgTakeoffPage.tsx`).
- **Aviso de duplicado estilo PDF**: caja ámbar en la **cabecera** + **pre-check** por
  filename + **fallback 409** (sin toast rojo); `api.ts::uploadDrawing` ahora **parsea
  `detail`** del error (no más `{"detail":…}` crudo).
- **Filmstrip**: nombre del plano **truncado a 12 chars + "…"** (`FILMSTRIP_NAME_MAX`) con
  `title` del nombre completo, para que el botón eliminar no quede tapado.
- **Solo el ojo alterna visibilidad** en `LayerPanel` y `EntityNameFilter` (fila inerte) —
  mismo principio que la leyenda del PDF (D-TKC-UP10).
- **Panel derecho ensanchado**: `w-72` → `w-96` (288 → 384 px).

**Frontend — i18n (localización al español)**
- Traducción amplia del módulo DWG en `frontend/src/app/locales/es.ts` (~70 claves):
  hero/landing, modal de subida, **card de conversión** (4 pasos), filmstrip, aviso de
  duplicado, **LayerPanel** + **EntityNameFilter** (incl. tipos de entidad `etype_*`:
  LINE→Línea, CIRCLE→Círculo, HATCH→Achurado…), **5 pestañas** del panel y la pestaña
  **Resumen** completa (KPIs, "Por capa", "Por tipo", "sin geometría medible", export).
  Clave global compartida `guide.button`/`guide.button_aria` → "Cómo funciona".

**Diagnosticado (no es defecto, no se cambió)**
- **"Me redirige" tras subir**: NO lo causa la ruta de escala (solo toast). Es el
  **auto-reload de recuperación de chunk obsoleto** (`ErrorBoundary.componentDidCatch` /
  `vite:preloadError` → `window.location.reload()`), que salta con HMR/deploy; se percibe
  como "volver al inicio" porque `selectedDrawingId` no se persiste en la URL. Mejora
  opcional pendiente: sincronizar `selectedDrawingId ↔ ?drawingId=`.

---

## [DWG 1.1.0] — 2026-06-28

### Re-análisis del módulo `oe_dwg_takeoff` y actualización del framework DWG
Se re-analizó el módulo DWG completo (backend + frontend) y se actualizó/corrigió el framework.

**Correcciones**
- **SYSTEM-INDEX.md**: estaba contaminado con contenido del módulo **PDF** (props del visor,
  flujos de `documents/upload`, relación con Documents hub). Reescrito **solo-DWG** y exacto.
- **API**: faltaba el endpoint `GET /drawings/{id}/download/` → el total real es **23** (no 22).
- **metadata/framework-stats.md**: endpoints 23, workspace path correcto, versión 1.1.0.

**Añadido (ampliación 2026-06-28)**
- **`docs/logic/dwg-takeoff-internals.md`** — algoritmos internos para réplica **al decimal**:
  parseo DXF (ezdxf: capas/visibilidad BUG-005, ACI→hex, serialización por entidad, extents,
  $INSUNITS + inferencia mm, thumbnail SVG), medición de entidades (LINE/CIRCLE/ARC/POLYLINE +
  bugfix ARC C3), matemática frontend (`measurement.ts`: shoelace + área segura, perímetro,
  formato compuesto D-TKC-006), calibración (`deriveScale`), **diff de versiones** (entidad por
  perfil de capas, anotación por `compare_key`, impacto de costo `(new−old)·rate` ROUND_HALF_UP,
  cross-tenant), create-variation (draft scope_change), conversión DWG→DXF (`infer_units_from_extents`).
- **`docs/database/dwg-takeoff-schema.sql`** — DDL SQL estructurado de las 4 tablas (CREATE
  TABLE + índices + FKs CASCADE/SET NULL), derivado de `models.py`.
- **`docs/permissions/dwg-takeoff.md`** — añadida la **jerarquía de niveles de usuario**
  (ADMIN>MANAGER>EDITOR>VIEWER + roles de campo + alias + herencia + nota de registro).

**Añadido**
- **`docs/ui/buttons/dwg-takeoff.md`** — catálogo COMPLETO de botones/acciones: 11 herramientas
  (+ atajos), barra de historial/snap, barra superior (Compare, Download PDF, Offline badge),
  5 pestañas del panel (Layers/Annotations/Properties/Scale/Summary), sección "Attach To" (BOQ,
  Task, Document, Activity, Requirement), panel Link-to-BOQ, menú contextual, compare drawer
  (Create Variation), filmstrip + upload, indicador de subida. Cada acción con su API real.
- **`reports/analysis-2026-06-28.md`** — informe del re-análisis y verificación contra código.

**Verificado contra código (sin cambios respecto a la doc previa)**
- 4 tablas (`drawing`, `drawing_version`, `annotation`, `entity_group`) con FKs CASCADE a proyecto.
- Permisos: read=VIEWER, create/update=EDITOR, **delete=MANAGER**.
- Evento `boq.position.deleted` → limpia `linked_boq_position_id`.
- `depends=["oe_projects"]`, `auto_install=True`.

---

## [1.0.16] — 2026-06-28

### Bug / UX
**PDF Takeoff: "Analizar con IA" no mostraba nada (errores silenciosos + respuesta envuelta) (D-TKC-UP15/UP16)**

### Problema
Al pulsar "Analizar con IA" no pasaba nada visible. Dos causas:
1. **Errores silenciosos**: `analyzeMutation.onError` / `extractTablesMutation.onError` solo apagaban el spinner, sin mostrar el motivo (no IA conectada, sin texto, error LLM).
2. **Respuesta de éxito descartada**: DeepSeek devolvía `200 OK` pero el array de partidas venía **envuelto en un objeto** (`{"items":[...]}`); el backend solo aceptaba un array de nivel superior → lo tiraba como "0 elementos" → la UI no mostraba nada (sin feedback de "0 ítems").

### Solución
- **Frontend** (`TakeoffPage.tsx`): ambos `onError` muestran ahora un **toast con el mensaje del error**. El `onSuccess` del análisis muestra un **toast informativo si vienen 0 ítems** (+ defensivo `data.elements ?? []`).
- **Backend** (`takeoff/router.py` `analyze_document`): si `extract_json` devuelve un **dict**, se **desenvuelve la primera lista** (`items`/`elements`/`positions`/`rows`/`results`/`data`/primera lista) antes de descartar; warning log si la respuesta no era lista.

### Archivos modificados
- `frontend/src/features/takeoff/TakeoffPage.tsx`
- `backend/app/modules/takeoff/router.py`

### Impacto
- "Analizar con IA" / "Extraer tablas": nunca más silencio — o muestra partidas, o un toast claro del motivo (error / 0 ítems). Respuestas LLM envueltas en objeto ya se aprovechan.
- **Requiere reiniciar el backend** (cambio Python) + hard-refresh del frontend.

### Validación
- Sintaxis backend OK; typecheck frontend 0 errores.

---

## [1.0.15] — 2026-06-28

### Bug
**PDF Takeoff: eliminar una medición no persiste — reaparece al refrescar (D-TKC-UP14)**

### Problema
El borrado solo quitaba la medición del **estado local** (`setMeasurements(filter)`), sin llamar al `DELETE` del backend. Como la fila seguía en el servidor, el `load` la volvía a traer al refrescar. Afectaba a **tres rutas**: botón papelera (`deleteMeasurement`), tecla **Del**, y **"Clear all"** (`clearAll`).

### Solución
- `TakeoffViewerModule.tsx`: las tres rutas ahora llaman a `takeoffApi.delete(serverId)` (best-effort) para las mediciones con `serverId` (las ya sincronizadas). Los AI-`suggested` no tienen `serverId`, así que se ignoran.
- Consistencia de undo/redo: el **undo** de un borrado restaura la medición **sin `serverId`** (su fila ya no existe) para que el auto-sync la **re-cree**; el **redo** vuelve a borrar la fila re-creada (busca el `serverId` actual vía `measurementsRef`).

### Archivos modificados
- `frontend/src/modules/pdf-takeoff/TakeoffViewerModule.tsx`

### Impacto
- `/takeoff`: eliminar (papelera / Del / Clear all) ahora **persiste** — no reaparece al refrescar.

### Validación
- Typecheck del frontend.

---

## [1.0.14] — 2026-06-28

### UX
**PDF Takeoff: el selector "Link to BOQ" era diminuto (inline en la barra lateral) (D-TKC-UP13)**

### Problema
El picker de BOQ se renderizaba inline dentro del ítem de medición (barra lateral ~288px, todo a 10px), quedando muy pequeño para una vista importante.

### Solución
- `TakeoffViewerModule.tsx`: el picker se renderiza ahora **dentro del canvas** (anclado a la derecha) vía `createPortal` al `containerRef` del lienzo — `absolute right-3 top-1/2 -translate-y-1/2`, **380px**, `max-h` al alto del canvas con scroll, fondo sólido y sombra. Como solo se muestra uno a la vez (`linkingMeasurementId === m.id`), el portal evita extraer las ~250 líneas del map.
- Más legibilidad: lista de posiciones más alta (`max-h-80`), y fuentes de búsqueda/selectores/filas subidas de 10px a `text-xs`/`text-sm`.

> Nota: primero se probó como panel `fixed` al borde de la ventana; a petición del usuario se movió a estar **dentro del canvas** (como el overlay de leyenda).

### Archivos modificados
- `frontend/src/modules/pdf-takeoff/TakeoffViewerModule.tsx`

### Validación
- Typecheck del frontend.

---

## [1.0.13] — 2026-06-27

### UX (clic accidental abría propiedades)
**PDF Takeoff: clic en el centro del ítem de medición seleccionaba/abría Propiedades; valor no copiable (D-TKC-UP12)**

### Problema
El ítem de medición (pestaña Propiedades) tenía `onClick` en el contenedor → un clic en el centro (el valor, los huecos) seleccionaba la medición y abría su panel de Propiedades, fácil de disparar sin querer. Además el valor no se podía seleccionar para copiar, y el lápiz de editar estaba inline junto al nombre.

### Solución (consensuada con el usuario)
- Se **elimina el `onClick` del contenedor**: un clic en el cuerpo/valor ya no selecciona ni abre Propiedades. Seleccionar (resaltar en el plano + panel de Propiedades) se hace **clicando la medición en el plano** (el canvas ya lo hacía).
- El **valor** queda como texto **copiable** (`select-text`, `title` con el valor completo).
- El **lápiz de editar** se mueve a un **botón propio a la derecha**, quedando el orden **[✏️ Editar] [🔗 BOQ] [🗑️ Eliminar]**. El nombre **sigue siendo clic-para-editar**.

### Archivos modificados
- `frontend/src/modules/pdf-takeoff/TakeoffViewerModule.tsx` — render del ítem de medición (no se tocó lógica de medición).

### Impacto
- `/takeoff` (lista de mediciones): clic en el centro = inerte y copiable; acciones explícitas a la derecha. Sin disparos accidentales de Propiedades.
- Las anotaciones no se tocan (su fila ya no tenía `onClick`).

### Validación
- Typecheck del frontend.

---

## [1.0.12] — 2026-06-27

### Bug (visible al recargar mediciones)
**PDF Takeoff: el subtítulo de cada medición mostraba el nombre duplicado en vez del valor tras recargar (D-TKC-UP11)**

### Problema
Al dibujar, `label` se rellena con el valor formateado (`formatMeasurement(...)` → "1.40 m", "0.2754 m² (P: 2.30 m)"). Pero al persistir solo se guarda el **nombre** en `annotation`; el valor vive en columnas numéricas (`measurement_value`, `perimeter`, `volume`, `depth`, `count_value`). En `fromApiFormat`, `label` se rellenaba con `r.annotation` (el nombre), así que tras recargar el subtítulo mostraba "Distance 6 / Distance 6" en vez de "Distance 6 / 1.40 m". El usuario lo confirmó: recién dibujadas muestran el valor; al reiniciar se vuelven el nombre.

### Solución
- `useMeasurementPersistence.ts`: nueva `reconstructValueLabel(r)` que **reconstruye el `label`** desde los campos numéricos del servidor, replicando el formato de creación por tipo:
  - distance/polyline → `value unit` ("1.40 m")
  - area → `value m² (P: perimeter m)`
  - volume → `V = volume m³ (A: area m² × D: depth m)`
  - count → `count_value pcs`
  - anotaciones → '' (su fila usa el tipo, no el label)
- `fromApiFormat` ahora usa `label: reconstructValueLabel(r)` (antes `r.annotation`). `annotation` sigue siendo el nombre.
- Import de `formatMeasurement` desde `./data/scale-helpers`.

### Archivos modificados
- `frontend/src/modules/pdf-takeoff/useMeasurementPersistence.ts`
- `frontend/src/modules/pdf-takeoff/useMeasurementPersistence.test.ts` — el test dual-key ahora también verifica `label === '2.50 m'` (valor, no nombre).

### Impacto
- Tras recargar, el subtítulo vuelve a mostrar el valor exactamente igual que recién dibujado. El dato nunca se perdió (estaba en el servidor); solo se reconstruye el texto.

### Validación
- Tests del hook 13/13 (incluye aserción de label).
- Typecheck del frontend.

---

## [1.0.11] — 2026-06-27

### UX (ocultaba grupos por accidente)
**PDF Takeoff: toda la fila de la leyenda alternaba la visibilidad → un clic accidental ocultaba un grupo entero (D-TKC-UP10)**

### Problema
En el overlay de leyenda, cada fila era un `<button>` de ancho completo con `onClick={toggleGroupVisibility}`. El icono del ojo era solo decorativo: hacer clic en **cualquier parte** de la fila (nombre, conteo, total) ocultaba el grupo. Como el panel flota sobre la esquina inferior izquierda del plano y es clicable en modo Select, un clic en esa zona —aunque fuera para el plano— ocultaba "todo" (el grupo General contiene casi todas las marcas). Reversible, pero confuso.

### Solución
- `TakeoffViewerModule.tsx`: la fila pasa a ser un `<div>` informativo (sin `onClick`, sin hover de botón). **Solo el icono del ojo** es ahora un `<button>` que alterna la visibilidad (con `title`/`aria-label`, área de clic ampliada y `data-testid="legend-eye-toggle"`).
- `e2e/pdf-takeoff-q1.spec.ts`: el test ahora hace clic en el ojo, no en la fila.

### Impacto
- `/takeoff`: clic en el cuerpo de la fila ya no oculta el grupo; solo el ojo. Se elimina el ocultado accidental.

### Validación
- Typecheck del frontend.

---

## [1.0.10] — 2026-06-27

### Bug (CAUSA RAÍZ definitiva — "no se ven las mediciones")
**PDF Takeoff: la carga del servidor se cancelaba antes de aplicar el resultado (D-TKC-UP09b)**

### Diagnóstico (instrumentación frontend→archivo)
Tras descartar persistencia/keying, se instrumentó el efecto de carga escribiendo a un archivo vía un endpoint temporal. La traza fue concluyente:
```
server-result counts=[0,7] cancelled=True
merged: 7 cancelled=True        ← NO hubo set-from-server
```
La lista del servidor **devolvía 7 mediciones** pero el efecto se **re-ejecutaba** a los ~60 ms y su función de limpieza ponía `cancelled = true`, así que el resultado se descartaba sin llamar a `setMeasurements`. La re-ejecución la causaban las props `setMeasurements`/`setPageScales`, que el visor pasaba envueltas en arrow functions nuevas en cada render (`(ms) => setMeasurements(ms)`) → identidad inestable → dependencia del efecto cambiaba en cada render.

### Solución
- `TakeoffViewerModule.tsx`: pasar los setters de React **directamente** (`setMeasurements`, `setPageScales`) — son estables entre renders. El efecto deja de re-ejecutarse de forma espuria; la carga ya no se cancela y aplica las mediciones.

### Archivos modificados
- `frontend/src/modules/pdf-takeoff/TakeoffViewerModule.tsx` — setters estables.

### Validación
- Verificado en vivo por el usuario ("eso era, solucionado").
- Tests del hook 13/13; typecheck del frontend limpio.
- Instrumentación temporal (endpoint `_debug_log`, logs de archivo, `dbgLog`) retirada tras confirmar.

---

## [1.0.9] — 2026-06-27

### Bug (regresión vs. versión que SÍ funcionaba)
**PDF Takeoff: las mediciones no se ven al reabrir/cambiar/re-subir — keying por UUID en vez de por nombre (D-TKC-UP09)**

### Diagnóstico (comparación con build de referencia)
El usuario señaló una copia hermana (`ERP-main/ERP-main`) donde las mediciones SÍ persistían. Diff de `useMeasurementPersistence.ts`: la referencia (606 líneas) indexa **todo por nombre de archivo** (`serverDocId = fileName`, `saveToStorage(fileName)`, `list(projectId, fileName)`); DEEP (731) lo cambió a **UUID de documento**. Como cada subida genera un UUID nuevo, re-subir o cambiar el mismo plano dejaba las mediciones bajo otro UUID → "no se ven". El render es idéntico; la diferencia es 100% el esquema de claves.

### Solución
- `useMeasurementPersistence.ts`: la **clave de persistencia vuelve a ser el nombre de archivo** (`serverDocId = localStorageKey = fileName`; identidad `${projectId}:${fileName}`). Estable entre re-subidas: abrir el mismo PDF siempre recarga sus mediciones.
- Se **conserva la carga dual-key** (también consulta por `documentId`) como red de seguridad para filas escritas por UUID por builds anteriores.
- Efecto secundario positivo: con identidad por nombre, un UUID que llega tras subir ya no cambia la identidad → sin wipe ni churn.

### Comportamiento resultante (coherente)
- Dibujar → refrescar → reabrir el mismo PDF: se ven (como la referencia).
- Borrar documento → sus mediciones se borran (cascada D-TKC-UP08) → re-subir = limpio.

### Archivos modificados
- `frontend/src/modules/pdf-takeoff/useMeasurementPersistence.ts` — claves por nombre.
- `frontend/src/modules/pdf-takeoff/useMeasurementPersistence.test.ts` — tests alineados (document_id = filename; sin migración de re-key).

### Validación
- Tests del hook 13/13.
- Typecheck del frontend.

---

## [1.0.8] — 2026-06-27

### Bug (CAUSA RAÍZ real del "no se guarda")
**PDF Takeoff: borrar un documento NO borra sus mediciones → quedan huérfanas y el plano reaparece "vacío" (D-TKC-UP08)**

### Diagnóstico con evidencia (BD)
Consulta a `oe_takeoff_measurement`: el usuario borraba documentos y re-subía el PDF. Como `document_id` es texto libre **sin FK**, `delete_document` borraba el PDF y la fila del documento **pero dejaba las mediciones colgadas de un UUID muerto**. Resultado: 180 filas totales, de las cuales **105 huérfanas bajo `0ff05426` (doc borrado)** + 14 bajo el nombre. Al re-subir, el documento nuevo nacía vacío → "Measurements (0)". El guardado nunca falló; la **eliminación estaba incompleta** (desincronizada, como detectó el usuario).

### Solución
- `MeasurementRepository.delete_for_document(*ids)` — borrado masivo de mediciones por `document_id` (acepta UUID y nombre).
- `TakeoffService.delete_document` ahora **borra en cascada** las mediciones del documento (por UUID y por su filename) antes de eliminar la fila + el PDF, y registra cuántas borró.

### Archivos modificados
- `backend/app/modules/takeoff/repository.py` — import `delete`; nuevo `delete_for_document`.
- `backend/app/modules/takeoff/service.py` — `delete_document` cascada a mediciones.

### Impacto
- Borrar un documento de takeoff ahora elimina sus mediciones (comportamiento esperado). Sin huérfanos nuevos ni tabla inflada.
- **Requiere reiniciar el backend** para tomar efecto.
- Pendiente (one-time): purgar las 119 mediciones huérfanas ya existentes (docs ya borrados).

### Validación
- Sintaxis backend OK; tests del hook 13/13.
- Evidencia BD del estado huérfano (105+14).

---

## [1.0.7] — 2026-06-27

### Bug
**PDF Takeoff: las mediciones/anotaciones no persisten al refrescar o cambiar de archivo (D-TKC-UP07)**

### Resumen
La clave de persistencia (`serverDocId`) se calculaba como `documentId || fileName`, de modo que un PDF cargado localmente en el visor guardaba sus mediciones en el servidor bajo el **nombre de archivo**. Cuando la subida en segundo plano terminaba, `initialDocId` pasaba a un **UUID**, lo que: (1) disparaba el efecto de carga que hacía `setMeasurements([])` —borrando las mediciones de la pantalla— y (2) reconsultaba el servidor por el UUID, que no tenía filas (estaban bajo el nombre). Las filas quedaban huérfanas y al refrescar/cambiar de archivo no aparecía nada, pese a mostrar "Synced".

### Diagnóstico con evidencia (BD)
Consulta directa a `oe_takeoff_measurement`: el guardado **sí funciona** — el documento "housing_standards - copia (4).pdf" (UUID `0ff05426`) tenía **94 mediciones `confirmed`** indexadas por UUID. El síntoma "Measurements (0)" era de **lectura**: al refrescar/cambiar se abría un documento distinto (hay 3 casi homónimos) o uno cuyas filas estaban bajo el **nombre** (huérfanas de antes del cambio de clave, o de un upload duplicado que devolvió 409 sin asignar UUID).

### Solución (enfoque final: carga dual-key, sin regresión de guardado)
- **Guardado**: `serverDocId = documentId || fileName` (se conserva). Siempre persiste con la mejor clave disponible — un PDF local o duplicado (409) nunca deja de guardar.
- **Carga (clave del fix)**: el efecto consulta el servidor por **AMBAS** claves —UUID y nombre— y **fusiona sin duplicados** (dedupe por `id` de servidor y por `frontend_id`). Así, abras el documento por UUID o por nombre, sus mediciones aparecen, incluidas las huérfanas históricas.
- Se mantiene la **migración de re-key sin borrado** (nombre → UUID) para evitar el parpadeo `setMeasurements([])` cuando termina la subida en segundo plano.

### Archivos modificados
- `frontend/src/modules/pdf-takeoff/useMeasurementPersistence.ts` — carga dual-key (UUID + nombre) con merge/dedupe; migración de re-key sin borrado; guardado conserva `documentId || fileName`.
- `frontend/src/modules/pdf-takeoff/useMeasurementPersistence.test.ts` — 2 tests nuevos: carga dual-key (recupera huérfanos por nombre abriendo por UUID) y re-key sin borrado.

### Impacto
- Pantalla `/takeoff`: al abrir cualquier documento se ven sus mediciones, estén indexadas por UUID o por nombre. Recupera datos previamente "invisibles".
- Sin cambios de BD ni de backend (descartado como causa: rutas sin duplicar, servicio correcto).

### Validación
- `vitest run useMeasurementPersistence.test.ts` → **13/13 OK**.
- `tsc` (typecheck completo del frontend) → **0 errores**.
- Evidencia de BD que confirma 94 mediciones guardadas correctamente.
- Pendiente: prueba manual end-to-end (abrir "copia (4)" debe mostrar las 94).

### Edge cases conocidos (pendientes)
1. **Documentos duplicados**: re-soltar el mismo PDF crea/abre documentos distintos; conviene que un 409 resuelva al documento existente y fije `?doc=` para que el refresco reabra el correcto.
2. Cargar un **segundo** PDF local con "Load new PDF" con otro documento abierto puede atribuir mediciones al previo durante la ventana de subida (`initialDocId` obsoleto hasta `onSuccess`).

---

## [1.0.6] — 2026-07-17

### Bug
**PDF Takeoff: Eliminar del filmstrip no borra entrada en "Archivos de proyecto" (D-TKC-UP06)**

### Resumen
El botón ✕ del filmstrip llamaba a `DELETE /documents/{id}` que solo borraba `oe_takeoff_document`. La entrada cross-link en `oe_documents_document` (módulo Documents) quedaba huérfana.

### Archivos modificados
- `backend/app/modules/takeoff/router.py` — `delete_document` ahora limpia el cross-link en Documents hub (sesión independiente, best-effort)

### Impacto
- Al eliminar del filmstrip, también desaparece de "Archivos de proyecto"
- Sin riesgo de rollback: el cross-link usa `async_session_factory()` propia

---

## [1.0.5] — 2026-07-17

### Bug
**PDF Takeoff: TypeError `viewerDoc?.name.toLowerCase()` rompía el upload (D-TKC-UP05b)**

### Resumen
Faltaba `?.` antes de `toLowerCase()`. Cuando `viewerDoc` era `null`, `viewerDoc?.name` devolvía `undefined` y `undefined.toLowerCase()` lanzaba TypeError que frenaba `handleFilesSelected` por completo. La subida nunca llegaba al `fetch`.

### Archivos modificados
- `frontend/src/features/takeoff/TakeoffPage.tsx` — `viewerDoc?.name?.toLowerCase()` (doble optional chaining)

---

## [1.0.4] — 2026-07-17

### Bug
**PDF Takeoff: Filmstrip muestra "(0)" cuando hay un PDF abierto en el visor (D-TKC-UP05)**

### Resumen
El filmstrip (`TakeoffDocFilmstrip`) mostraba "Documents (0)" aunque hubiera un PDF cargado en el visor. El `filmstripDocuments` memo solo consideraba `serverDocuments` y `documents` state — no incluía `viewerDoc` (documento actualmente abierto). Además, las cargas locales ("Load new PDF" del toolbar o drop en visor) nunca notificaban al padre.

### Archivos modificados
- `frontend/src/features/takeoff/TakeoffPage.tsx` — `filmstripDocuments` ahora incluye `viewerDoc` como tercera fuente; handler `onLocalFileOpened` para cargas locales
- `frontend/src/modules/pdf-takeoff/TakeoffViewerModule.tsx` — nuevo prop `onLocalFileOpened` llamado desde `handleFileUpload`

### Impacto
- Filmstrip: nunca más muestra "(0)" mientras hay un PDF abierto en el visor
- Cargas locales (drop / toolbar "Load new PDF") ahora aparecen en el filmstrip

### Validación
- Revisión estática de código
- Pendiente: build, prueba manual

---

## [1.0.3] — 2026-07-17

### Bug
**PDF Takeoff: Se permite subir dos PDFs con el mismo nombre al mismo proyecto (D-TKC-UP04)**

### Resumen
No existía validación de unicidad de filename por proyecto. Se podía subir "plano.pdf" dos veces al mismo proyecto, creando dos filas en `oe_takeoff_document` y dos archivos en disco. Ahora el backend rechaza con 409 Conflict.

### Archivos modificados
- `backend/app/modules/takeoff/repository.py` — nuevo método `count_by_filename_in_project`
- `backend/app/modules/takeoff/service.py` — Gate 4: verifica duplicado antes del parseo

### Impacto
- API: `POST /upload/` → 409 si el filename ya existe en el proyecto
- BD: integridad lógica de nombres por proyecto

### Validación
- Revisión estática de código
- Pendiente: build, prueba manual

---

## [1.0.2] — 2026-07-17

### Bug
**PDF Takeoff: Documentos con mismo nombre comparten mediciones (D-TKC-UP03)**

### Resumen
`document_id` en la tabla `oe_takeoff_measurement` usaba el **filename** del PDF en vez del **UUID** del `TakeoffDocument`. Dos documentos distintos con el mismo nombre ("plano.pdf") compartían el mismo pool de mediciones — al abrir el segundo, el viewer cargaba y mezclaba las mediciones del primero.

### Archivos modificados
- `frontend/src/features/takeoff/TakeoffPage.tsx` — `viewerDoc` ahora incluye `id`, propagado como `initialDocId` al viewer
- `frontend/src/modules/pdf-takeoff/TakeoffViewerModule.tsx` — acepta `initialDocId`, trackea `documentId`, lo pasa al hook y a metadata BOQ
- `frontend/src/modules/pdf-takeoff/useMeasurementPersistence.ts` — acepta `documentId`, `serverDocId = documentId || fileName` para server API; localStorage sigue usando `fileName`

### Impacto
- BD: `oe_takeoff_measurement.document_id` ahora recibe UUID (cuando disponible) en vez de filename
- API: `POST/GET /measurements` filtran por UUID real del documento
- BOQ: metadata `pdf_document_id` ahora es UUID
- Pantalla: `/takeoff` — docs homónimos ya no comparten mediciones

### Validación
- Revisión estática de código
- Pendiente: build, typecheck, prueba manual

---

## [1.0.1] — 2026-07-17

### Bug
**PDF Takeoff: Upload no asocia proyecto → documento desaparece tras refrescar (D-TKC-UP02)**

### Resumen
El `uploadMutation` en el frontend no enviaba `project_id` al backend. El PDF se guardaba en disco y BD pero con `project_id=NULL`. Al refrescar la página, `listDocuments` filtraba por proyecto activo y excluía el documento, dando la percepción de "no se guarda".

### Archivos modificados
- `frontend/src/features/takeoff/TakeoffPage.tsx` — uploadMutation lee `useProjectContextStore.activeProjectId` y lo envía como `?project_id=`
- `backend/app/modules/takeoff/service.py` — `write_bytes` ahora con try/except OSError y mensaje claro

### Documentación actualizada
- `CHANGELOG.md` (este archivo)

### Impacto
- Módulo: `takeoff` (Mediciones PDF)
- API: `POST /v1/takeoff/documents/upload/` ahora recibe `?project_id=`
- BD: `oe_takeoff_document.project_id` ahora se puebla correctamente
- Pantalla: `/takeoff` — documentos persisten tras F5

### Validación
- Revisión estática de código (frontend + backend)
- Verificación de referencias cruzadas
- Pendiente: typecheck, build, prueba manual con PDF real

---

## [1.0.0] — 2026-07-17

### Added
- Creación inicial del Framework de Context Engineering
- Estructura de directorios SKILL/
- Documentación completa del módulo dwg-takeoff (Mediciones DWG)
- Análisis de arquitectura, stack tecnológico, base de datos, API, permisos
- Templates oficiales para documentación
- Checklists para tareas comunes
- MANIFEST.md, SYSTEM-INDEX.md, CONTEXT-MAP.md, KNOWLEDGE-GRAPH.md

### Module Coverage
- ✅ dwg-takeoff (Mediciones DWG) — documentación completa
- ⬜ boq (Presupuesto) — pendiente
- ⬜ bim_hub (BIM 3D) — pendiente
- ⬜ pdf-takeoff (Mediciones PDF) — pendiente
- ⬜ projects (Proyectos) — pendiente
- ⬜ documents (Documentos/CDE) — pendiente
- ⬜ ai_estimator (IA Estimador) — pendiente
- ⬜ schedule (Cronograma) — pendiente
- ⬜ variations (Variaciones) — pendiente
- ⬜ ... (resto de módulos) — pendiente
