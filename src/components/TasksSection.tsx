import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Image as ImageIcon,
  Plus,
  Send,
  ShieldCheck,
  StopCircle,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  closeChildTask,
  createChildTask,
  deleteChildTask,
  respondToChildTask,
  reviewChildTask,
  submitChildTaskProof,
  updateMemberFamilyRole,
} from '../lib/familyService';
import { compressTaskPhoto } from '../lib/imageCompression';
import {
  FAMILY_ROLES,
  formatTimestampTime,
  formatUah,
  getMemberFamilyRoleLabel,
  isTaskManagerMember,
  LIMITS,
  timestampToMillis,
  type ChildTask,
  type FamilyMemberAccount,
  type FamilyRole,
  type FamilyWorkspace,
} from '../types/family';
import { ImageAttachmentField } from './ImageAttachmentField';
import { ImageLightbox } from './ImageLightbox';

interface TasksSectionProps {
  uid: string;
  userName: string;
  family: FamilyWorkspace;
  members: FamilyMemberAccount[];
  childTasks: ChildTask[];
  lastReadTasksMs?: number;
}

function getRemainingTenMinutesText(approvedAt: unknown, nowMs: number): string {
  const approvedMs = timestampToMillis(approvedAt);
  if (!approvedMs) return 'в течение 10 минут';
  const deadlineMs = approvedMs + 10 * 60 * 1000;
  const diffSec = Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
  if (diffSec === 0) return 'время начисления вышло — можно завершить задачу';
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `осталось ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function TasksSection({
  uid,
  userName,
  family,
  members,
  childTasks,
  lastReadTasksMs = 0,
}: TasksSectionProps) {
  const currentMember = useMemo(
    () => members.find((m) => m.uid === uid) ?? null,
    [members, uid]
  );
  const isOwner = family.ownerId === uid || currentMember?.role === 'owner';
  const canManage = isTaskManagerMember(currentMember, family.ownerId);
  const currentRoleLabel = getMemberFamilyRoleLabel(currentMember, family.ownerId);

  // Create task form (Mom / Dad / Creator only)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rewardUah, setRewardUah] = useState('100');
  const [assigneeUid, setAssigneeUid] = useState('');
  const [taskPhotoDataUrl, setTaskPhotoDataUrl] = useState('');
  const [creating, setCreating] = useState(false);

  // Filter & role panel
  const [filter, setFilter] = useState<'active' | 'closed' | 'all'>('active');
  const [showRolesPanel, setShowRolesPanel] = useState(false);
  const [roleSavedUid, setRoleSavedUid] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  // Child proof ("Всё") state
  const [proofTaskId, setProofTaskId] = useState<string | null>(null);
  const [proofMessage, setProofMessage] = useState('');
  const [proofPhoto, setProofPhoto] = useState('');
  const [compressingPhoto, setCompressingPhoto] = useState(false);

  // Parent review ("Нет") optional feedback + image per task
  const [feedbackByTask, setFeedbackByTask] = useState<Record<string, string>>({});
  const [feedbackPhotoByTask, setFeedbackPhotoByTask] = useState<Record<string, string>>({});

  // Photo lightbox preview
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Live countdown ticker when there are approved tasks waiting for 10-min payout
  const [nowMs, setNowMs] = useState(() => Date.now());
  const hasApprovedTasks = childTasks.some((t) => t.status === 'approved');
  useEffect(() => {
    if (!hasApprovedTasks) return;
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [hasApprovedTasks]);

  const sortedTasks = useMemo(
    () =>
      [...childTasks].sort(
        (a, b) =>
          timestampToMillis(b.updatedAt ?? b.createdAt) -
          timestampToMillis(a.updatedAt ?? a.createdAt)
      ),
    [childTasks]
  );

  const visibleTasks = useMemo(() => {
    if (filter === 'active') {
      return sortedTasks.filter((t) => t.status !== 'closed' && t.status !== 'declined');
    }
    if (filter === 'closed') {
      return sortedTasks.filter((t) => t.status === 'closed' || t.status === 'declined');
    }
    return sortedTasks;
  }, [sortedTasks, filter]);

  const activeCount = childTasks.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress' || t.status === 'needs_fix'
  ).length;
  const reviewCount = childTasks.filter((t) => t.status === 'submitted').length;
  const payoutPendingUah = childTasks
    .filter((t) => t.status === 'approved')
    .reduce((sum, t) => sum + t.rewardUah, 0);
  const paidTotalUah = childTasks
    .filter((t) => t.status === 'closed')
    .reduce((sum, t) => sum + t.rewardUah, 0);

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const parsedReward = Number(rewardUah);
    if (!title.trim() || !Number.isFinite(parsedReward) || parsedReward <= 0) {
      setActionError('Укажите название задания и цену в гривнах больше 0.');
      return;
    }

    const selectedMember = members.find((m) => m.uid === assigneeUid);
    setCreating(true);
    try {
      await createChildTask({
        familyId: family.id,
        uid,
        creatorName: userName,
        title,
        description,
        rewardUah: parsedReward,
        assigneeUid: selectedMember ? selectedMember.uid : '',
        assigneeName: selectedMember ? selectedMember.displayName : '',
        taskPhotoDataUrl,
      });
      setTitle('');
      setDescription('');
      setRewardUah('100');
      setAssigneeUid('');
      setTaskPhotoDataUrl('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось создать задание.');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (memberUid: string, nextRole: FamilyRole) => {
    setActionError(null);
    try {
      await updateMemberFamilyRole(family.id, memberUid, nextRole);
      setRoleSavedUid(memberUid);
      setTimeout(() => {
        setRoleSavedUid((curr) => (curr === memberUid ? null : curr));
      }, 2000);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось обновить роль.');
    }
  };

  const handleDecision = async (task: ChildTask, decision: 'accept' | 'decline') => {
    setActionError(null);
    setBusyTaskId(task.id);
    try {
      await respondToChildTask({
        familyId: family.id,
        task,
        uid,
        responderName: userName,
        decision,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось отправить ответ.');
    } finally {
      setBusyTaskId(null);
    }
  };

  const handlePhotoFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionError(null);
    setCompressingPhoto(true);
    try {
      const compressed = await compressTaskPhoto(file);
      setProofPhoto(compressed);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось обработать фото.');
    } finally {
      setCompressingPhoto(false);
    }
  };

  const handleSubmitProof = async (e: FormEvent, task: ChildTask) => {
    e.preventDefault();
    setActionError(null);
    if (!proofMessage.trim()) {
      setActionError('Напишите сообщение о выполнении задания.');
      return;
    }
    if (!proofPhoto) {
      setActionError('Прикрепите фото выполненного задания.');
      return;
    }

    setBusyTaskId(task.id);
    try {
      await submitChildTaskProof({
        familyId: family.id,
        task,
        uid,
        responderName: userName,
        proofMessage,
        proofPhotoDataUrl: proofPhoto,
      });
      setProofTaskId(null);
      setProofMessage('');
      setProofPhoto('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось отправить отчёт.');
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleReview = async (task: ChildTask, approved: boolean) => {
    setActionError(null);
    setBusyTaskId(task.id);
    try {
      await reviewChildTask({
        familyId: family.id,
        task,
        reviewerUid: uid,
        reviewerName: userName,
        approved,
        feedback: feedbackByTask[task.id] ?? '',
        feedbackPhotoDataUrl: feedbackPhotoByTask[task.id] ?? '',
      });
      setFeedbackByTask((prev) => ({ ...prev, [task.id]: '' }));
      setFeedbackPhotoByTask((prev) => ({ ...prev, [task.id]: '' }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось сохранить проверку.');
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleCloseTask = async (task: ChildTask) => {
    setActionError(null);
    setBusyTaskId(task.id);
    try {
      await closeChildTask({
        familyId: family.id,
        task,
        uid,
        actorName: userName,
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось прекратить задачу.');
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Role Status & Quick Roles Setup for Creator */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-slate-500">
            <span>Ваша роль в семье:</span>{' '}
            <span className="font-semibold text-slate-900">{currentRoleLabel}</span>
            <span aria-hidden="true"> · </span>
            <span>
              {canManage
                ? 'Вы можете давать задания, проверять фото и закрывать оплату'
                : 'Вы можете принимать задания («Да» / «Нет») и отправлять отчёт с фото'}
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Семейные задания с оплатой в гривнах</h2>
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={() => setShowRolesPanel((prev) => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <span>{showRolesPanel ? 'Скрыть роли' : 'Назначить роли (Мама, Папа, Ребёнок)'}</span>
          </button>
        )}
      </section>

      {isOwner && showRolesPanel && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Распределение ролей в группе
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Создатель группы может указать, кто является Мамой, Папой, Ребёнком или другим членом семьи. Задания могут давать только Создатель, Мама и Папа.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {members.map((member) => {
              const roleValue = getMemberFamilyRoleLabel(member, family.ownerId);
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
                      {member.role === 'owner' || member.uid === family.ownerId
                        ? 'Создатель группы'
                        : 'Участник группы'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {roleSavedUid === member.uid && (
                      <span className="text-xs font-medium text-teal-700">Сохранено</span>
                    )}
                    <select
                      aria-label={`Роль для ${member.displayName}`}
                      value={roleValue}
                      onChange={(e) => void handleRoleChange(member.uid, e.target.value as FamilyRole)}
                      className="px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                    >
                      {FAMILY_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500 mb-1">Активные задания</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {activeCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Ожидают ответа или в процессе</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500 mb-1">Ждут проверки</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-700">
            {reviewCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Присланы с фото и сообщением</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500 mb-1">К выплате / Выплачено</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-teal-700">
            {formatUah(payoutPendingUah)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
            Всего завершено: {formatUah(paidTotalUah)}
          </div>
        </div>
      </section>

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-700 hover:text-red-900 shrink-0"
            aria-label="Скрыть ошибку"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Task Creation Form (Mom, Dad, Creator ONLY) */}
      {canManage ? (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-teal-700" />
            <h3 className="text-base font-semibold text-slate-900">Дать новое задание</h3>
          </div>

          <form onSubmit={handleCreateTask} className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Что нужно сделать
              </label>
              <input
                type="text"
                required
                maxLength={LIMITS.TITLE_MAX}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Убрать в комнате и вынести мусор"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Цена в гривнах (грн)
              </label>
              <input
                type="number"
                required
                min={1}
                max={LIMITS.REWARD_UAH_MAX}
                value={rewardUah}
                onChange={(e) => setRewardUah(e.target.value)}
                placeholder="100"
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Кому задание
              </label>
              <select
                value={assigneeUid}
                onChange={(e) => setAssigneeUid(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              >
                <option value="">Любому ребёнку в семье</option>
                {members.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.displayName} ({getMemberFamilyRoleLabel(m, family.ownerId)})
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-9 space-y-2.5">
              <input
                type="text"
                maxLength={LIMITS.DESCRIPTION_MAX}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Комментарий или уточнение (необязательно)"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
              <ImageAttachmentField
                compact
                label="Прикрепить изображение к заданию"
                value={taskPhotoDataUrl}
                onChange={setTaskPhotoDataUrl}
                onPreview={setPreviewPhotoUrl}
                disabled={creating}
              />
            </div>

            <div className="md:col-span-3 flex items-start">
              <button
                type="submit"
                disabled={creating}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>{creating ? 'Создаём...' : 'Дать задание'}</span>
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-sm text-slate-700">
          Новые задания могут выдавать только <span className="font-semibold">Мама</span>,{' '}
          <span className="font-semibold">Папа</span> или{' '}
          <span className="font-semibold">Создатель группы</span>. Ниже отображаются доступные вам задания.
        </section>
      )}

      {/* Filter & Task List */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900">Список заданий</h3>
          <div className="inline-flex p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'active', label: 'Активные' },
                { id: 'closed', label: 'Завершённые' },
                { id: 'all', label: 'Все' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {visibleTasks.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
            В этой категории заданий пока нет.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleTasks.map((task) => {
              const isNew =
                lastReadTasksMs > 0 &&
                timestampToMillis(task.updatedAt ?? task.createdAt) > lastReadTasksMs;
              const isBusy = busyTaskId === task.id;
              const isEligibleChild =
                task.assigneeUid === uid || (!canManage && task.assigneeUid === '');
              const isProofOpen = proofTaskId === task.id;

              return (
                <article
                  key={task.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>От: {task.createdByName}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Кому: {task.assigneeName ? task.assigneeName : 'Любой ребёнок в семье'}
                        </span>
                        {Boolean(task.createdAt) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {formatTimestampTime(task.createdAt)}
                            </span>
                          </>
                        )}
                        {isNew && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-teal-700">Обновлено</span>
                          </>
                        )}
                      </div>

                      <h4 className="text-base sm:text-lg font-bold text-slate-900">{task.title}</h4>
                      {task.description && (
                        <p className="text-sm text-slate-600 leading-relaxed">{task.description}</p>
                      )}
                      {task.taskPhotoDataUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewPhotoUrl(task.taskPhotoDataUrl || null)}
                          className="mt-2 block rounded-lg overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity cursor-zoom-in"
                          title="Увеличить изображение к заданию"
                        >
                          <img
                            src={task.taskPhotoDataUrl}
                            alt="Изображение к заданию"
                            className="w-36 h-24 object-cover"
                          />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="px-3.5 py-2 bg-teal-50 border border-teal-200 rounded-lg text-base font-bold font-mono tabular-nums text-teal-800 whitespace-nowrap">
                        {formatUah(task.rewardUah)}
                      </div>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => void deleteChildTask(family.id, task.id)}
                          aria-label="Удалить задание"
                          className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Step 1: Pending -> Child chooses Да or Нет */}
                  {task.status === 'pending' && (
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-sm text-slate-600">
                        {isEligibleChild
                          ? 'Вы готовы выполнить это задание?'
                          : 'Ожидает ответа ребёнка (Да / Нет)'}
                      </div>

                      {isEligibleChild && (
                        <div className="flex items-center gap-2.5 shrink-0">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDecision(task, 'accept')}
                            className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <Check className="w-4 h-4" />
                            <span>Да</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleDecision(task, 'decline')}
                            className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                          >
                            <X className="w-4 h-4" />
                            <span>Нет</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 2a: Declined */}
                  {task.status === 'declined' && (
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2 text-sm font-medium text-red-700">
                      <XCircle className="w-4 h-4 shrink-0" />
                      <span>
                        Ребёнок сказал: Нет
                        {task.respondedByName ? ` (${task.respondedByName})` : ''}
                      </span>
                    </div>
                  )}

                  {/* Step 2b: Accepted -> Идёт процесс & Child button «Всё» */}
                  {(task.status === 'in_progress' || task.status === 'needs_fix') && (
                    <div className="pt-3 border-t border-slate-100 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800">
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>
                              Идёт процесс
                              {task.respondedByName ? ` · ${task.respondedByName} нажал(а) «Да»` : ''}
                            </span>
                          </div>
                          {task.status === 'needs_fix' && (
                            <div className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-2">
                              <p>
                                Родитель нажал «Нет» — нужно доделать
                                {task.parentFeedback ? `: ${task.parentFeedback}` : '.'}
                              </p>
                              {task.feedbackPhotoDataUrl && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewPhotoUrl(task.feedbackPhotoDataUrl || null)}
                                  className="block rounded-md overflow-hidden border border-amber-200 hover:opacity-90 cursor-zoom-in"
                                  title="Увеличить изображение"
                                >
                                  <img
                                    src={task.feedbackPhotoDataUrl}
                                    alt="Фото к комментарию родителя"
                                    className="w-28 h-20 object-cover"
                                  />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {isEligibleChild && !isProofOpen && (
                          <button
                            type="button"
                            onClick={() => {
                              setProofTaskId(task.id);
                              setProofMessage(task.proofMessage || '');
                              setProofPhoto(task.proofPhotoDataUrl || '');
                            }}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Всё</span>
                          </button>
                        )}
                      </div>

                      {isEligibleChild && isProofOpen && (
                        <form
                          onSubmit={(e) => void handleSubmitProof(e, task)}
                          className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-800">
                              Пришлите сообщение и фото для родителя
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setProofTaskId(null);
                                setProofMessage('');
                                setProofPhoto('');
                              }}
                              className="text-xs text-slate-500 hover:text-slate-800"
                            >
                              Отмена
                            </button>
                          </div>

                          <textarea
                            required
                            rows={2}
                            maxLength={LIMITS.DESCRIPTION_MAX}
                            value={proofMessage}
                            onChange={(e) => setProofMessage(e.target.value)}
                            placeholder="Напишите сообщение (например: Всё готово, комнату убрал!)"
                            className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                          />

                          <div className="flex flex-wrap items-center gap-3">
                            <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors">
                              <Camera className="w-4 h-4 text-teal-700" />
                              <span>
                                {compressingPhoto
                                  ? 'Сжимаем фото...'
                                  : proofPhoto
                                    ? 'Выбрать другое фото'
                                    : 'Прикрепить или снять фото'}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => void handlePhotoFileChange(e)}
                                className="sr-only"
                              />
                            </label>

                            {proofPhoto && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-teal-700">
                                <ImageIcon className="w-4 h-4" />
                                <span>Фото готово</span>
                              </span>
                            )}
                          </div>

                          {proofPhoto && (
                            <img
                              src={proofPhoto}
                              alt="Предпросмотр фотоотчёта"
                              className="w-40 h-32 object-cover rounded-lg border border-slate-200"
                            />
                          )}

                          <div className="flex justify-end">
                            <button
                              type="submit"
                              disabled={isBusy || compressingPhoto}
                              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                            >
                              <Send className="w-4 h-4" />
                              <span>{isBusy ? 'Отправляем...' : 'Всё — отправить фото и сообщение'}</span>
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {/* Step 3: Submitted -> Parent sees message + photo and clicks «Сделано» or «Нет» */}
                  {task.status === 'submitted' && (
                    <div className="pt-4 border-t border-slate-100 space-y-4">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start">
                        {task.proofPhotoDataUrl && (
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoUrl(task.proofPhotoDataUrl)}
                            className="shrink-0 group relative rounded-lg overflow-hidden border border-slate-200"
                            title="Открыть фото полностью"
                          >
                            <img
                              src={task.proofPhotoDataUrl}
                              alt="Фото выполненного задания"
                              className="w-36 h-28 object-cover group-hover:opacity-90 transition-opacity"
                            />
                          </button>
                        )}
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="text-xs font-semibold text-teal-800">
                            {task.respondedByName || 'Ребёнок'} нажал(а) «Всё»
                          </div>
                          <p className="text-sm text-slate-800 leading-relaxed">
                            {task.proofMessage}
                          </p>
                          {task.proofPhotoDataUrl && (
                            <button
                              type="button"
                              onClick={() => setPreviewPhotoUrl(task.proofPhotoDataUrl)}
                              className="text-xs font-medium text-teal-700 hover:text-teal-800"
                            >
                              Увеличить фото →
                            </button>
                          )}
                        </div>
                      </div>

                      {canManage ? (
                        <div className="space-y-2.5">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <input
                              type="text"
                              maxLength={LIMITS.NOTE_MAX}
                              value={feedbackByTask[task.id] ?? ''}
                              onChange={(e) =>
                                setFeedbackByTask((prev) => ({
                                  ...prev,
                                  [task.id]: e.target.value,
                                }))
                              }
                              placeholder="Комментарий (если нажимаете «Нет»)"
                              className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
                            />
                            <div className="flex items-center gap-2.5 shrink-0">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleReview(task, true)}
                                className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Сделано</span>
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleReview(task, false)}
                                className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                              >
                                <XCircle className="w-4 h-4" />
                                <span>Нет</span>
                              </button>
                            </div>
                          </div>
                          <ImageAttachmentField
                            compact
                            label="Прикрепить изображение к ответу"
                            value={feedbackPhotoByTask[task.id] ?? ''}
                            onChange={(val) =>
                              setFeedbackPhotoByTask((prev) => ({
                                ...prev,
                                [task.id]: val,
                              }))
                            }
                            onPreview={setPreviewPhotoUrl}
                            disabled={isBusy}
                          />
                        </div>
                      ) : (
                        <div className="text-xs text-slate-600">
                          Отчёт отправлен · Ожидает проверки родителя («Сделано» или «Нет»).
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 4: Approved -> Child gets message «деньги начислятся в течение 10 минут», Parent gets «Прекратить задачу» */}
                  {task.status === 'approved' && (
                    <div className="pt-4 border-t border-slate-100 space-y-3">
                      {task.proofPhotoDataUrl && (
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoUrl(task.proofPhotoDataUrl)}
                            className="text-teal-700 hover:text-teal-800 font-medium"
                          >
                            Посмотреть фотоотчёт
                          </button>
                          {task.proofMessage && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate">{task.proofMessage}</span>
                            </>
                          )}
                        </div>
                      )}

                      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-teal-900">
                            Сделано! Деньги ({formatUah(task.rewardUah)}) начислятся в течение 10 минут
                          </div>
                          <div className="text-xs font-mono tabular-nums text-teal-800">
                            {getRemainingTenMinutesText(task.approvedAt, nowMs)}
                          </div>
                        </div>

                        {canManage && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleCloseTask(task)}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
                          >
                            <StopCircle className="w-4 h-4" />
                            <span>Прекратить задачу</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Step 5: Closed */}
                  {task.status === 'closed' && (
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                      <span className="font-medium text-slate-800">
                        Задача прекращена · Оплата {formatUah(task.rewardUah)} отправлена
                        {task.respondedByName ? ` (${task.respondedByName})` : ''}
                      </span>
                      {Boolean(task.closedAt) && (
                        <span className="text-xs font-mono tabular-nums text-slate-500">
                          {formatTimestampTime(task.closedAt)}
                        </span>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <ImageLightbox
        src={previewPhotoUrl}
        alt="Фото по заданию"
        onClose={() => setPreviewPhotoUrl(null)}
      />
    </div>
  );
}
