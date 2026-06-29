# Dependencias — PDF Takeoff

## 1. Dependencias del módulo backend (`oe_takeoff`)
- **`oe_projects`** (obligatoria) — proyecto activo, `verify_project_access`.
- **`oe_cad`** (obligatoria) — comparte el flujo CAD-data / convertidores DDC.

## 2. Integraciones (acoplamiento lógico)
| Con | Cómo | Dirección |
|---|---|---|
| **BOQ** (`oe_boq`) | `linked_boq_position_id`; `link-to-boq` empuja cantidades; create-position | Takeoff → BOQ |
| **Documents hub** (`oe_documents_document`) | cross-link al subir/listar/borrar (best-effort, sesión propia) | Takeoff ↔ Documents |
| **Markups hub** | deep-link `?docId=&measurementId=`; `qc.invalidateQueries(['unified-markups'])` tras sync | Takeoff → Markups |
| **AI** (`app.modules.ai`) | `call_ai`, `resolve_provider_key_model`, prompts (analyze, plan-read) | Takeoff → AI |
| **Variations** | `create-variation` desde compare (permiso `variations.create`) | Takeoff → Variations |
| **Cost DB / match** | plan-read `do_cost_match` | Takeoff → Cost |

## 3. Dependencias técnicas (recrear)
- **Backend**: FastAPI, SQLAlchemy async, asyncpg/PostgreSQL, **PyMuPDF (pymupdf)** (texto +
  vector), **OpenCV/numpy** (raster recognize, extra `cv`), proveedor LLM (DeepSeek/OpenAI/…).
- **Frontend**: React, React Query, Zustand, **pdf.js (pdfjs-dist)**, Canvas 2D, Tailwind,
  lucide-react, i18next.

## 4. Impacto al cambiar
| Si cambias… | Revisa… |
|---|---|
| `useMeasurementPersistence` (keying/dual-key) | reabrir, borrar, BOQ link, refresh |
| `delete_document` | cascada de mediciones, cross-link Documents |
| `analyze_document` (parseo) | Add-to-BOQ, toasts, formato de partidas |
| recompute B8 (service) | valores mostrados, push a BOQ |
| Esquema `document_id` | dual-key load, compare, plan-read |
