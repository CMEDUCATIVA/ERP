// DDC-CWICR-OE: DataDrivenConstruction · OpenConstructionERP
/**
 * BIMHelpPanel — the BIM intro/help rendered as a FLOATING panel with two
 * states, instead of an in-flow banner that pushes the 3D viewer down:
 *
 *  - "open": a half-width card pinned at the top-right, at canvas level. Starts
 *    open on every page load (session-only — no localStorage persistence, so a
 *    reload always shows it again).
 *  - "min":  a small circular "?" button in the same corner.
 *
 * It auto-minimizes ONCE, 60 s after the first display (a courtesy so it gets
 * out of the way), and minimizes immediately on [—] minimize or [✕] close —
 * both do the same thing by design. Clicking the "?" re-opens it, and it then
 * stays open until the user collapses it again (the one-shot 60 s timer is
 * spent). There is no menu / top-bar re-entry: the "?" is the only handle.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, HelpCircle, Info, Minus, X } from 'lucide-react';

export interface BIMHelpLink {
  label: string;
  onClick: () => void;
}

export function BIMHelpPanel({
  title,
  children,
  more,
  links,
  autoMinimizeMs = 60_000,
  minimizedTimeoutMs = 10_000,
}: {
  title: string;
  children?: ReactNode;
  /** Optional extended explanation revealed behind "Show more". */
  more?: ReactNode;
  /** Optional cross-module shortcut pills. */
  links?: BIMHelpLink[];
  /** First-time courtesy auto-minimize delay (ms). */
  autoMinimizeMs?: number;
  /** How long the circular "?" lingers before vanishing for the session (ms). */
  minimizedTimeoutMs?: number;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'open' | 'min' | 'gone'>('open');
  const [showMore, setShowMore] = useState(false);
  // The 60 s courtesy auto-minimize fires only once (the initial display); a
  // manual collapse also spends it so a later re-open stays open.
  const autoSpent = useRef(false);

  useEffect(() => {
    if (mode !== 'open' || autoSpent.current) return undefined;
    const id = window.setTimeout(() => {
      autoSpent.current = true;
      setMode('min');
    }, autoMinimizeMs);
    return () => window.clearTimeout(id);
  }, [mode, autoMinimizeMs]);

  // Once minimized, the "?" lingers briefly then disappears for the session.
  // Re-opening (clicking it) cancels this; a reload brings the panel back open.
  useEffect(() => {
    if (mode !== 'min') return undefined;
    const id = window.setTimeout(() => setMode('gone'), minimizedTimeoutMs);
    return () => window.clearTimeout(id);
  }, [mode, minimizedTimeoutMs]);

  const minimize = () => {
    autoSpent.current = true;
    setMode('min');
  };

  if (mode === 'gone') return null;

  if (mode === 'min') {
    return (
      <button
        type="button"
        onClick={() => setMode('open')}
        aria-label={t('bim.help_open', { defaultValue: 'Show help' })}
        title={t('bim.help_open', { defaultValue: 'Show help' })}
        data-testid="bim-help-fab"
        className="fixed right-4 top-24 z-40 flex h-7 w-7 items-center justify-center rounded-full bg-oe-blue text-white shadow-lg hover:bg-oe-blue-dark transition-colors animate-fade-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        <HelpCircle size={15} />
      </button>
    );
  }

  return (
    <div
      data-testid="bim-help-panel"
      className="fixed right-4 top-28 z-50 w-1/2 max-w-3xl max-h-[80vh] overflow-y-auto rounded-xl border border-oe-blue/20 border-l-2 border-l-oe-blue/70 bg-surface-elevated shadow-2xl animate-fade-in"
    >
      <div className="flex items-start gap-3 px-4 py-4">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-oe-blue/15">
          <Info size={16} className="text-oe-blue-text" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-medium leading-snug text-content-primary">{title}</h2>
          {children != null && (
            <div className="mt-1.5 text-sm leading-relaxed text-content-secondary">{children}</div>
          )}
          {more != null && (
            <>
              {showMore && (
                <div className="mt-3 border-t border-oe-blue/15 pt-3 text-sm leading-relaxed text-content-secondary animate-fade-in">
                  {more}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowMore((v) => !v)}
                aria-expanded={showMore}
                className="mt-2 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-oe-blue-text transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                {showMore
                  ? t('common.show_less', { defaultValue: 'Show less' })
                  : t('common.show_more', { defaultValue: 'Show more' })}
                {showMore ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </>
          )}
          {links && links.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {links.map((l) => (
                <button
                  key={l.label}
                  type="button"
                  onClick={l.onClick}
                  className="inline-flex items-center gap-1 rounded-full border border-oe-blue/30 bg-surface-primary px-2.5 py-1 text-xs font-medium text-oe-blue-text transition-colors hover:bg-oe-blue hover:text-content-inverse"
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={minimize}
            aria-label={t('bim.help_minimize', { defaultValue: 'Minimize' })}
            title={t('bim.help_minimize', { defaultValue: 'Minimize' })}
            data-testid="bim-help-minimize"
            className="-mt-1 rounded-md p-1.5 text-content-tertiary opacity-70 transition-all hover:bg-surface-secondary hover:text-content-primary hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <Minus size={15} />
          </button>
          <button
            type="button"
            onClick={minimize}
            aria-label={t('bim.help_close', { defaultValue: 'Close' })}
            title={t('bim.help_close', { defaultValue: 'Close' })}
            data-testid="bim-help-close"
            className="-mr-1 -mt-1 rounded-md p-1.5 text-content-tertiary opacity-70 transition-all hover:bg-surface-secondary hover:text-content-primary hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
