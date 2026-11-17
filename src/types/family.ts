export type CurrencyCode = 'RUB' | 'USD' | 'EUR' | 'UAH';

export type NavSection = 'overview' | 'board' | 'family' | 'tasks' | 'communication' | 'money' | 'home';

export const CURRENCY_META: Record<CurrencyCode, { symbol: string; label: string }> = {
  RUB: { symbol: '₽', label: 'Российский рубль (₽)' },
  USD: { symbol: '$', label: 'Доллар США ($)' },
  EUR: { symbol: '€', label: 'Евро (€)' },
  UAH: { symbol: '₴', label: 'Гривна (₴)' },
};

export const FAMILY_ROLES = [
  'Создатель',
  'Мама',
  'Папа',
  'Ребёнок',
  'Бабушка',
  'Дедушка',
  'Родственник',
  'Участник',
] as const;
export type FamilyRole = (typeof FAMILY_ROLES)[number];

export const TASK_MANAGER_ROLES: readonly FamilyRole[] = ['Создатель', 'Мама', 'Папа'];

export const RELATION_OPTIONS = ['Взрослый', 'Ребёнок', 'Родственник', 'Питомец'] as const;
export type FamilyRelation = (typeof RELATION_OPTIONS)[number];

export const EVENT_CATEGORIES = ['Праздник', 'Здоровье', 'Школа и сад', 'Семейное дело', 'Другое'] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const MESSAGE_TOPICS = ['Общее', 'Покупки', 'Планы', 'Важное'] as const;
export type MessageTopic = (typeof MESSAGE_TOPICS)[number];

export const ANNOUNCEMENT_CATEGORIES = [
  'Важное',
  'Напоминание',
  'Покупки и быт',
  'Праздник',
  'Отдам / Найду',
  'Другое',
] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export const TRANSACTION_CATEGORIES = [
  'Продукты',
  'Дом и ЖКУ',
  'Транспорт',
  'Дети',
  'Здоровье',
  'Досуг',
  'Одежда',
  'Зарплата',
  'Подработка',
  'Накопления',
  'Прочее',
] as const;
export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  'Продукты',
  'Дом и ЖКУ',
  'Транспорт',
  'Дети',
  'Здоровье',
  'Досуг',
  'Одежда',
  'Накопления',
  'Прочее',
];

export const INCOME_CATEGORIES: TransactionCategory[] = [
  'Зарплата',
  'Подработка',
  'Накопления',
  'Прочее',
];

export const SHOPPING_CATEGORIES = ['Продукты', 'Быт', 'Аптека', 'Другое'] as const;
export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export const HOME_TASK_AREAS = ['Уборка', 'Ремонт и быт', 'ЖКУ и счета', 'Питомцы', 'Другое'] as const;
export type HomeTaskArea = (typeof HOME_TASK_AREAS)[number];

export const RECURRENCE_OPTIONS = ['Разовое', 'Еженедельно', 'Ежемесячно'] as const;
export type TaskRecurrence = (typeof RECURRENCE_OPTIONS)[number];

export type ChildTaskStatus =
  | 'pending'
  | 'declined'
  | 'in_progress'
  | 'submitted'
  | 'needs_fix'
  | 'approved'
  | 'closed';

// Blueprint boundary constants
export const LIMITS = {
  DISPLAY_NAME_MAX: 80,
  FAMILY_NAME_MAX: 80,
  BRAND_NAME_MAX: 60,
  SECTION_LABEL_MAX: 40,
  CUSTOM_NOTE_MAX: 200,
  TITLE_MAX: 120,
  SHORT_TITLE_MAX: 100,
  DESCRIPTION_MAX: 500,
  NOTE_MAX: 240,
  MESSAGE_MAX: 1000,
  ANNOUNCEMENT_BODY_MAX: 1000,
  NOTIFICATION_BODY_MAX: 240,
  QUANTITY_MAX: 40,
  DATE_MAX: 20,
  TIME_MAX: 10,
  PHOTO_DATA_MAX: 300_000,
  REWARD_UAH_MAX: 1_000_000,
  AMOUNT_MAX: 1_000_000_000,
} as const;

export type AccentTheme = 'teal' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate' | 'newyear';
export type SurfaceMode = 'light' | 'warm' | 'slate' | 'snow';

export interface AppAppearanceSettings {
  id: 'appearance';
  familyId: string;
  brandName: string;
  accentTheme: AccentTheme;
  surfaceMode: SurfaceMode;
  bannerTitle: string;
  bannerSubtitle: string;
  liveAnnouncement: string;
  hiddenSections: Exclude<NavSection, 'overview'>[];
  sectionLabels: Partial<Record<NavSection, string>>;
  customNotes: string[];
  updatedByUid: string;
  updatedByName: string;
  updatedAt?: unknown;
}

export const DEFAULT_APPEARANCE_SETTINGS: Omit<
  AppAppearanceSettings,
  'familyId' | 'updatedByUid' | 'updatedByName'
> = {
  id: 'appearance',
  brandName: 'Семья',
  accentTheme: 'newyear',
  surfaceMode: 'snow',
  bannerTitle: '',
  bannerSubtitle: 'Все важные договорённости, семейные планы, общий баланс и список дел по дому собраны в одном месте.',
  liveAnnouncement: '',
  hiddenSections: [],
  sectionLabels: {},
  customNotes: [],
};

export const ACCENT_THEME_MAP: Record<
  AccentTheme,
  {
    navActiveBg: string;
    navActiveText: string;
    iconAccent: string;
    primaryBtn: string;
    softBg: string;
    softBorder: string;
    softText: string;
  }
> = {
  teal: {
    navActiveBg: 'bg-teal-50',
    navActiveText: 'text-teal-800',
    iconAccent: 'text-teal-700',
    primaryBtn: 'bg-teal-700 hover:bg-teal-800 text-white',
    softBg: 'bg-teal-50',
    softBorder: 'border-teal-200',
    softText: 'text-teal-800',
  },
  indigo: {
    navActiveBg: 'bg-indigo-50',
    navActiveText: 'text-indigo-800',
    iconAccent: 'text-indigo-700',
    primaryBtn: 'bg-indigo-700 hover:bg-indigo-800 text-white',
    softBg: 'bg-indigo-50',
    softBorder: 'border-indigo-200',
    softText: 'text-indigo-800',
  },
  emerald: {
    navActiveBg: 'bg-emerald-50',
    navActiveText: 'text-emerald-800',
    iconAccent: 'text-emerald-700',
    primaryBtn: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    softBg: 'bg-emerald-50',
    softBorder: 'border-emerald-200',
    softText: 'text-emerald-800',
  },
  amber: {
    navActiveBg: 'bg-amber-50',
    navActiveText: 'text-amber-900',
    iconAccent: 'text-amber-700',
    primaryBtn: 'bg-amber-700 hover:bg-amber-800 text-white',
    softBg: 'bg-amber-50',
    softBorder: 'border-amber-200',
    softText: 'text-amber-900',
  },
  rose: {
    navActiveBg: 'bg-rose-50',
    navActiveText: 'text-rose-800',
    iconAccent: 'text-rose-700',
    primaryBtn: 'bg-rose-700 hover:bg-rose-800 text-white',
    softBg: 'bg-rose-50',
    softBorder: 'border-rose-200',
    softText: 'text-rose-800',
  },
  slate: {
    navActiveBg: 'bg-slate-200',
    navActiveText: 'text-slate-900',
    iconAccent: 'text-slate-800',
    primaryBtn: 'bg-slate-800 hover:bg-slate-900 text-white',
    softBg: 'bg-slate-100',
    softBorder: 'border-slate-300',
    softText: 'text-slate-900',
  },
  newyear: {
    navActiveBg: 'bg-red-50',
    navActiveText: 'text-red-800',
    iconAccent: 'text-emerald-700',
    primaryBtn: 'bg-red-700 hover:bg-red-800 text-white',
    softBg: 'bg-amber-50/90',
    softBorder: 'border-amber-200',
    softText: 'text-amber-900',
  },
};

export const SURFACE_MODE_MAP: Record<SurfaceMode, string> = {
  light: 'bg-[#F8FAFC]',
  warm: 'bg-[#FAF7F2]',
  slate: 'bg-slate-100',
  snow: 'bg-gradient-to-b from-[#EFF6FF] via-[#F8FAFC] to-[#FEF7EC]',
};

export interface UserProfile {
  uid: string;
  displayName: string;
  activeFamilyId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FamilyWorkspace {
  id: string;
  name: string;
  currency: CurrencyCode;
  inviteCode: string;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FamilyMemberAccount {
  uid: string;
  familyId: string;
  displayName: string;
  role: 'owner' | 'member';
  familyRole?: FamilyRole;
  inviteCode: string;
  joinedAt?: unknown;
  lastReadMessagesAt?: unknown;
  lastReadEventsAt?: unknown;
  lastReadTasksAt?: unknown;
  lastReadBoardAt?: unknown;
  lastReadNotificationsAt?: unknown;
  pushEnabled?: boolean;
}

export interface FamilyNotification {
  id: string;
  familyId: string;
  kind: 'message' | 'event' | 'task' | 'ai' | 'board';
  action:
    | 'created'
    | 'completed'
    | 'reopened'
    | 'deleted'
    | 'accepted'
    | 'declined'
    | 'submitted'
    | 'approved'
    | 'rejected'
    | 'closed'
    | 'updated';
  title: string;
  body: string;
  targetSection: NavSection;
  actorUid: string;
  actorName: string;
  createdAt?: unknown;
}

export interface ChildTask {
  id: string;
  familyId: string;
  title: string;
  description: string;
  rewardUah: number;
  assigneeUid: string;
  assigneeName: string;
  status: ChildTaskStatus;
  proofMessage: string;
  proofPhotoDataUrl: string;
  taskPhotoDataUrl?: string;
  parentFeedback: string;
  feedbackPhotoDataUrl?: string;
  respondedByUid: string;
  respondedByName: string;
  createdBy: string;
  createdByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  approvedAt?: unknown;
  closedAt?: unknown;
}

export interface FamilyPersonProfile {
  id: string;
  familyId: string;
  name: string;
  relation: FamilyRelation;
  birthDate: string;
  note: string;
  linkedUid: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FamilyEvent {
  id: string;
  familyId: string;
  title: string;
  date: string;
  time: string;
  category: EventCategory;
  assigneeName: string;
  completed: boolean;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FamilyMessage {
  id: string;
  familyId: string;
  text: string;
  topic: MessageTopic;
  pinned: boolean;
  imageDataUrl?: string;
  authorUid: string;
  authorName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface FamilyAnnouncement {
  id: string;
  familyId: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  pinned: boolean;
  status: 'active' | 'archived';
  expiresAt: string;
  imageDataUrl?: string;
  authorUid: string;
  authorName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MoneyTransaction {
  id: string;
  familyId: string;
  type: 'income' | 'expense';
  amount: number;
  category: TransactionCategory;
  title: string;
  date: string;
  authorUid: string;
  authorName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavingsGoal {
  id: string;
  familyId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  status: 'active' | 'completed';
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ShoppingItem {
  id: string;
  familyId: string;
  name: string;
  quantity: string;
  category: ShoppingCategory;
  checked: boolean;
  addedByUid: string;
  addedByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface HomeTask {
  id: string;
  familyId: string;
  title: string;
  area: HomeTaskArea;
  assigneeName: string;
  dueDate: string;
  recurrence: TaskRecurrence;
  status: 'todo' | 'done';
  amount: number;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export function getMemberFamilyRoleLabel(
  member: FamilyMemberAccount | null | undefined,
  familyOwnerId?: string
): FamilyRole {
  if (!member) return 'Участник';
  if (member.familyRole) return member.familyRole;
  if (member.role === 'owner' || (familyOwnerId && member.uid === familyOwnerId)) {
    return 'Создатель';
  }
  return 'Участник';
}

export function isTaskManagerMember(
  member: FamilyMemberAccount | null | undefined,
  familyOwnerId?: string
): boolean {
  if (!member) return false;
  if (member.role === 'owner' || (familyOwnerId && member.uid === familyOwnerId)) {
    return true;
  }
  return Boolean(member.familyRole && TASK_MANAGER_ROLES.includes(member.familyRole));
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  const symbol = CURRENCY_META[currency]?.symbol ?? '₽';
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return `${formatted} ${symbol}`;
}

export function formatUah(amount: number): string {
  const formatted = new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return `${formatted} грн`;
}

export function formatDateRu(isoDate: string): string {
  if (!isoDate || isoDate.length < 10) return isoDate;
  const parsed = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
  }).format(parsed);
}

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function timestampToMillis(ts: unknown): number {
  if (!ts || typeof ts !== 'object') return 0;
  const maybe = ts as {
    toMillis?: () => number;
    toDate?: () => Date;
    seconds?: number;
    nanoseconds?: number;
  };
  if (typeof maybe.toMillis === 'function') {
    return maybe.toMillis();
  }
  if (typeof maybe.toDate === 'function') {
    const t = maybe.toDate().getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof maybe.seconds === 'number') {
    const ms = maybe.seconds * 1000 + Math.floor((maybe.nanoseconds ?? 0) / 1_000_000);
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}

export function formatTimestampTime(ts: unknown): string {
  const ms = timestampToMillis(ts);
  if (!ms) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));
}
