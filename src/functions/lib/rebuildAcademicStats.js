"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onExamRoomAcademicStats = exports.rebuildAcademicStats = exports.rebuildAcademicStatsDoc = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const getAdminFirestore_1 = require("./getAdminFirestore");
const callableOptions_1 = require("./callableOptions");
const db = (0, getAdminFirestore_1.getAdminFirestore)();
function reportDocId(examType, semester, year, classId) {
    return `${examType}_${semester}_${year}_${classId}`;
}
function ensureClassReport(map, classId, className, gradeLevel) {
    const cur = map.get(classId) ?? {
        classId,
        className,
        gradeLevel,
        columns: new Map(),
        scoresByStudent: new Map(),
        namesFromAttempts: new Map(),
    };
    if (className && className !== classId)
        cur.className = className;
    if (gradeLevel && gradeLevel !== "—")
        cur.gradeLevel = gradeLevel;
    map.set(classId, cur);
    return cur;
}
function extractPmStudentCode(value) {
    const v = String(value ?? "").trim();
    if (!v)
        return null;
    const emailMatch = /^(\d+)@/i.exec(v);
    if (emailMatch)
        return emailMatch[1];
    if (/^\d+$/.test(v))
        return v;
    return null;
}
function displayStudentName(student) {
    const name = `${student.prefix ?? ""}${student.firstName ?? ""} ${student.lastName ?? ""}`
        .replace(/\s+/g, " ")
        .trim();
    return name || student.studentCode || student.id;
}
function buildIdentityLookup(students) {
    const lookup = new Map();
    const add = (key, canonical) => {
        const v = String(key ?? "").trim();
        if (v)
            lookup.set(v, canonical);
    };
    students.forEach((s) => {
        add(s.id, s.id);
        add(s.authUid, s.id);
        add(s.userId, s.id);
        add(s.email, s.id);
        const code = String(s.studentCode ?? "").trim();
        if (code) {
            add(code, s.id);
            add(`${code}@pmv.com`, s.id);
        }
    });
    return lookup;
}
async function loadStudentsByIds(ids) {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    const out = [];
    for (let i = 0; i < unique.length; i += 10) {
        const chunk = unique.slice(i, i + 10);
        const snaps = await Promise.all(chunk.map((id) => db.collection("students").doc(id).get()));
        snaps.forEach((snap) => {
            if (snap.exists)
                out.push({ id: snap.id, ...snap.data() });
        });
    }
    return out;
}
async function loadClassRosterStudents(classId, academicYearId) {
    let enrollSnap = academicYearId
        ? await db
            .collection("enrollments")
            .where("classId", "==", classId)
            .where("academicYearId", "==", academicYearId)
            .get()
        : null;
    if (!enrollSnap || enrollSnap.empty) {
        enrollSnap = await db.collection("enrollments").where("classId", "==", classId).get();
    }
    const enrollIds = enrollSnap.docs
        .map((d) => String(d.data().studentId ?? "").trim())
        .filter(Boolean);
    if (enrollIds.length > 0) {
        return loadStudentsByIds(enrollIds);
    }
    const byClassroom = await db.collection("students").where("classroomId", "==", classId).get();
    return byClassroom.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function writeClassMidtermReports(params) {
    const { academicYearId, semester, examType, classReports } = params;
    const updatedAt = Date.now();
    for (const acc of classReports.values()) {
        const columns = Array.from(acc.columns.values()).sort((a, b) => a.label.localeCompare(b.label, "th")
            || a.subjectName.localeCompare(b.subjectName, "th"));
        const classStudents = await loadClassRosterStudents(acc.classId, academicYearId);
        const rosterIds = new Set(classStudents.map((s) => s.id));
        const lookup = buildIdentityLookup(classStudents);
        acc.scoresByStudent.forEach((_, rawId) => {
            if (lookup.has(rawId))
                return;
            const code = extractPmStudentCode(rawId)
                ?? extractPmStudentCode(acc.namesFromAttempts.get(rawId) ?? "");
            if (!code)
                return;
            const hit = classStudents.find((s) => String(s.studentCode ?? "").trim() === code);
            if (hit)
                lookup.set(rawId, hit.id);
        });
        const scoresByCanonical = new Map();
        acc.scoresByStudent.forEach((byRoom, rawId) => {
            const canonical = lookup.get(rawId) ?? rawId;
            if (!rosterIds.has(canonical))
                return;
            const merged = scoresByCanonical.get(canonical) ?? new Map();
            byRoom.forEach((pct, roomId) => {
                const prev = merged.get(roomId);
                if (prev == null || pct > prev)
                    merged.set(roomId, pct);
            });
            scoresByCanonical.set(canonical, merged);
        });
        const students = classStudents
            .map((student) => {
            const scores = {};
            const byRoom = scoresByCanonical.get(student.id);
            columns.forEach((col) => {
                const pct = byRoom?.get(col.key);
                scores[col.key] = pct != null ? Math.round(pct * 10) / 10 : null;
            });
            return {
                studentId: student.id,
                studentCode: String(student.studentCode ?? ""),
                fullName: displayStudentName(student),
                ...(student.photoURL ? { photoURL: student.photoURL } : {}),
                scores,
            };
        })
            .sort((a, b) => a.studentCode.localeCompare(b.studentCode, "th", { numeric: true })
            || a.fullName.localeCompare(b.fullName, "th"));
        const id = reportDocId(examType, semester, academicYearId, acc.classId);
        await db.collection("class_midterm_reports").doc(id).set({
            id,
            academicYearId,
            semester,
            examType,
            classId: acc.classId,
            className: acc.className,
            gradeLevel: acc.gradeLevel,
            updatedAt,
            columns,
            students,
        });
    }
}
function statsDocId(examType, semester, year) {
    return `${examType}_${semester}_${year}`;
}
function avg(nums) {
    if (nums.length === 0)
        return 0;
    return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
}
/** T-Score: T = 50 + 10×(x−μ)/σ · sample SD · σ=0 → 50 */
function computeMeanSd(values) {
    const vals = values.filter((v) => typeof v === "number" && Number.isFinite(v));
    if (vals.length === 0)
        return null;
    const n = vals.length;
    const mean = vals.reduce((s, v) => s + v, 0) / n;
    if (n < 2)
        return { mean, sd: 0, n };
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    return { mean, sd: Math.sqrt(variance), n };
}
function toTScore(raw, stats) {
    if (!Number.isFinite(raw) || !stats)
        return null;
    if (stats.sd <= 0 || stats.n < 2)
        return 50;
    return Math.round((50 + (10 * (raw - stats.mean)) / stats.sd) * 10) / 10;
}
function mapRowsToSchoolTScores(rows) {
    const stats = computeMeanSd(rows.map((r) => r.pct));
    return rows.map((row) => {
        const t = toTScore(row.pct, stats);
        return t == null ? row : { ...row, pct: t };
    });
}
function mapRowsToRoomTScores(rows) {
    const byRoom = new Map();
    for (const row of rows) {
        if (!Number.isFinite(row.pct))
            continue;
        const list = byRoom.get(row.examRoomId) ?? [];
        list.push(row.pct);
        byRoom.set(row.examRoomId, list);
    }
    const statsByRoom = new Map();
    byRoom.forEach((vals, id) => {
        statsByRoom.set(id, computeMeanSd(vals));
    });
    return rows.map((row) => {
        if (!Number.isFinite(row.pct))
            return row;
        const t = toTScore(row.pct, statsByRoom.get(row.examRoomId) ?? null);
        return t == null ? row : { ...row, pct: t };
    });
}
function isTargetRoom(data, examType) {
    // เฉพาะห้องที่ตั้งค่า scoreCollectionType เป็นกลางภาค/ปลายภาคเท่านั้น
    const settings = (data.settings ?? {});
    return settings.scoreCollectionType === examType;
}
function roomMaxPoints(data) {
    const roundQuestions = (data.roundQuestions ?? {});
    const fromRounds = Object.values(roundQuestions).map((r) => r.totalPoints ?? 0);
    const roundMax = fromRounds.length > 0 ? Math.max(...fromRounds) : 0;
    return Math.max(Number(data.totalPoints) || 0, roundMax, 1);
}
const SUBJECT_GROUP_LABELS = {
    thai: "ภาษาไทย",
    math: "คณิตศาสตร์",
    science: "วิทยาศาสตร์และเทคโนโลยี",
    social: "สังคมศึกษา ศาสนา และวัฒนธรรม",
    pe: "สุขศึกษาและพลศึกษา",
    arts: "ศิลปะ",
    careers: "การงานอาชีพ",
    foreign: "ภาษาต่างประเทศ",
};
function resolveSubjectGroupLabel(subjectGroupId) {
    const id = String(subjectGroupId ?? "").trim();
    if (!id)
        return "—";
    return SUBJECT_GROUP_LABELS[id] ?? id;
}
async function rebuildAcademicStatsDoc(params) {
    const examType = params.examType ?? "midterm";
    const { academicYearId, semester } = params;
    const id = statsDocId(examType, semester, academicYearId);
    const roomsSnap = await db
        .collection("exam_rooms")
        .where("academicYearId", "==", academicYearId)
        .where("semester", "==", semester)
        .get();
    const rooms = roomsSnap.docs.filter((d) => isTargetRoom(d.data(), examType));
    const scoreRows = [];
    let roomsGraded = 0;
    const unlinkedRooms = [];
    const atRiskRoomIds = new Set();
    const pendingGradingRoomIds = new Set();
    const classReports = new Map();
    for (const roomDoc of rooms) {
        const room = roomDoc.data();
        const attemptsSnap = await roomDoc.ref.collection("attempts").get();
        const maxPts = roomMaxPoints(room);
        const bestByStudent = new Map();
        const namesByStudent = new Map();
        let pendingGrading = false;
        attemptsSnap.docs.forEach((aDoc) => {
            const data = aDoc.data();
            const status = String(data.status ?? "");
            if (status !== "graded" && status !== "submitted")
                return;
            if (data.pendingManualGrading === true) {
                pendingGrading = true;
                return;
            }
            const score = typeof data.score === "number" ? data.score : null;
            if (score == null) {
                if (status === "submitted")
                    pendingGrading = true;
                return;
            }
            const objMax = typeof data.objectiveMaxPoints === "number" && data.objectiveMaxPoints > 0
                ? data.objectiveMaxPoints
                : maxPts;
            const pct = Math.min(100, Math.max(0, (score / objMax) * 100));
            const studentId = String(data.studentId ?? aDoc.id);
            const studentName = String(data.studentName ?? "").trim();
            if (studentName)
                namesByStudent.set(studentId, studentName);
            const prev = bestByStudent.get(studentId);
            if (prev == null || pct > prev)
                bestByStudent.set(studentId, pct);
        });
        if (pendingGrading)
            pendingGradingRoomIds.add(roomDoc.id);
        const settings = (room.settings ?? {});
        const subjectName = String(room.subjectName || room.title || "ไม่ระบุวิชา");
        const subjectId = String(room.subjectId || roomDoc.id);
        const classId = String(room.classId || "unknown");
        const className = String(room.className || classId);
        const gradeLevel = String(room.gradeLevel || "—");
        const subjectGroupId = String(room.subjectGroupId ?? "").trim();
        const subjectGroup = resolveSubjectGroupLabel(room.subjectGroupId);
        const subSubjectGroup = String(room.subSubjectGroup ?? "").trim() || "—";
        const teacherName = String(room.teacherName ?? "").trim() || "—";
        const teacherId = String(room.teacherId ?? "").trim() || teacherName;
        const teacherPhotoURL = String(room.teacherPhotoURL ?? "").trim();
        if (classId !== "unknown") {
            const report = ensureClassReport(classReports, classId, className, gradeLevel);
            const label = subSubjectGroup !== "—"
                ? subSubjectGroup
                : (subjectGroup !== "—" ? subjectGroup : subjectName);
            report.columns.set(roomDoc.id, {
                key: roomDoc.id,
                label,
                subjectId,
                subjectName,
                ...(subjectGroupId ? { subjectGroupId } : {}),
                ...(subjectGroup && subjectGroup !== "—" ? { subjectGroup } : {}),
                ...(subSubjectGroup !== "—" ? { subSubjectGroup } : {}),
            });
            namesByStudent.forEach((name, sid) => {
                if (!report.namesFromAttempts.has(sid))
                    report.namesFromAttempts.set(sid, name);
            });
            if (!pendingGrading) {
                bestByStudent.forEach((pct, studentId) => {
                    const byRoom = report.scoresByStudent.get(studentId) ?? new Map();
                    const prev = byRoom.get(roomDoc.id);
                    if (prev == null || pct > prev)
                        byRoom.set(roomDoc.id, pct);
                    report.scoresByStudent.set(studentId, byRoom);
                });
            }
        }
        if (pendingGrading)
            continue;
        const linked = settings.scoreCollectionEnabled === true
            || settings.scoreCollectionLinked === true
            || bestByStudent.size > 0;
        // at-risk: ห้องกลางภาคที่มีคะแนนแล้ว (active / upcoming / closed)
        if (bestByStudent.size > 0) {
            atRiskRoomIds.add(roomDoc.id);
        }
        if (linked) {
            roomsGraded += 1;
        }
        else {
            unlinkedRooms.push({
                examRoomId: roomDoc.id,
                title: String(room.title || subjectName),
                subjectName,
                className,
                gradeLevel,
                subjectGroup,
                subjectGroupId,
                subSubjectGroup,
                teacherId,
                teacherName,
                teacherPhotoURL,
            });
        }
        bestByStudent.forEach((pct, studentId) => {
            scoreRows.push({
                studentId,
                pct,
                subjectId,
                subjectName,
                classId,
                className,
                gradeLevel,
                subjectGroup,
                subjectGroupId,
                subSubjectGroup,
                teacherId,
                teacherName,
                teacherPhotoURL,
                examRoomId: roomDoc.id,
                roomStatus: String(room.status ?? "upcoming"),
            });
        });
    }
    // KPI/ระดับชั้น/ครู = T ทั้งโรงเรียน · at-risk = T ต่อห้อง
    const schoolTRows = mapRowsToSchoolTScores(scoreRows);
    const roomTRows = mapRowsToRoomTScores(scoreRows);
    const pcts = schoolTRows.map((r) => r.pct);
    const passCount = pcts.filter((p) => p >= 50).length;
    const failCount = pcts.length - passCount;
    const bySubject = new Map();
    schoolTRows.forEach((r) => {
        const key = `${r.subjectName}|${r.gradeLevel}`;
        const cur = bySubject.get(key) ?? { name: r.subjectName, grade: r.gradeLevel, list: [] };
        cur.list.push(r.pct);
        bySubject.set(key, cur);
    });
    const subjectAvgs = Array.from(bySubject.entries()).map(([key, v]) => ({
        key,
        label: v.grade && v.grade !== "—" ? `${v.name} ${v.grade}` : v.name,
        subjectName: v.name,
        gradeLevel: v.grade,
        avgPct: avg(v.list),
        n: v.list.length,
    }));
    const sortedAsc = [...subjectAvgs].sort((a, b) => a.avgPct - b.avgPct);
    const bottomSubjects = sortedAsc.slice(0, 5);
    const topSubjects = [...sortedAsc].reverse().slice(0, 5);
    const byGrade = new Map();
    schoolTRows.forEach((r) => {
        const list = byGrade.get(r.gradeLevel) ?? [];
        list.push(r.pct);
        byGrade.set(r.gradeLevel, list);
    });
    const byGradeLevel = Array.from(byGrade.entries())
        .map(([gradeLevel, list]) => ({ gradeLevel, avgPct: avg(list), n: list.length }))
        .sort((a, b) => a.gradeLevel.localeCompare(b.gradeLevel, "th", { numeric: true }));
    // T-Score bands: ≥60 ดี · 40–59 ปานกลาง · <40 ต้องปรับปรุง
    const distribution = {
        excellent: pcts.filter((p) => p >= 60).length,
        average: pcts.filter((p) => p >= 40 && p < 60).length,
        needsImprovement: pcts.filter((p) => p < 40).length,
    };
    const classSubject = new Map();
    roomTRows.forEach((r) => {
        if (!atRiskRoomIds.has(r.examRoomId))
            return;
        const key = `${r.classId}|${r.subjectId}|${r.examRoomId}`;
        const cur = classSubject.get(key) ?? {
            fail: 0,
            total: 0,
            classId: r.classId,
            className: r.className,
            subjectId: r.subjectId,
            subjectName: r.subjectName,
            gradeLevel: r.gradeLevel,
            subjectGroup: r.subjectGroup,
            subjectGroupId: r.subjectGroupId,
            subSubjectGroup: r.subSubjectGroup,
            teacherName: r.teacherName,
            teacherPhotoURL: r.teacherPhotoURL,
            examRoomId: r.examRoomId,
            roomStatus: r.roomStatus,
        };
        cur.total += 1;
        if (r.pct < 50)
            cur.fail += 1;
        classSubject.set(key, cur);
    });
    const atRiskClasses = Array.from(classSubject.values())
        .map((c) => ({
        classId: c.classId,
        className: c.className,
        subjectId: c.subjectId,
        subjectName: c.subjectName,
        gradeLevel: c.gradeLevel,
        subjectGroup: c.subjectGroup,
        subjectGroupId: c.subjectGroupId,
        subSubjectGroup: c.subSubjectGroup,
        teacherName: c.teacherName,
        teacherPhotoURL: c.teacherPhotoURL,
        examRoomId: c.examRoomId,
        roomStatus: c.roomStatus,
        failCount: c.fail,
        totalCount: c.total,
        failRatePct: c.total > 0 ? Math.round((c.fail / c.total) * 1000) / 10 : 0,
    }))
        .filter((c) => c.totalCount >= 3 && c.failRatePct > 50)
        .sort((a, b) => b.failRatePct - a.failRatePct)
        .slice(0, 20);
    const byTeacher = new Map();
    const ensureTeacher = (teacherId, teacherName, teacherPhotoURL) => {
        const key = teacherId || teacherName;
        const cur = byTeacher.get(key) ?? {
            teacherId: key,
            teacherName,
            teacherPhotoURL: teacherPhotoURL || "",
            pass: 0,
            total: 0,
            sumPct: 0,
            rooms: new Map(),
        };
        if (!cur.teacherPhotoURL && teacherPhotoURL)
            cur.teacherPhotoURL = teacherPhotoURL;
        byTeacher.set(key, cur);
        return cur;
    };
    for (const roomDoc of rooms) {
        const room = roomDoc.data();
        const status = String(room.status ?? "");
        const opened = status === "active"
            || status === "closed"
            || Number(room.currentRound ?? 0) > 0
            || Number(room.completedRounds ?? 0) > 0;
        if (!opened)
            continue;
        const teacherName = String(room.teacherName ?? "").trim() || "—";
        if (teacherName === "—")
            continue;
        const teacherId = String(room.teacherId ?? "").trim() || teacherName;
        const teacherPhotoURL = String(room.teacherPhotoURL ?? "").trim();
        const cur = ensureTeacher(teacherId, teacherName, teacherPhotoURL);
        const pendingGrading = pendingGradingRoomIds.has(roomDoc.id);
        const subjectGroupId = String(room.subjectGroupId ?? "").trim();
        const subjectGroup = resolveSubjectGroupLabel(room.subjectGroupId);
        const subSubjectGroup = String(room.subSubjectGroup ?? "").trim() || "—";
        if (!cur.rooms.has(roomDoc.id)) {
            cur.rooms.set(roomDoc.id, {
                examRoomId: roomDoc.id,
                subjectName: String(room.subjectName || room.title || "ไม่ระบุวิชา"),
                className: String(room.className || room.classId || "—"),
                gradeLevel: String(room.gradeLevel || "—"),
                subjectGroup,
                subjectGroupId,
                subSubjectGroup,
                pass: 0,
                total: 0,
                pendingGrading,
            });
        }
        else if (pendingGrading) {
            cur.rooms.get(roomDoc.id).pendingGrading = true;
        }
    }
    schoolTRows.forEach((r) => {
        if (!r.teacherName || r.teacherName === "—")
            return;
        const cur = ensureTeacher(r.teacherId, r.teacherName, r.teacherPhotoURL);
        cur.total += 1;
        cur.sumPct += r.pct;
        if (r.pct >= 50)
            cur.pass += 1;
        const room = cur.rooms.get(r.examRoomId) ?? {
            examRoomId: r.examRoomId,
            subjectName: r.subjectName,
            className: r.className,
            gradeLevel: r.gradeLevel,
            subjectGroup: r.subjectGroup,
            subjectGroupId: r.subjectGroupId,
            subSubjectGroup: r.subSubjectGroup,
            pass: 0,
            total: 0,
            pendingGrading: false,
        };
        room.total += 1;
        if (r.pct >= 50)
            room.pass += 1;
        cur.rooms.set(r.examRoomId, room);
    });
    const teacherPassRanking = Array.from(byTeacher.values())
        .map((t) => {
        const roomsList = Array.from(t.rooms.values())
            .map((room) => ({
            examRoomId: room.examRoomId,
            subjectName: room.subjectName,
            className: room.className,
            gradeLevel: room.gradeLevel,
            passCount: room.pass,
            totalCount: room.total,
            passRatePct: room.pendingGrading || room.total === 0
                ? 0
                : Math.round((room.pass / room.total) * 1000) / 10,
            ...(room.subjectGroup && room.subjectGroup !== "—"
                ? { subjectGroup: room.subjectGroup }
                : {}),
            ...(room.subjectGroupId ? { subjectGroupId: room.subjectGroupId } : {}),
            ...(room.subSubjectGroup && room.subSubjectGroup !== "—"
                ? { subSubjectGroup: room.subSubjectGroup }
                : {}),
            ...(room.pendingGrading ? { pendingGrading: true } : {}),
        }))
            .sort((a, b) => {
            if (!!a.pendingGrading !== !!b.pendingGrading)
                return a.pendingGrading ? -1 : 1;
            return (b.passRatePct - a.passRatePct
                || a.gradeLevel.localeCompare(b.gradeLevel, "th", { numeric: true })
                || a.className.localeCompare(b.className, "th")
                || a.subjectName.localeCompare(b.subjectName, "th"));
        });
        return {
            rank: 0,
            teacherId: t.teacherId,
            teacherName: t.teacherName,
            teacherPhotoURL: t.teacherPhotoURL || "",
            passCount: t.pass,
            failCount: t.total - t.pass,
            totalCount: t.total,
            passRatePct: t.total > 0 ? Math.round((t.pass / t.total) * 1000) / 10 : 0,
            avgPct: t.total > 0 ? Math.round((t.sumPct / t.total) * 10) / 10 : 0,
            rooms: roomsList,
        };
    })
        .sort((a, b) => {
        if (a.totalCount === 0 && b.totalCount > 0)
            return 1;
        if (b.totalCount === 0 && a.totalCount > 0)
            return -1;
        if (a.totalCount === 0 && b.totalCount === 0) {
            return a.teacherName.localeCompare(b.teacherName, "th");
        }
        return (b.passRatePct - a.passRatePct
            || b.avgPct - a.avgPct
            || b.totalCount - a.totalCount
            || a.teacherName.localeCompare(b.teacherName, "th"));
    })
        .map((t, i) => ({ ...t, rank: i + 1 }));
    const payload = {
        id,
        examType,
        academicYearId,
        semester,
        updatedAt: Date.now(),
        kpi: {
            overallAveragePct: avg(pcts),
            passRatePct: pcts.length > 0 ? Math.round((passCount / pcts.length) * 1000) / 10 : 0,
            failRatePct: pcts.length > 0 ? Math.round((failCount / pcts.length) * 1000) / 10 : 0,
            gradingProgressPct: rooms.length > 0 ? Math.round((roomsGraded / rooms.length) * 1000) / 10 : 0,
            roomsTotal: rooms.length,
            roomsGraded,
            studentScoreCount: pcts.length,
        },
        topSubjects,
        bottomSubjects,
        byGradeLevel,
        distribution,
        atRiskClasses,
        unlinkedRooms: unlinkedRooms.sort((a, b) => a.gradeLevel.localeCompare(b.gradeLevel, "th", { numeric: true })
            || a.className.localeCompare(b.className, "th")
            || a.subjectName.localeCompare(b.subjectName, "th")),
        teacherPassRanking,
    };
    await db.collection("academic_stats").doc(id).set(payload);
    await writeClassMidtermReports({ academicYearId, semester, examType, classReports });
    return { id, studentScoreCount: pcts.length };
}
exports.rebuildAcademicStatsDoc = rebuildAcademicStatsDoc;
exports.rebuildAcademicStats = (0, https_1.onCall)({ region: callableOptions_1.CALLABLE_REGION, cors: callableOptions_1.CALLABLE_CORS, timeoutSeconds: 300, memory: "1GiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "ต้องเข้าสู่ระบบ");
    const uid = request.auth.uid;
    const userSnap = await db.collection("users").doc(uid).get();
    const role = String(userSnap.data()?.role ?? "");
    const email = String(request.auth.token.email ?? "");
    if (role !== "admin" && role !== "sysadmin" && email !== "sysadmin@pmv.com") {
        throw new https_1.HttpsError("permission-denied", "เฉพาะผู้บริหาร");
    }
    const academicYearId = String(request.data?.academicYearId ?? "").trim();
    const semester = Number(request.data?.semester) === 2 ? 2 : 1;
    const examType = request.data?.examType === "final" ? "final" : "midterm";
    if (!academicYearId)
        throw new https_1.HttpsError("invalid-argument", "academicYearId required");
    const result = await rebuildAcademicStatsDoc({ academicYearId, semester, examType });
    return { ok: true, ...result };
});
/** When a midterm exam room closes or score-collection toggles → refresh stats. */
exports.onExamRoomAcademicStats = (0, firestore_1.onDocumentUpdated)({
    document: "exam_rooms/{roomId}",
    database: (0, getAdminFirestore_1.getFirestoreDatabaseId)(),
    region: callableOptions_1.CALLABLE_REGION,
    timeoutSeconds: 300,
    memory: "1GiB",
}, async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    const beforeSettings = (before.settings ?? {});
    const afterSettings = (after.settings ?? {});
    const statusChangedToClosed = before.status !== "closed" && after.status === "closed";
    const scoreLinkChanged = beforeSettings.scoreCollectionEnabled !== afterSettings.scoreCollectionEnabled
        || beforeSettings.scoreCollectionLinked !== afterSettings.scoreCollectionLinked
        || beforeSettings.scoreCollectionType !== afterSettings.scoreCollectionType;
    if (!statusChangedToClosed && !scoreLinkChanged)
        return;
    if (!isTargetRoom(after, "midterm") && !isTargetRoom(after, "final"))
        return;
    const academicYearId = String(after.academicYearId ?? "");
    const semester = Number(after.semester) === 2 ? 2 : 1;
    if (!academicYearId)
        return;
    const examType = afterSettings.scoreCollectionType === "final"
        || afterSettings.gradeBookScoreType === "final"
        ? "final"
        : "midterm";
    try {
        await rebuildAcademicStatsDoc({ academicYearId, semester, examType });
    }
    catch (err) {
        console.error("[onExamRoomAcademicStats] rebuild failed:", err);
    }
});
//# sourceMappingURL=rebuildAcademicStats.js.map