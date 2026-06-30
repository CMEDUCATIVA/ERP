import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Package,
  Wrench,
  Users,
  HardHat,
  Boxes,
  X,
  Layers,
  Copy,
  Check,
  CheckSquare,
  Square,
  Database,
  Upload,
  Trash2,
  House,
  TrendingUp,
  AlertTriangle,
  Pencil,
  type LucideIcon,
} from 'lucide-react';
import { Button, Card, Badge, ConfirmDialog, EmptyState, Skeleton, DismissibleInfo, IntroRichText, CountryFlag, CountryFlagBackdrop, Breadcrumb, ModuleGuideButton } from '@/shared/ui';
import { PageHeader } from '@/shared/ui/PageHeader';
import { catalogGuide } from './catalogGuide';
import { CategoryCombobox } from './CategoryCombobox';
import { ResourceTypeCombobox } from './ResourceTypeCombobox';
import { useConfirm } from '@/shared/hooks/useConfirm';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '@/shared/lib/api';
import { getIntlLocale } from '@/shared/lib/formatters';
import { useToastStore } from '@/stores/useToastStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { REGION_MAP } from '@/stores/useCostDatabaseStore';
import {
  assembliesApi,
  type CreateAssemblyData,
  type CreateComponentData,
  type ResourceType,
} from '@/features/assemblies/api';
import {
  getCatalogResourceTypes,
  getResourceTypeLabel,
  readStoredResourceTypes,
  resourceTypeFromApi,
  resourceTypeToApiPayload,
  writeStoredResourceTypes,
  type ResourceTypeApiResource,
  type ResourceTypeOption,
} from '@/shared/lib/resourceTypes';
import { copyToClipboard } from '@/shared/lib/browser';

/* ── Types ─────────────────────────────────────────────────────────────── */

interface CatalogResource {
  id: string;
  resource_code: string;
  name: string;
  resource_type: string;
  category: string;
  unit: string;
  // Decimal money values arrive as serialised strings to preserve precision;
  // call Number() at every numeric boundary (math, formatting, payloads).
  base_price: string;
  min_price: string;
  max_price: string;
  currency: string;
  usage_count: number;
  source: string;
  region: string | null;
  specifications: Record<string, unknown>;
  is_active: boolean;
  metadata_: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface CatalogSearchResponse {
  items: CatalogResource[];
  total: number;
  limit: number;
  offset: number;
}

interface CatalogTypeStat {
  resource_type: string;
  count: number;
}

interface CatalogCategoryStat {
  category: string;
  count: number;
  // 2-digit category code derived server-side from the resources'
  // resource_code (empty when the category has no numeric-coded rows).
  // Lets imported categories show their code without browser localStorage.
  code?: string;
}

interface CatalogStatsResponse {
  total: number;
  by_type: CatalogTypeStat[];
  by_category: CatalogCategoryStat[];
}

interface CatalogRegionStat {
  region: string;
  count: number;
}

interface SelectedResourceEntry {
  resource: CatalogResource;
  quantity: number;
}

/* ── Constants ─────────────────────────────────────────────────────────── */

const PAGE_SIZE = 20;
const CUSTOM_CATEGORIES_STORAGE_KEY = 'oce.catalog.customCategories';
const CUSTOM_CATEGORY_CODES_STORAGE_KEY = 'oce.catalog.categoryCodes';

interface TypeTabConfig {
  key: string;
  label: string;
  icon: LucideIcon;
}

function readStoredCustomCategories(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => String(value).trim())
      .filter((value, index, arr) => value && arr.indexOf(value) === index);
  } catch {
    return [];
  }
}

function writeStoredCustomCategories(categories: string[]) {
  if (typeof window === 'undefined') return;
  const clean = categories
    .map((value) => value.trim())
    .filter((value, index, arr) => value && arr.indexOf(value) === index)
    .sort((a, b) => a.localeCompare(b));
  window.localStorage.setItem(CUSTOM_CATEGORIES_STORAGE_KEY, JSON.stringify(clean));
}

function readStoredCategoryCodes(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CUSTOM_CATEGORY_CODES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, value]) => [key.trim(), String(value).replace(/\D/g, '').slice(0, 2).padStart(2, '0')])
        .filter(([key, value]) => key && value),
    );
  } catch {
    return {};
  }
}

function writeStoredCategoryCodes(codes: Record<string, string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CUSTOM_CATEGORY_CODES_STORAGE_KEY, JSON.stringify(codes));
}

const TYPE_TABS: TypeTabConfig[] = [
  { key: '', label: 'All', icon: Boxes },
  { key: 'material', label: 'Materials', icon: Package },
  { key: 'equipment', label: 'Equipment', icon: Wrench },
  { key: 'labor', label: 'Labor', icon: Users },
  { key: 'operator', label: 'Operators', icon: HardHat },
];

import { getUnitLabel, getAllUnitKeys } from '@/features/boq/boqHelpers';
import { unitSymbol } from '@/shared/lib/unitDefinitions';

const UNIT_KEYS = getAllUnitKeys();

interface CWICRRegionInfo {
  id: string;
  name: string;
  flagId: string;
  currency: string;
}

// All 30 CWICR regional catalogs published in the DDC CWICR repository, one
// metro per locale. Keep this list in sync with REGION_MAP in
// backend/app/modules/catalog/router.py (same region ids).
const CWICR_REGIONS: CWICRRegionInfo[] = [
  { id: 'USA_USD', name: 'United States', flagId: 'us', currency: 'USD' },
  { id: 'UK_GBP', name: 'United Kingdom', flagId: 'gb', currency: 'GBP' },
  { id: 'DE_BERLIN', name: 'Germany / DACH', flagId: 'de', currency: 'EUR' },
  { id: 'ENG_TORONTO', name: 'Canada', flagId: 'ca', currency: 'CAD' },
  { id: 'FR_PARIS', name: 'France', flagId: 'fr', currency: 'EUR' },
  { id: 'SP_BARCELONA', name: 'Spain', flagId: 'es', currency: 'EUR' },
  { id: 'IT_ROME', name: 'Italy', flagId: 'it', currency: 'EUR' },
  { id: 'NL_AMSTERDAM', name: 'Netherlands', flagId: 'nl', currency: 'EUR' },
  { id: 'PT_SAOPAULO', name: 'Brazil', flagId: 'br', currency: 'BRL' },
  { id: 'PE_LIMA', name: 'Peru', flagId: 'pe', currency: 'PEN' },
  { id: 'MX_MEXICOCITY', name: 'Mexico', flagId: 'mx', currency: 'MXN' },
  { id: 'RU_STPETERSBURG', name: 'Russia / CIS', flagId: 'ru', currency: 'RUB' },
  { id: 'PL_WARSAW', name: 'Poland', flagId: 'pl', currency: 'PLN' },
  { id: 'CS_PRAGUE', name: 'Czech Republic', flagId: 'cz', currency: 'CZK' },
  { id: 'RO_BUCHAREST', name: 'Romania', flagId: 'ro', currency: 'RON' },
  { id: 'BG_SOFIA', name: 'Bulgaria', flagId: 'bg', currency: 'BGN' },
  { id: 'HR_ZAGREB', name: 'Croatia', flagId: 'hr', currency: 'EUR' },
  { id: 'SV_STOCKHOLM', name: 'Sweden', flagId: 'se', currency: 'SEK' },
  { id: 'TR_ISTANBUL', name: 'Turkey', flagId: 'tr', currency: 'TRY' },
  { id: 'AR_DUBAI', name: 'Middle East', flagId: 'ae', currency: 'AED' },
  { id: 'ZA_JOHANNESBURG', name: 'South Africa', flagId: 'za', currency: 'ZAR' },
  { id: 'NG_LAGOS', name: 'Nigeria', flagId: 'ng', currency: 'NGN' },
  { id: 'ZH_SHANGHAI', name: 'China', flagId: 'cn', currency: 'CNY' },
  { id: 'JA_TOKYO', name: 'Japan', flagId: 'jp', currency: 'JPY' },
  { id: 'KO_SEOUL', name: 'South Korea', flagId: 'kr', currency: 'KRW' },
  { id: 'HI_MUMBAI', name: 'India', flagId: 'in', currency: 'INR' },
  { id: 'TH_BANGKOK', name: 'Thailand', flagId: 'th', currency: 'THB' },
  { id: 'VI_HANOI', name: 'Vietnam', flagId: 'vn', currency: 'VND' },
  { id: 'ID_JAKARTA', name: 'Indonesia', flagId: 'id', currency: 'IDR' },
  { id: 'AU_SYDNEY', name: 'Australia', flagId: 'au', currency: 'AUD' },
  { id: 'NZ_AUCKLAND', name: 'New Zealand', flagId: 'nz', currency: 'NZD' },
];

/* ── API helpers ───────────────────────────────────────────────────────── */

function buildSearchUrl(
  q: string,
  resourceType: string,
  category: string,
  unit: string,
  region: string,
  offset: number,
): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (resourceType) params.set('resource_type', resourceType);
  if (category) params.set('category', category);
  if (unit) params.set('unit', unit);
  if (region) params.set('region', region);
  params.set('limit', String(PAGE_SIZE));
  params.set('offset', String(offset));
  return `/v1/catalog/?${params.toString()}`;
}

function toComponentResourceType(value: string): ResourceType | undefined {
  const clean = value.trim();
  return clean ? clean : undefined;
}

/* ── Number formatting ─────────────────────────────────────────────────── */

const fmt = (n: number) =>
  new Intl.NumberFormat(getIntlLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

/* ── Mini Flag ─────────────────────────────────────────────────────────── */

function MiniFlag({ code, size = 14 }: { code: string; size?: number }) {
  if (!code || code === 'custom') {
    return <House size={size} className="shrink-0 text-oe-blue" />;
  }
  return <CountryFlag code={code} size={Math.round(size * 1.6)} className="shadow-xs border border-black/5" />;
}

/* ── Region Import Grid ──────────────────────────────────────────────── */

function RegionImportGrid({
  loadedRegionIds,
  onImported,
}: {
  loadedRegionIds: Set<string>;
  onImported: () => void;
}) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [importingId, setImportingId] = useState<string | null>(null);

  const importMutation = useMutation({
    mutationFn: (regionId: string) =>
      apiPost<{ imported: number; skipped: number; region: string }>(
        `/v1/catalog/import/${regionId}`,
      ),
    onSuccess: (result) => {
      addToast({
        type: 'success',
        title: t('catalog.import_success', { defaultValue: 'Import complete' }),
        message: `${result.imported} ${t('catalog.resources_imported', { defaultValue: 'resources imported' })}`,
      });
      setImportingId(null);
      onImported();
    },
    onError: (err: Error) => {
      addToast({
        type: 'error',
        title: t('catalog.import_failed', { defaultValue: 'Import failed' }),
        message: err.message,
      });
      setImportingId(null);
    },
  });

  const handleImport = useCallback(
    (regionId: string) => {
      setImportingId(regionId);
      importMutation.mutate(regionId);
    },
    [importMutation],
  );

  return (
    <Card padding="none" className="mb-6">
      <div className="p-5 border-b border-border-light">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-oe-blue-subtle text-oe-blue-text">
            <Database size={18} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-content-primary">
              {t('catalog.import_regions_title', { defaultValue: 'Import Resource Catalog' })}
            </h2>
            <p className="text-xs text-content-tertiary">
              {t('catalog.import_regions_desc', {
                defaultValue:
                  'Download pre-built resource catalogs from CWICR regional databases',
              })}
            </p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CWICR_REGIONS.map((region) => {
          const isLoaded = loadedRegionIds.has(region.id);
          const isImporting = importingId === region.id;

          return (
            <div
              key={region.id}
              className={`relative flex items-center gap-3 rounded-xl border p-3.5 transition-all ${
                isLoaded
                  ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/10'
                  : 'border-border hover:border-oe-blue/40 hover:bg-surface-secondary/50'
              }`}
            >
              <MiniFlag code={region.flagId} size={20} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-content-primary truncate">{region.name}</p>
                <p className="text-2xs text-content-tertiary">{region.currency}</p>
              </div>
              {isLoaded ? (
                <Badge variant="success" size="sm">
                  {t('catalog.loaded', { defaultValue: 'Loaded' })}
                </Badge>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={
                    isImporting ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Upload size={12} />
                    )
                  }
                  onClick={() => handleImport(region.id)}
                  disabled={isImporting}
                >
                  {isImporting
                    ? t('catalog.importing', { defaultValue: 'Importing...' })
                    : t('catalog.import', { defaultValue: 'Import' })}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ── Region Tab Bar ──────────────────────────────────────────────────── */

function RegionTabBar({
  regionStats,
  activeRegion,
  onChangeRegion,
  onImportClick,
}: {
  regionStats: CatalogRegionStat[];
  activeRegion: string;
  onChangeRegion: (region: string) => void;
  onImportClick: () => void;
}) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const totalItems = regionStats.reduce((s, r) => s + r.count, 0);
  const statsMap = new Map(regionStats.map((r) => [r.region, r.count]));

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, regionStats]);

  const scroll = useCallback((dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  }, []);

  if (regionStats.length === 0) return null;

  return (
    <div className="mb-4 relative rounded-xl border border-border-light bg-surface-elevated/50 px-1 pt-1 pb-0">
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          aria-label={t('common.scroll_left', { defaultValue: 'Scroll left' })}
          className="absolute left-0 top-0 bottom-0 z-10 flex items-center pl-0.5 pr-3 bg-gradient-to-r from-surface-elevated/80 via-surface-elevated/60 to-transparent rounded-l-xl"
        >
          <ChevronLeft size={16} className="text-content-tertiary" />
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          aria-label={t('common.scroll_right', { defaultValue: 'Scroll right' })}
          className="absolute right-0 top-0 bottom-0 z-10 flex items-center pr-0.5 pl-3 bg-gradient-to-l from-surface-elevated/80 via-surface-elevated/60 to-transparent rounded-r-xl"
        >
          <ChevronRight size={16} className="text-content-tertiary" />
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex items-stretch gap-0.5 overflow-x-auto scrollbar-none scroll-smooth"
      >
        {/* All tab */}
        <button
          onClick={() => onChangeRegion('')}
          className={`
            group relative flex items-center gap-2 shrink-0 rounded-t-lg px-4 py-2.5
            border-b-2 transition-all duration-fast ease-oe
            ${
              activeRegion === ''
                ? 'border-oe-blue bg-oe-blue-subtle/20 text-content-primary'
                : 'border-transparent hover:bg-surface-secondary text-content-secondary hover:text-content-primary'
            }
          `}
        >
          <Database
            size={14}
            className={activeRegion === '' ? 'text-oe-blue' : 'text-content-tertiary'}
          />
          <span className="text-sm font-medium whitespace-nowrap">
            {t('catalog.all_regions', { defaultValue: 'All' })}
          </span>
          <span
            className={`text-2xs tabular-nums ${activeRegion === '' ? 'text-oe-blue' : 'text-content-quaternary'}`}
          >
            {totalItems > 0 ? totalItems.toLocaleString() : ''}
          </span>
        </button>

        <div className="w-px shrink-0 bg-border-light my-2" />

        {/* My Catalog — always visible */}
        {(() => {
          const isActive = activeRegion === 'CUSTOM';
          const count = statsMap.get('CUSTOM') ?? 0;
          return (
            <button
              onClick={() => onChangeRegion('CUSTOM')}
              className={`
                group relative flex items-center gap-2 shrink-0 rounded-t-lg px-3.5 py-2.5
                border-b-2 transition-all duration-fast ease-oe
                ${
                  isActive
                    ? 'border-oe-blue bg-oe-blue-subtle/20 text-content-primary'
                    : 'border-transparent hover:bg-surface-secondary text-content-secondary hover:text-content-primary'
                }
              `}
            >
              <House size={14} className={isActive ? 'text-oe-blue' : 'text-content-tertiary'} />
              <span className="text-sm font-medium whitespace-nowrap">
                {t('catalog.my_catalog', { defaultValue: 'My Catalog' })}
              </span>
              <span
                className={`text-2xs tabular-nums ${isActive ? 'text-oe-blue' : 'text-content-quaternary'}`}
              >
                {count > 0 ? count.toLocaleString() : '0'}
              </span>
            </button>
          );
        })()}

        <div className="w-px shrink-0 bg-border-light my-2" />

        {/* Region tabs */}
        {regionStats.filter((rs) => rs.region !== 'CUSTOM').map((rs) => {
          const info = REGION_MAP[rs.region];
          if (!info) return null;
          const isActive = activeRegion === rs.region;
          const count = statsMap.get(rs.region) ?? 0;

          return (
            <button
              key={rs.region}
              onClick={() => onChangeRegion(rs.region)}
              className={`
                group relative flex items-center gap-2 shrink-0 rounded-t-lg px-3.5 py-2.5
                border-b-2 transition-all duration-fast ease-oe
                ${
                  isActive
                    ? 'border-oe-blue bg-oe-blue-subtle/20 text-content-primary'
                    : 'border-transparent hover:bg-surface-secondary text-content-secondary hover:text-content-primary'
                }
              `}
            >
              <MiniFlag code={info.flag} size={13} />
              <span className="text-sm font-medium whitespace-nowrap">{info.name}</span>
              <span
                className={`text-2xs tabular-nums ${isActive ? 'text-oe-blue' : 'text-content-quaternary'}`}
              >
                {count > 0 ? count.toLocaleString() : ''}
              </span>
            </button>
          );
        })}

        <div className="w-px shrink-0 bg-border-light my-2" />

        {/* Import button */}
        <button
          onClick={onImportClick}
          className="flex items-center gap-1.5 shrink-0 rounded-t-lg px-3 py-2.5 border-b-2 border-transparent text-content-tertiary hover:text-oe-blue-text hover:bg-oe-blue-subtle/10 transition-all duration-fast ease-oe"
          title={t('catalog.import_region', { defaultValue: 'Import region' })}
        >
          <Plus size={14} />
          <span className="text-sm font-medium whitespace-nowrap">
            {t('catalog.import', { defaultValue: 'Import' })}
          </span>
        </button>
      </div>

      <div className="h-px bg-border-light -mt-px" />
    </div>
  );
}

/* ── Price Bar Visualization ──────────────────────────────────────────── */

function PriceBar({
  min,
  avg,
  max,
  currency,
}: {
  min: number;
  avg: number;
  max: number;
  currency: string;
}) {
  if (max <= 0) return <span className="text-xs text-content-quaternary">--</span>;

  const range = max - min;
  const avgPos = range > 0 ? ((avg - min) / range) * 100 : 50;

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <span className="text-2xs text-content-quaternary tabular-nums whitespace-nowrap">
        {fmt(min)}
      </span>
      <div className="relative flex-1 h-2 bg-surface-tertiary rounded-full overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-400 to-amber-400 rounded-full"
          style={{ width: '100%' }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-content-primary rounded-full"
          style={{ left: `${Math.min(Math.max(avgPos, 2), 98)}%` }}
          title={`${fmt(avg)} ${currency}`}
        />
      </div>
      <span className="text-2xs text-content-quaternary tabular-nums whitespace-nowrap">
        {fmt(max)}
      </span>
    </div>
  );
}

/* ── Hover-tooltip with full text ─────────────────────────────────────
   Renders via React portal so the popup escapes the table's
   ``overflow-x-auto`` wrapper (which per CSS spec computes overflow-y
   to ``auto`` too, clipping any absolutely-positioned descendant).
   Anchors fixed-position to the wrapped element's bounding rect.
   Closes the gap left by the CSS-only ``group-hover/name:block``
   approach which clipped inside the table viewport. */
function HoverTooltip({
  text,
  className,
  children,
}: {
  text: string;
  className?: string;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
  }, []);
  const hide = useCallback(() => setPos(null), []);

  return (
    <>
      <span
        ref={wrapRef}
        className={className}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        title={text}
      >
        {children}
      </span>
      {pos
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[200] max-w-[640px] whitespace-normal rounded-md border border-border-light bg-surface-elevated px-3 py-2 text-xs font-normal text-content-primary shadow-xl"
              style={{ top: pos.top, left: pos.left }}
            >
              {text}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

/* ── Resource Row ────────────────────────────────────────────────────── */

function ResourceRow({
  resource,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  onCopy,
  onEdit,
  onDelete,
  onCopyToMine,
  copiedId,
  t: translate,
}: {
  resource: CatalogResource;
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyToMine: () => void;
  copiedId: string | null;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const typeColors: Record<string, string> = {
    material: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    equipment: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    labor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    operator: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };

  const regionInfo = resource.region ? REGION_MAP[resource.region] : null;

  return (
    <>
      <tr
        className={`group cursor-pointer transition-colors duration-fast ${
          isSelected
            ? 'bg-oe-blue-subtle/10'
            : 'hover:bg-surface-secondary/50'
        }`}
        onClick={onToggle}
      >
        {/* Checkbox */}
        <td className="px-3 py-3 w-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            aria-label={translate('catalog.toggle_select', { defaultValue: 'Toggle selection' })}
            className="flex h-5 w-5 items-center justify-center rounded text-content-tertiary hover:text-oe-blue transition-colors"
          >
            {isSelected ? (
              <CheckSquare size={16} className="text-oe-blue" />
            ) : (
              <Square size={16} />
            )}
          </button>
        </td>

        {/* Name */}
        <td className="px-4 py-3 text-sm text-content-primary font-medium">
          <div className="flex items-center gap-2">
            {regionInfo && <MiniFlag code={regionInfo.flag} size={11} />}
            <HoverTooltip text={resource.name} className="truncate max-w-[420px] inline-block">
              {resource.name}
            </HoverTooltip>
          </div>
          {resource.source === 'boq_import' && resource.specifications?.source_project_name ? (
            <div
              className="text-2xs text-content-quaternary mt-0.5 truncate"
              title={String(resource.specifications.source_project_name)}
            >
              {translate('common.from', { defaultValue: 'from' })}{' '}
              {String(resource.specifications.source_project_name)}
              {resource.specifications.saved_at ? (
                <>{' \u00b7 '}{new Date(String(resource.specifications.saved_at)).toLocaleDateString(getIntlLocale())}</>
              ) : null}
            </div>
          ) : null}
          {resource.resource_type === 'material' && typeof resource.specifications?.waste_pct === 'number' && resource.specifications.waste_pct > 0 && (
            <div className="mt-0.5">
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 dark:bg-amber-900/10 px-1 text-2xs text-amber-600 dark:text-amber-400">
                Desp: {resource.specifications.waste_pct}%
              </span>
            </div>
          )}
          {(resource.resource_type === 'labor' || resource.resource_type === 'operator') && (
            <div className="mt-0.5">
              <span className="inline-flex items-center gap-0.5 rounded bg-green-50 dark:bg-green-900/10 px-1 text-2xs text-green-600 dark:text-green-400">
                {resource.specifications?.labor_role
                  ? `${String(resource.specifications.labor_role).charAt(0).toUpperCase() + String(resource.specifications.labor_role).slice(1)}`
                  : getResourceTypeLabel(resource.resource_type, translate)}
                {resource.specifications?.daily_wage ? ` S/ ${Number(resource.specifications.daily_wage).toFixed(2)}/día` : ''}
                {resource.specifications?.burden_pct ? ` · +${Number(resource.specifications.burden_pct)}% ben.` : ''}
              </span>
            </div>
          )}
        </td>

        {/* Code */}
        <td className="px-3 py-3 max-w-[130px]">
          <span className="font-mono text-2xs text-content-tertiary truncate block" title={resource.resource_code}>
            {resource.resource_code}
          </span>
        </td>

        {/* Category */}
        <td className="px-3 py-3 max-w-[120px]">
          <span
            className="inline-block truncate max-w-full rounded px-1.5 py-0.5 text-2xs font-medium bg-surface-secondary text-content-secondary"
            title={resource.category}
          >
            {translate(`catalog.category_${resource.category.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, { defaultValue: resource.category })}
          </span>
        </td>

        {/* Type */}
        <td className="px-3 py-3">
          <span
            className={`inline-flex rounded px-1.5 py-0.5 text-2xs font-medium ${
              typeColors[resource.resource_type] || 'bg-surface-secondary text-content-secondary'
            }`}
          >
            {getResourceTypeLabel(resource.resource_type, translate)}
          </span>
        </td>

        {/* Unit */}
        <td className="px-4 py-3 text-center text-xs text-content-secondary" title={getUnitLabel(resource.unit, translate)}>{unitSymbol(resource.unit)}</td>

        {/* Price (avg) */}
        <td className="px-3 py-3 text-right text-xs font-semibold text-content-primary tabular-nums whitespace-nowrap">
          {fmt(Number(resource.base_price))}
        </td>

        {/* Price Range */}
        <td className="px-4 py-3">
          <PriceBar
            min={Number(resource.min_price)}
            avg={Number(resource.base_price)}
            max={Number(resource.max_price)}
            currency={resource.currency}
          />
        </td>

        {/* Usage */}
        <td className="px-4 py-3 text-center">
          <Badge
            variant={
              resource.usage_count > 20
                ? 'success'
                : resource.usage_count > 5
                  ? 'warning'
                  : 'neutral'
            }
          >
            {resource.usage_count}
          </Badge>
        </td>

        {/* Actions */}
        <td className="px-2 py-3">
          <div className="flex items-center gap-1">
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md text-content-tertiary hover:bg-oe-blue-subtle hover:text-oe-blue transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              aria-label={translate('catalog.edit_resource', { defaultValue: 'Edit resource' })}
              title={translate('catalog.edit_resource', { defaultValue: 'Edit resource' })}
            >
              <Pencil size={14} />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md text-content-tertiary hover:bg-surface-secondary hover:text-content-primary transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
              aria-label={translate('catalog.copy_rate', { defaultValue: 'Copy rate' })}
              title={translate('catalog.copy_rate', { defaultValue: 'Copy rate' })}
            >
              {copiedId === resource.id ? (
                <Check size={14} className="text-semantic-success" />
              ) : (
                <Copy size={14} />
              )}
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md text-content-tertiary hover:bg-surface-secondary hover:text-content-primary transition-colors"
              aria-label={translate('catalog.toggle_details', { defaultValue: 'Toggle details' })}
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded details */}
      {isExpanded && (
        <tr>
          <td colSpan={10} className="p-0">
            <ResourceDetailPanel
              resource={resource}
              regionInfo={regionInfo ?? undefined}
              fmt={fmt}
              translate={translate}
              onEdit={onEdit}
              onDelete={onDelete}
              onCopyToMine={onCopyToMine}
            />
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Resource Detail Panel ────────────────────────────────────────────── */

function ResourceDetailPanel({
  resource,
  regionInfo,
  fmt,
  translate: t,
  onEdit,
  onDelete,
  onCopyToMine,
}: {
  resource: CatalogResource;
  regionInfo: { name: string; flag: string; currency: string } | undefined;
  fmt: (n: number) => string;
  translate: (key: string, opts?: Record<string, string>) => string;
  onEdit: () => void;
  onDelete: () => void;
  onCopyToMine: () => void;
}) {
  const specs = resource.specifications || {};
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const minPrice = Number(resource.min_price);
  const basePrice = Number(resource.base_price);
  const maxPrice = Number(resource.max_price);
  const priceSpread = maxPrice > 0 ? ((maxPrice - minPrice) / maxPrice) * 100 : 0;

  // Parse hierarchy from specs
  const hierarchy = [
    specs.parent_category,
    specs.parent_collection,
    specs.parent_department,
    specs.parent_section,
  ].filter(Boolean).map(String);

  // Finite source enum — translate the known values, fall back to a
  // humanised form of the raw token for anything not yet mapped.
  const sourceLabels: Record<string, string> = {
    manual: t('catalog.source_manual', { defaultValue: 'Manual' }),
    boq_import: t('catalog.source_boq_import', { defaultValue: 'BOQ import' }),
    cad_import: t('catalog.source_cad_import', { defaultValue: 'CAD import' }),
    gaeb_import: t('catalog.source_gaeb_import', { defaultValue: 'GAEB import' }),
    ai_takeoff: t('catalog.source_ai_takeoff', { defaultValue: 'AI takeoff' }),
    cwicr: t('catalog.source_cwicr', { defaultValue: 'CWICR' }),
  };
  const sourceLabel =
    sourceLabels[resource.source] ?? resource.source.replace(/_/g, ' ');

  // Category derives from imported data and isn't a fixed enum, so reuse
  // the same key-slug scheme the table/sidebar use (falls back to the raw
  // label when no translation exists).
  const categoryLabel = t(
    `catalog.category_${resource.category.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    { defaultValue: resource.category },
  );

  return (
    <div className="bg-surface-secondary/20 border-t border-b border-border-light animate-fade-in">
      {/* Breadcrumb */}
      {hierarchy.length > 0 && (
        <div className="px-6 pt-3 pb-0">
          <div className="flex flex-wrap items-center gap-1">
            {hierarchy.map((part, i) => (
              <span key={`${part}-${i}`} className="flex items-center gap-1">
                <span className="text-2xs text-content-quaternary">{part}</span>
                {i < hierarchy.length - 1 && <span className="text-2xs text-content-quaternary/40">&rsaquo;</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 py-4">
        {/* Full resource name — always visible, wraps onto multiple lines
            so users can read disambiguating prefixes/suffixes without
            relying on the row's hover-tooltip. */}
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-content-primary leading-snug break-words">
            {resource.name}
          </h3>
          <div className="mt-0.5 flex items-center gap-2 text-2xs text-content-tertiary">
            <span className="font-mono">{resource.resource_code}</span>
            <span className="opacity-40">·</span>
            <span>{resource.unit}</span>
          </div>
        </div>

        <div className="-mt-10 mb-3 flex justify-end gap-2">
          {resource.region !== 'CUSTOM' && resource.source !== 'manual' && (
            <Button variant="secondary" size="sm" icon={<House size={13} />} onClick={onCopyToMine}>
              {t('catalog.copy_to_mine', { defaultValue: 'Add to My Database' })}
            </Button>
          )}
          <Button variant="secondary" size="sm" icon={<Trash2 size={13} />} onClick={() => setShowDeleteConfirm(true)}>
            {t('common.delete', { defaultValue: 'Delete' })}
          </Button>
          <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={onEdit}>
            {t('common.edit', { defaultValue: 'Edit' })}
          </Button>
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="mb-4 rounded-xl border border-semantic-error/20 bg-semantic-error/5 px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-content-primary">
                {t('catalog.delete_confirm_title', { defaultValue: 'Delete this resource?' })}
              </p>
              <p className="text-2xs text-content-secondary mt-0.5">
                {t('catalog.delete_confirm_desc', { defaultValue: 'This cannot be undone. Linked cost items will lose the reference.' })}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
              <Button variant="danger" size="sm" onClick={() => { setShowDeleteConfirm(false); onDelete(); }}>
                {t('common.delete_confirm', { defaultValue: 'Delete' })}
              </Button>
            </div>
          </div>
        )}

        {/* Top row: Price cards + Identity */}
        <div className="flex gap-4 mb-4">
          {/* Price cards */}
          <div className="flex gap-2 shrink-0">
            <div className="rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200/50 dark:border-green-500/20 px-3 py-2 text-center min-w-[80px]" title="Precio mínimo">
              <div className="text-2xs text-green-600 dark:text-green-400 font-medium mb-0.5">{t('common.min', { defaultValue: 'Min' })}</div>
              <div className="text-sm font-bold text-green-700 dark:text-green-300 tabular-nums">{fmt(minPrice)}</div>
            </div>
            <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 px-3 py-2 text-center min-w-[80px]" title="Precio promedio">
              <div className="text-2xs text-amber-600 dark:text-amber-400 font-medium mb-0.5">{t('common.avg', { defaultValue: 'Avg' })}</div>
              <div className="text-sm font-bold text-amber-700 dark:text-amber-300 tabular-nums">{fmt(basePrice)}</div>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200/50 dark:border-red-500/20 px-3 py-2 text-center min-w-[80px]" title="Precio máximo">
              <div className="text-2xs text-red-600 dark:text-red-400 font-medium mb-0.5">{t('common.max', { defaultValue: 'Max' })}</div>
              <div className="text-sm font-bold text-red-700 dark:text-red-300 tabular-nums">{fmt(maxPrice)}</div>
            </div>
            {typeof specs.waste_pct === 'number' && specs.waste_pct > 0 && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20 px-3 py-2 text-center min-w-[80px]" title="% Desperdicio de material">
                <div className="text-2xs text-amber-600 dark:text-amber-400 font-medium mb-0.5">Desp</div>
                <div className="text-sm font-bold text-amber-700 dark:text-amber-300 tabular-nums">{specs.waste_pct}%</div>
              </div>
            )}
            {resource.resource_type === 'equipment' && typeof specs.fuel_cost_per_hour === 'number' && specs.fuel_cost_per_hour > 0 && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200/50 dark:border-blue-500/20 px-3 py-2 text-center min-w-[80px]" title="Combustible / hora (S/)">
                <div className="text-2xs text-blue-600 dark:text-blue-400 font-medium mb-0.5">Comb/h</div>
                <div className="text-sm font-bold text-blue-700 dark:text-blue-300 tabular-nums">{Number(specs.fuel_cost_per_hour).toFixed(2)}</div>
              </div>
            )}
            {resource.resource_type === 'equipment' && typeof specs.acquisition_value === 'number' && specs.acquisition_value > 0 && (
              <div className="rounded-lg bg-violet-50 dark:bg-violet-500/10 border border-violet-200/50 dark:border-violet-500/20 px-3 py-2 text-center min-w-[90px]" title="Valor de adquisición (S/)">
                <div className="text-2xs text-violet-600 dark:text-violet-400 font-medium mb-0.5">Adq.</div>
                <div className="text-sm font-bold text-violet-700 dark:text-violet-300 tabular-nums">{Number(specs.acquisition_value).toLocaleString()}</div>
              </div>
            )}
            {resource.resource_type === 'equipment' && typeof specs.useful_life_years === 'number' && specs.useful_life_years > 0 && (
              <div className="rounded-lg bg-teal-50 dark:bg-teal-500/10 border border-teal-200/50 dark:border-teal-500/20 px-3 py-2 text-center min-w-[80px]" title="Vida útil (años)">
                <div className="text-2xs text-teal-600 dark:text-teal-400 font-medium mb-0.5">Vida util</div>
                <div className="text-sm font-bold text-teal-700 dark:text-teal-300 tabular-nums">{specs.useful_life_years}a</div>
              </div>
            )}
            {resource.resource_type === 'equipment' && typeof specs.maintenance_pct === 'number' && specs.maintenance_pct > 0 && (
              <div className="rounded-lg bg-orange-50 dark:bg-orange-500/10 border border-orange-200/50 dark:border-orange-500/20 px-3 py-2 text-center min-w-[80px]" title="Mantenimiento anual (%)">
                <div className="text-2xs text-orange-600 dark:text-orange-400 font-medium mb-0.5">Mant.</div>
                <div className="text-sm font-bold text-orange-700 dark:text-orange-300 tabular-nums">{specs.maintenance_pct}%</div>
              </div>
            )}
          </div>

          {/* Price spread bar */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xs text-content-tertiary">{resource.currency}</span>
              {priceSpread > 0 && (
                <span className="text-2xs text-content-quaternary">{t('catalog.spread', { defaultValue: 'spread' })} {priceSpread.toFixed(0)}%</span>
              )}
            </div>
            <div className="h-2 w-full rounded-full bg-surface-tertiary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-400 via-amber-400 to-red-400"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Specifications description */}
        {typeof specs.description === 'string' && specs.description.trim() && (
          <div className="mb-4 rounded-lg border border-border-light bg-surface-primary px-3 py-2.5">
            <div className="text-2xs text-content-quaternary uppercase tracking-wider mb-1">
              {t('catalog.specifications', { defaultValue: 'Specifications' })}
            </div>
            <p className="text-xs text-content-secondary leading-relaxed whitespace-pre-wrap break-words">
              {specs.description as string}
            </p>
          </div>
        )}

        {/* Images */}
        {Array.isArray(specs.images) && (specs.images as { name: string; dataUrl: string }[]).length > 0 && (
          <div className="mb-4">
            <div className="text-2xs text-content-quaternary uppercase tracking-wider mb-1">Imágenes</div>
            <div className="flex flex-wrap gap-2">
              {(specs.images as { name: string; dataUrl: string }[]).map((img, i) => (
                <img key={i} src={img.dataUrl} alt={img.name} className="h-20 w-20 rounded-lg border border-border object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setPreviewImg(img.dataUrl)} title={img.name}
                />
              ))}
            </div>
          </div>
        )}

        {/* Datasheets */}
        {Array.isArray(specs.datasheets) && (specs.datasheets as { name: string; dataUrl: string }[]).length > 0 && (
          <div className="mb-4">
            <div className="text-2xs text-content-quaternary uppercase tracking-wider mb-1">Fichas técnicas</div>
            <div className="flex flex-wrap gap-2">
              {(specs.datasheets as { name: string; dataUrl: string }[]).map((ds, i) => (
                <a key={i} href={ds.dataUrl} download={ds.name}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-primary px-3 py-1.5 text-xs text-content-secondary hover:text-oe-blue hover:border-oe-blue/30 transition-colors">
                  <span className="max-w-[160px] truncate">{ds.name}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Info grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-surface-primary border border-border-light p-2.5">
            <div className="text-2xs text-content-quaternary uppercase tracking-wider mb-1">{t('catalog.type_label', { defaultValue: 'Type' })}</div>
            <div className="text-xs font-medium text-content-primary">{getResourceTypeLabel(resource.resource_type, t)}</div>
            <div className="text-2xs text-content-tertiary mt-0.5">{categoryLabel}</div>
          </div>

          {/* Labor info card */}
          {(resource.resource_type === 'labor' || resource.resource_type === 'operator') && (
            <div className="rounded-lg bg-surface-primary border border-border-light p-2.5">
              <div className="text-2xs text-content-quaternary uppercase tracking-wider mb-1">Mano de obra</div>
              <div className="text-xs font-medium text-content-primary">
                {(specs.labor_role as string) || getResourceTypeLabel(resource.resource_type, t)}
              </div>
              <div className="text-2xs text-content-tertiary mt-0.5">
                {specs.daily_wage ? `S/ ${Number(specs.daily_wage).toFixed(2)}/día` : ''}
                {specs.burden_pct ? ` · +${Number(specs.burden_pct)}% benef.` : ''}
                {!specs.daily_wage && !specs.burden_pct ? 'Sin datos laborales' : ''}
              </div>
            </div>
          )}

          {/* Usage */}
          <div className="rounded-lg bg-surface-primary border border-border-light p-2.5">
            <div className="text-2xs text-content-quaternary uppercase tracking-wider mb-1">{t('catalog.usage', { defaultValue: 'Usage' })}</div>
            <div className="text-xs font-medium text-content-primary">{resource.usage_count.toLocaleString()} {t('catalog.references', { defaultValue: 'references' })}</div>
            {specs.used_in_work_items ? (
              <div className="text-2xs text-content-tertiary mt-0.5">{Number(specs.used_in_work_items).toLocaleString()} {t('catalog.work_items', { defaultValue: 'work items' })}</div>
            ) : null}
          </div>

          {/* Region */}
          <div className="rounded-lg bg-surface-primary border border-border-light p-2.5">
            <div className="text-2xs text-content-quaternary uppercase tracking-wider mb-1">{t('catalog.region_label', { defaultValue: 'Region' })}</div>
            <div className="flex items-center gap-1.5">
              {regionInfo && <MiniFlag code={regionInfo.flag} size={12} />}
              <span className="text-xs font-medium text-content-primary">{regionInfo?.name ?? resource.region}</span>
            </div>
            <div className="text-2xs text-content-tertiary mt-0.5">{resource.unit} · {sourceLabel}</div>
          </div>
        </div>

        {/* Source info for boq_import items */}
        {resource.source === 'boq_import' && Boolean(specs.source_project_name || specs.source_boq_name || specs.saved_at) && (
          <div className="mt-3 rounded-lg bg-oe-blue-subtle/20 border border-oe-blue/10 px-3 py-2.5">
            <div className="text-2xs text-oe-blue font-semibold uppercase tracking-wider mb-1.5">
              {t('catalog.saved_from_project', { defaultValue: 'Saved from project' })}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {specs.source_project_name ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-content-tertiary">{t('projects.project', { defaultValue: 'Project' })}:</span>
                  <span className="font-medium text-content-primary">{String(specs.source_project_name)}</span>
                </div>
              ) : null}
              {specs.source_boq_name ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-content-tertiary">{t('boq.boq_abbr', { defaultValue: 'BOQ' })}:</span>
                  <span className="font-medium text-content-primary">{String(specs.source_boq_name)}</span>
                </div>
              ) : null}
              {specs.saved_at ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-content-tertiary">{t('common.saved', { defaultValue: 'Saved' })}:</span>
                  <span className="text-content-secondary">
                    {new Date(String(specs.saved_at)).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Additional specs (collapsed by default) — badge fields already visible above are excluded */}
        {(() => {
          const BADGE_KEYS = new Set([
            'waste_pct', 'labor_role', 'daily_wage', 'burden_pct',
            'fuel_cost_per_hour', 'acquisition_value', 'useful_life_years', 'maintenance_pct',
          ]);
          const remaining = Object.entries(specs).filter(
            ([k, v]) => !BADGE_KEYS.has(k) && v && String(v).trim() !== ''
          );
          if (remaining.length === 0) return null;
          return (
            <details className="mt-3">
              <summary className="text-2xs font-medium text-content-tertiary cursor-pointer hover:text-content-secondary select-none">
                {t('catalog.all_properties', { defaultValue: 'All properties' })} ({remaining.length})
              </summary>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-2xs">
                {remaining.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2 py-0.5">
                    <span className="text-content-quaternary capitalize">{k.replace(/_/g, ' ').replace('parent ', '')}</span>
                    <span className="text-content-secondary truncate max-w-[150px] text-right" title={String(v)}>
                      {!isNaN(Number(v)) ? Number(Number(v).toFixed(2)).toLocaleString() : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          );
        })()}
      </div>

      {/* Image preview modal */}
      {previewImg && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 animate-fade-in p-6" onClick={() => setPreviewImg(null)}>
          <div className="relative max-h-[90vh] max-w-[95vw] sm:max-w-[800px] rounded-xl shadow-2xl overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImg(null)}
              className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors"
              aria-label="Cerrar">
              <X size={14} />
            </button>
            <img src={previewImg} alt="Preview" className="block w-auto h-auto max-h-[90vh] max-w-[95vw] object-scale-down" />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ── Build Assembly Modal ────────────────────────────────────────────── */

function BuildAssemblyModal({
  resources,
  onClose,
  onSuccess,
}: {
  resources: CatalogResource[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  const [name, setName] = useState('');
  const [assemblyUnit, setAssemblyUnit] = useState('m2');
  const [assemblyCategory, setAssemblyCategory] = useState('general');
  const [isCreating, setIsCreating] = useState(false);
  const [entries, setEntries] = useState<SelectedResourceEntry[]>(() =>
    resources.map((r) => ({ resource: r, quantity: 1 })),
  );

  // An assembly carries a single base currency, but the selected catalog
  // resources may span several (e.g. an EUR material + a USD labour rate).
  // There is no cross-currency rate table here, so we must NOT blend them
  // into one scalar. Detect the spread, group the running total per
  // currency, and block creation while it's ambiguous.
  const distinctCurrencies = Array.from(
    new Set(entries.map((e) => e.resource.currency || 'EUR')),
  );
  const isMultiCurrency = distinctCurrencies.length > 1;
  const currency = distinctCurrencies[0] ?? 'EUR';

  const totalsByCurrency = entries.reduce<Record<string, number>>((acc, e) => {
    const code = e.resource.currency || 'EUR';
    acc[code] = (acc[code] ?? 0) + Number(e.resource.base_price) * e.quantity;
    return acc;
  }, {});
  const total = totalsByCurrency[currency] ?? 0;

  const handleQuantityChange = useCallback((idx: number, value: string) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, quantity: Math.max(0, parseFloat(value) || 0) } : e)),
    );
  }, []);

  const handleRemoveEntry = useCallback((idx: number) => {
    setEntries((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim() || entries.length === 0) return;
    // Mixed currencies can't be summed into a single assembly rate, and
    // there's no rate table to convert them. Refuse rather than fabricate
    // a misleading blended total.
    if (isMultiCurrency) {
      addToast({
        type: 'error',
        title: t('catalog.mixed_currency_title', { defaultValue: 'Mixed currencies' }),
        message: t('catalog.mixed_currency_block', {
          defaultValue:
            'Selected resources use different currencies ({{codes}}). Build the assembly from resources sharing one currency.',
          codes: distinctCurrencies.join(', '),
        }),
      });
      return;
    }
    setIsCreating(true);

    try {
      // Create assembly
      const code = `ASM-${Date.now().toString(36).toUpperCase()}`;
      const assemblyData: CreateAssemblyData = {
        code,
        name: name.trim(),
        unit: assemblyUnit,
        category: assemblyCategory,
        currency,
      };
      const assembly = await assembliesApi.create(assemblyData);

      // Add components — link each back to its catalog resource so future
      // catalog price changes can propagate into the assembly, and carry the
      // resource type for typed (M/L/E) roll-ups.
      for (const entry of entries) {
        if (entry.quantity <= 0) continue;
        const componentData: CreateComponentData = {
          catalog_resource_id: entry.resource.id,
          resource_type: toComponentResourceType(entry.resource.resource_type),
          description: entry.resource.name,
          unit: entry.resource.unit,
          unit_cost: Number(entry.resource.base_price),
          quantity: entry.quantity,
          factor: 1.0,
          metadata: {
            resource_type: toComponentResourceType(entry.resource.resource_type),
            resource_type_code: entry.resource.specifications?.resource_type_code,
            resource_type_name: entry.resource.specifications?.resource_type_name,
            resource_type_badge: entry.resource.specifications?.resource_type_badge,
            calculation_group: entry.resource.specifications?.calculation_group,
          },
        };
        await assembliesApi.addComponent(assembly.id, componentData);
      }

      addToast({
        type: 'success',
        title: t('catalog.assembly_created', { defaultValue: 'Assembly created' }),
        message: `"${name.trim()}" ${t('catalog.with_n_components', { defaultValue: `with ${entries.length} components` })}`,
      });
      onSuccess();
      navigate(`/assemblies/${assembly.id}`);
    } catch (err) {
      addToast({
        type: 'error',
        title: t('catalog.assembly_failed', { defaultValue: 'Failed to create assembly' }),
        message: err instanceof Error ? err.message : t('common.unknown_error', { defaultValue: 'Unknown error' }),
      });
    } finally {
      setIsCreating(false);
    }
  }, [
    name,
    assemblyUnit,
    assemblyCategory,
    currency,
    isMultiCurrency,
    distinctCurrencies,
    entries,
    addToast,
    t,
    onSuccess,
    navigate,
  ]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-build-assembly-title"
        className="bg-surface-elevated rounded-2xl border border-border shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-oe-blue-subtle text-oe-blue-text">
              <Layers size={18} />
            </div>
            <div>
              <h2 id="catalog-build-assembly-title" className="text-base font-semibold text-content-primary">
                {t('catalog.build_assembly', { defaultValue: 'Build Assembly' })}
              </h2>
              <p className="text-xs text-content-tertiary">
                {entries.length}{' '}
                {entries.length === 1
                  ? t('catalog.resource', { defaultValue: 'resource' })
                  : t('catalog.resources', { defaultValue: 'resources' })}{' '}
                {t('catalog.selected', { defaultValue: 'selected' })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close', { defaultValue: 'Close' })}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary hover:bg-surface-secondary hover:text-content-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Assembly name */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-content-secondary mb-1.5 block">
                {t('catalog.assembly_name', { defaultValue: 'Assembly Name' })} *
              </label>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label={t('catalog.assembly_name', { defaultValue: 'Assembly Name' })}
                placeholder={t('catalog.assembly_name_placeholder', {
                  defaultValue: 'e.g. Reinforced Concrete Wall C30/37',
                })}
                className="h-10 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-oe-blue focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-content-secondary mb-1.5 block">
                {t('boq.unit', { defaultValue: 'Unit' })}
              </label>
              <select
                value={assemblyUnit}
                onChange={(e) => setAssemblyUnit(e.target.value)}
                aria-label={t('boq.unit', { defaultValue: 'Unit' })}
                className="h-10 w-full appearance-none rounded-lg border border-border bg-surface-primary px-3 text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-oe-blue focus:border-transparent"
              >
                {UNIT_KEYS.map((u) => (
                  <option key={u} value={u}>
                    {unitSymbol(u)} ({getUnitLabel(u, t)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-content-secondary mb-1.5 block">
              {t('catalog.category', { defaultValue: 'Category' })}
            </label>
            <select
              value={assemblyCategory}
              onChange={(e) => setAssemblyCategory(e.target.value)}
              aria-label={t('catalog.category', { defaultValue: 'Category' })}
              className="h-10 w-full appearance-none rounded-lg border border-border bg-surface-primary px-3 text-sm text-content-primary focus:outline-none focus:ring-2 focus:ring-oe-blue focus:border-transparent sm:w-48"
            >
              {['general', 'concrete', 'masonry', 'steel', 'mep', 'earthwork', 'custom'].map(
                (c) => (
                  <option key={c} value={c}>
                    {t(`catalog.assembly_cat_${c}`, { defaultValue: c.charAt(0).toUpperCase() + c.slice(1) })}
                  </option>
                ),
              )}
            </select>
          </div>

          {/* Resource table */}
          <div className="rounded-lg border border-border-light bg-surface-secondary/50 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-tertiary text-content-secondary">
                  <th className="px-3 py-2 text-left font-medium">
                    {t('catalog.resource_name', { defaultValue: 'Resource' })}
                  </th>
                  <th className="px-3 py-2 text-center font-medium w-14">
                    {t('boq.unit', { defaultValue: 'Unit' })}
                  </th>
                  <th className="px-3 py-2 text-right font-medium w-24">
                    {t('catalog.unit_rate', { defaultValue: 'Unit Rate' })}
                  </th>
                  <th className="px-3 py-2 text-center font-medium w-16">
                    {t('catalog.currency', { defaultValue: 'Currency' })}
                  </th>
                  <th className="px-3 py-2 text-center font-medium w-20">
                    {t('catalog.quantity', { defaultValue: 'Qty' })}
                  </th>
                  <th className="px-3 py-2 text-right font-medium w-24">
                    {t('catalog.subtotal', { defaultValue: 'Subtotal' })}
                  </th>
                  <th className="px-1 py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light">
                {entries.map((entry, idx) => (
                  <tr key={entry.resource.id}>
                    <td className="px-3 py-2 text-content-primary truncate max-w-[220px]">
                      {entry.resource.name}
                    </td>
                    <td className="px-3 py-2 text-center text-content-tertiary">
                      {entry.resource.unit}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-content-primary">
                      {fmt(Number(entry.resource.base_price))}
                    </td>
                    <td
                      className={`px-3 py-2 text-center font-medium tabular-nums ${
                        isMultiCurrency
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-content-tertiary'
                      }`}
                    >
                      {entry.resource.currency || 'EUR'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={entry.quantity}
                        onChange={(e) => handleQuantityChange(idx, e.target.value)}
                        className="h-7 w-16 rounded border border-border bg-surface-primary px-1.5 text-center text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-oe-blue"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-content-primary">
                      {fmt(Number(entry.resource.base_price) * entry.quantity)}
                    </td>
                    <td className="px-1 py-2 text-center">
                      <button
                        onClick={() => handleRemoveEntry(idx)}
                        aria-label={t('catalog.remove_resource', { defaultValue: 'Remove resource' })}
                        className="flex h-6 w-6 items-center justify-center rounded text-content-quaternary hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {isMultiCurrency ? (
                  distinctCurrencies.map((code) => (
                    <tr key={code} className="bg-surface-tertiary font-medium">
                      <td colSpan={5} className="px-3 py-2 text-right text-sm text-content-primary">
                        {t('catalog.total', { defaultValue: 'Total' })} ({code}):
                      </td>
                      <td className="px-3 py-2 text-right text-sm tabular-nums text-content-primary">
                        {fmt(totalsByCurrency[code] ?? 0)} {code}
                      </td>
                      <td />
                    </tr>
                  ))
                ) : (
                  <tr className="bg-surface-tertiary font-medium">
                    <td colSpan={5} className="px-3 py-2 text-right text-sm text-content-primary">
                      {t('catalog.total', { defaultValue: 'Total' })}:
                    </td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-content-primary">
                      {fmt(total)} {currency}
                    </td>
                    <td />
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {/* Mixed-currency warning — an assembly has one base currency and
              there is no rate table here to convert across currencies, so we
              block creation until the selection shares a single currency. */}
          {isMultiCurrency && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10 px-4 py-3">
              <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  {t('catalog.mixed_currency_title', { defaultValue: 'Mixed currencies' })}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  {t('catalog.mixed_currency_warning', {
                    defaultValue:
                      'Selected resources use {{codes}}. An assembly has a single currency, so amounts cannot be combined. Remove rows until one currency remains.',
                    codes: distinctCurrencies.join(', '),
                  })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border-light bg-surface-secondary/30 shrink-0">
          <span className="text-xs text-content-tertiary">
            {entries.length}{' '}
            {entries.length === 1
              ? t('catalog.component', { defaultValue: 'component' })
              : t('catalog.components', { defaultValue: 'components' })}
            {' | '}
            {isMultiCurrency
              ? distinctCurrencies
                  .map((code) => `${fmt(totalsByCurrency[code] ?? 0)} ${code}`)
                  .join('  ·  ')
              : `${fmt(total)} ${currency}`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={
                isCreating ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Layers size={14} />
                )
              }
              onClick={handleCreate}
              disabled={!name.trim() || entries.length === 0 || isCreating || isMultiCurrency}
            >
              {isCreating
                ? t('catalog.creating', { defaultValue: 'Creating...' })
                : t('catalog.create_assembly', { defaultValue: 'Create Assembly' })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main CatalogPage ────────────────────────────────────────────────── */

export function CatalogPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const navigate = useNavigate();

  // ?region=DE_BERLIN deep-link from /setup/databases — pre-selects the
  // region filter on mount so the user lands directly on the resources
  // they just imported.
  const [searchParams, setSearchParams] = useSearchParams();
  const regionFromUrl = searchParams.get('region') ?? '';

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [region, setRegion] = useState(regionFromUrl);
  const [offset, setOffset] = useState(0);

  // Strip the region param after one-shot apply so the filter doesn't
  // get re-forced on every render or refresh.
  useEffect(() => {
    if (!regionFromUrl) return;
    searchParams.delete('region');
    setSearchParams(searchParams, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyCounterRef = useRef(0);
  const [showImportGrid, setShowImportGrid] = useState(false);
  const [showCreateResource, setShowCreateResource] = useState(false);
  const [editingResource, setEditingResource] = useState<CatalogResource | null>(null);
  const [showBuildAssembly, setShowBuildAssembly] = useState(false);
  const [showPriceAdjust, setShowPriceAdjust] = useState(false);
  const { confirm, ...confirmProps } = useConfirm();

  // Debounce search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch stats (for tab + category counts). Scoped to the active
  // region so a category/type badge never advertises a count the
  // region-filtered list below it can't show ("count says N but
  // No resources found"). When region is cleared the counts go
  // global again, matching the unfiltered list.
  const { data: stats } = useQuery({
    queryKey: ['catalog', 'stats', region],
    queryFn: () =>
      apiGet<CatalogStatsResponse>(
        region
          ? `/v1/catalog/stats/?region=${encodeURIComponent(region)}`
          : '/v1/catalog/stats/',
      ),
    retry: false,
  });

  // Fetch loaded regions
  const { data: regionStats } = useQuery({
    queryKey: ['catalog', 'regions'],
    queryFn: () => apiGet<CatalogRegionStat[]>('/v1/catalog/regions/'),
    retry: false,
  });

  // Auto-pick a region when no filter is active and rows exist somewhere.
  // Mirrors the CostsPage fallback so a user landing on /catalog after
  // /setup/databases doesn't see "0 resources" when the just-loaded region
  // is sitting one click away.
  useEffect(() => {
    if (region) return;
    if (regionFromUrl) return;
    const first = (regionStats ?? [])
      .map((r) => r.region)
      .find((r): r is string => Boolean(r));
    if (!first) return;
    setRegion(first);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionStats]);

  // Fetch resources
  const searchUrl = buildSearchUrl(debouncedQuery, resourceType, category, unit, region, offset);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['catalog', debouncedQuery, resourceType, category, unit, region, offset],
    queryFn: () => apiGet<CatalogSearchResponse>(searchUrl),
    placeholderData: (prev) => prev,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  // Count per type for tabs
  const typeCountMap = new Map(
    (stats?.by_type ?? []).map((s) => [s.resource_type, s.count]),
  );
  const totalCount = stats?.total ?? 0;

  // Categories for dropdown. Keep the active category visible while the
  // region-scoped stats refetch after creating a CUSTOM resource.
  const categories = Array.from(
    new Set([
      ...(stats?.by_category ?? []).map((c) => c.category),
      ...(category ? [category] : []),
    ]),
  );

  // Loaded region IDs
  const loadedRegionIds = new Set((regionStats ?? []).map((r) => r.region));
  const hasAnyRegions = loadedRegionIds.size > 0;

  // Selected items for actions
  const selectedItems = items.filter((i) => selectedIds.has(i.id));

  // Region info for subtitle
  const regionInfo = region ? REGION_MAP[region] : null;

  const handleSearch = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const handleTypeChange = useCallback((value: string) => {
    setResourceType(value);
    setOffset(0);
  }, []);

  const handleCategoryChange = useCallback((value: string) => {
    setCategory(value);
    setOffset(0);
  }, []);

  const handleRegionChange = useCallback((value: string) => {
    setRegion(value);
    setOffset(0);
    // Clear any active selection / expansion: the previously selected rows
    // belong to a different region's result set and would otherwise feed a
    // stale, mixed-region selection into Build Assembly / Copy.
    setSelectedIds(new Set());
    setExpandedId(null);
  }, []);

  const handleCopyRate = useCallback(async (resource: CatalogResource) => {
    try {
      await copyToClipboard(String(resource.base_price));
      setCopiedId(resource.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API unavailable -- silently ignore.
    }
  }, []);

  const handleDeleteResource = useCallback(async (resource: CatalogResource) => {
    try {
      await apiDelete(`/v1/catalog/${resource.id}`);
      setExpandedId(null);
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      addToast({
        type: 'success',
        title: t('catalog.resource_deleted', { defaultValue: 'Resource deleted' }),
        message: resource.name,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: t('common.error'),
        message: err instanceof Error ? err.message : 'Failed to delete resource',
      });
    }
  }, [addToast, t, queryClient]);

  const handleCopyToMine = useCallback(async (resource: CatalogResource) => {
    try {
      // Keep our coding scheme when the source already uses it (TT type + CC
      // category + NNNNNN): the copy in "My Database" stays consistent — same
      // type+category prefix, with a fresh correlative scoped to CUSTOM so
      // re-copying the same reference never collides. Legacy regions whose
      // codes are not 10 digits keep the CAT-{TYPE}-{N} fallback.
      let code: string;
      if (/^\d{10}$/.test(resource.resource_code)) {
        // Ask the backend for the next free correlative of this TT+CC prefix.
        // Codes are globally unique, so it scans every region reliably (the
        // client-side scan missed high correlatives in large categories and
        // collided with the source region's code).
        const prefix = resource.resource_code.slice(0, 4);
        const { next_code } = await apiGet<{ next_code: string }>(
          `/v1/catalog/next-code/?prefix=${prefix}`,
        );
        code = next_code;
      } else {
        const typePrefix = resource.resource_type.slice(0, 3).toUpperCase();
        const maxNum = items
          .filter((i) => i.source === 'manual' && (i.resource_code ?? '').startsWith(`CAT-${typePrefix}-`))
          .reduce((max, i) => {
            const num = parseInt(((i.resource_code ?? '').split('-').pop() ?? '0'), 10);
            return Number.isFinite(num) && num > max ? num : max;
          }, 0);
        copyCounterRef.current += 1;
        code = `CAT-${typePrefix}-${String(maxNum + copyCounterRef.current).padStart(6, '0')}`;
      }
      await apiPost('/v1/catalog/', {
        resource_code: code,
        name: resource.name,
        resource_type: resource.resource_type,
        category: resource.category,
        unit: resource.unit,
        base_price: Number(resource.base_price) || 0,
        min_price: Number(resource.min_price) || 0,
        max_price: Number(resource.max_price) || 0,
        currency: resource.currency,
        source: 'manual',
        region: 'CUSTOM',
        specifications: resource.specifications,
      });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
      addToast({
        type: 'success',
        title: t('catalog.copied_to_mine', { defaultValue: 'Added to My Database' }),
        message: resource.name,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: t('common.error'),
        message: err instanceof Error ? err.message : 'Failed to copy resource',
      });
    }
  }, [addToast, t, queryClient]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((i) => i.id)));
    }
  }, [items, selectedIds.size]);

  const handleDeleteRegion = useCallback(
    async (regionId: string) => {
      // Destructive: wipes every resource in the region. Confirm before firing
      // so a stray click can't nuke a populated region.
      const confirmed = await confirm({
        title: t('catalog.delete_region_title', {
          defaultValue: 'Delete region?',
        }),
        message: t('catalog.delete_region_confirm', {
          defaultValue: 'Delete region "{{region}}" and all its resources? This cannot be undone.',
          region: regionId,
        }),
        confirmLabel: t('common.delete', { defaultValue: 'Delete' }),
        variant: 'danger',
      });
      if (!confirmed) return;
      try {
        const result = await apiDelete<{ deleted: number; region: string }>(
          `/v1/catalog/region/${regionId}`,
        );
        addToast({
          type: 'success',
          title: t('catalog.region_deleted', { defaultValue: 'Region deleted' }),
          message: `${result.deleted} ${t('catalog.resources_removed', { defaultValue: 'resources removed' })}`,
        });
        queryClient.invalidateQueries({ queryKey: ['catalog'] });
        if (region === regionId) setRegion('');
      } catch (err) {
        addToast({
          type: 'error',
          title: t('catalog.delete_failed', { defaultValue: 'Delete failed' }),
          message: err instanceof Error ? err.message : t('common.unknown_error', { defaultValue: 'Unknown error' }),
        });
      }
    },
    [addToast, confirm, t, queryClient, region],
  );

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['catalog'] });
  }, [queryClient]);

  return (
    <div className="relative space-y-5 animate-fade-in">
      {/* Faint watermark of the selected resource-database country - reads
          as a wash behind the catalog, never interactive. */}
      <CountryFlagBackdrop code={region || null} />
      <Breadcrumb items={[{ label: t('catalog.title', { defaultValue: 'Resource Catalog' }) }]} />
      {/* Canonical top block — module name + icon are shown by the global top
          app bar. The page renders only its (contextual) subtitle on the left
          and the page actions on the right. */}
      <PageHeader
        srTitle={t('catalog.title', { defaultValue: 'Resource Catalog' })}
        subtitle={
          regionInfo
            ? `${regionInfo.name}, ${total.toLocaleString()} ${t('catalog.resources', { defaultValue: 'resources' })}`
            : total > 0
              ? `${total.toLocaleString()} ${t('catalog.resources_found', { defaultValue: 'resources found' })}`
              : t('catalog.search_hint', {
                  defaultValue: 'Browse materials, equipment, labor, and operators',
                })
        }
        actions={
          <>
          {/* How it works guide - explains the catalog concepts and the
              import / search / apply-to-BOQ flow. Sits at the head of the
              action cluster as the leading help pill. */}
          <ModuleGuideButton content={catalogGuide} onCta={() => setShowImportGrid(true)} />

          {/* Region selector dropdown */}
          {hasAnyRegions && (
            <div className="relative">
              <select
                value={region}
                onChange={(e) => handleRegionChange(e.target.value)}
                aria-label={t('catalog.filter_region', { defaultValue: 'Filter by region' })}
                className="h-7 appearance-none rounded-lg border border-border bg-surface-primary pl-3 pr-8 text-sm text-content-primary transition-all focus:outline-none focus:ring-2 focus:ring-oe-blue focus:border-transparent"
              >
                <option value="">
                  {t('catalog.all_regions', { defaultValue: 'All regions' })}
                </option>
                {(regionStats ?? []).map((rs) => {
                  const info = REGION_MAP[rs.region];
                  return (
                    <option key={rs.region} value={rs.region}>
                      {info?.name ?? rs.region} ({rs.count.toLocaleString()})
                    </option>
                  );
                })}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-content-tertiary">
                <ChevronDown size={14} />
              </div>
            </div>
          )}

          {/* Delete region button */}
          {region && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Trash2 size={14} />}
              onClick={() => handleDeleteRegion(region)}
            >
              {t('catalog.delete_region', { defaultValue: 'Delete Region' })}
            </Button>
          )}

          {/* Bulk price adjustment */}
          {totalCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              icon={<TrendingUp size={14} />}
              onClick={() => setShowPriceAdjust(true)}
            >
              {t('catalog.adjust_prices', { defaultValue: 'Adjust Prices' })}
            </Button>
          )}

          {/* Add custom resource */}
          <Button
            variant="secondary"
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => setShowCreateResource(true)}
            data-guide="catalog-add-resource"
          >
            {t('catalog.add_resource', { defaultValue: 'Add Resource' })}
          </Button>

          {/* Import region button */}
          <Button
            variant="primary"
            size="sm"
            icon={<Upload size={14} />}
            onClick={() => setShowImportGrid(!showImportGrid)}
            data-guide="catalog-import"
          >
            {t('catalog.import_region', { defaultValue: 'Import Region' })}
          </Button>
          </>
        }
      />

      {/* What is catalog info banner */}
      <DismissibleInfo
        storageKey="catalog"
        title={t('catalog.intro_title', { defaultValue: 'Keep the building blocks priced right' })}
        more={t('catalog.intro_more', { defaultValue: '' }) ? <IntroRichText text={t('catalog.intro_more')} /> : undefined}
        links={[
          { label: t('nav.assemblies', { defaultValue: 'Assemblies' }), onClick: () => navigate('/assemblies') },
          { label: t('nav.costs', { defaultValue: 'Cost Database' }), onClick: () => navigate('/costs') },
          { label: t('nav.boq', { defaultValue: 'Bill of Quantities' }), onClick: () => navigate('/boq') },
        ]}
      >
        {t('catalog.intro_body', {
          defaultValue:
            'Maintain the atomic items behind every estimate, the individual materials, labour rates and equipment costs, sourced from CWICR regional databases or your own imports. Bulk inflation, regional and group price adjustments apply here, then feed assemblies, BOQ unit rates and cost matching across projects.',
        })}
      </DismissibleInfo>

      {/* Region Import Grid (expandable) */}
      {(showImportGrid || (!hasAnyRegions && totalCount === 0)) && (
        <RegionImportGrid loadedRegionIds={loadedRegionIds} onImported={invalidateAll} />
      )}

      {/* Region Tab Bar */}
      {hasAnyRegions && (
        <RegionTabBar
          regionStats={regionStats ?? []}
          activeRegion={region}
          onChangeRegion={handleRegionChange}
          onImportClick={() => setShowImportGrid(!showImportGrid)}
        />
      )}

      {/* Type Filter Pills */}
      <div className="mb-5" data-guide="catalog-type-filters">
        <div className="flex items-center gap-1.5 flex-wrap">
          {TYPE_TABS.map((tab) => {
            const isActive = resourceType === tab.key;
            const count = tab.key === '' ? totalCount : (typeCountMap.get(tab.key) ?? 0);
            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                onClick={() => handleTypeChange(tab.key)}
                className={`
                  flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5
                  text-xs font-medium transition-all duration-fast ease-oe
                  ${
                    isActive
                      ? 'bg-oe-blue text-white shadow-sm'
                      : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary hover:text-content-primary'
                  }
                `}
              >
                <Icon
                  size={13}
                  className={isActive ? 'text-white/80' : 'text-content-tertiary'}
                />
                <span className="whitespace-nowrap">
                  {t(`catalog.tab_${tab.key || 'all'}`, { defaultValue: tab.label })}
                </span>
                {count > 0 && (
                  <span
                    className={`text-2xs tabular-nums ${
                      isActive ? 'text-white/70' : 'text-content-quaternary'
                    }`}
                  >
                    {count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="h-px bg-border-light -mt-px" />
      </div>

      {/* Search & Filters */}
      <Card padding="none" className="mb-6">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          {/* Search input */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-content-tertiary">
              <Search size={16} />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              data-guide="catalog-search"
              aria-label={t('catalog.search_resources', { defaultValue: 'Search resources' })}
              placeholder={
                regionInfo
                  ? `${t('catalog.search_in', { defaultValue: 'Search in' })} ${regionInfo.name}...`
                  : t('catalog.search_placeholder', {
                      defaultValue: 'Search by name or code...',
                    })
              }
              className="h-10 w-full rounded-lg border border-border bg-surface-primary pl-10 pr-9 text-sm text-content-primary placeholder:text-content-tertiary transition-all duration-fast ease-oe focus:outline-none focus:ring-2 focus:ring-oe-blue focus:border-transparent hover:border-content-tertiary"
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setDebouncedQuery('');
                  setOffset(0);
                }}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-content-tertiary hover:text-content-secondary transition-colors"
                aria-label={t('common.clear', { defaultValue: 'Clear' })}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <div className="relative">
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                aria-label={t('catalog.filter_category', { defaultValue: 'Filter by category' })}
                className="h-10 w-full appearance-none rounded-lg border border-border bg-surface-primary pl-3 pr-9 text-sm text-content-primary transition-all duration-fast ease-oe focus:outline-none focus:ring-2 focus:ring-oe-blue focus:border-transparent hover:border-content-tertiary sm:w-48"
              >
                <option value="">
                  {t('catalog.all_categories', { defaultValue: 'All categories' })}
                </option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`catalog.category_${cat.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, { defaultValue: cat })}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-content-tertiary">
                <ChevronDown size={14} />
              </div>
            </div>
          )}

          {/* Unit filter */}
          <div className="relative">
            <select
              value={unit}
              aria-label={t('catalog.filter_unit', { defaultValue: 'Filter by unit' })}
              onChange={(e) => {
                setUnit(e.target.value);
                setOffset(0);
              }}
              className="h-10 w-full appearance-none rounded-lg border border-border bg-surface-primary pl-3 pr-9 text-sm text-content-primary transition-all duration-fast ease-oe focus:outline-none focus:ring-2 focus:ring-oe-blue focus:border-transparent hover:border-content-tertiary sm:w-32"
            >
              <option value="">
                {t('catalog.all_units', { defaultValue: 'All units' })}
              </option>
              {UNIT_KEYS.map((u) => (
                <option key={u} value={u}>
                  {unitSymbol(u)} ({getUnitLabel(u, t)})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-content-tertiary">
              <ChevronDown size={14} />
            </div>
          </div>
        </div>
      </Card>

      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-5">

      {/* Category sidebar (desktop) — flat list because /catalog categories
          live in `stats.by_category` (no parent/child hierarchy, unlike
          /costs which has a real classification tree). Click → applies the
          same `category` filter the toolbar dropdown uses, so the two
          stay in sync. Hidden below `lg:` so mobile keeps the dropdown. */}
      <aside className="hidden lg:block lg:sticky lg:top-4 lg:self-start">
        <Card padding="none" className="overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border-light bg-surface-secondary/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-content-secondary">
              {t('catalog.sidebar_categories', { defaultValue: 'Categories' })}
            </span>
            {category && (
              <button
                type="button"
                onClick={() => handleCategoryChange('')}
                aria-label={t('common.clear', { defaultValue: 'Clear' })}
                className="text-2xs text-content-tertiary hover:text-content-primary transition-colors"
              >
                {t('catalog.clear_filter', { defaultValue: 'Clear' })}
              </button>
            )}
          </div>
          <div className="max-h-[calc(100vh-12rem)] overflow-auto py-1">
            <button
              type="button"
              onClick={() => handleCategoryChange('')}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                category === ''
                  ? 'bg-oe-blue-subtle text-content-primary font-semibold'
                  : 'text-content-secondary hover:bg-surface-secondary'
              }`}
            >
              <span className="truncate">
                {t('catalog.all_categories', { defaultValue: 'All categories' })}
              </span>
              <span className="text-2xs text-content-tertiary tabular-nums shrink-0 ml-2">
                {totalCount.toLocaleString()}
              </span>
            </button>
            {(stats?.by_category ?? []).map((c) => {
              const isActive = category === c.category;
              return (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => handleCategoryChange(c.category)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                    isActive
                      ? 'bg-oe-blue-subtle text-content-primary font-semibold'
                      : 'text-content-secondary hover:bg-surface-secondary'
                  }`}
                  title={c.category}
                >
                  <span className="truncate">
                    {t(`catalog.category_${c.category.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, { defaultValue: c.category })}
                  </span>
                  <span className={`text-2xs tabular-nums shrink-0 ml-2 ${isActive ? 'text-content-secondary' : 'text-content-tertiary'}`}>
                    {c.count.toLocaleString()}
                  </span>
                </button>
              );
            })}
            {(stats?.by_category ?? []).length === 0 && (
              <div className="px-3 py-3 text-2xs text-content-tertiary">
                {t('catalog.no_categories', { defaultValue: 'No categories yet - import a region to populate.' })}
              </div>
            )}
          </div>
        </Card>
      </aside>

      <div className="min-w-0">

      {/* Results Table */}
      {isLoading ? (
        <Card padding="none" className="overflow-hidden">
          <div className="space-y-0 divide-y divide-border-light">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                <Skeleton width={20} height={20} rounded="md" />
                <Skeleton className="flex-1" height={14} />
                <Skeleton width={72} height={14} />
                <Skeleton width={80} height={14} />
                <Skeleton width={40} height={14} />
                <Skeleton width={80} height={14} />
                <Skeleton width={120} height={14} />
                <Skeleton width={40} height={14} />
                <Skeleton width={56} height={28} rounded="md" />
              </div>
            ))}
          </div>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Boxes size={28} strokeWidth={1.5} />}
          title={
            region === 'CUSTOM'
              ? t('catalog.my_catalog_empty', { defaultValue: 'Your catalog is empty' })
              : !hasAnyRegions && !debouncedQuery
                ? t('catalog.empty_title', { defaultValue: 'Resource Catalog' })
                : t('catalog.no_results', { defaultValue: 'No resources found' })
          }
          description={
            region === 'CUSTOM'
              ? t('catalog.my_catalog_empty_desc', {
                  defaultValue:
                    'Add your own materials, equipment, and labor rates. Custom resources can be used in assemblies and applied to BOQ positions.',
                })
              : !hasAnyRegions && !debouncedQuery
                ? t('catalog.empty_desc', {
                    defaultValue:
                      'The catalog stores individual materials, equipment, and labor rates. Import a regional database to get started, or add custom resources.',
                  })
                : debouncedQuery
                  ? t('catalog.no_results_hint', {
                      defaultValue: 'Try adjusting your search or filters',
                    })
                  : hasAnyRegions
                    ? t('catalog.empty_with_regions', {
                        defaultValue:
                          'No resources match the current filters. Try changing the type or region.',
                      })
                    : t('catalog.empty_hint', {
                        defaultValue:
                          'Import a regional catalog to populate resources, or extract from cost items.',
                      })
          }
          action={
            region === 'CUSTOM' ? (
              <Button
                variant="primary"
                icon={<Plus size={16} />}
                onClick={() => setShowCreateResource(true)}
              >
                {t('catalog.add_resource', { defaultValue: 'Add Resource' })}
              </Button>
            ) : !hasAnyRegions ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  icon={<Upload size={16} />}
                  onClick={() => setShowImportGrid(true)}
                >
                  {t('catalog.import_region', { defaultValue: 'Import Region' })}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => navigate('/costs/import')}
                >
                  {t('catalog.import_database', { defaultValue: 'Import Database' })}
                </Button>
              </div>
            ) : undefined
          }
        />
      ) : (
        <>
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto" data-guide="catalog-table">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-light bg-surface-tertiary text-left">
                    <th className="px-3 py-3 w-10">
                      <button
                        onClick={toggleSelectAll}
                        aria-label={t('catalog.select_all', { defaultValue: 'Select all' })}
                        className="flex h-5 w-5 items-center justify-center rounded text-content-tertiary hover:text-oe-blue transition-colors"
                      >
                        {selectedIds.size > 0 && selectedIds.size === items.length ? (
                          <CheckSquare size={16} className="text-oe-blue" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 font-medium text-content-secondary">
                      {t('catalog.name', { defaultValue: 'Name' })}
                    </th>
                    <th className="px-4 py-3 font-medium text-content-secondary w-36">
                      {t('catalog.code', { defaultValue: 'Code' })}
                    </th>
                    <th className="px-3 py-3 font-medium text-content-secondary w-28">
                      {t('catalog.category', { defaultValue: 'Category' })}
                    </th>
                    <th className="px-3 py-3 font-medium text-content-secondary w-20">
                      {t('catalog.type_label', { defaultValue: 'Type' })}
                    </th>
                    <th className="px-4 py-3 font-medium text-content-secondary w-16 text-center">
                      {t('boq.unit', { defaultValue: 'Unit' })}
                    </th>
                    <th className="px-4 py-3 font-medium text-content-secondary w-32 text-right">
                      {t('catalog.price_avg', { defaultValue: 'Price (avg)' })}
                    </th>
                    <th className="px-4 py-3 font-medium text-content-secondary w-48">
                      {t('catalog.price_range', { defaultValue: 'Price Range' })}
                    </th>
                    <th className="px-4 py-3 font-medium text-content-secondary w-16 text-center">
                      {t('catalog.usage', { defaultValue: 'Usage' })}
                    </th>
                    <th className="px-2 py-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {items.map((resource) => {
                    const isExpanded = expandedId === resource.id;
                    return (
                      <ResourceRow
                        key={resource.id}
                        resource={resource}
                        isExpanded={isExpanded}
                        isSelected={selectedIds.has(resource.id)}
                        onToggle={() => setExpandedId(isExpanded ? null : resource.id)}
                        onSelect={() => toggleSelect(resource.id)}
                        onCopy={() => handleCopyRate(resource)}
                        onEdit={() => setEditingResource(resource)}
                        onDelete={() => handleDeleteResource(resource)}
                        onCopyToMine={() => handleCopyToMine(resource)}
                        copiedId={copiedId}
                        t={t}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {(() => {
            const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
            const totalPages = Math.ceil(total / PAGE_SIZE);
            const goToPage = (p: number) => setOffset((p - 1) * PAGE_SIZE);
            const start = Math.max(1, currentPage - 2);
            const end = Math.min(totalPages, start + 4);
            const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

            return (
              <div className="mt-6 flex flex-col items-center gap-3">
                <p className="text-xs text-content-tertiary">
                  {t('catalog.showing_range', {
                    defaultValue: '{{from}}-{{to}} of {{total}}',
                    from: offset + 1,
                    to: Math.min(offset + PAGE_SIZE, total),
                    total: total.toLocaleString(),
                  })}
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1" role="navigation" aria-label={t('catalog.pagination', { defaultValue: 'Pagination' })}>
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      aria-label={t('common.previous_page', { defaultValue: 'Previous page' })}
                      disabled={currentPage === 1 || isFetching}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {start > 1 && (
                      <>
                        <button
                          onClick={() => goToPage(1)}
                          className="flex h-8 min-w-[32px] items-center justify-center rounded-lg text-xs text-content-secondary hover:bg-surface-secondary transition-colors"
                        >
                          1
                        </button>
                        {start > 2 && (
                          <span className="text-content-quaternary text-xs px-1">...</span>
                        )}
                      </>
                    )}
                    {pages.map((p) => (
                      <button
                        key={p}
                        onClick={() => goToPage(p)}
                        disabled={isFetching}
                        className={`flex h-8 min-w-[32px] items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                          p === currentPage
                            ? 'bg-oe-blue text-white'
                            : 'text-content-secondary hover:bg-surface-secondary'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    {end < totalPages && (
                      <>
                        {end < totalPages - 1 && (
                          <span className="text-content-quaternary text-xs px-1">...</span>
                        )}
                        <button
                          onClick={() => goToPage(totalPages)}
                          className="flex h-8 min-w-[32px] items-center justify-center rounded-lg text-xs text-content-secondary hover:bg-surface-secondary transition-colors"
                        >
                          {totalPages}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages || isFetching}
                      aria-label={t('common.next_page', { defaultValue: 'Next page' })}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </>
      )}

      </div>{/* /min-w-0 main column */}
      </div>{/* /2-column grid wrapper */}

      {/* Floating Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 animate-fade-in">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-elevated px-5 py-3 shadow-xl">
            <span className="text-sm font-semibold text-content-primary tabular-nums">
              {selectedIds.size}{' '}
              {t('catalog.selected', { defaultValue: 'selected' })}
            </span>
            <div className="w-px h-6 bg-border-light" />
            <Button
              variant="primary"
              size="sm"
              icon={<Layers size={14} />}
              onClick={() => setShowBuildAssembly(true)}
            >
              {t('catalog.build_assembly', { defaultValue: 'Build Assembly' })}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Copy size={14} />}
              onClick={() => {
                const text = selectedItems
                  .map(
                    (r) =>
                      `${r.resource_code}\t${r.name}\t${r.unit}\t${r.base_price}\t${r.currency}`,
                  )
                  .join('\n');
                copyToClipboard(text).catch(() => {});
                addToast({
                  type: 'success',
                  title: t('catalog.copied', { defaultValue: 'Copied' }),
                  message: `${selectedIds.size} ${t('catalog.items_copied', { defaultValue: 'resources copied to clipboard' })}`,
                });
              }}
            >
              {t('catalog.copy', { defaultValue: 'Copy' })}
            </Button>
            <button
              onClick={() => setSelectedIds(new Set())}
              aria-label={t('catalog.clear_selection', { defaultValue: 'Clear selection' })}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-content-tertiary hover:text-content-primary hover:bg-surface-secondary transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Build Assembly Modal */}
      {showBuildAssembly && selectedItems.length > 0 && (
        <BuildAssemblyModal
          resources={selectedItems}
          onClose={() => setShowBuildAssembly(false)}
          onSuccess={() => {
            setShowBuildAssembly(false);
            setSelectedIds(new Set());
          }}
        />
      )}

      {showCreateResource && (
        <ResourceFormModal
          onClose={() => setShowCreateResource(false)}
          onSaved={(saved) => {
            setShowCreateResource(false);
            if (saved?.region) {
              setRegion(saved.region);
              setCategory(saved.category);
              setOffset(0);
            }
            invalidateAll();
          }}
          customCount={items.filter(i => i.source === 'manual').length}
        />
      )}

      {editingResource && (
        <ResourceFormModal
          resource={editingResource}
          onClose={() => setEditingResource(null)}
          onSaved={() => {
            setEditingResource(null);
            invalidateAll();
          }}
        />
      )}

      {showPriceAdjust && (
        <PriceAdjustModal
          stats={stats}
          regionStats={regionStats ?? []}
          currentFilters={{ resourceType, category, region }}
          onClose={() => setShowPriceAdjust(false)}
          onSuccess={() => {
            setShowPriceAdjust(false);
            invalidateAll();
          }}
        />
      )}
      <ConfirmDialog {...confirmProps} />
    </div>
  );
}

/* ── Price Adjust Modal ──────────────────────────────────────────────── */

// Published construction cost indices (BKI, BCIS, ENR, Eurostat) — stable data, kept outside component
const PRICE_INDICES: Record<string, { label: string; rates: Record<string, number> }> = {
  DE: { label: 'Germany (BKI)', rates: { '2020': 3.2, '2021': 5.1, '2022': 14.6, '2023': 7.8, '2024': 4.2, '2025': 3.5, '2026': 3.0 } },
  AT: { label: 'Austria', rates: { '2020': 2.8, '2021': 4.9, '2022': 12.3, '2023': 6.5, '2024': 3.8, '2025': 3.2, '2026': 2.8 } },
  CH: { label: 'Switzerland', rates: { '2020': 1.5, '2021': 2.8, '2022': 6.2, '2023': 3.4, '2024': 2.5, '2025': 2.0, '2026': 1.8 } },
  UK: { label: 'UK (BCIS)', rates: { '2020': 2.0, '2021': 8.5, '2022': 10.2, '2023': 4.8, '2024': 3.5, '2025': 3.0, '2026': 2.8 } },
  US: { label: 'USA (ENR)', rates: { '2020': 1.2, '2021': 6.3, '2022': 11.5, '2023': 3.2, '2024': 2.8, '2025': 2.5, '2026': 2.3 } },
  FR: { label: 'France', rates: { '2020': 2.3, '2021': 5.5, '2022': 9.8, '2023': 5.6, '2024': 3.6, '2025': 2.8, '2026': 2.5 } },
  EU: { label: 'EU Average', rates: { '2020': 2.5, '2021': 5.8, '2022': 11.0, '2023': 6.0, '2024': 3.5, '2025': 3.0, '2026': 2.5 } },
  AE: { label: 'UAE / Gulf', rates: { '2020': 1.8, '2021': 3.5, '2022': 7.2, '2023': 4.0, '2024': 3.0, '2025': 2.5, '2026': 2.2 } },
  RU: { label: 'Russia', rates: { '2020': 4.5, '2021': 8.2, '2022': 18.5, '2023': 9.0, '2024': 6.0, '2025': 5.0, '2026': 4.5 } },
  IN: { label: 'India', rates: { '2020': 3.0, '2021': 5.0, '2022': 8.5, '2023': 5.5, '2024': 4.5, '2025': 4.0, '2026': 3.5 } },
};

function PriceAdjustModal({
  stats,
  regionStats,
  currentFilters,
  onClose,
  onSuccess,
}: {
  stats: CatalogStatsResponse | undefined;
  regionStats: CatalogRegionStat[];
  currentFilters: { resourceType: string; category: string; region: string };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const [factor, setFactor] = useState(1.05);
  const [filterType, setFilterType] = useState(currentFilters.resourceType);
  const [filterCategory, setFilterCategory] = useState(currentFilters.category);
  const [filterRegion, setFilterRegion] = useState(currentFilters.region);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const [useIndex, setUseIndex] = useState(false);
  const [indexRegion, setIndexRegion] = useState('DE');
  const [baseYear, setBaseYear] = useState(2024);
  const [targetYear, setTargetYear] = useState(2026);

  // Auto-compute factor from published index
  useEffect(() => {
    if (!useIndex || baseYear >= targetYear) return;
    const indexData = PRICE_INDICES[indexRegion];
    if (!indexData) return;
    let f = 1;
    for (let y = baseYear; y < targetYear; y++) {
      const rate = indexData.rates[String(y)] ?? indexData.rates[String(Math.min(y, 2026))] ?? 3.0;
      f *= 1 + rate / 100;
    }
    setFactor(Math.round(f * 10000) / 10000);
    setConfirmed(false);
  }, [useIndex, indexRegion, baseYear, targetYear]);

  const percentage = ((factor - 1) * 100).toFixed(1);
  const isIncrease = factor > 1;
  const isDecrease = factor < 1;
  const isLargeChange = Math.abs(factor - 1) > 0.2;

  // Estimate affected count
  const totalResources = stats?.total ?? 0;
  const categories = (stats?.by_category ?? []).map((c) => c.category);

  // Rough estimate of affected resources based on filters
  let estimatedCount = totalResources;
  if (filterType) {
    const typeStat = (stats?.by_type ?? []).find((s) => s.resource_type === filterType);
    estimatedCount = typeStat?.count ?? 0;
  }

  const handleApply = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const params = new URLSearchParams();
      params.set('factor', String(factor));
      if (filterType) params.set('resource_type', filterType);
      if (filterCategory) params.set('category', filterCategory);
      if (filterRegion) params.set('region', filterRegion);

      const result = await apiPatch<{ adjusted: number; factor: number }>(
        `/v1/catalog/adjust-prices/?${params.toString()}`,
      );

      addToast({
        type: 'success',
        title: t('catalog.prices_adjusted', { defaultValue: 'Prices adjusted' }),
        message: t('catalog.prices_adjusted_desc', {
          defaultValue: '{{count}} resources updated by {{pct}}%',
          count: result.adjusted,
          pct: percentage,
        }),
      });
      onSuccess();
    } catch (err) {
      addToast({
        type: 'error',
        title: t('catalog.adjust_failed', { defaultValue: 'Adjustment failed' }),
        message: err instanceof Error ? err.message : t('common.unknown_error', { defaultValue: 'Unknown error' }),
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [factor, filterType, filterCategory, filterRegion, percentage, addToast, t, onSuccess]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-adjust-prices-title"
        className="bg-surface-elevated rounded-2xl border border-border shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <TrendingUp size={18} />
            </div>
            <div>
              <h2 id="catalog-adjust-prices-title" className="text-base font-semibold text-content-primary">
                {t('catalog.adjust_prices', { defaultValue: 'Adjust Prices' })}
              </h2>
              <p className="text-xs text-content-tertiary">
                {t('catalog.adjust_prices_desc', {
                  defaultValue: 'Apply a multiplication factor to resource prices',
                })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close', { defaultValue: 'Close' })}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary hover:bg-surface-secondary hover:text-content-primary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* Mode toggle: Manual vs Published Index */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setUseIndex(false)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${!useIndex ? 'bg-oe-blue text-white' : 'bg-surface-primary text-content-secondary hover:bg-surface-secondary'}`}
            >
              {t('catalog.manual_factor', { defaultValue: 'Manual Factor' })}
            </button>
            <button
              onClick={() => setUseIndex(true)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${useIndex ? 'bg-oe-blue text-white' : 'bg-surface-primary text-content-secondary hover:bg-surface-secondary'}`}
            >
              {t('catalog.from_inflation_index', { defaultValue: 'From Inflation Index' })}
            </button>
          </div>

          {/* Published Index selector */}
          {useIndex && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                <TrendingUp size={14} />
                {t('catalog.inflation_index', { defaultValue: 'Published Construction Cost Indices' })}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-2xs text-content-tertiary mb-1 block">{t('catalog.index_country', { defaultValue: 'Country / Source' })}</label>
                  <select value={indexRegion} onChange={(e) => setIndexRegion(e.target.value)} className="h-8 w-full rounded-md border border-border bg-surface-primary px-2 text-xs focus:outline-none focus:ring-2 focus:ring-oe-blue/30">
                    {Object.entries(PRICE_INDICES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-2xs text-content-tertiary mb-1 block">{t('catalog.from_year', { defaultValue: 'From year' })}</label>
                  <select value={baseYear} onChange={(e) => setBaseYear(Number(e.target.value))} className="h-8 w-full rounded-md border border-border bg-surface-primary px-2 text-xs focus:outline-none focus:ring-2 focus:ring-oe-blue/30">
                    {[2020,2021,2022,2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-2xs text-content-tertiary mb-1 block">{t('catalog.to_year', { defaultValue: 'To year' })}</label>
                  <select value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} className="h-8 w-full rounded-md border border-border bg-surface-primary px-2 text-xs focus:outline-none focus:ring-2 focus:ring-oe-blue/30">
                    {[2020,2021,2022,2023,2024,2025,2026,2027,2028,2029,2030].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              {baseYear < targetYear && (
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const idx = PRICE_INDICES[indexRegion];
                    const items = [];
                    for (let y = baseYear; y < targetYear; y++) {
                      const rate = idx?.rates[String(y)] ?? idx?.rates[String(Math.min(y, 2026))] ?? 3.0;
                      items.push(<span key={y} className="inline-flex items-center gap-1 rounded bg-surface-secondary px-2 py-0.5 text-2xs"><span className="text-content-tertiary">{y}</span><span className="font-medium text-amber-600">+{rate.toFixed(1)}%</span></span>);
                    }
                    return items;
                  })()}
                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-900/20 px-2 py-0.5 text-2xs font-bold text-amber-700 dark:text-amber-300">
                    = ×{factor.toFixed(4)} (+{percentage}%)
                  </span>
                </div>
              )}
              <p className="text-2xs text-content-quaternary">
                {t('catalog.index_sources', { defaultValue: 'Sources: BKI (Germany), BCIS (UK), ENR (USA), Eurostat (EU). Representative averages.' })}
              </p>
            </div>
          )}

          {/* Factor input (manual or auto-filled from index) */}
          <div>
            <label className="text-xs font-medium text-content-secondary mb-2 block">
              {useIndex
                ? t('catalog.computed_factor', { defaultValue: 'Computed Factor (from index above)' })
                : t('catalog.price_factor', { defaultValue: 'Price Factor' })}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0.50"
                max="2.00"
                step="0.01"
                value={factor}
                onChange={(e) => {
                  setFactor(parseFloat(e.target.value));
                  setConfirmed(false);
                }}
                className="flex-1 h-2 accent-oe-blue"
              />
              <input
                type="number"
                min="0.50"
                max="2.00"
                step="0.01"
                value={factor}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0.5 && val <= 2.0) {
                    setFactor(val);
                    setConfirmed(false);
                  }
                }}
                className="h-9 w-20 rounded-lg border border-border bg-surface-primary px-2 text-center text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-oe-blue"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  isIncrease
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    : isDecrease
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                      : 'bg-surface-secondary text-content-secondary'
                }`}
              >
                {isIncrease ? '+' : ''}{percentage}%
              </span>
              <span className="text-xs text-content-tertiary">
                {factor === 1
                  ? t('catalog.no_change', { defaultValue: 'No change' })
                  : isIncrease
                    ? t('catalog.price_increase', { defaultValue: 'Price increase' })
                    : t('catalog.price_decrease', { defaultValue: 'Price decrease' })}
              </span>
            </div>
          </div>

          {/* Filter selectors */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-content-secondary mb-1 block">
                {t('catalog.type_label', { defaultValue: 'Type' })}
              </label>
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setConfirmed(false);
                }}
                className="h-9 w-full appearance-none rounded-lg border border-border bg-surface-primary px-2 text-sm focus:outline-none focus:ring-2 focus:ring-oe-blue"
              >
                <option value="">
                  {t('catalog.all_types', { defaultValue: 'All types' })}
                </option>
                <option value="material">
                  {t('catalog.type_material', { defaultValue: 'Material' })}
                </option>
                <option value="equipment">
                  {t('catalog.type_equipment', { defaultValue: 'Equipment' })}
                </option>
                <option value="labor">
                  {t('catalog.type_labor', { defaultValue: 'Labor' })}
                </option>
                <option value="operator">
                  {t('catalog.type_operator', { defaultValue: 'Operator' })}
                </option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-content-secondary mb-1 block">
                {t('catalog.category', { defaultValue: 'Category' })}
              </label>
              <select
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value);
                  setConfirmed(false);
                }}
                className="h-9 w-full appearance-none rounded-lg border border-border bg-surface-primary px-2 text-sm focus:outline-none focus:ring-2 focus:ring-oe-blue"
              >
                <option value="">
                  {t('catalog.all_categories', { defaultValue: 'All categories' })}
                </option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`catalog.category_${cat.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, { defaultValue: cat })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-content-secondary mb-1 block">
                {t('catalog.region_label', { defaultValue: 'Region' })}
              </label>
              <select
                value={filterRegion}
                onChange={(e) => {
                  setFilterRegion(e.target.value);
                  setConfirmed(false);
                }}
                className="h-9 w-full appearance-none rounded-lg border border-border bg-surface-primary px-2 text-sm focus:outline-none focus:ring-2 focus:ring-oe-blue"
              >
                <option value="">
                  {t('catalog.all_regions', { defaultValue: 'All regions' })}
                </option>
                {regionStats.map((rs) => {
                  const info = REGION_MAP[rs.region];
                  return (
                    <option key={rs.region} value={rs.region}>
                      {info?.name ?? rs.region}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg border border-border-light bg-surface-secondary/40 px-4 py-3">
            <p className="text-sm text-content-secondary">
              {t('catalog.adjust_preview', {
                defaultValue: 'This will affect approximately {{num}} resources',
                num: estimatedCount.toLocaleString(),
              })}
            </p>
            {factor !== 1 && (
              <p className="text-xs text-content-tertiary mt-1">
                {t('catalog.adjust_example', {
                  defaultValue: 'Example: {{oldPrice}} -> {{newPrice}}',
                  oldPrice: '100.00',
                  newPrice: (100 * factor).toFixed(2),
                })}
              </p>
            )}
          </div>

          {/* Warning for large changes */}
          {isLargeChange && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10 px-4 py-3">
              <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  {t('catalog.large_change_warning', {
                    defaultValue: 'Large price change detected (>20%)',
                  })}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  {t('catalog.large_change_hint', {
                    defaultValue:
                      'Please confirm this is intentional. This operation cannot be undone.',
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Confirmation checkbox for large changes */}
          {isLargeChange && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-oe-blue"
              />
              <span className="text-xs text-content-secondary">
                {t('catalog.confirm_large_change', {
                  defaultValue: 'I confirm this price adjustment of {{pct}}%',
                  pct: percentage,
                })}
              </span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border-light bg-surface-secondary/30">
          <span className="text-xs text-content-tertiary">
            {t('catalog.factor_label', { defaultValue: 'Factor' })}: {factor.toFixed(2)}{' '}
            ({isIncrease ? '+' : ''}{percentage}%)
          </span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={
                isSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <TrendingUp size={14} />
                )
              }
              onClick={handleApply}
              disabled={factor === 1 || isSubmitting || (isLargeChange && !confirmed)}
            >
              {isSubmitting
                ? t('catalog.adjusting', { defaultValue: 'Adjusting...' })
                : t('catalog.apply_adjustment', { defaultValue: 'Apply' })}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Create Resource Modal ───────────────────────────────────────────── */

function ResourceFormModal({
  resource,
  onClose,
  onSaved,
}: {
  resource?: CatalogResource;
  onClose: () => void;
  onSaved: (saved?: { category: string; region: string }) => void;
  customCount?: number;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const rawPreferredCurrency = usePreferencesStore((s) => s.currency);
  const setPreference = usePreferencesStore((s) => s.setPreference);
  const { data: userPrefs } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => apiGet<{ currency_code?: string | null }>('/v1/users/me/preferences/'),
    retry: false,
    staleTime: 60_000,
  });
  const serverPreferredCurrency = (userPrefs?.currency_code ?? '').trim().toUpperCase();
  const preferredCurrencySource = serverPreferredCurrency || rawPreferredCurrency;
  const preferredCurrency = /^[A-Z]{3}$/.test(preferredCurrencySource) ? preferredCurrencySource : 'EUR';
  const [submitting, setSubmitting] = useState(false);
  const isEditing = Boolean(resource);
  const [form, setForm] = useState(() => ({
    name: resource?.name ?? '',
    resource_type: resource?.resource_type ?? 'material',
    category: resource?.category ?? '',
    unit: resource?.unit ?? 'm2',
    base_price: resource?.base_price ?? '',
    min_price: resource?.min_price ?? '',
    max_price: resource?.max_price ?? '',
    currency: resource?.currency ?? preferredCurrency,
    specifications: (resource?.specifications as Record<string, unknown> | null)?.description as string ?? '',
  }));

  useEffect(() => {
    if (/^[A-Z]{3}$/.test(serverPreferredCurrency) && serverPreferredCurrency !== rawPreferredCurrency) {
      setPreference('currency', serverPreferredCurrency);
      setPreference('defaultCurrency', serverPreferredCurrency);
    }
  }, [rawPreferredCurrency, serverPreferredCurrency, setPreference]);

  useEffect(() => {
    if (resource) return;
    setForm((prev) => {
      if (prev.currency === preferredCurrency) return prev;
      if (prev.currency !== rawPreferredCurrency && prev.currency !== 'EUR') return prev;
      return { ...prev, currency: preferredCurrency };
    });
  }, [preferredCurrency, rawPreferredCurrency, resource]);
  const specsObj = (resource?.specifications ?? {}) as Record<string, unknown>;
  const [images, setImages] = useState<{ name: string; dataUrl: string }[]>(
    (specsObj.images as { name: string; dataUrl: string }[]) ?? []
  );
  const [datasheets, setDatasheets] = useState<{ name: string; dataUrl: string }[]>(
    (specsObj.datasheets as { name: string; dataUrl: string }[]) ?? []
  );
  type NumericInput = number | '';
  const [wastePct, setWastePct] = useState<NumericInput>(
    (specsObj.waste_pct as number | undefined) ?? ''
  );
  const [laborRole, setLaborRole] = useState<string>(
    (specsObj.labor_role as string) ?? ''
  );
  const [dailyWage, setDailyWage] = useState<NumericInput>(
    (specsObj.daily_wage as number | undefined) ?? ''
  );
  const [burdenPct, setBurdenPct] = useState<NumericInput>(
    (specsObj.burden_pct as number | undefined) ?? ''
  );
  const [fuelCostPerHour, setFuelCostPerHour] = useState<NumericInput>(
    (specsObj.fuel_cost_per_hour as number | undefined) ?? ''
  );
  const [acquisitionValue, setAcquisitionValue] = useState<NumericInput>(
    (specsObj.acquisition_value as number | undefined) ?? ''
  );
  const [usefulLifeYears, setUsefulLifeYears] = useState<NumericInput>(
    (specsObj.useful_life_years as number | undefined) ?? ''
  );
  const [maintenancePct, setMaintenancePct] = useState<NumericInput>(
    (specsObj.maintenance_pct as number | undefined) ?? ''
  );
  const [currencyQuery, setCurrencyQuery] = useState('');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const currencyRef = useRef<HTMLDivElement>(null);
  const currencyInputRef = useRef<HTMLInputElement>(null);
  const [unitQuery, setUnitQuery] = useState('');
  const [unitOpen, setUnitOpen] = useState(false);
  const unitRef = useRef<HTMLDivElement>(null);
  const unitInputRef = useRef<HTMLInputElement>(null);

  const { data: categoryStats } = useQuery({
    queryKey: ['catalog', 'stats', 'category-picker'],
    queryFn: () => apiGet<CatalogStatsResponse>('/v1/catalog/stats/'),
    retry: false,
    staleTime: 60_000,
  });
  const { data: serverResourceTypes } = useQuery({
    queryKey: ['catalog', 'resource-types'],
    queryFn: () => apiGet<ResourceTypeApiResource[]>('/v1/catalog/resource-types/'),
    retry: false,
    staleTime: 60_000,
  });
  const [customResourceTypes, setCustomResourceTypes] = useState<ResourceTypeOption[]>(() =>
    readStoredResourceTypes(),
  );
  useEffect(() => {
    if (!serverResourceTypes?.length) return;
    const next = serverResourceTypes.map(resourceTypeFromApi);
    setCustomResourceTypes(next);
    writeStoredResourceTypes(next);
  }, [serverResourceTypes]);
  const resourceTypeOptions = useMemo(() => {
    const byValue = new Map<string, ResourceTypeOption>(
      getCatalogResourceTypes(customResourceTypes).map((type) => [type.value, type]),
    );
    if (form.resource_type && !byValue.has(form.resource_type)) {
      byValue.set(form.resource_type, {
        value: form.resource_type,
        code: '99',
        name: form.resource_type,
        calculationGroup: 'generic',
        badge: 'OT',
      });
    }
    return Array.from(byValue.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [customResourceTypes, form.resource_type]);
  const resourceTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const stat of categoryStats?.by_type ?? []) {
      counts[stat.resource_type] = stat.count;
    }
    return counts;
  }, [categoryStats?.by_type]);
  const selectedResourceType = resourceTypeOptions.find((type) => type.value === form.resource_type);
  const persistCustomResourceTypes = useCallback((next: ResourceTypeOption[]) => {
    setCustomResourceTypes(next);
    writeStoredResourceTypes(next);
  }, []);
  const [customCategories, setCustomCategories] = useState<string[]>(() =>
    readStoredCustomCategories(),
  );
  const [categoryCodes, setCategoryCodes] = useState<Record<string, string>>(() =>
    readStoredCategoryCodes(),
  );
  const assignCategoryCode = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return '';
    const existing = categoryCodes[trimmed];
    if (existing) return existing;
    const used = new Set(Object.values(categoryCodes));
    let nextCode = '01';
    for (let i = 1; i <= 99; i += 1) {
      const candidate = String(i).padStart(2, '0');
      if (!used.has(candidate)) {
        nextCode = candidate;
        break;
      }
    }
    const next = { ...categoryCodes, [trimmed]: nextCode };
    setCategoryCodes(next);
    writeStoredCategoryCodes(next);
    return nextCode;
  }, [categoryCodes]);
  // Category codes derived server-side from the resources' resource_code
  // (positions 3-4). Only keep well-formed 2-digit values. This is what lets
  // an imported region (e.g. PE_LIMA) show every category with its real code
  // without the user having any localStorage map.
  const serverCategoryCodes = useMemo(() => {
    const map: Record<string, string> = {};
    for (const stat of categoryStats?.by_category ?? []) {
      if (stat.category && stat.code && /^\d{2}$/.test(stat.code)) {
        map[stat.category] = stat.code;
      }
    }
    return map;
  }, [categoryStats?.by_category]);
  // Seed any data-derived codes the user doesn't already have, so the form's
  // prefix/sequence logic and the combobox stay consistent and persist.
  useEffect(() => {
    const entries = Object.entries(serverCategoryCodes);
    if (entries.length === 0) return;
    setCategoryCodes((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [cat, code] of entries) {
        if (!next[cat]) {
          next[cat] = code;
          changed = true;
        }
      }
      if (changed) writeStoredCategoryCodes(next);
      return changed ? next : prev;
    });
  }, [serverCategoryCodes]);
  const categoryOptions = (() => {
    const byName = new Map<string, number>();
    for (const stat of categoryStats?.by_category ?? []) {
      if (stat.category) byName.set(stat.category, stat.count);
    }
    for (const cat of customCategories) {
      if (cat && !byName.has(cat)) byName.set(cat, 0);
    }
    if (form.category && !byName.has(form.category)) {
      byName.set(form.category, 0);
    }
    return Array.from(byName.entries())
      .map(([category, count], index) => ({
        category,
        count,
        code:
          categoryCodes[category] ??
          serverCategoryCodes[category] ??
          String(index + 1).padStart(2, '0'),
      }))
      .sort((a, b) => a.category.localeCompare(b.category));
  })();
  const selectedCategoryCode =
    form.category.trim()
      ? categoryOptions.find((cat) => cat.category === form.category)?.code ?? '--'
      : '--';
  const codePrefix =
    selectedResourceType?.code && selectedCategoryCode !== '--'
      ? `${selectedResourceType.code}${selectedCategoryCode}`
      : '';
  const { data: sequenceData } = useQuery({
    queryKey: ['catalog', 'resource-sequence', codePrefix, form.resource_type, form.category],
    queryFn: () =>
      apiGet<CatalogSearchResponse>(
        `/v1/catalog/?resource_type=${encodeURIComponent(form.resource_type)}&category=${encodeURIComponent(form.category)}&region=CUSTOM&limit=100`,
      ),
    enabled: !resource && Boolean(codePrefix && form.resource_type && form.category.trim()),
    retry: false,
    staleTime: 10_000,
  });
  const maxExistingSequence = useMemo(() => {
    if (!codePrefix) return 0;
    return Math.max(
      0,
      ...(sequenceData?.items ?? [])
        .map((item) => item.resource_code)
        .filter((code) => code.startsWith(codePrefix))
        .map((code) => Number(code.slice(codePrefix.length)))
        .filter((seq) => Number.isInteger(seq) && seq > 0),
    );
  }, [codePrefix, sequenceData?.items]);
  const nextSequence = resource
    ? resource.resource_code.slice(-6)
    : String(maxExistingSequence + 1).padStart(6, '0');
  const generatedResourceCode = resource?.resource_code || (codePrefix ? `${codePrefix}${nextSequence}` : '----000001');

  const rememberCustomCategory = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCustomCategories((prev) => {
      if (prev.some((cat) => cat.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }
      const next = [...prev, trimmed];
      writeStoredCustomCategories(next);
      assignCategoryCode(trimmed);
      return next;
    });
  }, [assignCategoryCode]);

  const forgetCustomCategory = useCallback((name: string) => {
    setCustomCategories((prev) => {
      const next = prev.filter((cat) => cat !== name);
      writeStoredCustomCategories(next);
      setCategoryCodes((prevCodes) => {
        const rest = { ...prevCodes };
        delete rest[name];
        writeStoredCategoryCodes(rest);
        return rest;
      });
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) {
        setCurrencyOpen(false);
      }
      if (unitRef.current && !unitRef.current.contains(e.target as Node)) {
        setUnitOpen(false);
      }
    };
    if (currencyOpen || unitOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [currencyOpen, unitOpen]);

  // Auto-calculate HH cost when daily wage + burden change
  useEffect(() => {
    if ((form.resource_type === 'labor' || form.resource_type === 'operator') && Number(dailyWage) > 0 && Number(burdenPct) > 0) {
      const hh = (Number(dailyWage) / 8 * (1 + Number(burdenPct) / 100)).toFixed(4);
      setForm(prev => ({
        ...prev,
        base_price: hh,
        min_price: !prev.min_price || prev.min_price === prev.base_price ? hh : prev.min_price,
        max_price: !prev.max_price || prev.max_price === prev.base_price ? hh : prev.max_price,
      }));
    }
  }, [dailyWage, burdenPct, form.resource_type]);

  const handleFileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleAddImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      addToast({ type: 'error', title: t('common.error'), message: t('catalog.image_too_large', { defaultValue: 'Image must be under 2 MB' }) });
      return;
    }
    try {
      const dataUrl = await handleFileToBase64(file);
      setImages(prev => [...prev, { name: file.name, dataUrl }]);
    } catch {
      addToast({ type: 'error', title: t('common.error'), message: 'Failed to read image' });
    }
    e.target.value = '';
  };

  const handleAddDatasheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      addToast({ type: 'error', title: t('common.error'), message: t('catalog.file_too_large', { defaultValue: 'File must be under 5 MB' }) });
      return;
    }
    try {
      const dataUrl = await handleFileToBase64(file);
      setDatasheets(prev => [...prev, { name: file.name, dataUrl }]);
    } catch {
      addToast({ type: 'error', title: t('common.error'), message: 'Failed to read file' });
    }
    e.target.value = '';
  };

  // ISO 4217 currency codes - includes all Latin American currencies
  const CURRENCIES = [
    { value: 'EUR', label: 'EUR - Unión Europea' },
    { value: 'USD', label: 'USD - Estados Unidos' },
    { value: 'GBP', label: 'GBP - Reino Unido' },
    { value: 'CHF', label: 'CHF - Suiza' },
    { value: 'CAD', label: 'CAD - Canadá' },
    { value: 'AUD', label: 'AUD - Australia' },
    { value: 'AED', label: 'AED - Emiratos Árabes Unidos' },
    { value: 'RUB', label: 'RUB - Rusia' },
    { value: 'CNY', label: 'CNY - China' },
    { value: 'INR', label: 'INR - India' },
    { value: 'BRL', label: 'BRL - Brasil' },
    { value: 'ARS', label: 'ARS - Argentina' },
    { value: 'BOB', label: 'BOB - Bolivia' },
    { value: 'CLP', label: 'CLP - Chile' },
    { value: 'COP', label: 'COP - Colombia' },
    { value: 'CRC', label: 'CRC - Costa Rica' },
    { value: 'MXN', label: 'MXN - México' },
    { value: 'PEN', label: 'PEN - Perú' },
    { value: 'UYU', label: 'UYU - Uruguay' },
  ];
  const unitOptions = UNIT_KEYS.includes(form.unit) ? UNIT_KEYS : [form.unit, ...UNIT_KEYS];
  const currencyOptions = CURRENCIES.some((c) => c.value === form.currency)
    ? CURRENCIES
    : [{ value: form.currency, label: form.currency }, ...CURRENCIES];
  const filteredCurrencies = currencyOptions.filter(
    (c) => !currencyQuery || c.label.toLowerCase().includes(currencyQuery.toLowerCase()) || c.value.toLowerCase().includes(currencyQuery.toLowerCase())
  );
  const selectedCurrency = currencyOptions.find((c) => c.value === form.currency);
  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        resource_type: form.resource_type,
        category: form.category.trim() || 'Custom',
        unit: form.unit,
        base_price: parseFloat(form.base_price) || 0,
        min_price: parseFloat(form.min_price) || parseFloat(form.base_price) || 0,
        max_price: parseFloat(form.max_price) || parseFloat(form.base_price) || 0,
        currency: form.currency,
        specifications: {
          ...(resource?.specifications ?? {}),
          description: form.specifications.trim(),
          images,
          datasheets,
          resource_type_code: selectedResourceType?.code,
          resource_type_name: selectedResourceType?.name,
          resource_type_badge: selectedResourceType?.badge,
          calculation_group: selectedResourceType?.calculationGroup ?? selectedResourceType?.value,
          ...(wastePct !== '' && wastePct !== null && wastePct !== undefined ? { waste_pct: Number(wastePct) } : {}),
          ...(laborRole ? { labor_role: laborRole } : {}),
          ...(dailyWage !== '' && dailyWage !== null && dailyWage !== undefined ? { daily_wage: Number(dailyWage) } : {}),
          ...(burdenPct !== '' && burdenPct !== null && burdenPct !== undefined ? { burden_pct: Number(burdenPct) } : {}),
          ...(fuelCostPerHour !== '' && fuelCostPerHour !== null && fuelCostPerHour !== undefined ? { fuel_cost_per_hour: Number(fuelCostPerHour) } : {}),
          ...(acquisitionValue !== '' && acquisitionValue !== null && acquisitionValue !== undefined ? { acquisition_value: Number(acquisitionValue) } : {}),
          ...(usefulLifeYears !== '' && usefulLifeYears !== null && usefulLifeYears !== undefined ? { useful_life_years: Number(usefulLifeYears) } : {}),
          ...(maintenancePct !== '' && maintenancePct !== null && maintenancePct !== undefined ? { maintenance_pct: Number(maintenancePct) } : {}),
        },
        metadata: {
          ...(resource?.metadata_ ?? {}),
          resource_type_code: selectedResourceType?.code,
          resource_type_name: selectedResourceType?.name,
          resource_type_badge: selectedResourceType?.badge,
          calculation_group: selectedResourceType?.calculationGroup ?? selectedResourceType?.value,
        },
      };
      if (resource) {
        await apiPatch(`/v1/catalog/${resource.id}`, payload);
      } else {
        await apiPost('/v1/catalog/', {
        resource_code: generatedResourceCode,
        ...payload,
        usage_count: 0,
        source: 'manual',
        region: 'CUSTOM',
        });
      }
      addToast({
        type: 'success',
        title: isEditing
          ? t('catalog.resource_updated', { defaultValue: 'Resource updated' })
          : t('catalog.resource_created', { defaultValue: 'Resource created' }),
      });
      onSaved({
        category: String(payload.category),
        region: resource?.region ?? 'CUSTOM',
      });
    } catch (err) {
      addToast({ type: 'error', title: t('common.error'), message: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setSubmitting(false);
    }
  }, [form, resource, isEditing, addToast, t, onSaved, images, datasheets, selectedResourceType, generatedResourceCode, wastePct, laborRole, dailyWage, burdenPct, fuelCostPerHour, acquisitionValue, usefulLifeYears, maintenancePct]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-create-resource-title"
        className="bg-surface-elevated rounded-2xl border border-border shadow-2xl w-full max-w-md mx-4 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light">
          <div>
            <h2 id="catalog-create-resource-title" className="text-base font-semibold text-content-primary">
              {isEditing
                ? t('catalog.edit_resource', { defaultValue: 'Edit Resource' })
                : t('catalog.create_resource', { defaultValue: 'Add Custom Resource' })}
            </h2>
            <p className="text-xs text-content-tertiary">
              {isEditing
                ? t('catalog.edit_resource_desc', {
                    defaultValue: 'Update catalog data and linked assembly components',
                  })
                : t('catalog.create_resource_desc', { defaultValue: 'Create a new resource for your catalog' })}
            </p>
          </div>
          <button onClick={onClose} aria-label={t('common.close', { defaultValue: 'Close' })} className="flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary hover:bg-surface-secondary">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-content-secondary mb-1 block">
              {t('catalog.resource_code_label', { defaultValue: 'Resource code' })}
            </label>
            <div className="rounded-lg border border-border-light bg-surface-secondary/50 px-3 py-2 text-center">
              <div className="font-mono text-base font-semibold text-content-primary">
                {generatedResourceCode}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-content-secondary mb-1 block">
              {t('catalog.name', { defaultValue: 'Name' })} *
            </label>
            <input
              autoFocus type="text" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('catalog.resource_name_placeholder', { defaultValue: 'e.g. Reinforced concrete C30/37' })}
              className="h-9 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-oe-blue"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-content-secondary mb-1 block">{t('catalog.type_label', { defaultValue: 'Type' })}</label>
            <ResourceTypeCombobox
              value={form.resource_type}
              onChange={(type) => setForm({ ...form, resource_type: type })}
              options={resourceTypeOptions}
              counts={resourceTypeCounts}
              onCreate={async (option) => {
                  try {
                    const created = await apiPost<ResourceTypeApiResource>(
                      '/v1/catalog/resource-types/',
                      resourceTypeToApiPayload(option),
                    );
                    const nextType = resourceTypeFromApi(created);
                    persistCustomResourceTypes([...customResourceTypes, nextType]);
                    queryClient.invalidateQueries({ queryKey: ['catalog', 'resource-types'] });
                    addToast({
                      type: 'success',
                      title: `Tipo creado: ${nextType.code} ${nextType.name}`,
                    });
                  } catch (err) {
                    addToast({
                      type: 'error',
                      title: 'No se pudo crear el tipo',
                      message: err instanceof Error ? err.message : 'Failed',
                    });
                    throw err;
                  }
              }}
              onRename={async (value, patch) => {
                  try {
                    const updated = await apiPatch<ResourceTypeApiResource>(
                      `/v1/catalog/resource-types/${encodeURIComponent(value)}`,
                      {
                        code: patch.code,
                        name: patch.name,
                      },
                    );
                    const nextType = resourceTypeFromApi(updated);
                    const next = customResourceTypes.map((type) =>
                      type.value === value ? { ...type, ...nextType } : type,
                    );
                    persistCustomResourceTypes(next);
                    queryClient.invalidateQueries({ queryKey: ['catalog', 'resource-types'] });
                    addToast({
                      type: 'success',
                      title: `Tipo actualizado: ${nextType.code} ${nextType.name}`,
                    });
                  } catch (err) {
                    addToast({
                      type: 'error',
                      title: 'No se pudo actualizar el tipo',
                      message: err instanceof Error ? err.message : 'Failed',
                    });
                    throw err;
                  }
              }}
              onDelete={async (value) => {
                const current = resourceTypeOptions.find((type) => type.value === value);
                  try {
                    await apiDelete(`/v1/catalog/resource-types/${encodeURIComponent(value)}`);
                    const next = customResourceTypes.filter((type) => type.value !== value);
                    persistCustomResourceTypes(next);
                    queryClient.invalidateQueries({ queryKey: ['catalog', 'resource-types'] });
                    addToast({
                      type: 'success',
                      title: current ? `Tipo eliminado: ${current.code} ${current.name}` : 'Tipo eliminado',
                    });
                  } catch (err) {
                    addToast({
                      type: 'error',
                      title: 'No se pudo eliminar el tipo',
                      message: err instanceof Error ? err.message : 'Failed',
                    });
                    throw err;
                  }
              }}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-content-secondary mb-1 block">{t('catalog.category', { defaultValue: 'Category' })}</label>
              <CategoryCombobox
                value={form.category}
                onChange={(cat) => {
                  setForm({ ...form, category: cat });
                  rememberCustomCategory(cat);
                  assignCategoryCode(cat);
                }}
                categories={categoryOptions}
                onRename={async (oldName, newName) => {
                  const existingCount = categoryOptions.find((c) => c.category === oldName)?.count ?? 0;
                  if (existingCount > 0) {
                  await apiPut('/v1/catalog/categories/rename', {
                    old_name: oldName,
                    new_name: newName,
                  });
                  }
                  forgetCustomCategory(oldName);
                  rememberCustomCategory(newName);
                  setCategoryCodes((prevCodes) => {
                    const oldCode = prevCodes[oldName] ?? categoryOptions.find((c) => c.category === oldName)?.code;
                    const rest = { ...prevCodes };
                    delete rest[oldName];
                    const next = oldCode ? { ...rest, [newName]: oldCode } : rest;
                    writeStoredCategoryCodes(next);
                    return next;
                  });
                  queryClient.invalidateQueries({ queryKey: ['catalog'] });
                  addToast({
                    type: 'success',
                    title: `Categoría renombrada: ${oldName} → ${newName}`,
                  });
                }}
                onDelete={async (name) => {
                  const existingCount = categoryOptions.find((c) => c.category === name)?.count ?? 0;
                  if (existingCount > 0) {
                  await apiDelete(`/v1/catalog/categories/${encodeURIComponent(name)}?reassign_to=Custom`);
                  }
                  forgetCustomCategory(name);
                  queryClient.invalidateQueries({ queryKey: ['catalog'] });
                  if (form.category === name) {
                    setForm({ ...form, category: '' });
                  }
                  addToast({
                    type: 'success',
                    title: `Categoría eliminada: ${name}`,
                  });
                }}
                placeholder={t('catalog.category_placeholder', { defaultValue: 'e.g. Concrete & Cement' })}
              />
          </div>

          {/* Waste % — only for materials */}
          {form.resource_type === 'material' && (
            <div>
              <label className="text-xs font-medium text-content-secondary mb-1 block">
                % Desperdicio
              </label>
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                {[0, 3, 5, 8, 10, 15].map(pct => (
                  <button key={pct} type="button"
                    onClick={() => setWastePct(pct)}
                    className={`px-2 py-0.5 rounded-md text-2xs font-medium transition-colors ${
                      wastePct === pct
                        ? 'bg-oe-blue text-white'
                        : 'bg-surface-secondary text-content-secondary hover:bg-surface-tertiary'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="number" min="0" max="100" step="0.5"
                  value={wastePct === '' || wastePct === null || wastePct === undefined ? '' : wastePct}
                  onChange={(e) => setWastePct(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Personalizado"
                  className="h-8 w-20 rounded-lg border border-border bg-surface-primary px-2 text-xs text-right focus:outline-none focus:ring-2 focus:ring-oe-blue"
                />
                <span className="text-xs text-content-tertiary">%</span>
              </div>
            </div>
          )}

          {/* Labor fields — only for labor & operator */}
          {(form.resource_type === 'labor' || form.resource_type === 'operator') && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-content-secondary mb-1 block">Rol</label>
                <select value={laborRole} onChange={(e) => setLaborRole(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-surface-primary px-2 text-sm focus:outline-none focus:ring-2 focus:ring-oe-blue">
                  <option value="">Seleccionar...</option>
                  <option value="capataz">Capataz</option>
                  <option value="operario">Operario</option>
                  <option value="oficial">Oficial</option>
                  <option value="peon">Peón</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-content-secondary mb-1 block">Jornal diario (S/)</label>
                  <input type="number" step="0.01" min="0"
                    value={dailyWage === '' || dailyWage === null || dailyWage === undefined ? '' : dailyWage}
                    onChange={(e) => setDailyWage(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="65.00"
                    className="h-9 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-oe-blue"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-content-secondary mb-1 block">
                    Beneficios sociales (%)
                  </label>
                  <input type="number" step="0.5" min="0" max="200"
                    value={burdenPct === '' || burdenPct === null || burdenPct === undefined ? '' : burdenPct}
                    onChange={(e) => setBurdenPct(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="72.5"
                    className="h-9 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-oe-blue"
                  />
                </div>
              </div>
              {Number(dailyWage) > 0 && Number(burdenPct) > 0 && (
                <div className="rounded-lg bg-surface-secondary/50 px-3 py-2 text-xs text-content-secondary">
                  Costo HH estimado:{' '}
                  <span className="font-semibold text-content-primary">
                    {(Number(dailyWage) / 8 * (1 + Number(burdenPct) / 100)).toFixed(2)} {form.currency}/HH
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Equipment fields — CAPECO: fuel/hour, acquisition, useful life, maintenance */}
          {form.resource_type === 'equipment' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-content-secondary mb-1 block">
                    Combustible / hora (S/)
                  </label>
                  <input type="number" step="0.01" min="0"
                    value={fuelCostPerHour === '' || fuelCostPerHour === null || fuelCostPerHour === undefined ? '' : fuelCostPerHour}
                    onChange={(e) => setFuelCostPerHour(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="12.50"
                    className="h-9 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-oe-blue"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-content-secondary mb-1 block">
                    Valor adquisición (S/)
                  </label>
                  <input type="number" step="0.01" min="0"
                    value={acquisitionValue === '' || acquisitionValue === null || acquisitionValue === undefined ? '' : acquisitionValue}
                    onChange={(e) => setAcquisitionValue(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="45000.00"
                    className="h-9 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-oe-blue"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-content-secondary mb-1 block">
                    Vida útil (años)
                  </label>
                  <input type="number" step="0.5" min="0"
                    value={usefulLifeYears === '' || usefulLifeYears === null || usefulLifeYears === undefined ? '' : usefulLifeYears}
                    onChange={(e) => setUsefulLifeYears(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="5"
                    className="h-9 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-oe-blue"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-content-secondary mb-1 block">
                    Mantenimiento (%)
                  </label>
                  <input type="number" step="0.5" min="0" max="100"
                    value={maintenancePct === '' || maintenancePct === null || maintenancePct === undefined ? '' : maintenancePct}
                    onChange={(e) => setMaintenancePct(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="5"
                    className="h-9 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-oe-blue"
                  />
                </div>
              </div>
            </div>
          )}

          {resource && form.currency !== resource.currency && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-2xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/10 dark:text-amber-300">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {t('catalog.currency_edit_warning', {
                  defaultValue:
                    'Currency can only change when this resource is not used by an assembly.',
                })}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div ref={unitRef}>
              <label className="text-xs font-medium text-content-secondary mb-1 block">{t('boq.unit', { defaultValue: 'Unit' })}</label>
              <div className={`relative ${unitOpen ? 'z-[100]' : ''}`}>
                <div
                  className="flex items-center gap-2 h-9 w-full rounded-lg border border-border bg-surface-primary px-2 text-sm cursor-pointer focus:outline-none"
                  onClick={() => { setUnitOpen(true); unitInputRef.current?.focus(); }}
                >
                  <Search size={14} className="shrink-0 text-content-quaternary" />
                  <input
                    ref={unitInputRef}
                    type="text"
                    value={unitOpen ? unitQuery : `${unitSymbol(form.unit)} (${getUnitLabel(form.unit, t)})`}
                    onChange={(e) => { setUnitQuery(e.target.value); setUnitOpen(true); }}
                    onFocus={() => setUnitOpen(true)}
                    placeholder="Buscar unidad..."
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0"
                  />
                  <ChevronDown size={14} className={`shrink-0 text-content-quaternary transition-transform ${unitOpen ? 'rotate-180' : ''}`} />
                </div>
                {unitOpen && (() => {
                  const filtered = unitOptions.filter(u => !unitQuery ||
                    getUnitLabel(u, t).toLowerCase().includes(unitQuery.toLowerCase()) ||
                    unitSymbol(u).toLowerCase().includes(unitQuery.toLowerCase()) ||
                    u.toLowerCase().includes(unitQuery.toLowerCase())
                  );
                  return (
                    <div className="absolute z-[9999] mt-1 w-full rounded-lg border border-border-light bg-surface-elevated shadow-lg max-h-48 overflow-y-auto">
                      {filtered.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-content-tertiary text-center">Sin resultados</div>
                      ) : (
                        filtered.map((u) => (
                          <div
                            key={u}
                            onClick={() => { setForm({ ...form, unit: u }); setUnitOpen(false); setUnitQuery(''); }}
                            className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-oe-blue/10 ${u === form.unit ? 'bg-oe-blue/5' : ''}`}
                          >
                            <span className="font-mono text-2xs text-content-quaternary w-10 shrink-0">{unitSymbol(u)}</span>
                            <span className="text-content-primary truncate">{getUnitLabel(u, t)}</span>
                            {u === form.unit && <Check size={14} className="ml-auto shrink-0 text-oe-blue" />}
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            <div ref={currencyRef}>
              <label className="text-xs font-medium text-content-secondary mb-1 block">{t('catalog.currency', { defaultValue: 'Currency' })}</label>
              <div className={`relative ${currencyOpen ? 'z-[100]' : ''}`}>
                <div
                  className="flex items-center gap-2 h-9 w-full rounded-lg border border-border bg-surface-primary px-2 text-sm cursor-pointer focus:outline-none"
                  onClick={() => { setCurrencyOpen(true); currencyInputRef.current?.focus(); }}
                >
                  <Search size={14} className="shrink-0 text-content-quaternary" />
                  <input
                    id="catalog-resource-currency-search"
                    ref={currencyInputRef}
                    type="text"
                    data-allytip="false"
                    value={currencyOpen ? currencyQuery : (selectedCurrency?.label ?? form.currency)}
                    onChange={(e) => { setCurrencyQuery(e.target.value); setCurrencyOpen(true); }}
                    onFocus={() => setCurrencyOpen(true)}
                    placeholder="Buscar moneda..."
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0"
                  />
                  <ChevronDown size={14} className={`shrink-0 text-content-quaternary transition-transform ${currencyOpen ? 'rotate-180' : ''}`} />
                </div>
                {currencyOpen && (
                  <div className="absolute z-[9999] mt-1 w-full rounded-lg border border-border-light bg-surface-elevated shadow-lg max-h-48 overflow-y-auto">
                    {filteredCurrencies.length === 0 ? (
                      <div className="px-3 py-4 text-xs text-content-tertiary text-center">
                        Sin resultados
                      </div>
                    ) : (
                      filteredCurrencies.map((c) => (
                        <div
                          key={c.value}
                          onClick={() => {
                            setForm({ ...form, currency: c.value });
                            setCurrencyOpen(false);
                            setCurrencyQuery('');
                          }}
                          className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-oe-blue/10 ${c.value === form.currency ? 'bg-oe-blue/5' : ''}`}
                        >
                          <span className="font-mono text-2xs text-content-quaternary w-10 shrink-0">{c.value}</span>
                          <span className="text-content-primary truncate">{c.label}</span>
                          {c.value === form.currency && <Check size={14} className="ml-auto shrink-0 text-oe-blue" />}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-content-secondary mb-1 block">{t('catalog.price', { defaultValue: 'Price' })}</label>
              <input type="number" step="0.01" value={form.base_price}
                onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                placeholder="0.00"
                className="h-9 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-oe-blue"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-content-secondary mb-1 block">{t('catalog.min_price', { defaultValue: 'Min Price' })}</label>
              <input type="number" step="0.01" value={form.min_price}
                onChange={(e) => setForm({ ...form, min_price: e.target.value })}
                placeholder={form.base_price || "0.00"}
                className="h-9 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-oe-blue"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-content-secondary mb-1 block">{t('catalog.max_price', { defaultValue: 'Max Price' })}</label>
              <input type="number" step="0.01" value={form.max_price}
                onChange={(e) => setForm({ ...form, max_price: e.target.value })}
                placeholder={form.base_price || "0.00"}
                className="h-9 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm text-right focus:outline-none focus:ring-2 focus:ring-oe-blue"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-content-secondary mb-1 block">
              {t('catalog.specifications', { defaultValue: 'Specifications' })}
            </label>
            <textarea
              value={form.specifications}
              onChange={(e) => setForm({ ...form, specifications: e.target.value })}
              placeholder={t('catalog.specifications_placeholder', { defaultValue: 'Technical specs, brand, model, standards...' })}
              rows={4}
              className="w-full rounded-lg border border-border bg-surface-primary px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-oe-blue"
            />
          </div>

          {/* Images */}
          <div>
            <label className="text-xs font-medium text-content-secondary mb-1 block">Imágenes</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {images.map((img, i) => (
                <div key={i} className="relative group">
                  <img src={img.dataUrl} alt={img.name} className="h-16 w-16 rounded-lg border border-border object-cover" />
                  <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-semantic-error text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
            <input type="file" accept="image/*" onChange={handleAddImage}
              className="block w-full text-xs text-content-secondary file:mr-3 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-surface-secondary file:text-content-primary hover:file:bg-surface-tertiary"
            />
          </div>

          {/* Datasheets */}
          <div>
            <label className="text-xs font-medium text-content-secondary mb-1 block">Fichas técnicas</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {datasheets.map((ds, i) => (
                <div key={i} className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-primary px-2 py-1 text-xs">
                  <span className="text-content-secondary max-w-[140px] truncate">{ds.name}</span>
                  <button onClick={() => setDatasheets(prev => prev.filter((_, j) => j !== i))}
                    className="text-content-tertiary hover:text-semantic-error"><X size={12} /></button>
                </div>
              ))}
            </div>
            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={handleAddDatasheet}
              className="block w-full text-xs text-content-secondary file:mr-3 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-surface-secondary file:text-content-primary hover:file:bg-surface-tertiary"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border-light bg-surface-secondary/30">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button variant="primary" size="sm" disabled={!form.name.trim() || submitting}
            icon={submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            onClick={handleSubmit}>
            {submitting
              ? t('catalog.creating', { defaultValue: 'Creating...' })
              : isEditing
                ? t('common.save_changes', { defaultValue: 'Save changes' })
                : t('catalog.create_resource_btn', { defaultValue: 'Create Resource' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
