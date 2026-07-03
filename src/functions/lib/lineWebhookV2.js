"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lineWebhookV2 = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
const getAdminFirestore_1 = require("./getAdminFirestore");
const REGION = "asia-southeast1";
const LINK_KEYWORD = "PMV";
const LEGACY_LINK_KEYWORD = "PMV-LINK";
const LINK_SESSION_TTL_MINUTES = 10;
const db = (0, getAdminFirestore_1.getAdminFirestore)();
function getLineSecret() {
    return process.env.LINE_CHANNEL_SECRET || "";
}
function getLineToken() {
    return process.env.LINE_CHANNEL_TOKEN || "";
}
function verifySignature(body, signature, secret) {
    const hash = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("base64");
    return hash === signature;
}
function getLineConnectBaseUrl() {
    const explicit = (process.env.LINE_LINK_CONNECT_URL || "").trim();
    if (explicit)
        return explicit;
    const projectId = (process.env.GCLOUD_PROJECT || "").trim();
    if (projectId)
        return `https://${projectId}.web.app/line/connect`;
    return "https://example.com/line/connect";
}
function buildLineConnectUrl(token) {
    const base = getLineConnectBaseUrl();
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}token=${encodeURIComponent(token)}`;
}
async function createLinkSession(lineUid) {
    const token = crypto.randomBytes(24).toString("hex");
    const nowMs = Date.now();
    const expiresMs = nowMs + LINK_SESSION_TTL_MINUTES * 60 * 1000;
    await db.collection("line_link_sessions").doc(token).set({
        token,
        lineUid,
        status: "pending",
        keyword: LINK_KEYWORD,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(expiresMs),
        source: "line_webhook_v2",
        databaseId: (0, getAdminFirestore_1.getFirestoreDatabaseId)(),
    }, { merge: true });
    console.log("[lineWebhook] created link session", {
        databaseId: (0, getAdminFirestore_1.getFirestoreDatabaseId)(),
        tokenPrefix: token.slice(0, 8),
        lineUidPrefix: lineUid.slice(0, 8),
    });
    return token;
}
async function replyMessage(replyToken, text, token) {
    const https = await Promise.resolve().then(() => require("https"));
    const body = JSON.stringify({
        replyToken,
        messages: [{ type: "text", text }],
    });
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: "api.line.me",
            path: "/v2/bot/message/reply",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "Content-Length": Buffer.byteLength(body),
            },
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                const status = res.statusCode || 0;
                if (status >= 200 && status < 300) {
                    resolve();
                    return;
                }
                console.error(`[lineWebhook] reply failed: HTTP ${status}`, data);
                reject(new Error(`LINE reply failed: HTTP ${status} ${data}`));
            });
        });
        req.on("error", reject);
        req.write(body);
        req.end();
    });
}
/**
 * LINE Webhook — รับ POST จาก LINE Platform
 *
 * Flow:
 * 1. ผู้ใช้เพิ่มเพื่อน LINE OA → บันทึก lineUid ใน line_link_requests
 * 2. ผู้ใช้พิมพ์ "PMV" → แสดงสถานะและบันทึก UID
 * 3. Admin จับคู่ UID กับ users/{uid}.lineToken ใน ReportControlCenter
 */
exports.lineWebhookV2 = (0, https_1.onRequest)({ region: REGION }, async (req, res) => {
    console.log(`[lineWebhook] incoming request: method=${req.method} path=${req.path}`);
    // Health check for Cloud Run startup probe
    if (req.method === "GET") {
        res.status(200).json({ status: "healthy" });
        return;
    }
    if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
    }
    const secret = getLineSecret();
    const token = getLineToken();
    if (!secret || !token) {
        console.error("[lineWebhook] LINE_CHANNEL_SECRET or LINE_CHANNEL_TOKEN not configured");
        res.status(500).send("Server configuration error");
        return;
    }
    // Verify LINE signature
    const signature = req.headers["x-line-signature"];
    const rawBody = req.rawBody?.toString("utf8") ?? JSON.stringify(req.body);
    if (!signature || !verifySignature(rawBody, signature, secret)) {
        console.warn("[lineWebhook] Invalid signature");
        res.status(401).send("Unauthorized");
        return;
    }
    const body = req.body;
    const events = body.events || [];
    for (const event of events) {
        const lineUid = event.source?.userId;
        if (!lineUid)
            continue;
        // ── follow event: ผู้ใช้เพิ่มเพื่อน ──────────────────────────────────
        if (event.type === "follow") {
            await db.collection("line_link_requests").doc(lineUid).set({
                lineUid,
                keyword: LINK_KEYWORD,
                followedAt: admin.firestore.FieldValue.serverTimestamp(),
                linkedAt: admin.firestore.FieldValue.serverTimestamp(),
                status: "pending",
            }, { merge: true });
            if (event.replyToken) {
                await replyMessage(event.replyToken, `🎉 เพิ่มเพื่อนสำเร็จ!\n\nพิมพ์ "${LINK_KEYWORD}" เพื่อเชื่อมบัญชีกับระบบโรงเรียน`, token);
            }
            continue;
        }
        // ── message event ─────────────────────────────────────────────────────
        if (event.type === "message" && event.message?.type === "text") {
            const text = (event.message.text || "").trim().toUpperCase();
            const isLinkCommand = text === LINK_KEYWORD || text === LEGACY_LINK_KEYWORD;
            if (isLinkCommand) {
                // บันทึก link request ลง Firestore
                await db.collection("line_link_requests").doc(lineUid).set({
                    lineUid,
                    keyword: LINK_KEYWORD,
                    linkedAt: admin.firestore.FieldValue.serverTimestamp(),
                    status: "pending",
                }, { merge: true });
                // ตรวจว่ามี users ที่เชื่อม lineToken นี้แล้วหรือยัง
                const existingSnap = await db
                    .collection("users")
                    .where("lineToken", "==", lineUid)
                    .limit(1)
                    .get();
                if (!existingSnap.empty) {
                    const userData = existingSnap.docs[0].data();
                    const name = userData.name || userData.displayName || "คุณ";
                    if (event.replyToken) {
                        await replyMessage(event.replyToken, `✅ บัญชี LINE ของ ${name} เชื่อมต่อกับระบบแล้ว\n\nหากต้องการเปลี่ยนแปลง ติดต่อผู้ดูแลระบบ`, token);
                    }
                }
                else {
                    const linkToken = await createLinkSession(lineUid);
                    const connectUrl = buildLineConnectUrl(linkToken);
                    if (event.replyToken) {
                        await replyMessage(event.replyToken, `✅ รับคำสั่ง ${LINK_KEYWORD} แล้ว\n\nกดลิงก์เพื่อยืนยันบัญชีโรงเรียน:\n${connectUrl}\n\nลิงก์มีอายุ ${LINK_SESSION_TTL_MINUTES} นาที`, token);
                    }
                }
            }
        }
    }
    res.status(200).json({ status: "ok" });
});
//# sourceMappingURL=lineWebhookV2.js.map