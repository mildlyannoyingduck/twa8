import {
  ClassPreset,
  DayOfWeek,
  SubjectId,
  SyllabusUnit,
  TaskImportance,
  TimetableSlot,
} from '../types';
import { addDaysISO, getTodayISO } from '../utils/dateUtils';

export const SUBJECT_META: Record<
  SubjectId,
  {
    name: string;
    short: string;
    text: string;
    bgSoft: string;
    borderSoft: string;
    bar: string;
    strokeHex: string;
    strokeDarkHex: string;
    accentHex: string;
  }
> = {
  biology: {
    name: 'Biology',
    short: 'Bio',
    text: 'text-emerald-700 dark:text-emerald-300',
    bgSoft: 'bg-emerald-500/10 dark:bg-emerald-400/12',
    borderSoft: 'border-emerald-500/30 dark:border-emerald-400/30',
    bar: 'bg-emerald-500 dark:bg-emerald-400',
    strokeHex: '#059669',
    strokeDarkHex: '#34D399',
    accentHex: '#10B981',
  },
  physics: {
    name: 'Physics',
    short: 'Phy',
    text: 'text-orange-700 dark:text-orange-300',
    bgSoft: 'bg-orange-500/10 dark:bg-orange-400/12',
    borderSoft: 'border-orange-500/30 dark:border-orange-400/30',
    bar: 'bg-orange-500 dark:bg-orange-400',
    strokeHex: '#EA580C',
    strokeDarkHex: '#FB923C',
    accentHex: '#F97316',
  },
  chemistry: {
    name: 'Chemistry',
    short: 'Chem',
    text: 'text-violet-700 dark:text-violet-300',
    bgSoft: 'bg-violet-500/12 dark:bg-violet-400/14',
    borderSoft: 'border-violet-500/35 dark:border-violet-400/35',
    bar: 'bg-violet-600 dark:bg-violet-400',
    strokeHex: '#7C3AED',
    strokeDarkHex: '#A78BFA',
    accentHex: '#8B5CF6',
  },
};

export const IMPORTANCE_META: Record<
  TaskImportance,
  {
    label: string;
    short: string;
    text: string;
    activeClass: string;
  }
> = {
  low: {
    label: 'Low · Flexible',
    short: 'Low',
    text: 'text-[#0B234A]/70 dark:text-sky-200/75',
    activeClass: 'bg-sky-600 text-white shadow-sm dark:bg-sky-500',
  },
  medium: {
    label: 'Medium · Steady',
    short: 'Medium',
    text: 'text-blue-700 dark:text-cyan-300',
    activeClass: 'bg-blue-600 text-white shadow-sm dark:bg-blue-500',
  },
  high: {
    label: 'High · Soon',
    short: 'High',
    text: 'text-orange-600 dark:text-orange-300',
    activeClass: 'bg-orange-500 text-white shadow-sm dark:bg-orange-500',
  },
  urgent: {
    label: 'Urgent · ASAP',
    short: 'Urgent',
    text: 'text-rose-600 dark:text-rose-300',
    activeClass: 'bg-rose-600 text-white shadow-sm dark:bg-rose-500',
  },
};

export const SUBJECT_GLASS_CARD: Record<SubjectId, string> = {
  biology: 'ios-glass-subj-bio text-[#07142B] dark:text-white',
  physics: 'ios-glass-subj-phy text-[#07142B] dark:text-white',
  chemistry: 'ios-glass-subj-chem text-[#07142B] dark:text-white',
};

export const GLASS_SUBJECT_BLOCK: Record<SubjectId, string> = {
  biology: 'ios-glass-subj-bio text-[#062C22] dark:text-emerald-50',
  physics: 'ios-glass-subj-phy text-[#3D1606] dark:text-orange-50',
  chemistry: 'ios-glass-subj-chem text-[#230E4D] dark:text-violet-50',
};

export const SUGGEST_SESSION_CHIPS = [30, 45, 60, 90, 120, 180];

export const SYLLABUS_UNITS: Record<SubjectId, SyllabusUnit[]> = {
  biology: [
    { id: 'bio-u01', subject: 'biology', number: 1, code: 'Unit 01', title: 'Introduction to Biology' },
    { id: 'bio-u02', subject: 'biology', number: 2, code: 'Unit 02', title: 'Chemical and Cellular Basis of Life' },
    { id: 'bio-u03', subject: 'biology', number: 3, code: 'Unit 03', title: 'Evolution and Diversity of Organisms' },
    { id: 'bio-u04', subject: 'biology', number: 4, code: 'Unit 04', title: 'Plant Form and Function' },
    { id: 'bio-u05', subject: 'biology', number: 5, code: 'Unit 05', title: 'Animal Form and Function' },
    { id: 'bio-u06', subject: 'biology', number: 6, code: 'Unit 06', title: 'Genetics' },
    { id: 'bio-u07', subject: 'biology', number: 7, code: 'Unit 07', title: 'Molecular Biology and Recombinant DNA Technology' },
    { id: 'bio-u08', subject: 'biology', number: 8, code: 'Unit 08', title: 'Environmental Biology' },
    { id: 'bio-u09', subject: 'biology', number: 9, code: 'Unit 09', title: 'Microbiology' },
    { id: 'bio-u10', subject: 'biology', number: 10, code: 'Unit 10', title: 'Applied Biology' },
  ],
  physics: [
    { id: 'phy-u01', subject: 'physics', number: 1, code: 'Unit 01', title: 'Measurement' },
    { id: 'phy-u02', subject: 'physics', number: 2, code: 'Unit 02', title: 'Mechanics' },
    { id: 'phy-u03', subject: 'physics', number: 3, code: 'Unit 03', title: 'Oscillations and Waves' },
    { id: 'phy-u04', subject: 'physics', number: 4, code: 'Unit 04', title: 'Thermal Physics' },
    { id: 'phy-u05', subject: 'physics', number: 5, code: 'Unit 05', title: 'Gravitational Field' },
    { id: 'phy-u06', subject: 'physics', number: 6, code: 'Unit 06', title: 'Electrostatic Field' },
    { id: 'phy-u07', subject: 'physics', number: 7, code: 'Unit 07', title: 'Magnetic Field' },
    { id: 'phy-u08', subject: 'physics', number: 8, code: 'Unit 08', title: 'Current Electricity' },
    { id: 'phy-u09', subject: 'physics', number: 9, code: 'Unit 09', title: 'Electronics' },
    { id: 'phy-u10', subject: 'physics', number: 10, code: 'Unit 10', title: 'Mechanical Properties of Matter' },
    { id: 'phy-u11', subject: 'physics', number: 11, code: 'Unit 11', title: 'Matter and Radiation' },
  ],
  chemistry: [
    { id: 'chem-u01', subject: 'chemistry', number: 1, code: 'Unit 01', title: 'Atomic Structure' },
    { id: 'chem-u02', subject: 'chemistry', number: 2, code: 'Unit 02', title: 'Structure and Bonding' },
    { id: 'chem-u03', subject: 'chemistry', number: 3, code: 'Unit 03', title: 'Chemical Calculations' },
    { id: 'chem-u04', subject: 'chemistry', number: 4, code: 'Unit 04', title: 'Gaseous State of Matter' },
    { id: 'chem-u05', subject: 'chemistry', number: 5, code: 'Unit 05', title: 'Energetics' },
    { id: 'chem-u06', subject: 'chemistry', number: 6, code: 'Unit 06', title: 'Chemistry of s, p and d Block Elements' },
    { id: 'chem-u07', subject: 'chemistry', number: 7, code: 'Unit 07', title: 'Basic Concepts of Organic Chemistry' },
    { id: 'chem-u08', subject: 'chemistry', number: 8, code: 'Unit 08', title: 'Hydrocarbons and Halohydrocarbons' },
    { id: 'chem-u09', subject: 'chemistry', number: 9, code: 'Unit 09', title: 'Oxygen Containing Organic Compounds' },
    { id: 'chem-u10', subject: 'chemistry', number: 10, code: 'Unit 10', title: 'Nitrogen Containing Organic Compounds' },
    { id: 'chem-u11', subject: 'chemistry', number: 11, code: 'Unit 11', title: 'Chemical Kinetics' },
    { id: 'chem-u12', subject: 'chemistry', number: 12, code: 'Unit 12', title: 'Equilibrium' },
    { id: 'chem-u13', subject: 'chemistry', number: 13, code: 'Unit 13', title: 'Electrochemistry' },
    { id: 'chem-u14', subject: 'chemistry', number: 14, code: 'Unit 14', title: 'Industrial Chemistry and Environmental Pollution' },
  ],
};

export const ALL_SYLLABUS_UNITS: SyllabusUnit[] = [
  ...SYLLABUS_UNITS.biology,
  ...SYLLABUS_UNITS.physics,
  ...SYLLABUS_UNITS.chemistry,
];

export function findSyllabusUnit(unitId?: string): SyllabusUnit | undefined {
  if (!unitId) return undefined;
  return ALL_SYLLABUS_UNITS.find((u) => u.id === unitId);
}

export const CLASS_PRESETS: ClassPreset[] = [
  {
    id: 'bio-theory',
    subject: 'biology',
    title: 'Biology Theory',
    teacher: 'Biology Class · Online',
    kind: 'Theory',
    defaultMode: 'online',
    defaultTravelBeforeMins: 0,
    defaultTravelAfterMins: 0,
    supportsReviseLoop: true,
  },
  {
    id: 'bio-paper-write',
    subject: 'biology',
    title: 'Biology Paper Writing',
    teacher: 'Biology Paper Hall · Physical',
    kind: 'Paper',
    defaultMode: 'physical',
    defaultTravelBeforeMins: 120,
    defaultTravelAfterMins: 120,
    supportsReviseLoop: false,
  },
  {
    id: 'bio-paper-disc',
    subject: 'biology',
    title: 'Biology Paper Discussion',
    teacher: 'Biology Discussion · Online',
    kind: 'Paper',
    defaultMode: 'online',
    defaultTravelBeforeMins: 0,
    defaultTravelAfterMins: 0,
    supportsReviseLoop: true,
  },
  {
    id: 'phy-theory',
    subject: 'physics',
    title: 'Physics Theory',
    teacher: 'Physics Class · Online',
    kind: 'Theory',
    defaultMode: 'online',
    defaultTravelBeforeMins: 0,
    defaultTravelAfterMins: 0,
    supportsReviseLoop: true,
  },
  {
    id: 'phy-revision',
    subject: 'physics',
    title: 'Physics Revision',
    teacher: 'Physics Revision · Online',
    kind: 'Revision',
    defaultMode: 'online',
    defaultTravelBeforeMins: 0,
    defaultTravelAfterMins: 0,
    supportsReviseLoop: true,
  },
  {
    id: 'phy-paper',
    subject: 'physics',
    title: 'Physics Paper Writing & Discussion',
    teacher: 'Physics Paper Hall · Physical',
    kind: 'Paper',
    defaultMode: 'physical',
    defaultTravelBeforeMins: 120,
    defaultTravelAfterMins: 210,
    supportsReviseLoop: true,
  },
  {
    id: 'phy-optics-catchup',
    subject: 'physics',
    title: 'Physics Optics (Catch-Up)',
    teacher: 'Ongoing Catch-Up · Online',
    kind: 'Catch-Up',
    defaultMode: 'online',
    defaultTravelBeforeMins: 0,
    defaultTravelAfterMins: 0,
    supportsReviseLoop: false,
  },
  {
    id: 'phy-grav-catchup',
    subject: 'physics',
    title: 'Physics Gravitational Fields (Catch-Up)',
    teacher: '2-Week Catch-Up · Online',
    kind: 'Catch-Up',
    defaultMode: 'online',
    defaultTravelBeforeMins: 0,
    defaultTravelAfterMins: 0,
    supportsReviseLoop: false,
  },
  {
    id: 'chem-theory',
    subject: 'chemistry',
    title: 'Chemistry Theory',
    teacher: 'Chemistry Class · Online',
    kind: 'Theory',
    defaultMode: 'online',
    defaultTravelBeforeMins: 0,
    defaultTravelAfterMins: 0,
    supportsReviseLoop: true,
  },
  {
    id: 'chem-paper-write',
    subject: 'chemistry',
    title: 'Chemistry Paper Writing',
    teacher: 'Chemistry Paper Hall · Physical',
    kind: 'Paper',
    defaultMode: 'physical',
    defaultTravelBeforeMins: 120,
    defaultTravelAfterMins: 150,
    supportsReviseLoop: false,
  },
  {
    id: 'chem-paper-disc',
    subject: 'chemistry',
    title: 'Chemistry Paper Discussion',
    teacher: 'Chemistry Discussion · Online',
    kind: 'Paper',
    defaultMode: 'online',
    defaultTravelBeforeMins: 0,
    defaultTravelAfterMins: 0,
    supportsReviseLoop: true,
  },
];

export const LEGACY_PRESET_MAP: Record<string, string> = {
  'bio-paper': 'bio-paper-write',
  'chem-paper': 'chem-paper-write',
  'phy-theory-rev': 'phy-theory',
};

export function buildCleanDefaultClassSlots(todayISO: string = getTodayISO()): TimetableSlot[] {
  const gravExpiryISO = addDaysISO(todayISO, 14);
  return [
    // MONDAY
    {
      id: 'cls-mon-phy-optics',
      day: 'Mon',
      startTime: '15:00',
      endTime: '19:00',
      category: 'class',
      subject: 'physics',
      classPresetId: 'phy-optics-catchup',
      unitId: 'phy-u03',
      title: 'Physics Optics (Catch-Up)',
      subtitle: 'Covering missed lesson · mark finished when done',
      autoBlock: true,
      mode: 'online',
      travelBeforeMins: 0,
      travelAfterMins: 0,
      isCatchUpClass: true,
    },
    {
      id: 'cls-mon-bio-theory',
      day: 'Mon',
      startTime: '19:00',
      endTime: '00:00',
      category: 'class',
      subject: 'biology',
      classPresetId: 'bio-theory',
      title: 'Biology Theory',
      subtitle: 'Weekly theory class · Online',
      autoBlock: true,
      mode: 'online',
      travelBeforeMins: 0,
      travelAfterMins: 0,
    },

    // TUESDAY
    {
      id: 'cls-tue-phy-theory',
      day: 'Tue',
      startTime: '19:00',
      endTime: '23:00',
      category: 'class',
      subject: 'physics',
      classPresetId: 'phy-theory',
      title: 'Physics Theory',
      subtitle: 'Weekly theory class · Online',
      autoBlock: true,
      mode: 'online',
      travelBeforeMins: 0,
      travelAfterMins: 0,
    },

    // WEDNESDAY: Open full day (Chemistry settled on Sunday morning)

    // THURSDAY
    {
      id: 'cls-thu-phy-paper',
      day: 'Thu',
      startTime: '07:00',
      endTime: '13:00',
      category: 'class',
      subject: 'physics',
      classPresetId: 'phy-paper',
      title: 'Physics Paper Writing & Discussion',
      subtitle: 'Physical · Leave 5:00 AM · Home ~4:30 PM',
      autoBlock: true,
      mode: 'physical',
      travelBeforeMins: 120,
      travelAfterMins: 210,
    },

    // FRIDAY (Bi-weekly alternation between Bio+Chem and Chem-only 8am–12pm)
    {
      id: 'cls-fri-bio-paper-a',
      day: 'Fri',
      startTime: '08:00',
      endTime: '12:00',
      category: 'class',
      subject: 'biology',
      classPresetId: 'bio-paper-write',
      title: 'Biology Paper Writing',
      subtitle: 'Bi-weekly Physical · Leave 6:00 AM',
      autoBlock: true,
      mode: 'physical',
      travelBeforeMins: 120,
      travelAfterMins: 120,
      weekPattern: 'week-a',
    },
    {
      id: 'cls-fri-chem-paper-a',
      day: 'Fri',
      startTime: '12:00',
      endTime: '15:00',
      category: 'class',
      subject: 'chemistry',
      classPresetId: 'chem-paper-write',
      title: 'Chemistry Paper Writing',
      subtitle: 'Physical (Bio Week) · Home ~4:30 PM',
      autoBlock: true,
      mode: 'physical',
      travelBeforeMins: 120,
      travelAfterMins: 90,
      weekPattern: 'week-a',
    },
    {
      id: 'cls-fri-chem-paper-b',
      day: 'Fri',
      startTime: '08:00',
      endTime: '12:00',
      category: 'class',
      subject: 'chemistry',
      classPresetId: 'chem-paper-write',
      title: 'Chemistry Paper Writing',
      subtitle: 'Physical (No-Bio Week) · Leave 6:00 AM · Home ~2:30 PM',
      autoBlock: true,
      mode: 'physical',
      travelBeforeMins: 120,
      travelAfterMins: 150,
      weekPattern: 'week-b',
    },
    {
      id: 'cls-fri-bio-theory',
      day: 'Fri',
      startTime: '19:00',
      endTime: '00:00',
      category: 'class',
      subject: 'biology',
      classPresetId: 'bio-theory',
      title: 'Biology Theory',
      subtitle: 'Weekly theory class · Online',
      autoBlock: true,
      mode: 'online',
      travelBeforeMins: 0,
      travelAfterMins: 0,
    },

    // SATURDAY
    {
      id: 'cls-sat-phy-grav',
      day: 'Sat',
      startTime: '07:00',
      endTime: '12:00',
      category: 'class',
      subject: 'physics',
      classPresetId: 'phy-grav-catchup',
      unitId: 'phy-u05',
      title: 'Physics Gravitational Fields (Catch-Up)',
      subtitle: `2-week catch-up block · finishes ${gravExpiryISO}`,
      autoBlock: true,
      mode: 'online',
      travelBeforeMins: 0,
      travelAfterMins: 0,
      expiresAtISO: gravExpiryISO,
      isCatchUpClass: true,
    },
    {
      id: 'cls-sat-chem-disc',
      day: 'Sat',
      startTime: '15:00',
      endTime: '17:30',
      category: 'class',
      subject: 'chemistry',
      classPresetId: 'chem-paper-disc',
      title: 'Chemistry Paper Discussion',
      subtitle: 'Weekly discussion · Online',
      autoBlock: true,
      mode: 'online',
      travelBeforeMins: 0,
      travelAfterMins: 0,
    },
    {
      id: 'cls-sat-bio-disc',
      day: 'Sat',
      startTime: '19:00',
      endTime: '00:00',
      category: 'class',
      subject: 'biology',
      classPresetId: 'bio-paper-disc',
      title: 'Biology Paper Discussion',
      subtitle: 'Weekly discussion · Online',
      autoBlock: true,
      mode: 'online',
      travelBeforeMins: 0,
      travelAfterMins: 0,
    },

    // SUNDAY
    {
      id: 'cls-sun-chem-theory',
      day: 'Sun',
      startTime: '08:00',
      endTime: '12:00',
      category: 'class',
      subject: 'chemistry',
      classPresetId: 'chem-theory',
      title: 'Chemistry Theory',
      subtitle: 'Sunday morning session · Online',
      autoBlock: true,
      mode: 'online',
      travelBeforeMins: 0,
      travelAfterMins: 0,
    },
    {
      id: 'cls-sun-phy-theory',
      day: 'Sun',
      startTime: '13:00',
      endTime: '17:30',
      category: 'class',
      subject: 'physics',
      classPresetId: 'phy-theory',
      title: 'Physics Theory',
      subtitle: 'Weekly theory class · Online',
      autoBlock: true,
      mode: 'online',
      travelBeforeMins: 0,
      travelAfterMins: 0,
    },
    {
      id: 'cls-sun-phy-revision',
      day: 'Sun',
      startTime: '19:30',
      endTime: '23:00',
      category: 'class',
      subject: 'physics',
      classPresetId: 'phy-revision',
      title: 'Physics Revision',
      subtitle: 'Weekly revision · Online',
      autoBlock: true,
      mode: 'online',
      travelBeforeMins: 0,
      travelAfterMins: 0,
    },
  ];
}

export const DAYS_ORDER: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const ALLOWED_APPS_ON_A07 = [
  { name: 'Phone', packageHint: 'com.samsung.android.dialer' },
  { name: 'Contacts', packageHint: 'com.samsung.android.app.contacts' },
  { name: 'Calculator', packageHint: 'com.sec.android.app.popupcalculator' },
  { name: 'Settings', packageHint: 'com.android.settings' },
  { name: 'This Week', packageHint: 'com.risinu.thisweek' },
];
