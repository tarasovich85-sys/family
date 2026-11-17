import { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Check,
  ClipboardCheck,
  Copy,
  DoorOpen,
  Home,
  Megaphone,
  MessageSquare,
  ShoppingBag,
  Snowflake,
  Sparkles,
  TreePine,
  Users,
  Wallet,
} from 'lucide-react';
import {
  ACCENT_THEME_MAP,
  DEFAULT_APPEARANCE_SETTINGS,
  formatDateRu,
  formatMoney,
  formatTimestampTime,
  formatUah,
  type AppAppearanceSettings,
  type ChildTask,
  type FamilyAnnouncement,
  type FamilyEvent,
  type FamilyMessage,
  type FamilyPersonProfile,
  type FamilyWorkspace,
  type HomeTask,
  type MoneyTransaction,
  type NavSection,
  type SavingsGoal,
  type ShoppingItem,
} from '../types/family';
import { ImageLightbox } from './ImageLightbox';
import { ResilientImage } from './ResilientImage';

interface OverviewSectionProps {
  family: FamilyWorkspace;
  appearance?: AppAppearanceSettings | null;
  profiles: FamilyPersonProfile[];
  events: FamilyEvent[];
  messages: FamilyMessage[];
  transactions: MoneyTransaction[];
  goals: SavingsGoal[];
  shopping: ShoppingItem[];
  tasks: HomeTask[];
  childTasks?: ChildTask[];
  announcements?: FamilyAnnouncement[];
  unreadMessagesCount?: number;
  unreadEventsCount?: number;
  unreadTasksCount?: number;
  unreadBoardCount?: number;
  isOwner?: boolean;
  onNavigate: (section: NavSection) => void;
  onOpenAi?: () => void;
  onRequestLeaveFamily?: () => void;
}

export function OverviewSection({
  family,
  appearance,
  profiles,
  events,
  messages,
  transactions,
  goals,
  shopping,
  tasks,
  childTasks = [],
  announcements = [],
  unreadMessagesCount = 0,
  unreadEventsCount = 0,
  unreadTasksCount = 0,
  unreadBoardCount = 0,
  isOwner = false,
  onNavigate,
  onOpenAi,
  onRequestLeaveFamily,
}: OverviewSectionProps) {
  const [copied, setCopied] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const resolvedAppearance = appearance ?? DEFAULT_APPEARANCE_SETTINGS;
  const theme = ACCENT_THEME_MAP[resolvedAppearance.accentTheme] ?? ACCENT_THEME_MAP.teal;
  const isNewYear = resolvedAppearance.accentTheme === 'newyear';

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTxs = transactions.filter((t) => t.date.startsWith(currentMonth));
  const monthIncome = monthTxs
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const monthExpense = monthTxs
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const monthBalance = monthIncome - monthExpense;

  const openShopping = shopping.filter((item) => !item.checked);
  const openTasks = tasks.filter((task) => task.status === 'todo');
  const upcomingEvents = [...events]
    .filter((evt) => !evt.completed)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4);

  const sortedMessages = [...messages].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const ta = (a.createdAt as { seconds?: number })?.seconds ?? 0;
    const tb = (b.createdAt as { seconds?: number })?.seconds ?? 0;
    return tb - ta;
  });

  const activeGoals = goals.filter((g) => g.status === 'active').slice(0, 2);
  const activeChildTasks = childTasks.filter((t) => t.status !== 'closed' && t.status !== 'declined');
  const activeAnnouncements = [...announcements]
    .filter((a) => a.status === 'active')
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const ta = (a.createdAt as { seconds?: number })?.seconds ?? 0;
      const tb = (b.createdAt as { seconds?: number })?.seconds ?? 0;
      return tb - ta;
    });

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(family.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Split Banner */}
      <section
        className={`bg-white border rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch ${
          isNewYear ? 'border-amber-200 shadow-sm' : 'border-slate-200'
        }`}
      >
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            {isNewYear && (
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-red-700 mb-2">
                <TreePine className="w-4 h-4 text-emerald-700 shrink-0" />
                <Snowflake className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>Новогодний режим · С наступающим Новым годом!</span>
              </div>
            )}
            <div className="text-xs text-slate-500 mb-2">
              <span>Сводка дома</span>
              <span aria-hidden="true"> · </span>
              <span className="tabular-nums">{profiles.length} участников в профиле</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
              {resolvedAppearance.bannerTitle || family.name}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-xl mb-6">
              {resolvedAppearance.bannerSubtitle ||
                'Все важные договорённости, семейные планы, общий баланс и список дел по дому собраны в одном месте.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-3 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg">
              <span className="text-xs text-slate-500">Код семьи:</span>
              <span className="text-sm font-mono font-semibold text-slate-900">
                {family.inviteCode}
              </span>
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className={`inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap shrink-0 ${theme.iconAccent}`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Скопировано' : 'Копировать'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('communication')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${theme.primaryBtn}`}
            >
              <span>Написать в чат</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {onRequestLeaveFamily && (
              <button
                type="button"
                onClick={onRequestLeaveFamily}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  isOwner
                    ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100'
                    : 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <DoorOpen className="w-4 h-4 shrink-0" />
                <span>{isOwner ? 'Выйти и удалить семью' : 'Выйти из семьи'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 min-h-[200px] bg-slate-100 border-t lg:border-t-0 lg:border-l border-slate-200">
          <ResilientImage
            src="/src/assets/images/home_interior_card_1794860480767.jpg"
            alt="Семейная кухня и обеденная зона"
            className="w-full h-full object-cover"
            fallbackLabel={family.name}
          />
        </div>
      </section>

      {onOpenAi && (
        <section className={`border rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${theme.softBg} ${theme.softBorder}`}>
          <div className="flex items-start gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg bg-white border ${theme.softBorder} flex items-center justify-center shrink-0`}>
              <Sparkles className={`w-4 h-4 ${theme.iconAccent}`} />
            </div>
            <div className="min-w-0">
              <div className={`text-sm font-semibold ${theme.softText}`}>
                Нейросеть управления приложением
              </div>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                Меняйте цвета, названия разделов, объявления, правила семьи или добавляйте покупки и задания по одному запросу — сразу для всех участников.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenAi}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${theme.primaryBtn}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Открыть нейросеть</span>
          </button>
        </section>
      )}

      {/* Shared Family Notes / Rules added via AI */}
      {resolvedAppearance.customNotes.length > 0 && (
        <section className={`border rounded-xl p-5 ${theme.softBg} ${theme.softBorder}`}>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className={`w-4 h-4 shrink-0 ${theme.iconAccent}`} />
              <h3 className={`text-sm font-semibold ${theme.softText}`}>
                Договорённости и правила семьи
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {resolvedAppearance.customNotes.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {resolvedAppearance.customNotes.map((note, idx) => (
              <div
                key={`rule_${idx}`}
                className="bg-white/90 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm text-slate-800"
              >
                {note}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('money')}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
            <span>Баланс за месяц</span>
            <Wallet className={`w-4 h-4 ${theme.iconAccent}`} />
          </div>
          <div
            className={`text-2xl font-bold font-mono tabular-nums mb-1 ${
              monthBalance >= 0 ? 'text-slate-900' : 'text-red-700'
            }`}
          >
            {formatMoney(monthBalance, family.currency)}
          </div>
          <div className="text-xs text-slate-500 tabular-nums">
            Доход {formatMoney(monthIncome, family.currency)} · Расход{' '}
            {formatMoney(monthExpense, family.currency)}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
            <span>Нужно купить</span>
            <ShoppingBag className={`w-4 h-4 ${theme.iconAccent}`} />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mb-1">
            {openShopping.length}
          </div>
          <div className="text-xs text-slate-500">
            {openShopping.length > 0
              ? `Например: ${openShopping[0].name}`
              : 'Список покупок пуст'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
            <span>Дела по дому</span>
            <Home className={`w-4 h-4 ${theme.iconAccent}`} />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mb-1">
            {openTasks.length}
          </div>
          <div className="text-xs text-slate-500">
            {openTasks.length > 0
              ? `Ближайшее: ${openTasks[0].title}`
              : 'Все домашние дела выполнены'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('family')}
          className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
            <span>События семьи</span>
            <Users className={`w-4 h-4 ${theme.iconAccent}`} />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mb-1">
            {upcomingEvents.length}
          </div>
          <div className="text-xs text-slate-500">
            {upcomingEvents.length > 0
              ? `${formatDateRu(upcomingEvents[0].date)} · ${upcomingEvents[0].title}`
              : 'Нет ближайших событий'}
          </div>
        </button>
      </section>

      {/* 2-Column Activity Overview */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Bulletin Board + Messages + Upcoming Events */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Megaphone className={`w-4 h-4 ${theme.iconAccent}`} />
                <h3 className="text-base font-semibold text-slate-900">
                  Доска объявлений
                </h3>
                {unreadBoardCount > 0 && (
                  <span className={`text-xs font-mono tabular-nums font-semibold ${theme.iconAccent}`}>
                    · {unreadBoardCount} новых
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onNavigate('board')}
                className={`text-xs font-medium hover:opacity-80 whitespace-nowrap shrink-0 ${theme.iconAccent}`}
              >
                Открыть доску →
              </button>
            </div>

            {activeAnnouncements.length === 0 ? (
              <p className="text-sm text-slate-500 py-3">
                На доске пока нет объявлений. Разместите важное напоминание или заметку в разделе «Объявления».
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeAnnouncements.slice(0, 3).map((item) => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
                      <div className="truncate">
                        <span className="font-medium text-slate-800">{item.category}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{item.authorName}</span>
                        {item.pinned && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className={`font-medium ${theme.iconAccent}`}>Закреплено</span>
                          </>
                        )}
                      </div>
                      <span className="tabular-nums shrink-0">
                        {formatTimestampTime(item.createdAt) || 'Только что'}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                        {!(item.body === 'Изображение' && item.imageDataUrl) && (
                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2 mt-0.5">
                            {item.body}
                          </p>
                        )}
                      </div>
                      {item.imageDataUrl && (
                        <button
                          type="button"
                          onClick={() => setLightboxUrl(item.imageDataUrl || null)}
                          className="shrink-0 rounded-md overflow-hidden border border-slate-200 hover:opacity-90 cursor-zoom-in"
                          title="Увеличить изображение"
                        >
                          <img
                            src={item.imageDataUrl}
                            alt={item.title}
                            className="w-12 h-12 object-cover"
                          />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className={`w-4 h-4 ${theme.iconAccent}`} />
                <h3 className="text-base font-semibold text-slate-900">
                  Общение и объявления
                </h3>
                {unreadMessagesCount > 0 && (
                  <span className={`text-xs font-mono tabular-nums font-semibold ${theme.iconAccent}`}>
                    · {unreadMessagesCount} новых
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onNavigate('communication')}
                className={`text-xs font-medium hover:opacity-80 whitespace-nowrap shrink-0 ${theme.iconAccent}`}
              >
                Открыть чат →
              </button>
            </div>

            {sortedMessages.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                Пока нет сообщений. Напишите первую заметку для семьи в разделе «Общение».
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {sortedMessages.slice(0, 4).map((msg) => (
                  <div key={msg.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
                      <div>
                        <span className="font-medium text-slate-800">{msg.authorName}</span>
                        <span aria-hidden="true"> · </span>
                        <span>{msg.topic}</span>
                        {msg.pinned && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className={`font-medium ${theme.iconAccent}`}>Закреплено</span>
                          </>
                        )}
                      </div>
                      <span className="tabular-nums">{formatTimestampTime(msg.createdAt)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {!(msg.text === 'Изображение' && msg.imageDataUrl) && (
                          <p className="text-sm text-slate-700 leading-relaxed">{msg.text}</p>
                        )}
                      </div>
                      {msg.imageDataUrl && (
                        <button
                          type="button"
                          onClick={() => setLightboxUrl(msg.imageDataUrl || null)}
                          className="shrink-0 rounded-md overflow-hidden border border-slate-200 hover:opacity-90 cursor-zoom-in"
                          title="Увеличить изображение"
                        >
                          <img
                            src={msg.imageDataUrl}
                            alt="Прикреплённое изображение"
                            className="w-12 h-12 object-cover"
                          />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className={`w-4 h-4 ${theme.iconAccent}`} />
                <h3 className="text-base font-semibold text-slate-900">
                  Ближайшие события семьи
                </h3>
                {unreadEventsCount > 0 && (
                  <span className={`text-xs font-mono tabular-nums font-semibold ${theme.iconAccent}`}>
                    · {unreadEventsCount} новых
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onNavigate('family')}
                className={`text-xs font-medium hover:opacity-80 whitespace-nowrap shrink-0 ${theme.iconAccent}`}
              >
                Весь календарь →
              </button>
            </div>

            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                Нет запланированных событий. Добавьте важные даты в разделе «Семья».
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {evt.title}
                      </div>
                      <div className="text-xs text-slate-500">
                        <span>{evt.category}</span>
                        {evt.assigneeName && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span>{evt.assigneeName}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-xs font-mono tabular-nums text-slate-600 shrink-0">
                      {formatDateRu(evt.date)}
                      {evt.time ? ` ${evt.time}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Savings Goals + Home Summary */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-base font-semibold text-slate-900">Цели накоплений</h3>
              <button
                type="button"
                onClick={() => onNavigate('money')}
                className={`text-xs font-medium hover:opacity-80 whitespace-nowrap shrink-0 ${theme.iconAccent}`}
              >
                Управление бюджетом →
              </button>
            </div>

            {activeGoals.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">
                Активных целей накопления пока нет.
              </p>
            ) : (
              <div className="space-y-4">
                {activeGoals.map((goal) => {
                  const pct = Math.min(
                    100,
                    Math.round((goal.currentAmount / Math.max(goal.targetAmount, 1)) * 100)
                  );
                  return (
                    <div key={goal.id} className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">{goal.title}</span>
                        <span className="text-xs font-mono tabular-nums text-slate-600">
                          {pct}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isNewYear ? 'bg-red-700' : 'bg-teal-700'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums">
                        {formatMoney(goal.currentAmount, family.currency)} из{' '}
                        {formatMoney(goal.targetAmount, family.currency)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h3 className="text-base font-semibold text-slate-900">Покупки и дела</h3>
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className={`text-xs font-medium hover:opacity-80 whitespace-nowrap shrink-0 ${theme.iconAccent}`}
              >
                Открыть «Дом» →
              </button>
            </div>

            <div className="space-y-3">
              {openShopping.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-800 truncate">{item.name}</span>
                  <span className="text-xs text-slate-500 shrink-0 ml-2">
                    {item.quantity || item.category}
                  </span>
                </div>
              ))}
              {openTasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between text-sm pt-2 border-t border-slate-100"
                >
                  <span className="text-slate-800 truncate">{task.title}</span>
                  <span className="text-xs text-slate-500 shrink-0 ml-2">{task.area}</span>
                </div>
              ))}
              {openShopping.length === 0 && openTasks.length === 0 && (
                <p className="text-sm text-slate-500 py-2">
                  Все покупки куплены и домашние дела закрыты.
                </p>
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className={`w-4 h-4 ${theme.iconAccent}`} />
                <h3 className="text-base font-semibold text-slate-900">Задания за гривны</h3>
                {unreadTasksCount > 0 && (
                  <span className={`text-xs font-mono tabular-nums font-semibold ${theme.iconAccent}`}>
                    · {unreadTasksCount} новых
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onNavigate('tasks')}
                className={`text-xs font-medium hover:opacity-80 whitespace-nowrap shrink-0 ${theme.iconAccent}`}
              >
                Открыть «Задания» →
              </button>
            </div>

            {activeChildTasks.length === 0 ? (
              <p className="text-sm text-slate-500 py-2">
                Активных заданий с оплатой в гривнах пока нет.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeChildTasks.slice(0, 3).map((ct) => (
                  <div key={ct.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-800 truncate">{ct.title}</span>
                    <span className={`text-xs font-mono tabular-nums font-semibold shrink-0 ${theme.iconAccent}`}>
                      {formatUah(ct.rewardUah)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <ImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}
