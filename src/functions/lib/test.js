"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = void 0;
const functions = require("firebase-functions/v1");
const REGION = "asia-southeast1";
exports.healthCheck = functions
    .region(REGION)
    .https.onRequest((req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
//# sourceMappingURL=test.js.map