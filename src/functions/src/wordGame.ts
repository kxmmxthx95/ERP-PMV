import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

const REGION = "asia-southeast1";
const MAX_PLAYERS = 6;
const MAX_TURNS_PER_PLAYER = 6;

type LetterFeedback = "correct" | "present" | "absent";

type WordGameStatus = "lobby" | "playing" | "finished";

const FALLBACK_WORDS = [
  "apple", "brain", "chair", "dream", "eagle", "flame", "grape", "heart",
  "ivory", "jolly", "kneel", "lemon", "magic", "night", "ocean", "piano",
  "queen", "river", "storm", "tiger", "uncle", "vivid", "whale", "youth", "zebra",
];

function requireAuth(context: functions.https.CallableContext): string {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "ต้องเข้าสู่ระบบก่อน");
  }
  return context.auth.uid;
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seed = admin.firestore().collection("_").doc().id;
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[seed.charCodeAt(i % seed.length) % chars.length];
  }
  return code;
}

async function fetchRandomWord(): Promise<string> {
  try {
    const res = await fetch("https://random-word-api.herokuapp.com/word?length=5");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as string[];
    const word = String(json[0] ?? "").trim().toLowerCase();
    if (/^[a-z]{5}$/.test(word)) return word;
  } catch (err) {
    functions.logger.warn("random-word-api failed, using fallback", err);
  }
  return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
}

function scoreGuess(guess: string, secret: string): LetterFeedback[] {
  const g = guess.toLowerCase();
  const s = secret.toLowerCase();
  const result: LetterFeedback[] = Array(g.length).fill("absent");
  const secretChars = s.split("");

  for (let i = 0; i < g.length; i += 1) {
    if (g[i] === s[i]) {
      result[i] = "correct";
      secretChars[i] = "";
    }
  }

  for (let i = 0; i < g.length; i += 1) {
    if (result[i] === "correct") continue;
    const idx = secretChars.indexOf(g[i]);
    if (idx !== -1) {
      result[i] = "present";
      secretChars[idx] = "";
    }
  }

  return result;
}

function feedbackKey(feedback: LetterFeedback[]): string {
  return feedback.map((f) => (f === "correct" ? "2" : f === "present" ? "1" : "0")).join("");
}

function roomRef(roomCode: string) {
  return admin.database().ref(`wordGames/${roomCode}`);
}

async function getRoomSnapshot(roomCode: string) {
  const snap = await roomRef(roomCode).once("value");
  if (!snap.exists()) {
    throw new functions.https.HttpsError("not-found", "ไม่พบห้องเกม");
  }
  return snap.val() as Record<string, unknown>;
}

function getPlayerIds(players: Record<string, unknown> | undefined): string[] {
  if (!players) return [];
  return Object.keys(players);
}

function sortPlayerIds(
  playerIds: string[],
  players: Record<string, { joinedAt?: number }>,
): string[] {
  return [...playerIds].sort(
    (a, b) => Number(players[a]?.joinedAt ?? 0) - Number(players[b]?.joinedAt ?? 0),
  );
}

function findNextPlayer(
  playerIds: string[],
  players: Record<string, { guessCount?: number; joinedAt?: number }>,
  fromIdx: number,
): string | null {
  const ordered = sortPlayerIds(playerIds, players);
  const startIdx = ordered.indexOf(playerIds[fromIdx]) >= 0
    ? ordered.indexOf(playerIds[fromIdx])
    : 0;

  for (let step = 1; step <= ordered.length; step += 1) {
    const candidate = ordered[(startIdx + step) % ordered.length];
    if (Number(players[candidate]?.guessCount ?? 0) < MAX_TURNS_PER_PLAYER) {
      return candidate;
    }
  }
  return null;
}

export const wordGameCreateRoom = functions
  .region(REGION)
  .https.onCall(async (data: { displayName?: string }, context) => {
    const uid = requireAuth(context);
    const displayName = String(data?.displayName ?? "ผู้เล่น").trim().slice(0, 40) || "ผู้เล่น";

    let roomCode = "";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = generateRoomCode();
      const existing = await roomRef(candidate).once("value");
      if (!existing.exists()) {
        roomCode = candidate;
        break;
      }
    }
    if (!roomCode) {
      throw new functions.https.HttpsError("resource-exhausted", "สร้างห้องไม่สำเร็จ ลองใหม่");
    }

    const now = Date.now();
    await roomRef(roomCode).set({
      meta: {
        hostId: uid,
        hostName: displayName,
        status: "lobby" as WordGameStatus,
        createdAt: now,
        maxPlayers: MAX_PLAYERS,
      },
      players: {
        [uid]: {
          name: displayName,
          joinedAt: now,
          guessCount: 0,
        },
      },
    });

    return { roomCode };
  });

export const wordGameJoinRoom = functions
  .region(REGION)
  .https.onCall(async (data: { roomCode?: string; displayName?: string }, context) => {
    const uid = requireAuth(context);
    const roomCode = String(data?.roomCode ?? "").trim().toUpperCase();
    const displayName = String(data?.displayName ?? "ผู้เล่น").trim().slice(0, 40) || "ผู้เล่น";

    if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
      throw new functions.https.HttpsError("invalid-argument", "รหัสห้องไม่ถูกต้อง");
    }

    const room = await getRoomSnapshot(roomCode);
    const meta = room.meta as { status?: WordGameStatus; maxPlayers?: number };
    if (meta.status !== "lobby") {
      throw new functions.https.HttpsError("failed-precondition", "เกมเริ่มแล้ว ไม่สามารถเข้าร่วมได้");
    }

    const players = (room.players ?? {}) as Record<string, unknown>;
    if (players[uid]) {
      return { roomCode, alreadyJoined: true };
    }

    const playerIds = getPlayerIds(players);
    const maxPlayers = Number(meta.maxPlayers ?? MAX_PLAYERS);
    if (playerIds.length >= maxPlayers) {
      throw new functions.https.HttpsError("resource-exhausted", "ห้องเต็มแล้ว");
    }

    await roomRef(roomCode).child(`players/${uid}`).set({
      name: displayName,
      joinedAt: Date.now(),
      guessCount: 0,
    });

    return { roomCode, alreadyJoined: false };
  });

export const wordGameStart = functions
  .region(REGION)
  .https.onCall(async (data: { roomCode?: string }, context) => {
    const uid = requireAuth(context);
    const roomCode = String(data?.roomCode ?? "").trim().toUpperCase();
    const room = await getRoomSnapshot(roomCode);
    const meta = room.meta as { hostId?: string; status?: WordGameStatus };

    if (meta.hostId !== uid) {
      throw new functions.https.HttpsError("permission-denied", "เฉพาะเจ้าของห้องเท่านั้นที่เริ่มเกมได้");
    }
    if (meta.status !== "lobby") {
      throw new functions.https.HttpsError("failed-precondition", "เกมเริ่มแล้ว");
    }

    const players = room.players as Record<string, { joinedAt?: number }>;
    const playerIds = getPlayerIds(players);
    if (playerIds.length < 2) {
      throw new functions.https.HttpsError("failed-precondition", "ต้องมีผู้เล่นอย่างน้อย 2 คน");
    }

    const secretWord = await fetchRandomWord();
    const ordered = sortPlayerIds(playerIds, players);
    const firstPlayerId = ordered[0];

    await roomRef(roomCode).update({
      "meta/status": "playing",
      "secret/word": secretWord,
      turn: {
        currentPlayerId: firstPlayerId,
        turnNumber: 1,
      },
    });

    return { roomCode, started: true };
  });

export const wordGameSubmitGuess = functions
  .region(REGION)
  .https.onCall(async (data: { roomCode?: string; guess?: string }, context) => {
    const uid = requireAuth(context);
    const roomCode = String(data?.roomCode ?? "").trim().toUpperCase();
    const guess = String(data?.guess ?? "").trim().toLowerCase();

    if (!/^[a-z]{5}$/.test(guess)) {
      throw new functions.https.HttpsError("invalid-argument", "ต้องทายคำภาษาอังกฤษ 5 ตัวอักษร");
    }

    const snap = await roomRef(roomCode).once("value");
    if (!snap.exists()) {
      throw new functions.https.HttpsError("not-found", "ไม่พบห้องเกม");
    }

    const room = snap.val() as Record<string, unknown>;
    const meta = room.meta as { status?: WordGameStatus };
    if (meta.status !== "playing") {
      throw new functions.https.HttpsError("failed-precondition", "เกมยังไม่เริ่มหรือจบแล้ว");
    }

    const turn = room.turn as { currentPlayerId?: string; turnNumber?: number };
    if (turn.currentPlayerId !== uid) {
      throw new functions.https.HttpsError("failed-precondition", "ยังไม่ถึงตาคุณ");
    }

    const players = room.players as Record<string, { name?: string; guessCount?: number; joinedAt?: number }>;
    if (!players[uid]) {
      throw new functions.https.HttpsError("permission-denied", "คุณไม่ได้อยู่ในห้องนี้");
    }

    const secretWord = String((room.secret as { word?: string } | undefined)?.word ?? "").toLowerCase();
    if (!/^[a-z]{5}$/.test(secretWord)) {
      throw new functions.https.HttpsError("internal", "คำปริศนาไม่พร้อม");
    }

    const feedback = scoreGuess(guess, secretWord);
    const isWin = guess === secretWord;
    const playerName = String(players[uid].name ?? "ผู้เล่น");
    const guessCount = Number(players[uid].guessCount ?? 0) + 1;

    const guessRef = roomRef(roomCode).child("guesses").push();
    await guessRef.set({
      playerId: uid,
      playerName,
      word: guess,
      feedback: feedbackKey(feedback),
      isWin,
      at: admin.database.ServerValue.TIMESTAMP,
    });

    const updates: Record<string, unknown> = {
      [`players/${uid}/guessCount`]: guessCount,
    };

    if (isWin) {
      updates["meta/status"] = "finished";
      updates.result = {
        winnerId: uid,
        winnerName: playerName,
        secretWord,
        reason: "win",
      };
    } else if (guessCount >= MAX_TURNS_PER_PLAYER) {
      const playerIds = getPlayerIds(players);
      const currentIdx = playerIds.indexOf(uid);
      const nextPlayer = findNextPlayer(playerIds, { ...players, [uid]: { ...players[uid], guessCount } }, currentIdx);
      if (!nextPlayer) {
        updates["meta/status"] = "finished";
        updates.result = { secretWord, reason: "max_rounds" };
      } else {
        updates.turn = {
          currentPlayerId: nextPlayer,
          turnNumber: Number(turn.turnNumber ?? 1) + 1,
        };
      }
    } else {
      const playerIds = getPlayerIds(players);
      const currentIdx = playerIds.indexOf(uid);
      const nextPlayer = findNextPlayer(playerIds, { ...players, [uid]: { ...players[uid], guessCount } }, currentIdx);
      if (!nextPlayer) {
        updates["meta/status"] = "finished";
        updates.result = { secretWord, reason: "max_rounds" };
      } else {
        updates.turn = {
          currentPlayerId: nextPlayer,
          turnNumber: Number(turn.turnNumber ?? 1) + 1,
        };
      }
    }

    await roomRef(roomCode).update(updates);

    return {
      feedback: feedbackKey(feedback),
      isWin,
      finished: updates["meta/status"] === "finished",
    };
  });

export const wordGameLeaveRoom = functions
  .region(REGION)
  .https.onCall(async (data: { roomCode?: string }, context) => {
    const uid = requireAuth(context);
    const roomCode = String(data?.roomCode ?? "").trim().toUpperCase();
    const snap = await roomRef(roomCode).once("value");
    if (!snap.exists()) return { left: true };

    const room = snap.val() as Record<string, unknown>;
    const meta = room.meta as { hostId?: string; status?: WordGameStatus };

    if (meta.status !== "lobby") {
      throw new functions.https.HttpsError("failed-precondition", "ไม่สามารถออกจากห้องระหว่างเล่นได้");
    }

    await roomRef(roomCode).child(`players/${uid}`).remove();

    const remainingSnap = await roomRef(roomCode).child("players").once("value");
    const remaining = getPlayerIds(remainingSnap.val() as Record<string, unknown>);
    if (remaining.length === 0) {
      await roomRef(roomCode).remove();
    } else if (meta.hostId === uid) {
      const newHost = remaining.sort()[0];
      const newHostName = String(
        (room.players as Record<string, { name?: string }>)[newHost]?.name ?? "ผู้เล่น",
      );
      await roomRef(roomCode).child("meta").update({ hostId: newHost, hostName: newHostName });
    }

    return { left: true };
  });
