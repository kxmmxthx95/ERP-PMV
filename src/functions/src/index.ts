import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getAdminFirestore, getFirestoreDatabaseId } from "./getAdminFirestore";
import { CALLABLE_CORS, CALLABLE_REGION } from "./callableOptions";

admin.initializeApp();
const db = getAdminFirestore();

export { sendLineReport } from "./sendLineReport";
export { notifyHomeroomOnStudentLeave } from "./notifyHomeroomOnStudentLeave";
export { reportDailyScheduled } from "./reportDailyScheduled";
export { examRoomAutoClose } from "./examRoomAutoClose";
export { processLineLinkRequest } from "./processLineLinkRequest";
export { lineWebhook } from "./lineWebhook";
export { lineWebhookV2 } from "./lineWebhookV2";
export { completeLineLinkWithToken } from "./completeLineLinkWithToken";
export { lineStaffAttendance } from "./lineStaffAttendance";
export {
  forceLogoutUser,
  hardResetUser,
  forceLogoutAllUsers,
} from "./userAdminCallables";
export { resetPasswordByNationalId } from "./authCallables";
export { qbAnalystChat } from "./qbAnalystChat";
export { deviceFingerprintAttendance } from "./deviceFingerprintAttendance";
export { horoscopeDaily } from "./horoscopeDaily";
export { examPdfBytes } from "./examPdfBytes";
export {
  wordGameCreateRoom,
  wordGameJoinRoom,
  wordGameStart,
  wordGameSubmitGuess,
  wordGameLeaveRoom,
} from "./wordGame";

const STAFF_MIGRATION_BATCH_LIMIT = 450;

type AttendanceDoc = {
  id: string;
  data: FirebaseFirestore.DocumentData;
};

function isValidDateStr(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function inDateRange(date: string, from: string | null, to: string | null): boolean {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function tsMillis(value: unknown): number {
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

type ExamAttemptDoc = {
  roomId?: string;
  round?: number;
  status?: string;
  answers?: Record<string, string>;
  score?: number | null;
};

type ExamRoundConfig = {
  questionSetId?: string;
  questionIds?: string[];
  questionSetByQuestionId?: Record<string, string>;
  questionPoints?: Record<string, number>;
  totalPoints?: number;
};

type ExamRoomDoc = {
  status?: string;
  questionSetId?: string;
  selectedQuestionIds?: string[];
  roundQuestions?: Record<string, ExamRoundConfig>;
};

type QuestionDoc = {
  type?: string;
  points?: number;
  orderIndex?: number;
  correctOptionId?: string;
  payload?: {
    options?: Array<{
      id?: string;
      isCorrect?: boolean;
    }>;
    expectedAnswer?: string;
  };
};

function orderQuestionIdsFromMap(questionMap: Map<string, QuestionDoc>): string[] {
  return Array.from(questionMap.entries())
    .sort(([, a], [, b]) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0))
    .map(([id]) => id);
}

function resolveEffectiveQuestionIds(
  selectedQuestionIds: string[],
  questionMap: Map<string, QuestionDoc>,
): string[] {
  if (selectedQuestionIds.length > 0) {
    const resolved = selectedQuestionIds.filter((qid) => questionMap.has(qid));
    if (resolved.length > 0) return resolved;
    if (questionMap.size > 0) return orderQuestionIdsFromMap(questionMap);
    return [];
  }
  return orderQuestionIdsFromMap(questionMap);
}

function normalizeTextAnswer(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function getExpectedTextAnswer(questionData: QuestionDoc): string | null {
  const expected = questionData.payload?.expectedAnswer;
  if (typeof expected === "string" && expected.trim()) {
    return expected.trim();
  }
  return null;
}

function resolveQuestionPoints(
  questionId: string,
  questionData: QuestionDoc,
  questionPoints: Record<string, number>,
): number {
  const overridePts = questionPoints[questionId];
  const docPts = Number(questionData.points || 0);
  if (typeof overridePts === "number" && overridePts >= 0) return overridePts;
  if (docPts > 0) return docPts;
  return 1;
}

function addQuestionScore(
  totalScore: number,
  questionId: string,
  questionData: QuestionDoc,
  questionPoints: Record<string, number>,
): number {
  const overridePts = questionPoints[questionId];
  const docPts = Number(questionData.points || 0);
  if (typeof overridePts === "number" && overridePts >= 0) {
    return totalScore + overridePts;
  }
  if (docPts > 0) {
    return totalScore + docPts;
  }
  return totalScore + 1;
}

function normalizeRound(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

function resolveRoundConfig(roomData: ExamRoomDoc, round: number): {
  selectedQuestionIds: string[];
  questionSetByQuestionId: Record<string, string>;
  questionPoints: Record<string, number>;
  fallbackQuestionSetId?: string;
} {
  const roundKey = String(round);
  const cfg =
    roomData.roundQuestions?.[roundKey] ||
    roomData.roundQuestions?.["∞"] ||
    roomData.roundQuestions?.["1"] ||
    (roomData.roundQuestions ? Object.values(roomData.roundQuestions)[0] : undefined);

  return {
    selectedQuestionIds: cfg?.questionIds || roomData.selectedQuestionIds || [],
    questionSetByQuestionId: cfg?.questionSetByQuestionId || {},
    questionPoints: cfg?.questionPoints || {},
    fallbackQuestionSetId: cfg?.questionSetId || roomData.questionSetId,
  };
}

function getCorrectOptionId(questionData: QuestionDoc): string | null {
  if (typeof questionData.correctOptionId === "string" && questionData.correctOptionId.trim()) {
    return questionData.correctOptionId.trim();
  }
  const options = questionData.payload?.options;
  if (!Array.isArray(options)) return null;
  const correctIndex = options.findIndex((opt) => opt?.isCorrect === true);
  if (correctIndex < 0) return null;
  const correct = options[correctIndex];
  if (typeof correct?.id === "string" && correct.id.trim()) return correct.id.trim();
  return String(correctIndex + 1);
}

function legacyOptionKey(id: string): string {
  const trimmed = id.trim();
  const legacy = /^opt-(\d+)$/.exec(trimmed);
  return legacy ? legacy[1] : trimmed;
}

function isSelectedOptionCorrect(
  selectedOptionId: string,
  correctOptionId: string,
  options: Array<{ id?: string; isCorrect?: boolean }>,
): boolean {
  if (!selectedOptionId.trim()) return false;
  const sel = legacyOptionKey(selectedOptionId);
  const cor = legacyOptionKey(correctOptionId);
  if (sel === cor) return true;

  const correctIndex = options.findIndex((opt) => opt?.isCorrect === true);
  if (correctIndex < 0) return false;

  const selectedIndex = options.findIndex((opt, index) => {
    const oid = typeof opt.id === "string" && opt.id.trim()
      ? opt.id.trim()
      : String(index + 1);
    return legacyOptionKey(oid) === sel || oid === selectedOptionId.trim();
  });

  return selectedIndex >= 0 && selectedIndex === correctIndex;
}

function resolveStudentAnswer(
  questionId: string,
  questionIndex: number,
  effectiveIds: string[],
  answers: Record<string, string>,
): string {
  const direct = answers[questionId];
  if (typeof direct === "string" && direct.trim()) return direct;

  const ordinalKey = String(questionIndex + 1);
  const ordinalAnswer = answers[ordinalKey];
  if (typeof ordinalAnswer === "string" && ordinalAnswer.trim()) return ordinalAnswer;

  const answerKeys = Object.keys(answers).filter((k) => (answers[k] ?? "").trim());
  const overlap = answerKeys.some((k) => effectiveIds.includes(k));
  if (!overlap && answerKeys.length === effectiveIds.length) {
    const sortedKeys = [...answerKeys].sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b);
    });
    const mapped = answers[sortedKeys[questionIndex]];
    if (typeof mapped === "string") return mapped;
  }

  return "";
}

async function autoGradeAttempt(
  db: FirebaseFirestore.Firestore,
  attemptRef: FirebaseFirestore.DocumentReference,
  attemptData: ExamAttemptDoc,
  roomData: ExamRoomDoc,
  attemptId: string,
): Promise<"graded" | "partial_graded" | "skipped_no_questions" | "skipped_no_set_ids"> {
  const roomId = typeof attemptData.roomId === "string" ? attemptData.roomId.trim() : "";
  const round = normalizeRound(attemptData.round);
  const { selectedQuestionIds, questionSetByQuestionId, questionPoints, fallbackQuestionSetId } = resolveRoundConfig(roomData, round);

  const candidateSetIds = new Set<string>();
  selectedQuestionIds.forEach((qid) => {
    const mapped = questionSetByQuestionId[qid];
    if (typeof mapped === "string" && mapped.trim()) {
      candidateSetIds.add(mapped.trim());
    }
  });
  if (typeof fallbackQuestionSetId === "string" && fallbackQuestionSetId.trim()) {
    candidateSetIds.add(fallbackQuestionSetId.trim());
  }

  if (candidateSetIds.size === 0) {
    console.warn("[autoGradeAttempt] no candidate question set ids", { attemptId, roomId, round });
    return "skipped_no_set_ids";
  }

  const questionMap = new Map<string, QuestionDoc>();
  await Promise.all(
    Array.from(candidateSetIds).map(async (setId) => {
      const snap = await db.collection("question_sets").doc(setId).collection("questions").get();
      snap.forEach((docSnap) => {
        questionMap.set(docSnap.id, docSnap.data() as QuestionDoc);
      });
    }),
  );

  const effectiveQuestionIds = resolveEffectiveQuestionIds(selectedQuestionIds, questionMap);
  if (effectiveQuestionIds.length === 0) {
    console.warn("[autoGradeAttempt] no questions found for grading", { attemptId, roomId, round });
    return "skipped_no_questions";
  }

  const answers = (attemptData.answers && typeof attemptData.answers === "object") ? attemptData.answers : {};
  let totalScore = 0;
  let autoGradableMaxPoints = 0;
  let manualEssayCount = 0;
  const manualEssayQuestionIds: string[] = [];

  effectiveQuestionIds.forEach((questionId, questionIndex) => {
    const q = questionMap.get(questionId);
    if (!q) return;

    const questionPointsValue = resolveQuestionPoints(questionId, q, questionPoints);

    if (q.type === "essay") {
      const expected = getExpectedTextAnswer(q);
      if (expected) {
        autoGradableMaxPoints += questionPointsValue;
        const studentAnswer = resolveStudentAnswer(questionId, questionIndex, effectiveQuestionIds, answers);
        if (normalizeTextAnswer(studentAnswer) === normalizeTextAnswer(expected)) {
          totalScore = addQuestionScore(totalScore, questionId, q, questionPoints);
        }
        return;
      }
      manualEssayCount += 1;
      manualEssayQuestionIds.push(questionId);
      return;
    }

    autoGradableMaxPoints += questionPointsValue;

    const correctOptionId = getCorrectOptionId(q);
    if (!correctOptionId) return;

    const selectedOptionId = resolveStudentAnswer(questionId, questionIndex, effectiveQuestionIds, answers);
    const mcOptions = q.payload?.options ?? [];
    if (isSelectedOptionCorrect(selectedOptionId, correctOptionId, mcOptions)) {
      totalScore = addQuestionScore(totalScore, questionId, q, questionPoints);
    }
  });

  if (manualEssayCount > 0) {
    // Preserve any essay scores a teacher already graded by hand — this function is now
    // the single authority for round-close grading, so it must merge instead of overwriting
    // (previously only the client's calculateRoomScores() did this merge).
    const existingManualScores = (attemptData as { manualScores?: Record<string, number> }).manualScores;
    if (existingManualScores && Object.keys(existingManualScores).length > 0) {
      const manualTotal = manualEssayQuestionIds.reduce((sum, qid) => {
        const value = existingManualScores[qid];
        return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
      }, 0);
      const allManualGraded = manualEssayQuestionIds.every((qid) => {
        const value = existingManualScores[qid];
        return typeof value === "number" && Number.isFinite(value);
      });
      await attemptRef.update({
        score: totalScore + manualTotal,
        status: allManualGraded ? "graded" : "submitted",
        objectiveScore: totalScore,
        objectiveMaxPoints: autoGradableMaxPoints,
        pendingManualGrading: !allManualGraded,
        manualEssayCount,
        ...(allManualGraded ? { gradedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
      });
      return allManualGraded ? "graded" : "partial_graded";
    }

    console.info("[autoGradeAttempt] partial grading — manual essay pending", {
      attemptId,
      roomId,
      round,
      manualEssayCount,
      totalScore,
      autoGradableMaxPoints,
    });
    await attemptRef.update({
      score: totalScore,
      status: "submitted",
      objectiveScore: totalScore,
      objectiveMaxPoints: autoGradableMaxPoints,
      pendingManualGrading: true,
      manualEssayCount,
    });
    return "partial_graded";
  }

  await attemptRef.update({
    score: totalScore,
    status: "graded",
    objectiveMaxPoints: autoGradableMaxPoints,
    pendingManualGrading: false,
    manualEssayCount: 0,
    gradedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return "graded";
}

/**
 * Callable fallback — client invokes after submit (also recovers stuck attempts).
 *
 * This is the only per-attempt grading entry point outside of finalizeExamRoundOnClose.
 * A previous Firestore trigger (gradeSubmittedExamAttempt) also graded attempts on
 * submit, racing with finalizeExamRoundOnClose the moment a round closed — removed
 * in favor of this single explicit path, which the client already calls directly
 * from submitAttempt() for late/out-of-round submissions.
 */
export const requestExamAttemptGrading = onCall(
  {
    region: CALLABLE_REGION,
    cors: CALLABLE_CORS,
    invoker: "public",
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const roomId = typeof request.data?.roomId === "string" ? request.data.roomId.trim() : "";
    const attemptId = typeof request.data?.attemptId === "string" ? request.data.attemptId.trim() : "";
    if (!roomId || !attemptId) {
      throw new HttpsError("invalid-argument", "roomId and attemptId are required");
    }

    const attemptRef = db.collection("exam_rooms").doc(roomId).collection("attempts").doc(attemptId);
    const attemptSnap = await attemptRef.get();
    if (!attemptSnap.exists) {
      throw new HttpsError("not-found", "Attempt not found");
    }

    const attemptData = attemptSnap.data() as ExamAttemptDoc & { studentId?: string; pendingManualGrading?: boolean };
    if (attemptData.studentId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not your attempt");
    }

    const status = String(attemptData.status || "");
    if (status !== "submitted" && status !== "graded") {
      throw new HttpsError("failed-precondition", "Attempt is not submitted yet");
    }

    if (typeof attemptData.score === "number" && attemptData.pendingManualGrading !== true) {
      return { status: "already_graded", score: attemptData.score };
    }

    const roomSnap = await db.collection("exam_rooms").doc(roomId).get();
    if (!roomSnap.exists) {
      throw new HttpsError("not-found", "Exam room not found");
    }

    const roomData = roomSnap.data() as ExamRoomDoc;
    // คะแนนรอบคำนวณทีเดียวตอนครูปิดห้อง — ระหว่างเปิดอยู่ยังไม่ตรวจรายคน
    if (String(roomData.status || "") === "active") {
      return { status: "deferred_until_round_close" };
    }

    const result = await autoGradeAttempt(
      db,
      attemptRef,
      attemptData,
      roomData,
      attemptId,
    );
    const refreshed = await attemptRef.get();
    const score = refreshed.data()?.score;
    return {
      status: result,
      score: typeof score === "number" ? score : undefined,
    };
  },
);

/**
 * Trigger: when a round is closed, finalize in-progress attempts and auto-grade.
 * Gen2 + database pmv1.
 */
export const finalizeExamRoundOnClose = onDocumentUpdated(
  {
    document: "exam_rooms/{roomId}",
    region: CALLABLE_REGION,
    database: getFirestoreDatabaseId(),
    timeoutSeconds: 180,
    memory: "512MiB",
  },
  async (event) => {
    const change = event.data;
    if (!change) return;

    const before = change.before.data() as {
      status?: string;
      currentRound?: number;
      completedRounds?: number;
    };
    const after = change.after.data() as ExamRoomDoc & {
      status?: string;
      currentRound?: number;
      completedRounds?: number;
    };

    const wasActive = before?.status === "active";
    const isActive = after?.status === "active";
    if (!wasActive || isActive) return;

    const closedRound = normalizeRound(before?.currentRound);
    const roomId = String(event.params.roomId);
    const roomRef = db.collection("exam_rooms").doc(roomId);

    // Firestore triggers are delivered at-least-once, so the same room-close event
    // can fire this function more than once. This is now the single authority for
    // round-close grading (see requestExamAttemptGrading comment above), so claim an
    // exclusive lock per round before doing any grading work — a redelivered event
    // (or an overlapping invocation) sees the round already claimed and exits.
    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(roomRef);
      const finalizedRounds = (snap.data()?.finalizedRounds as number[] | undefined) ?? [];
      if (finalizedRounds.includes(closedRound)) return false;
      tx.update(roomRef, {
        finalizedRounds: admin.firestore.FieldValue.arrayUnion(closedRound),
      });
      return true;
    });

    if (!claimed) {
      console.log(`[finalizeExamRoundOnClose] round ${closedRound} of room ${roomId} already finalized, skip`);
      return;
    }

    const attemptsSnap = await db
      .collection("exam_rooms").doc(roomId)
      .collection("attempts")
      .where("round", "==", closedRound)
      .get();

    if (attemptsSnap.empty) return;

    for (const attemptDoc of attemptsSnap.docs) {
      const data = attemptDoc.data() as ExamAttemptDoc;
      const status = String(data.status || "");
      const score = data.score;

      if (status === "graded" || typeof score === "number") continue;

      if (status === "in_progress") {
        await attemptDoc.ref.update({
          status: "submitted",
          submittedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSavedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        data.status = "submitted";
      }

      if (String(data.status || "") !== "submitted") continue;
      if (typeof data.score === "number") continue;

      await autoGradeAttempt(db, attemptDoc.ref, data, after, attemptDoc.id);
    }
  },
);

/**
 * Callable Function: ตั้ง custom claim (role) บน anonymous user หลัง login
 */
export const setAnonymousUserRole = functions
  .region("asia-southeast1")
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }

    const { firestoreUid } = data as { firestoreUid: string };
    if (!firestoreUid) {
      throw new functions.https.HttpsError("invalid-argument", "firestoreUid is required");
    }

    const userDoc = await db.collection("users").doc(firestoreUid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User not found");
    }

    const role = userDoc.data()?.role;
    if (!role) {
      throw new functions.https.HttpsError("not-found", "User role not found");
    }

    await admin.auth().setCustomUserClaims(context.auth.uid, { role, firestoreUid });
    return { role };
  });

/**
 * Callable Function: ลบบัญชีผู้ใช้จาก Auth และทำความสะอาดข้อมูลในทุก Collection
 * เรียกจาก Client เมื่อ Admin ต้องการลบผู้ใช้งาน
 */
export const deleteAuthUser = functions
  .region("asia-southeast1")
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    // ตรวจสอบว่าผู้เรียกมีสิทธิ์ (ต้องเป็น Admin หรือ Sysadmin)
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }

    const callerRole = context.auth.token?.role;
    if (callerRole !== "admin" && callerRole !== "sysadmin") {
      throw new functions.https.HttpsError("permission-denied", "Only admin can delete users");
    }

    const { userId, authUid } = data as { userId: string; authUid: string };
    if (!userId || !authUid) {
      throw new functions.https.HttpsError("invalid-argument", "userId and authUid are required");
    }

    const batch = db.batch();

    try {
      // 1. ลบบัญชีใน Firebase Auth
      await admin.auth().deleteUser(authUid);
      console.log(`Deleted Auth account: ${authUid}`);
    } catch (error: any) {
      if (error.code !== "auth/user-not-found") {
        console.error(`Failed to delete Auth user ${authUid}:`, error);
        throw new functions.https.HttpsError("internal", `Failed to delete auth user: ${error.message}`);
      }
      console.log(`Auth user ${authUid} not found, continuing cleanup...`);
    }

    try {
      // 2. ลบ Document ใน users collection
      const userRef = db.collection("users").doc(userId);
      batch.delete(userRef);

      // 3. ลบจาก teachers (ถ้ามี)
      const teacherDoc = await db.collection("teachers").doc(userId).get();
      if (teacherDoc.exists) batch.delete(teacherDoc.ref);

      const teacherQuery = await db.collection("teachers").where("userId", "==", userId).get();
      teacherQuery.forEach(doc => batch.delete(doc.ref));

      // 4. ลบจาก students (ถ้ามี)
      const studentDoc = await db.collection("students").doc(userId).get();
      if (studentDoc.exists) batch.delete(studentDoc.ref);

      // 5. ลบ enrollments ของนักเรียน
      const enrollQuery = await db.collection("enrollments").where("studentId", "==", userId).get();
      enrollQuery.forEach(doc => batch.delete(doc.ref));

      // 6. ลบใบสมัคร
      const regSnapshot = await db
        .collection("registration_requests")
        .where("authUid", "==", userId)
        .get();
      regSnapshot.forEach(doc => batch.delete(doc.ref));

      await batch.commit();
      console.log(`Successfully cleaned up all data for user ${userId}`);
      return { success: true };
    } catch (error: any) {
      console.error(`Cleanup failed for user ${userId}:`, error);
      throw new functions.https.HttpsError("internal", `Cleanup failed: ${error.message}`);
    }
  });

/**
 * Callable Function: ตั้ง Custom Claims ให้ผู้ใช้ที่เพิ่งสร้าง
 */
export const setUserClaims = functions
  .region("asia-southeast1")
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }

    const callerRole = context.auth.token?.role;
    if (callerRole !== "admin" && callerRole !== "sysadmin") {
      throw new functions.https.HttpsError("permission-denied", "Only admin can set claims");
    }

    const { uid, role } = data as { uid: string; role: string };
    if (!uid || !role) {
      throw new functions.https.HttpsError("invalid-argument", "uid and role are required");
    }

    await admin.auth().setCustomUserClaims(uid, { role });
    console.log(`Set custom claim 'role: ${role}' for user ${uid}`);
    return { success: true };
  });

function isAdminRole(role: unknown): boolean {
  return role === "admin" || role === "sysadmin";
}

async function assertAdminCaller(
  context: functions.https.CallableContext,
  db: FirebaseFirestore.Firestore,
): Promise<void> {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const claimedRole = context.auth.token?.role;
  if (isAdminRole(claimedRole)) return;

  const callerSnap = await db.collection("users").doc(context.auth.uid).get();
  const callerRole = callerSnap.data()?.role;
  if (!isAdminRole(callerRole)) {
    throw new functions.https.HttpsError("permission-denied", "Only admin can perform this action");
  }
}

export const updateAuthUserEmail = functions
  .region("asia-southeast1")
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    await assertAdminCaller(context, db);

    const userId = typeof data?.userId === "string" ? data.userId.trim() : "";
    const authUid = typeof data?.authUid === "string" && data.authUid.trim() ? data.authUid.trim() : userId;
    const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";

    if (!userId || !authUid || !email) {
      throw new functions.https.HttpsError("invalid-argument", "userId, authUid, and email are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new functions.https.HttpsError("invalid-argument", "รูปแบบอีเมลไม่ถูกต้อง");
    }

    try {
      await admin.auth().updateUser(authUid, {
        email,
        emailVerified: false,
      });
    } catch (error: any) {
      if (error?.code === "auth/email-already-exists") {
        throw new functions.https.HttpsError("already-exists", "อีเมลนี้มีในระบบแล้ว");
      }
      if (error?.code === "auth/user-not-found") {
        throw new functions.https.HttpsError("not-found", "ไม่พบบัญชี Firebase Auth ของผู้ใช้นี้");
      }
      throw new functions.https.HttpsError("internal", error?.message || "อัปเดตอีเมลใน Firebase Auth ไม่สำเร็จ");
    }

    return { success: true, userId, authUid, email };
  });

/**
 * Callable Function: Migrate legacy staff_attendance -> staff_attendance_by_date/{date}/entries/{userId}
 * Supports dryRun + optional date range filter.
 */
export const migrateStaffAttendanceByDate = functions
  .region("asia-southeast1")
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onCall(async (data: any, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
    }

    const caller = await db.collection("users").doc(context.auth.uid).get();
    const callerRole = caller.data()?.role;
    if (callerRole !== "admin" && callerRole !== "sysadmin") {
      throw new functions.https.HttpsError("permission-denied", "Only admin can run migration");
    }

    const dryRun = Boolean(data?.dryRun);
    const from = typeof data?.from === "string" && data.from.trim() ? data.from.trim() : null;
    const to = typeof data?.to === "string" && data.to.trim() ? data.to.trim() : null;

    if (from && !isValidDateStr(from)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid from date format (YYYY-MM-DD)");
    }
    if (to && !isValidDateStr(to)) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid to date format (YYYY-MM-DD)");
    }
    if (from && to && from > to) {
      throw new functions.https.HttpsError("invalid-argument", "from must be <= to");
    }

    const legacySnap = await db.collection("staff_attendance").get();
    const grouped = new Map<string, AttendanceDoc[]>();
    let invalid = 0;
    let outOfRange = 0;

    legacySnap.forEach((docSnap) => {
      const row = docSnap.data();
      const userId = typeof row.userId === "string" ? row.userId.trim() : "";
      const date = typeof row.date === "string" ? row.date.trim() : "";
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
      arr.push({ id: docSnap.id, data: row });
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

      if (winner.id === "existing-target") {
        preservedExistingBetter += 1;
        continue;
      }

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

      batch.set(targetRef, {
        ...legacyBest.data,
        userId,
        date,
        migratedFromLegacyAt: admin.firestore.FieldValue.serverTimestamp(),
        migratedFromLegacyDocId: legacyBest.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      opCount += 1;
      migratedEntries += 1;

      if (opCount >= STAFF_MIGRATION_BATCH_LIMIT) {
        if (!dryRun) await batch.commit();
        batch = db.batch();
        opCount = 0;
        dayTouched.clear();
      }
    }

    if (opCount > 0 && !dryRun) {
      await batch.commit();
    }

    return {
      success: true,
      dryRun,
      range: { from, to },
      scannedLegacyDocs: legacySnap.size,
      groupedUserDateRecords: grouped.size,
      duplicateGroups,
      migratedEntries,
      preservedExistingBetter,
      touchedDays,
      skippedInvalidDocs: invalid,
      skippedOutOfRangeDocs: outOfRange,
    };
  });
