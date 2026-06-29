import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  X,
  Check,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

export interface CategoryCount {
  category: string;
  count: number;
  code?: string;
}

export interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  categories: CategoryCount[];
  onRename: (oldName: string, newName: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * CategoryCombobox — searchable, editable, deletable category selector.
 *
 * Single-input design: the trigger input doubles as search when the dropdown
 * is open — no duplicate search bar inside the dropdown.
 */
export function CategoryCombobox({
  value,
  onChange,
  categories,
  onRename,
  onDelete,
  placeholder = 'e.g. Concrete & Cement',
  disabled = false,
  className = '',
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [editingName, setEditingName] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingLoading, setEditingLoading] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [activeIndex, setActiveIndex] = useState(-1);

  /* ── filtered list ─────────────────────────────────────────────────── */
  const normalizedQuery = query.trim().toLowerCase();

  const categoryNames = useMemo(() => {
    const names = categories.map((c) => c.category).filter(Boolean);
    // Always include the currently selected value so newly created
    // categories appear immediately even before the stats refetch.
    if (value && !names.includes(value)) {
      names.push(value);
    }
    return names.sort((a, b) => a.localeCompare(b));
  }, [categories, value]);

  const filtered = useMemo(() => {
    if (!normalizedQuery) return categoryNames;
    return categoryNames.filter((c) =>
      c.toLowerCase().includes(normalizedQuery),
    );
  }, [categoryNames, normalizedQuery]);

  const exactMatch = useMemo(
    () =>
      normalizedQuery.length > 0 &&
      categoryNames.some((c) => c.toLowerCase() === normalizedQuery),
    [categoryNames, normalizedQuery],
  );

  const canCreate = normalizedQuery.length > 0 && !exactMatch;

  /* ── click outside ─────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery('');
        setEditingName(null);
        setDeleteConfirm(null);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* ── focus input on open ──────────────────────────────────────────── */
  useEffect(() => {
    if (open && inputRef.current) {
      const id = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  /* ── focus edit input ──────────────────────────────────────────────── */
  useEffect(() => {
    if (editingName && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingName]);

  /* ── scroll active into view ───────────────────────────────────────── */
  useEffect(() => {
    if (!open || !listRef.current) return;
    const activeEl = listRef.current.querySelector(
      `[data-cat-index="${activeIndex}"]`,
    ) as HTMLElement | null;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  /* ── handlers ──────────────────────────────────────────────────────── */
  const select = useCallback(
    (cat: string) => {
      onChange(cat);
      setOpen(false);
      setQuery('');
      setEditingName(null);
      setDeleteConfirm(null);
      setActiveIndex(-1);
    },
    [onChange],
  );

  const handleCreate = useCallback(() => {
    if (!canCreate) return;
    const name = query.trim();
    onChange(name);
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
  }, [canCreate, query, onChange]);

  const handleRename = useCallback(
    async (oldName: string) => {
      const trimmed = editValue.trim();
      if (!trimmed || trimmed === oldName) {
        setEditingName(null);
        return;
      }
      setEditingLoading(true);
      try {
        await onRename(oldName, trimmed);
        if (value === oldName) onChange(trimmed);
      } catch {
        return;
      } finally {
        setEditingLoading(false);
        setEditingName(null);
      }
    },
    [editValue, onRename, onChange, value],
  );

  const handleDelete = useCallback(
    async (name: string) => {
      setDeleteLoading(true);
      try {
        await onDelete(name);
        if (value === name) onChange('');
      } catch {
        return;
      } finally {
        setDeleteLoading(false);
        setDeleteConfirm(null);
      }
    },
    [onDelete, value, onChange],
  );

  /* ── keyboard ──────────────────────────────────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editingName || deleteConfirm) {
      if (e.key === 'Escape') {
        setEditingName(null);
        setDeleteConfirm(null);
        e.preventDefault();
      }
      return;
    }

    const totalItems = filtered.length + (canCreate ? 1 : 0);

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => (prev < totalItems - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : totalItems - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filtered.length) {
          const activeCategory = filtered[activeIndex];
          if (activeCategory) select(activeCategory);
        } else if (canCreate && activeIndex === filtered.length) {
          handleCreate();
        } else if (canCreate) {
          handleCreate();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setQuery('');
        setEditingName(null);
        setDeleteConfirm(null);
        setActiveIndex(-1);
        break;
    }
  };

  /* ── helpers ────────────────────────────────────────────────────────── */
  const countFor = (name: string) =>
    categories.find((c) => c.category === name)?.count;
  const codeFor = (name: string) =>
    categories.find((c) => c.category === name)?.code;

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* ── single input: trigger + search ──────────────────────────── */}
      <div
        className={`flex items-center gap-2 h-9 w-full rounded-lg border bg-surface-primary px-2 text-sm transition-colors ${
          disabled
            ? 'border-border-light bg-surface-secondary/40 cursor-not-allowed opacity-60'
            : 'border-border cursor-text hover:border-content-tertiary focus-within:border-oe-blue focus-within:ring-2 focus-within:ring-oe-blue'
        }`}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          setActiveIndex(-1);
        }}
      >
        <Search size={14} className="shrink-0 text-content-quaternary" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : value}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setActiveIndex(-1);
          }}
          placeholder={open ? 'Buscar o crear categoría...' : placeholder}
          disabled={disabled}
          className="min-w-0 flex-1 border-0 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0"
        />
        {value && !open && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setQuery('');
            }}
            aria-label="Clear"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-content-quaternary hover:bg-surface-secondary hover:text-content-primary"
          >
            <X size={12} />
          </button>
        )}
        <ChevronDown
          size={14}
          className={`shrink-0 text-content-quaternary transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </div>

      {/* ── dropdown ────────────────────────────────────────────────── */}
      {open && (
        <div className="absolute z-[9999] mt-1 w-full rounded-lg border border-border-light bg-surface-elevated shadow-xl">
          {/* category list */}
          <div ref={listRef} className="max-h-56 overflow-y-auto py-1">
            {filtered.map((cat, idx) => {
              const count = countFor(cat);
              const isSelected = cat === value;
              const isEditing = editingName === cat;
              const isConfirmingDelete = deleteConfirm === cat;

              if (isEditing) {
                return (
                  <div
                    key={cat}
                    data-cat-index={idx}
                    className={`flex items-center gap-2 px-3 py-1.5 ${idx === activeIndex ? 'bg-oe-blue/5' : ''}`}
                  >
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(cat);
                        if (e.key === 'Escape') setEditingName(null);
                      }}
                      className="h-7 flex-1 rounded border border-oe-blue bg-surface-primary px-2 text-xs text-content-primary outline-none ring-1 ring-oe-blue"
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(cat)}
                      disabled={editingLoading}
                      className="flex h-6 w-6 items-center justify-center rounded text-oe-blue hover:bg-oe-blue/10"
                    >
                      {editingLoading ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingName(null)}
                      className="flex h-6 w-6 items-center justify-center rounded text-content-quaternary hover:bg-surface-secondary"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              }

              if (isConfirmingDelete) {
                return (
                  <div
                    key={cat}
                    data-cat-index={idx}
                    className={`flex items-center gap-2 rounded-md mx-2 my-1 px-3 py-2 text-xs border border-semantic-error/30 bg-semantic-error/5 ${
                      idx === activeIndex ? 'ring-1 ring-semantic-error/20' : ''
                    }`}
                  >
                    <AlertTriangle size={14} className="shrink-0 text-semantic-error" />
                    <span className="text-content-primary min-w-0 truncate">
                      ¿Eliminar &ldquo;{cat}&rdquo;?
                      {count != null && count > 0 && (
                        <span className="text-content-tertiary">
                          {' '}
                          ({count} recursos)
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat)}
                      disabled={deleteLoading}
                      className="ml-auto shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-semantic-error text-white hover:bg-semantic-error/80 disabled:opacity-50"
                    >
                      {deleteLoading ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        'Eliminar'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(null)}
                      className="shrink-0 rounded px-2 py-0.5 text-xs font-medium border border-border hover:bg-surface-secondary"
                    >
                      Cancelar
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={cat}
                  data-cat-index={idx}
                  onClick={() => select(cat)}
                  className={`group flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                    idx === activeIndex
                      ? 'bg-oe-blue/5'
                      : isSelected
                        ? 'bg-oe-blue/5'
                        : 'hover:bg-surface-secondary'
                  }`}
                >
                  <span className="text-content-primary truncate flex-1">
                    {codeFor(cat) && (
                      <span className="mr-2 inline-block w-8 shrink-0 font-mono text-xs font-semibold text-content-secondary">
                        {codeFor(cat)}
                      </span>
                    )}
                    {cat}
                  </span>
                  {count != null && (
                    <span className="shrink-0 text-2xs text-content-quaternary tabular-nums">
                      {count}
                    </span>
                  )}
                  {isSelected && (
                    <Check size={14} className="shrink-0 text-oe-blue" />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingName(cat);
                      setEditValue(cat);
                    }}
                    title="Renombrar"
                    className="shrink-0 flex h-6 w-6 items-center justify-center rounded text-content-quaternary hover:text-oe-blue hover:bg-oe-blue/5"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(cat);
                    }}
                    title="Eliminar"
                    className="shrink-0 flex h-6 w-6 items-center justify-center rounded text-content-quaternary hover:text-semantic-error hover:bg-semantic-error/5"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}

            {filtered.length === 0 && !canCreate && (
              <div className="px-3 py-4 text-xs text-content-tertiary text-center">
                Escriba para buscar o crear una categoría
              </div>
            )}
          </div>

          {/* create new */}
          {canCreate && (
            <div
              data-cat-index={filtered.length}
              onClick={handleCreate}
              className={`flex items-center gap-2 border-t border-border-light px-3 py-2 text-sm cursor-pointer transition-colors ${
                activeIndex === filtered.length
                  ? 'bg-oe-blue/5'
                  : 'hover:bg-oe-blue/5'
              }`}
            >
              <Plus size={14} className="shrink-0 text-oe-blue" />
              <span className="text-content-primary truncate">
                Crear &ldquo;{query.trim()}&rdquo;
              </span>
            </div>
          )}
          {/* duplicate warning */}
          {normalizedQuery.length > 0 && exactMatch && (
            <div className="px-3 py-1.5 text-2xs text-amber-600 dark:text-amber-400 text-center border-t border-border-light bg-amber-50/50 dark:bg-amber-900/5">
              La categoría ya existe
            </div>
          )}
        </div>
      )}
    </div>
  );
}
