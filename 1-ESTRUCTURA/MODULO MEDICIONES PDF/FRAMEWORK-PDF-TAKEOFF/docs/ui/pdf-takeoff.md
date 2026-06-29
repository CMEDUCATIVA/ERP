# UI / Pantallas — PDF Takeoff

> Pantallas, rutas, estados y layout. Botones detallados en [buttons](buttons/pdf-takeoff.md).

---

## 1. Pantalla principal `/takeoff` (`TakeoffPage.tsx`)
Layout vertical: breadcrumb · título "Mediciones PDF" · banner "How it works" · **tabs**
(`Measurements` | `Documents & AI`) + botón **Compare**.

### Tab "Measurements"
Dos columnas:
- **Izquierda (flex-1)**: barra de herramientas + **canvas** (PDF renderizado + canvas de
  overlay para dibujo) + overlay de **leyenda** (abajo-izq) + (al pulsar 🔗) panel **Link to
  BOQ** dentro del canvas (derecha).
- **Derecha (panel ~288px)**: cabecera de **escala**/grupo activo, **tabs** `Propiedades` /
  `Registro`, y la lista de **Measurements (N)** agrupada (mediciones + sección de
  Anotaciones aparte).

### Tab "Documents & AI"
- **DropZone** (subir PDFs) + lista de **DocumentCard** (Analizar con IA / Extraer tablas /
  Ver / borrar) + aviso "conecta IA" si no hay proveedor.

## 2. Pantalla del módulo enchufable `/takeoff-viewer` (`TakeoffViewerModule.tsx`)
El mismo visor de la tab Measurements, embebible. Acepta props: `initialPdfUrl`,
`initialPdfName`, `initialDocId`, `initialMeasurementId`, `recentDocuments`,
`onOpenRecentDocument`, `onLocalFileOpened`.

## 3. Estados de la pantalla
| Estado | Disparador | UI |
|---|---|---|
| **Sin PDF** | no hay documento abierto | Landing / DropZone dentro del visor |
| **Cargando PDF** | fetch del PDF | spinner |
| **Cargando mediciones** | hook de persistencia | lista se rellena tras `GET /measurements` |
| **Syncing / Synced** | auto-sync | badge en cabecera "Measurements" |
| **Sin calibrar** | página sin escala | badge ámbar "Calibrate" |
| **Herramienta activa** | `selectTool` | hint flotante arriba del canvas + cursor `crosshair` |
| **Analyzing / Extracting** | mutaciones IA | spinner en el botón del DocumentCard |
| **Error IA** | onError | **toast** rojo con el motivo |
| **0 ítems IA** | onSuccess vacío | **toast** info "no encontró partidas" |

## 4. Navegación / deep-links (searchParams)
- `?doc=<id>&tab=measurements` → reabre el documento en el visor al refrescar.
- `?doc=<id>&source=document` → abre un PDF del hub de Documentos.
- `?docId=<filename|uuid>&measurementId=<uuid>` → desde el hub de Markups; abre y
  selecciona la medición.
- `/takeoff` registrado en `App.tsx` (ruta), `Header.tsx` (label), `routeIcons.ts` (Ruler),
  `projectJourneyData.ts` (nav `nav.pdf_measurements`).

## 5. i18n
Claves bajo `takeoff.*` y `takeoff_viewer.*` (locales en `frontend/src/app/locales/*.ts`).
Muchos botones usan `defaultValue` inline (fallback). Ej. añadido: `takeoff_viewer.help_extended`
(traducción del recuadro de ayuda, con nombres de herramientas en inglés para cuadrar con
los botones).
