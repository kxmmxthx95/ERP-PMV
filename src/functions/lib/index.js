"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserDeleted = exports.onUserRoleUpdated = exports.onUserApproved = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
/**
 * ฟังก์ชันที่จะทำงานเมื่อมี "ผู้ใช้งานใหม่" ถูกเพิ่มเข้าในคอลเลกชัน 'users'
 * (ซึ่งเกิดจากการกดอนุมัติในหน้า Pending Users)
 */
exports.onUserApproved = functions
    .region("asia-southeast1")
    .firestore
    .document("users/{userId}")
    .onCreate(async (snapshot, context) => {
    const userData = snapshot.data();
    const userId = context.params.userId;
    const role = userData.role;
    if (!role) {
        console.log(`User ${userId} has no role. Skipping custom claims.`);
        return null;
    }
    try {
        // ตั้งค่า Custom Claims ใน Firebase Auth
        await admin.auth().setCustomUserClaims(userId, { role: role });
        console.log(`Successfully set custom claim 'role: ${role}' for user ${userId}`);
        // บันทึกเวลาที่ตั้งค่าสำเร็จลงใน Firestore ด้วย (Optionally)
        return snapshot.ref.update({
            claimsSynced: true,
            claimsSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    catch (error) {
        console.error(`Error setting custom claims for user ${userId}:`, error);
        return null;
    }
});
/**
 * ฟังก์ชันสำหรับอัปเดต Role หากมีการเปลี่ยน Role ในภายหลังในหน้า Manage Users
 */
exports.onUserRoleUpdated = functions
    .region("asia-southeast1")
    .firestore
    .document("users/{userId}")
    .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const oldData = change.before.data();
    const userId = context.params.userId;
    // ถ้า Role ไม่เปลี่ยน ก็ไม่ต้องทำอะไร
    if (newData.role === oldData.role)
        return null;
    try {
        await admin.auth().setCustomUserClaims(userId, { role: newData.role });
        console.log(`Successfully updated custom claim for user ${userId} to role: ${newData.role}`);
        return null;
    }
    catch (error) {
        console.error(`Error updating custom claims for user ${userId}:`, error);
        return null;
    }
});
/**
 * ฟังก์ชันสำหรับลบข้อมูลใน Auth เมื่อ User ถูกลบออกจาก Firestore (Optional)
 */
exports.onUserDeleted = functions
    .region("asia-southeast1")
    .firestore
    .document("users/{userId}")
    .onDelete(async (_snapshot, context) => {
    const userId = context.params.userId;
    try {
        // หมายเหตุ: โดยปกติเราอาจจะไม่อยากลบ Auth ทันที เผื่อกู้คืน 
        // แต่ถ้าต้องการลบให้สะอวดก็เปิดตรงนี้ได้ครับ
        // await admin.auth().deleteUser(userId);
        console.log(`User document ${userId} deleted from Firestore. (Auth account remains unless manually deleted)`);
        return null;
    }
    catch (error) {
        console.error(`Error during user deletion cleanup for ${userId}:`, error);
        return null;
    }
});
//# sourceMappingURL=index.js.map