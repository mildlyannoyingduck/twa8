import {
  CalendarRange,
  FileBarChart2,
  Hourglass,
  Layers,
  LayoutDashboard,
  PlaySquare,
} from 'lucide-react';
import { memo } from 'react';
import { TabId } from '../types';
import { haptics } from '../utils/haptics';

interface BottomNavProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  badges?: Partial<Record<TabId, number>>;
}

const NAV_ITEMS: { id: TabId; label: string; icon: typeof CalendarRange }[] = [
  { id: 'day', label: 'Home', icon: LayoutDashboard },
  { id: 'timetable', label: 'Timetable', icon: CalendarRange },
  { id: 'planner', label: 'Planner', icon: Layers },
  { id: 'missed', label: 'Missed', icon: PlaySquare },
  { id: 'papers', label: 'Papers', icon: FileBarChart2 },
  { id: 'countdown', label: 'Exam', icon: Hourglass },
];

export const BottomNav = memo(function BottomNav({
  activeTab,
  onSelectTab,
  badges = {},
}: BottomNavProps) {
  const activeIdx = Math.max(
    0,
    NAV_ITEMS.findIndex((item) => item.id === activeTab),
  );

  return (
    <div className="pointer-events-none fixed bottom-3 left-2.5 right-2.5 z-40">
      <nav
        aria-label="Primary navigation"
        className="ios-glass-dock pointer-events-auto relative mx-auto grid h-[66px] max-w-2xl grid-cols-6 items-center rounded-full px-1.5 py-1"
      >
        {/* Evolved Floating Liquid Crystal Capsule with Top Specular Horizon */}
        <div
          aria-hidden="true"
          style={{
            transform: `translate3d(${activeIdx * 100}%, 0, 0)`,
          }}
          className="pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 w-[calc((100%-12px)/6)] px-0.5 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
        >
          <div className="relative flex h-full w-full flex-col items-center rounded-full border border-white/90 bg-gradient-to-b from-white/75 to-sky-100/35 shadow-[0_4px_16px_rgba(37,99,235,0.20),inset_0_1.5px_0_rgba(255,255,255,0.96)] dark:border-sky-300/40 dark:from-sky-400/30 dark:to-blue-500/20 dark:shadow-[0_4px_16px_rgba(56,189,248,0.28),inset_0_1px_0_rgba(255,255,255,0.35)]">
            <span className="mt-[2px] h-[2.5px] w-5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.85)] dark:from-cyan-300 dark:to-sky-400" />
          </div>
        </div>

        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          const badgeCount = badges[id] ?? 0;

          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (activeTab !== id) {
                  haptics.tick();
                  onSelectTab(id);
                }
              }}
              className={`relative z-10 flex h-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-full px-0.5 pt-1 transition-colors duration-150 active:scale-95 ${
                isActive
                  ? 'text-[#07142B] dark:text-white'
                  : 'text-[#0B234A]/65 hover:text-[#07142B] dark:text-sky-100/70 dark:hover:text-white'
              }`}
            >
              <span
                className={`relative flex items-center justify-center transition-transform duration-150 ${
                  isActive ? '-translate-y-0.5 scale-105' : 'scale-95'
                }`}
              >
                <Icon
                  className={`h-[17px] w-[17px] transition-colors duration-150 ${
                    isActive
                      ? 'stroke-[2.25] text-blue-700 dark:text-cyan-300'
                      : 'stroke-[1.7]'
                  }`}
                />
                {badgeCount > 0 && (
                  <span
                    className={`tabular-nums absolute -right-2.5 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[8px] font-bold text-white shadow-sm ${
                      id === 'missed'
                        ? 'bg-orange-500'
                        : id === 'papers'
                          ? 'bg-violet-600'
                          : 'bg-blue-600'
                    }`}
                  >
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </span>

              <span
                className={`max-w-full truncate text-[9.5px] tracking-tight whitespace-nowrap transition-opacity duration-150 sm:text-[10px] ${
                  isActive ? 'font-bold opacity-100' : 'font-medium opacity-80'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
});
