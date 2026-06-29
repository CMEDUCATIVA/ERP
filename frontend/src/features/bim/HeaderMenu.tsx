// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
/**
 * HeaderMenu — compact, accessible dropdown that groups the BIM viewer
 * toolbar controls into a single header row (Panels / Selection / Appearance /
 * Go to / Help). Closes on outside-click and Escape. The trigger shows an
 * optional count badge so the active state of the toggles inside stays visible
 * without opening the menu.
 *
 * Items are passed via a render-prop that receives a `close` callback, so an
 * action item can dismiss the menu after firing while a toggle item can stay
 * open (the user often flips several panels in a row).
 */
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { ChevronDown, Check } from 'lucide-react';
import clsx from 'clsx';

type IconType = ComponentType<{ size?: number | string; className?: string }>;

interface HeaderMenuProps {
  icon: IconType;
  label: string;
  /** Shows a small count badge + active styling when > 0. */
  activeCount?: number;
  testId?: string;
  align?: 'left' | 'right';
  /** Render-prop: receives a `close` callback so items can dismiss the menu. */
  children: (close: () => void) => ReactNode;
}

export function HeaderMenu({
  icon: Icon,
  label,
  activeCount = 0,
  testId,
  align = 'right',
  children,
}: HeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const active = open || activeCount > 0;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={testId}
        className={clsx(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors border',
          active
            ? 'bg-oe-blue/10 text-oe-blue border-oe-blue/30'
            : 'text-content-secondary bg-surface-secondary border-border-light hover:bg-surface-tertiary',
        )}
      >
        <Icon size={13} />
        <span>{label}</span>
        {activeCount > 0 && (
          <span className="text-[10px] bg-oe-blue text-white rounded-full px-1.5 py-0 tabular-nums">
            {activeCount}
          </span>
        )}
        <ChevronDown
          size={11}
          className={clsx('transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="menu"
          className={clsx(
            'absolute mt-1 min-w-[15rem] rounded-lg border border-border-light bg-surface-elevated shadow-xl z-50 py-1',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-content-tertiary">
      {children}
    </div>
  );
}

interface MenuCheckProps {
  icon: IconType;
  label: string;
  checked: boolean;
  onToggle: () => void;
  /** Optional trailing badge (e.g. a count). */
  badge?: ReactNode;
  testId?: string;
  /** Close the menu after toggling (default keeps it open for multi-toggle). */
  closeOnSelect?: boolean;
  close: () => void;
}

export function MenuCheck({
  icon: Icon,
  label,
  checked,
  onToggle,
  badge,
  testId,
  closeOnSelect = false,
  close,
}: MenuCheckProps) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      data-testid={testId}
      onClick={() => {
        onToggle();
        if (closeOnSelect) close();
      }}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-content-secondary hover:bg-surface-secondary transition-colors text-left"
    >
      <span className="w-4 flex justify-center text-oe-blue">
        {checked ? <Check size={14} /> : null}
      </span>
      <Icon size={14} className={checked ? 'text-oe-blue' : 'text-content-tertiary'} />
      <span className={clsx('flex-1', checked && 'text-content-primary font-medium')}>
        {label}
      </span>
      {badge}
    </button>
  );
}

interface MenuActionProps {
  icon: IconType;
  label: string;
  onClick?: () => void;
  href?: string;
  trailingIcon?: IconType;
  testId?: string;
  close: () => void;
}

export function MenuAction({
  icon: Icon,
  label,
  onClick,
  href,
  trailingIcon: Trailing,
  testId,
  close,
}: MenuActionProps) {
  const cls =
    'w-full flex items-center gap-2.5 px-3 py-1.5 text-[12px] text-content-secondary hover:bg-surface-secondary transition-colors text-left';
  const inner = (
    <>
      <Icon size={14} className="text-content-tertiary" />
      <span className="flex-1">{label}</span>
      {Trailing && <Trailing size={12} className="text-content-tertiary" />}
    </>
  );
  if (href) {
    return (
      <a
        role="menuitem"
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={testId}
        onClick={close}
        className={cls}
      >
        {inner}
      </a>
    );
  }
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={testId}
      onClick={() => {
        onClick?.();
        close();
      }}
      className={cls}
    >
      {inner}
    </button>
  );
}
