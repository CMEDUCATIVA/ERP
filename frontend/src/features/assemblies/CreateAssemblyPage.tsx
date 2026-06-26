import { useState, useEffect, useRef, useMemo, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { X, Layers, Search, ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';
import { Button, Input } from '@/shared/ui';
import { useToastStore } from '@/stores/useToastStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { apiGet } from '@/shared/lib/api';
import { assembliesApi, type CreateAssemblyData } from './api';

/* -- Constants ------------------------------------------------------------ */

// CAPECO 16 classes — official Peruvian construction classification
// (Reglamento de Metrados para Obras de Edificación, D.S. 013-79-VC).
const CATEGORIES = [
  { value: '01_obras_provisionales',   code: '01', label: 'Obras Provisionales, Trabajos Preliminares' },
  { value: '02_movimiento_tierras',    code: '02', label: 'Movimiento de Tierras' },
  { value: '03_concreto_simple',       code: '03', label: 'Concreto Simple' },
  { value: '04_concreto_armado',       code: '04', label: 'Obras de Concreto Armado' },
  { value: '05_albanileria',           code: '05', label: 'Albañilería' },
  { value: '06_revoques_enlucidos',    code: '06', label: 'Revoques, Enlucidos y Molduras' },
  { value: '07_pisos_pavimentos',      code: '07', label: 'Pisos y Pavimentos' },
  { value: '08_coberturas',            code: '08', label: 'Coberturas' },
  { value: '09_carpinteria_madera',    code: '09', label: 'Carpintería de Madera' },
  { value: '10_carpinteria_metalica',  code: '10', label: 'Carpintería Metálica' },
  { value: '11_cerrajeria',            code: '11', label: 'Cerrajería' },
  { value: '12_vidrios_cristales',     code: '12', label: 'Vidrios, Cristales y Similares' },
  { value: '13_pintura',               code: '13', label: 'Pintura' },
  { value: '14_inst_sanitarias',       code: '14', label: 'Instalaciones Sanitarias' },
  { value: '15_inst_electricas',       code: '15', label: 'Instalaciones Eléctricas' },
  { value: '16_obras_complementarias', code: '16', label: 'Obras Complementarias' },
];

// CAPECO partida-level units only (Reglamento de Metrados D.S. 013-79-VC).
// Resource-level units (HH, HM, bol, gal, kWh, etc.) belong in the catalogue,
// not as the output unit of an assembly / BOQ line item.
const UNITS = [
  { value: 'm2',  symbol: 'M2',  label: 'metro cuadrado' },
  { value: 'm3',  symbol: 'M3',  label: 'metro cúbico' },
  { value: 'm',   symbol: 'M',   label: 'metro lineal' },
  { value: 'kg',  symbol: 'KG',  label: 'kilogramo' },
  { value: 'und', symbol: 'UND', label: 'unidad' },
  { value: 'p2',  symbol: 'P2',  label: 'pie cuadrado' },
  { value: 'pto', symbol: 'PTO', label: 'punto' },
  { value: 'jgo', symbol: 'JGO', label: 'juego' },
  { value: 'glb', symbol: 'GLB', label: 'global' },
  { value: 'mes', symbol: 'MES', label: 'mes' },
  { value: 'dia', symbol: 'DIA', label: 'día' },
];

const CURRENCIES = [
  { value: 'EUR', label: 'EUR - Unión Europea' },
  { value: 'USD', label: 'USD - Estados Unidos' },
  { value: 'GBP', label: 'GBP - Reino Unido' },
  { value: 'CHF', label: 'CHF - Suiza' },
  { value: 'SEK', label: 'SEK - Suecia' },
  { value: 'NOK', label: 'NOK - Noruega' },
  { value: 'DKK', label: 'DKK - Dinamarca' },
  { value: 'PLN', label: 'PLN - Polonia' },
  { value: 'CZK', label: 'CZK - República Checa' },
  { value: 'CAD', label: 'CAD - Canadá' },
  { value: 'AUD', label: 'AUD - Australia' },
  { value: 'CNY', label: 'CNY - China' },
  { value: 'JPY', label: 'JPY - Japón' },
  { value: 'INR', label: 'INR - India' },
  { value: 'AED', label: 'AED - Emiratos Árabes Unidos' },
  { value: 'SAR', label: 'SAR - Arabia Saudita' },
  { value: 'BRL', label: 'BRL - Brasil' },
  { value: 'ZAR', label: 'ZAR - Sudáfrica' },
  { value: 'PEN', label: 'PEN - Perú' },
  { value: 'MXN', label: 'MXN - México' },
  { value: 'ARS', label: 'ARS - Argentina' },
  { value: 'BOB', label: 'BOB - Bolivia' },
  { value: 'CLP', label: 'CLP - Chile' },
  { value: 'COP', label: 'COP - Colombia' },
  { value: 'CRC', label: 'CRC - Costa Rica' },
  { value: 'UYU', label: 'UYU - Uruguay' },
  { value: 'PYG', label: 'PYG - Paraguay' },
];

const STANDARDS = [
  { value: 'din276', key: 'assemblies.std_din276', defaultLabel: 'DIN 276' },
  { value: 'nrm', key: 'assemblies.std_nrm', defaultLabel: 'NRM' },
  { value: 'masterformat', key: 'assemblies.std_masterformat', defaultLabel: 'MasterFormat' },
  { value: 'uniformat', key: 'assemblies.std_uniformat', defaultLabel: 'UniFormat' },
  { value: 'uniclass', key: 'assemblies.std_uniclass', defaultLabel: 'Uniclass' },
  { value: 'capeco', key: 'assemblies.std_capeco', defaultLabel: 'CAPECO (Perú)' },
];

/* -- Modal ---------------------------------------------------------------- */

interface CreateAssemblyModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateAssemblyModal({ open, onClose }: CreateAssemblyModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const setPreference = usePreferencesStore((s) => s.setPreference);
  const { data: userPrefs } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => apiGet<{ currency_code?: string | null }>('/v1/users/me/preferences/'),
    retry: false,
    staleTime: 60_000,
  });
  // Default the assembly currency to the user's preferred currency
  // (Regional Settings) instead of a hardcoded 'EUR' — a user working in
  // USD/GBP/BRL who doesn't open the dropdown would otherwise silently stamp
  // their assemblies as EUR. The field stays editable below.
  const rawPreferredCurrency = usePreferencesStore((s) => s.currency);
  const serverPreferredCurrency = (userPrefs?.currency_code ?? '').trim().toUpperCase();
  const preferredCurrencySource = serverPreferredCurrency || rawPreferredCurrency;
  const preferredCurrency = /^[A-Z]{3}$/.test(preferredCurrencySource) ? preferredCurrencySource : 'EUR';

  useEffect(() => {
    if (/^[A-Z]{3}$/.test(serverPreferredCurrency) && serverPreferredCurrency !== rawPreferredCurrency) {
      setPreference('currency', serverPreferredCurrency);
      setPreference('defaultCurrency', serverPreferredCurrency);
    }
  }, [rawPreferredCurrency, serverPreferredCurrency, setPreference]);

  // Category searchable combobox
  const [catQuery, setCatQuery] = useState('');
  const [catOpen, setCatOpen] = useState(false);
  const catRef = useRef<HTMLDivElement>(null);
  const catInputRef = useRef<HTMLInputElement>(null);
  const [currencyQuery, setCurrencyQuery] = useState('');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const currencyRef = useRef<HTMLDivElement>(null);
  const currencyInputRef = useRef<HTMLInputElement>(null);
  const [unitQuery, setUnitQuery] = useState('');
  const [unitOpen, setUnitOpen] = useState(false);
  const unitRef = useRef<HTMLDivElement>(null);
  const unitInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatOpen(false);
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node)) setCurrencyOpen(false);
      if (unitRef.current && !unitRef.current.contains(e.target as Node)) setUnitOpen(false);
    };
    if (catOpen || currencyOpen || unitOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [catOpen, currencyOpen, unitOpen]);

  const [form, setForm] = useState({
    code: '',
    name: '',
    unit: 'm2',
    category: '01_obras_provisionales',
    classificationStandard: '',
    classificationCode: '',
    currency: preferredCurrency,
    bid_factor: '1.00',
  });

  useEffect(() => {
    if (open) {
      setCatQuery('');
      setCurrencyQuery('');
      setUnitQuery('');
      setForm({
        code: '', name: '', unit: 'm2', category: '01_obras_provisionales',
        classificationStandard: '', classificationCode: '',
        currency: preferredCurrency, bid_factor: '1.00',
      });
    }
  }, [open, preferredCurrency]);

  // Merge CAPECO + custom categories from regional settings
  const customCats = usePreferencesStore((s) => s.customAssemblyCategories) || [];
  const allCats = useMemo(() => {
    const custom = customCats.map((label, i) => ({
      value: `__custom_${i}`,
      code: `${16 + i + 1}`,
      label,
      isCustom: true as const,
    }));
    return [...CATEGORIES, ...custom];
  }, [customCats]);

  const filteredCats = allCats.filter(
    (c) => !catQuery || c.label.toLowerCase().includes(catQuery.toLowerCase())
  );
  const selectedCat = allCats.find((c) => c.value === form.category);

  // Ensure the preferred currency is always an available option, even when it
  // isn't one of the common presets (e.g. KES/THB), so the dropdown reflects
  // the actual default rather than showing a different first entry.
  const currencyOptions = CURRENCIES.some((c) => c.value === preferredCurrency)
    ? CURRENCIES
    : [{ value: preferredCurrency, label: preferredCurrency }, ...CURRENCIES];
  const filteredCurrencies = currencyOptions.filter(
    (c) => !currencyQuery || c.label.toLowerCase().includes(currencyQuery.toLowerCase()) || c.value.toLowerCase().includes(currencyQuery.toLowerCase())
  );
  const selectedCurrency = currencyOptions.find((c) => c.value === form.currency);

  const filteredUnits = UNITS.filter(
    (u) => !unitQuery || u.label.toLowerCase().includes(unitQuery.toLowerCase()) || u.symbol.toLowerCase().includes(unitQuery.toLowerCase()) || u.value.toLowerCase().includes(unitQuery.toLowerCase())
  );
  const selectedUnit = UNITS.find((u) => u.value === form.unit);

  const mutation = useMutation({
    mutationFn: (data: CreateAssemblyData) => assembliesApi.create(data),
    onSuccess: (assembly) => {
      queryClient.invalidateQueries({ queryKey: ['assemblies'] });
      onClose();
      navigate(`/assemblies/${assembly.id}`);
    },
    onError: (err: Error) => {
      addToast({ type: 'error', title: t('assemblies.create_failed', { defaultValue: 'Failed to create assembly' }), message: err.message });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) return;

    const classification: Record<string, string> = {};
    if (form.classificationStandard && form.classificationCode) {
      classification[form.classificationStandard] = form.classificationCode;
    }

    mutation.mutate({
      code: form.code,
      name: form.name,
      unit: form.unit,
      category: form.category,
      classification: Object.keys(classification).length > 0 ? classification : undefined,
      currency: form.currency,
      bid_factor: parseFloat(form.bid_factor) || 1.0,
    });
  };

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const selectClass =
    'h-10 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm text-content-primary transition-all duration-fast ease-oe focus:outline-none focus:ring-2 focus:ring-oe-blue focus:border-transparent hover:border-content-tertiary cursor-pointer appearance-none';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-lg animate-fade-in"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] rounded-2xl bg-surface-elevated border border-border-light shadow-2xl animate-fade-in flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-primary/10">
              <Layers size={20} className="text-accent-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-content-primary">
                {t('assemblies.new_assembly', { defaultValue: 'New Assembly' })}
              </h2>
              <p className="text-xs text-content-tertiary">
                {t('assemblies.create_subtitle', { defaultValue: 'Create a reusable cost assembly' })}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close', { defaultValue: 'Close' })}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-content-tertiary hover:text-content-primary hover:bg-surface-hover transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 pb-6 flex-1">
          <form id="create-assembly-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Code & Name */}
            <div className="grid grid-cols-3 gap-4">
              <Input
                id="assembly-code"
                label={t('assemblies.code', { defaultValue: 'Code' })}
                value={form.code}
                onChange={(e) => set('code', e.target.value)}
                placeholder={t('assemblies.code_placeholder', { defaultValue: 'e.g. ASM-001' })}
                required aria-required="true"
                autoFocus
              />
              <div className="col-span-2">
                <Input
                  id="assembly-name"
                  label={t('assemblies.name', { defaultValue: 'Name' })}
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder={t('assemblies.name_placeholder', { defaultValue: 'e.g. Reinforced Concrete Wall C30/37' })}
                  required aria-required="true"
                />
              </div>
            </div>

            {/* Unit & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5" ref={unitRef}>
                <label className="text-sm font-medium text-content-primary">{t('assemblies.unit', { defaultValue: 'Unit' })}</label>
                <div className="relative">
                  <div
                    className="flex items-center gap-2 h-10 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm cursor-pointer focus:outline-none"
                    onClick={() => { setUnitOpen(true); unitInputRef.current?.focus(); }}
                  >
                    <Search size={14} className="shrink-0 text-content-quaternary" />
                    <input
                      id="assembly-unit-search"
                      ref={unitInputRef}
                      type="text"
                      data-allytip="false"
                      value={unitOpen ? unitQuery : (selectedUnit?.symbol ? `${selectedUnit.symbol} (${selectedUnit.label})` : form.unit)}
                      onChange={(e) => { setUnitQuery(e.target.value); setUnitOpen(true); }}
                      onFocus={() => setUnitOpen(true)}
                      placeholder="Buscar unidad..."
                      className="flex-1 border-0 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0"
                    />
                    <ChevronDown size={14} className={clsx('shrink-0 text-content-quaternary transition-transform', unitOpen && 'rotate-180')} />
                  </div>
                  {unitOpen && (
                    <div className="absolute z-20 mt-1 w-full rounded-lg border border-border-light bg-surface-elevated shadow-lg max-h-48 overflow-y-auto">
                      {filteredUnits.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-content-tertiary text-center">
                          Sin resultados
                        </div>
                      ) : (
                        filteredUnits.map((u) => (
                          <div
                            key={u.value}
                            onClick={() => { set('unit', u.value); setUnitOpen(false); setUnitQuery(''); }}
                            className={clsx(
                              'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-oe-blue/10',
                              u.value === form.unit && 'bg-oe-blue/5',
                            )}
                          >
                            <span className="font-mono text-2xs text-content-quaternary w-10 shrink-0">{u.symbol}</span>
                            <span className="text-content-primary truncate">{u.label}</span>
                            {u.value === form.unit && <Check size={14} className="ml-auto shrink-0 text-oe-blue" />}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5" ref={catRef}>
                <label className="text-sm font-medium text-content-primary">{t('assemblies.category', { defaultValue: 'Category' })}</label>
                <div className="relative">
                  <div
                    className="flex items-center gap-2 h-10 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm cursor-pointer focus:outline-none"
                    onClick={() => { setCatOpen(true); catInputRef.current?.focus(); }}
                  >
                    <Search size={14} className="shrink-0 text-content-quaternary" />
                    <input
                      id="assembly-category-search"
                      ref={catInputRef}
                      type="text"
                      data-allytip="false"
                      value={catOpen ? catQuery : (selectedCat?.label ?? 'General')}
                      onChange={(e) => { setCatQuery(e.target.value); setCatOpen(true); }}
                      onFocus={() => setCatOpen(true)}
                      placeholder="Buscar categoría..."
                      className="flex-1 border-0 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0"
                    />
                    <ChevronDown size={14} className={clsx('shrink-0 text-content-quaternary transition-transform', catOpen && 'rotate-180')} />
                  </div>
                  {catOpen && (
                    <div className="absolute z-20 mt-1 w-full rounded-lg border border-border-light bg-surface-elevated shadow-lg max-h-48 overflow-y-auto">
                      {filteredCats.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-content-tertiary text-center">
                          Sin resultados
                        </div>
                      ) : (
                        filteredCats.map((c) => (
                          <div
                            key={c.value}
                            onClick={() => { set('category', c.value); setCatOpen(false); setCatQuery(''); }}
                            className={clsx(
                              'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-oe-blue/10',
                              c.value === form.category && 'bg-oe-blue/5',
                            )}
                          >
                            <span className="font-mono text-2xs text-content-quaternary w-6 shrink-0">{c.code}</span>
                            <span className="text-content-primary truncate">{c.label}</span>
                            {c.value === form.category && <Check size={14} className="ml-auto shrink-0 text-oe-blue" />}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Classification */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-content-primary">
                  {t('assemblies.classification_standard', { defaultValue: 'Classification Standard' })}
                </label>
                <select value={form.classificationStandard} onChange={(e) => set('classificationStandard', e.target.value)} className={selectClass}>
                  <option value="">{t('assemblies.none', { defaultValue: '-- None --' })}</option>
                  {STANDARDS.map((s) => (
                    <option key={s.value} value={s.value}>{t(s.key, { defaultValue: s.defaultLabel })}</option>
                  ))}
                </select>
              </div>
              <Input
                id="assembly-classification-code"
                label={t('assemblies.classification_code', { defaultValue: 'Classification Code' })}
                value={form.classificationCode}
                onChange={(e) => set('classificationCode', e.target.value)}
                placeholder={form.classificationStandard === 'capeco' ? 'ej. 05.18.20' : t('assemblies.classification_code_placeholder', { defaultValue: 'e.g. 330' })}
                disabled={!form.classificationStandard}
              />
            </div>

            {/* CAPECO quick reference — shown when standard is selected */}
            {form.classificationStandard === 'capeco' && (
              <details className="rounded-lg border border-border-light bg-surface-secondary/30 px-4 py-2.5">
                <summary className="text-xs font-medium text-content-secondary cursor-pointer select-none">
                  Clasificación CAPECO — 16 clases
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-2xs">
                  {CATEGORIES.map((cat) => (
                    <div key={cat.value} className="flex gap-1.5">
                      <span className="font-mono font-semibold text-oe-blue shrink-0">{cat.code}</span>
                      <span className="text-content-tertiary">{cat.label}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Currency & Bid Factor */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5" ref={currencyRef}>
                <label className="text-sm font-medium text-content-primary">{t('assemblies.currency', { defaultValue: 'Currency' })}</label>
                <div className={clsx('relative', currencyOpen && 'z-[100]')}>
                  <div
                    className="flex items-center gap-2 h-10 w-full rounded-lg border border-border bg-surface-primary px-3 text-sm cursor-pointer focus:outline-none"
                    onClick={() => { setCurrencyOpen(true); currencyInputRef.current?.focus(); }}
                  >
                    <Search size={14} className="shrink-0 text-content-quaternary" />
                    <input
                      id="assembly-currency-search"
                      ref={currencyInputRef}
                      type="text"
                      data-allytip="false"
                      value={currencyOpen ? currencyQuery : (selectedCurrency?.label ?? form.currency)}
                      onChange={(e) => { setCurrencyQuery(e.target.value); setCurrencyOpen(true); }}
                      onFocus={() => setCurrencyOpen(true)}
                      placeholder="Buscar moneda..."
                      className="flex-1 border-0 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0"
                    />
                    <ChevronDown size={14} className={clsx('shrink-0 text-content-quaternary transition-transform', currencyOpen && 'rotate-180')} />
                  </div>
                  {currencyOpen && (
                    <div className="absolute bottom-full z-[9999] mb-1 w-full rounded-lg border border-border-light bg-surface-elevated shadow-lg max-h-48 overflow-y-auto">
                      {filteredCurrencies.length === 0 ? (
                        <div className="px-3 py-4 text-xs text-content-tertiary text-center">
                          Sin resultados
                        </div>
                      ) : (
                        filteredCurrencies.map((c) => (
                          <div
                            key={c.value}
                            onClick={() => { set('currency', c.value); setCurrencyOpen(false); setCurrencyQuery(''); }}
                            className={clsx(
                              'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-oe-blue/10',
                              c.value === form.currency && 'bg-oe-blue/5',
                            )}
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
              <Input
                id="assembly-bid-factor"
                label={t('assemblies.bid_factor', { defaultValue: 'Bid Factor' })}
                type="number"
                value={form.bid_factor}
                onChange={(e) => set('bid_factor', e.target.value)}
                placeholder="1.00"
                hint={t('assemblies.bid_factor_hint', { defaultValue: 'Multiplier applied to the total rate (1.00 = no markup)' })}
              />
            </div>

            {mutation.error && (
              <div className="rounded-lg bg-semantic-error-bg px-3 py-2 text-sm text-semantic-error">
                {(mutation.error as Error).message || t('assemblies.create_failed', { defaultValue: 'Failed to create assembly' })}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border-light shrink-0">
          <Button variant="secondary" type="button" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="primary" type="submit" form="create-assembly-form" loading={mutation.isPending}>
            {t('common.create', 'Create')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Route compat
export function CreateAssemblyPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/assemblies', { state: { openCreateModal: true }, replace: true });
  }, [navigate]);

  return null;
}
