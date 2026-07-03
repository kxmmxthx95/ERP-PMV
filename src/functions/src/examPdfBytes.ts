import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

const ALLOWED_PREFIX = "question_sets/pdfs/";

function parseStoragePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const path = raw.trim();
  if (!path.startsWith(ALLOWED_PREFIX)) return null;
  if (path.includes("..") || path.includes("\\")) return null;
  return path;
}

function extractFirebaseIdToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  if (authHeader.startsWith("Firebase ")) return authHeader.slice("Firebase ".length);
  if (authHeader.startsWith("Bearer ")) return authHeader.slice("Bearer ".length);
  return null;
}

export const examPdfBytes = functions
  .region("asia-southeast1")
  .runWith({ memory: "512MB", timeoutSeconds: 120 })
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "GET") {
      res.status(405).send("Method not allowed");
      return;
    }

    const authHeader = req.headers.authorization;
    const idToken = extractFirebaseIdToken(typeof authHeader === "string" ? authHeader : undefined);
    if (!idToken) {
      res.status(401).send("Unauthorized");
      return;
    }

    try {
      await admin.auth().verifyIdToken(idToken);
    } catch {
      res.status(401).send("Invalid token");
      return;
    }

    const storagePath = parseStoragePath(req.query.path);
    if (!storagePath) {
      res.status(400).send("Invalid path");
      return;
    }

    try {
      const bucket = admin.storage().bucket();
      const file = bucket.file(storagePath);
      const [exists] = await file.exists();
      if (!exists) {
        res.status(404).send("Not found");
        return;
      }

      res.set("Content-Type", "application/pdf");
      res.set("Cache-Control", "private, max-age=3600");
      file.createReadStream().pipe(res);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      functions.logger.error("examPdfBytes failed", message);
      res.status(500).send("Internal error");
    }
  });
