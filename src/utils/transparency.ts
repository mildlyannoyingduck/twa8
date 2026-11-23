import { AppearanceStudioConfig, LeagueId } from '../types';
import {
  ACCENT_PRESETS,
  resolveEffectiveStudio,
} from './progressionEngine';

/**
 * Direct numeric CSS variable applicator for 0%–100% Card Transparency,
 * Galaxy A07 Performance Mode, and Progression-Locked Appearance Studio.
 */
export function applyGlassTransparencyVars(percent: number): void {
  if (typeof document === 'undefined') return;
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const t = clamped / 100;

  const rootStyle = document.documentElement.style;

  const alphaLight = 0.99 - t * 0.97;
  const alphaLightLow = 0.95 - t * 0.94;

  const alphaDark = 0.98 - t * 0.96;
  const alphaDarkLow = 0.93 - t * 0.92;

  const subjAlpha = 0.98 - t * 0.95;
  const subjAlphaLow = 0.90 - t * 0.89;

  const controlLight = 0.94 - t * 0.84;
  const controlDark = 0.88 - t * 0.80;

  const chromeLight = Math.max(0.18, alphaLight);
  const chromeLightLow = Math.max(0.10, alphaLightLow);
  const chromeDark = Math.max(0.24, alphaDark);
  const chromeDarkLow = Math.max(0.16, alphaDarkLow);

  const modalLight = 0.99 - t * 0.71;
  const modalLightLow = 0.94 - t * 0.72;
  const modalDark = 0.98 - t * 0.64;
  const modalDarkLow = 0.92 - t * 0.64;

  const borderLight = 0.96 - t * 0.16;
  const borderDark = 0.66 - t * 0.14;

  rootStyle.setProperty('--glass-transparency', String(clamped));
  rootStyle.setProperty('--glass-alpha', alphaLight.toFixed(3));
  rootStyle.setProperty('--glass-alpha-low', alphaLightLow.toFixed(3));
  rootStyle.setProperty('--glass-dark-alpha', alphaDark.toFixed(3));
  rootStyle.setProperty('--glass-dark-alpha-low', alphaDarkLow.toFixed(3));
  rootStyle.setProperty('--glass-subj-alpha', subjAlpha.toFixed(3));
  rootStyle.setProperty('--glass-subj-alpha-low', subjAlphaLow.toFixed(3));
  rootStyle.setProperty('--glass-control-light', controlLight.toFixed(3));
  rootStyle.setProperty('--glass-control-dark', controlDark.toFixed(3));
  rootStyle.setProperty('--glass-chrome-light', chromeLight.toFixed(3));
  rootStyle.setProperty('--glass-chrome-light-low', chromeLightLow.toFixed(3));
  rootStyle.setProperty('--glass-chrome-dark', chromeDark.toFixed(3));
  rootStyle.setProperty('--glass-chrome-dark-low', chromeDarkLow.toFixed(3));
  rootStyle.setProperty('--glass-modal-light', modalLight.toFixed(3));
  rootStyle.setProperty('--glass-modal-light-low', modalLightLow.toFixed(3));
  rootStyle.setProperty('--glass-modal-dark', modalDark.toFixed(3));
  rootStyle.setProperty('--glass-modal-dark-low', modalDarkLow.toFixed(3));
  rootStyle.setProperty('--glass-border-light', borderLight.toFixed(3));
  rootStyle.setProperty('--glass-border-dark', borderDark.toFixed(3));
}

export function applyA07PerfClass(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('a07-perf', enabled);
}

export function applyStudioAppearanceVars(
  studio: AppearanceStudioConfig,
  currentLeague: LeagueId,
): void {
  if (typeof document === 'undefined') return;
  const eff = resolveEffectiveStudio(studio, currentLeague);
  const root = document.documentElement;

  root.classList.toggle('studio-prism', eff.prismBorders);
  root.classList.remove('palette-neon-frost', 'palette-pastel-prism', 'palette-vivid-lab');
  if (eff.subjectPalette !== 'classic') {
    root.classList.add(`palette-${eff.subjectPalette}`);
  }

  const accent = ACCENT_PRESETS.find((a) => a.id === eff.accentPreset) ?? ACCENT_PRESETS[0];
  root.style.setProperty('--studio-accent', accent.primaryHex);
  root.style.setProperty('--studio-rim', eff.auroraTheme === 'custom' ? eff.customRimHex : accent.primaryHex);
}
