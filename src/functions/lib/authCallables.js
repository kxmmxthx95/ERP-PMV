"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPasswordByNationalId = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const getAdminFirestore_1 = require("./getAdminFirestore");
const callableOptions_1 = require("./callableOptions");
const db = (0, getAdminFirestore_1.getAdminFirestore)();
const gen2Callable = {
    region: callableOptions_1.CALLABLE_REGION,
    cors: callableOptions_1.CALLABLE_CORS,
    invoker: "public",
};
function normalizeNationalId(value) {
    return typeof value === "string" ? value.replace(/\D/g, "") : "";
}
async function resolveAuthUidFromStudent(studentDoc) {
    const studentData = studentDoc.data();
    const studentId = studentDoc.id;
    const directCandidates = [
        typeof studentData.authUid === "string" ? studentData.authUid.trim() : "",
        typeof studentData.userId === "string" ? studentData.userId.trim() : "",
        studentId,
    ].filter(Boolean);
    for (const candidate of directCandidates) {
        const userSnap = await db.collection("users").doc(candidate).get();
        if (userSnap.exists) {
            const userData = userSnap.data() ?? {};
            const authUid = typeof userData.authUid === "string" && userData.authUid.trim()
                ? userData.authUid.trim()
                : typeof userData.uid === "string" && userData.uid.trim()
                    ? userData.uid.trim()
                    : candidate;
            return { authUid, userDocId: userSnap.id };
        }
    }
    const studentCode = typeof studentData.studentCode === "string" ? studentData.studentCode.trim() : "";
    if (studentCode) {
        const byCode = await db.collection("users").where("studentCode", "==", studentCode).limit(1).get();
        if (!byCode.empty) {
            const userDoc = byCode.docs[0];
            const userData = userDoc.data();
            const authUid = typeof userData.authUid === "string" && userData.authUid.trim()
                ? userData.authUid.trim()
                : typeof userData.uid === "string" && userData.uid.trim()
                    ? userData.uid.trim()
                    : userDoc.id;
            return { authUid, userDocId: userDoc.id };
        }
    }
    const email = typeof studentData.email === "string" ? studentData.email.trim().toLowerCase() : "";
    if (email) {
        const byEmail = await db.collection("users").where("email", "==", email).limit(1).get();
        if (!byEmail.empty) {
            const userDoc = byEmail.docs[0];
            const userData = userDoc.data();
            const authUid = typeof userData.authUid === "string" && userData.authUid.trim()
                ? userData.authUid.trim()
                : typeof userData.uid === "string" && userData.uid.trim()
                    ? userData.uid.trim()
                    : userDoc.id;
            return { authUid, userDocId: userDoc.id };
        }
    }
    const fallbackAuthUid = directCandidates[0] || studentId;
    return { authUid: fallbackAuthUid, userDocId: null };
}
exports.resetPasswordByNationalId = (0, https_1.onCall)(gen2Callable, async (request) => {
    const studentCode = typeof request.data?.studentCode === "string" ? request.data.studentCode.trim() : "";
    const nationalId = normalizeNationalId(request.data?.nationalId);
    const newPassword = typeof request.data?.newPassword === "string" ? request.data.newPassword : "";
    const confirmPassword = typeof request.data?.confirmPassword === "string" ? request.data.confirmPassword : "";
    if (!studentCode) {
        throw new https_1.HttpsError("invalid-argument", "กรุณากรอกรหัสนักเรียน");
    }
    if (nationalId.length !== 13) {
        throw new https_1.HttpsError("invalid-argument", "เลขบัตรประชาชนต้องครบ 13 หลัก");
    }
    if (newPassword.length < 6) {
        throw new https_1.HttpsError("invalid-argument", "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร");
    }
    if (newPassword !== confirmPassword) {
        throw new https_1.HttpsError("invalid-argument", "รหัสผ่านไม่ตรงกัน");
    }
    const studentSnap = await db
        .collection("students")
        .where("studentCode", "==", studentCode)
        .limit(2)
        .get();
    if (studentSnap.empty) {
        throw new https_1.HttpsError("not-found", "ไม่พบข้อมูลในระบบ กรุณาตรวจสอบรหัสนักเรียนและเลขบัตรประชาชน");
    }
    if (studentSnap.size > 1) {
        throw new https_1.HttpsError("failed-precondition", "พบข้อมูลซ้ำในระบบ กรุณาติดต่อผู้ดูแลระบบ");
    }
    const studentData = studentSnap.docs[0].data();
    const storedNationalId = normalizeNationalId(studentData.nationalId);
    if (storedNationalId !== nationalId) {
        throw new https_1.HttpsError("not-found", "ไม่พบข้อมูลในระบบ กรุณาตรวจสอบรหัสนักเรียนและเลขบัตรประชาชน");
    }
    const { authUid, userDocId } = await resolveAuthUidFromStudent(studentSnap.docs[0]);
    try {
        await admin.auth().updateUser(authUid, {
            password: newPassword,
            disabled: false,
        });
    }
    catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error
            ? String(error.code)
            : "";
        if (code === "auth/user-not-found") {
            throw new https_1.HttpsError("not-found", "ไม่พบบัญชีผู้ใช้ในระบบ กรุณาติดต่อผู้ดูแลระบบ");
        }
        throw new https_1.HttpsError("internal", "ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง");
    }
    if (userDocId) {
        await db.collection("users").doc(userDocId).set({
            mustChangePassword: false,
            lastPasswordChange: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    return { success: true };
});
//# sourceMappingURL=authCallables.js.map