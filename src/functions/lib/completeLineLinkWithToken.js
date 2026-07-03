"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeLineLinkWithToken = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const getAdminFirestore_1 = require("./getAdminFirestore");
const lineUserLookup_1 = require("./lineUserLookup");
const REGION = "asia-southeast1";
const db = (0, getAdminFirestore_1.getAdminFirestore)();
class LinkFlowError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "LinkFlowError";
    }
}
function tsMillis(value) {
    if (!value)
        return 0;
    if (value instanceof admin.firestore.Timestamp)
        return value.toMillis();
    if (value instanceof Date)
        return value.getTime();
    if (typeof value === "object" && value !== null && "toMillis" in value) {
        const maybeToMillis = value.toMillis;
        if (typeof maybeToMillis === "function") {
            try {
                return maybeToMillis();
            }
            catch {
                return 0;
            }
        }
    }
    return 0;
}
/**
 * Gen2 callable — ต้องมี cors + invoker public หลังย้าย Firebase
 * (Gen1 preflight มักโดน IAM block → CORS error บน browser)
 */
exports.completeLineLinkWithToken = (0, https_1.onCall)({
    region: REGION,
    cors: [
        "https://pmv1-90180.web.app",
        "https://pmv1-90180.firebaseapp.com",
        "http://localhost:3000",
    ],
    invoker: "public",
}, async (request) => {
    try {
        if (!request.auth) {
            throw new https_1.HttpsError("unauthenticated", "Must be authenticated");
        }
        const token = typeof request.data?.token === "string" ? request.data.token.trim() : "";
        if (!/^[a-fA-F0-9]{24,128}$/.test(token)) {
            throw new https_1.HttpsError("invalid-argument", "Invalid link token");
        }
        const sessionRef = db.collection("line_link_sessions").doc(token);
        const userId = request.auth.uid;
        const now = Date.now();
        const databaseId = (0, getAdminFirestore_1.getFirestoreDatabaseId)();
        const sessionSnap = await sessionRef.get();
        if (!sessionSnap.exists) {
            console.warn("[completeLineLinkWithToken] session not found", {
                databaseId,
                projectId: process.env.GCLOUD_PROJECT,
                tokenPrefix: token.slice(0, 8),
            });
            throw new https_1.HttpsError("not-found", "Link session not found — กรุณาพิมพ์ PMV ใหม่ใน LINE");
        }
        const session = sessionSnap.data();
        const status = String(session.status || "pending");
        const resolvedLineUid = typeof session.lineUid === "string" ? session.lineUid.trim() : "";
        const usedBy = typeof session.usedBy === "string" ? session.usedBy.trim() : "";
        const expiresAtMs = tsMillis(session.expiresAt);
        if (!resolvedLineUid) {
            throw new https_1.HttpsError("failed-precondition", "Session missing lineUid");
        }
        if (status !== "pending") {
            if (status === "used" && usedBy === userId) {
                return { success: true, lineUid: resolvedLineUid };
            }
            throw new https_1.HttpsError("failed-precondition", "Link session already used");
        }
        if (expiresAtMs > 0 && now > expiresAtMs) {
            await sessionRef.update({
                status: "expired",
                expiredAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            throw new https_1.HttpsError("deadline-exceeded", "Link session expired");
        }
        const authEmailRaw = typeof request.auth.token.email === "string" ? request.auth.token.email.trim() : "";
        const authEmail = authEmailRaw.toLowerCase();
        const authName = typeof request.auth.token.name === "string" ? request.auth.token.name.trim() : "";
        const claimedRole = typeof request.auth.token.role === "string" ? request.auth.token.role.trim() : "";
        const resolvedRole = authEmail === lineUserLookup_1.SYSADMIN_EMAIL ? "sysadmin" : claimedRole;
        const duplicateUserRefs = [];
        if (authEmailRaw) {
            const emailMatches = await db.collection("users").where("email", "==", authEmailRaw).get();
            for (const docSnap of emailMatches.docs) {
                if (docSnap.id !== userId)
                    duplicateUserRefs.push(docSnap.ref);
            }
        }
        const lineUid = await db.runTransaction(async (tx) => {
            const freshSnap = await tx.get(sessionRef);
            if (!freshSnap.exists) {
                throw new LinkFlowError("not-found", "Link session not found");
            }
            const fresh = freshSnap.data();
            if (String(fresh.status || "pending") !== "pending") {
                if (String(fresh.status) === "used" && fresh.usedBy === userId) {
                    return resolvedLineUid;
                }
                throw new LinkFlowError("failed-precondition", "Link session already used");
            }
            const userRef = db.collection("users").doc(userId);
            const lineReqRef = db.collection("line_link_requests").doc(resolvedLineUid);
            const userPatch = {
                lineToken: resolvedLineUid,
                lineUid: resolvedLineUid,
                lineLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                authUid: userId,
            };
            if (authEmailRaw)
                userPatch.email = authEmailRaw;
            if (resolvedRole)
                userPatch.role = resolvedRole;
            if (authName)
                userPatch.displayName = authName;
            tx.set(userRef, userPatch, { merge: true });
            for (const ref of duplicateUserRefs) {
                tx.set(ref, {
                    lineToken: resolvedLineUid,
                    lineUid: resolvedLineUid,
                    lineLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            tx.set(lineReqRef, {
                lineUid: resolvedLineUid,
                userId,
                status: "linked",
                keyword: "PMV",
                linkedAt: admin.firestore.FieldValue.serverTimestamp(),
                linkedVia: "line_connect_token",
            }, { merge: true });
            tx.update(sessionRef, {
                status: "used",
                usedBy: userId,
                usedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return resolvedLineUid;
        });
        console.log("[completeLineLinkWithToken] linked", {
            databaseId,
            userId,
            lineUidPrefix: lineUid.slice(0, 8),
        });
        return { success: true, lineUid };
    }
    catch (err) {
        if (err instanceof LinkFlowError) {
            throw new https_1.HttpsError(err.code, err.message);
        }
        if (err instanceof https_1.HttpsError) {
            throw err;
        }
        console.error("[completeLineLinkWithToken] unexpected error", err);
        const detail = err instanceof Error ? err.message : String(err);
        throw new https_1.HttpsError("internal", detail || "Link failed");
    }
});
//# sourceMappingURL=completeLineLinkWithToken.js.map