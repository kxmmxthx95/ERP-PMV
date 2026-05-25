"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const DATABASE_ID = process.env.FIRESTORE_DATABASE_ID ?? "all-pmv";
const BATCH_LIMIT = 450;
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = (0, firestore_1.getFirestore)(DATABASE_ID);
function toDocId(input) {
    return input.replace(/[^\w.-]/g, "_");
}
function stableAttendanceId(record) {
    return [
        record.date,
        toDocId(record.classId),
        toDocId(record.subjectId),
        record.period,
        toDocId(record.studentId),
    ].join("_");
}
async function flushBatch(batch, opCount) {
    if (opCount > 0) {
        await batch.commit();
    }
    return db.batch();
}
async function backfillAttendanceByDate() {
    const legacySnap = await db.collection("attendance").get();
    console.log(`Found ${legacySnap.size} legacy attendance docs`);
    let batch = db.batch();
    let opCount = 0;
    let migrated = 0;
    let skipped = 0;
    for (const legacyDoc of legacySnap.docs) {
        const data = legacyDoc.data();
        if (!data.date ||
            !data.classId ||
            !data.subjectId ||
            typeof data.period !== "number" ||
            !data.studentId) {
            skipped += 1;
            continue;
        }
        const recordedAt = data.recordedAt ?? new Date().toISOString();
        const attendanceId = stableAttendanceId({
            date: data.date,
            classId: data.classId,
            subjectId: data.subjectId,
            period: data.period,
            studentId: data.studentId,
        });
        const dayRef = db.collection("attendance_by_date").doc(data.date);
        const classRef = dayRef.collection("classes").doc(data.classId);
        const recordRef = classRef.collection("records").doc(attendanceId);
        batch.set(dayRef, { date: data.date, updatedAt: recordedAt }, { merge: true });
        batch.set(classRef, {
            date: data.date,
            classId: data.classId,
            className: data.className ?? "",
            departmentId: data.departmentId ?? "",
            academicYearId: data.academicYearId ?? "",
            semester: data.semester ?? 1,
            updatedAt: recordedAt,
        }, { merge: true });
        batch.set(recordRef, {
            academicYearId: data.academicYearId ?? "",
            classId: data.classId,
            className: data.className ?? "",
            date: data.date,
            departmentId: data.departmentId ?? "",
            note: data.note ?? "",
            period: data.period,
            recordedAt,
            semester: data.semester ?? 1,
            status: data.status ?? "present",
            studentCode: data.studentCode ?? "",
            studentId: data.studentId,
            studentName: data.studentName ?? "",
            subjectId: data.subjectId,
            subjectName: data.subjectName ?? "",
            teacherId: data.teacherId ?? "",
        }, { merge: true });
        migrated += 1;
        opCount += 3;
        if (opCount >= BATCH_LIMIT) {
            batch = await flushBatch(batch, opCount);
            opCount = 0;
            console.log(`Progress: migrated ${migrated}/${legacySnap.size}`);
        }
    }
    await flushBatch(batch, opCount);
    console.log(`Backfill completed. Migrated: ${migrated}, Skipped: ${skipped}`);
}
backfillAttendanceByDate()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
});
//# sourceMappingURL=backfillAttendanceByDate.js.map