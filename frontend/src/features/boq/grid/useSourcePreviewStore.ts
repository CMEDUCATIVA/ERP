// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
/**
 * useSourcePreviewStore — holds the open state of the BOQ PDF/DWG "source"
 * popover OUTSIDE the AG-Grid cell renderer.
 *
 * Why (identical reasoning to useBimPreviewStore): the PDF/DWG source buttons
 * live in an AG-Grid cell renderer, which AG-Grid destroys/recreates when the
 * cell first gains focus or when the row flashes `ag-cell-data-changed`. When
 * the popover's open flag lived in the renderer's local `useState`, the first
 * click opened it and the focus-driven remount immediately reset the state to
 * closed — so the popover "opened then closed" on the first click and only
 * stayed open on the second. Lifting the state here (and rendering a single
 * popover at the grid level via SourcePreviewHost) makes a single click survive
 * any cell refresh, exactly like the BIM preview already does.
 */
import { create } from 'zustand';

export interface SourcePreviewPayload {
  /** Which source kind this row is linked to. */
  kind: 'pdf' | 'dwg';
  /** Human-readable source document / drawing name. */
  sourceName: string | null;
  /** PDF page (pdf kind only). */
  page?: number | null;
  /** Takeoff measurement id (pdf kind only). */
  measurementId?: string | null;
  /** DWG drawing id (dwg kind only). */
  drawingId?: string | null;
  /** DWG annotation id (dwg kind only). */
  annotationId?: string | null;
  /** The BOQ position row data (for "set as quantity" / unlink actions). */
  positionData: Record<string, unknown>;
  /** Deep-link URL into the source viewer, focused on this item. */
  deepLink: string;
}

interface SourcePreviewState {
  open: SourcePreviewPayload | null;
  openSource: (payload: SourcePreviewPayload) => void;
  closeSource: () => void;
}

export const useSourcePreviewStore = create<SourcePreviewState>((set) => ({
  open: null,
  openSource: (payload) => set({ open: payload }),
  closeSource: () => set({ open: null }),
}));
