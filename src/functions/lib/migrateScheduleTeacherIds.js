"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const DATABASE_ID = (process.env.FIRESTORE_DATABASE_ID ?? "").trim();
const BATCH_LIMIT = 450;
const DRY_RUN = process.argv.includes("--dry-run");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = DATABASE_ID && DATABASE_ID !== "(default)"
    ? (0, firestore_1.getFirestore)(DATABASE_ID)
    : (0, firestore_1.getFirestore)();
async function flushBatch(batch, opCount) {
    if (opCount === 0 || DRY_RUN)
        return;
    await batch.commit();
}
async function migrateScheduleTeacherIds() {
    console.log(`[start] migrate schedules.teacherId -> teachers.id (dryRun=${DRY_RUN})`);
    const teacherSnap = await db.collection("teachers").get();
    const teachers = teacherSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    }));
    const byTeacherId = new Map();
    const byUserId = new Map();
    const byName = new Map();
    for (const teacher of teachers) {
        byTeacherId.set(teacher.id, teacher);
        if (teacher.userId)
            byUserId.set(String(teacher.userId).trim(), teacher);
        if (teacher.name)
            byName.set(String(teacher.name).trim().toLowerCase(), teacher);
    }
    const scheduleSnap = await db.collection("schedules").get();
    const schedules = scheduleSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
    }));
    console.log(`[info] teachers=${teachers.length}, schedules=${schedules.length}`);
    let batch = db.batch();
    let opCount = 0;
    let unchanged = 0;
    let updated = 0;
    let unresolved = 0;
    for (const row of schedules) {
        const currentTeacherId = String(row.teacherId ?? "").trim();
        const currentTeacherName = String(row.teacherName ?? "").trim().toLowerCase();
        if (!currentTeacherId && !currentTeacherName) {
            unresolved += 1;
            continue;
        }
        let canonicalTeacher;
        if (currentTeacherId) {
            canonicalTeacher = byTeacherId.get(currentTeacherId) ?? byUserId.get(currentTeacherId);
        }
        if (!canonicalTeacher && currentTeacherName) {
            canonicalTeacher = byName.get(currentTeacherName);
        }
        if (!canonicalTeacher) {
            unresolved += 1;
            continue;
        }
        if (canonicalTeacher.id === currentTeacherId) {
            unchanged += 1;
            continue;
        }
        const ref = db.collection("schedules").doc(row.id);
        batch.update(ref, {
            teacherId: canonicalTeacher.id,
            teacherName: canonicalTeacher.name ?? row.teacherName ?? "",
        });
        opCount += 1;
        updated += 1;
        if (opCount >= BATCH_LIMIT) {
            await flushBatch(batch, opCount);
            batch = db.batch();
            opCount = 0;
            console.log(`[progress] updated=${updated}, unchanged=${unchanged}, unresolved=${unresolved}`);
        }
    }
    await flushBatch(batch, opCount);
    console.log("[done] migration summary");
    console.log(`- updated docs: ${updated}`);
    console.log(`- unchanged docs: ${unchanged}`);
    console.log(`- unresolved docs: ${unresolved}`);
    if (DRY_RUN) {
        console.log("[dry-run] no write operations were committed");
    }
}
migrateScheduleTeacherIds()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error("[failed] migrate schedules.teacherId", error);
    process.exit(1);
});
//# sourceMappingURL=migrateScheduleTeacherIds.js.map