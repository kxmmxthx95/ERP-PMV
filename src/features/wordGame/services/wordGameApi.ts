import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export async function createWordGameRoom(displayName: string): Promise<string> {
  const fn = httpsCallable<{ displayName: string }, { roomCode: string }>(functions, 'wordGameCreateRoom');
  const res = await fn({ displayName });
  return res.data.roomCode;
}

export async function joinWordGameRoom(roomCode: string, displayName: string): Promise<void> {
  const fn = httpsCallable<{ roomCode: string; displayName: string }, { roomCode: string }>(
    functions,
    'wordGameJoinRoom',
  );
  await fn({ roomCode: roomCode.toUpperCase(), displayName });
}

export async function startWordGame(roomCode: string): Promise<void> {
  const fn = httpsCallable<{ roomCode: string }, { started: boolean }>(functions, 'wordGameStart');
  await fn({ roomCode: roomCode.toUpperCase() });
}

export async function submitWordGameGuess(
  roomCode: string,
  guess: string,
): Promise<{ feedback: string; isWin: boolean; finished: boolean }> {
  const fn = httpsCallable<
    { roomCode: string; guess: string },
    { feedback: string; isWin: boolean; finished: boolean }
  >(functions, 'wordGameSubmitGuess');
  const res = await fn({ roomCode: roomCode.toUpperCase(), guess: guess.toLowerCase() });
  return res.data;
}

export async function leaveWordGameRoom(roomCode: string): Promise<void> {
  const fn = httpsCallable<{ roomCode: string }, { left: boolean }>(functions, 'wordGameLeaveRoom');
  await fn({ roomCode: roomCode.toUpperCase() });
}
