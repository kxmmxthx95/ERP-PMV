/** Shared LINE Messaging API push helper — used by sendLineReport and leave notifications. */

export function getLineChannelToken(): string {
  return (process.env.LINE_CHANNEL_TOKEN || "").trim();
}

export async function pushLineMessage(
  lineUid: string,
  text: string,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const https = await import("https");
  const body = JSON.stringify({
    to: lineUid,
    messages: [{ type: "text", text }],
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: "api.line.me",
        path: "/v2/bot/message/push",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
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
      },
    );
    req.on("error", (err) => {
      console.error(`[pushLineMessage] request error: ${err.message}`);
      resolve({ ok: false, error: err.message });
    });
    req.write(body);
    req.end();
  });
}
