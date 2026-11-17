import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Payload-First Security Rules Structural & Dirty Dozen Verification
 * Verifies that firestore.rules strictly contains all Eight Pillars defenses
 * for the Dirty Dozen payloads documented in security_spec.md.
 */
const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rules = fs.readFileSync(rulesPath, 'utf8');

// 1. Default-deny safety net
assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);

// 2. Email verification enforcement for mutations
assert.match(rules, /function isEmailVerified\(\)\s*\{[\s\S]*email_verified == true/);

// 3. No blanket list on invites or users
assert.match(rules, /match \/users\/\{userId\}[\s\S]*allow list: if false;/);
assert.match(rules, /match \/familyInvites\/\{inviteCode\}[\s\S]*allow list: if false;/);

// 4. Invite-code role lock (members cannot self-assign 'owner' when joining via invite)
assert.match(rules, /incoming\(\)\.role == 'member'[\s\S]*familyInvites/);

// 5. ID Poisoning guard
assert.match(rules, /function isValidId\(id\)[\s\S]*id\.size\(\) <= 128/);

// 6. Terminal State Locking on SavingsGoal
assert.match(rules, /existing\(\)\.status != 'completed' \|\| isFamilyOwner\(familyId\)/);

// 7. Temporal integrity checks
assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);

// 8. Notification log immutability and actor integrity
assert.match(rules, /match \/notifications\/\{notificationId\}[\s\S]*allow update: if false;/);
assert.match(rules, /incoming\(\)\.actorUid == request\.auth\.uid/);

// 9. Creator-assigned familyRole & ChildTask RBAC + terminal lock
assert.match(rules, /isFamilyOwner\(familyId\)[\s\S]*affectedKeys\(\)\.hasOnly\(\['familyRole'\]\)/);
assert.match(rules, /function isTaskManager\(familyId\)/);
assert.match(rules, /match \/childTasks\/\{taskId\}[\s\S]*existing\(\)\.status != 'closed'/);

// 10. Shared live app appearance settings validation
assert.match(rules, /function isValidAppAppearance\(data\)/);
assert.match(rules, /'newyear'/);
assert.match(rules, /'snow'/);
assert.match(rules, /match \/settings\/\{settingId\}[\s\S]*settingId == 'appearance'/);

// 11. Member exit & owner family wipe permissions
assert.match(rules, /match \/members\/\{memberUid\}[\s\S]*allow delete:[\s\S]*existing\(\)\.role != 'owner'[\s\S]*isFamilyOwner\(familyId\)/);

// 12. Bulletin board announcements validation & author/owner protection
assert.match(rules, /function isValidAnnouncement\(data\)/);
assert.match(rules, /match \/announcements\/\{announcementId\}[\s\S]*incoming\(\)\.authorUid == request\.auth\.uid[\s\S]*existing\(\)\.authorUid == request\.auth\.uid \|\| isFamilyOwner\(familyId\)/);

// 13. Image attachment bounds on messages, announcements, and child tasks
assert.match(rules, /function isValidImageDataUrl\(val\)/);
assert.match(rules, /function isValidMessage\(data\)[\s\S]*isValidImageDataUrl\(data\.imageDataUrl\)/);
assert.match(rules, /function isValidAnnouncement\(data\)[\s\S]*isValidImageDataUrl\(data\.imageDataUrl\)/);
assert.match(rules, /function isValidChildTask\(data\)[\s\S]*isValidImageDataUrl\(data\.taskPhotoDataUrl\)[\s\S]*isValidImageDataUrl\(data\.feedbackPhotoDataUrl\)/);

console.log('All Dirty Dozen security rule structural assertions passed.');
