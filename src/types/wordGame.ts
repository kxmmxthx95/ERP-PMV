export type WordGameStatus = 'lobby' | 'playing' | 'finished';

export type LetterFeedback = 'correct' | 'present' | 'absent';

export interface WordGameMeta {
  hostId: string;
  hostName: string;
  status: WordGameStatus;
  createdAt: number;
  maxPlayers: number;
}

export interface WordGameTurn {
  currentPlayerId: string;
  turnNumber: number;
}

export interface WordGamePlayer {
  name: string;
  joinedAt: number;
  guessCount: number;
}

export interface WordGameGuess {
  playerId: string;
  playerName: string;
  word: string;
  feedback: LetterFeedback[];
  isWin: boolean;
  at: number;
}

export interface WordGameResult {
  winnerId?: string;
  winnerName?: string;
  secretWord?: string;
  reason?: 'win' | 'max_rounds';
}

export interface WordGameRoom {
  meta: WordGameMeta;
  turn?: WordGameTurn;
  players: Record<string, WordGamePlayer>;
  guesses: Record<string, WordGameGuess>;
  result?: WordGameResult;
}

export const MAX_PLAYERS = 6;
export const MAX_TURNS_PER_PLAYER = 6;
export const WORD_LENGTH = 5;
