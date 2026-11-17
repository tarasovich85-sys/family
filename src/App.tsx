import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  ClipboardCheck,
  DoorOpen,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Snowflake,
  Sparkles,
  TreePine,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { AiAssistantPanel } from './components/AiAssistantPanel';
import { BulletinSection } from './components/BulletinSection';
import { CommunicationSection } from './components/CommunicationSection';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FamilyOnboarding } from './components/FamilyOnboarding';
import { FamilySection } from './components/FamilySection';
import { HomeSection } from './components/HomeSection';
import { LeaveFamilyModal } from './components/LeaveFamilyModal';
import { LoginScreen } from './components/LoginScreen';
import { MoneySection } from './components/MoneySection';
import { NewYearGarland, NewYearSnowOverlay } from './components/NewYearDecorations';
import { NotificationCenter, NotificationToast } from './components/NotificationCenter';
import { OverviewSection } from './components/OverviewSection';
import { ResilientImage } from './components/ResilientImage';
import { TasksSection } from './components/TasksSection';
import {
  clearUserActiveFamily,
  doesFamilyMemberExist,
  ensureUserProfile,
  leaveFamilyAsMember,
  markMemberReadState,
  saveAppAppearance,
  subscribeAnnouncements,
  subscribeAppAppearance,
  subscribeChildTasks,
  subscribeCurrentMember,
  subscribeEvents,
  subscribeFamilyWorkspace,
  subscribeGoals,
  subscribeHomeTasks,
  subscribeMembers,
  subscribeMessages,
  subscribeNotifications,
  subscribeProfiles,
  subscribeShopping,
  subscribeTransactions,
  subscribeUserProfile,
  wipeFamilyAndStartFresh,
} from './lib/familyService';
import { auth, logoutUser } from './lib/firebase';
import { sendBrowserNotification } from './lib/notifications';
import {
  ACCENT_THEME_MAP,
  DEFAULT_APPEARANCE_SETTINGS,
  getMemberFamilyRoleLabel,
  isTaskManagerMember,
  SURFACE_MODE_MAP,
  timestampToMillis,
  type AppAppearanceSettings,
  type ChildTask,
  type FamilyAnnouncement,
  type FamilyEvent,
  type FamilyMemberAccount,
  type FamilyMessage,
  type FamilyNotification,
  type FamilyPersonProfile,
  type FamilyWorkspace,
  type HomeTask,
  type MoneyTransaction,
  type NavSection,
  type SavingsGoal,
  type ShoppingItem,
  type UserProfile,
} from './types/family';

const NAV_ITEMS: { id: NavSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { id: 'board', label: 'Объявления', icon: Megaphone },
  { id: 'family', label: 'Семья', icon: Users },
  { id: 'tasks', label: 'Задания', icon: ClipboardCheck },
  { id: 'communication', label: 'Общение', icon: MessageSquare },
  { id: 'money', label: 'Деньги', icon: Wallet },
  { id: 'home', label: 'Дом', icon: Home },
];

const SECTION_TITLES: Record<NavSection, string> = {
  overview: 'Обзор семьи и дома',
  board: 'Доска объявлений',
  family: 'Семья и календарь',
  tasks: 'Семейные задания',
  communication: 'Семейное общение',
  money: 'Семейные деньги',
  home: 'Дом, покупки и быт',
};

function FamilyHubApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);

  const [family, setFamily] = useState<FamilyWorkspace | null>(null);
  const [familyReady, setFamilyReady] = useState(false);

  const [members, setMembers] = useState<FamilyMemberAccount[]>([]);
  const [profiles, setProfiles] = useState<FamilyPersonProfile[]>([]);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [transactions, setTransactions] = useState<MoneyTransaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [tasks, setTasks] = useState<HomeTask[]>([]);
  const [childTasks, setChildTasks] = useState<ChildTask[]>([]);
  const [announcements, setAnnouncements] = useState<FamilyAnnouncement[]>([]);
  const [notifications, setNotifications] = useState<FamilyNotification[]>([]);
  const [appearance, setAppearance] = useState<AppAppearanceSettings | null>(null);

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leavingFamily, setLeavingFamily] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [togglingTheme, setTogglingTheme] = useState(false);
  const [activeToast, setActiveToast] = useState<FamilyNotification | null>(null);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const notificationsHydratedRef = useRef(false);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());
  const isLeavingRef = useRef(false);

  if (fatalError) {
    throw fatalError;
  }

  // 1. Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        try {
          await ensureUserProfile(nextUser.uid, nextUser.displayName ?? 'Участник');
        } catch (err) {
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        }
      } else {
        setUserProfile(null);
        setProfileReady(false);
        setFamily(null);
        setFamilyReady(false);
      }
    });
    return unsub;
  }, []);

  // 2. User profile listener
  useEffect(() => {
    if (!authReady || !user) return;
    setProfileReady(false);
    const unsub = subscribeUserProfile(
      user.uid,
      (profile) => {
        setUserProfile(profile);
        setProfileReady(true);
      },
      (err) => setFatalError(err)
    );
    return unsub;
  }, [authReady, user]);

  // 3. Family workspace + subcollections listeners
  const activeFamilyId = userProfile?.activeFamilyId ?? '';

  useEffect(() => {
    if (!authReady || !user || !activeFamilyId) {
      isLeavingRef.current = false;
      setFamily(null);
      setFamilyReady(true);
      setMembers([]);
      setProfiles([]);
      setEvents([]);
      setMessages([]);
      setTransactions([]);
      setGoals([]);
      setShopping([]);
      setTasks([]);
      setChildTasks([]);
      setAnnouncements([]);
      setNotifications([]);
      setAppearance(null);
      setNotificationsLoaded(false);
      notificationsHydratedRef.current = false;
      seenNotificationIdsRef.current = new Set();
      return;
    }

    let cancelled = false;
    setFamilyReady(false);
    setNotificationsLoaded(false);
    notificationsHydratedRef.current = false;
    seenNotificationIdsRef.current = new Set();

    const handleFamilyListenerError = (err: Error) => {
      if (cancelled || isLeavingRef.current) return;
      void doesFamilyMemberExist(activeFamilyId, user.uid).then((stillMember) => {
        if (cancelled || isLeavingRef.current) return;
        if (!stillMember) {
          isLeavingRef.current = true;
          void clearUserActiveFamily(user.uid).catch(() => {
            if (!cancelled) setFatalError(err);
          });
        } else {
          setFatalError(err);
        }
      });
    };

    const unsubs = [
      subscribeCurrentMember(
        activeFamilyId,
        user.uid,
        (memberDoc) => {
          if (cancelled || isLeavingRef.current) return;
          if (!memberDoc) {
            void doesFamilyMemberExist(activeFamilyId, user.uid).then((stillExists) => {
              if (!cancelled && !isLeavingRef.current && !stillExists) {
                isLeavingRef.current = true;
                void clearUserActiveFamily(user.uid).catch(() => {});
              }
            });
          }
        },
        handleFamilyListenerError
      ),
      subscribeFamilyWorkspace(
        activeFamilyId,
        (fam) => {
          setFamily(fam);
          setFamilyReady(true);
        },
        handleFamilyListenerError
      ),
      subscribeAppAppearance(activeFamilyId, setAppearance, handleFamilyListenerError),
      subscribeMembers(activeFamilyId, setMembers, handleFamilyListenerError),
      subscribeProfiles(activeFamilyId, setProfiles, handleFamilyListenerError),
      subscribeEvents(activeFamilyId, setEvents, handleFamilyListenerError),
      subscribeMessages(activeFamilyId, setMessages, handleFamilyListenerError),
      subscribeTransactions(activeFamilyId, setTransactions, handleFamilyListenerError),
      subscribeGoals(activeFamilyId, setGoals, handleFamilyListenerError),
      subscribeShopping(activeFamilyId, setShopping, handleFamilyListenerError),
      subscribeHomeTasks(activeFamilyId, setTasks, handleFamilyListenerError),
      subscribeChildTasks(activeFamilyId, setChildTasks, handleFamilyListenerError),
      subscribeAnnouncements(activeFamilyId, setAnnouncements, handleFamilyListenerError),
      subscribeNotifications(
        activeFamilyId,
        (items) => {
          setNotifications(items);
          setNotificationsLoaded(true);
        },
        handleFamilyListenerError
      ),
    ];

    return () => {
      cancelled = true;
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [authReady, user, activeFamilyId]);

  const currentMember = useMemo(
    () => (user ? members.find((m) => m.uid === user.uid) ?? null : null),
    [members, user]
  );

  const lastReadMessagesMs = timestampToMillis(
    currentMember?.lastReadMessagesAt ?? currentMember?.joinedAt
  );
  const lastReadEventsMs = timestampToMillis(
    currentMember?.lastReadEventsAt ?? currentMember?.joinedAt
  );
  const lastReadTasksMs = timestampToMillis(
    currentMember?.lastReadTasksAt ?? currentMember?.joinedAt
  );
  const lastReadBoardMs = timestampToMillis(
    currentMember?.lastReadBoardAt ?? currentMember?.joinedAt
  );
  const lastReadNotificationsMs = timestampToMillis(
    currentMember?.lastReadNotificationsAt ?? currentMember?.joinedAt
  );
  const pushEnabled = Boolean(currentMember?.pushEnabled);

  const unreadMessagesCount = useMemo(() => {
    if (!user) return 0;
    return messages.filter(
      (m) => m.authorUid !== user.uid && timestampToMillis(m.createdAt) > lastReadMessagesMs
    ).length;
  }, [messages, user, lastReadMessagesMs]);

  const unreadEventsCount = useMemo(() => {
    if (!user) return 0;
    return notifications.filter(
      (n) =>
        n.kind === 'event' &&
        n.actorUid !== user.uid &&
        timestampToMillis(n.createdAt) > lastReadEventsMs
    ).length;
  }, [notifications, user, lastReadEventsMs]);

  const unreadTasksCount = useMemo(() => {
    if (!user) return 0;
    return notifications.filter(
      (n) =>
        n.kind === 'task' &&
        n.actorUid !== user.uid &&
        timestampToMillis(n.createdAt) > lastReadTasksMs
    ).length;
  }, [notifications, user, lastReadTasksMs]);

  const unreadBoardCount = useMemo(() => {
    if (!user) return 0;
    return notifications.filter(
      (n) =>
        n.kind === 'board' &&
        n.actorUid !== user.uid &&
        timestampToMillis(n.createdAt) > lastReadBoardMs
    ).length;
  }, [notifications, user, lastReadBoardMs]);

  const unreadNotificationsCount = useMemo(() => {
    if (!user) return 0;
    return notifications.filter(
      (n) => n.actorUid !== user.uid && timestampToMillis(n.createdAt) > lastReadNotificationsMs
    ).length;
  }, [notifications, user, lastReadNotificationsMs]);

  // Real-time incoming notification toast & browser push alert
  useEffect(() => {
    if (!user || !activeFamilyId || !notificationsLoaded) return;

    if (!notificationsHydratedRef.current) {
      for (const n of notifications) {
        seenNotificationIdsRef.current.add(n.id);
      }
      notificationsHydratedRef.current = true;
      return;
    }

    const fresh = notifications
      .filter((n) => !seenNotificationIdsRef.current.has(n.id))
      .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));

    for (const n of fresh) {
      seenNotificationIdsRef.current.add(n.id);
    }

    const incomingFromOthers = fresh.find((n) => n.actorUid !== user.uid);
    if (!incomingFromOthers) return;

    setActiveToast(incomingFromOthers);
    const hideTimer = setTimeout(() => {
      setActiveToast((curr) => (curr?.id === incomingFromOthers.id ? null : curr));
    }, 6500);

    if (pushEnabled) {
      sendBrowserNotification(
        `${incomingFromOthers.actorName}: ${incomingFromOthers.title}`,
        incomingFromOthers.body || 'Новое событие в семейном пространстве',
        incomingFromOthers.id,
        () => setActiveSection(incomingFromOthers.targetSection)
      );
    }

    return () => clearTimeout(hideTimer);
  }, [notifications, notificationsLoaded, user, activeFamilyId, pushEnabled]);

  const resolvedAppearance = appearance ?? DEFAULT_APPEARANCE_SETTINGS;
  const theme = ACCENT_THEME_MAP[resolvedAppearance.accentTheme] ?? ACCENT_THEME_MAP.teal;
  const surfaceClass = SURFACE_MODE_MAP[resolvedAppearance.surfaceMode] ?? SURFACE_MODE_MAP.light;
  const brandTitle = resolvedAppearance.brandName || 'Семья';
  const isNewYear = resolvedAppearance.accentTheme === 'newyear';

  const visibleNavItems = useMemo(
    () =>
      NAV_ITEMS.filter(
        (item) => item.id === 'overview' || !resolvedAppearance.hiddenSections.includes(item.id)
      ),
    [resolvedAppearance.hiddenSections]
  );

  // If another family user hid the currently open section via AI, jump back to Overview cleanly
  useEffect(() => {
    if (
      activeSection !== 'overview' &&
      resolvedAppearance.hiddenSections.includes(activeSection)
    ) {
      setActiveSection('overview');
    }
  }, [activeSection, resolvedAppearance.hiddenSections]);

  // Document title unread badge
  useEffect(() => {
    if (!family) {
      document.title = `${brandTitle} — Общение, Задания, Деньги и Дом`;
      return;
    }
    const total = Math.max(
      unreadNotificationsCount,
      unreadMessagesCount + unreadEventsCount + unreadTasksCount + unreadBoardCount
    );
    document.title =
      total > 0
        ? `(${total}) ${family.name} — ${brandTitle}`
        : `${family.name} — ${brandTitle}`;
  }, [
    family,
    brandTitle,
    unreadNotificationsCount,
    unreadMessagesCount,
    unreadEventsCount,
    unreadTasksCount,
    unreadBoardCount,
  ]);

  // Mark section read shortly after opening Communication, Family, Tasks, or Board
  useEffect(() => {
    if (!user || !activeFamilyId) return;
    if (activeSection === 'communication' && unreadMessagesCount > 0) {
      const t = setTimeout(() => {
        markMemberReadState(activeFamilyId, user.uid, {
          messages: true,
          notifications: true,
        }).catch((err) => setFatalError(err instanceof Error ? err : new Error(String(err))));
      }, 1500);
      return () => clearTimeout(t);
    }
    if (activeSection === 'family' && unreadEventsCount > 0) {
      const t = setTimeout(() => {
        markMemberReadState(activeFamilyId, user.uid, {
          events: true,
          notifications: true,
        }).catch((err) => setFatalError(err instanceof Error ? err : new Error(String(err))));
      }, 1500);
      return () => clearTimeout(t);
    }
    if (activeSection === 'tasks' && unreadTasksCount > 0) {
      const t = setTimeout(() => {
        markMemberReadState(activeFamilyId, user.uid, {
          tasks: true,
          notifications: true,
        }).catch((err) => setFatalError(err instanceof Error ? err : new Error(String(err))));
      }, 1500);
      return () => clearTimeout(t);
    }
    if (activeSection === 'board' && unreadBoardCount > 0) {
      const t = setTimeout(() => {
        markMemberReadState(activeFamilyId, user.uid, {
          board: true,
          notifications: true,
        }).catch((err) => setFatalError(err instanceof Error ? err : new Error(String(err))));
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [
    activeSection,
    unreadMessagesCount,
    unreadEventsCount,
    unreadTasksCount,
    unreadBoardCount,
    activeFamilyId,
    user,
  ]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-4">
          <div className="h-5 w-32 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-64 bg-slate-100 rounded animate-pulse" />
          <div className="h-10 w-full bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (!profileReady || (activeFamilyId && !familyReady)) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 space-y-4">
          <div className="h-5 w-40 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-56 bg-slate-100 rounded animate-pulse" />
          <div className="h-10 w-full bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!activeFamilyId || !family) {
    return (
      <FamilyOnboarding
        uid={user.uid}
        defaultDisplayName={userProfile?.displayName || user.displayName || 'Участник'}
      />
    );
  }

  const displayName = userProfile?.displayName || user.displayName || 'Участник';
  const userIsOwner = Boolean(
    family.ownerId === user.uid || currentMember?.role === 'owner'
  );
  const canManageTasks = isTaskManagerMember(currentMember, family.ownerId);

  const getSectionLabel = (id: NavSection) =>
    resolvedAppearance.sectionLabels[id] ||
    NAV_ITEMS.find((i) => i.id === id)?.label ||
    '';

  const getSectionTitle = (id: NavSection) =>
    resolvedAppearance.sectionLabels[id] || SECTION_TITLES[id];

  const handleSelectNav = (section: NavSection) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
  };

  const handleToggleNewYearTheme = async () => {
    if (togglingTheme) return;
    setTogglingTheme(true);
    try {
      await saveAppAppearance({
        familyId: family.id,
        uid: user.uid,
        userName: displayName,
        current: appearance,
        next: isNewYear
          ? { accentTheme: 'teal', surfaceMode: 'light' }
          : { accentTheme: 'newyear', surfaceMode: 'snow' },
      });
    } catch (err) {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setTogglingTheme(false);
    }
  };

  return (
    <div className={`min-h-screen ${surfaceClass} text-slate-900 flex transition-colors duration-200 relative`}>
      {isNewYear && <NewYearSnowOverlay />}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30 bg-white border-r border-slate-200">
        {isNewYear && <NewYearGarland />}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center gap-3">
          <ResilientImage
            src="/src/assets/images/family_hearth_emblem_1794860481061.jpg"
            alt={brandTitle}
            className="w-8 h-8 rounded-md object-cover border border-slate-200 shrink-0"
            fallbackLabel={brandTitle.slice(0, 1).toUpperCase() || 'С'}
          />
          <span className="text-lg font-bold tracking-tight text-slate-900 font-display truncate">
            {brandTitle}
          </span>
          {isNewYear && <TreePine className="w-4 h-4 text-emerald-700 shrink-0 ml-auto" />}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1" aria-label="Разделы приложения">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            const badgeCount =
              item.id === 'communication'
                ? unreadMessagesCount
                : item.id === 'family'
                  ? unreadEventsCount
                  : item.id === 'tasks'
                    ? unreadTasksCount
                    : item.id === 'board'
                      ? unreadBoardCount
                      : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  active
                    ? `${theme.navActiveBg} ${theme.navActiveText}`
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${active ? theme.iconAccent : 'text-slate-400'}`}
                  />
                  <span className="truncate">{getSectionLabel(item.id)}</span>
                </span>
                {badgeCount > 0 && (
                  <span className={`text-xs font-mono tabular-nums font-semibold ${theme.iconAccent}`}>
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 mt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${theme.softBg} ${theme.softBorder} ${theme.softText} hover:opacity-90`}
            >
              <Sparkles className={`w-4 h-4 shrink-0 ${theme.iconAccent}`} />
              <span>Нейросеть</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <div className="px-2 pb-1">
            <div className="text-sm font-medium text-slate-900 truncate">{displayName}</div>
            <div className="text-xs text-slate-500 truncate">
              {family.name} · {getMemberFamilyRoleLabel(currentMember, family.ownerId)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setLeaveError(null);
              setLeaveModalOpen(true);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              userIsOwner
                ? 'text-red-700 hover:bg-red-50'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <DoorOpen className="w-4 h-4 shrink-0" />
            <span>{userIsOwner ? 'Выйти и удалить семью' : 'Выйти из семьи'}</span>
          </button>
          <button
            type="button"
            onClick={() => void logoutUser()}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Выйти из аккаунта</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/30"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] bg-white h-full border-r border-slate-200 flex flex-col z-50">
            {isNewYear && <NewYearGarland />}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-lg font-bold text-slate-900 font-display truncate">
                {isNewYear && <TreePine className="w-4 h-4 text-emerald-700 shrink-0" />}
                <span className="truncate">{brandTitle}</span>
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Закрыть меню"
                className="p-1.5 text-slate-500 hover:text-slate-900 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                const badgeCount =
                  item.id === 'communication'
                    ? unreadMessagesCount
                    : item.id === 'family'
                      ? unreadEventsCount
                      : item.id === 'tasks'
                        ? unreadTasksCount
                        : item.id === 'board'
                          ? unreadBoardCount
                          : 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectNav(item.id)}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                      active
                        ? `${theme.navActiveBg} ${theme.navActiveText}`
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{getSectionLabel(item.id)}</span>
                    </span>
                    {badgeCount > 0 && (
                      <span className={`text-xs font-mono tabular-nums font-semibold ${theme.iconAccent}`}>
                        {badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}

              <div className="pt-3 mt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setAiOpen(true);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap ${theme.softBg} ${theme.softBorder} ${theme.softText}`}
                >
                  <Sparkles className={`w-4 h-4 shrink-0 ${theme.iconAccent}`} />
                  <span>Нейросеть</span>
                </button>
              </div>
            </nav>
            <div className="p-4 border-t border-slate-200 space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setLeaveError(null);
                  setLeaveModalOpen(true);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg ${
                  userIsOwner
                    ? 'text-red-700 hover:bg-red-50'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <DoorOpen className="w-4 h-4 shrink-0" />
                <span>{userIsOwner ? 'Выйти и удалить семью' : 'Выйти из семьи'}</span>
              </button>
              <button
                type="button"
                onClick={() => void logoutUser()}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Выйти ({displayName})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 relative z-10">
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200">
          {isNewYear && <NewYearGarland />}
          <header className="px-4 sm:px-8 py-4">
            <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Открыть меню"
                  className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <div className="text-xs text-slate-500 truncate">
                    {family.name}
                    <span aria-hidden="true"> / </span>
                    <span>{getSectionLabel(activeSection)}</span>
                  </div>
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                    {getSectionTitle(activeSection)}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleToggleNewYearTheme()}
                  disabled={togglingTheme}
                  title={isNewYear ? 'Переключить на обычную тему' : 'Включить новогоднюю тему'}
                  aria-label={isNewYear ? 'Переключить на обычную тему' : 'Включить новогоднюю тему'}
                  className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 ${
                    isNewYear
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'
                  }`}
                >
                  {isNewYear ? (
                    <>
                      <Snowflake className="w-4 h-4 text-sky-600 shrink-0" />
                      <span className="hidden md:inline">Обычная тема</span>
                    </>
                  ) : (
                    <>
                      <TreePine className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span className="hidden md:inline">Новый год</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setAiOpen(true)}
                  className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${theme.softBg} ${theme.softBorder} ${theme.softText} hover:opacity-90`}
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>Нейросеть</span>
                </button>

              <NotificationCenter
                uid={user.uid}
                notifications={notifications}
                lastReadNotificationsMs={lastReadNotificationsMs}
                pushEnabled={pushEnabled}
                onTogglePush={async (enabled) => {
                  try {
                    await markMemberReadState(family.id, user.uid, { pushEnabled: enabled });
                  } catch (err) {
                    setFatalError(err instanceof Error ? err : new Error(String(err)));
                  }
                }}
                onMarkAllRead={async () => {
                  try {
                    await markMemberReadState(family.id, user.uid, {
                      messages: true,
                      events: true,
                      tasks: true,
                      board: true,
                      notifications: true,
                    });
                  } catch (err) {
                    setFatalError(err instanceof Error ? err : new Error(String(err)));
                  }
                }}
                onNavigate={setActiveSection}
              />

              <button
                type="button"
                onClick={() => {
                  setLeaveError(null);
                  setLeaveModalOpen(true);
                }}
                title={userIsOwner ? 'Выйти и удалить семью' : 'Выйти из семьи'}
                aria-label={userIsOwner ? 'Выйти и удалить семью' : 'Выйти из семьи'}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                  userIsOwner
                    ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100'
                    : 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <DoorOpen className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">
                  {userIsOwner ? 'Выйти из семьи' : 'Выйти из семьи'}
                </span>
              </button>

              {activeSection !== 'money' ? (
                <button
                  type="button"
                  onClick={() => setActiveSection('money')}
                  className={`hidden md:inline-flex px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${theme.primaryBtn}`}
                >
                  + Внести трату
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveSection('home')}
                  className={`hidden md:inline-flex px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${theme.primaryBtn}`}
                >
                  Список покупок
                </button>
              )}
            </div>
          </div>
          </header>
        </div>

        {resolvedAppearance.liveAnnouncement && (
          <div className={`${theme.softBg} border-b ${theme.softBorder} px-4 sm:px-8 py-2.5`}>
            <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Megaphone className={`w-4 h-4 shrink-0 ${theme.iconAccent}`} />
                <span className={`font-medium ${theme.softText}`}>
                  {resolvedAppearance.liveAnnouncement}
                </span>
              </div>
              {appearance?.updatedByName && (
                <span className="text-xs text-slate-500 shrink-0 hidden sm:inline">
                  Обновлено: {appearance.updatedByName}
                </span>
              )}
            </div>
          </div>
        )}

        <main className="flex-1 px-4 sm:px-8 py-6 sm:py-8">
          <div className="max-w-[1200px] mx-auto">
            {activeSection === 'overview' && (
              <OverviewSection
                family={family}
                appearance={appearance}
                profiles={profiles}
                events={events}
                messages={messages}
                transactions={transactions}
                goals={goals}
                shopping={shopping}
                tasks={tasks}
                childTasks={childTasks}
                announcements={announcements}
                unreadMessagesCount={unreadMessagesCount}
                unreadEventsCount={unreadEventsCount}
                unreadTasksCount={unreadTasksCount}
                unreadBoardCount={unreadBoardCount}
                isOwner={userIsOwner}
                onNavigate={setActiveSection}
                onOpenAi={() => setAiOpen(true)}
                onRequestLeaveFamily={() => {
                  setLeaveError(null);
                  setLeaveModalOpen(true);
                }}
              />
            )}

            {activeSection === 'board' && (
              <BulletinSection
                uid={user.uid}
                userName={displayName}
                family={family}
                announcements={announcements}
                accentTheme={resolvedAppearance.accentTheme}
                lastReadBoardMs={lastReadBoardMs}
              />
            )}

            {activeSection === 'family' && (
              <FamilySection
                uid={user.uid}
                userName={displayName}
                family={family}
                members={members}
                profiles={profiles}
                events={events}
                lastReadEventsMs={lastReadEventsMs}
                onRequestLeaveFamily={() => {
                  setLeaveError(null);
                  setLeaveModalOpen(true);
                }}
              />
            )}

            {activeSection === 'tasks' && (
              <TasksSection
                uid={user.uid}
                userName={displayName}
                family={family}
                members={members}
                childTasks={childTasks}
                lastReadTasksMs={lastReadTasksMs}
              />
            )}

            {activeSection === 'communication' && (
              <CommunicationSection
                uid={user.uid}
                userName={displayName}
                family={family}
                messages={messages}
                lastReadMessagesMs={lastReadMessagesMs}
              />
            )}

            {activeSection === 'money' && (
              <MoneySection
                uid={user.uid}
                userName={displayName}
                family={family}
                transactions={transactions}
                goals={goals}
              />
            )}

            {activeSection === 'home' && (
              <HomeSection
                uid={user.uid}
                userName={displayName}
                family={family}
                profiles={profiles}
                shopping={shopping}
                tasks={tasks}
              />
            )}
          </div>
        </main>
      </div>

      <AiAssistantPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        accentTheme={resolvedAppearance.accentTheme}
        ctx={{
          uid: user.uid,
          userName: displayName,
          userIsOwner,
          canManageTasks,
          family,
          members,
          appearance,
          events,
          shopping,
          tasks,
          goals,
        }}
      />

      <LeaveFamilyModal
        open={leaveModalOpen}
        isOwner={userIsOwner}
        familyName={family.name}
        loading={leavingFamily}
        error={leaveError}
        onCancel={() => {
          if (!leavingFamily) {
            setLeaveModalOpen(false);
            setLeaveError(null);
          }
        }}
        onConfirm={async () => {
          setLeavingFamily(true);
          setLeaveError(null);
          isLeavingRef.current = true;
          try {
            if (userIsOwner) {
              await wipeFamilyAndStartFresh({
                familyId: family.id,
                ownerUid: user.uid,
                inviteCode: family.inviteCode,
              });
            } else {
              await leaveFamilyAsMember({
                familyId: family.id,
                uid: user.uid,
              });
            }
            setLeaveModalOpen(false);
            setActiveSection('overview');
          } catch (err) {
            isLeavingRef.current = false;
            setLeaveError(
              err instanceof Error ? err.message : 'Не удалось выйти из семьи. Попробуйте снова.'
            );
          } finally {
            setLeavingFamily(false);
          }
        }}
      />

      <NotificationToast
        notification={activeToast}
        onDismiss={() => setActiveToast(null)}
        onOpen={(section) => {
          setActiveSection(section);
          markMemberReadState(family.id, user.uid, {
            notifications: true,
            messages: section === 'communication',
            events: section === 'family',
            tasks: section === 'tasks',
            board: section === 'board',
          }).catch((err) => setFatalError(err instanceof Error ? err : new Error(String(err))));
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FamilyHubApp />
    </ErrorBoundary>
  );
}
