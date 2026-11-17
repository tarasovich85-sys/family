import { useMemo, useState, type FormEvent } from 'react';
import {
  Archive,
  ArchiveRestore,
  Megaphone,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  addAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementPin,
  toggleAnnouncementStatus,
  updateAnnouncement,
} from '../lib/familyService';
import {
  ACCENT_THEME_MAP,
  ANNOUNCEMENT_CATEGORIES,
  formatDateRu,
  formatTimestampTime,
  LIMITS,
  timestampToMillis,
  type AccentTheme,
  type AnnouncementCategory,
  type FamilyAnnouncement,
  type FamilyWorkspace,
} from '../types/family';
import { ImageAttachmentField } from './ImageAttachmentField';
import { ImageLightbox } from './ImageLightbox';

interface BulletinSectionProps {
  uid: string;
  userName: string;
  family: FamilyWorkspace;
  announcements: FamilyAnnouncement[];
  accentTheme: AccentTheme;
  lastReadBoardMs?: number;
}

type StatusFilter = 'active' | 'pinned' | 'archived';

export function BulletinSection({
  uid,
  userName,
  family,
  announcements,
  accentTheme,
  lastReadBoardMs = 0,
}: BulletinSectionProps) {
  const theme = ACCENT_THEME_MAP[accentTheme] ?? ACCENT_THEME_MAP.teal;
  const isOwner = family.ownerId === uid;

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [categoryFilter, setCategoryFilter] = useState<'Все' | AnnouncementCategory>('Все');
  const [searchQuery, setSearchQuery] = useState('');

  // Composer / editor state
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<AnnouncementCategory>('Важное');
  const [expiresAt, setExpiresAt] = useState('');
  const [pinned, setPinned] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const activeCount = useMemo(
    () => announcements.filter((a) => a.status === 'active').length,
    [announcements]
  );
  const pinnedCount = useMemo(
    () => announcements.filter((a) => a.status === 'active' && a.pinned).length,
    [announcements]
  );
  const archivedCount = useMemo(
    () => announcements.filter((a) => a.status === 'archived').length,
    [announcements]
  );

  const filteredAnnouncements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...announcements]
      .filter((item) => {
        if (statusFilter === 'active' && item.status !== 'active') return false;
        if (statusFilter === 'pinned' && (item.status !== 'active' || !item.pinned)) return false;
        if (statusFilter === 'archived' && item.status !== 'archived') return false;
        if (categoryFilter !== 'Все' && item.category !== categoryFilter) return false;
        if (
          q &&
          !item.title.toLowerCase().includes(q) &&
          !item.body.toLowerCase().includes(q) &&
          !item.authorName.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt);
      });
  }, [announcements, statusFilter, categoryFilter, searchQuery]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setCategory('Важное');
    setExpiresAt('');
    setPinned(false);
    setImageDataUrl('');
    setError(null);
  };

  const openCreateForm = () => {
    resetForm();
    setComposerOpen(true);
  };

  const openEditForm = (item: FamilyAnnouncement) => {
    setEditingId(item.id);
    setTitle(item.title);
    setBody(item.body);
    setCategory(item.category);
    setExpiresAt(item.expiresAt || '');
    setPinned(item.pinned);
    setImageDataUrl(item.imageDataUrl || '');
    setError(null);
    setComposerOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || (!body.trim() && !imageDataUrl)) {
      setError('Укажите заголовок и текст или прикрепите изображение.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const finalBody = body.trim() || 'Изображение';
    try {
      if (editingId) {
        const existing = announcements.find((a) => a.id === editingId);
        await updateAnnouncement({
          familyId: family.id,
          announcementId: editingId,
          title,
          body: finalBody,
          category,
          pinned,
          status: existing?.status ?? 'active',
          expiresAt,
          imageDataUrl,
        });
      } else {
        await addAnnouncement({
          familyId: family.id,
          authorUid: uid,
          authorName: userName,
          title,
          body: finalBody,
          category,
          pinned,
          expiresAt,
          imageDataUrl,
        });
      }
      resetForm();
      setComposerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить объявление.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5 font-mono tabular-nums">
            <span>Активных: {activeCount}</span>
            <span aria-hidden="true">·</span>
            <span>Закреплено: {pinnedCount}</span>
            <span aria-hidden="true">·</span>
            <span>Архив: {archivedCount}</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Семейная доска объявлений</h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Заметки, просьбы, списки к праздникам и важные объявления для всей семьи.
          </p>
        </div>

        <button
          type="button"
          onClick={() => (composerOpen ? setComposerOpen(false) : openCreateForm())}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
            composerOpen
              ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
              : theme.primaryBtn
          }`}
        >
          {composerOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          <span>{composerOpen ? 'Свернуть форму' : 'Новое объявление'}</span>
        </button>
      </section>

      {/* Composer / Edit Form */}
      {composerOpen && (
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className={`w-4 h-4 ${theme.iconAccent}`} />
            <h3 className="text-base font-semibold text-slate-900">
              {editingId ? 'Редактировать объявление' : 'Разместить объявление'}
            </h3>
          </div>

          {error && (
            <div className="mb-4 px-4 py-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Заголовок
                </label>
                <input
                  type="text"
                  required
                  maxLength={LIMITS.TITLE_MAX}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: Новогодний ужин в 20:00 или Отдаём зимнюю куртку"
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-500"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Категория
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-500"
                >
                  {ANNOUNCEMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Актуально до (необязательно)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Текст объявления
              </label>
              <textarea
                required={!imageDataUrl}
                rows={4}
                maxLength={LIMITS.ANNOUNCEMENT_BODY_MAX}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Подробности: что нужно сделать, кто участвует, куда позвонить или что принести..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-500 resize-y"
              />
            </div>

            <ImageAttachmentField
              value={imageDataUrl}
              onChange={setImageDataUrl}
              onPreview={setLightboxUrl}
              disabled={submitting}
            />

            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="w-4 h-4 border-slate-300 rounded"
                />
                <span className="text-xs font-medium text-slate-700">
                  Закрепить объявление наверху доски
                </span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setComposerOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={submitting || !title.trim() || (!body.trim() && !imageDataUrl)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap ${theme.primaryBtn}`}
                >
                  {submitting
                    ? 'Сохраняем...'
                    : editingId
                      ? 'Сохранить изменения'
                      : 'Опубликовать объявление'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Filters & Search Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="inline-flex flex-wrap p-1 bg-slate-100 rounded-lg w-fit">
          {(
            [
              { id: 'active', label: `Актуальные (${activeCount})` },
              { id: 'pinned', label: `Закреплённые (${pinnedCount})` },
              { id: 'archived', label: `Архив (${archivedCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:flex-initial min-w-[210px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по объявлениям..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:border-slate-400"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'Все' | AnnouncementCategory)}
            aria-label="Фильтр по категории"
            className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400"
          >
            <option value="Все">Все категории</option>
            {ANNOUNCEMENT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Announcements Grid */}
      {filteredAnnouncements.length === 0 ? (
        <section className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <p className="text-sm text-slate-600">
            {announcements.length === 0
              ? 'На доске объявлений пока пусто. Разместите первую заметку или напоминание для всей семьи.'
              : 'По выбранным фильтрам объявлений не найдено.'}
          </p>
          {announcements.length === 0 && (
            <button
              type="button"
              onClick={openCreateForm}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors ${theme.primaryBtn}`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Добавить первое объявление</span>
            </button>
          )}
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAnnouncements.map((item) => {
            const canEditOrDelete = item.authorUid === uid || isOwner;
            const isUnread =
              lastReadBoardMs > 0 &&
              item.authorUid !== uid &&
              timestampToMillis(item.createdAt) > lastReadBoardMs;
            const isConfirmingDelete = confirmDeleteId === item.id;

            return (
              <article
                key={item.id}
                className={`bg-white border rounded-xl p-5 flex flex-col justify-between gap-4 ${
                  item.pinned && item.status === 'active'
                    ? 'border-amber-300 bg-amber-50/25'
                    : 'border-slate-200'
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-2">
                    <span className="font-medium text-slate-700">{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.authorName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatTimestampTime(item.createdAt) || 'Только что'}
                    </span>
                    {item.pinned && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className={`font-semibold ${theme.iconAccent}`}>Закреплено</span>
                      </>
                    )}
                    {isUnread && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className={`font-semibold ${theme.iconAccent}`}>Новое</span>
                      </>
                    )}
                    {item.expiresAt && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          До {formatDateRu(item.expiresAt)}
                        </span>
                      </>
                    )}
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 mb-2 break-words">
                    {item.title}
                  </h3>
                  {!(item.body === 'Изображение' && item.imageDataUrl) && (
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                      {item.body}
                    </p>
                  )}
                  {item.imageDataUrl && (
                    <button
                      type="button"
                      onClick={() => setLightboxUrl(item.imageDataUrl || null)}
                      className="mt-3 block rounded-lg overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity cursor-zoom-in"
                      title="Увеличить изображение"
                    >
                      <img
                        src={item.imageDataUrl}
                        alt={item.title}
                        className="max-w-full max-h-56 object-cover"
                      />
                    </button>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void toggleAnnouncementPin(family.id, item.id, !item.pinned)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        item.pinned
                          ? `${theme.softBg} ${theme.softText}`
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {item.pinned ? (
                        <>
                          <PinOff className="w-3.5 h-3.5" />
                          <span>Открепить</span>
                        </>
                      ) : (
                        <>
                          <Pin className="w-3.5 h-3.5" />
                          <span>Закрепить</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void toggleAnnouncementStatus(
                          family.id,
                          item.id,
                          item.status === 'active' ? 'archived' : 'active'
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
                    >
                      {item.status === 'active' ? (
                        <>
                          <Archive className="w-3.5 h-3.5" />
                          <span>В архив</span>
                        </>
                      ) : (
                        <>
                          <ArchiveRestore className="w-3.5 h-3.5" />
                          <span>Вернуть</span>
                        </>
                      )}
                    </button>
                  </div>

                  {canEditOrDelete && (
                    <div className="flex items-center gap-1">
                      {!isConfirmingDelete ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditForm(item)}
                            aria-label="Редактировать объявление"
                            title="Редактировать"
                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            aria-label="Удалить объявление"
                            title="Удалить"
                            className="p-1.5 text-slate-500 hover:text-red-700 rounded-md hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              void deleteAnnouncement(family.id, item.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md whitespace-nowrap"
                          >
                            Удалить
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 rounded-md"
                          >
                            Отмена
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <ImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
}
