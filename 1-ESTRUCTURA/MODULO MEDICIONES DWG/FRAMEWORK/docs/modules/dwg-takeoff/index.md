# Módulo: Mediciones DWG (`dwg_takeoff`)

## Identidad

| Atributo | Valor |
|---|---|
| **Nombre técnico** | `oe_dwg_takeoff` |
| **Nombre display** | DWG Takeoff / Mediciones DWG |
| **Ruta frontend** | `/dwg-takeoff` |
| **Categoría** | `extension` |
| **Dependencia obligatoria** | `oe_projects` |
| **Versión** | 1.0.0 |
| **Auto-install** | Sí |
| **Enabled por defecto** | Sí |

## Objetivo

Visor y herramienta de medición 2D para planos CAD (DWG/DXF). Es el equivalente 2D del visor BIM 3D. Permite a los estimadores y arquitectos medir distancias, áreas, perímetros y contar elementos directamente sobre planos técnicos.

## Descripción

El módulo permite:
1. Subir archivos DWG/DXF al proyecto
2. Visualizar entidades CAD en un Canvas2D con zoom/pan
3. Alternar capas (layers) para filtrar el dibujo
4. Calibrar la escala del plano (presets o manual 2 puntos)
5. Medir distancias, áreas, perímetros, círculos
6. Anotar con flechas, texto, rectángulos, círculos, polilíneas
7. Vincular mediciones a partidas del BOQ (presupuesto)
8. Comparar revisiones de planos (diff visual)
9. Exportar a PDF
10. Vincular entidades a cronograma, documentos, requerimientos, punchlist

## Usuarios

- **Estimador (Quantity Surveyor)**: Mide cantidades y las vincula al BOQ
- **Arquitecto**: Revisa planos, anota observaciones
- **Project Manager**: Compara revisiones, vincula a cronograma
- **Ingeniero**: Verifica dimensiones y especificaciones

## Responsabilidades

- Parseo de archivos DWG/DXF
- Renderizado 2D de entidades CAD
- Cálculo preciso de mediciones geométricas
- Vinculación de mediciones a partidas presupuestarias
- Comparación de revisiones de planos

## Dependencias

### Internas (ERP-DEEP)
- `oe_projects` — Vinculación a proyecto (CASCADE delete)
- `boq` — Vinculación a partidas presupuestarias
- `bim_hub` — Módulo hermano (mismo grupo "Mediciones")
- `documents` — Import/export de documentos
- `schedule` — Vinculación 4D a cronograma
- `punchlist` — Vinculación a punch items
- `bim_requirements` — Vinculación a requerimientos
- `ai_estimator` — Fuente de datos para estimaciones IA
- `match_elements` — Adaptador para matching con catálogos
- `variations` — Generación de solicitudes de cambio
- `takeoff` — Infraestructura de conversión CAD compartida

### Externas
- `ezdxf` — Parser de archivos DXF
- DDC DwgExporter — Conversor externo de DWG a entidades

## Problemas que resuelve

1. **Medición directa sobre planos**: Sin exportar a otra herramienta
2. **Trazabilidad**: Cada medición vinculada a una partida BOQ
3. **Control de revisiones**: Comparar versiones y detectar cambios con impacto en costo
4. **Unificación 2D+3D**: Las mediciones DWG y BIM fluyen al mismo BOQ
5. **Trabajo offline**: Conversión local sin enviar archivos a terceros

## Riesgos

- **Conversión DWG lenta**: Un plano mediano puede tardar 3-8 minutos en el converter DDC
- **Archivos corruptos**: PDFs/ZIPs renombrados como .dwg causan errores silenciosos
- **Precisión de escala**: Si el usuario no calibra, las mediciones son incorrectas
- **Unidades DXF**: Archivos en mm sin calibrar muestran valores 1000x reales

## Estados del Drawing

```
uploaded → processing → ready    (éxito)
                       → empty    (sin entidades)
                       → error   (fallo conversión)
                       → needs_conversion (sin converter)
```

## Archivos del módulo

### Backend (`backend/app/modules/dwg_takeoff/`)
| Archivo | Función | Líneas |
|---|---|---|
| `manifest.py` | Registro del módulo | 16 |
| `models.py` | 4 tablas ORM | 227 |
| `schemas.py` | Pydantic validación | 406 |
| `router.py` | 22+ endpoints REST | 939 |
| `service.py` | Lógica de negocio | 2295 |
| `repository.py` | 4 repositorios data access | 244 |
| `permissions.py` | Definición de permisos | 17 |
| `events.py` | EventBus listeners | 101 |
| `dxf_processor.py` | Parser DXF (ezdxf) | — |
| `ddc_dwg_parser.py` | Parser DWG (DDC) | — |

### Frontend (`frontend/src/features/dwg-takeoff/`)
| Archivo | Función | Líneas |
|---|---|---|
| `DwgTakeoffPage.tsx` | Página principal | 6117 |
| `api.ts` | API calls tipadas | 585 |
| `components/DxfViewer.tsx` | Renderizador Canvas2D | — |
| `components/ToolPalette.tsx` | 11 herramientas | 124 |
| `components/LayerPanel.tsx` | Panel de capas | — |
| `components/CalibrationDialog.tsx` | Calibración | — |
| `components/SheetStrip.tsx` | Filmstrip de planos | — |
| `lib/measurement.ts` | Cálculos geométricos | 247 |
| `lib/calibration.ts` | Lógica de calibración | — |
| `lib/dxf-renderer.ts` | Motor de renderizado | — |
| `stores/useDwgUploadStore.ts` | Estado global uploads | 382 |
