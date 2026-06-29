# Módulo: PDF Takeoff (Mediciones PDF) — Spec de reconstrucción desde cero

> Objetivo: reconstruir el módulo **completo** en otro proyecto sin leer el código
> original. Todo respaldado en el código actual. Generado con `SKILL-PLANIFICADOR-V2.md`.

---

## 1. Identidad

| | |
|---|---|
| **Nombre funcional** | Mediciones PDF / PDF Takeoff |
| **Módulo backend** | `oe_takeoff` — `backend/app/modules/takeoff/` |
| **Manifest backend** | `name="oe_takeoff"`, `display_name="Quantity Takeoff"`, `category="extension"`, `depends=["oe_projects","oe_cad"]`, `auto_install=False`, `enabled=True` |
| **Módulo frontend enchufable** | id `pdf-takeoff`, `category:'tools'`, `defaultEnabled:true`, ruta `/takeoff-viewer` |
| **Página principal frontend** | ruta `/takeoff` → `features/takeoff/TakeoffPage.tsx` |
| **Permisos** | `takeoff.read`, `takeoff.create`, `takeoff.update`, `takeoff.delete` (+ `variations.create`) |
| **Ruta API base** | `/api/v1/takeoff/` |
| **Icono** | `Ruler` (lucide) |

## 2. ¿Qué hace y por qué existe?

Cuantificar (medir) cantidades **directamente sobre planos PDF**. El usuario carga un
PDF, **calibra la escala**, dibuja **mediciones** (distancia, polilínea, área, volumen,
conteo) y **anotaciones** (nube, flecha, texto, rectángulo, resaltado), las agrupa por
color, y **empuja cada cantidad a una posición del presupuesto (BOQ)**. Incluye IA:
"Analizar con IA" (texto del PDF → partidas) y "Recognize/Plan‑read" (geometría →
mediciones propuestas). Principio rector: **la IA propone, el humano confirma**.

Problema que resuelve: cubicación manual sobre planos sin CAD; alimenta el 5D (costo)
ligando mediciones ↔ BOQ.

## 3. Dos superficies de UI

1. **`/takeoff` → `TakeoffPage.tsx`** — punto de entrada del usuario. Dos pestañas:
   **Measurements** (visor + medición) y **Documents & AI** (subir PDFs, Analizar con
   IA, Extraer tablas). Botón **Compare** (comparar 2 PDFs). Monta el visor.
2. **`/takeoff-viewer` → `TakeoffViewerModule.tsx`** (módulo `pdf-takeoff`) — el visor
   embebible. Es el **núcleo** (~5.944 líneas): PDF + canvas de dibujo + barra de
   herramientas + panel lateral.

`TakeoffPage` envuelve al visor y añade la gestión de documentos/IA. Ambas comparten
estado de proyecto activo (`useProjectContextStore`).

## 4. Mapa de archivos a recrear

**Backend** (`backend/app/modules/takeoff/`): `manifest.py`, `models.py` (4 tablas),
`schemas.py`, `router.py` (~47 endpoints), `service.py`, `repository.py`,
**`permissions.py`** (mapa permiso→rol mínimo; ver [permissions](../../permissions/pdf-takeoff.md)),
`plan_read.py`, `recognize.py`, `raster_recognize.py`, `manifest_verifier.py`.

**Frontend**:
- `features/takeoff/TakeoffPage.tsx` — página `/takeoff` (tabs, subida, Documents & AI).
- `modules/pdf-takeoff/TakeoffViewerModule.tsx` — visor (núcleo).
- `modules/pdf-takeoff/manifest.ts` — registro del módulo.
- `modules/pdf-takeoff/useMeasurementPersistence.ts` — carga/guardado de mediciones.
- `modules/pdf-takeoff/data/page-scales.ts` — modelo de escala por página.
- `modules/pdf-takeoff/data/scale-helpers.ts` — `formatMeasurement`, derivar escala.
- `features/takeoff/api.ts` — cliente HTTP `takeoffApi`.
- `features/takeoff/lib/takeoff-groups.ts` — `computeGroupSummaries`, `formatGroupTotal`.
- `features/takeoff/lib/takeoff-shortcuts.ts` — atajos por herramienta.
- `features/takeoff/components/CalibrationDialog.tsx`, `MeasurementLedger.tsx`.
- `features/takeoff/takeoffGuide.ts` — guía "How it works".

## 5. Modelo de datos (resumen — detalle en [database](../../database/pdf-takeoff.md))
- **`oe_takeoff_document`** — PDF subido.
- **`oe_takeoff_measurement`** — medición/anotación. `document_id` es **`String(255)` SIN FK**.
- **`oe_ai_takeoff_run`** — corrida de lectura de plano por IA.
- **`oe_takeoff_cad_session`** — sesión de extracción CAD (rvt/ifc/dwg/dgn).

DDL completo: [`database/pdf-takeoff-schema.sql`](../../database/pdf-takeoff-schema.sql).

## 6. Decisiones clave de persistencia (LEER ANTES DE REIMPLEMENTAR)

`measurement.document_id` es **texto libre sin FK**. La clave de persistencia de las
mediciones es el **nombre de archivo**, no el UUID (el UUID cambia al borrar+re-subir).
Reglas consolidadas (historial D-TKC-UP07…UP16, ver [logic](../../logic/pdf-takeoff.md)):

1. **Guardar** bajo `serverDocId = fileName`.
2. **Cargar** *dual-key*: consulta por `documentId` **y** `fileName`, fusiona y deduplica
   (por `id` de servidor + `metadata.frontend_id`).
3. Pasar los **setters de React estables** al hook (no arrows nuevas): si no, la carga se
   cancela a mitad (race) y "no se ven las mediciones".
4. **Borrar** una medición = `DELETE` al backend en las 3 rutas (papelera, tecla Del,
   Clear all); si no, reaparece al refrescar.
5. **Borrar un documento** = cascada que elimina sus mediciones (sin FK, explícito en
   `service.delete_document`).
6. El **valor mostrado** (`label`) de cada medición se **reconstruye** desde los campos
   numéricos del servidor al cargar (no se persiste el texto formateado).
7. Auto-sync con **debounce 1s** + guardia anti-solapamiento (evita duplicados).
8. Aviso "cambios sin guardar" (`beforeunload`) solo si hay algo **sin sincronizar**.

## 7. Documentos relacionados
[UI](../../ui/pdf-takeoff.md) · [**Botones**](../../ui/buttons/pdf-takeoff.md) · [Formularios](../../ui/forms/pdf-takeoff.md) ·
[API](../../api/pdf-takeoff.md) · [Base de datos](../../database/pdf-takeoff.md) ·
[Lógica](../../logic/pdf-takeoff.md) · [Workflows](../../workflows/pdf-takeoff.md) ·
[Componentes](../../components/pdf-takeoff.md) · [Permisos](../../permissions/pdf-takeoff.md) ·
[Dependencias](../../dependencies/pdf-takeoff.md) · [Eventos](../../events/pdf-takeoff.md) ·
[Spec paso a paso](../../../reports/pdf-takeoff-rebuild-spec.md)
