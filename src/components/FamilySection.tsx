import { useState, type FormEvent } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  DoorOpen,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  addFamilyEvent,
  addPersonProfile,
  deleteFamilyEvent,
  deletePersonProfile,
  removeFamilyMember,
  toggleFamilyEvent,
  updateFamilySettings,
  updateMemberFamilyRole,
} from '../lib/familyService';
import {
  CURRENCY_META,
  EVENT_CATEGORIES,
  FAMILY_ROLES,
  formatDateRu,
  getMemberFamilyRoleLabel,
  LIMITS,
  RELATION_OPTIONS,
  timestampToMillis,
  todayIsoDate,
  type CurrencyCode,
  type EventCategory,
  type FamilyEvent,
  type FamilyMemberAccount,
  type FamilyPersonProfile,
  type FamilyRelation,
  type FamilyRole,
  type FamilyWorkspace,
} from '../types/family';

interface FamilySectionProps {
  uid: string;
  userName: string;
  family: FamilyWorkspace;
  members: FamilyMemberAccount[];
  profiles: FamilyPersonProfile[];
  events: FamilyEvent[];
  lastReadEventsMs?: number;
  onRequestLeaveFamily?: () => void;
}

export function FamilySection({
  uid,
  userName,
  family,
  members,
  profiles,
  events,
  lastReadEventsMs = 0,
  onRequestLeaveFamily,
}: FamilySectionProps) {
  const isOwner = family.ownerId === uid;
  const [copied, setCopied] = useState(false);

  // Settings form (owner only)
  const [showSettings, setShowSettings] = useState(false);
  const [editFamilyName, setEditFamilyName] = useState(family.name);
  const [editCurrency, setEditCurrency] = useState<CurrencyCode>(family.currency);
  const [savingSettings, setSavingSettings] = useState(false);

  // Add person form
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [personName, setPersonName] = useState('');
  const [personRelation, setPersonRelation] = useState<FamilyRelation>('Взрослый');
  const [personBirthDate, setPersonBirthDate] = useState('');
  const [personNote, setPersonNote] = useState('');
  const [savingPerson, setSavingPerson] = useState(false);

  // Add event form
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(todayIsoDate());
  const [eventTime, setEventTime] = useState('');
  const [eventCategory, setEventCategory] = useState<EventCategory>('Семейное дело');
  const [eventAssignee, setEventAssignee] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventFilter, setEventFilter] = useState<'all' | 'upcoming' | 'done'>('all');
  const [savedRoleUid, setSavedRoleUid] = useState<string | null>(null);
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);
  const [removingUid, setRemovingUid] = useState<string | null>(null);

  const handleRemoveMember = async (memberUid: string) => {
    setRemovingUid(memberUid);
    try {
      await removeFamilyMember({ familyId: family.id, memberUid });
      setConfirmRemoveUid(null);
    } finally {
      setRemovingUid(null);
    }
  };

  const handleAssignRole = async (memberUid: string, nextRole: FamilyRole) => {
    await updateMemberFamilyRole(family.id, memberUid, nextRole);
    setSavedRoleUid(memberUid);
    setTimeout(() => {
      setSavedRoleUid((curr) => (curr === memberUid ? null : curr));
    }, 2000);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(family.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (!editFamilyName.trim()) return;
    setSavingSettings(true);
    try {
      await updateFamilySettings(family.id, {
        name: editFamilyName,
        currency: editCurrency,
      });
      setShowSettings(false);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddPerson = async (e: FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) return;
    setSavingPerson(true);
    try {
      await addPersonProfile({
        familyId: family.id,
        uid,
        name: personName,
        relation: personRelation,
        birthDate: personBirthDate,
        note: personNote,
      });
      setPersonName('');
      setPersonBirthDate('');
      setPersonNote('');
      setShowAddPerson(false);
    } finally {
      setSavingPerson(false);
    }
  };

  const handleAddEvent = async (e: FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    setSavingEvent(true);
    try {
      await addFamilyEvent({
        familyId: family.id,
        uid,
        actorName: userName,
        title: eventTitle,
        date: eventDate,
        time: eventTime,
        category: eventCategory,
        assigneeName: eventAssignee,
      });
      setEventTitle('');
      setEventTime('');
      setEventAssignee('');
    } finally {
      setSavingEvent(false);
    }
  };

  const filteredEvents = [...events]
    .filter((evt) => {
      if (eventFilter === 'upcoming') return !evt.completed;
      if (eventFilter === 'done') return evt.completed;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-8">
      {/* Top Invite & Settings Row */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-500 mb-1">
            <span>Семейное пространство</span>
            <span aria-hidden="true"> · </span>
            <span className="tabular-nums">{members.length} подключённых аккаунтов</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">{family.name}</h2>
          <p className="text-sm text-slate-600 mt-1">
            Поделитесь кодом с близкими, чтобы они вошли в общий бюджет, чат и список дел.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-xs text-slate-500">Код:</span>
            <span className="text-sm font-mono font-semibold text-slate-900">
              {family.inviteCode}
            </span>
            <button
              type="button"
              onClick={() => void handleCopyCode()}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Готово' : 'Копировать'}</span>
            </button>
          </div>

          {isOwner && (
            <button
              type="button"
              onClick={() => {
                setEditFamilyName(family.name);
                setEditCurrency(family.currency);
                setShowSettings((prev) => !prev);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Settings className="w-4 h-4" />
              <span>Настройки</span>
            </button>
          )}

          {onRequestLeaveFamily && (
            <button
              type="button"
              onClick={onRequestLeaveFamily}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                isOwner
                  ? 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100'
                  : 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <DoorOpen className="w-4 h-4" />
              <span>{isOwner ? 'Выйти и удалить семью' : 'Выйти из семьи'}</span>
            </button>
          )}
        </div>
      </section>

      {showSettings && isOwner && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-slate-200 rounded-xl p-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
        >
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Название семьи
            </label>
            <input
              type="text"
              required
              maxLength={LIMITS.FAMILY_NAME_MAX}
              value={editFamilyName}
              onChange={(e) => setEditFamilyName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Основная валюта
            </label>
            <select
              value={editCurrency}
              onChange={(e) => setEditCurrency(e.target.value as CurrencyCode)}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              {(Object.keys(CURRENCY_META) as CurrencyCode[]).map((code) => (
                <option key={code} value={code}>
                  {CURRENCY_META[code].label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3 flex items-center gap-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
            >
              {savingSettings ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Connected Accounts & Roles assigned by Group Creator */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <h3 className="text-base font-semibold text-slate-900">
              Аккаунты и роли в семье
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {isOwner
              ? 'Вы как создатель группы назначаете роли (Мама, Папа, Ребёнок и др.)'
              : 'Роли назначает создатель группы'}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {members.map((member) => {
            const roleLabel = getMemberFamilyRoleLabel(member, family.ownerId);
            const isMemberOwner = member.role === 'owner' || member.uid === family.ownerId;
            const canRemove = isOwner && !isMemberOwner && member.uid !== uid;
            const isConfirming = confirmRemoveUid === member.uid;
            const isRemoving = removingUid === member.uid;

            return (
              <div
                key={member.uid}
                className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {member.displayName}
                    {member.uid === uid && (
                      <span className="text-xs text-slate-500 font-normal"> (Вы)</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    <span>
                      {isMemberOwner ? 'Создатель группы' : 'Участник группы'}
                    </span>
                    <span aria-hidden="true"> · </span>
                    <span className="font-medium text-slate-700">Роль: {roleLabel}</span>
                  </div>
                </div>

                {isOwner && (
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                    {savedRoleUid === member.uid && (
                      <span className="text-xs font-medium text-teal-700">Сохранено</span>
                    )}
                    <select
                      aria-label={`Назначить роль для ${member.displayName}`}
                      value={roleLabel}
                      disabled={isRemoving}
                      onChange={(e) =>
                        void handleAssignRole(member.uid, e.target.value as FamilyRole)
                      }
                      className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700 disabled:opacity-60"
                    >
                      {FAMILY_ROLES.map((roleOpt) => (
                        <option key={roleOpt} value={roleOpt}>
                          {roleOpt}
                        </option>
                      ))}
                    </select>

                    {canRemove && !isConfirming && (
                      <button
                        type="button"
                        disabled={isRemoving}
                        onClick={() => setConfirmRemoveUid(member.uid)}
                        aria-label={`Удалить пользователя ${member.displayName}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Удалить</span>
                      </button>
                    )}

                    {canRemove && isConfirming && (
                      <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1">
                        <span className="text-xs text-red-800 font-medium">Удалить?</span>
                        <button
                          type="button"
                          disabled={isRemoving}
                          onClick={() => void handleRemoveMember(member.uid)}
                          className="px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded transition-colors disabled:opacity-60 whitespace-nowrap"
                        >
                          {isRemoving ? 'Удаляем...' : 'Да'}
                        </button>
                        <button
                          type="button"
                          disabled={isRemoving}
                          onClick={() => setConfirmRemoveUid(null)}
                          className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                        >
                          Отмена
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Main 2-Column Split: Family Profiles + Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Family Roster */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-700" />
              <h3 className="text-base font-semibold text-slate-900">Члены семьи</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowAddPerson((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Добавить</span>
            </button>
          </div>

          {showAddPerson && (
            <form
              onSubmit={handleAddPerson}
              className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
            >
              <input
                type="text"
                required
                maxLength={LIMITS.DISPLAY_NAME_MAX}
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Имя (например: София или кот Марсель)"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={personRelation}
                  onChange={(e) => setPersonRelation(e.target.value as FamilyRelation)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                >
                  {RELATION_OPTIONS.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  value={personBirthDate}
                  onChange={(e) => setPersonBirthDate(e.target.value)}
                  aria-label="Дата рождения"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                />
              </div>
              <input
                type="text"
                maxLength={LIMITS.NOTE_MAX}
                value={personNote}
                onChange={(e) => setPersonNote(e.target.value)}
                placeholder="Заметка (кружки, размер одежды, аллергии)"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPerson(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={savingPerson}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
                >
                  {savingPerson ? 'Добавляем...' : 'Сохранить'}
                </button>
              </div>
            </form>
          )}

          {profiles.length === 0 ? (
            <p className="text-sm text-slate-500 py-4">
              Добавьте карточки членов семьи — детей, родственников или домашних питомцев.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {profiles.map((person) => (
                <div
                  key={person.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{person.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      <span>{person.relation}</span>
                      {person.birthDate && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="tabular-nums">ДР {formatDateRu(person.birthDate)}</span>
                        </>
                      )}
                      {person.linkedUid && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="text-teal-700">В приложении</span>
                        </>
                      )}
                    </div>
                    {person.note && (
                      <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                        {person.note}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void deletePersonProfile(family.id, person.id)}
                    aria-label={`Удалить профиль ${person.name}`}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Right: Family Calendar & Events */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-700" />
              <h3 className="text-base font-semibold text-slate-900">Семейный календарь</h3>
            </div>

            <div className="inline-flex p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: 'Все' },
                  { id: 'upcoming', label: 'Предстоящие' },
                  { id: 'done', label: 'Завершённые' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEventFilter(tab.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    eventFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleAddEvent}
            className="p-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-12 gap-3"
          >
            <input
              type="text"
              required
              maxLength={LIMITS.TITLE_MAX}
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder="Новое событие (например: Визит к стоматологу)"
              className="sm:col-span-6 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
            <input
              type="date"
              required
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="sm:col-span-3 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
            <input
              type="time"
              value={eventTime}
              onChange={(e) => setEventTime(e.target.value)}
              className="sm:col-span-3 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
            <select
              value={eventCategory}
              onChange={(e) => setEventCategory(e.target.value as EventCategory)}
              className="sm:col-span-4 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            >
              {EVENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <input
              type="text"
              maxLength={LIMITS.DISPLAY_NAME_MAX}
              value={eventAssignee}
              onChange={(e) => setEventAssignee(e.target.value)}
              placeholder="Кому / ответственный"
              list="family-members-list"
              className="sm:col-span-5 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
            />
            <datalist id="family-members-list">
              {profiles.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <button
              type="submit"
              disabled={savingEvent}
              className="sm:col-span-3 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить</span>
            </button>
          </form>

          {filteredEvents.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              Событий в этой выборке пока нет.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredEvents.map((evt) => {
                const isNewEvent =
                  lastReadEventsMs > 0 &&
                  evt.createdBy !== uid &&
                  timestampToMillis(evt.updatedAt ?? evt.createdAt) > lastReadEventsMs;
                return (
                <div
                  key={evt.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        void toggleFamilyEvent(family.id, evt.id, !evt.completed, {
                          uid,
                          name: userName,
                          eventTitle: evt.title,
                        })
                      }
                      aria-label={evt.completed ? 'Отметить как невыполненное' : 'Завершить событие'}
                      className="mt-0.5 text-slate-400 hover:text-teal-700 transition-colors shrink-0"
                    >
                      {evt.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-teal-700" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <div className="min-w-0">
                      <div
                        className={`text-sm font-medium ${
                          evt.completed ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {evt.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span className="font-mono tabular-nums">
                          {formatDateRu(evt.date)}
                          {evt.time ? ` в ${evt.time}` : ''}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>{evt.category}</span>
                        {evt.assigneeName && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span>{evt.assigneeName}</span>
                          </>
                        )}
                        {isNewEvent && (
                          <>
                            <span aria-hidden="true"> · </span>
                            <span className="font-semibold text-teal-700">Обновлено</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void deleteFamilyEvent(family.id, evt.id, {
                        uid,
                        name: userName,
                        eventTitle: evt.title,
                      })
                    }
                    aria-label="Удалить событие"
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
