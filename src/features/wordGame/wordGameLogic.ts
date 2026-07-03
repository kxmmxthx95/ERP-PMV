import type { LetterFeedback } from '@/types/wordGame';

/** Wordle-style letter feedback (client display; server is source of truth). */
export function scoreGuess(guess: string, secret: string): LetterFeedback[] {
  const g = guess.toLowerCase();
  const s = secret.toLowerCase();
  const result: LetterFeedback[] = Array(g.length).fill('absent');
  const secretChars = s.split('');

  for (let i = 0; i < g.length; i += 1) {
    if (g[i] === s[i]) {
      result[i] = 'correct';
      secretChars[i] = '';
    }
  }

  for (let i = 0; i < g.length; i += 1) {
    if (result[i] === 'correct') continue;
    const idx = secretChars.indexOf(g[i]);
    if (idx !== -1) {
      result[i] = 'present';
      secretChars[idx] = '';
    }
  }

  return result;
}

export function isValidGuess(word: string): boolean {
  return /^[a-zA-Z]{5}$/.test(word.trim());
}

export function feedbackToKey(feedback: LetterFeedback[]): string {
  return feedback.map((f) => (f === 'correct' ? '2' : f === 'present' ? '1' : '0')).join('');
}

export function keyToFeedback(key: string): LetterFeedback[] {
  return key.split('').map((c) => {
    if (c === '2') return 'correct';
    if (c === '1') return 'present';
    return 'absent';
  });
}

export const FEEDBACK_STYLES: Record<LetterFeedback, string> = {
  correct: 'bg-emerald-500 border-emerald-600 text-white',
  present: 'bg-amber-400 border-amber-500 text-white',
  absent: 'bg-slate-300 border-slate-400 text-slate-700',
};
