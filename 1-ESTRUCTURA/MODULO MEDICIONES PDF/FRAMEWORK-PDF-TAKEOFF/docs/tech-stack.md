# Tech Stack — PDF Takeoff

## Backend
- Python 3.12+, **FastAPI**, **SQLAlchemy 2 async**, asyncpg, **PostgreSQL 16** (embebido vía
  pixeltable-pgserver en dev; `~/.openestimate`).
- **PyMuPDF (pymupdf)** — extracción de texto y vectores del PDF.
- **OpenCV + numpy** (extra `cv`) — reconocimiento raster de planos escaneados.
- Proveedor **LLM** del usuario (DeepSeek/OpenAI/Anthropic…) vía `app.modules.ai`.
- CLI: `openconstructionerp serve --port 8000`.

## Frontend
- **React 18 + TypeScript + Vite**.
- **pdf.js (pdfjs-dist)** — render del PDF en `<canvas>`.
- **Canvas 2D** — capa de overlay para dibujo de mediciones/anotaciones.
- **React Query** (mutaciones/queries), **Zustand** (`useProjectContextStore`,
  `useToastStore`, `useAuthStore`).
- **Tailwind**, **lucide-react** (iconos), **i18next** (locales en `app/locales/*.ts`).
- Tests: **vitest** + @testing-library; e2e **Playwright**.

## Comandos
- Backend: `openconstructionerp serve --port 8000`.
- Frontend: `npm run dev` (proxy `/api/*` → :8000). Validación: `npm.cmd run typecheck`,
  `npx vitest run <archivo>`.
