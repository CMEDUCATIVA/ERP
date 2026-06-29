import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/features/takeoff/api', () => ({
  takeoffApi: {
    list: vi.fn(async () => []),
    bulkCreate: vi.fn(async () => []),
    update: vi.fn(),
    delete: vi.fn(),
    linkToBoq: vi.fn(),
  },
}));

import { takeoffApi } from '@/features/takeoff/api';
import {
  useMeasurementPersistence,
  getDocumentIndex,
  removeFromStorage,
} from './useMeasurementPersistence';
import { emptyPageScales, type PageScales } from './data/page-scales';

// Mock measurements
const makeMeasurement = (id: string, page = 1) => ({
  id,
  type: 'distance' as const,
  points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
  value: 2.5,
  unit: 'm',
  label: 'D1',
  annotation: `Distance ${id}`,
  page,
  group: 'General',
});

const defaultScale = { pixelsPerUnit: 100, unitLabel: 'm' };
const basePageScales: PageScales = emptyPageScales();

describe('useMeasurementPersistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns empty state when no fileName', () => {
    const setM = vi.fn();
    const setPS = vi.fn();
    const { result } = renderHook(() =>
      useMeasurementPersistence({
        fileName: null,
        measurements: [],
        setMeasurements: setM,
        pageScales: basePageScales,
        setPageScales: setPS,
        scale: defaultScale,
      }),
    );
    expect(result.current.hasPersistedData).toBe(false);
    expect(result.current.savedDocumentCount).toBe(0);
  });

  it('saveNow persists measurements + page scales to localStorage', () => {
    const m1 = makeMeasurement('m1');
    const setM = vi.fn();
    const setPS = vi.fn();
    const { result } = renderHook(() =>
      useMeasurementPersistence({
        fileName: 'test.pdf',
        measurements: [m1],
        setMeasurements: setM,
        pageScales: basePageScales,
        setPageScales: setPS,
        scale: defaultScale,
      }),
    );

    act(() => {
      result.current.saveNow();
    });

    // Check localStorage contains the data
    const raw = localStorage.getItem('oe_takeoff_test.pdf');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.measurements).toHaveLength(1);
    expect(parsed.measurements[0].id).toBe('m1');
    // Both the new per-page model and the legacy single scale are written.
    expect(parsed.pageScales.defaultScale.pixelsPerUnit).toBe(100);
    expect(parsed.scale.pixelsPerUnit).toBe(100);
    expect(parsed.savedAt).toBeGreaterThan(0);
  });

  it('saveNow syncs unsaved measurements to the server when project context is available', async () => {
    const m1 = makeMeasurement('m1');
    vi.mocked(takeoffApi.bulkCreate).mockResolvedValueOnce([
      { id: 'server-m1', metadata: { frontend_id: 'm1' } },
    ] as any);
    const setM = vi.fn();
    const setPS = vi.fn();
    const { result } = renderHook(() =>
      useMeasurementPersistence({
        fileName: 'server.pdf',
        documentId: 'doc-1',
        projectId: 'project-1',
        measurements: [m1],
        setMeasurements: setM,
        pageScales: basePageScales,
        setPageScales: setPS,
        scale: defaultScale,
      }),
    );

    act(() => {
      result.current.saveNow();
    });

    await waitFor(() => expect(takeoffApi.bulkCreate).toHaveBeenCalledTimes(1));
    // Persistence keys by filename (D-TKC-UP09), so the written document_id is
    // the filename — stable across re-uploads of the same plan.
    expect(takeoffApi.bulkCreate).toHaveBeenCalledWith([
      expect.objectContaining({
        project_id: 'project-1',
        document_id: 'server.pdf',
        metadata: expect.objectContaining({ frontend_id: 'm1' }),
      }),
    ]);
  });

  it('migrates a legacy single-scale document into the page-scale default', () => {
    // Pre-populate localStorage in the OLD format (only ``scale``).
    const m1 = makeMeasurement('m1');
    const savedScale = { pixelsPerUnit: 50, unitLabel: 'm' };
    localStorage.setItem(
      'oe_takeoff_plan.pdf',
      JSON.stringify({ measurements: [m1], scale: savedScale, savedAt: Date.now() }),
    );
    localStorage.setItem('oe_takeoff_index', JSON.stringify(['plan.pdf']));

    const setM = vi.fn();
    const setPS = vi.fn();
    renderHook(() =>
      useMeasurementPersistence({
        fileName: 'plan.pdf',
        measurements: [],
        setMeasurements: setM,
        pageScales: basePageScales,
        setPageScales: setPS,
        scale: defaultScale,
      }),
    );

    expect(setM).toHaveBeenCalledWith([m1]);
    // The legacy single scale is promoted to the document default; no page
    // override exists yet so every page reads 50 until re-calibrated.
    const ps = setPS.mock.calls[0]![0] as PageScales;
    expect(ps.defaultScale.pixelsPerUnit).toBe(50);
    expect(ps.byPage).toEqual({});
  });

  it('reads back a new per-page scale document as-is', () => {
    const m1 = makeMeasurement('m1', 3);
    const pageScales: PageScales = {
      defaultScale: { pixelsPerUnit: 100, unitLabel: 'm' },
      byPage: { 3: { pixelsPerUnit: 25, unitLabel: 'm' } },
    };
    localStorage.setItem(
      'oe_takeoff_multi.pdf',
      JSON.stringify({ measurements: [m1], pageScales, scale: defaultScale, savedAt: Date.now() }),
    );
    localStorage.setItem('oe_takeoff_index', JSON.stringify(['multi.pdf']));

    const setM = vi.fn();
    const setPS = vi.fn();
    renderHook(() =>
      useMeasurementPersistence({
        fileName: 'multi.pdf',
        measurements: [],
        setMeasurements: setM,
        pageScales: basePageScales,
        setPageScales: setPS,
        scale: defaultScale,
      }),
    );

    const ps = setPS.mock.calls[0]![0] as PageScales;
    expect(ps.defaultScale.pixelsPerUnit).toBe(100);
    expect(ps.byPage[3]!.pixelsPerUnit).toBe(25);
  });

  it('clearPersisted removes data from localStorage', () => {
    const setM = vi.fn();
    const setPS = vi.fn();
    // Save first
    localStorage.setItem(
      'oe_takeoff_test.pdf',
      JSON.stringify({ measurements: [], scale: defaultScale, savedAt: Date.now() }),
    );
    localStorage.setItem('oe_takeoff_index', JSON.stringify(['test.pdf']));

    const { result } = renderHook(() =>
      useMeasurementPersistence({
        fileName: 'test.pdf',
        measurements: [],
        setMeasurements: setM,
        pageScales: basePageScales,
        setPageScales: setPS,
        scale: defaultScale,
      }),
    );

    act(() => {
      result.current.clearPersisted();
    });

    expect(localStorage.getItem('oe_takeoff_test.pdf')).toBeNull();
    expect(getDocumentIndex()).not.toContain('test.pdf');
  });

  it('getDocumentIndex returns list of saved documents', () => {
    expect(getDocumentIndex()).toEqual([]);

    localStorage.setItem('oe_takeoff_index', JSON.stringify(['a.pdf', 'b.pdf']));
    expect(getDocumentIndex()).toEqual(['a.pdf', 'b.pdf']);
  });

  it('removeFromStorage removes a specific document', () => {
    localStorage.setItem('oe_takeoff_doc.pdf', '{}');
    localStorage.setItem('oe_takeoff_index', JSON.stringify(['doc.pdf', 'other.pdf']));

    removeFromStorage('doc.pdf');

    expect(localStorage.getItem('oe_takeoff_doc.pdf')).toBeNull();
    expect(getDocumentIndex()).toEqual(['other.pdf']);
  });

  it('auto-saves on measurement changes (debounced)', async () => {
    vi.useFakeTimers();
    const m1 = makeMeasurement('m1');
    const setM = vi.fn();
    const setPS = vi.fn();

    renderHook(() =>
      useMeasurementPersistence({
        fileName: 'auto.pdf',
        measurements: [m1],
        setMeasurements: setM,
        pageScales: basePageScales,
        setPageScales: setPS,
        scale: defaultScale,
      }),
    );

    // Before debounce
    expect(localStorage.getItem('oe_takeoff_auto.pdf')).toBeNull();

    // After 500ms debounce
    vi.advanceTimersByTime(600);
    const raw = localStorage.getItem('oe_takeoff_auto.pdf');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).measurements).toHaveLength(1);

    vi.useRealTimers();
  });

  it('savedDocumentCount reflects storage index size', () => {
    localStorage.setItem('oe_takeoff_index', JSON.stringify(['a.pdf', 'b.pdf', 'c.pdf']));
    const setM = vi.fn();
    const setPS = vi.fn();

    const { result } = renderHook(() =>
      useMeasurementPersistence({
        fileName: null,
        measurements: [],
        setMeasurements: setM,
        pageScales: basePageScales,
        setPageScales: setPS,
        scale: defaultScale,
      }),
    );

    expect(result.current.savedDocumentCount).toBe(3);
  });

  it('loads measurements saved under the filename even when the doc is opened by UUID (D-TKC-UP07 dual-key)', async () => {
    // The measurement lives under the FILENAME key (an orphan written before
    // the upload assigned a UUID, or from a duplicate-name 409 session).
    const orphan = {
      id: 'server-x',
      project_id: 'project-1',
      document_id: 'plano.pdf',
      page: 1,
      type: 'distance',
      group_name: 'General',
      group_color: '#3B82F6',
      annotation: 'X',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      measurement_value: 2.5,
      measurement_unit: 'm',
      depth: null,
      volume: null,
      perimeter: null,
      count_value: null,
      scale_pixels_per_unit: 100,
      linked_boq_position_id: null,
      metadata: { frontend_id: 'fx' },
      created_by: 'u1',
      created_at: '',
      updated_at: '',
    };
    // The doc is opened by its UUID, which has NO rows; the filename does.
    vi.mocked(takeoffApi.list).mockImplementation(async (_p: string, docId?: string) =>
      (docId === 'plano.pdf' ? [orphan] : []) as any,
    );

    const setM = vi.fn();
    const setPS = vi.fn();
    renderHook(() =>
      useMeasurementPersistence({
        fileName: 'plano.pdf',
        documentId: 'uuid-1',
        projectId: 'project-1',
        measurements: [],
        setMeasurements: setM,
        pageScales: basePageScales,
        setPageScales: setPS,
        scale: defaultScale,
      }),
    );

    // The dual-key load must surface the filename-keyed orphan.
    await waitFor(() => {
      const loaded = setM.mock.calls
        .map((c) => c[0])
        .find((v) => Array.isArray(v) && v.length === 1 && v[0]?.serverId === 'server-x') as
        | Array<{ serverId: string; label: string; annotation: string }>
        | undefined;
      expect(loaded?.[0]?.serverId).toBe('server-x');
      // ``label`` (row subtitle) is rebuilt as the formatted VALUE from the
      // server's numeric fields, NOT a copy of the name (D-TKC-UP11).
      expect(loaded?.[0]?.label).toBe('2.50 m');
      expect(loaded?.[0]?.annotation).toBe('X');
    });
  });

  it('re-keys filename -> UUID without wiping measurements when a local PDF finishes uploading (D-TKC-UP07)', () => {
    const m1 = makeMeasurement('m1');
    // Seed the local (filename-keyed) copy exactly as the 500ms autosave would
    // while the PDF was still being uploaded in the background.
    localStorage.setItem(
      'oe_takeoff_plano.pdf',
      JSON.stringify({ measurements: [m1], scale: defaultScale, savedAt: Date.now() }),
    );
    localStorage.setItem('oe_takeoff_index', JSON.stringify(['plano.pdf']));
    vi.mocked(takeoffApi.list).mockResolvedValue([] as any);

    const setM = vi.fn();
    const setPS = vi.fn();
    const { rerender } = renderHook<ReturnType<typeof useMeasurementPersistence>, { documentId?: string }>(
      ({ documentId }) =>
        useMeasurementPersistence({
          fileName: 'plano.pdf',
          documentId,
          projectId: 'project-1',
          measurements: [m1],
          setMeasurements: setM,
          pageScales: basePageScales,
          setPageScales: setPS,
          scale: defaultScale,
        }),
      { initialProps: { documentId: undefined } },
    );

    // Background upload completes: the same file now carries a server UUID.
    setM.mockClear();
    rerender({ documentId: 'doc-uuid-1' });

    // With filename keying (D-TKC-UP09) a UUID arriving for the SAME file does
    // not change the persistence identity, so the measurements are never wiped
    // and the localStorage copy stays under the (stable) filename key.
    expect(setM).not.toHaveBeenCalledWith([]);
    expect(localStorage.getItem('oe_takeoff_plano.pdf')).toBeTruthy();
    expect(localStorage.getItem('oe_takeoff_doc-uuid-1')).toBeNull();
  });

  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem('oe_takeoff_bad.pdf', '{invalid json');
    localStorage.setItem('oe_takeoff_index', JSON.stringify(['bad.pdf']));

    const setM = vi.fn();
    const setPS = vi.fn();
    renderHook(() =>
      useMeasurementPersistence({
        fileName: 'bad.pdf',
        measurements: [],
        setMeasurements: setM,
        pageScales: basePageScales,
        setPageScales: setPS,
        scale: defaultScale,
      }),
    );

    // Should clear instead of hydrating corrupt data.
    expect(setM).toHaveBeenCalledWith([]);
  });
});
