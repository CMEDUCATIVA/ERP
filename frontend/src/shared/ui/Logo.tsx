import clsx from 'clsx';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  animate?: boolean;
  className?: string;
}

/* Icon sizes — compact so the text dominates */
const sizeMap = {
  xs: 'h-5 w-5',
  sm: 'h-6 w-6',
  md: 'h-7 w-7',
  lg: 'h-10 w-10',
  xl: 'h-14 w-14',
};

/**
 * Brand logo — 3 ascending bars + building on gradient background.
 * Per BRAND.md: gradient #0066ff → #5856d6, white elements.
 *
 * `animate` triggers a staggered entrance:
 *   1. Background scales in
 *   2. Bars grow up one by one
 *   3. Building slides in from right
 *   4. Windows fade in
 */
export function Logo({ size = 'md', animate = false, className }: LogoProps) {
  const isSmall = size === 'xs' || size === 'sm';
  const gradientId = `oe-lg-${size}-${animate ? 'a' : 's'}`;

  const barStyle = (delay: number, _height: number) =>
    animate
      ? {
          transformOrigin: 'bottom',
          animation: `oeBarGrow 500ms cubic-bezier(0.34,1.56,0.64,1) both`,
          animationDelay: `${delay}ms`,
        }
      : undefined;

  const buildingStyle = animate
    ? {
        animation: `oeBuildingSlide 600ms cubic-bezier(0.22,1,0.36,1) both`,
        animationDelay: '300ms',
      }
    : undefined;

  const windowStyle = (delay: number) =>
    animate
      ? {
          animation: `oeWindowFade 400ms ease both`,
          animationDelay: `${delay}ms`,
        }
      : undefined;

  const bgStyle = animate
    ? {
        animation: `oeBgScale 450ms cubic-bezier(0.34,1.56,0.64,1) both`,
      }
    : undefined;

  return (
    <div
      className={clsx(sizeMap[size], 'relative shrink-0', className)}
      style={animate ? { animation: 'oeLogoFloat 3s ease-in-out 1.2s infinite, oeLogoGlow 3s ease-in-out 1.2s infinite' } : undefined}
    >
      <svg viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0066ff" />
            <stop offset="100%" stopColor="#5856d6" />
          </linearGradient>
        </defs>

        {/* Background */}
        <rect x="32" y="32" width="448" height="448" rx="96" fill={`url(#${gradientId})`} style={bgStyle} />

        {/* HardHat icon — scaled to fit */}
        <g transform="translate(256,256) scale(18) translate(-12,-12)" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
          <path d="M14 6a6 6 0 0 1 6 6v3" />
          <path d="M4 15v-3a6 6 0 0 1 6-6" />
          <rect x="2" y="15" width="20" height="4" rx="1" />
        </g>
      </svg>
    </div>
  );
}

/* ── LogoWithText ──────────────────────────────────────────────────────── */

interface LogoWithTextProps extends LogoProps {
  showVersion?: boolean;
}

/* Text sizes — larger than icon to make the name prominent */
const textSizeMap = {
  xs: 'text-[15px] leading-none',
  sm: 'text-[16px] leading-none',
  md: 'text-[17px] leading-none',
  lg: 'text-xl leading-none',
  xl: 'text-2xl leading-none',
};

const gapSizeMap = {
  xs: 'gap-1.5',
  sm: 'gap-2',
  md: 'gap-2',
  lg: 'gap-2.5',
  xl: 'gap-3',
};

/**
 * Logo + brand name. Per BRAND.md:
 * - Font: Plus Jakarta Sans 800
 * - Name: "OpenConstructionERP" (PascalCase, one word)
 * - Letter-spacing: -0.02em
 * - Icon is compact, name is prominent
 */
export function LogoWithText({ size = 'md', animate, showVersion = true, className }: LogoWithTextProps) {
  return (
    <div className={clsx('flex items-center', gapSizeMap[size], className)}>
      <Logo size={size} animate={animate} />
      <span
        className={clsx(
          textSizeMap[size],
          'font-extrabold text-content-primary whitespace-nowrap tracking-tight',
        )}
        style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", letterSpacing: '-0.02em' }}
      >
        Open<span className="text-oe-blue">Construction</span>
        {showVersion && <span className="text-content-quaternary font-semibold">ERP</span>}
      </span>
    </div>
  );
}
