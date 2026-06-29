import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { ResourceTypeOption } from '@/shared/lib/resourceTypes';

export interface ResourceTypeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: ResourceTypeOption[];
  counts?: Record<string, number>;
  onCreate: (option: ResourceTypeOption) => void | Promise<void>;
  onRename: (value: string, patch: Pick<ResourceTypeOption, 'code' | 'name'>) => void | Promise<void>;
  onDelete: (value: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
}

const normalizeCode = (raw: string) => raw.replace(/\D/g, '').slice(0, 2);

const slugifyTypeValue = (name: string, code: string) => {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 16);
  return slug || `type_${code}`;
};

export function ResourceTypeCombobox({
  value,
  onChange,
  options,
  counts = {},
  onCreate,
  onRename,
  onDelete,
  placeholder = 'Seleccionar tipo...',
  className = '',
}: ResourceTypeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editNameRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      `${option.code} ${option.name} ${option.value}`.toLowerCase().includes(normalizedQuery),
    );
  }, [normalizedQuery, options]);

  const exactMatch = useMemo(
    () =>
      normalizedQuery.length > 0 &&
      options.some(
        (option) =>
          option.name.toLowerCase() === normalizedQuery ||
          option.code === normalizeCode(query) ||
          option.value.toLowerCase() === normalizedQuery,
      ),
    [normalizedQuery, options, query],
  );
  const canCreate = normalizedQuery.length > 0 && !exactMatch;

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
        setEditingValue(null);
        setDeleteConfirm(null);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      const id = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    if (editingValue) editNameRef.current?.focus();
  }, [editingValue]);

  const select = useCallback(
    (option: ResourceTypeOption) => {
      onChange(option.value);
      setOpen(false);
      setQuery('');
      setEditingValue(null);
      setDeleteConfirm(null);
      setActiveIndex(-1);
    },
    [onChange],
  );

  const nextAvailableCode = useCallback(() => {
    const used = new Set(options.map((option) => option.code));
    for (let i = 1; i <= 99; i += 1) {
      const code = String(i).padStart(2, '0');
      if (!used.has(code)) return code;
    }
    return '99';
  }, [options]);

  const handleCreate = useCallback(async () => {
    if (!canCreate) return;
    const name = query.trim();
    const code = nextAvailableCode();
    const option: ResourceTypeOption = {
      value: slugifyTypeValue(name, code),
      code,
      name,
      protected: false,
      calculationGroup: 'generic',
      badge: name.slice(0, 2).toUpperCase(),
      bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
      fallback: name,
      catalogVisible: true,
    };
    setBusy(true);
    try {
      await onCreate(option);
      onChange(option.value);
      setOpen(false);
      setQuery('');
    } finally {
      setBusy(false);
    }
  }, [canCreate, nextAvailableCode, onChange, onCreate, query]);

  const startEdit = (option: ResourceTypeOption) => {
    setEditingValue(option.value);
    setEditCode(option.code);
    setEditName(option.name);
    setDeleteConfirm(null);
  };

  const saveEdit = async (option: ResourceTypeOption) => {
    const code = normalizeCode(editCode).padStart(2, '0');
    const name = editName.trim();
    if (!code || !name) return;
    if (
      options.some(
        (item) => item.value !== option.value && item.code === code,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await onRename(option.value, { code, name });
    } finally {
      setBusy(false);
      setEditingValue(null);
    }
  };

  const removeType = async (option: ResourceTypeOption) => {
    setBusy(true);
    try {
      await onDelete(option.value);
      if (value === option.value) onChange('material');
    } finally {
      setBusy(false);
      setDeleteConfirm(null);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (editingValue || deleteConfirm) {
      if (event.key === 'Escape') {
        setEditingValue(null);
        setDeleteConfirm(null);
      }
      return;
    }
    const totalItems = filtered.length + (canCreate ? 1 : 0);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) select(option);
      else if (canCreate) handleCreate();
    }
    if (event.key === 'Escape') {
      setOpen(false);
      setQuery('');
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      <div
        className="flex h-9 w-full cursor-text items-center gap-2 rounded-lg border border-border bg-surface-primary px-2 text-sm transition-colors hover:border-content-tertiary focus-within:border-oe-blue focus-within:ring-2 focus-within:ring-oe-blue"
        onClick={() => setOpen(true)}
      >
        <Search size={14} className="shrink-0 text-content-quaternary" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : selected ? selected.name : value}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          placeholder={open ? 'Buscar o crear tipo...' : placeholder}
          className="min-w-0 flex-1 border-0 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
        />
        <ChevronDown
          size={14}
          className={`shrink-0 text-content-quaternary transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {open && (
        <div className="absolute z-[9999] mt-1 w-full rounded-lg border border-border-light bg-surface-elevated shadow-xl">
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.map((option, index) => {
              const isSelected = option.value === value;
              const isProtected = Boolean(option.protected);
              const count = counts[option.value] ?? 0;
              const isEditing = editingValue === option.value;
              const isDeleting = deleteConfirm === option.value;

              if (isEditing) {
                return (
                  <div key={option.value} className="mx-2 my-1 rounded-md border border-oe-blue/30 bg-oe-blue/5 p-2">
                    <div className="grid grid-cols-[4rem_1fr_auto_auto] items-center gap-2">
                      <input
                        type="text"
                        value={editCode}
                        onChange={(event) => setEditCode(normalizeCode(event.target.value))}
                        className="h-7 rounded border border-border bg-surface-primary px-2 text-xs font-mono text-content-primary outline-none focus:border-oe-blue"
                        placeholder="05"
                      />
                      <input
                        ref={editNameRef}
                        type="text"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') saveEdit(option);
                          if (event.key === 'Escape') setEditingValue(null);
                        }}
                        className="h-7 rounded border border-border bg-surface-primary px-2 text-xs text-content-primary outline-none focus:border-oe-blue"
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(option)}
                        disabled={busy}
                        className="flex h-7 w-7 items-center justify-center rounded text-oe-blue hover:bg-oe-blue/10 disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingValue(null)}
                        className="flex h-7 w-7 items-center justify-center rounded text-content-quaternary hover:bg-surface-secondary"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              }

              if (isDeleting) {
                return (
                  <div key={option.value} className="mx-2 my-1 flex items-center gap-2 rounded-md border border-semantic-error/30 bg-semantic-error/5 px-3 py-2 text-xs">
                    <AlertTriangle size={14} className="shrink-0 text-semantic-error" />
                    <span className="min-w-0 flex-1 text-content-primary">
                      Eliminar {option.code} {option.name}
                      {count > 0 && <span className="text-content-tertiary"> ({count} recursos)</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeType(option)}
                      disabled={busy}
                      className="rounded bg-semantic-error px-2 py-0.5 text-xs font-medium text-white hover:bg-semantic-error/80 disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(null)}
                      className="rounded border border-border px-2 py-0.5 text-xs font-medium hover:bg-surface-secondary"
                    >
                      Cancelar
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={option.value}
                  onClick={() => select(option)}
                  className={`group flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
                    index === activeIndex || isSelected ? 'bg-oe-blue/5' : 'hover:bg-surface-secondary'
                  }`}
                >
                  <span className="w-8 shrink-0 font-mono text-xs font-semibold text-content-secondary">
                    {option.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-content-primary">
                    {option.name}
                  </span>
                  {count > 0 && (
                    <span className="shrink-0 text-2xs tabular-nums text-content-quaternary">
                      {count}
                    </span>
                  )}
                  {!isProtected && (
                    <>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          startEdit(option);
                        }}
                        title="Editar tipo"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-content-quaternary hover:bg-oe-blue/5 hover:text-oe-blue"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteConfirm(option.value);
                        }}
                        title="Eliminar tipo"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-content-quaternary hover:bg-semantic-error/5 hover:text-semantic-error"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {canCreate && (
            <button
              type="button"
              onClick={handleCreate}
              className="flex w-full items-center gap-2 border-t border-border-light px-3 py-2 text-left text-sm hover:bg-oe-blue/5"
            >
              <Plus size={14} className="shrink-0 text-oe-blue" />
              <span className="truncate text-content-primary">
                Crear tipo "{query.trim()}" con codigo {nextAvailableCode()}
              </span>
            </button>
          )}

          {normalizedQuery.length > 0 && exactMatch && (
            <div className="border-t border-border-light bg-amber-50/50 px-3 py-1.5 text-center text-2xs text-amber-600 dark:bg-amber-900/5 dark:text-amber-400">
              El tipo o codigo ya existe
            </div>
          )}
        </div>
      )}
    </div>
  );
}
