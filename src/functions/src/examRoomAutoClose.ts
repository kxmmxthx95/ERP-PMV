import { onSchedule } from "firebase-functions/v2/scheduler";
import { getAdminFirestore } from "./getAdminFirestore";

const REGION = "asia-southeast1";
const db = getAdminFirestore();

interface ExamRoomDoc {
  status?: string;
  endTime?: number;
  currentRound?: number;
  completedRounds?: number;
  settings?: { maxAttempts?: number };
}

/**
 * Server-side safety net for exam rooms whose timer ran out.
 *
 * The web app only auto-closes expired rooms while a teacher has the exam
 * manager open (see useExamRoom.ts) — so a room with no teacher tab watching
 * it stays `active` forever, leaving students' exam cards stuck showing the
 * live "กำลังเปิดสอบ" indicator even after refresh. This flips the room's
 * status the same way updateRoomStatus(roomId, 'closed') does client-side;
 * the existing finalizeExamRoundOnClose Firestore trigger then auto-submits
 * any in-progress attempts and grades them.
 */
export const examRoomAutoClose = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Asia/Bangkok",
    region: REGION,
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async () => {
    const now = Date.now();
    const activeSnap = await db
      .collection("exam_rooms")
      .where("status", "==", "active")
      .get();

    const expiredDocs = activeSnap.docs.filter((docSnap) => {
      const data = docSnap.data() as ExamRoomDoc;
      return typeof data.endTime === "number" && now > data.endTime + 2000;
    });

    if (expiredDocs.length === 0) return;

    await Promise.all(
      expiredDocs.map(async (docSnap) => {
        const room = docSnap.data() as ExamRoomDoc;
        const maxAttempts = room.settings?.maxAttempts ?? 1;
        const completed = (room.completedRounds ?? 0) + 1;
        const hasMoreRounds = maxAttempts === 0 || completed < maxAttempts;

        await docSnap.ref.update({
          status: hasMoreRounds ? "upcoming" : "closed",
          completedRounds: completed,
        });

        console.log(
          `[examRoomAutoClose] closed expired room ${docSnap.id} (round ${room.currentRound ?? 1}), next status=${hasMoreRounds ? "upcoming" : "closed"}`,
        );
      }),
    );
  },
);
