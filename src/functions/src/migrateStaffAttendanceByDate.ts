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

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function isValidDateStr(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function inDateRange(date: string, from: string | null, to: string | null): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function toMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof admin.firestore.Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const maybeToMillis = (value as { toMillis?: unknown }).toMillis;
    if (typeof maybeToMillis === "function") {
      try {
        return (maybeToMillis as () => number)();
      } catch {
        return 0;
      }
    }
  }
  return 0;
}

function scoreRecord(data: FirebaseFirestore.DocumentData): number {
  let score = 0;
  if (data.checkInTime) score += 1;
  if (data.checkOutTime) score += 2;
  if (typeof data.status === "string" && data.status.length > 0) score += 1;
  if (typeof data.note === "string" && data.note.length > 0) score += 1;
  return score;
}

function pickBestRecord(records: AttendanceDoc[]): AttendanceDoc {
  return records.reduce((best, current) => {
    const bestScore = scoreRecord(best.data);
    const currentScore = scoreRecord(current.data);
    if (currentScore > bestScore) return current;
    if (currentScore < bestScore) return best;

    const bestCheckOut = toMillis(best.data.checkOutTime);
    const currentCheckOut = toMillis(current.data.checkOutTime);
    if (currentCheckOut !== bestCheckOut) {
      return currentCheckOut > bestCheckOut ? current : best;
    }

    const bestCheckIn = toMillis(best.data.checkInTime);
    const currentCheckIn = toMillis(current.data.checkInTime);
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

async function migrateStaffAttendanceByDate() {
  const from = argValue("--from");
  const to = argValue("--to");

  if (from && !isValidDateStr(from)) {
    throw new Error(`Invalid --from date format: ${from}. Expected YYYY-MM-DD`);
  }
  if (to && !isValidDateStr(to)) {
    throw new Error(`Invalid --to date format: ${to}. Expected YYYY-MM-DD`);
  }
  if (from && to && from > to) {
    throw new Error(`Invalid range: --from (${from}) is after --to (${to})`);
  }

  console.log(`[start] migrate staff_attendance -> staff_attendance_by_date (dryRun=${DRY_RUN})`);
  console.log(`[config] database=${DATABASE_ID || "(default)"}, from=${from ?? "-"}, to=${to ?? "-"}`);

  const legacySnap = await db.collection("staff_attendance").get();
  console.log(`[info] loaded legacy docs: ${legacySnap.size}`);

  const grouped = new Map<string, AttendanceDoc[]>();
  let invalid = 0;
  let outOfRange = 0;

  legacySnap.forEach((docSnap) => {
    const data = docSnap.data();
    const userId = typeof data.userId === "string" ? data.userId.trim() : "";
    const date = typeof data.date === "string" ? data.date.trim() : "";
    if (!userId || !date || !isValidDateStr(date)) {
      invalid += 1;
      return;
    }
    if (!inDateRange(date, from, to)) {
      outOfRange += 1;
      return;
    }

    const key = `${userId}__${date}`;
    const arr = grouped.get(key) ?? [];
    arr.push({ id: docSnap.id, data });
    grouped.set(key, arr);
  });

  let batch = db.batch();
  let opCount = 0;
  let migratedEntries = 0;
  let preservedExistingBetter = 0;
  let touchedDays = 0;
  let duplicateGroups = 0;
  const dayTouched = new Set<string>();

  for (const [key, records] of grouped.entries()) {
    if (records.length > 1) duplicateGroups += 1;
    const [userId, date] = key.split("__");

    const legacyBest = pickBestRecord(records);
    const targetRef = db.collection("staff_attendance_by_date").doc(date).collection("entries").doc(userId);
    const targetSnap = await targetRef.get();

    const candidates: AttendanceDoc[] = [legacyBest];
    if (targetSnap.exists) {
      candidates.push({ id: "existing-target", data: targetSnap.data() ?? {} });
    }
    const winner = pickBestRecord(candidates);

    const legacyWon = winner.id !== "existing-target";
    if (!legacyWon) {
      preservedExistingBetter += 1;
      continue;
    }

    const payload: FirebaseFirestore.DocumentData = {
      ...legacyBest.data,
      userId,
      date,
      migratedFromLegacyAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedFromLegacyDocId: legacyBest.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const dayRef = db.collection("staff_attendance_by_date").doc(date);
    if (!dayTouched.has(date)) {
      batch.set(dayRef, {
        date,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      dayTouched.add(date);
      opCount += 1;
      touchedDays += 1;
    }

    batch.set(targetRef, payload, { merge: true });
    opCount += 1;
    migratedEntries += 1;

    if (opCount >= BATCH_LIMIT) {
      await flushBatch(batch, opCount);
      batch = db.batch();
      opCount = 0;
      dayTouched.clear();
      console.log(`[progress] migratedEntries=${migratedEntries}, touchedDays=${touchedDays}`);
    }
  }

  await flushBatch(batch, opCount);

  console.log("[done] migration summary");
  console.log(`- grouped user-date records: ${grouped.size}`);
  console.log(`- duplicate groups in legacy: ${duplicateGroups}`);
  console.log(`- migrated entries: ${migratedEntries}`);
  console.log(`- preserved existing better records: ${preservedExistingBetter}`);
  console.log(`- touched day docs: ${touchedDays}`);
  console.log(`- skipped invalid docs: ${invalid}`);
  console.log(`- skipped out-of-range docs: ${outOfRange}`);
  if (DRY_RUN) {
    console.log("[dry-run] no write operations were committed");
  }
}

migrateStaffAttendanceByDate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[failed] migrate staff_attendance -> staff_attendance_by_date", error);
    process.exit(1);
  });
