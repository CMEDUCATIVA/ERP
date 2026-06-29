/**
 * EntityNameFilter — collapsible filter section that groups DXF entities by
 * their display name (block_name for INSERT, pattern_name for HATCH, entity
 * type for everything else).  Shows the top 8 names by entity count with a
 * "Show all" expander for the rest.
 *
 * Toggling a name ON/OFF drives the parent's `visibleNames` set which the
 * DxfViewer uses as an additional visibility filter alongside layers.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ChevronDown, ChevronRight, Search, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import type { DxfEntity } from '../api';

/** How many names to show before the "Show all" button. */
const TOP_N = 8;

/** Derive a human-friendly display name for an entity. */
function entityDisplayName(e: DxfEntity): string {
  if (e.type === 'INSERT' && e.block_name) return e.block_name;
  if (e.type === 'HATCH' && e.pattern_name) return `HATCH:${e.pattern_name}`;
  if (e.type === 'TEXT' && e.text) {
    const trimmed = e.text.trim();
    return trimmed.length > 30 ? `TEXT:${trimmed.slice(0, 27)}...` : `TEXT:${trimmed}`;
  }
  return e.type;
}

/** DXF entity-type → English fallback label. The raw type (and the
 *  ``HATCH:``/``TEXT:`` prefixes) stays the grouping + visibility-filter key;
 *  only the rendered label is localised so a Spanish user reads "Línea"
 *  instead of "LINE". */
const ENTITY_TYPE_LABELS: Record<string, string> = {
  LINE: 'Line',
  LWPOLYLINE: 'Polyline',
  POLYLINE: 'Polyline',
  CIRCLE: 'Circle',
  ARC: 'Arc',
  ELLIPSE: 'Ellipse',
  SPLINE: 'Spline',
  POINT: 'Point',
  TEXT: 'Text',
  MTEXT: 'Text',
  HATCH: 'Hatch',
  INSERT: 'Block',
  DIMENSION: 'Dimension',
};

/** Localise a display name for RENDERING ONLY (never used as a key). Handles
 *  the ``HATCH:<pattern>`` / ``TEXT:<content>`` prefixed forms and bare type
 *  names; block names and unknown values pass through unchanged. */
function localizeEntityName(raw: string, t: TFunction): string {
  const colon = raw.indexOf(':');
  if (colon > 0) {
    const prefix = raw.slice(0, colon);
    if (prefix === 'HATCH' || prefix === 'TEXT') {
      return `${t(`dwg_takeoff.etype_${prefix}`, ENTITY_TYPE_LABELS[prefix] ?? prefix)}: ${raw.slice(colon + 1)}`;
    }
    return raw;
  }
  const fallback = ENTITY_TYPE_LABELS[raw];
  return fallback ? t(`dwg_takeoff.etype_${raw}`, fallback) : raw;
}

interface Props {
  entities: DxfEntity[];
  visibleNames: Set<string>;
  onToggleName: (name: string) => void;
  onShowAllNames: () => void;
  onHideAllNames: () => void;
}

export function EntityNameFilter({
  entities,
  visibleNames,
  onToggleName,
  onShowAllNames,
  onHideAllNames,
}: Props) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');

  // Build name groups sorted by count descending
  const nameGroups = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entities) {
      const name = entityDisplayName(e);
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [entities]);

  // Apply search filter
  const filtered = useMemo(() => {
    if (!search) return nameGroups;
    const q = search.toLowerCase();
    return nameGroups.filter((g) => g.name.toLowerCase().includes(q));
  }, [nameGroups, search]);

  // Decide which to display: top 8 or all
  const displayed = showAll || search ? filtered : filtered.slice(0, TOP_N);
  const hasMore = !search && filtered.length > TOP_N;

  if (nameGroups.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mt-4">
      {/* Collapsible header — div+role to allow nested action buttons */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCollapsed((v) => !v);
          }
        }}
        className="flex items-center justify-between group cursor-pointer focus:outline-none focus:ring-2 focus:ring-oe-blue/40 rounded"
      >
        <div className="flex items-center gap-1.5">
          {collapsed ? (
            <ChevronRight size={13} className="text-muted-foreground" />
          ) : (
            <ChevronDown size={13} className="text-muted-foreground" />
          )}
          <h3 className="text-sm font-semibold text-foreground">
            {t('dwg_takeoff.entity_names', 'Entity Names')}
          </h3>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            ({nameGroups.length})
          </span>
        </div>
        {!collapsed && (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={onShowAllNames}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              title={t('dwg_takeoff.show_all', 'Show all')}
            >
              {t('dwg_takeoff.all_on', 'All on')}
            </button>
            <span className="text-muted-foreground">/</span>
            <button
              type="button"
              onClick={onHideAllNames}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              title={t('dwg_takeoff.hide_all', 'Hide all')}
            >
              {t('dwg_takeoff.all_off', 'All off')}
            </button>
          </div>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Search box */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('dwg_takeoff.search_names', 'Filter names...')}
              className="w-full rounded-md border border-border bg-surface-secondary py-1 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-oe-blue"
            />
          </div>

          {/* Name list */}
          <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[300px]">
            {displayed.map((group) => {
              const visible = visibleNames.has(group.name);
              return (
                <div
                  key={group.name}
                  className={clsx(
                    'flex items-center gap-2 rounded px-2 py-1 text-xs',
                    visible ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {/* Only the eye toggles visibility — clicking the name / count
                      no longer hides it (same affordance as the LayerPanel and
                      the PDF legend fix, D-TKC-UP10). */}
                  <button
                    type="button"
                    onClick={() => onToggleName(group.name)}
                    title={t('dwg_takeoff.toggle_name_visibility', 'Show/hide')}
                    aria-label={t('dwg_takeoff.toggle_name_visibility', 'Show/hide')}
                    aria-pressed={visible}
                    data-testid="dwg-name-eye-toggle"
                    className="-m-1 flex shrink-0 items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-surface-secondary hover:text-foreground"
                  >
                    {visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <span
                    className="truncate flex-1 text-left font-mono text-[11px]"
                    title={group.name}
                  >
                    {localizeEntityName(group.name, t)}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{group.count}</span>
                </div>
              );
            })}
            {displayed.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                {t('dwg_takeoff.no_names_found', 'No names found')}
              </p>
            )}
          </div>

          {/* Show all / Show less toggle */}
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-[11px] text-oe-blue hover:text-oe-blue-text font-medium text-center py-1 transition-colors"
            >
              {showAll
                ? t('dwg_takeoff.show_less', 'Show less')
                : t('dwg_takeoff.show_all_names', 'Show all ({{count}})', {
                    count: filtered.length,
                  })}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Helper to derive the display name for an entity — exported so the parent
 *  can use the same logic for visibility filtering. */
export { entityDisplayName };
