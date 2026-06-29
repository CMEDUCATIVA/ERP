export interface ResourceTypeOption {
  value: string;
  code: string;
  name: string;
  protected?: boolean;
  calculationGroup?: string;
  badge?: string;
  bg?: string;
  i18nKey?: string;
  fallback?: string;
  catalogVisible?: boolean;
}

export interface ResourceTypeApiResource {
  value: string;
  code: string;
  name: string;
  calculation_group?: string;
  badge?: string;
  bg?: string;
  i18n_key?: string | null;
  fallback?: string | null;
  is_system?: boolean;
  protected?: boolean;
  is_active?: boolean;
  sort_order?: number;
  metadata?: Record<string, unknown>;
}

export const RESOURCE_TYPES_STORAGE_KEY = 'oce.catalog.resourceTypes';

export const BASE_RESOURCE_TYPES: ResourceTypeOption[] = [
  {
    value: 'labor',
    code: '01',
    name: 'Mano de Obra',
    protected: true,
    calculationGroup: 'labor',
    badge: 'MO',
    bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    i18nKey: 'boq.resource_type_labor',
    fallback: 'Labor',
    catalogVisible: true,
  },
  {
    value: 'material',
    code: '02',
    name: 'Materiales',
    protected: true,
    calculationGroup: 'material',
    badge: 'M',
    bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    i18nKey: 'boq.resource_type_material',
    fallback: 'Material',
    catalogVisible: true,
  },
  {
    value: 'equipment',
    code: '03',
    name: 'Equipos',
    protected: true,
    calculationGroup: 'equipment',
    badge: 'E',
    bg: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    i18nKey: 'boq.resource_type_equipment',
    fallback: 'Equipment',
    catalogVisible: true,
  },
  {
    value: 'operator',
    code: '04',
    name: 'Operador',
    protected: true,
    calculationGroup: 'operator',
    badge: 'O',
    bg: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    i18nKey: 'boq.resource_type_operator',
    fallback: 'Operator',
    catalogVisible: true,
  },
];

export const DEFAULT_CUSTOM_RESOURCE_TYPES: ResourceTypeOption[] = [
  {
    value: 'subcontractor',
    code: '05',
    name: 'Subcontratos',
    calculationGroup: 'subcontractor',
    badge: 'S',
    bg: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
    i18nKey: 'boq.resource_type_subcontractor',
    fallback: 'Subcontractor',
    catalogVisible: true,
  },
  {
    value: 'overhead',
    code: '06',
    name: 'Gastos Generales',
    calculationGroup: 'overhead',
    badge: 'GG',
    bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    i18nKey: 'boq.resource_type_overhead',
    fallback: 'Gastos Generales',
    catalogVisible: true,
  },
];

const normalizeCode = (value: unknown, fallback = '99') => {
  const code = String(value ?? '').replace(/\D/g, '').slice(0, 2);
  return code ? code.padStart(2, '0') : fallback;
};

const normalizeBadge = (value: string, name: string) => {
  const clean = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  if (clean) return clean;
  return name.trim().slice(0, 2).toUpperCase() || 'OT';
};

export function readStoredResourceTypes(): ResourceTypeOption[] {
  if (typeof window === 'undefined') return DEFAULT_CUSTOM_RESOURCE_TYPES;
  try {
    const raw = window.localStorage.getItem(RESOURCE_TYPES_STORAGE_KEY);
    if (!raw) return DEFAULT_CUSTOM_RESOURCE_TYPES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_CUSTOM_RESOURCE_TYPES;
    return parsed
      .map((item) => {
        const value = String(item?.value ?? '').trim().slice(0, 20);
        const name = String(item?.name ?? '').trim();
        return {
          value,
          code: normalizeCode(item?.code),
          name,
          calculationGroup: String((item?.calculationGroup ?? item?.calculation_group ?? value) || 'generic').trim(),
          badge: normalizeBadge(String(item?.badge ?? ''), name),
          bg: String(item?.bg ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'),
          i18nKey: typeof item?.i18nKey === 'string' ? item.i18nKey : undefined,
          fallback: typeof item?.fallback === 'string' ? item.fallback : name,
          catalogVisible: item?.catalogVisible !== false,
        };
      })
      .filter((item) => item.value && item.code && item.name);
  } catch {
    return DEFAULT_CUSTOM_RESOURCE_TYPES;
  }
}

export function writeStoredResourceTypes(types: ResourceTypeOption[]) {
  if (typeof window === 'undefined') return;
  const seen = new Set<string>();
  const clean = types
    .filter((type) => !type.protected)
    .filter((type) => type.catalogVisible !== false)
    .map((type) => ({
      value: type.value.trim().slice(0, 20),
      code: normalizeCode(type.code),
      name: type.name.trim(),
      calculationGroup: type.calculationGroup ?? type.value,
      badge: normalizeBadge(type.badge ?? '', type.name),
      bg: type.bg ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      i18nKey: type.i18nKey,
      fallback: type.fallback ?? type.name,
      catalogVisible: true,
    }))
    .filter((type) => {
      const key = `${type.value}:${type.code}`;
      if (!type.value || !type.code || !type.name || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.code.localeCompare(b.code));
  window.localStorage.setItem(RESOURCE_TYPES_STORAGE_KEY, JSON.stringify(clean));
}

export function getAllResourceTypes(extra: ResourceTypeOption[] = []): ResourceTypeOption[] {
  const byValue = new Map<string, ResourceTypeOption>();
  for (const type of [...BASE_RESOURCE_TYPES, ...DEFAULT_CUSTOM_RESOURCE_TYPES, ...extra]) {
    const existing = byValue.get(type.value);
    byValue.set(type.value, { ...existing, ...type });
  }
  return Array.from(byValue.values()).sort((a, b) => a.code.localeCompare(b.code));
}

export function getCatalogResourceTypes(extra: ResourceTypeOption[] = []): ResourceTypeOption[] {
  return getAllResourceTypes(extra).filter((type) => type.catalogVisible !== false);
}

export function getResourceTypeDefinition(value: string): ResourceTypeOption | undefined {
  return getAllResourceTypes(readStoredResourceTypes()).find((type) => type.value === value);
}

export function getResourceTypeLabel(
  value: string,
  t?: (key: string, opts?: Record<string, string>) => string,
): string {
  const opt = getResourceTypeDefinition(value);
  if (!opt) return value;
  if (t && opt.i18nKey) return t(opt.i18nKey, { defaultValue: opt.fallback ?? opt.name });
  return opt.fallback ?? opt.name;
}

export function getResourceTypeI18nKey(value: string): string {
  return getResourceTypeDefinition(value)?.i18nKey ?? 'boq.resource_type_other';
}

export function getResourceTypeBadge(value: string): { bg: string; label: string } {
  const opt = getResourceTypeDefinition(value) ?? getResourceTypeDefinition('other');
  return {
    bg: opt?.bg ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    label: opt?.badge ?? 'OT',
  };
}

export function resourceTypeFromApi(row: ResourceTypeApiResource): ResourceTypeOption {
  const fallback =
    row.value === 'overhead' && (!row.fallback || row.fallback === 'Overhead')
      ? row.name
      : row.fallback ?? row.name;
  return {
    value: row.value,
    code: normalizeCode(row.code),
    name: row.name,
    protected: Boolean(row.protected ?? row.is_system),
    calculationGroup: row.calculation_group ?? row.value,
    badge: normalizeBadge(row.badge ?? '', row.name),
    bg: row.bg ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    i18nKey: row.i18n_key ?? undefined,
    fallback,
    catalogVisible: true,
  };
}

export function resourceTypeToApiPayload(type: ResourceTypeOption): Record<string, unknown> {
  return {
    value: type.value,
    code: normalizeCode(type.code),
    name: type.name,
    calculation_group: type.calculationGroup ?? type.value,
    badge: normalizeBadge(type.badge ?? '', type.name),
    bg: type.bg ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    i18n_key: type.i18nKey,
    fallback: type.fallback ?? type.name,
    sort_order: Number(type.code) || 99,
    metadata: {},
  };
}
