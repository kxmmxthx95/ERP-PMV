import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import type { WordGameGuess, WordGameMeta, WordGamePlayer, WordGameResult, WordGameTurn } from '@/types/wordGame';
import { keyToFeedback } from '../wordGameLogic';

export interface ParsedWordGameGuess extends Omit<WordGameGuess, 'feedback'> {
  id: string;
  feedback: ReturnType<typeof keyToFeedback>;
}

export interface WordGameRoomState {
  meta: WordGameMeta | null;
  turn: WordGameTurn | null;
  players: Record<string, WordGamePlayer>;
  guesses: ParsedWordGameGuess[];
  result: WordGameResult | null;
  loading: boolean;
}

function parseGuesses(raw: Record<string, unknown> | null | undefined): ParsedWordGameGuess[] {
  if (!raw) return [];
  return Object.entries(raw)
    .map(([id, value]) => {
      const row = value as WordGameGuess & { feedback: string };
      return {
        id,
        playerId: row.playerId,
        playerName: row.playerName,
        word: row.word,
        feedback: keyToFeedback(String(row.feedback ?? '')),
        isWin: Boolean(row.isWin),
        at: Number(row.at ?? 0),
      };
    })
    .sort((a, b) => a.at - b.at);
}

export function useWordGameRoom(roomCode: string | null): WordGameRoomState {
  const [meta, setMeta] = useState<WordGameMeta | null>(null);
  const [turn, setTurn] = useState<WordGameTurn | null>(null);
  const [players, setPlayers] = useState<Record<string, WordGamePlayer>>({});
  const [guesses, setGuesses] = useState<ParsedWordGameGuess[]>([]);
  const [result, setResult] = useState<WordGameResult | null>(null);
  const [loading, setLoading] = useState(Boolean(roomCode));

  useEffect(() => {
    if (!roomCode) {
      setMeta(null);
      setTurn(null);
      setPlayers({});
      setGuesses([]);
      setResult(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const roomRef = ref(rtdb, `wordGames/${roomCode.toUpperCase()}`);
    const unsub = onValue(
      roomRef,
      (snap) => {
        if (!snap.exists()) {
          setMeta(null);
          setTurn(null);
          setPlayers({});
          setGuesses([]);
          setResult(null);
          setLoading(false);
          return;
        }

        const data = snap.val() as Record<string, unknown>;
        setMeta((data.meta as WordGameMeta) ?? null);
        setTurn((data.turn as WordGameTurn) ?? null);
        setPlayers((data.players as Record<string, WordGamePlayer>) ?? {});
        setGuesses(parseGuesses(data.guesses as Record<string, unknown>));
        setResult((data.result as WordGameResult) ?? null);
        setLoading(false);
      },
      () => setLoading(false),
    );

    return () => unsub();
  }, [roomCode]);

  return useMemo(
    () => ({ meta, turn, players, guesses, result, loading }),
    [meta, turn, players, guesses, result, loading],
  );
}
