"use strict";
/** Shared LINE Messaging API push helper — used by sendLineReport and leave notifications. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushLineMessage = exports.getLineChannelToken = void 0;
function getLineChannelToken() {
    return (process.env.LINE_CHANNEL_TOKEN || "").trim();
}
exports.getLineChannelToken = getLineChannelToken;
async function pushLineMessage(lineUid, text, token) {
    const https = await Promise.resolve().then(() => require("https"));
    const body = JSON.stringify({
        to: lineUid,
        messages: [{ type: "text", text }],
    });
    return new Promise((resolve) => {
        const req = https.request({
            hostname: "api.line.me",
            path: "/v2/bot/message/push",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                "Content-Length": Buffer.byteLength(body),
            },
        }, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                if (res.statusCode === 200) {
                    resolve({ ok: true });
                    return;
                }
                console.error(`[pushLineMessage] failed: HTTP ${res.statusCode}`, data);
                resolve({ ok: false, error: `HTTP ${res.statusCode}: ${data}` });
            });
        });
        req.on("error", (err) => {
            console.error(`[pushLineMessage] request error: ${err.message}`);
            resolve({ ok: false, error: err.message });
        });
        req.write(body);
        req.end();
    });
}
exports.pushLineMessage = pushLineMessage;
//# sourceMappingURL=linePush.js.map