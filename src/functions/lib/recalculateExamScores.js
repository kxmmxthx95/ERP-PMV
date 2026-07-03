"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Recalculate exam attempt scores for one or more rooms.
 *
 * Usage:
 *   npm run recalculate:exam-scores -- --title "จำนวนเต็ม"
 *   npm run recalculate:exam-scores -- --room-id <id> --round 1
 *   npm run recalculate:exam-scores -- --title "จำนวนเต็ม" --dry-run
 */
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const app_1 = require("firebase-admin/app");
const getAdminFirestore_1 = require("./getAdminFirestore");
function resolveProjectId() {
    if (process.env.GCLOUD_PROJECT?.trim())
        return process.env.GCLOUD_PROJECT.trim();
    if (process.env.GOOGLE_CLOUD_PROJECT?.trim())
        return process.env.GOOGLE_CLOUD_PROJECT.trim();
    if (process.env.VITE_FIREBASE_PROJECT_ID?.trim())
        return process.env.VITE_FIREBASE_PROJECT_ID.trim();
    try {
        const rc = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.resolve)(__dirname, "../../.firebaserc"), "utf8"));
        if (rc.projects?.default)
            return rc.projects.default;
    }
    catch {
        /* ignore */
    }
    return "pmv1-90180";
}
if ((0, app_1.getApps)().length === 0) {
    (0, app_1.initializeApp)({ projectId: resolveProjectId() });
}
function parseArgs(argv) {
    const args = {
        roomId: "",
        title: "",
        round: 0,
        dryRun: false,
    };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === "--room-id")
            args.roomId = argv[++i] ?? "";
        else if (a === "--title")
            args.title = argv[++i] ?? "";
        else if (a === "--round")
            args.round = Number(argv[++i] ?? "0");
        else if (a === "--dry-run")
            args.dryRun = true;
    }
    return args;
}
function normalizeRound(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}
function normalizeTextAnswer(value) {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}
function resolveRoundConfig(roomData, round) {
    const roundKey = String(round);
    const cfg = roomData.roundQuestions?.[roundKey] ||
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
function getCorrectOptionId(questionData) {
    if (typeof questionData.correctOptionId === "string" && questionData.correctOptionId.trim()) {
        return questionData.correctOptionId.trim();
    }
    const options = questionData.payload?.options;
    if (!Array.isArray(options))
        return null;
    const correctIndex = options.findIndex((opt) => opt?.isCorrect === true);
    if (correctIndex < 0)
        return null;
    const correct = options[correctIndex];
    if (typeof correct?.id === "string" && correct.id.trim())
        return correct.id.trim();
    return String(correctIndex + 1);
}
function legacyOptionKey(id) {
    const trimmed = id.trim();
    const legacy = /^opt-(\d+)$/.exec(trimmed);
    return legacy ? legacy[1] : trimmed;
}
function isSelectedOptionCorrect(selectedOptionId, correctOptionId, options) {
    if (!selectedOptionId.trim())
        return false;
    const sel = legacyOptionKey(selectedOptionId);
    const cor = legacyOptionKey(correctOptionId);
    if (sel === cor)
        return true;
    const correctIndex = options.findIndex((opt) => opt?.isCorrect === true);
    if (correctIndex < 0)
        return false;
    const selectedIndex = options.findIndex((opt, index) => {
        const oid = typeof opt.id === "string" && opt.id.trim() ? opt.id.trim() : String(index + 1);
        return legacyOptionKey(oid) === sel || oid === selectedOptionId.trim();
    });
    return selectedIndex >= 0 && selectedIndex === correctIndex;
}
function addQuestionScore(totalScore, questionId, questionData, questionPoints) {
    const overridePts = questionPoints[questionId];
    const docPts = Number(questionData.points || 0);
    if (typeof overridePts === "number" && overridePts >= 0)
        return totalScore + overridePts;
    if (docPts > 0)
        return totalScore + docPts;
    return totalScore + 1;
}
function orderQuestionIdsFromMap(questionMap) {
    return Array.from(questionMap.entries())
        .sort(([, a], [, b]) => (Number(a.orderIndex) || 0) - (Number(b.orderIndex) || 0))
        .map(([id]) => id);
}
function resolveEffectiveQuestionIds(selectedQuestionIds, questionMap) {
    if (selectedQuestionIds.length > 0) {
        return selectedQuestionIds.filter((qid) => questionMap.has(qid));
    }
    return orderQuestionIdsFromMap(questionMap);
}
function gradeAttempt(selectedQuestionIds, questionMap, answers, questionPoints) {
    const effectiveIds = resolveEffectiveQuestionIds(selectedQuestionIds, questionMap);
    if (effectiveIds.length === 0)
        return { kind: "skipped_no_questions" };
    let totalScore = 0;
    let hasManualEssay = false;
    for (const questionId of effectiveIds) {
        const q = questionMap.get(questionId);
        if (!q)
            continue;
        if (q.type === "essay") {
            const expected = q.payload?.expectedAnswer?.trim();
            if (expected) {
                const studentAnswer = typeof answers[questionId] === "string" ? answers[questionId] : "";
                if (normalizeTextAnswer(studentAnswer) === normalizeTextAnswer(expected)) {
                    totalScore = addQuestionScore(totalScore, questionId, q, questionPoints);
                }
                continue;
            }
            hasManualEssay = true;
            continue;
        }
        const correctOptionId = getCorrectOptionId(q);
        if (!correctOptionId)
            continue;
        const selectedOptionId = typeof answers[questionId] === "string" ? answers[questionId] : "";
        const mcOptions = Array.isArray(q.payload?.options) ? q.payload.options : [];
        if (isSelectedOptionCorrect(selectedOptionId, correctOptionId, mcOptions)) {
            totalScore = addQuestionScore(totalScore, questionId, q, questionPoints);
        }
    }
    if (hasManualEssay)
        return { kind: "skipped_essay" };
    return { kind: "graded", score: totalScore };
}
async function loadQuestionMap(db, setIds) {
    const questionMap = new Map();
    await Promise.all(setIds.map(async (setId) => {
        const snap = await db.collection("question_sets").doc(setId).collection("questions").get();
        snap.forEach((docSnap) => {
            questionMap.set(docSnap.id, docSnap.data());
        });
    }));
    return questionMap;
}
async function recalculateRoomRound(db, roomId, roomData, round, dryRun) {
    const { selectedQuestionIds, questionSetByQuestionId, questionPoints, fallbackQuestionSetId, } = resolveRoundConfig(roomData, round);
    const candidateSetIds = new Set();
    selectedQuestionIds.forEach((qid) => {
        const mapped = questionSetByQuestionId[qid];
        if (typeof mapped === "string" && mapped.trim())
            candidateSetIds.add(mapped.trim());
    });
    if (typeof fallbackQuestionSetId === "string" && fallbackQuestionSetId.trim()) {
        candidateSetIds.add(fallbackQuestionSetId.trim());
    }
    if (candidateSetIds.size === 0) {
        console.warn(`  round ${round}: no question set ids`);
        return 0;
    }
    const questionMap = await loadQuestionMap(db, Array.from(candidateSetIds));
    const attemptsSnap = await db
        .collection("exam_rooms")
        .doc(roomId)
        .collection("attempts")
        .where("round", "==", round)
        .get();
    let updated = 0;
    for (const attemptDoc of attemptsSnap.docs) {
        const data = attemptDoc.data();
        const status = String(data.status || "");
        if (status !== "submitted" && status !== "graded")
            continue;
        const answers = data.answers && typeof data.answers === "object" ? data.answers : {};
        const answerCount = Object.keys(answers).length;
        if (answerCount === 0)
            continue;
        const result = gradeAttempt(selectedQuestionIds, questionMap, answers, questionPoints);
        if (result.kind !== "graded") {
            console.log(`  skip ${attemptDoc.id} (${data.studentName ?? "?"}): ${result.kind}`);
            continue;
        }
        const prevScore = typeof data.score === "number" ? data.score : null;
        console.log(`  ${data.studentName ?? attemptDoc.id}: ${prevScore ?? "-"} → ${result.score} (${answerCount} answers)`);
        if (!dryRun && prevScore !== result.score) {
            await attemptDoc.ref.update({
                score: result.score,
                status: "graded",
                gradedAt: new Date(),
            });
            updated += 1;
        }
        else if (!dryRun && prevScore === result.score && status === "submitted") {
            await attemptDoc.ref.update({
                score: result.score,
                status: "graded",
                gradedAt: new Date(),
            });
            updated += 1;
        }
    }
    return updated;
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.roomId && !args.title) {
        console.error("Usage: recalculateExamScores --room-id <id> | --title <search> [--round N] [--dry-run]");
        process.exit(1);
    }
    const db = (0, getAdminFirestore_1.getAdminFirestore)();
    let roomDocs = [];
    if (args.roomId) {
        const snap = await db.collection("exam_rooms").doc(args.roomId).get();
        if (!snap.exists) {
            console.error("Room not found:", args.roomId);
            process.exit(1);
        }
        roomDocs = [{ id: snap.id, data: snap.data() }];
    }
    else {
        const snap = await db.collection("exam_rooms").get();
        const needle = args.title.trim().toLowerCase();
        roomDocs = snap.docs
            .filter((d) => {
            const title = String(d.data().title ?? "").toLowerCase();
            const className = String(d.data().className ?? "").toLowerCase();
            return title.includes(needle) || className.includes(needle);
        })
            .map((d) => ({ id: d.id, data: d.data() }));
    }
    if (roomDocs.length === 0) {
        console.error("No matching exam rooms.");
        process.exit(1);
    }
    console.log(`Found ${roomDocs.length} room(s)${args.dryRun ? " [dry-run]" : ""}`);
    let totalUpdated = 0;
    for (const room of roomDocs) {
        console.log(`\n${room.data.title ?? room.id} (${room.data.className ?? "-"}) [${room.id}]`);
        const rounds = args.round > 0
            ? [args.round]
            : Array.from(new Set((await db.collection("exam_rooms").doc(room.id).collection("attempts").get())
                .docs.map((d) => normalizeRound(d.data().round)))).sort((a, b) => a - b);
        for (const round of rounds) {
            console.log(`Round ${round}:`);
            totalUpdated += await recalculateRoomRound(db, room.id, room.data, round, args.dryRun);
        }
    }
    console.log(`\nDone. ${args.dryRun ? "Would update" : "Updated"} ${totalUpdated} attempt(s).`);
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=recalculateExamScores.js.map