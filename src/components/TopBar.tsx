import {
  ChevronRight,
  Droplets,
  Moon,
  Shield,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { memo } from 'react';
import { SUBJECT_META } from '../data/previewData';
import { LeagueId, SubjectId } from '../types';
import { haptics } from '../utils/haptics';
import { LEAGUE_AURA_STYLE, LeagueCrest } from './LeagueCrest';

interface TopBarProps {
  isDark: boolean;
  onToggleTheme: () => void;
  blockerActive: boolean;
  onOpenBlockerPreview: () => void;
  onOpenAppearance: () => void;
  appearanceOpen?: boolean;
  onOpenAbilities: () => void;
  abilitiesOpen?: boolean;
  currentLeague: LeagueId;
  xp: number;
  rushActive?: boolean;
  readyBountiesCount?: number;
  hasMissingPermissions?: boolean;
  liveBannerText?: string | null;
  liveBannerSubject?: SubjectId | null;
  onOpenLiveBanner?: () => void;
}

export const TopBar = memo(function TopBar({
  isDark,
  onToggleTheme,
  blockerActive,
  onOpenBlockerPreview,
  onOpenAppearance,
  appearanceOpen = false,
  onOpenAbilities,
  abilitiesOpen = false,
  currentLeague,
  xp,
  rushActive = false,
  readyBountiesCount = 0,
  hasMissingPermissions = false,
  liveBannerText,
  liveBannerSubject,
  onOpenLiveBanner,
}: TopBarProps) {
  const subjMeta = liveBannerSubject ? SUBJECT_META[liveBannerSubject] : null;
  const aura = LEAGUE_AURA_STYLE[currentLeague];

  return (
    <header className="ios-glass-topbar sticky top-0 z-30 transition-colors duration-200">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              haptics.tick();
              onOpenAbilities();
            }}
            className="flex items-center gap-2 shrink-0 transition-transform duration-100 active:scale-95"
            aria-label="Kithnuka XP Arena"
          >
            <LeagueCrest league={currentLeague} size="xs" withAura />
            <span className="font-brand bg-gradient-to-r from-[#07142B] via-blue-700 to-cyan-600 bg-clip-text text-[18px] font-bold tracking-tight text-transparent dark:from-white dark:via-sky-200 dark:to-cyan-300 whitespace-nowrap">
              Kithnuka
            </span>
          </button>

          {liveBannerText && onOpenLiveBanner && (
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onOpenLiveBanner();
              }}
              className="ios-glass-control hidden min-w-0 items-center gap-1.5 rounded-full px-3 py-1 text-left text-[11px] font-semibold text-[#0B234A]/85 transition-opacity hover:opacity-100 dark:text-sky-100/90 sm:inline-flex"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  subjMeta ? subjMeta.bar : 'bg-blue-500'
                }`}
              />
              <span className={`truncate max-w-[230px] ${subjMeta ? subjMeta.text : ''}`}>
                {liveBannerText}
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 sm:gap-2">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onOpenBlockerPreview();
            }}
            className={`ios-glass relative inline-flex min-h-[36px] items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-transform duration-100 active:scale-95 whitespace-nowrap shrink-0 sm:px-3 ${
              blockerActive
                ? '!border-emerald-400/70 !bg-emerald-500/20 text-emerald-900 dark:text-emerald-200'
                : 'text-[#07142B] dark:text-sky-50'
            }`}
          >
            {blockerActive ? (
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
            ) : (
              <Shield className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-sky-300" />
            )}
            <span className="hidden xs:inline sm:inline">{blockerActive ? 'Lock' : 'Focus'}</span>
            {hasMissingPermissions && !blockerActive && (
              <span
                aria-label="Permissions needed"
                className="h-1.5 w-1.5 rounded-full bg-orange-500"
              />
            )}
          </button>

          {/* XP Arena & League Button right beside Transparency & Night/Day */}
          <button
            type="button"
            onClick={() => {
              haptics.tick();
              onOpenAbilities();
            }}
            aria-label="Open Kithnuka XP Arena"
            aria-pressed={abilitiesOpen}
            className={`ios-glass relative inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-2.5 text-xs font-bold transition-transform duration-100 active:scale-95 whitespace-nowrap shrink-0 ${
              abilitiesOpen
                ? '!border-blue-500/80 !bg-blue-600 text-white dark:!border-cyan-300/80 dark:!bg-cyan-400 dark:text-[#04143B]'
                : `${aura.ringBorder} text-[#07142B] dark:text-sky-50`
            }`}
          >
            <LeagueCrest league={currentLeague} size="xs" />
            <span className="tabular-nums">{xp} XP</span>
            {(rushActive || readyBountiesCount > 0) && (
              <span
                aria-label={rushActive ? '2x Rush Active' : 'Bounty ready'}
                className={`h-2 w-2 rounded-full ${
                  rushActive ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
                }`}
              />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.tick();
              onOpenAppearance();
            }}
            aria-label="Appearance studio, transparency and real backup"
            aria-pressed={appearanceOpen}
            className={`ios-glass inline-flex h-[36px] w-[36px] items-center justify-center rounded-full transition-transform duration-100 active:scale-90 ${
              appearanceOpen
                ? '!border-blue-500/80 !bg-blue-600 text-white dark:!border-cyan-300/80 dark:!bg-cyan-400 dark:text-[#04143B]'
                : 'text-blue-700 dark:text-cyan-200'
            }`}
          >
            <Droplets className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              haptics.tick();
              onToggleTheme();
            }}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to night mode'}
            className="ios-glass relative inline-flex h-[36px] w-[36px] items-center justify-center overflow-hidden rounded-full text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-sky-50"
          >
            {isDark ? <Sun className="h-4 w-4 text-cyan-200" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Compact Live Class / Next Session Strip */}
      {liveBannerText && onOpenLiveBanner && (
        <div className="border-t border-white/25 px-4 py-1.5 dark:border-sky-300/12 sm:hidden">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onOpenLiveBanner();
            }}
            className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-semibold"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  subjMeta ? subjMeta.bar : 'bg-blue-500'
                }`}
              />
              <span className={`truncate ${subjMeta ? subjMeta.text : 'text-[#07142B] dark:text-white'}`}>
                {liveBannerText}
              </span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#0B234A]/55 dark:text-sky-200/60" />
          </button>
        </div>
      )}
    </header>
  );
});
