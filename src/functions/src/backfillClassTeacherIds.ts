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

type EnrolledCourse = { subjectId?: string; teacherId?: string; semester?: 1 | 2 };

function deriveTeacherIds(enrolledCourses: EnrolledCourse[]): string[] {
  const ids = new Set<string>();
  enrolledCourses.forEach((ec) => {
    const id = String(ec.teacherId ?? "").trim();
    if (id) ids.add(id);
  });
  return [...ids];
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

function flushBatch(batch: WriteBatch, opCount: number): Promise<void> {
  if (opCount === 0 || DRY_RUN) return Promise.resolve();
  return batch.commit().then(() => undefined);
}

async function backfillClassTeacherIds() {
  console.log(`[start] backfill classes.teacherIds (dryRun=${DRY_RUN})`);

  const classesSnap = await db.collection("classes").get();
  console.log(`Found ${classesSnap.size} class docs`);

  let batch = db.batch();
  let opCount = 0;
  let updated = 0;
  let skipped = 0;

  for (const classDoc of classesSnap.docs) {
    const data = classDoc.data() as { enrolledCourses?: EnrolledCourse[]; teacherIds?: string[] };
    const enrolledCourses = data.enrolledCourses ?? [];
    const nextTeacherIds = deriveTeacherIds(enrolledCourses);
    const currentTeacherIds = data.teacherIds ?? [];

    if (sameIds(nextTeacherIds, currentTeacherIds)) {
      skipped += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[dry-run] ${classDoc.id}: teacherIds ${JSON.stringify(currentTeacherIds)} -> ${JSON.stringify(nextTeacherIds)}`);
    } else {
      batch.update(classDoc.ref, { teacherIds: nextTeacherIds });
    }
    opCount += 1;
    updated += 1;

    if (opCount >= BATCH_LIMIT) {
      await flushBatch(batch, opCount);
      batch = db.batch();
      opCount = 0;
      console.log(`Progress: updated ${updated}/${classesSnap.size}`);
    }
  }

  await flushBatch(batch, opCount);
  console.log(`Backfill completed. Updated: ${updated}, Already correct: ${skipped}`);
  if (DRY_RUN) console.log("[dry-run] no write operations were committed");
}

backfillClassTeacherIds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
