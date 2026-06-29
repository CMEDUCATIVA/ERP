import { useCallback, useContext, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { takeoffApi, type MeasurementCreate, type MeasurementResponse } from '@/features/takeoff/api';
import {
  type PageScales,
  hydratePageScales,
  scaleForPage,
} from './data/page-scales';
import { formatMeasurement } from './data/scale-helpers';

/* ── Types (mirrored from TakeoffViewerModule) ──────────────────────── */

interface Point {
  x: number;
  y: number;
}

interface Measurement {
  id: string;
  type: 'distance' | 'polyline' | 'area' | 'volume' | 'count'
    | 'cloud' | 'arrow' | 'text' | 'rectangle' | 'highlight';
  points: Point[];
  value: number;
  unit: string;
  label: string;
  annotation: string;
  page: number;
  group: string;
  depth?: number;
  area?: number;
  text?: string;
  color?: string;
  width?: number;
  height?: number;
  /** Opening deduction (area void). Stored as positive gross area; the
   *  rollup subtracts it. Round-trips so a void survives a server sync. */
  isDeduction?: boolean;
  /** Server-side ID (set after first sync). */
  serverId?: string;
  /** BOQ link metadata carried through persistence. */
  linkedPositionId?: string;
  linkedPositionOrdinal?: string;
  linkedBoqId?: string;
  linkedPositionLabel?: string;
  /** AI-suggested but unconfirmed (issue #194): excluded from server sync
   *  and localStorage until the user accepts it (which clears the flag). */
  suggested?: boolean;
  /** Recognition confidence 0..1 on AI-sourced measurements. */
  confidence?: number;
}

interface ScaleConfig {
  pixelsPerUnit: number;
  unitLabel: string;
}

interface PersistedDocument {
  measurements: Measurement[];
  /** New per-page scale model. Optional so an older document (which only
   *  carried ``scale``) still parses; ``hydratePageScales`` migrates it. */
  pageScales?: PageScales;
  /** Legacy single document-wide scale. Kept for backward-compatible reads
   *  (and still written so a downgrade to an older build keeps working). */
  scale: ScaleConfig;
  savedAt: number;
}

/* ── localStorage helpers (fallback) ─────────────────────────────────── */

const STORAGE_PREFIX = 'oe_takeoff_';
const INDEX_KEY = 'oe_takeoff_index';

function docKey(fileName: string): string {
  return `${STORAGE_PREFIX}${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
}

function loadFromStorage(fileName: string): PersistedDocument | null {
  try {
    const raw = localStorage.getItem(docKey(fileName));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedDocument;
  } catch {
    return null;
  }
}

function saveToStorage(fileName: string, data: PersistedDocument): void {
  try {
    localStorage.setItem(docKey(fileName), JSON.stringify(data));
    const index = getDocumentIndex();
    if (!index.includes(fileName)) {
      index.push(fileName);
      localStorage.setItem(INDEX_KEY, JSON.stringify(index));
    }
  } catch {
    // localStorage full — silently fail
  }
}

export function removeFromStorage(fileName: string): void {
  try {
    localStorage.removeItem(docKey(fileName));
    const index = getDocumentIndex().filter((n) => n !== fileName);
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    // ignore
  }
}

export function getDocumentIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/* ── Unit canonicalization ───────────────────────────────────────────── */

/**
 * Map the display-glyph unit the viewer emits (`m²` / `m³` via the
 * superscript U+00B2 / U+00B3) to the canonical BOQ unit string
 * (`m2` / `m3`).
 *
 * Even though the backend now accepts the superscript form verbatim
 * (D-TKC-001 backend pairing), cross-module quantity sync — bim_hub
 * `_sync_boq_quantity_from_links`, BOQ linking, the catalogue/cost
 * matchers — keys on the canonical `m`/`m2`/`m3`/`pcs` vocabulary.
 * Persisting the canonical form keeps the server copy aligned with the
 * Export-to-BOQ / link-to-position paths (which already canonicalize),
 * and {@link displayUnit} restores the glyph on round-trip so the UI is
 * unchanged.
 */
function canonicalUnit(unit: string): string {
  switch (unit) {
    case 'm²':
      return 'm2';
    case 'm³':
      return 'm3';
    default:
      return unit || 'm';
  }
}

/** Inverse of {@link canonicalUnit}: restore the superscript display
 *  glyph from the canonical stored unit so a server round-trip renders
 *  identically to a freshly-drawn measurement. */
function displayUnit(unit: string): string {
  switch (unit) {
    case 'm2':
      return 'm²';
    case 'm3':
      return 'm³';
    default:
      return unit;
  }
}

/* ── Convert between frontend Measurement and backend API format ─────── */

function toApiFormat(
  m: Measurement,
  projectId: string,
  documentId: string,
  pageScales?: PageScales,
): MeasurementCreate {
  // Area measurements carry the polygon area in `m.value`; volume
  // measurements carry the area separately in `m.area`. Persist the
  // canonical dimension fields so bim_hub quantity sync / BOQ linking
  // can pick the right quantity instead of guessing from the unit
  // string alone (D-TKC-031).
  const areaValue =
    m.type === 'area' ? m.value : m.type === 'volume' ? (m.area ?? null) : null;
  // Per-page scale: send the scale of THIS measurement's page, not a single
  // document-wide ratio, so a sheet at 1:500 and a sheet at 1:50 each get
  // their own px-per-unit for the server-side B8 recompute.
  const scale = pageScales ? scaleForPage(pageScales, m.page) : undefined;
  const ppu =
    scale && scale.pixelsPerUnit > 0 ? scale.pixelsPerUnit : null;
  return {
    project_id: projectId,
    document_id: documentId,
    page: m.page,
    type: m.type,
    group_name: m.group || 'General',
    group_color: m.color || '#3B82F6',
    annotation: m.annotation || m.label || null,
    points: m.points,
    measurement_value: m.value || null,
    measurement_unit: canonicalUnit(m.unit),
    depth: m.depth ?? null,
    volume: m.type === 'volume' ? m.value : null,
    perimeter: m.type === 'polyline' ? m.value : null,
    count_value: m.type === 'count' ? Math.round(m.value) : null,
    // Send the calibration so the server-side recompute can verify the
    // client value against the raw geometry (Audit B8) instead of
    // trusting it blindly.
    scale_pixels_per_unit: ppu,
    // Opening deduction only applies to an area; the server enforces this
    // too but we keep the payload honest.
    is_deduction: m.type === 'area' ? Boolean(m.isDeduction) : false,
    linked_boq_position_id: m.linkedPositionId ?? null,
    metadata: {
      text: m.text,
      width: m.width,
      height: m.height,
      area: areaValue ?? undefined,
      frontend_id: m.id,
      linked_boq_id: m.linkedBoqId,
      linked_position_ordinal: m.linkedPositionOrdinal,
      linked_position_label: m.linkedPositionLabel,
    },
  };
}

/**
 * Geometry signature for a synced measurement: the set of fields a
 * reshape can change that feed the server-side recompute (Audit B8). When
 * this string changes for a row that already has a `serverId`, the row was
 * edited in-canvas and must be PATCHed so the server re-derives the billed
 * quantity. Annotation / color / group edits are intentionally excluded -
 * those are handled by the existing flows and do not move the quantity.
 */
function geometrySignature(m: Measurement): string {
  return JSON.stringify({
    p: m.points,
    d: m.depth ?? null,
    c: m.type === 'count' ? Math.round(m.value) : null,
    t: m.type,
    // The deduction flag flips a measurement between gross and void without
    // changing its geometry; include it so toggling it triggers a PATCH and
    // the server row stays in sync.
    x: m.type === 'area' ? Boolean(m.isDeduction) : false,
  });
}

/** Build the reshape PATCH body: just the geometry-bearing fields. The
 *  server recomputes `measurement_value` / `volume` / `perimeter` from
 *  these, so a client cannot inflate a quantity through this path. */
function toApiUpdate(m: Measurement, scale?: ScaleConfig): Partial<MeasurementCreate> {
  const ppu = scale && scale.pixelsPerUnit > 0 ? scale.pixelsPerUnit : null;
  return {
    points: m.points,
    type: m.type,
    scale_pixels_per_unit: ppu,
    depth: m.depth ?? null,
    count_value: m.type === 'count' ? Math.round(m.value) : null,
    is_deduction: m.type === 'area' ? Boolean(m.isDeduction) : false,
  };
}

/**
 * Rebuild the value-formatted quantity string (the sidebar subtitle) for a
 * measurement coming back from the server.
 *
 * The viewer fills ``label`` with the formatted quantity at draw time
 * (`formatMeasurement(...)`), but only the *name* (``annotation``) is persisted
 * as a text field — the quantity lives in the numeric columns
 * (``measurement_value`` / ``perimeter`` / ``volume`` / ``depth`` /
 * ``count_value``). Without rebuilding it here, a reloaded measurement showed
 * its name twice ("Distance 6 / Distance 6") instead of "Distance 6 / 1.40 m"
 * (D-TKC-UP11). We mirror the exact creation format per type. Annotation tools
 * (cloud/arrow/text/…) carry no quantity — their row uses the type, not the
 * label — so we return '' for them, matching draw-time behaviour.
 */
function reconstructValueLabel(r: MeasurementResponse): string {
  const meta = r.metadata || {};
  const unit = displayUnit(r.measurement_unit);
  const base = unit.replace(/[²³]/g, '') || 'm'; // linear unit (perimeter / depth)
  switch (r.type) {
    case 'distance':
    case 'polyline':
      return formatMeasurement(r.measurement_value ?? 0, base);
    case 'area': {
      const area = formatMeasurement(r.measurement_value ?? 0, unit || `${base}²`);
      const perim = r.perimeter != null ? formatMeasurement(r.perimeter, base) : '';
      return area && perim ? `${area} (P: ${perim})` : area;
    }
    case 'volume': {
      const vol = formatMeasurement(r.volume ?? r.measurement_value ?? 0, unit || `${base}³`);
      const parts: string[] = [];
      const areaVal = typeof meta.area === 'number' ? meta.area : null;
      if (areaVal != null) {
        const a = formatMeasurement(areaVal, `${base}²`);
        if (a) parts.push(`A: ${a}`);
      }
      if (r.depth != null) {
        const d = formatMeasurement(r.depth, base);
        if (d) parts.push(`D: ${d}`);
      }
      if (!vol) return '';
      return parts.length ? `V = ${vol} (${parts.join(' × ')})` : `V = ${vol}`;
    }
    case 'count':
      return `${Math.round(r.count_value ?? r.measurement_value ?? 0)} ${unit || 'pcs'}`;
    default:
      return '';
  }
}

function fromApiFormat(r: MeasurementResponse): Measurement {
  const meta = r.metadata || {};
  return {
    id: (meta.frontend_id as string) || r.id,
    serverId: r.id,
    type: r.type as Measurement['type'],
    points: r.points as Point[],
    value: r.measurement_value ?? r.count_value ?? 0,
    unit: displayUnit(r.measurement_unit),
    // ``label`` is the formatted quantity shown as the row subtitle, rebuilt
    // from the server's numeric fields; ``annotation`` is the editable name.
    label: reconstructValueLabel(r),
    annotation: r.annotation || '',
    page: r.page,
    group: r.group_name,
    depth: r.depth ?? undefined,
    // Prefer the dedicated metadata.area; fall back to the canonical
    // server `volume`/`measurement_value` so an area survives even when
    // it was persisted before the dedicated field existed (D-TKC-031).
    area:
      (meta.area as number) ??
      (r.type === 'area' ? r.measurement_value ?? undefined : undefined),
    text: (meta.text as string) ?? undefined,
    color: r.group_color || undefined,
    width: (meta.width as number) ?? undefined,
    height: (meta.height as number) ?? undefined,
    isDeduction: r.is_deduction ?? undefined,
    linkedPositionId: r.linked_boq_position_id ?? undefined,
    linkedBoqId: (meta.linked_boq_id as string) ?? undefined,
    linkedPositionOrdinal: (meta.linked_position_ordinal as string) ?? undefined,
    linkedPositionLabel: (meta.linked_position_label as string) ?? undefined,
  };
}

/**
 * Reconstruct a {@link PageScales} from server measurements.
 *
 * Each row carries the ``scale_pixels_per_unit`` of the page it was drawn
 * on, so we take the most-recently-seen positive ratio per page as that
 * page's scale and the most common ratio across all pages as the document
 * default. Returns ``null`` when no row carries a usable ratio (the caller
 * then keeps whatever it already had). This restores per-page calibration
 * for a project opened on a device that has no localStorage copy.
 */
function pageScalesFromServer(rows: MeasurementResponse[]): PageScales | null {
  const byPage: Record<number, ScaleConfig> = {};
  const ratioFreq = new Map<number, number>();
  for (const r of rows) {
    const ppu = r.scale_pixels_per_unit;
    if (typeof ppu !== 'number' || !Number.isFinite(ppu) || ppu <= 0) continue;
    // Scale is metric-canonical (always metres); only the ratio differs per
    // page. Track frequency to pick the document default.
    byPage[r.page] = { pixelsPerUnit: ppu, unitLabel: 'm' };
    ratioFreq.set(ppu, (ratioFreq.get(ppu) ?? 0) + 1);
  }
  if (Object.keys(byPage).length === 0) return null;
  let bestRatio = 100;
  let bestCount = -1;
  for (const [ratio, count] of ratioFreq.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestRatio = ratio;
    }
  }
  return { defaultScale: { pixelsPerUnit: bestRatio, unitLabel: 'm' }, byPage };
}

/* ── Hook ─────────────────────────────────────────────────────────────── */

interface UseMeasurementPersistenceOptions {
  fileName: string | null;
  /** Takeoff document UUID — when present, used as server document_id instead
   *  of fileName so two documents with the same name don't share measurements. */
  documentId?: string | null;
  measurements: Measurement[];
  setMeasurements: Dispatch<SetStateAction<Measurement[]>>;
  /** Per-page (per-sheet) scale model. Persisted whole; a legacy
   *  single-scale document is migrated into the default on load. */
  pageScales: PageScales;
  setPageScales: (pageScales: PageScales) => void;
  /** The current page's effective scale, sent as ``scale_pixels_per_unit``
   *  on measurements so the server B8 recompute uses the same ratio.
   *  (Per-measurement page scale is resolved from ``pageScales``.) */
  scale: ScaleConfig;
  /** Active project ID for backend sync. */
  projectId?: string | null;
}

interface UseMeasurementPersistenceResult {
  hasPersistedData: boolean;
  saveNow: () => void;
  clearPersisted: () => void;
  savedDocumentCount: number;
  /** Whether data is being synced to the server. */
  syncing: boolean;
  /** Whether server sync has been done at least once. */
  syncedToServer: boolean;
}

export function useMeasurementPersistence({
  fileName,
  documentId,
  measurements,
  setMeasurements,
  pageScales,
  setPageScales,
  scale,
  projectId,
}: UseMeasurementPersistenceOptions): UseMeasurementPersistenceResult {
  // Persistence key = the FILENAME, not the document UUID (D-TKC-UP09).
  //
  // Keying by the per-upload UUID meant that re-uploading or switching the same
  // plan produced a brand-new id and the measurements drawn on the previous
  // upload "disappeared" — the exact regression vs. the older filename-keyed
  // build the user confirmed working. Filename is stable across re-uploads, so
  // opening the same PDF always reloads its measurements. The READ side still
  // ALSO queries by ``documentId`` (see the load below) so any rows written
  // under a UUID by an earlier build are still found and merged in.
  const serverDocId = fileName;
  const localStorageKey = fileName;
  // Identity for the "did the open document change?" guard. Includes the
  // project so a project switch reloads. Now filename-based, so a UUID arriving
  // after upload no longer changes the identity (no wipe, no churn).
  const documentIdentity = fileName
    ? `${projectId ?? ''}:${fileName}`
    : null;
  const hasPersistedRef = useRef(false);
  const lastDocumentRef = useRef<string | null>(null);
  // The filename + documentId the load effect last committed to, used to tell
  // a genuine document switch apart from the filename -> UUID re-key that
  // happens when a just-dropped local PDF finishes uploading.
  const lastFileNameRef = useRef<string | null>(null);
  const lastDocumentIdRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncedToServer, setSyncedToServer] = useState(false);
  const serverSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard against overlapping server syncs. A measurement stays serverId-less
  // until its create returns, so a second sync firing mid-flight would re-send
  // (and duplicate) the same rows. We skip while one is in flight; the
  // serverId update that completes a sync re-triggers the auto-sync effect to
  // flush anything still pending.
  const inFlightSyncRef = useRef(false);
  // Reshape-PATCH tracking (#194 Feature 1). `geometrySigRef` remembers the
  // last geometry we know the server has for each `serverId`, so we only
  // PATCH a row whose geometry actually changed. `patchTimerRef` debounces
  // and `inFlightPatchRef` coalesces rapid reshapes of the same row
  // (last-write-wins) so mid-drag churn never floods the network.
  const geometrySigRef = useRef<Map<string, string>>(new Map());
  const patchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightPatchRef = useRef<Set<string>>(new Set());
  // Read the QueryClient directly from context — ``useContext`` returns
  // ``undefined`` instead of throwing when the provider is absent (e.g. in
  // unit tests that render the hook in isolation). When present, we use
  // it to broadcast a refresh to the unified Markups hub.
  const qc = useContext(QueryClientContext);

  // Load persisted data when the open document changes — try server first,
  // fallback to localStorage. Special-cases the filename -> UUID "re-key" that
  // fires when a freshly dropped local PDF finishes uploading: it migrates the
  // localStorage copy and KEEPS the in-memory measurements (which still carry
  // no serverId because sync was deferred) instead of wiping + reloading from a
  // UUID the server has no rows for yet (D-TKC-UP07).
  useEffect(() => {
    if (!fileName || !documentIdentity || documentIdentity === lastDocumentRef.current) return;

    const prevFileName = lastFileNameRef.current;
    const prevDocumentId = lastDocumentIdRef.current;
    // Re-key of the SAME document: same filename, and a UUID has just appeared
    // where there was none. Migrate the localStorage entry to the UUID key and
    // let the normal sync create the rows under the UUID. No wipe, no reload.
    const isRekey =
      lastDocumentRef.current !== null &&
      prevFileName === fileName &&
      !prevDocumentId &&
      Boolean(documentId);

    lastDocumentRef.current = documentIdentity;
    lastFileNameRef.current = fileName;
    lastDocumentIdRef.current = documentId ?? null;

    if (isRekey) {
      const oldKey = prevFileName; // was filename-keyed
      const newKey = localStorageKey; // now UUID-keyed
      if (oldKey && newKey && oldKey !== newKey) {
        const saved = loadFromStorage(oldKey);
        if (saved) {
          saveToStorage(newKey, saved);
          removeFromStorage(oldKey);
        }
      }
      hasPersistedRef.current = true;
      // Keep the current measurements as-is; the auto-sync effect now has a
      // UUID and will create them server-side under it.
      return;
    }

    hasPersistedRef.current = false;
    setSyncedToServer(false);
    geometrySigRef.current.clear();
    setMeasurements([]);

    let cancelled = false;

    async function loadData() {
      // Try the server first. A document's measurements can live under EITHER
      // its UUID or its filename (filename-keyed rows were written before the
      // background upload assigned a UUID, or when a duplicate-name upload
      // 409'd and never got one). Querying both keys and merging means the
      // measurements show up no matter which key they were saved under — the
      // fix for "Measurements (0)" after a refresh / document switch
      // (D-TKC-UP07).
      if (projectId && serverDocId) {
        try {
          const keys: string[] = [];
          if (documentId) keys.push(documentId);
          if (fileName && fileName !== documentId) keys.push(fileName);
          if (keys.length === 0) keys.push(serverDocId);

          const lists = await Promise.all(
            keys.map((k) =>
              takeoffApi.list(projectId, k).catch(() => [] as MeasurementResponse[]),
            ),
          );
          // Merge, de-duplicating by server id first and then by the stable
          // frontend id, so a measurement that exists under two keys (e.g. a
          // mid-migration row) is only shown once. UUID rows win over filename
          // rows because the UUID key is listed first.
          const seenServer = new Set<string>();
          const seenFrontend = new Set<string>();
          const serverData: MeasurementResponse[] = [];
          for (const list of lists) {
            for (const row of list) {
              const fid = (row.metadata?.frontend_id as string) || '';
              if (seenServer.has(row.id)) continue;
              if (fid && seenFrontend.has(fid)) continue;
              seenServer.add(row.id);
              if (fid) seenFrontend.add(fid);
              serverData.push(row);
            }
          }

          if (!cancelled && serverData.length > 0) {
            hasPersistedRef.current = true;
            setSyncedToServer(true);
            const mapped = serverData.map(fromApiFormat);
            // Seed the geometry baseline so a fresh load never re-PATCHes
            // rows that already match the server (#194).
            geometrySigRef.current = new Map(
              mapped
                .filter((m) => m.serverId)
                .map((m) => [m.serverId as string, geometrySignature(m)]),
            );
            // Reconstruct the per-page scale from the per-measurement ratios
            // the server stored. The localStorage copy (set below on next
            // save) is authoritative when present, but for a project loaded
            // on a fresh device this is the only place the calibration lives.
            const fromServer = pageScalesFromServer(serverData);
            if (fromServer) setPageScales(fromServer);
            setMeasurements(mapped);
            return;
          }
        } catch {
          // Server unavailable — fall through to localStorage
        }
      }

      // Fallback to localStorage
      if (!cancelled) {
        const data = localStorageKey ? loadFromStorage(localStorageKey) : null;
        if (data) {
          hasPersistedRef.current = true;
          setMeasurements(data.measurements);
          // Graceful migration: a document saved before per-page scale only
          // carried ``data.scale``; hydratePageScales promotes it to the
          // document default so every page reads the same number it always
          // did until the user re-calibrates an individual sheet.
          setPageScales(hydratePageScales(data.pageScales, data.scale));
        } else {
          hasPersistedRef.current = false;
          setMeasurements([]);
        }
      }
    }

    loadData();
    return () => { cancelled = true; };
    // NOTE: ``documentId`` is intentionally NOT a dependency. The persistence
    // identity is filename-based, so a UUID arriving AFTER the filename (local
    // drop -> background upload) must not re-run this effect: doing so cancelled
    // the in-flight load and then bailed at the identity guard, leaving the list
    // empty (the "Measurements (0)" with the PDF visible bug). The load still
    // reads the latest documentId from its closure for the dual-key query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileName, projectId, serverDocId, localStorageKey, documentIdentity, setMeasurements, setPageScales]);

  // Auto-save to localStorage with debounce (500ms)
  useEffect(() => {
    if (!localStorageKey) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Never persist AI suggestions: only confirmed measurements are saved.
      // Persist BOTH the new per-page model and the legacy single ``scale``
      // (the current page's, as a best-effort default) so a downgrade to an
      // older build that only reads ``scale`` still finds a usable value.
      saveToStorage(localStorageKey, {
        measurements: measurements.filter((m) => !m.suggested),
        pageScales,
        scale,
        savedAt: Date.now(),
      });
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localStorageKey, measurements, pageScales, scale]);

  const syncMeasurementsToServer = useCallback(async (serverMeasurements: Measurement[] = measurements) => {
    if (!fileName || !projectId || !serverDocId) return false;

    const toCreate = serverMeasurements
      .filter((m) => !m.serverId && !m.suggested)
      .map((m) => toApiFormat(m, projectId, serverDocId, pageScales));

    if (toCreate.length === 0) {
      setSyncedToServer(true);
      return true;
    }

    // Don't overlap with an in-flight sync — that would re-send the same
    // serverId-less rows and create duplicates. The completing sync re-runs
    // this effect to flush whatever is still pending.
    if (inFlightSyncRef.current) return false;
    inFlightSyncRef.current = true;
    setSyncing(true);
    try {
      const created = await takeoffApi.bulkCreate(toCreate);
      setMeasurements((prev) => prev.map((m) => {
        if (m.serverId || m.suggested) return m;
        const match = created.find((c) =>
          (c.metadata?.frontend_id as string) === m.id
        );
        if (!match) return m;
        geometrySigRef.current.set(match.id, geometrySignature(m));
        return { ...m, serverId: match.id };
      }));
      qc?.invalidateQueries({ queryKey: ['unified-markups'] });
      setSyncedToServer(true);
      return true;
    } catch {
      setSyncedToServer(false);
      return false;
    } finally {
      setSyncing(false);
      inFlightSyncRef.current = false;
    }
  }, [fileName, projectId, serverDocId, measurements, pageScales, setMeasurements, qc]);

  useEffect(() => {
    if (measurements.some((m) => !m.serverId && !m.suggested)) {
      setSyncedToServer(false);
    }
  }, [measurements]);

  // Auto-sync to server with a short debounce (1s) so each drawn action is
  // persisted almost immediately — the user expects "every action saves" and a
  // 3s window left too much unsynced work on a quick refresh. The in-flight
  // guard in syncMeasurementsToServer keeps the faster cadence from
  // double-creating. Both measurement and annotation types persist (v2.6.7).
  useEffect(() => {
    if (!fileName || !projectId || !serverDocId) return;
    if (measurements.length === 0) return;
    const serverMeasurements = measurements;

    if (serverSyncRef.current) clearTimeout(serverSyncRef.current);
    serverSyncRef.current = setTimeout(async () => {
      void syncMeasurementsToServer(serverMeasurements);
    }, 1000);

    return () => {
      if (serverSyncRef.current) clearTimeout(serverSyncRef.current);
    };
  }, [fileName, projectId, serverDocId, measurements, syncMeasurementsToServer]);

  // Reshape PATCH (#194 Feature 1). When a measurement that already has a
  // `serverId` has its geometry changed in-canvas, PATCH just that row so
  // the server re-derives the billed quantity (Audit B8). Debounced 400ms
  // off the last change; mid-drag churn never reaches the network because
  // the viewer only commits points on mouseup. Coalesced per `serverId`:
  // if a row is already in-flight we skip it this tick and the changed
  // signature keeps it dirty for the next pass (last-write-wins per row).
  useEffect(() => {
    if (!projectId) return;
    if (measurements.length === 0) return;

    // Find synced rows whose geometry drifted from the server baseline.
    const dirty = measurements.filter((m) => {
      if (!m.serverId || m.suggested) return false;
      const prevSig = geometrySigRef.current.get(m.serverId);
      // No baseline yet (e.g. a row hydrated before its baseline seeded)
      // -> record the current signature without firing a PATCH.
      if (prevSig === undefined) {
        geometrySigRef.current.set(m.serverId, geometrySignature(m));
        return false;
      }
      return prevSig !== geometrySignature(m);
    });
    if (dirty.length === 0) return;

    if (patchTimerRef.current) clearTimeout(patchTimerRef.current);
    patchTimerRef.current = setTimeout(async () => {
      const reconciled: { frontendId: string; value: number; area?: number }[] = [];
      await Promise.all(
        dirty.map(async (m) => {
          const serverId = m.serverId!;
          if (inFlightPatchRef.current.has(serverId)) return; // coalesce
          inFlightPatchRef.current.add(serverId);
          const sig = geometrySignature(m);
          try {
            // Per-page scale: PATCH with the measurement's own page scale so
            // the server B8 recompute uses the ratio that sheet was drawn at.
            const updated = await takeoffApi.update(
              serverId,
              toApiUpdate(m, scaleForPage(pageScales, m.page)),
            );
            // Mark this geometry as known-on-server so we don't re-PATCH it.
            geometrySigRef.current.set(serverId, sig);
            // Overwrite the optimistic value with the server-authoritative
            // recompute so the displayed quantity can never exceed what the
            // geometry justifies.
            const serverValue =
              updated.measurement_value ?? updated.volume ?? updated.count_value ?? m.value;
            reconciled.push({
              frontendId: m.id,
              value: serverValue,
              area: (updated.metadata?.area as number) ?? updated.measurement_value ?? undefined,
            });
          } catch {
            // PATCH failed - keep the optimistic value + the localStorage
            // copy (the 500ms effect above already persisted it). Leave the
            // signature stale so the next tick retries.
          } finally {
            inFlightPatchRef.current.delete(serverId);
          }
        }),
      );

      if (reconciled.length > 0) {
        setMeasurements(
          measurements.map((m) => {
            const r = reconciled.find((x) => x.frontendId === m.id);
            if (!r) return m;
            return {
              ...m,
              value: r.value,
              ...(m.type === 'volume' && r.area !== undefined ? { area: r.area } : {}),
            };
          }),
        );
        qc?.invalidateQueries({ queryKey: ['unified-markups'] });
      }
    }, 400);

    return () => {
      if (patchTimerRef.current) clearTimeout(patchTimerRef.current);
    };
  }, [projectId, measurements, setMeasurements, pageScales, qc]);

  const saveNow = useCallback(() => {
    if (!fileName) return;
    if (!localStorageKey) return;
    saveToStorage(localStorageKey, { measurements, pageScales, scale, savedAt: Date.now() });
    void syncMeasurementsToServer(measurements);
  }, [fileName, localStorageKey, measurements, pageScales, scale, syncMeasurementsToServer]);

  const clearPersisted = useCallback(() => {
    if (!localStorageKey) return;
    removeFromStorage(localStorageKey);
    hasPersistedRef.current = false;
  }, [localStorageKey]);

  return {
    hasPersistedData: hasPersistedRef.current,
    saveNow,
    clearPersisted,
    savedDocumentCount: getDocumentIndex().length,
    syncing,
    syncedToServer,
  };
}
