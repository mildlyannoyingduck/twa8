import { memo, useId } from 'react';
import { DivisionNumber, LeagueId } from '../types';

export type CrestSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface LeagueCrestProps {
  league: LeagueId;
  division?: DivisionNumber;
  size?: CrestSize;
  showDivision?: boolean;
  withAura?: boolean;
  className?: string;
}

const SIZE_PX: Record<CrestSize, number> = {
  xs: 20,
  sm: 28,
  md: 38,
  lg: 54,
  xl: 76,
};

export const LEAGUE_AURA_STYLE: Record<
  LeagueId,
  {
    ringBorder: string;
    glowShadow: string;
    pillBg: string;
    accentText: string;
    haloGradient: string;
  }
> = {
  bronze: {
    ringBorder: 'border-amber-600/60 dark:border-amber-400/55',
    glowShadow: 'shadow-[0_0_16px_rgba(217,119,6,0.34)]',
    pillBg: 'bg-gradient-to-r from-amber-700 via-orange-600 to-amber-700',
    accentText: 'text-amber-800 dark:text-amber-300',
    haloGradient: 'from-amber-500/30 via-orange-500/15 to-transparent',
  },
  silver: {
    ringBorder: 'border-sky-400/70 dark:border-cyan-300/65',
    glowShadow: 'shadow-[0_0_18px_rgba(56,189,248,0.40)]',
    pillBg: 'bg-gradient-to-r from-sky-600 via-blue-500 to-cyan-500',
    accentText: 'text-sky-700 dark:text-sky-200',
    haloGradient: 'from-sky-400/35 via-blue-400/15 to-transparent',
  },
  gold: {
    ringBorder: 'border-amber-400/80 dark:border-yellow-300/75',
    glowShadow: 'shadow-[0_0_22px_rgba(245,158,11,0.48)]',
    pillBg: 'bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500',
    accentText: 'text-amber-700 dark:text-amber-300',
    haloGradient: 'from-amber-400/38 via-yellow-400/18 to-transparent',
  },
  platinum: {
    ringBorder: 'border-cyan-400/80 dark:border-teal-300/80',
    glowShadow: 'shadow-[0_0_24px_rgba(34,211,238,0.52)]',
    pillBg: 'bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-600',
    accentText: 'text-cyan-700 dark:text-cyan-300',
    haloGradient: 'from-cyan-400/40 via-teal-300/20 to-transparent',
  },
  diamond: {
    ringBorder: 'border-sky-300/85 dark:border-cyan-300/85',
    glowShadow: 'shadow-[0_0_28px_rgba(56,189,248,0.62)]',
    pillBg: 'bg-gradient-to-r from-blue-600 via-cyan-400 to-violet-600',
    accentText: 'text-blue-700 dark:text-cyan-200',
    haloGradient: 'from-cyan-300/42 via-violet-400/22 to-transparent',
  },
  apex: {
    ringBorder: 'border-amber-300/85 dark:border-cyan-200/90',
    glowShadow: 'shadow-[0_0_32px_rgba(56,189,248,0.70)]',
    pillBg: 'bg-gradient-to-r from-amber-400 via-cyan-400 to-blue-600',
    accentText: 'text-blue-800 dark:text-cyan-200',
    haloGradient: 'from-amber-400/40 via-cyan-400/28 to-emerald-400/15',
  },
};

export const LeagueCrest = memo(function LeagueCrest({
  league,
  division,
  size = 'md',
  showDivision = false,
  withAura = false,
  className = '',
}: LeagueCrestProps) {
  const uid = useId().replace(/:/g, '');
  const px = SIZE_PX[size];
  const aura = LEAGUE_AURA_STYLE[league];
  const roman = division === 1 ? 'I' : division === 2 ? 'II' : 'III';

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center select-none ${className}`}
      style={{ width: px, height: px }}
    >
      {withAura && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -inset-1.5 rounded-full bg-radial ${aura.haloGradient} opacity-80 blur-[6px]`}
        />
      )}

      <svg
        viewBox="0 0 64 64"
        width={px}
        height={px}
        className="relative z-10 overflow-visible drop-shadow-[0_3px_8px_rgba(4,16,52,0.35)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${uid}-bronze-g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="#B45309" />
            <stop offset="100%" stopColor="#78350F" />
          </linearGradient>
          <linearGradient id={`${uid}-silver-g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E0F2FE" />
            <stop offset="50%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id={`${uid}-gold-g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="52%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id={`${uid}-plat-g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#A5F3FC" />
            <stop offset="50%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#1E40AF" />
          </linearGradient>
          <linearGradient id={`${uid}-dia-g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E0F2FE" />
            <stop offset="45%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient id={`${uid}-apex-g`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="45%" stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>

        {league === 'bronze' && (
          <g>
            {/* Copper octagonal shield + chevron + bio-leaf core */}
            <polygon
              points="32,5 52,14 55,34 45,51 32,59 19,51 9,34 12,14"
              fill={`url(#${uid}-bronze-g)`}
              stroke="#FDE68A"
              strokeWidth="2.2"
              strokeOpacity="0.72"
            />
            <polygon
              points="32,12 46,19 48,33 39,46 32,51 25,46 16,33 18,19"
              fill="#451A03"
              fillOpacity="0.48"
            />
            <path
              d="M21 31 L32 20 L43 31 L39 35 L32 28 L25 35 Z"
              fill="#FDE68A"
            />
            <path
              d="M32 33 C37 36 38 42 32 47 C26 42 27 36 32 33 Z"
              fill="#34D399"
            />
          </g>
        )}

        {league === 'silver' && (
          <g>
            {/* Twin swept silver blades flanking a sapphire compass star */}
            <path
              d="M18 14 L8 25 L14 43 L24 51 L22 36 Z"
              fill={`url(#${uid}-silver-g)`}
              stroke="#E0F2FE"
              strokeWidth="1.6"
            />
            <path
              d="M46 14 L56 25 L50 43 L40 51 L42 36 Z"
              fill={`url(#${uid}-silver-g)`}
              stroke="#E0F2FE"
              strokeWidth="1.6"
            />
            <circle
              cx="32"
              cy="32"
              r="16"
              fill={`url(#${uid}-silver-g)`}
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            <polygon
              points="32,18 35.5,28.5 46,32 35.5,35.5 32,46 28.5,35.5 18,32 28.5,28.5"
              fill="#FFFFFF"
            />
            <circle cx="32" cy="32" r="3.4" fill="#0284C7" />
          </g>
        )}

        {league === 'gold' && (
          <g>
            {/* Sunburst astrolabe crown with triple star pips */}
            <circle
              cx="32"
              cy="33"
              r="21"
              fill="none"
              stroke="#FBBF24"
              strokeWidth="2"
              strokeDasharray="5 3"
              strokeOpacity="0.85"
            />
            <polygon
              points="32,7 48,18 52,40 32,57 12,40 16,18"
              fill={`url(#${uid}-gold-g)`}
              stroke="#FEF9C3"
              strokeWidth="2.2"
            />
            <path
              d="M19 39 L19 25 L26 31 L32 20 L38 31 L45 25 L45 39 Z"
              fill="#FFFBEB"
            />
            <rect x="20" y="41" width="24" height="4" rx="2" fill="#FEF08A" />
            <circle cx="32" cy="14" r="2.4" fill="#FEF08A" />
            <circle cx="20" cy="19" r="1.8" fill="#FEF08A" />
            <circle cx="44" cy="19" r="1.8" fill="#FEF08A" />
          </g>
        )}

        {league === 'platinum' && (
          <g>
            {/* Cyan hexagonal prism bezel + alchemical diamond core */}
            <polygon
              points="32,5 54,18 54,46 32,59 10,46 10,18"
              fill={`url(#${uid}-plat-g)`}
              stroke="#CCFBF1"
              strokeWidth="2.2"
            />
            <polygon
              points="32,12 48,21 48,43 32,52 16,43 16,21"
              fill="#042F2E"
              fillOpacity="0.38"
              stroke="#67E8F9"
              strokeWidth="1.2"
            />
            <polygon
              points="32,16 44,32 32,48 20,32"
              fill="#ECFEFF"
            />
            <polygon
              points="32,22 39,32 32,42 25,32"
              fill="#06B6D4"
            />
            <circle cx="32" cy="32" r="2.5" fill="#FFFFFF" />
          </g>
        )}

        {league === 'diamond' && (
          <g>
            {/* Multi-facet ice crystal crown + orbital corner shards */}
            <polygon points="10,16 15,21 10,26 5,21" fill="#67E8F9" />
            <polygon points="54,16 59,21 54,26 49,21" fill="#A78BFA" />
            <polygon points="32,3 35,8 32,12 29,8" fill="#FFFFFF" />
            <polygon
              points="20,13 44,13 56,28 32,57 8,28"
              fill={`url(#${uid}-dia-g)`}
              stroke="#E0F2FE"
              strokeWidth="2.2"
            />
            <polygon
              points="20,13 32,28 44,13"
              fill="#FFFFFF"
              fillOpacity="0.45"
            />
            <polygon
              points="8,28 32,28 32,57"
              fill="#0284C7"
              fillOpacity="0.35"
            />
            <polygon
              points="56,28 32,28 32,57"
              fill="#6D28D9"
              fillOpacity="0.38"
            />
            <polygon points="32,20 39,29 32,44 25,29" fill="#FFFFFF" />
          </g>
        )}

        {league === 'apex' && (
          <g>
            {/* Mythic phoenix-winged halo around electric sapphire-gold core */}
            <circle
              cx="32"
              cy="32"
              r="26"
              fill="none"
              stroke={`url(#${uid}-apex-g)`}
              strokeWidth="1.8"
              strokeDasharray="6 3"
            />
            {/* Twin wings */}
            <path
              d="M7 22 C13 18 19 21 22 28 L17 44 C11 39 7 31 7 22 Z"
              fill={`url(#${uid}-apex-g)`}
              stroke="#FEF08A"
              strokeWidth="1.4"
            />
            <path
              d="M57 22 C51 18 45 21 42 28 L47 44 C53 39 57 31 57 22 Z"
              fill={`url(#${uid}-apex-g)`}
              stroke="#FEF08A"
              strokeWidth="1.4"
            />
            {/* Central star crown & sapphire core */}
            <polygon
              points="32,7 41,20 51,26 43,43 32,56 21,43 13,26 23,20"
              fill={`url(#${uid}-apex-g)`}
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            <polygon
              points="32,16 37,27 46,31 37,35 32,46 27,35 18,31 27,27"
              fill="#FFFFFF"
            />
            <circle cx="32" cy="31" r="4.2" fill="#F59E0B" />
            <circle cx="32" cy="31" r="1.8" fill="#FFFFFF" />
          </g>
        )}
      </svg>

      {showDivision && division && (
        <span
          className={`tabular-nums absolute -bottom-1 -right-1 z-20 rounded-full border border-white/80 px-1.5 py-[1px] text-[9px] font-extrabold leading-none text-white shadow-sm ${aura.pillBg}`}
        >
          {roman}
        </span>
      )}
    </span>
  );
});
