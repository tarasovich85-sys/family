import { useEffect, useRef, useState } from 'react';
import { Bell, Calendar, CheckCheck, ClipboardCheck, Megaphone, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import {
  getBrowserPushPermission,
  requestBrowserPushPermission,
  sendBrowserNotification,
  type BrowserPushStatus,
} from '../lib/notifications';
import {
  formatTimestampTime,
  timestampToMillis,
  type FamilyNotification,
  type NavSection,
} from '../types/family';

interface NotificationCenterProps {
  uid: string;
  notifications: FamilyNotification[];
  lastReadNotificationsMs: number;
  pushEnabled: boolean;
  onTogglePush: (enabled: boolean) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onNavigate: (section: NavSection) => void;
}

export function NotificationCenter({
  uid,
  notifications,
  lastReadNotificationsMs,
  pushEnabled,
  onTogglePush,
  onMarkAllRead,
  onNavigate,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<BrowserPushStatus>(() =>
    getBrowserPushPermission()
  );
  const [testNotice, setTestNotice] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const sortedNotifications = [...notifications]
    .sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt))
    .slice(0, 25);

  const unreadItems = sortedNotifications.filter(
    (item) =>
      item.actorUid !== uid && timestampToMillis(item.createdAt) > lastReadNotificationsMs
  );

  const handleEnablePush = async () => {
    setTestNotice(null);
    if (pushEnabled && permission === 'granted') {
      await onTogglePush(false);
      return;
    }

    const nextPerm = await requestBrowserPushPermission();
    setPermission(nextPerm);
    if (nextPerm === 'granted') {
      await onTogglePush(true);
      sendBrowserNotification(
        'Семья — уведомления включены',
        'Теперь вы будете получать оповещения о новых сообщениях и изменениях в календаре.'
      );
      setTestNotice('Push-уведомления включены.');
    } else if (nextPerm === 'denied') {
      setTestNotice('Разрешение заблокировано в настройках браузера.');
    } else {
      setTestNotice('Браузер не разрешил push-уведомления в этом окне, но работают уведомления внутри приложения.');
    }
  };

  const handleTestPush = () => {
    setTestNotice(null);
    const ok = sendBrowserNotification(
      'Семья — проверка уведомлений',
      'Оповещения о новых сообщениях и событиях календаря работают.'
    );
    setTestNotice(
      ok
        ? 'Тестовое уведомление отправлено.'
        : 'Системный push заблокирован браузером — активны встроенные оповещения в приложении.'
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="Уведомления семьи"
        className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
          unreadItems.length > 0
            ? 'bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100'
            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
      >
        <Bell className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">Уведомления</span>
        {unreadItems.length > 0 && (
          <span className="font-mono tabular-nums font-semibold">
            <span className="hidden sm:inline">· </span>
            {unreadItems.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] sm:w-[400px] bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Уведомления семьи</h2>
              <p className="text-xs text-slate-500 tabular-nums">
                {unreadItems.length > 0
                  ? `${unreadItems.length} непрочитанных`
                  : 'Все оповещения прочитаны'}
              </p>
            </div>
            {unreadItems.length > 0 && (
              <button
                type="button"
                onClick={() => void onMarkAllRead()}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Прочитано всё</span>
              </button>
            )}
          </div>

          {/* Browser Push Controls */}
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-700">
                <div className="font-medium text-slate-900">Push-оповещения браузера</div>
                <div className="text-slate-500">
                  {permission === 'unsupported'
                    ? 'Не поддерживаются в этом окне'
                    : permission === 'denied'
                      ? 'Заблокированы в браузере'
                      : pushEnabled && permission === 'granted'
                        ? 'Включены для сообщений и календаря'
                        : 'Отключены'}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {pushEnabled && permission === 'granted' && (
                  <button
                    type="button"
                    onClick={handleTestPush}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md whitespace-nowrap"
                  >
                    Проверить
                  </button>
                )}
                {permission !== 'unsupported' && (
                  <button
                    type="button"
                    onClick={() => void handleEnablePush()}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-md whitespace-nowrap"
                  >
                    {pushEnabled && permission === 'granted' ? 'Выключить' : 'Включить'}
                  </button>
                )}
              </div>
            </div>
            {testNotice && <p className="text-xs text-teal-800">{testNotice}</p>}
          </div>

          {/* Activity List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {sortedNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                Пока нет событий. Здесь появятся новые сообщения и изменения в календаре.
              </div>
            ) : (
              sortedNotifications.map((item) => {
                const isUnread =
                  item.actorUid !== uid &&
                  timestampToMillis(item.createdAt) > lastReadNotificationsMs;
                const Icon =
                  item.kind === 'message'
                    ? MessageSquare
                    : item.kind === 'task'
                      ? ClipboardCheck
                      : item.kind === 'board'
                        ? Megaphone
                        : item.kind === 'ai'
                          ? Sparkles
                          : Calendar;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      void onMarkAllRead();
                      onNavigate(item.targetSection);
                    }}
                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3 ${
                      isUnread ? 'bg-teal-50/40' : ''
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        isUnread ? 'text-teal-700' : 'text-slate-400'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-0.5">
                        <span className="truncate">
                          <span className="font-medium text-slate-800">{item.actorName}</span>
                          {isUnread && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span className="font-semibold text-teal-700">Новое</span>
                            </>
                          )}
                        </span>
                        <span className="font-mono tabular-nums shrink-0">
                          {formatTimestampTime(item.createdAt) || 'Только что'}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {item.title}
                      </div>
                      {item.body && (
                        <div className="text-xs text-slate-600 line-clamp-2 mt-0.5">
                          {item.body}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface NotificationToastProps {
  notification: FamilyNotification | null;
  onDismiss: () => void;
  onOpen: (section: NavSection) => void;
}

export function NotificationToast({
  notification,
  onDismiss,
  onOpen,
}: NotificationToastProps) {
  if (!notification) return null;

  const Icon =
    notification.kind === 'message'
      ? Send
      : notification.kind === 'task'
        ? ClipboardCheck
        : notification.kind === 'board'
          ? Megaphone
          : notification.kind === 'ai'
            ? Sparkles
            : Calendar;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 max-w-sm w-[calc(100vw-2.5rem)] bg-white border border-slate-200 rounded-xl shadow-lg p-4 transition-transform duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-800">{notification.actorName}</span>
            <span aria-hidden="true"> · </span>
            <span className="text-teal-700 font-medium">Новое оповещение</span>
          </div>
          <div className="text-sm font-semibold text-slate-900 mt-0.5">
            {notification.title}
          </div>
          {notification.body && (
            <p className="text-xs text-slate-600 mt-1 line-clamp-2">{notification.body}</p>
          )}
          <div className="mt-2.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                onOpen(notification.targetSection);
                onDismiss();
              }}
              className="text-xs font-semibold text-teal-700 hover:text-teal-800"
            >
              Перейти →
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Скрыть
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Закрыть уведомление"
          className="p-1 text-slate-400 hover:text-slate-700 shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
