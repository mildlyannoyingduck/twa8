import { Award, CheckCircle2, ClipboardCheck, Layers, Plus, Sparkles, Trash2, TrendingUp, X } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { findSyllabusUnit, SUBJECT_GLASS_CARD, SUBJECT_META, SYLLABUS_UNITS } from '../data/previewData';
import { PaperEntry, PaperFormat, PaperReviewStatus, StudyChecklistItem, StudyTask, SubjectId } from '../types';
import { getTodayISO } from '../utils/dateUtils';
import { haptics } from '../utils/haptics';
import { CrystalSheet, LiquidSwitch } from './FluidControls';

interface PapersViewProps {
  papers: PaperEntry[];
  tasks?: StudyTask[];
  reviewChainActive?: boolean;
  onOpenAbilities?: () => void;
  onAddPaper: (entry: PaperEntry) => void;
  onUpdatePaper: (entry: PaperEntry) => void;
  onDeletePaper: (paperId: string) => void;
  onCreateOrOpenReviewTask?: (entry: PaperEntry, openSuggester?: boolean) => void;
  onToggleReviewStatus?: (entry: PaperEntry) => void;
  isDark: boolean;
}

const CLASS_OPTIONS_BY_SUBJECT: Record<SubjectId, string[]> = {
  biology: ['Biology Paper Class', 'Past Paper', 'School Term Test'],
  physics: ['Physics Paper Class', 'Physics Revision', 'Past Paper', 'School Term Test'],
  chemistry: ['Chemistry Paper Class', 'Past Paper', 'School Term Test'],
};

const SUBJECT_ACTIVE_BTN: Record<SubjectId, string> = {
  biology: 'bg-emerald-600/92 text-white shadow-lg shadow-emerald-600/25 dark:bg-emerald-500/92',
  physics: 'bg-orange-600/92 text-white shadow-lg shadow-orange-600/25 dark:bg-orange-500/92',
  chemistry: 'bg-violet-600/92 text-white shadow-lg shadow-violet-600/25 dark:bg-violet-500/92',
};

type SeriesMode = 'combined' | 'part1' | 'part2';

function buildSmoothSpline(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    path += ` C ${midX.toFixed(1)} ${p0.y.toFixed(1)}, ${midX.toFixed(1)} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
  }
  return path;
}

function getGradeLabel(pct: number): { grade: string; note: string } {
  if (pct >= 75) return { grade: 'A', note: 'Distinction Zone' };
  if (pct >= 65) return { grade: 'B', note: `${75 - pct}% to Grade A` };
  if (pct >= 55) return { grade: 'C', note: `${75 - pct}% to Grade A` };
  if (pct >= 35) return { grade: 'S', note: 'Pass Band' };
  return { grade: '—', note: 'Log marks to track' };
}

export const PapersView = memo(function PapersView({
  papers,
  tasks = [],
  reviewChainActive = false,
  onOpenAbilities,
  onAddPaper,
  onUpdatePaper,
  onDeletePaper,
  onCreateOrOpenReviewTask,
  onToggleReviewStatus,
  isDark,
}: PapersViewProps) {
  const [subjectFilter, setSubjectFilter] = useState<SubjectId>('biology');
  const [seriesMode, setSeriesMode] = useState<SeriesMode>('combined');
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingPaperId, setEditingPaperId] = useState<string | null>(null);

  const [paperName, setPaperName] = useState('');
  const [formSubject, setFormSubject] = useState<SubjectId>('biology');
  const [formClass, setFormClass] = useState<string>(CLASS_OPTIONS_BY_SUBJECT.biology[0]);
  const [formDate, setFormDate] = useState<string>(getTodayISO());
  const [formFormat, setFormFormat] = useState<PaperFormat>('both');
  const [part1Score, setPart1Score] = useState('');
  const [part1Max, setPart1Max] = useState('50');
  const [part2Score, setPart2Score] = useState('');
  const [part2Max, setPart2Max] = useState('100');
  const [formNote, setFormNote] = useState('');
  const [formWeakUnitIds, setFormWeakUnitIds] = useState<string[]>([]);
  const [formMistakesText, setFormMistakesText] = useState('');
  const [scheduleReviewOnSave, setScheduleReviewOnSave] = useState(true);

  const filteredPapers = useMemo(() => {
    return papers
      .filter((p) => p.subject === subjectFilter)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [papers, subjectFilter]);

  const chartPoints = useMemo(() => {
    return filteredPapers
      .map((p) => {
        let value: number | null = p.combinedPercent;
        if (seriesMode === 'part1') {
          value =
            p.part1Score !== undefined && p.part1Max
              ? Math.round((p.part1Score / p.part1Max) * 100)
              : null;
        } else if (seriesMode === 'part2') {
          value =
            p.part2Score !== undefined && p.part2Max
              ? Math.round((p.part2Score / p.part2Max) * 100)
              : null;
        }
        return value !== null ? { paper: p, value } : null;
      })
      .filter((item): item is { paper: PaperEntry; value: number } => item !== null);
  }, [filteredPapers, seriesMode]);

  const activePoint =
    chartPoints.find((pt) => pt.paper.id === selectedPointId) ??
    chartPoints[chartPoints.length - 1] ??
    null;

  const avgPercent = chartPoints.length
    ? Math.round(chartPoints.reduce((acc, p) => acc + p.value, 0) / chartPoints.length)
    : 0;
  const bestPercent = chartPoints.length
    ? Math.max(...chartPoints.map((p) => p.value))
    : 0;
  const latestDelta =
    chartPoints.length >= 2
      ? chartPoints[chartPoints.length - 1].value - chartPoints[chartPoints.length - 2].value
      : 0;

  // Part I vs Part II average split across filtered papers
  const { p1Avg, p2Avg } = useMemo(() => {
    const p1List = filteredPapers
      .filter((p) => p.part1Score !== undefined && p.part1Max)
      .map((p) => Math.round(((p.part1Score ?? 0) / (p.part1Max || 50)) * 100));
    const p2List = filteredPapers
      .filter((p) => p.part2Score !== undefined && p.part2Max)
      .map((p) => Math.round(((p.part2Score ?? 0) / (p.part2Max || 100)) * 100));

    return {
      p1Avg: p1List.length ? Math.round(p1List.reduce((a, b) => a + b, 0) / p1List.length) : 0,
      p2Avg: p2List.length ? Math.round(p2List.reduce((a, b) => a + b, 0) / p2List.length) : 0,
    };
  }, [filteredPapers]);

  // 3-Subject Scoreboard Overview
  const subjectScoreboard = useMemo(() => {
    return (['biology', 'physics', 'chemistry'] as SubjectId[]).map((subj) => {
      const list = papers.filter((p) => p.subject === subj);
      const avg = list.length
        ? Math.round(list.reduce((acc, p) => acc + p.combinedPercent, 0) / list.length)
        : 0;
      const unreviewed = list.filter((p) => p.reviewStatus === 'needs-review').length;
      return {
        subj,
        count: list.length,
        avg,
        grade: list.length ? getGradeLabel(avg).grade : '—',
        unreviewed,
      };
    });
  }, [papers]);

  // Weak-Topic Radar across filtered + all-subject papers
  const { topWeakUnits, allWeakUnits } = useMemo(() => {
    const subjCounts: Record<string, number> = {};
    const allCounts: Record<string, number> = {};
    for (const p of papers) {
      for (const uid of p.weakUnitIds ?? []) {
        allCounts[uid] = (allCounts[uid] ?? 0) + 1;
        if (p.subject === subjectFilter) {
          subjCounts[uid] = (subjCounts[uid] ?? 0) + 1;
        }
      }
    }
    const mapRanked = (rec: Record<string, number>, limit: number) =>
      Object.entries(rec)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([uid, count]) => ({ unit: findSyllabusUnit(uid), count }))
        .filter((item): item is { unit: NonNullable<ReturnType<typeof findSyllabusUnit>>; count: number } => Boolean(item.unit));
    return {
      topWeakUnits: mapRanked(subjCounts, 3),
      allWeakUnits: mapRanked(allCounts, 4),
    };
  }, [papers, subjectFilter]);

  const gradeInfo = chartPoints.length > 0 ? getGradeLabel(avgPercent) : getGradeLabel(0);

  const meta = SUBJECT_META[subjectFilter];
  const strokeColor = isDark ? meta.strokeDarkHex : meta.strokeHex;

  const svgW = 540;
  const svgH = 216;
  const padL = 38;
  const padR = 18;
  const padT = 18;
  const padB = 30;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const mappedCoords = chartPoints.map((pt, idx) => {
    const x =
      chartPoints.length === 1
        ? padL + plotW / 2
        : padL + (idx / (chartPoints.length - 1)) * plotW;
    const y = padT + (1 - pt.value / 100) * plotH;
    return { ...pt, x, y };
  });

  const activeCoord =
    mappedCoords.find((pt) => pt.paper.id === activePoint?.paper.id) ?? null;

  const smoothLinePath = buildSmoothSpline(mappedCoords);
  const areaPath =
    mappedCoords.length > 1
      ? `${smoothLinePath} L ${mappedCoords[mappedCoords.length - 1].x.toFixed(1)} ${(
          padT + plotH
        ).toFixed(1)} L ${mappedCoords[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : '';

  const aGradeTopY = padT;
  const aGradeBottomY = padT + (1 - 75 / 100) * plotH;

  const openNewPaperModal = () => {
    haptics.tap();
    setEditingPaperId(null);
    setPaperName('');
    setFormSubject(subjectFilter);
    setFormClass(CLASS_OPTIONS_BY_SUBJECT[subjectFilter][0]);
    setFormDate(getTodayISO());
    setFormFormat('both');
    setPart1Score('');
    setPart1Max('50');
    setPart2Score('');
    setPart2Max('100');
    setFormNote('');
    setFormWeakUnitIds([]);
    setFormMistakesText('');
    setScheduleReviewOnSave(true);
    setSheetOpen(true);
  };

  const openEditPaperModal = (entry: PaperEntry) => {
    haptics.tap();
    setEditingPaperId(entry.id);
    setPaperName(entry.paperName);
    setFormSubject(entry.subject);
    setFormClass(entry.classLabel);
    setFormDate(entry.date);
    setFormFormat(entry.format);
    setPart1Score(entry.part1Score !== undefined ? String(entry.part1Score) : '');
    setPart1Max(entry.part1Max !== undefined ? String(entry.part1Max) : '50');
    setPart2Score(entry.part2Score !== undefined ? String(entry.part2Score) : '');
    setPart2Max(entry.part2Max !== undefined ? String(entry.part2Max) : '100');
    setFormNote(entry.note ?? '');
    setFormWeakUnitIds(entry.weakUnitIds ?? []);
    setFormMistakesText((entry.mistakesChecklist ?? []).map((c) => c.text).join(', '));
    setScheduleReviewOnSave(entry.reviewStatus === 'needs-review');
    setSheetOpen(true);
  };

  const handleSubjectInFormChange = (subj: SubjectId) => {
    haptics.tick();
    setFormSubject(subj);
    setFormClass(CLASS_OPTIONS_BY_SUBJECT[subj][0]);
    setFormWeakUnitIds([]);
  };

  const toggleWeakUnitInForm = (unitId: string) => {
    haptics.tick();
    setFormWeakUnitIds((prev) => {
      if (prev.includes(unitId)) return prev.filter((id) => id !== unitId);
      if (prev.length >= 3) return [...prev.slice(1), unitId];
      return [...prev, unitId];
    });
  };

  const handleSavePaper = () => {
    haptics.success();
    const p1 = Number(part1Score) || 0;
    const p1Max = Math.max(1, Number(part1Max) || 50);
    const p2 = Number(part2Score) || 0;
    const p2Max = Math.max(1, Number(part2Max) || 100);

    let combined = 0;
    if (formFormat === 'both') {
      combined = Math.round(((p1 / p1Max) * 100 + (p2 / p2Max) * 100) / 2);
    } else if (formFormat === 'part1') {
      combined = Math.round((p1 / p1Max) * 100);
    } else {
      combined = Math.round((p2 / p2Max) * 100);
    }

    const existing = editingPaperId ? papers.find((p) => p.id === editingPaperId) : undefined;
    const parsedItems = formMistakesText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const existingMap = new Map(
      (existing?.mistakesChecklist ?? []).map((item) => [item.text.toLowerCase(), item.done]),
    );
    const mistakesChecklist: StudyChecklistItem[] = parsedItems.map((text, idx) => ({
      id: `pmk-${Date.now()}-${idx}`,
      text,
      done: existingMap.get(text.toLowerCase()) ?? false,
    }));

    const wantsReview =
      scheduleReviewOnSave || formWeakUnitIds.length > 0 || mistakesChecklist.length > 0;
    let nextStatus: PaperReviewStatus = existing?.reviewStatus ?? 'none';
    if (wantsReview && nextStatus !== 'reviewed') {
      nextStatus = 'needs-review';
    } else if (!scheduleReviewOnSave && nextStatus === 'needs-review' && formWeakUnitIds.length === 0 && mistakesChecklist.length === 0) {
      nextStatus = 'none';
    }

    const entry: PaperEntry = {
      id: editingPaperId ?? `paper-${Date.now()}`,
      paperName: paperName.trim() || `${SUBJECT_META[formSubject].short} Paper`,
      subject: formSubject,
      classLabel: formClass,
      date: formDate || getTodayISO(),
      format: formFormat,
      part1Score: formFormat !== 'part2' ? p1 : undefined,
      part1Max: formFormat !== 'part2' ? p1Max : undefined,
      part2Score: formFormat !== 'part1' ? p2 : undefined,
      part2Max: formFormat !== 'part1' ? p2Max : undefined,
      combinedPercent: Math.min(100, Math.max(0, combined)),
      note: formNote.trim() || undefined,
      reviewStatus: nextStatus,
      weakUnitIds: formWeakUnitIds,
      mistakesChecklist,
      linkedReviewTaskId: existing?.linkedReviewTaskId,
    };

    if (editingPaperId) {
      onUpdatePaper(entry);
    } else {
      onAddPaper(entry);
    }

    setSubjectFilter(formSubject);
    setSelectedPointId(entry.id);
    setSheetOpen(false);

    if (scheduleReviewOnSave && onCreateOrOpenReviewTask) {
      onCreateOrOpenReviewTask(entry, true);
    }
  };

  const chartAnimKey = `${subjectFilter}-${seriesMode}-${mappedCoords.length}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:px-6 lg:pt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#07142B] dark:text-white">
            Papers
          </h1>
          <p className="mt-0.5 text-xs text-[#0B234A]/70 dark:text-sky-200/75">
            Spectral trend analytics &amp; Part I / II scores
          </p>
        </div>

        <button
          type="button"
          onClick={openNewPaperModal}
          className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-transform duration-100 active:scale-95 whitespace-nowrap shrink-0 ${SUBJECT_ACTIVE_BTN[subjectFilter]}`}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Marks</span>
        </button>
      </div>

      {/* 3-Subject Scoreboard Strip */}
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        {subjectScoreboard.map((row) => {
          const item = SUBJECT_META[row.subj];
          const active = subjectFilter === row.subj;
          return (
            <button
              key={row.subj}
              type="button"
              onClick={() => {
                haptics.tick();
                setSubjectFilter(row.subj);
                setSelectedPointId(null);
              }}
              className={`relative overflow-hidden rounded-[24px] p-3 text-left transition-transform duration-100 active:scale-[0.98] ${
                active
                  ? `${SUBJECT_GLASS_CARD[row.subj]} shadow-md`
                  : 'ios-glass-tile opacity-85 hover:opacity-100'
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute bottom-2.5 left-1.5 top-2.5 w-1 rounded-full ${item.bar}`}
              />
              <div className="pl-2">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[11px] font-bold ${item.text}`}>{item.short}</span>
                  <span className={`font-brand text-sm font-bold ${item.text}`}>{row.grade}</span>
                </div>
                <p className="tabular-nums mt-0.5 text-lg font-bold text-[#07142B] dark:text-white">
                  {row.count > 0 ? `${row.avg}%` : '—'}
                </p>
                <p className="tabular-nums truncate text-[10px] text-[#0B234A]/70 dark:text-sky-200/75">
                  {row.count} logged{row.unreviewed > 0 ? ` · ${row.unreviewed} review` : ''}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bento Analytics Grid */}
      <div className="mt-4 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
        {/* Left Main Chart */}
        <section
          className={`ios-glass-hero flex flex-col justify-between rounded-[34px] border p-5 transition-colors duration-200 sm:p-6 lg:col-span-8 ${SUBJECT_GLASS_CARD[subjectFilter]}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {activePoint ? (
                <div className="flex flex-wrap items-baseline gap-2.5">
                  <span className={`tabular-nums text-3xl font-bold ${meta.text}`}>
                    {activePoint.value}%
                  </span>
                  <span className="text-xs font-semibold text-[#07142B] dark:text-sky-50">
                    {activePoint.paper.paperName}
                  </span>
                  <span className="text-[11px] text-[#0B234A]/65 dark:text-sky-200/70">
                    {activePoint.paper.date}
                  </span>
                </div>
              ) : (
                <span className={`text-xs font-semibold ${meta.text}`}>
                  {meta.name} Progress
                </span>
              )}
            </div>

            <div className="ios-glass relative flex items-center gap-1 rounded-full p-1">
              {(
                [
                  { id: 'combined', label: 'All' },
                  { id: 'part1', label: 'Part I' },
                  { id: 'part2', label: 'Part II' },
                ] as { id: SeriesMode; label: string }[]
              ).map((mode) => {
                const active = seriesMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setSeriesMode(mode.id);
                    }}
                    className={`min-h-[30px] rounded-full px-3 text-[11px] font-semibold transition-colors duration-150 ${
                      active
                        ? SUBJECT_ACTIVE_BTN[subjectFilter]
                        : 'text-[#0B234A]/70 dark:text-sky-100/80'
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4">
            {mappedCoords.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-xs text-[#0B234A]/65 dark:text-sky-200/70">
                No {meta.name} papers logged yet — tap Add Marks to start tracking.
              </div>
            ) : (
              <svg viewBox={`0 0 ${svgW} ${svgH}`} className="h-auto w-full overflow-visible">
                <defs>
                  <linearGradient id={`glassGrad-${subjectFilter}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Distinction A-Grade Zone (75% - 100%) */}
                <rect
                  x={padL}
                  y={aGradeTopY}
                  width={plotW}
                  height={aGradeBottomY - aGradeTopY}
                  rx={10}
                  fill="#10B981"
                  fillOpacity={isDark ? 0.08 : 0.07}
                />

                {[0, 25, 50, 75, 100].map((tick) => {
                  const y = padT + (1 - tick / 100) * plotH;
                  const isAGrade = tick === 75;
                  return (
                    <g key={tick}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={svgW - padR}
                        y2={y}
                        stroke="currentColor"
                        strokeDasharray={isAGrade ? '5 3' : '3 4'}
                        className={
                          isAGrade
                            ? 'text-emerald-500/55 dark:text-emerald-300/45'
                            : 'text-blue-500/20 dark:text-sky-200/15'
                        }
                      />
                      <text
                        x={padL - 8}
                        y={y + 3.5}
                        textAnchor="end"
                        className={`tabular-nums text-[10px] ${
                          isAGrade
                            ? 'fill-emerald-700 font-semibold dark:fill-emerald-300'
                            : 'fill-[#0B234A]/60 dark:fill-sky-200/65'
                        }`}
                      >
                        {isAGrade ? '75 A' : `${tick}%`}
                      </text>
                    </g>
                  );
                })}

                {/* Interactive Crosshair Guideline on Active Score */}
                {activeCoord && (
                  <line
                    x1={activeCoord.x}
                    y1={padT}
                    x2={activeCoord.x}
                    y2={padT + plotH}
                    stroke={strokeColor}
                    strokeOpacity="0.4"
                    strokeDasharray="3 3"
                  />
                )}

                {areaPath && (
                  <path
                    d={areaPath}
                    fill={`url(#glassGrad-${subjectFilter})`}
                  />
                )}

                {mappedCoords.length > 1 && (
                  <path
                    d={smoothLinePath}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                )}

                {mappedCoords.map((pt) => {
                  const isActive = activePoint?.paper.id === pt.paper.id;
                  return (
                    <g
                      key={pt.paper.id}
                      className="cursor-pointer"
                      onClick={() => {
                        haptics.tick();
                        setSelectedPointId(pt.paper.id);
                      }}
                    >
                      {isActive && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={11}
                          fill="none"
                          stroke={strokeColor}
                          strokeOpacity={0.38}
                          strokeWidth={1.8}
                        />
                      )}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isActive ? 6.5 : 4.5}
                        fill={isDark ? '#061028' : '#FFFFFF'}
                        stroke={strokeColor}
                        strokeWidth={isActive ? 3 : 2.2}
                      />
                      <text
                        x={pt.x}
                        y={svgH - 6}
                        textAnchor="middle"
                        className="fill-[#0B234A]/75 text-[10px] dark:fill-sky-100/80"
                      >
                        {pt.paper.paperName.replace(`${meta.short} `, '').slice(0, 11)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </section>

        {/* Right Analytics Telemetry Bento Deck */}
        <div className="flex flex-col justify-between gap-4 lg:col-span-4">
          {/* Projected Grade Band Card */}
          <section className="ios-glass-strong flex items-center justify-between gap-4 rounded-[32px] p-5">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                <Award className={`h-3.5 w-3.5 ${meta.text}`} />
                <span>Projected Band</span>
              </div>
              <div className="mt-1 flex items-baseline gap-2.5">
                <span className={`font-brand text-4xl font-bold ${meta.text}`}>
                  {gradeInfo.grade}
                </span>
                <span className="text-xs font-medium text-[#07142B] dark:text-sky-50">
                  {gradeInfo.note}
                </span>
              </div>
            </div>

            <div className="text-right tabular-nums">
              <p className="text-xs text-[#0B234A]/70 dark:text-sky-200/75">Average</p>
              <p className="text-2xl font-bold text-[#07142B] dark:text-white">
                {avgPercent}%
              </p>
            </div>
          </section>

          {/* Momentum & Best Card */}
          <section className="ios-glass grid grid-cols-2 divide-x divide-white/35 rounded-[30px] py-4 text-center dark:divide-sky-300/18">
            <div>
              <p className="tabular-nums text-xl font-bold text-[#07142B] dark:text-white">
                {bestPercent}%
              </p>
              <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">Peak Score</p>
            </div>
            <div>
              <p
                className={`tabular-nums inline-flex items-center justify-center gap-1 text-xl font-bold ${
                  latestDelta >= 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-orange-600 dark:text-orange-300'
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                <span>{latestDelta >= 0 ? `+${latestDelta}%` : `${latestDelta}%`}</span>
              </p>
              <p className="text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">Last Change</p>
            </div>
          </section>

          {/* Part I MCQ vs Part II Essay Split */}
          <section className="ios-glass flex flex-1 flex-col justify-between gap-3 rounded-[32px] p-5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#07142B] dark:text-white">
                Part I vs Part II Balance
              </span>
              <span className="tabular-nums text-[#0B234A]/70 dark:text-sky-200/75">
                {filteredPapers.length} papers
              </span>
            </div>

            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-[11px] text-[#0B234A]/75 dark:text-sky-100/80">
                  <span>Part I · MCQ</span>
                  <span className="tabular-nums font-semibold">{p1Avg}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                  <div
                    style={{ width: `${p1Avg}%` }}
                    className={`h-full rounded-full transition-[width] duration-300 ease-out ${meta.bar}`}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[#0B234A]/75 dark:text-sky-100/80">
                  <span>Part II · Structured / Essay</span>
                  <span className="tabular-nums font-semibold">{p2Avg}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                  <div
                    style={{ width: `${p2Avg}%` }}
                    className={`h-full rounded-full transition-[width] duration-300 ease-out ${meta.bar}`}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Review Chain & Weak-Topic Radar (Ability #6) */}
      {(topWeakUnits.length > 0 || reviewChainActive || onOpenAbilities) && (
        <section className="ios-glass mt-4 rounded-[28px] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#07142B] dark:text-white">
              <Sparkles className={`h-3.5 w-3.5 ${meta.text}`} />
              <span>
                {reviewChainActive
                  ? 'Review Chain & Weak-Topic Radar (1.5× XP Active)'
                  : `Most Missed ${meta.short} Units`}
              </span>
            </span>
            {reviewChainActive ? (
              <span className="rounded-full bg-emerald-500/18 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                1.5× Review XP (+60 XP)
              </span>
            ) : (
              onOpenAbilities && (
                <button
                  type="button"
                  onClick={() => {
                    haptics.tap();
                    onOpenAbilities();
                  }}
                  className="rounded-full bg-cyan-500/15 px-2.5 py-1 text-[10.5px] font-bold text-blue-700 dark:text-cyan-300"
                >
                  Unlock 1.5× Review Chain (Platinum)
                </button>
              )
            )}
          </div>

          {reviewChainActive && allWeakUnits.length > 0 ? (
            <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {allWeakUnits.map((w) => {
                const um = SUBJECT_META[w.unit.subject];
                return (
                  <div
                    key={w.unit.id}
                    className="ios-glass-control flex items-center justify-between gap-2 rounded-[18px] px-3 py-2 text-xs"
                  >
                    <span className="truncate font-semibold text-[#07142B] dark:text-white">
                      <span className={`font-bold ${um.text}`}>{um.short} {w.unit.code}</span> · {w.unit.title}
                    </span>
                    <span className="tabular-nums shrink-0 rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-600 dark:text-orange-300">
                      {w.count}x missed
                    </span>
                  </div>
                );
              })}
            </div>
          ) : topWeakUnits.length > 0 ? (
            <p className="mt-1.5 text-[11px] font-medium text-[#0B234A]/80 dark:text-sky-100/85">
              {topWeakUnits.map((w) => `${w.unit.code}: ${w.unit.title} (${w.count}x)`).join(' · ')}
            </p>
          ) : (
            <p className="mt-1.5 text-[11px] text-[#0B234A]/65 dark:text-sky-200/75">
              Tag weak units inside papers to track recurring mistake hotspots across mocks.
            </p>
          )}
        </section>
      )}

      {/* 2-Column Paper Archive Grid with Review Sequel Actions */}
      {filteredPapers.length > 0 && (
        <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[...filteredPapers].reverse().map((entry) => {
            const p1Pct =
              entry.part1Score !== undefined && entry.part1Max
                ? Math.round((entry.part1Score / entry.part1Max) * 100)
                : null;
            const p2Pct =
              entry.part2Score !== undefined && entry.part2Max
                ? Math.round((entry.part2Score / entry.part2Max) * 100)
                : null;

            const linkedTask = entry.linkedReviewTaskId
              ? tasks.find((t) => t.id === entry.linkedReviewTaskId)
              : undefined;
            const checklistSource = linkedTask?.checklist ?? entry.mistakesChecklist ?? [];
            const doneMistakes = checklistSource.filter((c) => c.done).length;
            const totalMistakes = checklistSource.length;
            const weakUnitNames = (entry.weakUnitIds ?? [])
              .map((uid) => findSyllabusUnit(uid))
              .filter(Boolean)
              .map((u) => u!.code)
              .join(', ');

            const isReviewed =
              entry.reviewStatus === 'reviewed' || linkedTask?.status === 'completed';
            const needsReview = !isReviewed && entry.reviewStatus === 'needs-review';

            return (
              <div
                key={entry.id}
                className={`flex flex-col justify-between gap-3 rounded-[28px] border p-5 text-left ${SUBJECT_GLASS_CARD[entry.subject]}`}
              >
                <button
                  type="button"
                  onClick={() => openEditPaperModal(entry)}
                  className="w-full text-left transition-opacity active:opacity-80"
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className={`font-bold ${meta.text}`}>{meta.short}</span>
                        <span className="opacity-40">·</span>
                        <span className="tabular-nums text-[#0B234A]/70 dark:text-sky-200/75">
                          {entry.date}
                        </span>
                        {isReviewed && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Reviewed</span>
                            </span>
                          </>
                        )}
                        {needsReview && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="font-semibold text-orange-600 dark:text-orange-300">
                              Needs Review
                            </span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-[#07142B] dark:text-white">
                        {entry.paperName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[#0B234A]/75 dark:text-sky-100/80">
                        {entry.classLabel}
                        {weakUnitNames ? ` · Weak: ${weakUnitNames}` : ''}
                      </p>
                    </div>
                    <span className={`tabular-nums shrink-0 text-2xl font-bold ${meta.text}`}>
                      {entry.combinedPercent}%
                    </span>
                  </div>

                  {(p1Pct !== null || p2Pct !== null) && (
                    <div className="mt-3 grid w-full grid-cols-2 gap-3 border-t border-white/30 pt-2.5 text-[11px] dark:border-sky-300/15">
                      {p1Pct !== null && (
                        <div>
                          <div className="flex justify-between text-[#0B234A]/75 dark:text-sky-100/80">
                            <span>P1</span>
                            <span className="tabular-nums font-semibold">
                              {entry.part1Score}/{entry.part1Max}
                            </span>
                          </div>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                            <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${p1Pct}%` }} />
                          </div>
                        </div>
                      )}
                      {p2Pct !== null && (
                        <div>
                          <div className="flex justify-between text-[#0B234A]/75 dark:text-sky-100/80">
                            <span>P2</span>
                            <span className="tabular-nums font-semibold">
                              {entry.part2Score}/{entry.part2Max}
                            </span>
                          </div>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-blue-500/15 dark:bg-sky-300/15">
                            <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${p2Pct}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {totalMistakes > 0 && (
                    <p className="tabular-nums mt-2 text-[11px] text-[#0B234A]/75 dark:text-sky-200/80">
                      Mistakes checked: {doneMistakes}/{totalMistakes}
                    </p>
                  )}
                </button>

                {/* Paper Review Sequel Action Bar */}
                <div className="flex items-center gap-2 border-t border-white/25 pt-2.5 dark:border-sky-300/15">
                  {onCreateOrOpenReviewTask && (
                    <button
                      type="button"
                      onClick={() => {
                        haptics.tap();
                        onCreateOrOpenReviewTask(entry, true);
                      }}
                      className="ios-glass-control inline-flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-semibold text-blue-700 transition-transform duration-100 active:scale-95 dark:text-cyan-200"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      <span>
                        {linkedTask ? 'Open Review & Book Slot' : 'Review Mistakes & Book'}
                      </span>
                    </button>
                  )}
                  {onToggleReviewStatus && (
                    <button
                      type="button"
                      onClick={() => {
                        haptics.tick();
                        onToggleReviewStatus(entry);
                      }}
                      className={`inline-flex min-h-[36px] items-center gap-1 rounded-full px-3 text-[11px] font-semibold transition-transform duration-100 active:scale-95 ${
                        isReviewed
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                          : 'ios-glass-control text-[#07142B] dark:text-sky-100'
                      }`}
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                      <span>{isReviewed ? 'Reviewed' : 'Done'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <CrystalSheet open={sheetOpen} onClose={() => setSheetOpen(false)} maxWidthClass="max-w-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#07142B] dark:text-white">
            {editingPaperId ? 'Edit Paper Marks' : 'Add Paper Marks'}
          </h2>
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            aria-label="Close add marks modal"
            className="ios-glass-control inline-flex h-9 w-9 items-center justify-center rounded-full text-[#07142B] transition-transform duration-100 active:scale-90 dark:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Paper Name
            </label>
            <input
              type="text"
              value={paperName}
              onChange={(e) => setPaperName(e.target.value)}
              placeholder="e.g., Bio Paper 17 or 2023 A/L"
              className="ios-glass-control mt-1 min-h-[44px] w-full rounded-full px-4 text-sm text-[#07142B] placeholder:text-[#0B234A]/45 focus:outline-none dark:text-white dark:placeholder:text-sky-200/45"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Subject &amp; Class
            </label>
            <div className="ios-glass-control relative mt-1 grid grid-cols-3 gap-1 rounded-full p-1">
              {(['biology', 'physics', 'chemistry'] as SubjectId[]).map((subj) => {
                const item = SUBJECT_META[subj];
                const active = formSubject === subj;
                return (
                  <button
                    key={subj}
                    type="button"
                    onClick={() => handleSubjectInFormChange(subj)}
                    className={`min-h-[38px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                      active ? SUBJECT_ACTIVE_BTN[subj] : item.text
                    }`}
                  >
                    {item.name}
                  </button>
                );
              })}
            </div>

            <select
              value={formClass}
              onChange={(e) => setFormClass(e.target.value)}
              className="ios-glass-control mt-2 min-h-[44px] w-full rounded-full px-4 text-sm text-[#07142B] focus:outline-none dark:text-white"
            >
              {CLASS_OPTIONS_BY_SUBJECT[formSubject].map((cls) => (
                <option
                  key={cls}
                  value={cls}
                  className="bg-[#DCE8FA] text-[#07142B] dark:bg-[#081533] dark:text-white"
                >
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#0B234A]/70 dark:text-sky-200/75">
              Paper Mode
            </label>
            <div className="ios-glass-control relative mt-1 grid grid-cols-3 gap-1 rounded-full p-1">
              {(
                [
                  { id: 'both', label: 'Paper I & II' },
                  { id: 'part1', label: 'Paper I Only' },
                  { id: 'part2', label: 'Paper II Only' },
                ] as { id: PaperFormat; label: string }[]
              ).map((opt) => {
                const active = formFormat === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      haptics.tick();
                      setFormFormat(opt.id);
                    }}
                    className={`min-h-[36px] rounded-full text-xs font-semibold transition-colors duration-150 ${
                      active
                        ? SUBJECT_ACTIVE_BTN[formSubject]
                        : 'text-[#0B234A]/75 dark:text-sky-200/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {formFormat !== 'part2' && (
            <div className="ios-glass-control grid grid-cols-2 gap-3 rounded-[26px] p-3.5">
              <div>
                <label className="block text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                  Paper I Score
                </label>
                <input
                  type="number"
                  value={part1Score}
                  onChange={(e) => setPart1Score(e.target.value)}
                  placeholder="0"
                  className="ios-glass-control tabular-nums mt-1 min-h-[40px] w-full rounded-full px-3.5 text-sm text-[#07142B] focus:outline-none dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                  Out Of
                </label>
                <input
                  type="number"
                  value={part1Max}
                  onChange={(e) => setPart1Max(e.target.value)}
                  className="ios-glass-control tabular-nums mt-1 min-h-[40px] w-full rounded-full px-3.5 text-sm text-[#07142B] focus:outline-none dark:text-white"
                />
              </div>
            </div>
          )}

          {formFormat !== 'part1' && (
            <div className="ios-glass-control grid grid-cols-2 gap-3 rounded-[26px] p-3.5">
              <div>
                <label className="block text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                  Paper II Score
                </label>
                <input
                  type="number"
                  value={part2Score}
                  onChange={(e) => setPart2Score(e.target.value)}
                  placeholder="0"
                  className="ios-glass-control tabular-nums mt-1 min-h-[40px] w-full rounded-full px-3.5 text-sm text-[#07142B] focus:outline-none dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                  Out Of
                </label>
                <input
                  type="number"
                  value={part2Max}
                  onChange={(e) => setPart2Max(e.target.value)}
                  className="ios-glass-control tabular-nums mt-1 min-h-[40px] w-full rounded-full px-3.5 text-sm text-[#07142B] focus:outline-none dark:text-white"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                Date
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="ios-glass-control tabular-nums mt-1 min-h-[42px] w-full rounded-full px-3.5 text-xs text-[#07142B] focus:outline-none dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#0B234A]/70 dark:text-sky-200/75">
                Note (Optional)
              </label>
              <input
                type="text"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="Time mgmt, speed..."
                className="ios-glass-control mt-1 min-h-[42px] w-full rounded-full px-3.5 text-xs text-[#07142B] placeholder:text-[#0B234A]/45 focus:outline-none dark:text-white dark:placeholder:text-sky-200/45"
              />
            </div>
          </div>

          {/* Paper Review Sequel: Weak Units & Wrong Questions */}
          <div className="ios-glass-control space-y-3 rounded-[26px] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[#07142B] dark:text-white">
                  Schedule Mistake Review
                </p>
                <p className="text-[10.5px] text-[#0B234A]/70 dark:text-sky-200/75">
                  Auto-creates a Planner review task &amp; suggests a gap
                </p>
              </div>
              <LiquidSwitch
                checked={scheduleReviewOnSave}
                onToggle={() => setScheduleReviewOnSave((v) => !v)}
                ariaLabel="Toggle schedule mistake review"
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                Weak Units from this Paper (pick up to 3)
              </label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {SYLLABUS_UNITS[formSubject].map((u) => {
                  const selected = formWeakUnitIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleWeakUnitInForm(u.id)}
                      className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${
                        selected
                          ? SUBJECT_ACTIVE_BTN[formSubject]
                          : 'bg-white/45 text-[#07142B] dark:bg-sky-900/40 dark:text-sky-100'
                      }`}
                    >
                      {u.code}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[10.5px] font-medium text-[#0B234A]/70 dark:text-sky-200/75">
                Wrong Qs / Mistakes to Check (comma separated)
              </label>
              <input
                type="text"
                value={formMistakesText}
                onChange={(e) => setFormMistakesText(e.target.value)}
                placeholder="e.g., MCQ 14, MCQ 29, Essay Q5b formula"
                className="ios-glass-control mt-1 min-h-[40px] w-full rounded-full px-3.5 text-xs text-[#07142B] placeholder:text-[#0B234A]/45 focus:outline-none dark:text-white dark:placeholder:text-sky-200/45"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2.5">
          {editingPaperId && (
            <button
              type="button"
              onClick={() => {
                haptics.tap();
                onDeletePaper(editingPaperId);
                setSheetOpen(false);
              }}
              className="ios-glass-control inline-flex min-h-[48px] items-center justify-center gap-1.5 rounded-full px-5 text-xs font-semibold text-orange-600 transition-transform duration-100 active:scale-95 dark:text-orange-300"
            >
              <Trash2 className="h-4 w-4" />
              <span>Remove</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleSavePaper}
            className={`min-h-[48px] flex-1 rounded-full text-sm font-semibold transition-transform duration-100 active:scale-[0.98] ${SUBJECT_ACTIVE_BTN[formSubject]}`}
          >
            {editingPaperId ? 'Save Changes' : 'Save Marks'}
          </button>
        </div>
      </CrystalSheet>
    </div>
  );
});
