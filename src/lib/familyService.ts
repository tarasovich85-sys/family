import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  DEFAULT_APPEARANCE_SETTINGS,
  LIMITS,
  todayIsoDate,
  type AnnouncementCategory,
  type AppAppearanceSettings,
  type ChildTask,
  type CurrencyCode,
  type EventCategory,
  type FamilyAnnouncement,
  type FamilyEvent,
  type FamilyMemberAccount,
  type FamilyMessage,
  type FamilyNotification,
  type FamilyPersonProfile,
  type FamilyRelation,
  type FamilyRole,
  type FamilyWorkspace,
  type HomeTask,
  type HomeTaskArea,
  type MessageTopic,
  type MoneyTransaction,
  type NavSection,
  type SavingsGoal,
  type ShoppingCategory,
  type ShoppingItem,
  type TaskRecurrence,
  type TransactionCategory,
  type UserProfile,
} from '../types/family';

function sanitizeText(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

const IMAGE_DATA_URL_REGEX = /^data:image\/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function sanitizeImageDataUrl(value?: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > LIMITS.PHOTO_DATA_MAX) return '';
  return IMAGE_DATA_URL_REGEX.test(trimmed) ? trimmed : '';
}

function generateId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let part1 = '';
  let part2 = '';
  for (let i = 0; i < 4; i++) {
    part1 += chars[Math.floor(Math.random() * chars.length)];
    part2 += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${part1}-${part2}`;
}

// --- User Profile ---
export async function ensureUserProfile(uid: string, rawName: string): Promise<UserProfile> {
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);
  const displayName = sanitizeText(rawName || 'Участник семьи', LIMITS.DISPLAY_NAME_MAX) || 'Участник семьи';
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    const payload: UserProfile = {
      uid,
      displayName,
      activeFamilyId: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

// --- Create or Join Family ---
export async function createFamilyWorkspace(params: {
  uid: string;
  userName: string;
  familyName: string;
  currency: CurrencyCode;
}): Promise<string> {
  const familyId = generateId('fam');
  const inviteCode = generateInviteCode();
  const profileId = generateId('prof');
  const cleanFamilyName = sanitizeText(params.familyName, LIMITS.FAMILY_NAME_MAX) || 'Наша семья';
  const cleanUserName = sanitizeText(params.userName, LIMITS.DISPLAY_NAME_MAX) || 'Участник';

  const batch = writeBatch(db);

  batch.set(doc(db, 'families', familyId), {
    id: familyId,
    name: cleanFamilyName,
    currency: params.currency,
    inviteCode,
    ownerId: params.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'families', familyId, 'members', params.uid), {
    uid: params.uid,
    familyId,
    displayName: cleanUserName,
    role: 'owner',
    familyRole: 'Создатель',
    inviteCode,
    joinedAt: serverTimestamp(),
    lastReadMessagesAt: serverTimestamp(),
    lastReadEventsAt: serverTimestamp(),
    lastReadTasksAt: serverTimestamp(),
    lastReadBoardAt: serverTimestamp(),
    lastReadNotificationsAt: serverTimestamp(),
    pushEnabled: false,
  });

  batch.set(doc(db, 'familyInvites', inviteCode), {
    code: inviteCode,
    familyId,
    familyName: cleanFamilyName,
    ownerId: params.uid,
    createdAt: serverTimestamp(),
  });

  batch.update(doc(db, 'users', params.uid), {
    activeFamilyId: familyId,
    displayName: cleanUserName,
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();

    // Create initial person profile card for creator
    await setDoc(doc(db, 'families', familyId, 'profiles', profileId), {
      id: profileId,
      familyId,
      name: cleanUserName,
      relation: 'Взрослый',
      birthDate: '',
      note: 'Создатель семейного пространства',
      linkedUid: params.uid,
      createdBy: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return familyId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `families/${familyId}`);
  }
}

export async function joinFamilyByInviteCode(params: {
  uid: string;
  userName: string;
  rawCode: string;
}): Promise<{ familyId: string; familyName: string }> {
  const code = params.rawCode.trim().toUpperCase().replace(/[^A-Z0-9\-]/g, '');
  if (code.length < 4 || code.length > 32) {
    throw new Error('INVALID_CODE');
  }

  const invitePath = `familyInvites/${code}`;
  let inviteData: { familyId: string; familyName: string } | null = null;
  try {
    const inviteSnap = await getDoc(doc(db, 'familyInvites', code));
    if (!inviteSnap.exists()) {
      throw new Error('INVITE_NOT_FOUND');
    }
    inviteData = inviteSnap.data() as { familyId: string; familyName: string };
  } catch (error) {
    if (error instanceof Error && error.message === 'INVITE_NOT_FOUND') {
      throw error;
    }
    handleFirestoreError(error, OperationType.GET, invitePath);
  }

  const familyId = inviteData.familyId;
  const cleanUserName = sanitizeText(params.userName, LIMITS.DISPLAY_NAME_MAX) || 'Участник';
  const memberPath = `families/${familyId}/members/${params.uid}`;

  try {
    const existingMember = await getDoc(doc(db, 'families', familyId, 'members', params.uid));
    if (!existingMember.exists()) {
      await setDoc(doc(db, 'families', familyId, 'members', params.uid), {
        uid: params.uid,
        familyId,
        displayName: cleanUserName,
        role: 'member',
        familyRole: 'Участник',
        inviteCode: code,
        joinedAt: serverTimestamp(),
        lastReadMessagesAt: serverTimestamp(),
        lastReadEventsAt: serverTimestamp(),
        lastReadTasksAt: serverTimestamp(),
        lastReadBoardAt: serverTimestamp(),
        lastReadNotificationsAt: serverTimestamp(),
        pushEnabled: false,
      });

      const profileId = generateId('prof');
      await setDoc(doc(db, 'families', familyId, 'profiles', profileId), {
        id: profileId,
        familyId,
        name: cleanUserName,
        relation: 'Взрослый',
        birthDate: '',
        note: 'Присоединился по приглашению',
        linkedUid: params.uid,
        createdBy: params.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await updateDoc(doc(db, 'users', params.uid), {
      activeFamilyId: familyId,
      displayName: cleanUserName,
      updatedAt: serverTimestamp(),
    });

    return { familyId, familyName: inviteData.familyName };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, memberPath);
  }
}

export async function updateFamilySettings(
  familyId: string,
  updates: { name: string; currency: CurrencyCode }
): Promise<void> {
  const path = `families/${familyId}`;
  try {
    await updateDoc(doc(db, 'families', familyId), {
      name: sanitizeText(updates.name, LIMITS.FAMILY_NAME_MAX) || 'Наша семья',
      currency: updates.currency,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function clearUserActiveFamily(uid: string): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      activeFamilyId: '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function doesFamilyMemberExist(familyId: string, uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'families', familyId, 'members', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function leaveFamilyAsMember(params: {
  familyId: string;
  uid: string;
}): Promise<void> {
  const path = `families/${params.familyId}/members/${params.uid}`;
  try {
    const profilesSnap = await getDocs(
      query(
        collection(db, 'families', params.familyId, 'profiles'),
        where('familyId', '==', params.familyId)
      )
    );

    const batch = writeBatch(db);
    for (const profDoc of profilesSnap.docs) {
      const data = profDoc.data() as { linkedUid?: string };
      if (data.linkedUid === params.uid) {
        batch.delete(profDoc.ref);
      }
    }
    batch.delete(doc(db, 'families', params.familyId, 'members', params.uid));
    batch.update(doc(db, 'users', params.uid), {
      activeFamilyId: '',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function removeFamilyMember(params: {
  familyId: string;
  memberUid: string;
}): Promise<void> {
  const path = `families/${params.familyId}/members/${params.memberUid}`;
  try {
    const profilesSnap = await getDocs(
      query(
        collection(db, 'families', params.familyId, 'profiles'),
        where('familyId', '==', params.familyId)
      )
    );

    const batch = writeBatch(db);
    for (const profDoc of profilesSnap.docs) {
      const data = profDoc.data() as { linkedUid?: string };
      if (data.linkedUid === params.memberUid) {
        batch.delete(profDoc.ref);
      }
    }
    batch.delete(doc(db, 'families', params.familyId, 'members', params.memberUid));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function wipeFamilyAndStartFresh(params: {
  familyId: string;
  ownerUid: string;
  inviteCode: string;
}): Promise<void> {
  const path = `families/${params.familyId}`;
  const subcollections = [
    'profiles',
    'events',
    'messages',
    'announcements',
    'transactions',
    'goals',
    'shopping',
    'tasks',
    'childTasks',
    'notifications',
  ] as const;

  try {
    const deleteRefs: DocumentReference[] = [];

    for (const sub of subcollections) {
      const snap = await getDocs(
        query(
          collection(db, 'families', params.familyId, sub),
          where('familyId', '==', params.familyId)
        )
      );
      for (const d of snap.docs) {
        deleteRefs.push(d.ref);
      }
    }

    const appearanceRef = doc(db, 'families', params.familyId, 'settings', 'appearance');
    const appearanceSnap = await getDoc(appearanceRef);
    if (appearanceSnap.exists()) {
      deleteRefs.push(appearanceRef);
    }

    if (params.inviteCode) {
      const inviteRef = doc(db, 'familyInvites', params.inviteCode);
      const inviteSnap = await getDoc(inviteRef);
      if (inviteSnap.exists()) {
        deleteRefs.push(inviteRef);
      }
    }

    const membersSnap = await getDocs(
      query(
        collection(db, 'families', params.familyId, 'members'),
        where('familyId', '==', params.familyId)
      )
    );
    for (const mDoc of membersSnap.docs) {
      if (mDoc.id !== params.ownerUid) {
        deleteRefs.push(mDoc.ref);
      }
    }

    // Commit Phase 1 deletes in chunks of 400 (Firestore batch limit is 500)
    for (let i = 0; i < deleteRefs.length; i += 400) {
      const chunk = deleteRefs.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const ref of chunk) {
        batch.delete(ref);
      }
      await batch.commit();
    }

    // Phase 2: Atomic delete of owner membership + root family doc + reset user activeFamilyId
    const finalBatch = writeBatch(db);
    finalBatch.delete(doc(db, 'families', params.familyId, 'members', params.ownerUid));
    finalBatch.delete(doc(db, 'families', params.familyId));
    finalBatch.update(doc(db, 'users', params.ownerUid), {
      activeFamilyId: '',
      updatedAt: serverTimestamp(),
    });
    await finalBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Subscriptions ---
export function subscribeCurrentMember(
  familyId: string,
  uid: string,
  onData: (member: FamilyMemberAccount | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `families/${familyId}/members/${uid}`;
  return onSnapshot(
    doc(db, 'families', familyId, 'members', uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as FamilyMemberAccount) : null);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}
export function subscribeFamilyWorkspace(
  familyId: string,
  onData: (family: FamilyWorkspace | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `families/${familyId}`;
  return onSnapshot(
    doc(db, 'families', familyId),
    (snap) => {
      onData(snap.exists() ? (snap.data() as FamilyWorkspace) : null);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

function subscribeFamilyCollection<T>(
  familyId: string,
  subcollection: string,
  onData: (items: T[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `families/${familyId}/${subcollection}`;
  const q = query(collection(db, 'families', familyId, subcollection), where('familyId', '==', familyId));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as T));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export const subscribeMembers = (
  familyId: string,
  onData: (items: FamilyMemberAccount[]) => void,
  onError: (err: Error) => void
) => subscribeFamilyCollection<FamilyMemberAccount>(familyId, 'members', onData, onError);

export const subscribeProfiles = (
  familyId: string,
  onData: (items: FamilyPersonProfile[]) => void,
  onError: (err: Error) => void
) => subscribeFamilyCollection<FamilyPersonProfile>(familyId, 'profiles', onData, onError);

export const subscribeEvents = (
  familyId: string,
  onData: (items: FamilyEvent[]) => void,
  onError: (err: Error) => void
) => subscribeFamilyCollection<FamilyEvent>(familyId, 'events', onData, onError);

export const subscribeMessages = (
  familyId: string,
  onData: (items: FamilyMessage[]) => void,
  onError: (err: Error) => void
) => subscribeFamilyCollection<FamilyMessage>(familyId, 'messages', onData, onError);

export const subscribeTransactions = (
  familyId: string,
  onData: (items: MoneyTransaction[]) => void,
  onError: (err: Error) => void
) => subscribeFamilyCollection<MoneyTransaction>(familyId, 'transactions', onData, onError);

export const subscribeGoals = (
  familyId: string,
  onData: (items: SavingsGoal[]) => void,
  onError: (err: Error) => void
) => subscribeFamilyCollection<SavingsGoal>(familyId, 'goals', onData, onError);

export const subscribeShopping = (
  familyId: string,
  onData: (items: ShoppingItem[]) => void,
  onError: (err: Error) => void
) => subscribeFamilyCollection<ShoppingItem>(familyId, 'shopping', onData, onError);

export const subscribeHomeTasks = (
  familyId: string,
  onData: (items: HomeTask[]) => void,
  onError: (err: Error) => void
) => subscribeFamilyCollection<HomeTask>(familyId, 'tasks', onData, onError);

export const subscribeNotifications = (
  familyId: string,
  onData: (items: FamilyNotification[]) => void,
  onError: (err: Error) => void
) => subscribeFamilyCollection<FamilyNotification>(familyId, 'notifications', onData, onError);

export const subscribeChildTasks = (
  familyId: string,
  onData: (items: ChildTask[]) => void,
  onError: (err: Error) => void
) => subscribeFamilyCollection<ChildTask>(familyId, 'childTasks', onData, onError);

export const subscribeAnnouncements = (
  familyId: string,
  onData: (items: FamilyAnnouncement[]) => void,
  onError: (err: Error) => void
) => subscribeFamilyCollection<FamilyAnnouncement>(familyId, 'announcements', onData, onError);

export function subscribeAppAppearance(
  familyId: string,
  onData: (settings: AppAppearanceSettings | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `families/${familyId}/settings/appearance`;
  return onSnapshot(
    doc(db, 'families', familyId, 'settings', 'appearance'),
    (snap) => {
      onData(snap.exists() ? (snap.data() as AppAppearanceSettings) : null);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

const ALLOWED_HIDDEN_SECTIONS: ReadonlyArray<Exclude<NavSection, 'overview'>> = [
  'board',
  'family',
  'tasks',
  'communication',
  'money',
  'home',
];
const ALLOWED_LABEL_KEYS: ReadonlyArray<NavSection> = [
  'overview',
  'board',
  'family',
  'tasks',
  'communication',
  'money',
  'home',
];

export async function saveAppAppearance(params: {
  familyId: string;
  uid: string;
  userName: string;
  next: Partial<
    Pick<
      AppAppearanceSettings,
      | 'brandName'
      | 'accentTheme'
      | 'surfaceMode'
      | 'bannerTitle'
      | 'bannerSubtitle'
      | 'liveAnnouncement'
      | 'hiddenSections'
      | 'sectionLabels'
      | 'customNotes'
    >
  >;
  current?: AppAppearanceSettings | null;
}): Promise<void> {
  const path = `families/${params.familyId}/settings/appearance`;
  const base = params.current ?? {
    ...DEFAULT_APPEARANCE_SETTINGS,
    familyId: params.familyId,
    updatedByUid: params.uid,
    updatedByName: params.userName,
  };

  const brandName =
    sanitizeText(params.next.brandName ?? base.brandName, LIMITS.BRAND_NAME_MAX) || 'Семья';
  const accentTheme = params.next.accentTheme ?? base.accentTheme;
  const surfaceMode = params.next.surfaceMode ?? base.surfaceMode;
  const bannerTitle = sanitizeText(params.next.bannerTitle ?? base.bannerTitle, LIMITS.TITLE_MAX);
  const bannerSubtitle = sanitizeText(
    params.next.bannerSubtitle ?? base.bannerSubtitle,
    LIMITS.NOTIFICATION_BODY_MAX
  );
  const liveAnnouncement = sanitizeText(
    params.next.liveAnnouncement ?? base.liveAnnouncement,
    LIMITS.NOTIFICATION_BODY_MAX
  );

  const rawHidden = params.next.hiddenSections ?? base.hiddenSections;
  const hiddenSections = Array.from(
    new Set(rawHidden.filter((s) => ALLOWED_HIDDEN_SECTIONS.includes(s)))
  ).slice(0, 5);

  const rawLabels = params.next.sectionLabels ?? base.sectionLabels;
  const sectionLabels: Partial<Record<NavSection, string>> = {};
  for (const key of ALLOWED_LABEL_KEYS) {
    const val = rawLabels[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      sectionLabels[key] = sanitizeText(val, LIMITS.SECTION_LABEL_MAX);
    }
  }

  const rawNotes = params.next.customNotes ?? base.customNotes;
  const customNotes = rawNotes
    .map((n) => sanitizeText(String(n), LIMITS.CUSTOM_NOTE_MAX))
    .filter((n) => n.length > 0)
    .slice(0, 10);

  const cleanActor = sanitizeText(params.userName, LIMITS.DISPLAY_NAME_MAX) || 'Участник';

  try {
    await setDoc(doc(db, 'families', params.familyId, 'settings', 'appearance'), {
      id: 'appearance',
      familyId: params.familyId,
      brandName,
      accentTheme,
      surfaceMode,
      bannerTitle,
      bannerSubtitle,
      liveAnnouncement,
      hiddenSections,
      sectionLabels,
      customNotes,
      updatedByUid: params.uid,
      updatedByName: cleanActor,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function emitAiNotification(params: {
  familyId: string;
  uid: string;
  userName: string;
  title: string;
  body: string;
  targetSection?: NavSection;
}): Promise<void> {
  const id = generateId('ntf');
  const path = `families/${params.familyId}/notifications/${id}`;
  const cleanActor = sanitizeText(params.userName, LIMITS.DISPLAY_NAME_MAX) || 'Участник';
  try {
    await setDoc(doc(db, 'families', params.familyId, 'notifications', id), {
      id,
      familyId: params.familyId,
      kind: 'ai',
      action: 'updated',
      title: sanitizeText(params.title, LIMITS.TITLE_MAX) || 'Обновление через нейросеть',
      body: sanitizeText(params.body, LIMITS.NOTIFICATION_BODY_MAX),
      targetSection: params.targetSection ?? 'overview',
      actorUid: params.uid,
      actorName: cleanActor,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function markMemberReadState(
  familyId: string,
  uid: string,
  options: {
    messages?: boolean;
    events?: boolean;
    tasks?: boolean;
    board?: boolean;
    notifications?: boolean;
    pushEnabled?: boolean;
  }
): Promise<void> {
  const path = `families/${familyId}/members/${uid}`;
  const updates: Record<string, unknown> = {};
  if (options.messages) updates.lastReadMessagesAt = serverTimestamp();
  if (options.events) updates.lastReadEventsAt = serverTimestamp();
  if (options.tasks) updates.lastReadTasksAt = serverTimestamp();
  if (options.board) updates.lastReadBoardAt = serverTimestamp();
  if (options.notifications) updates.lastReadNotificationsAt = serverTimestamp();
  if (typeof options.pushEnabled === 'boolean') updates.pushEnabled = options.pushEnabled;
  if (Object.keys(updates).length === 0) return;

  try {
    await updateDoc(doc(db, 'families', familyId, 'members', uid), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateMemberFamilyRole(
  familyId: string,
  memberUid: string,
  familyRole: FamilyRole
): Promise<void> {
  const path = `families/${familyId}/members/${memberUid}`;
  try {
    await updateDoc(doc(db, 'families', familyId, 'members', memberUid), {
      familyRole,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// --- Family Profiles & Events CRUD ---
export async function addPersonProfile(params: {
  familyId: string;
  uid: string;
  name: string;
  relation: FamilyRelation;
  birthDate: string;
  note: string;
}): Promise<void> {
  const id = generateId('prof');
  const path = `families/${params.familyId}/profiles/${id}`;
  try {
    await setDoc(doc(db, 'families', params.familyId, 'profiles', id), {
      id,
      familyId: params.familyId,
      name: sanitizeText(params.name, LIMITS.DISPLAY_NAME_MAX),
      relation: params.relation,
      birthDate: sanitizeText(params.birthDate, LIMITS.DATE_MAX),
      note: sanitizeText(params.note, LIMITS.NOTE_MAX),
      linkedUid: '',
      createdBy: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deletePersonProfile(familyId: string, profileId: string): Promise<void> {
  const path = `families/${familyId}/profiles/${profileId}`;
  try {
    await deleteDoc(doc(db, 'families', familyId, 'profiles', profileId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addFamilyEvent(params: {
  familyId: string;
  uid: string;
  actorName: string;
  title: string;
  date: string;
  time: string;
  category: EventCategory;
  assigneeName: string;
}): Promise<void> {
  const id = generateId('evt');
  const notifId = generateId('ntf');
  const path = `families/${params.familyId}/events/${id}`;
  const cleanTitle = sanitizeText(params.title, LIMITS.TITLE_MAX);
  const cleanActor = sanitizeText(params.actorName, LIMITS.DISPLAY_NAME_MAX) || 'Участник';
  const cleanDate = sanitizeText(params.date || todayIsoDate(), LIMITS.DATE_MAX);
  const cleanTime = sanitizeText(params.time, LIMITS.TIME_MAX);

  const batch = writeBatch(db);
  batch.set(doc(db, 'families', params.familyId, 'events', id), {
    id,
    familyId: params.familyId,
    title: cleanTitle,
    date: cleanDate,
    time: cleanTime,
    category: params.category,
    assigneeName: sanitizeText(params.assigneeName, LIMITS.DISPLAY_NAME_MAX),
    completed: false,
    createdBy: params.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'families', params.familyId, 'notifications', notifId), {
    id: notifId,
    familyId: params.familyId,
    kind: 'event',
    action: 'created',
    title: sanitizeText(`Новое событие: ${cleanTitle}`, LIMITS.TITLE_MAX),
    body: sanitizeText(
      `${cleanDate}${cleanTime ? ` в ${cleanTime}` : ''} · ${params.category}`,
      LIMITS.NOTIFICATION_BODY_MAX
    ),
    targetSection: 'family',
    actorUid: params.uid,
    actorName: cleanActor,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleFamilyEvent(
  familyId: string,
  eventId: string,
  completed: boolean,
  actor?: { uid: string; name: string; eventTitle: string }
): Promise<void> {
  const path = `families/${familyId}/events/${eventId}`;
  const batch = writeBatch(db);
  batch.update(doc(db, 'families', familyId, 'events', eventId), {
    completed,
    updatedAt: serverTimestamp(),
  });

  if (actor) {
    const notifId = generateId('ntf');
    const cleanActor = sanitizeText(actor.name, LIMITS.DISPLAY_NAME_MAX) || 'Участник';
    const actionLabel = completed ? 'Выполнено событие' : 'Возобновлено событие';
    batch.set(doc(db, 'families', familyId, 'notifications', notifId), {
      id: notifId,
      familyId,
      kind: 'event',
      action: completed ? 'completed' : 'reopened',
      title: sanitizeText(`${actionLabel}: ${actor.eventTitle}`, LIMITS.TITLE_MAX),
      body: sanitizeText(
        completed ? 'Отмечено как завершённое в календаре' : 'Событие снова активно в календаре',
        LIMITS.NOTIFICATION_BODY_MAX
      ),
      targetSection: 'family',
      actorUid: actor.uid,
      actorName: cleanActor,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFamilyEvent(
  familyId: string,
  eventId: string,
  actor?: { uid: string; name: string; eventTitle: string }
): Promise<void> {
  const path = `families/${familyId}/events/${eventId}`;
  const batch = writeBatch(db);
  batch.delete(doc(db, 'families', familyId, 'events', eventId));

  if (actor) {
    const notifId = generateId('ntf');
    const cleanActor = sanitizeText(actor.name, LIMITS.DISPLAY_NAME_MAX) || 'Участник';
    batch.set(doc(db, 'families', familyId, 'notifications', notifId), {
      id: notifId,
      familyId,
      kind: 'event',
      action: 'deleted',
      title: sanitizeText(`Удалено событие: ${actor.eventTitle}`, LIMITS.TITLE_MAX),
      body: 'Событие убрано из семейного календаря',
      targetSection: 'family',
      actorUid: actor.uid,
      actorName: cleanActor,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Communication Messages CRUD ---
export async function sendFamilyMessage(params: {
  familyId: string;
  authorUid: string;
  authorName: string;
  text: string;
  topic: MessageTopic;
  pinned?: boolean;
  imageDataUrl?: string;
}): Promise<void> {
  const id = generateId('msg');
  const notifId = generateId('ntf');
  const path = `families/${params.familyId}/messages/${id}`;
  const cleanImage = sanitizeImageDataUrl(params.imageDataUrl);
  const cleanText =
    sanitizeText(params.text, LIMITS.MESSAGE_MAX) || (cleanImage ? 'Изображение' : '');
  const cleanAuthor = sanitizeText(params.authorName, LIMITS.DISPLAY_NAME_MAX) || 'Участник';

  const batch = writeBatch(db);
  batch.set(doc(db, 'families', params.familyId, 'messages', id), {
    id,
    familyId: params.familyId,
    text: cleanText,
    topic: params.topic,
    pinned: Boolean(params.pinned),
    imageDataUrl: cleanImage,
    authorUid: params.authorUid,
    authorName: cleanAuthor,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'families', params.familyId, 'notifications', notifId), {
    id: notifId,
    familyId: params.familyId,
    kind: 'message',
    action: 'created',
    title: sanitizeText(`Новое сообщение (${params.topic})`, LIMITS.TITLE_MAX),
    body: sanitizeText(
      params.text.trim() || (cleanImage ? 'Прикреплено изображение' : cleanText),
      LIMITS.NOTIFICATION_BODY_MAX
    ),
    targetSection: 'communication',
    actorUid: params.authorUid,
    actorName: cleanAuthor,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleMessagePin(
  familyId: string,
  messageId: string,
  pinned: boolean
): Promise<void> {
  const path = `families/${familyId}/messages/${messageId}`;
  try {
    await updateDoc(doc(db, 'families', familyId, 'messages', messageId), {
      pinned,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFamilyMessage(familyId: string, messageId: string): Promise<void> {
  const path = `families/${familyId}/messages/${messageId}`;
  try {
    await deleteDoc(doc(db, 'families', familyId, 'messages', messageId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Bulletin Board Announcements CRUD ---
export async function addAnnouncement(params: {
  familyId: string;
  authorUid: string;
  authorName: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  pinned?: boolean;
  expiresAt?: string;
  imageDataUrl?: string;
}): Promise<void> {
  const id = generateId('ann');
  const notifId = generateId('ntf');
  const path = `families/${params.familyId}/announcements/${id}`;
  const cleanTitle = sanitizeText(params.title, LIMITS.TITLE_MAX);
  const cleanBody = sanitizeText(params.body, LIMITS.ANNOUNCEMENT_BODY_MAX);
  const cleanAuthor = sanitizeText(params.authorName, LIMITS.DISPLAY_NAME_MAX) || 'Участник';
  const cleanExpires = sanitizeText(params.expiresAt ?? '', LIMITS.DATE_MAX);
  const cleanImage = sanitizeImageDataUrl(params.imageDataUrl);

  const batch = writeBatch(db);
  batch.set(doc(db, 'families', params.familyId, 'announcements', id), {
    id,
    familyId: params.familyId,
    title: cleanTitle,
    body: cleanBody,
    category: params.category,
    pinned: Boolean(params.pinned),
    status: 'active',
    expiresAt: cleanExpires,
    imageDataUrl: cleanImage,
    authorUid: params.authorUid,
    authorName: cleanAuthor,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'families', params.familyId, 'notifications', notifId), {
    id: notifId,
    familyId: params.familyId,
    kind: 'board',
    action: 'created',
    title: sanitizeText(`Объявление: ${cleanTitle}`, LIMITS.TITLE_MAX),
    body: sanitizeText(cleanBody, LIMITS.NOTIFICATION_BODY_MAX),
    targetSection: 'board',
    actorUid: params.authorUid,
    actorName: cleanAuthor,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateAnnouncement(params: {
  familyId: string;
  announcementId: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  pinned: boolean;
  status: 'active' | 'archived';
  expiresAt: string;
  imageDataUrl?: string;
}): Promise<void> {
  const path = `families/${params.familyId}/announcements/${params.announcementId}`;
  try {
    await updateDoc(doc(db, 'families', params.familyId, 'announcements', params.announcementId), {
      title: sanitizeText(params.title, LIMITS.TITLE_MAX),
      body: sanitizeText(params.body, LIMITS.ANNOUNCEMENT_BODY_MAX),
      category: params.category,
      pinned: params.pinned,
      status: params.status,
      expiresAt: sanitizeText(params.expiresAt, LIMITS.DATE_MAX),
      imageDataUrl: sanitizeImageDataUrl(params.imageDataUrl),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleAnnouncementPin(
  familyId: string,
  announcementId: string,
  pinned: boolean
): Promise<void> {
  const path = `families/${familyId}/announcements/${announcementId}`;
  try {
    await updateDoc(doc(db, 'families', familyId, 'announcements', announcementId), {
      pinned,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleAnnouncementStatus(
  familyId: string,
  announcementId: string,
  status: 'active' | 'archived'
): Promise<void> {
  const path = `families/${familyId}/announcements/${announcementId}`;
  try {
    await updateDoc(doc(db, 'families', familyId, 'announcements', announcementId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAnnouncement(familyId: string, announcementId: string): Promise<void> {
  const path = `families/${familyId}/announcements/${announcementId}`;
  try {
    await deleteDoc(doc(db, 'families', familyId, 'announcements', announcementId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Money Transactions & Goals CRUD ---
export async function addTransaction(params: {
  familyId: string;
  authorUid: string;
  authorName: string;
  type: 'income' | 'expense';
  amount: number;
  category: TransactionCategory;
  title: string;
  date: string;
}): Promise<void> {
  const id = generateId('tx');
  const path = `families/${params.familyId}/transactions/${id}`;
  const safeAmount = Math.min(Math.max(Number(params.amount) || 0, 1), LIMITS.AMOUNT_MAX);
  try {
    await setDoc(doc(db, 'families', params.familyId, 'transactions', id), {
      id,
      familyId: params.familyId,
      type: params.type,
      amount: safeAmount,
      category: params.category,
      title: sanitizeText(params.title, LIMITS.TITLE_MAX),
      date: sanitizeText(params.date || todayIsoDate(), LIMITS.DATE_MAX),
      authorUid: params.authorUid,
      authorName: sanitizeText(params.authorName, LIMITS.DISPLAY_NAME_MAX) || 'Участник',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteTransaction(familyId: string, transactionId: string): Promise<void> {
  const path = `families/${familyId}/transactions/${transactionId}`;
  try {
    await deleteDoc(doc(db, 'families', familyId, 'transactions', transactionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addSavingsGoal(params: {
  familyId: string;
  uid: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
}): Promise<void> {
  const id = generateId('goal');
  const path = `families/${params.familyId}/goals/${id}`;
  const targetAmount = Math.min(Math.max(Number(params.targetAmount) || 1, 1), LIMITS.AMOUNT_MAX);
  const currentAmount = Math.min(Math.max(Number(params.currentAmount) || 0, 0), LIMITS.AMOUNT_MAX);
  const status = currentAmount >= targetAmount ? 'completed' : 'active';
  try {
    await setDoc(doc(db, 'families', params.familyId, 'goals', id), {
      id,
      familyId: params.familyId,
      title: sanitizeText(params.title, LIMITS.SHORT_TITLE_MAX),
      targetAmount,
      currentAmount,
      deadline: sanitizeText(params.deadline, LIMITS.DATE_MAX),
      status,
      createdBy: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function contributeToGoal(
  familyId: string,
  goal: SavingsGoal,
  delta: number
): Promise<void> {
  const path = `families/${familyId}/goals/${goal.id}`;
  const nextAmount = Math.min(Math.max(goal.currentAmount + delta, 0), LIMITS.AMOUNT_MAX);
  const nextStatus = nextAmount >= goal.targetAmount ? 'completed' : 'active';
  try {
    await updateDoc(doc(db, 'families', familyId, 'goals', goal.id), {
      currentAmount: nextAmount,
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteSavingsGoal(familyId: string, goalId: string): Promise<void> {
  const path = `families/${familyId}/goals/${goalId}`;
  try {
    await deleteDoc(doc(db, 'families', familyId, 'goals', goalId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Home Shopping & Tasks CRUD ---
export async function addShoppingItem(params: {
  familyId: string;
  uid: string;
  userName: string;
  name: string;
  quantity: string;
  category: ShoppingCategory;
}): Promise<void> {
  const id = generateId('shop');
  const path = `families/${params.familyId}/shopping/${id}`;
  try {
    await setDoc(doc(db, 'families', params.familyId, 'shopping', id), {
      id,
      familyId: params.familyId,
      name: sanitizeText(params.name, LIMITS.SHORT_TITLE_MAX),
      quantity: sanitizeText(params.quantity, LIMITS.QUANTITY_MAX),
      category: params.category,
      checked: false,
      addedByUid: params.uid,
      addedByName: sanitizeText(params.userName, LIMITS.DISPLAY_NAME_MAX) || 'Участник',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleShoppingItem(
  familyId: string,
  itemId: string,
  checked: boolean
): Promise<void> {
  const path = `families/${familyId}/shopping/${itemId}`;
  try {
    await updateDoc(doc(db, 'families', familyId, 'shopping', itemId), {
      checked,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteShoppingItem(familyId: string, itemId: string): Promise<void> {
  const path = `families/${familyId}/shopping/${itemId}`;
  try {
    await deleteDoc(doc(db, 'families', familyId, 'shopping', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearCheckedShoppingItems(
  familyId: string,
  checkedIds: string[]
): Promise<void> {
  if (checkedIds.length === 0) return;
  const batch = writeBatch(db);
  for (const id of checkedIds) {
    batch.delete(doc(db, 'families', familyId, 'shopping', id));
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `families/${familyId}/shopping`);
  }
}

export async function addHomeTask(params: {
  familyId: string;
  uid: string;
  title: string;
  area: HomeTaskArea;
  assigneeName: string;
  dueDate: string;
  recurrence: TaskRecurrence;
  amount: number;
}): Promise<void> {
  const id = generateId('task');
  const path = `families/${params.familyId}/tasks/${id}`;
  const safeAmount = Math.min(Math.max(Number(params.amount) || 0, 0), LIMITS.AMOUNT_MAX);
  try {
    await setDoc(doc(db, 'families', params.familyId, 'tasks', id), {
      id,
      familyId: params.familyId,
      title: sanitizeText(params.title, LIMITS.TITLE_MAX),
      area: params.area,
      assigneeName: sanitizeText(params.assigneeName, LIMITS.DISPLAY_NAME_MAX),
      dueDate: sanitizeText(params.dueDate, LIMITS.DATE_MAX),
      recurrence: params.recurrence,
      status: 'todo',
      amount: safeAmount,
      createdBy: params.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function toggleHomeTask(
  familyId: string,
  taskId: string,
  status: 'todo' | 'done'
): Promise<void> {
  const path = `families/${familyId}/tasks/${taskId}`;
  try {
    await updateDoc(doc(db, 'families', familyId, 'tasks', taskId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteHomeTask(familyId: string, taskId: string): Promise<void> {
  const path = `families/${familyId}/tasks/${taskId}`;
  try {
    await deleteDoc(doc(db, 'families', familyId, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Paid Child Tasks Workflow (Мама / Папа / Создатель -> Ребёнок) ---
export async function createChildTask(params: {
  familyId: string;
  uid: string;
  creatorName: string;
  title: string;
  description: string;
  rewardUah: number;
  assigneeUid: string;
  assigneeName: string;
  taskPhotoDataUrl?: string;
}): Promise<void> {
  const id = generateId('ctask');
  const notifId = generateId('ntf');
  const path = `families/${params.familyId}/childTasks/${id}`;
  const cleanTitle = sanitizeText(params.title, LIMITS.TITLE_MAX);
  const cleanDescription = sanitizeText(params.description, LIMITS.DESCRIPTION_MAX);
  const cleanCreator = sanitizeText(params.creatorName, LIMITS.DISPLAY_NAME_MAX) || 'Родитель';
  const cleanAssigneeName = sanitizeText(params.assigneeName, LIMITS.DISPLAY_NAME_MAX);
  const cleanTaskPhoto = sanitizeImageDataUrl(params.taskPhotoDataUrl);
  const safeReward = Math.min(
    Math.max(Math.round(Number(params.rewardUah) || 1), 1),
    LIMITS.REWARD_UAH_MAX
  );

  const batch = writeBatch(db);
  batch.set(doc(db, 'families', params.familyId, 'childTasks', id), {
    id,
    familyId: params.familyId,
    title: cleanTitle,
    description: cleanDescription,
    rewardUah: safeReward,
    assigneeUid: params.assigneeUid.trim().slice(0, 128),
    assigneeName: cleanAssigneeName,
    status: 'pending',
    proofMessage: '',
    proofPhotoDataUrl: '',
    taskPhotoDataUrl: cleanTaskPhoto,
    parentFeedback: '',
    feedbackPhotoDataUrl: '',
    respondedByUid: '',
    respondedByName: '',
    createdBy: params.uid,
    createdByName: cleanCreator,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'families', params.familyId, 'notifications', notifId), {
    id: notifId,
    familyId: params.familyId,
    kind: 'task',
    action: 'created',
    title: sanitizeText(`Новое задание: ${cleanTitle}`, LIMITS.TITLE_MAX),
    body: sanitizeText(
      `Награда: ${safeReward} грн${cleanAssigneeName ? ` · Для: ${cleanAssigneeName}` : ''}`,
      LIMITS.NOTIFICATION_BODY_MAX
    ),
    targetSection: 'tasks',
    actorUid: params.uid,
    actorName: cleanCreator,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function respondToChildTask(params: {
  familyId: string;
  task: ChildTask;
  uid: string;
  responderName: string;
  decision: 'accept' | 'decline';
}): Promise<void> {
  const path = `families/${params.familyId}/childTasks/${params.task.id}`;
  const notifId = generateId('ntf');
  const cleanResponder = sanitizeText(params.responderName, LIMITS.DISPLAY_NAME_MAX) || 'Ребёнок';
  const nextStatus = params.decision === 'accept' ? 'in_progress' : 'declined';

  const batch = writeBatch(db);
  batch.update(doc(db, 'families', params.familyId, 'childTasks', params.task.id), {
    status: nextStatus,
    respondedByUid: params.uid,
    respondedByName: cleanResponder,
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'families', params.familyId, 'notifications', notifId), {
    id: notifId,
    familyId: params.familyId,
    kind: 'task',
    action: params.decision === 'accept' ? 'accepted' : 'declined',
    title: sanitizeText(
      params.decision === 'accept'
        ? `Ребёнок сказал: Да — «${params.task.title}»`
        : `Ребёнок сказал: Нет — «${params.task.title}»`,
      LIMITS.TITLE_MAX
    ),
    body: sanitizeText(
      params.decision === 'accept'
        ? `${cleanResponder} приступил(а) к выполнению (идёт процесс · ${params.task.rewardUah} грн)`
        : `${cleanResponder} отказался(ась) от задания (${params.task.rewardUah} грн)`,
      LIMITS.NOTIFICATION_BODY_MAX
    ),
    targetSection: 'tasks',
    actorUid: params.uid,
    actorName: cleanResponder,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function submitChildTaskProof(params: {
  familyId: string;
  task: ChildTask;
  uid: string;
  responderName: string;
  proofMessage: string;
  proofPhotoDataUrl: string;
}): Promise<void> {
  const path = `families/${params.familyId}/childTasks/${params.task.id}`;
  const notifId = generateId('ntf');
  const cleanResponder = sanitizeText(params.responderName, LIMITS.DISPLAY_NAME_MAX) || 'Ребёнок';
  const cleanMessage = sanitizeText(params.proofMessage, LIMITS.DESCRIPTION_MAX);
  const cleanPhoto = params.proofPhotoDataUrl.slice(0, LIMITS.PHOTO_DATA_MAX);

  const batch = writeBatch(db);
  batch.update(doc(db, 'families', params.familyId, 'childTasks', params.task.id), {
    status: 'submitted',
    proofMessage: cleanMessage,
    proofPhotoDataUrl: cleanPhoto,
    respondedByUid: params.uid,
    respondedByName: cleanResponder,
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'families', params.familyId, 'notifications', notifId), {
    id: notifId,
    familyId: params.familyId,
    kind: 'task',
    action: 'submitted',
    title: sanitizeText(`${cleanResponder} нажал(а) «Всё»: «${params.task.title}»`, LIMITS.TITLE_MAX),
    body: sanitizeText(
      `Прислано фото и сообщение: ${cleanMessage}`,
      LIMITS.NOTIFICATION_BODY_MAX
    ),
    targetSection: 'tasks',
    actorUid: params.uid,
    actorName: cleanResponder,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function reviewChildTask(params: {
  familyId: string;
  task: ChildTask;
  reviewerUid: string;
  reviewerName: string;
  approved: boolean;
  feedback?: string;
  feedbackPhotoDataUrl?: string;
}): Promise<void> {
  const path = `families/${params.familyId}/childTasks/${params.task.id}`;
  const notifId = generateId('ntf');
  const cleanReviewer = sanitizeText(params.reviewerName, LIMITS.DISPLAY_NAME_MAX) || 'Родитель';
  const cleanFeedback = sanitizeText(params.feedback ?? '', LIMITS.NOTE_MAX);
  const cleanFeedbackPhoto = sanitizeImageDataUrl(params.feedbackPhotoDataUrl);

  const batch = writeBatch(db);
  if (params.approved) {
    batch.update(doc(db, 'families', params.familyId, 'childTasks', params.task.id), {
      status: 'approved',
      parentFeedback: cleanFeedback,
      feedbackPhotoDataUrl: cleanFeedbackPhoto,
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'families', params.familyId, 'notifications', notifId), {
      id: notifId,
      familyId: params.familyId,
      kind: 'task',
      action: 'approved',
      title: sanitizeText(`Сделано: «${params.task.title}»`, LIMITS.TITLE_MAX),
      body: sanitizeText(
        `Деньги (${params.task.rewardUah} грн) начислятся в течение 10 минут`,
        LIMITS.NOTIFICATION_BODY_MAX
      ),
      targetSection: 'tasks',
      actorUid: params.reviewerUid,
      actorName: cleanReviewer,
      createdAt: serverTimestamp(),
    });
  } else {
    batch.update(doc(db, 'families', params.familyId, 'childTasks', params.task.id), {
      status: 'needs_fix',
      parentFeedback: cleanFeedback,
      feedbackPhotoDataUrl: cleanFeedbackPhoto,
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'families', params.familyId, 'notifications', notifId), {
      id: notifId,
      familyId: params.familyId,
      kind: 'task',
      action: 'rejected',
      title: sanitizeText(`Проверка: Нет — «${params.task.title}»`, LIMITS.TITLE_MAX),
      body: sanitizeText(
        cleanFeedback || 'Нужно доделать задание и снова отправить фото с сообщением',
        LIMITS.NOTIFICATION_BODY_MAX
      ),
      targetSection: 'tasks',
      actorUid: params.reviewerUid,
      actorName: cleanReviewer,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function closeChildTask(params: {
  familyId: string;
  task: ChildTask;
  uid: string;
  actorName: string;
}): Promise<void> {
  const path = `families/${params.familyId}/childTasks/${params.task.id}`;
  const notifId = generateId('ntf');
  const cleanActor = sanitizeText(params.actorName, LIMITS.DISPLAY_NAME_MAX) || 'Родитель';

  const batch = writeBatch(db);
  batch.update(doc(db, 'families', params.familyId, 'childTasks', params.task.id), {
    status: 'closed',
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(doc(db, 'families', params.familyId, 'notifications', notifId), {
    id: notifId,
    familyId: params.familyId,
    kind: 'task',
    action: 'closed',
    title: sanitizeText(`Задача прекращена: «${params.task.title}»`, LIMITS.TITLE_MAX),
    body: sanitizeText(
      `Оплата ${params.task.rewardUah} грн отправлена, задание закрыто.`,
      LIMITS.NOTIFICATION_BODY_MAX
    ),
    targetSection: 'tasks',
    actorUid: params.uid,
    actorName: cleanActor,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteChildTask(familyId: string, taskId: string): Promise<void> {
  const path = `families/${familyId}/childTasks/${taskId}`;
  try {
    await deleteDoc(doc(db, 'families', familyId, 'childTasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Optional Starter Template Data ---
export async function seedStarterFamilyData(params: {
  familyId: string;
  uid: string;
  userName: string;
}): Promise<void> {
  const today = todayIsoDate();
  const batch = writeBatch(db);

  const msgId = generateId('msg');
  batch.set(doc(db, 'families', params.familyId, 'messages', msgId), {
    id: msgId,
    familyId: params.familyId,
    text: 'Добро пожаловать в наше семейное пространство! Здесь можно вести общий бюджет, составлять список покупок и обсуждать планы.',
    topic: 'Важное',
    pinned: true,
    authorUid: params.uid,
    authorName: sanitizeText(params.userName, LIMITS.DISPLAY_NAME_MAX) || 'Участник',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const evtId = generateId('evt');
  batch.set(doc(db, 'families', params.familyId, 'events', evtId), {
    id: evtId,
    familyId: params.familyId,
    title: 'Семейный ужин и планирование недели',
    date: today,
    time: '19:30',
    category: 'Семейное дело',
    assigneeName: sanitizeText(params.userName, LIMITS.DISPLAY_NAME_MAX) || 'Вся семья',
    completed: false,
    createdBy: params.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const shopId1 = generateId('shop');
  batch.set(doc(db, 'families', params.familyId, 'shopping', shopId1), {
    id: shopId1,
    familyId: params.familyId,
    name: 'Свежие овощи и зелень',
    quantity: '1 кг',
    category: 'Продукты',
    checked: false,
    addedByUid: params.uid,
    addedByName: sanitizeText(params.userName, LIMITS.DISPLAY_NAME_MAX) || 'Участник',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const shopId2 = generateId('shop');
  batch.set(doc(db, 'families', params.familyId, 'shopping', shopId2), {
    id: shopId2,
    familyId: params.familyId,
    name: 'Средство для посуды',
    quantity: '1 шт',
    category: 'Быт',
    checked: false,
    addedByUid: params.uid,
    addedByName: sanitizeText(params.userName, LIMITS.DISPLAY_NAME_MAX) || 'Участник',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const taskId = generateId('task');
  batch.set(doc(db, 'families', params.familyId, 'tasks', taskId), {
    id: taskId,
    familyId: params.familyId,
    title: 'Передать показания счётчиков воды и света',
    area: 'ЖКУ и счета',
    assigneeName: sanitizeText(params.userName, LIMITS.DISPLAY_NAME_MAX) || 'Участник',
    dueDate: today,
    recurrence: 'Ежемесячно',
    status: 'todo',
    amount: 4500,
    createdBy: params.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const goalId = generateId('goal');
  batch.set(doc(db, 'families', params.familyId, 'goals', goalId), {
    id: goalId,
    familyId: params.familyId,
    title: 'Семейный отпуск',
    targetAmount: 150000,
    currentAmount: 35000,
    deadline: '2027-07-01',
    status: 'active',
    createdBy: params.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `families/${params.familyId}`);
  }
}
