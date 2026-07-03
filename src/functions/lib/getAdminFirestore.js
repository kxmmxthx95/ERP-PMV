"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminFirestore = exports.getFirestoreDatabaseId = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
/** ต้องตรงกับ VITE_FIRESTORE_DATABASE_ID ในแอป (default: pmv1) */
const DEFAULT_DATABASE_ID = "pmv1";
let cachedDb = null;
function ensureAdminApp() {
    try {
        (0, app_1.getApp)();
    }
    catch {
        (0, app_1.initializeApp)();
    }
}
function getFirestoreDatabaseId() {
    const databaseId = (process.env.FIRESTORE_DATABASE_ID ?? DEFAULT_DATABASE_ID).trim();
    return databaseId && databaseId !== "(default)" ? databaseId : "(default)";
}
exports.getFirestoreDatabaseId = getFirestoreDatabaseId;
function getAdminFirestore() {
    if (cachedDb)
        return cachedDb;
    ensureAdminApp();
    const app = (0, app_1.getApp)();
    const databaseId = getFirestoreDatabaseId();
    cachedDb =
        databaseId !== "(default)"
            ? (0, firestore_1.getFirestore)(app, databaseId)
            : (0, firestore_1.getFirestore)(app);
    return cachedDb;
}
exports.getAdminFirestore = getAdminFirestore;
//# sourceMappingURL=getAdminFirestore.js.map