"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processLineLinkRequest = void 0;
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const firestore_1 = require("firebase-admin/firestore");
const REGION = "asia-southeast1";
const DATABASE_ID = (process.env.FIRESTORE_DATABASE_ID ?? "").trim();
const db = DATABASE_ID && DATABASE_ID !== "(default)"
    ? (0, firestore_1.getFirestore)(DATABASE_ID)
    : (0, firestore_1.getFirestore)();
/**
 * Firestore trigger: เมื่อมี document ใหม่/อัพเดต ใน line_link_requests
 * → ลิงค์ LINE UID กับ user account
 */
exports.processLineLinkRequest = functions
    .region(REGION)
    .firestore.document("line_link_requests/{docId}")
    .onWrite(async (change, context) => {
    const docId = context.params.docId;
    const afterData = change.after.data();
    // หากลบ document ให้ skip
    if (!afterData) {
        console.log(`[processLineLinkRequest] ${docId} deleted, skipping`);
        return null;
    }
    const lineUid = afterData.lineUid || docId;
    const userId = afterData.userId;
    const status = afterData.status || "pending";
    console.log(`[processLineLinkRequest] ${docId}: lineUid=${lineUid}, userId=${userId}, status=${status}`);
    // หากยังไม่มี userId ให้รอ
    if (!userId) {
        console.log(`[processLineLinkRequest] ${docId}: no userId yet, waiting for admin to link`);
        return null;
    }
    // หากสถานะ linked แล้วให้ skip
    if (status === "linked") {
        console.log(`[processLineLinkRequest] ${docId}: already linked`);
        return null;
    }
    try {
        await db.collection("users").doc(userId).set({
            lineToken: lineUid,
            lineUid,
            lineLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log(`[processLineLinkRequest] ${docId}: linked userId ${userId} with lineToken ${lineUid}`);
        // อัพเดท line_link_requests/{docId} สถานะเป็น linked
        await change.after.ref.update({
            status: "linked",
            linkedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return null;
    }
    catch (error) {
        console.error(`[processLineLinkRequest] ${docId}: error linking`, error);
        await change.after.ref.update({
            status: "error",
            errorMessage: error instanceof Error ? error.message : "unknown error",
        });
        return null;
    }
});
//# sourceMappingURL=processLineLinkRequest.js.map