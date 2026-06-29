# Eventos — Módulo DWG Takeoff

## Event Bus

El módulo usa el `event_bus` interno de ERP-DEEP para comunicación laxa entre módulos.

---

## Eventos Suscritos (Listeners)

### `boq.position.deleted`

**Publicado por**: Módulo `boq` cuando se elimina una partida del presupuesto.

**Manejado por**: `dwg_takeoff/events.py → _on_boq_position_deleted()`

**Payload**:
```json
{
  "position_id": "uuid-string",
  "boq_id": "uuid-string"
}
```

**Acción**: Limpia `linked_boq_position_id = NULL` en todas las anotaciones DWG vinculadas a la partida eliminada.

**Idempotente**: Sí — ejecutarlo dos veces es inofensivo.

**No bloqueante**: Si falla, se loguea pero nunca impide el delete del BOQ.

---

## Eventos Publicados

Actualmente el módulo no publica eventos propios. Las acciones que modifican el estado se comunican a través de:

- React Query `invalidateQueries` (frontend)
- Actualizaciones directas en base de datos (backend)
- Eventos del módulo BOQ para cleanup

---

## Background Tasks

### Conversión DWG → DXF (asyncio.create_task)

**Disparador**: `POST /drawings/upload` (cuando el archivo es `.dwg`)

**Función**: `service.py → _spawn_dwg_conversion()` → `_run_dwg_conversion_in_background()`

**Ciclo de vida**:
1. Drawing creado con `status="uploaded"`
2. Se lanza `create_task` para conversión DDC (no bloquea la respuesta HTTP)
3. El task se guarda en `_BACKGROUND_CONVERSION_TASKS` (set) para evitar GC prematuro
4. Durante la conversión: `status="processing"`
5. Al terminar: `status="ready"` (o `error`/`empty`/`needs_conversion`)
6. El frontend hace polling de `GET /drawings/{id}` cada 3.5s

---

## Conversión DDC (DataDrivenConstruction)

El pipeline de conversión DWG es externo:

```
.dwg file → DDC DwgExporter (CLI) → Excel/CSV → CadExtractionSession
                                                → DwgDrawingVersion (entities JSON)
```

- `ddc_dwg_parser.py`: Invoca el converter externo
- `dxf_processor.py`: Parsea archivos DXF con ezdxf (directo, sin DDC)
