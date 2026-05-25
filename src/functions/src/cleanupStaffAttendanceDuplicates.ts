import * as admin from "firebase-admin";
import { getFirestore, WriteBatch } from "firebase-admin/firestore";

const DATABASE_ID = (process.env.FIRESTORE_DATABASE_ID ?? "").trim();
const BATCH_LIMIT = 450;
const DRY_RUN = process.argv.includes("--dry-run");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = DATABASE_ID && DATABASE_ID !== "(default)"
  ? getFirestore(DATABASE_ID)
  : getFirestore();

type AttendanceDoc = {
  id: string;
  data: FirebaseFirestore.DocumentData;
};

function makeDeterministicDocId(userId: string, date: string): string {
  return `${userId}_${date}`;
}

function tsMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof admin.firestore.Timestamp) return value.toMillis();
  return 0;
}

function scoreRecord(data: FirebaseFirestore.DocumentData): number {
  let score = 0;
  if (data.checkInTime) score += 1;
  if (data.checkOutTime) score += 2;
  if (typeof data.status === "string" && data.status.length > 0) score += 1;
  return score;
}

function pickBestRecord(records: AttendanceDoc[]): AttendanceDoc {
  return records.reduce((best, current) => {
    const bestScore = scoreRecord(best.data);
    const currentScore = scoreRecord(current.data);
    if (currentScore > bestScore) return current;
    if (currentScore < bestScore) return best;

    const bestCheckOut = tsMillis(best.data.checkOutTime);
    const currentCheckOut = tsMillis(current.data.checkOutTime);
    if (currentCheckOut !== bestCheckOut) {
      return currentCheckOut > bestCheckOut ? current : best;
    }

    const bestCheckIn = tsMillis(best.data.checkInTime);
    const currentCheckIn = tsMillis(current.data.checkInTime);
    if (bestCheckIn === 0 && currentCheckIn > 0) return current;
    if (currentCheckIn === 0 && bestCheckIn > 0) return best;
    if (bestCheckIn !== currentCheckIn) {
      return currentCheckIn < bestCheckIn ? current : best;
    }

    const bestLastTime = Math.max(bestCheckOut, bestCheckIn);
    const currentLastTime = Math.max(currentCheckOut, currentCheckIn);
    return currentLastTime > bestLastTime ? current : best;
  });
}

async function flushBatch(batch: WriteBatch, opCount: number): Promise<void> {
  if (opCount === 0 || DRY_RUN) return;
  await batch.commit();
}

async function cleanupStaffAttendanceDuplicates() {
  console.log(`[start] cleanup staff_attendance duplicates (dryRun=${DRY_RUN})`);
  const snap = await db.collection("staff_attendance").get();
  console.log(`[info] loaded ${snap.size} documents`);

  const grouped = new Map<string, AttendanceDoc[]>();
  let invalid = 0;

  snap.forEach((docSnap) => {
    const data = docSnap.data();
    const userId = typeof data.userId === "string" ? data.userId : "";
    const date = typeof data.date === "string" ? data.date : "";
    if (!userId || !date) {
      invalid += 1;
      return;
    }

    const key = `${userId}__${date}`;
    const arr = grouped.get(key) ?? [];
    arr.push({ id: docSnap.id, data });
    grouped.set(key, arr);
  });

  let duplicateGroups = 0;
  let docsToDelete = 0;
  let deterministicCreatesOrUpdates = 0;
  let batch = db.batch();
  let opCount = 0;

  for (const [key, records] of grouped.entries()) {
    if (records.length <= 1) continue;
    duplicateGroups += 1;

    const [userId, date] = key.split("__");
    const deterministicId = makeDeterministicDocId(userId, date);
    const deterministic = records.find((r) => r.id === deterministicId);
    const best = pickBestRecord(records);
    const source = deterministic ?? best;

    if (!deterministic) {
      const targetRef = db.collection("staff_attendance").doc(deterministicId);
      batch.set(targetRef, source.data, { merge: true });
      opCount += 1;
      deterministicCreatesOrUpdates += 1;
    }

    for (const record of records) {
      if (record.id === deterministicId) continue;
      batch.delete(db.collection("staff_attendance").doc(record.id));
      opCount += 1;
      docsToDelete += 1;
    }

    if (opCount >= BATCH_LIMIT) {
      await flushBatch(batch, opCount);
      batch = db.batch();
      opCount = 0;
      console.log(`[progress] duplicateGroups=${duplicateGroups}, delete=${docsToDelete}, upsert=${deterministicCreatesOrUpdates}`);
    }
  }

  await flushBatch(batch, opCount);

  console.log("[done] summary");
  console.log(`- duplicate groups: ${duplicateGroups}`);
  console.log(`- deterministic upserts: ${deterministicCreatesOrUpdates}`);
  console.log(`- deleted docs: ${docsToDelete}`);
  console.log(`- invalid docs skipped: ${invalid}`);
  if (DRY_RUN) {
    console.log("[dry-run] no write operations were committed");
  }
}

cleanupStaffAttendanceDuplicates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[failed] cleanup staff_attendance duplicates", error);
    process.exit(1);
  });
