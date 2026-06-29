// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
/**
 * useBimPreviewStore — holds the open state of the BOQ "Linked geometry" BIM
 * preview popover OUTSIDE the AG-Grid cell renderer.
 *
 * Why: the BIM-link button lives in an AG-Grid cell renderer, which AG-Grid
 * treats as disposable — it destroys/recreates the renderer when the cell
 * first gains focus or when the row flashes `ag-cell-data-changed`. Storing the
 * popover's open flag in the renderer's local `useState` meant the first click
 * opened it and the focus-driven remount immediately reset the state to closed,
 * so the user had to click twice. Lifting the state here (and rendering a
 * single popover at the grid level via BimLinkPreviewHost) makes a single click
 * survive any cell refresh.
 */
import { create } from 'zustand';

export interface BimPreviewPayload {
  /** Position (row) id the preview was opened from. */
  rowId: string;
  /** Anchor rect of the button at click time (popover is positioned next to it). */
  anchorRect: DOMRect;
  /** Linked BIM element ids to preview. */
  elementIds: string[];
  /** The BOQ position row data (for "use as quantity" actions). */
  positionData: Record<string, unknown>;
}

interface BimPreviewState {
  open: BimPreviewPayload | null;
  openPreview: (payload: BimPreviewPayload) => void;
  closePreview: () => void;
}

export const useBimPreviewStore = create<BimPreviewState>((set) => ({
  open: null,
  openPreview: (payload) => set({ open: payload }),
  closePreview: () => set({ open: null }),
}));
