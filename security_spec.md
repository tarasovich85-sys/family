# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **User Privacy**: `/users/{userId}` contains no PII (`email`, `phone`) and is readable/writable strictly by `request.auth.uid == userId`.
2. **Master Gate Membership**: Every subcollection under `/families/{familyId}` requires verified membership in `/families/{familyId}/members/{request.auth.uid}` (with `exists()` on the path variable `familyId`).
3. **Zero Privilege Escalation**: A user joining via `/familyInvites/{inviteCode}` can only create their own membership with `role == 'member'` and a valid matching `inviteCode` verified against `/familyInvites/{inviteCode}`. Only a newly created family's owner (via `getAfter`) can create an `'owner'` membership.
4. **Immutable Ownership & Temporal Integrity**: `createdAt`, `createdBy`, `authorUid`, `addedByUid`, `ownerId`, and `familyId` cannot be changed on update. `createdAt == request.time` on create and `updatedAt == request.time` on update.
5. **Terminal State Locking**: Once a `SavingsGoal` reaches `status == 'completed'`, non-owners cannot reopen or alter its amounts.
6. **Strict Schema & Size Bounds**: Every document enforces `hasAll` + `hasOnly` on create, `affectedKeys().hasOnly(...)` on update, and `.size()` caps on every string.
7. **No Blanket List Leaks**: `/familyInvites` disables `list` (`allow list: if false;`), `/users` disables `list`, and all family subcollections verify `resource.data.familyId == familyId` plus membership.
8. **Notification Integrity & Personal Read Watermarks**: `/families/{familyId}/notifications/{notificationId}` enforces `actorUid == request.auth.uid`, `createdAt == request.time`, and `update: if false` (immutable activity log). Members can update only their own read watermarks (`lastReadMessagesAt == request.time`, `lastReadEventsAt == request.time`, `lastReadTasksAt == request.time`, `lastReadNotificationsAt == request.time`) and `pushEnabled` boolean preference.
9. **Creator-Assigned Family Roles & Task RBAC**: Only `isFamilyOwner(familyId)` can assign or update `familyRole` (`Создатель`, `Мама`, `Папа`, `Ребёнок`, `Бабушка`, `Дедушка`, `Родственник`, `Участник`) on `/families/{familyId}/members/{memberUid}`. Only `isTaskManager(familyId)` (`role == 'owner'` or `familyRole in ['Создатель', 'Мама', 'Папа']`) can create, approve/reject (`Сделано`/`Нет`), close (`Прекратить задачу`), or delete `/families/{familyId}/childTasks/{taskId}`. Once `status == 'closed'`, `ChildTask` is terminally locked.
10. **Shared Live App Settings Integrity**: `/families/{familyId}/settings/appearance` enforces strict enum values (`accentTheme` including `newyear`, `surfaceMode` including `snow`), native Firestore `list`/`map` validation (`hiddenSections` list `.hasOnly(...)`, `sectionLabels` map `.keys().hasOnly(...)`, `customNotes` bounded list `.size() <= 10` with element guard), `updatedByUid == request.auth.uid`, and `updatedAt == request.time`.
11. **Member Exit & Owner Family Wipe**: Non-owner members can delete only their own `/members/{uid}` record to leave, whereas `isFamilyOwner(familyId)` can delete all subcollection records, member records, invite document, and `/families/{familyId}` when leaving and resetting the workspace.
12. **Bulletin Board Integrity**: `/families/{familyId}/announcements/{announcementId}` enforces verified family membership, `authorUid == request.auth.uid` on create, `createdAt`/`updatedAt == request.time`, immutable author fields on update, and author/owner-only content edits or deletions.
13. **Image Attachment Bounds**: Optional image attachments (`imageDataUrl`, `taskPhotoDataUrl`, `feedbackPhotoDataUrl`, `proofPhotoDataUrl`) across messages, bulletin board notices, and tasks enforce `isValidImageDataUrl` (`<= 300000` bytes and strict `^data:image/(jpeg|jpg|png|webp);base64,[A-Za-z0-9+/=]+$` format or empty string).

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unverified Email Write**: Signed-in user with `email_verified: false` attempts to create `/families/fam_1`.
2. **Shadow Field Injection (User)**: User attempts `setDoc('/users/u1', { ..., isAdmin: true })`.
3. **Self-Assigned Owner Escalation**: Non-owner attempts to create `/families/fam_1/members/attackerUid` with `role: 'owner'`.
4. **Fake Invite Code Join**: Attacker attempts to create `/families/fam_1/members/attackerUid` with `inviteCode: 'FAKE123'`.
5. **Invite Enumeration (`list`)**: Signed-in attacker queries `getDocs(collection(db, 'familyInvites'))`.
6. **Cross-Family Read**: User A (not member of `fam_2`) attempts `getDoc('/families/fam_2/transactions/tx_1')`.
7. **Author Spoofing in Chat**: Member creates `/families/fam_1/messages/m1` with `authorUid: 'victimUid'`.
8. **ID Poisoning**: User attempts to create `/families/fam_1/tasks/invalid$id!` or a 200-char ID.
9. **Value Poisoning on Update**: Member updates message `text` with a 5000-char string or invalid type (`text: 123`).
10. **Ghost Field on Action Update**: Member updates `ShoppingItem` `checked: true` while sneaking `addedByUid: 'other'`.
11. **Timestamp Forgery**: Client passes `createdAt: new Date(2020, 0, 1)` instead of `serverTimestamp()` (`request.time`).
12. **Terminal State Bypass**: Non-owner attempts to mutate a `SavingsGoal` whose `existing().status == 'completed'`.
