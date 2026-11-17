import {
  addAnnouncement,
  addFamilyEvent,
  addHomeTask,
  addSavingsGoal,
  addShoppingItem,
  addTransaction,
  contributeToGoal,
  createChildTask,
  deleteShoppingItem,
  emitAiNotification,
  saveAppAppearance,
  sendFamilyMessage,
  toggleFamilyEvent,
  toggleHomeTask,
  toggleShoppingItem,
  updateFamilySettings,
} from './familyService';
import {
  ANNOUNCEMENT_CATEGORIES,
  DEFAULT_APPEARANCE_SETTINGS,
  EVENT_CATEGORIES,
  HOME_TASK_AREAS,
  MESSAGE_TOPICS,
  RECURRENCE_OPTIONS,
  SHOPPING_CATEGORIES,
  todayIsoDate,
  TRANSACTION_CATEGORIES,
  type AccentTheme,
  type AnnouncementCategory,
  type AppAppearanceSettings,
  type CurrencyCode,
  type EventCategory,
  type FamilyEvent,
  type FamilyMemberAccount,
  type FamilyWorkspace,
  type HomeTask,
  type HomeTaskArea,
  type MessageTopic,
  type NavSection,
  type SavingsGoal,
  type ShoppingCategory,
  type ShoppingItem,
  type SurfaceMode,
  type TaskRecurrence,
  type TransactionCategory,
} from '../types/family';

export interface AiActionPayload {
  type: string;
  brandName?: string;
  accentTheme?: AccentTheme;
  surfaceMode?: SurfaceMode;
  bannerTitle?: string;
  bannerSubtitle?: string;
  liveAnnouncement?: string;
  addCustomNote?: string;
  removeCustomNote?: string;
  clearCustomNotes?: boolean;
  hideSection?: Exclude<NavSection, 'overview'>;
  showSection?: Exclude<NavSection, 'overview'>;
  renameSectionId?: NavSection;
  renameSectionLabel?: string;
  familyName?: string;
  currency?: CurrencyCode;
  title?: string;
  description?: string;
  body?: string;
  rewardUah?: number;
  assigneeName?: string;
  date?: string;
  time?: string;
  category?: string;
  text?: string;
  topic?: MessageTopic;
  pinned?: boolean;
  txType?: 'income' | 'expense';
  amount?: number;
  targetAmount?: number;
  currentAmount?: number;
  deadline?: string;
  name?: string;
  quantity?: string;
  area?: HomeTaskArea;
  dueDate?: string;
  recurrence?: TaskRecurrence;
  targetId?: string;
  completed?: boolean;
  checked?: boolean;
  status?: 'todo' | 'done';
  deltaAmount?: number;
  expiresAt?: string;
  attachUserImage?: boolean;
}

export interface AiCommandContext {
  uid: string;
  userName: string;
  userIsOwner: boolean;
  canManageTasks: boolean;
  family: FamilyWorkspace;
  members: FamilyMemberAccount[];
  appearance: AppAppearanceSettings | null;
  events: FamilyEvent[];
  shopping: ShoppingItem[];
  tasks: HomeTask[];
  goals: SavingsGoal[];
}

export async function runAiCommand(params: {
  prompt: string;
  imageDataUrl?: string;
  history: { role: 'user' | 'assistant'; text: string }[];
  ctx: AiCommandContext;
}): Promise<{ reply: string; applied: string[] }> {
  const { prompt, imageDataUrl, history, ctx } = params;

  const compactContext = {
    userName: ctx.userName,
    userIsOwner: ctx.userIsOwner,
    canManageTasks: ctx.canManageTasks,
    family: {
      name: ctx.family.name,
      currency: ctx.family.currency,
    },
    appearance: ctx.appearance ?? DEFAULT_APPEARANCE_SETTINGS,
    members: ctx.members.map((m) => ({
      uid: m.uid,
      displayName: m.displayName,
      familyRole: m.familyRole ?? (m.role === 'owner' ? 'Создатель' : 'Участник'),
    })),
    upcomingEvents: ctx.events.slice(0, 12).map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      completed: e.completed,
    })),
    shopping: ctx.shopping.slice(0, 20).map((s) => ({
      id: s.id,
      name: s.name,
      quantity: s.quantity,
      checked: s.checked,
    })),
    homeTasks: ctx.tasks.slice(0, 15).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      area: t.area,
    })),
    goals: ctx.goals.slice(0, 10).map((g) => ({
      id: g.id,
      title: g.title,
      currentAmount: g.currentAmount,
      targetAmount: g.targetAmount,
      status: g.status,
    })),
  };

  const response = await fetch('/api/ai/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      imageDataUrl: imageDataUrl || undefined,
      history,
      context: compactContext,
    }),
  });

  const data = (await response.json()) as {
    reply?: string;
    actions?: AiActionPayload[];
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || 'Не удалось выполнить запрос к нейросети.');
  }

  const actions = Array.isArray(data.actions) ? data.actions : [];
  const applied: string[] = [];
  let appearanceChanged = false;
  let workingAppearance: AppAppearanceSettings = ctx.appearance ?? {
    ...DEFAULT_APPEARANCE_SETTINGS,
    familyId: ctx.family.id,
    updatedByUid: ctx.uid,
    updatedByName: ctx.userName,
  };

  for (const act of actions) {
    switch (act.type) {
      case 'reset_appearance': {
        workingAppearance = {
          ...DEFAULT_APPEARANCE_SETTINGS,
          familyId: ctx.family.id,
          updatedByUid: ctx.uid,
          updatedByName: ctx.userName,
        };
        await saveAppAppearance({
          familyId: ctx.family.id,
          uid: ctx.uid,
          userName: ctx.userName,
          next: workingAppearance,
          current: workingAppearance,
        });
        appearanceChanged = true;
        applied.push('Оформление сброшено к стандартному виду');
        break;
      }

      case 'update_appearance': {
        const nextHidden = [...workingAppearance.hiddenSections];
        if (act.hideSection && !nextHidden.includes(act.hideSection)) {
          nextHidden.push(act.hideSection);
        }
        const filteredHidden = act.showSection
          ? nextHidden.filter((s) => s !== act.showSection)
          : nextHidden;

        const nextLabels = { ...workingAppearance.sectionLabels };
        if (act.renameSectionId && typeof act.renameSectionLabel === 'string') {
          if (act.renameSectionLabel.trim()) {
            nextLabels[act.renameSectionId] = act.renameSectionLabel.trim();
          } else {
            delete nextLabels[act.renameSectionId];
          }
        }

        let nextNotes = [...workingAppearance.customNotes];
        if (act.clearCustomNotes) {
          nextNotes = [];
        }
        if (act.removeCustomNote) {
          const needle = act.removeCustomNote.trim().toLowerCase();
          nextNotes = nextNotes.filter((n) => !n.toLowerCase().includes(needle));
        }
        if (act.addCustomNote && act.addCustomNote.trim()) {
          nextNotes.push(act.addCustomNote.trim());
        }

        const nextState = {
          brandName: act.brandName ?? workingAppearance.brandName,
          accentTheme: act.accentTheme ?? workingAppearance.accentTheme,
          surfaceMode: act.surfaceMode ?? workingAppearance.surfaceMode,
          bannerTitle: act.bannerTitle !== undefined ? act.bannerTitle : workingAppearance.bannerTitle,
          bannerSubtitle:
            act.bannerSubtitle !== undefined ? act.bannerSubtitle : workingAppearance.bannerSubtitle,
          liveAnnouncement:
            act.liveAnnouncement !== undefined
              ? act.liveAnnouncement
              : workingAppearance.liveAnnouncement,
          hiddenSections: filteredHidden,
          sectionLabels: nextLabels,
          customNotes: nextNotes,
        };

        await saveAppAppearance({
          familyId: ctx.family.id,
          uid: ctx.uid,
          userName: ctx.userName,
          next: nextState,
          current: workingAppearance,
        });
        workingAppearance = {
          ...workingAppearance,
          ...nextState,
        };
        appearanceChanged = true;
        applied.push('Обновлено оформление / структура приложения для всех');
        break;
      }

      case 'update_family': {
        if (!ctx.userIsOwner) break;
        const nextName = act.familyName?.trim() || ctx.family.name;
        const nextCurrency = act.currency || ctx.family.currency;
        await updateFamilySettings(ctx.family.id, {
          name: nextName,
          currency: nextCurrency,
        });
        applied.push(`Настройки семьи: ${nextName} (${nextCurrency})`);
        break;
      }

      case 'create_child_task': {
        if (!ctx.canManageTasks || !act.title?.trim()) break;
        const matchedMember = act.assigneeName
          ? ctx.members.find((m) =>
              m.displayName.toLowerCase().includes(act.assigneeName!.trim().toLowerCase())
            )
          : undefined;
        await createChildTask({
          familyId: ctx.family.id,
          uid: ctx.uid,
          creatorName: ctx.userName,
          title: act.title,
          description: act.description ?? '',
          rewardUah: Number(act.rewardUah) > 0 ? Number(act.rewardUah) : 50,
          assigneeUid: matchedMember ? matchedMember.uid : '',
          assigneeName: matchedMember ? matchedMember.displayName : act.assigneeName ?? '',
          taskPhotoDataUrl: act.attachUserImage ? imageDataUrl : undefined,
        });
        applied.push(`Создано задание: «${act.title}» (${Number(act.rewardUah) || 50} грн)`);
        break;
      }

      case 'add_event': {
        if (!act.title?.trim()) break;
        const category = EVENT_CATEGORIES.includes(act.category as EventCategory)
          ? (act.category as EventCategory)
          : 'Семейное дело';
        await addFamilyEvent({
          familyId: ctx.family.id,
          uid: ctx.uid,
          actorName: ctx.userName,
          title: act.title,
          date: act.date || todayIsoDate(),
          time: act.time ?? '',
          category,
          assigneeName: act.assigneeName ?? '',
        });
        applied.push(`Добавлено событие: «${act.title}»`);
        break;
      }

      case 'toggle_event': {
        if (!act.targetId) break;
        const evt = ctx.events.find((e) => e.id === act.targetId);
        if (!evt) break;
        await toggleFamilyEvent(ctx.family.id, evt.id, act.completed ?? !evt.completed, {
          uid: ctx.uid,
          name: ctx.userName,
          eventTitle: evt.title,
        });
        applied.push(`Событие «${evt.title}» обновлено`);
        break;
      }

      case 'add_message': {
        if (!act.text?.trim() && !(act.attachUserImage && imageDataUrl)) break;
        const topic = MESSAGE_TOPICS.includes(act.topic as MessageTopic)
          ? (act.topic as MessageTopic)
          : 'Общее';
        await sendFamilyMessage({
          familyId: ctx.family.id,
          authorUid: ctx.uid,
          authorName: ctx.userName,
          text: act.text ?? '',
          topic,
          pinned: Boolean(act.pinned),
          imageDataUrl: act.attachUserImage ? imageDataUrl : undefined,
        });
        applied.push('Отправлено сообщение в семейный чат');
        break;
      }

      case 'add_announcement': {
        const annTitle = act.title?.trim() || act.text?.trim()?.slice(0, 80);
        const annBody = act.body?.trim() || act.description?.trim() || act.text?.trim() || annTitle;
        if (!annTitle || !annBody) break;
        const category = ANNOUNCEMENT_CATEGORIES.includes(act.category as AnnouncementCategory)
          ? (act.category as AnnouncementCategory)
          : 'Важное';
        await addAnnouncement({
          familyId: ctx.family.id,
          authorUid: ctx.uid,
          authorName: ctx.userName,
          title: annTitle,
          body: annBody,
          category,
          pinned: Boolean(act.pinned),
          expiresAt: act.expiresAt ?? act.date ?? '',
          imageDataUrl: act.attachUserImage ? imageDataUrl : undefined,
        });
        applied.push(`Опубликовано объявление на доске: «${annTitle}»`);
        break;
      }

      case 'add_transaction': {
        if (!act.title?.trim() || !(Number(act.amount) > 0)) break;
        const category = TRANSACTION_CATEGORIES.includes(act.category as TransactionCategory)
          ? (act.category as TransactionCategory)
          : 'Прочее';
        await addTransaction({
          familyId: ctx.family.id,
          authorUid: ctx.uid,
          authorName: ctx.userName,
          type: act.txType === 'income' ? 'income' : 'expense',
          amount: Number(act.amount),
          category,
          title: act.title,
          date: act.date || todayIsoDate(),
        });
        applied.push(`Записана операция: «${act.title}» (${act.amount})`);
        break;
      }

      case 'add_goal': {
        if (!act.title?.trim() || !(Number(act.targetAmount) > 0)) break;
        await addSavingsGoal({
          familyId: ctx.family.id,
          uid: ctx.uid,
          title: act.title,
          targetAmount: Number(act.targetAmount),
          currentAmount: Number(act.currentAmount) || 0,
          deadline: act.deadline ?? '',
        });
        applied.push(`Создана цель накопления: «${act.title}»`);
        break;
      }

      case 'contribute_goal': {
        if (!act.targetId || !(Number(act.deltaAmount) > 0)) break;
        const goal = ctx.goals.find((g) => g.id === act.targetId);
        if (!goal) break;
        await contributeToGoal(ctx.family.id, goal, Number(act.deltaAmount));
        applied.push(`Пополнена цель «${goal.title}»`);
        break;
      }

      case 'add_shopping': {
        const itemName = act.name?.trim() || act.title?.trim();
        if (!itemName) break;
        const category = SHOPPING_CATEGORIES.includes(act.category as ShoppingCategory)
          ? (act.category as ShoppingCategory)
          : 'Продукты';
        await addShoppingItem({
          familyId: ctx.family.id,
          uid: ctx.uid,
          userName: ctx.userName,
          name: itemName,
          quantity: act.quantity ?? '',
          category,
        });
        applied.push(`Добавлено в покупки: «${itemName}»`);
        break;
      }

      case 'toggle_shopping': {
        if (!act.targetId) break;
        const item = ctx.shopping.find((s) => s.id === act.targetId);
        if (!item) break;
        await toggleShoppingItem(ctx.family.id, item.id, act.checked ?? !item.checked);
        applied.push(`Покупка «${item.name}» обновлена`);
        break;
      }

      case 'delete_shopping': {
        if (!act.targetId) break;
        const item = ctx.shopping.find((s) => s.id === act.targetId);
        if (!item) break;
        await deleteShoppingItem(ctx.family.id, item.id);
        applied.push(`Удалено из покупок: «${item.name}»`);
        break;
      }

      case 'add_home_task': {
        if (!act.title?.trim()) break;
        const area = HOME_TASK_AREAS.includes(act.area as HomeTaskArea)
          ? (act.area as HomeTaskArea)
          : 'Уборка';
        const recurrence = RECURRENCE_OPTIONS.includes(act.recurrence as TaskRecurrence)
          ? (act.recurrence as TaskRecurrence)
          : 'Разовое';
        await addHomeTask({
          familyId: ctx.family.id,
          uid: ctx.uid,
          title: act.title,
          area,
          assigneeName: act.assigneeName ?? '',
          dueDate: act.dueDate || act.date || '',
          recurrence,
          amount: Number(act.amount) || 0,
        });
        applied.push(`Добавлено домашнее дело: «${act.title}»`);
        break;
      }

      case 'toggle_home_task': {
        if (!act.targetId) break;
        const task = ctx.tasks.find((t) => t.id === act.targetId);
        if (!task) break;
        await toggleHomeTask(
          ctx.family.id,
          task.id,
          act.status ?? (task.status === 'done' ? 'todo' : 'done')
        );
        applied.push(`Дело «${task.title}» обновлено`);
        break;
      }
    }
  }

  if (appearanceChanged) {
    await emitAiNotification({
      familyId: ctx.family.id,
      uid: ctx.uid,
      userName: ctx.userName,
      title: 'Нейросеть обновила приложение',
      body: applied.slice(0, 2).join(' · ') || 'Изменения применены для всей семьи',
      targetSection: 'overview',
    });
  }

  return {
    reply: data.reply || 'Готово, изменения применены.',
    applied,
  };
}
