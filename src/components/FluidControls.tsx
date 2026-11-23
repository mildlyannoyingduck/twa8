import { memo, ReactNode, TouchEvent, useRef } from 'react';
import { haptics } from '../utils/haptics';

interface LiquidSwitchProps {
  checked: boolean;
  onToggle: () => void;
  ariaLabel?: string;
  activeColorClass?: string;
}

/**
 * Pure GPU-Composited Toggle Switch (zero JS spring overhead on Galaxy A07)
 */
export const LiquidSwitch = memo(function LiquidSwitch({
  checked,
  onToggle,
  ariaLabel,
  activeColorClass = 'bg-blue-600 shadow-[0_0_14px_rgba(37,99,235,0.4)] dark:bg-sky-400 dark:shadow-[0_0_16px_rgba(56,189,248,0.45)]',
}: LiquidSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => {
        haptics.tick();
        onToggle();
      }}
      className={`relative flex h-7 w-[52px] shrink-0 items-center rounded-full border p-1 transition-colors duration-200 active:scale-95 ${
        checked
          ? `border-white/75 ${activeColorClass}`
          : 'border-white/55 bg-blue-400/18 dark:border-sky-300/25 dark:bg-sky-400/15'
      }`}
    >
      <span
        style={{
          transform: checked ? 'translate3d(22px, 0, 0)' : 'translate3d(0, 0, 0)',
        }}
        className="relative h-5 w-5 rounded-full bg-white shadow-[0_2px_8px_rgba(7,20,43,0.28),inset_0_-1px_1px_rgba(59,130,246,0.22)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        <span className="absolute left-1 top-1 h-1.5 w-2 rounded-full bg-sky-100/90" />
      </span>
    </button>
  );
});

interface CrystalSheetProps {
  open: boolean;
  onClose: () => void;
  zIndexClass?: string;
  maxWidthClass?: string;
  scrimClassName?: string;
  children: ReactNode;
}

/**
 * Instant GPU-Composited Modal / Bottom Sheet:
 * - Zero AnimatePresence / Framer drag overhead -> opens in <16ms on Galaxy A07.
 * - Lightweight direct-DOM touch swipe-down strictly on the top handle pill.
 */
export function CrystalSheet({
  open,
  onClose,
  zIndexClass = 'z-50',
  maxWidthClass = 'max-w-lg',
  scrimClassName = 'bg-[#040E28]/32 dark:bg-[#020618]/54',
  children,
}: CrystalSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const deltaYRef = useRef<number>(0);

  if (!open) return null;

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    startYRef.current = e.touches[0].clientY;
    deltaYRef.current = 0;
    if (panelRef.current) {
      panelRef.current.style.transition = 'none';
    }
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (startYRef.current === null || e.touches.length !== 1 || !panelRef.current) return;
    const dy = Math.max(0, e.touches[0].clientY - startYRef.current);
    deltaYRef.current = dy;
    panelRef.current.style.transform = `translate3d(0, ${dy}px, 0)`;
  };

  const handleTouchEnd = () => {
    const dy = deltaYRef.current;
    startYRef.current = null;
    deltaYRef.current = 0;
    if (dy > 80) {
      haptics.tick();
      onClose();
      return;
    }
    if (panelRef.current) {
      panelRef.current.style.transition = 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)';
      panelRef.current.style.transform = '';
    }
  };

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-end justify-center sm:items-center sm:p-4 ${scrimClassName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          haptics.tick();
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className={`animate-sheet-in ios-glass-modal max-h-[92vh] w-full ${maxWidthClass} overflow-y-auto rounded-t-[36px] p-5 text-[#07142B] dark:text-white sm:rounded-[34px] sm:p-6`}
      >
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="mx-auto -mt-1 mb-3 flex w-24 cursor-grab touch-none justify-center py-2 active:cursor-grabbing sm:hidden"
        >
          <div className="h-1.5 w-11 rounded-full bg-blue-950/20 dark:bg-sky-200/35" />
        </div>
        {children}
      </div>
    </div>
  );
}
