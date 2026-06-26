/**
 * Canonical unit registry — single source of truth for every unit of measure
 * used across the app. Every unit carries a human-readable label (i18n-ready
 * via the existing `t()` pattern) and a broad category so dropdowns can show
 * grouped options and tooltips can explain abbreviations at a glance.
 *
 * ## Usage
 *
 * ```ts
 * import { UNIT_DEFINITIONS, unitOptionsForSelect, unitLabel } from '@/shared/lib/unitDefinitions';
 *
 * // Dropdown options grouped by category:
 * <select>
 *   {unitOptionsForSelect(t).map(opt => (
 *     <option key={opt.key} value={opt.key}>{opt.symbol} — {opt.label}</option>
 *   ))}
 * </select>
 *
 * // Resolve a label for display / tooltip:
 * <span title={unitLabel('hh', t)}>hh</span>  // tooltip: "hora-hombre"
 * ```
 *
 * ## i18n
 *
 * Labels default to Spanish. Add new locale entries to `UNIT_LABELS` below.
 * The `unitLabel` helper falls back to the key itself when no label is found.
 */

export type UnitCategory =
  | 'length'
  | 'area'
  | 'volume'
  | 'mass'
  | 'time'
  | 'labor'
  | 'count'
  | 'energy'
  | 'lump_sum'
  | 'other';

export interface UnitDef {
  /** Stored value — what gets persisted to the DB (e.g. "m2"). */
  key: string;
  /** Display symbol — may differ from key (e.g. "m²" vs "m2"). */
  symbol: string;
  /** Human-readable label in the current locale. */
  label: string;
  /** Broad category for grouping in selectors. */
  category: UnitCategory;
}

/** Ordered list of category keys (used for optgroup ordering). */
export const UNIT_CATEGORY_ORDER: UnitCategory[] = [
  'length',
  'area',
  'volume',
  'mass',
  'time',
  'labor',
  'energy',
  'count',
  'lump_sum',
  'other',
];

/** Category display names — i18n keys (use `t()` in components). */
export const UNIT_CATEGORY_LABELS: Record<UnitCategory, string> = {
  length:    'unit_cat.length',
  area:      'unit_cat.area',
  volume:    'unit_cat.volume',
  mass:      'unit_cat.mass',
  time:      'unit_cat.time',
  labor:     'unit_cat.labor',
  energy:    'unit_cat.energy',
  count:     'unit_cat.count',
  lump_sum:  'unit_cat.lump_sum',
  other:     'unit_cat.other',
};

/**
 * All recognised construction units.
 * Add new units here and they'll appear everywhere automatically.
 */
export const UNIT_DEFINITIONS: UnitDef[] = [
  // ── Length ─────────────────────────────────────────────────────────
  { key: 'm',   symbol: 'M',   label: 'metro lineal',       category: 'length' },
  { key: 'km',  symbol: 'KM',  label: 'kilómetro',           category: 'length' },
  { key: 'cm',  symbol: 'CM',  label: 'centímetro',          category: 'length' },
  { key: 'mm',  symbol: 'MM',  label: 'milímetro',           category: 'length' },
  { key: 'lm',  symbol: 'ML',  label: 'metro lineal',        category: 'length' },

  // ── Area ───────────────────────────────────────────────────────────
  { key: 'm2',  symbol: 'M²',  label: 'metro cuadrado',      category: 'area' },
  { key: 'km2', symbol: 'KM²', label: 'kilómetro cuadrado',  category: 'area' },
  { key: 'ha',  symbol: 'HA',  label: 'hectárea',            category: 'area' },
  { key: 'p2',  symbol: 'P2',  label: 'pie cuadrado',        category: 'area' },

  // ── Volume ─────────────────────────────────────────────────────────
  { key: 'm3',  symbol: 'M³',  label: 'metro cúbico',        category: 'volume' },
  { key: 'l',   symbol: 'L',   label: 'litro',               category: 'volume' },
  { key: 'gal', symbol: 'GAL', label: 'galón',               category: 'volume' },
  { key: 'gln', symbol: 'GLN', label: 'galón',               category: 'volume' },

  // ── Mass ───────────────────────────────────────────────────────────
  { key: 'kg',  symbol: 'KG',  label: 'kilogramo',           category: 'mass' },
  { key: 't',   symbol: 'T',   label: 'tonelada',            category: 'mass' },
  { key: 'ton', symbol: 'TON', label: 'tonelada',            category: 'mass' },
  { key: 'g',   symbol: 'G',   label: 'gramo',               category: 'mass' },
  { key: 'lb',  symbol: 'LB',  label: 'libra',               category: 'mass' },

  // ── Time ───────────────────────────────────────────────────────────
  { key: 'h',   symbol: 'H',   label: 'hora',                category: 'time' },
  { key: 'day', symbol: 'DÍA', label: 'día',                 category: 'time' },
  { key: 'month', symbol: 'MES', label: 'mes',               category: 'time' },
  { key: 'week',  symbol: 'SEM', label: 'semana',            category: 'time' },
  { key: 'year',  symbol: 'AÑO', label: 'año',               category: 'time' },

  // ── Labor ──────────────────────────────────────────────────────────
  { key: 'hh',  symbol: 'HH',  label: 'hora-hombre',         category: 'labor' },
  { key: 'hm',  symbol: 'HM',  label: 'hora-máquina',        category: 'labor' },
  { key: 'dh',  symbol: 'DH',  label: 'día-hombre',          category: 'labor' },

  // ── Energy ─────────────────────────────────────────────────────────
  { key: 'kWh', symbol: 'KWH', label: 'kilovatio-hora',      category: 'energy' },
  { key: 'MWh', symbol: 'MWH', label: 'megavatio-hora',      category: 'energy' },
  { key: 'W',   symbol: 'W',   label: 'vatio',               category: 'energy' },
  { key: 'kW',  symbol: 'KW',  label: 'kilovatio',           category: 'energy' },

  // ── Count ──────────────────────────────────────────────────────────
  { key: 'pcs',  symbol: 'UD',  label: 'unidad',             category: 'count' },
  { key: 'und',  symbol: 'UND', label: 'unidad',             category: 'count' },
  { key: 'pza',  symbol: 'PZA', label: 'pieza',              category: 'count' },
  { key: 'var',  symbol: 'VAR', label: 'varilla',            category: 'count' },
  { key: 'pto',  symbol: 'PTO', label: 'punto',              category: 'count' },
  { key: 'set',  symbol: 'JGO', label: 'juego',              category: 'count' },
  { key: 'bls',  symbol: 'BLS', label: 'bolsa',              category: 'count' },
  { key: 'par',  symbol: 'PAR', label: 'par',                category: 'count' },
  { key: 'roll', symbol: 'ROLL', label: 'rollo',             category: 'count' },
  { key: 'mll',  symbol: 'MLL', label: 'millar',             category: 'count' },
  { key: 'cjto', symbol: 'CJTO', label: 'conjunto',          category: 'count' },
  { key: 'pln',  symbol: 'PLN', label: 'plano',              category: 'other' },

  // ── Lump sum ───────────────────────────────────────────────────────
  { key: 'lsum', symbol: 'P.A.', label: 'partida alzada',    category: 'lump_sum' },
  { key: 'gbl',  symbol: 'GBL', label: 'global',             category: 'lump_sum' },
];

// ── Derived lookups ──────────────────────────────────────────────────────

/** Fast key→UnitDef lookup. */
const BY_KEY: Record<string, UnitDef> = Object.fromEntries(
  UNIT_DEFINITIONS.map((u) => [u.key, u]),
);

/** Resolve a human-readable label for a unit key. Returns a fallback string. */
export function unitLabel(
  key: string,
  t?: (k: string, opts?: Record<string, unknown>) => string,
): string {
  const def = BY_KEY[key];
  if (!def) return key;
  // When a translator is available, use it; otherwise return the built-in label.
  if (t) return t(`unit.${def.key}`, { defaultValue: def.label });
  return def.label;
}

/** Resolve the display symbol (e.g. "m²") for a unit key. Falls back to key. */
export function unitSymbol(key: string): string {
  return BY_KEY[key]?.symbol ?? key;
}

/**
 * Build a flat list of `{key, label, symbol}` objects ready for `<option>` elements.
 * When `grouped` is true the result is sorted by category label; when false it's
 * a simple flat list.
 */
export function unitOptions(
  t?: (k: string, opts?: Record<string, unknown>) => string,
): { key: string; symbol: string; label: string; category: UnitCategory }[] {
  return UNIT_DEFINITIONS.map((u) => ({
    key: u.key,
    symbol: u.symbol,
    label: unitLabel(u.key, t),
    category: u.category,
  }));
}

/** Extract just the keys in definition order. */
export function unitKeys(): string[] {
  return UNIT_DEFINITIONS.map((u) => u.key);
}
