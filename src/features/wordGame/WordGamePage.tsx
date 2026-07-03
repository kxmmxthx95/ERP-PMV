import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HiArrowLeft, HiPlay, HiPlus, HiUsers } from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { GLASS } from '@/components/layouts/PortalLayout';
import { cn } from '@/lib/utils';
import { MAX_TURNS_PER_PLAYER, WORD_LENGTH } from '@/types/wordGame';
import { useWordGameRoom } from './hooks/useWordGameRoom';
import {
  createWordGameRoom,
  joinWordGameRoom,
  leaveWordGameRoom,
  startWordGame,
  submitWordGameGuess,
} from './services/wordGameApi';
import { FEEDBACK_STYLES, isValidGuess } from './wordGameLogic';

function PageFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col w-full max-w-lg mx-auto min-h-[calc(100dvh-5.5rem)] sm:min-h-[calc(100dvh-4.75rem)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

function RoomHeader({
  roomCode,
  onBack,
  onLeave,
}: {
  roomCode: string;
  onBack: () => void;
  onLeave: () => void;
}) {
  return (
    <header className="shrink-0 flex items-center justify-between gap-2 pb-3">
      <button
        type="button"
        onClick={onBack}
        className="w-10 h-10 rounded-full border border-slate-200 bg-white/80 flex items-center justify-center text-slate-600 shadow-sm"
      >
        <HiArrowLeft className="w-5 h-5" />
      </button>
      <div className="text-center flex-1 min-w-0">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">รหัสห้อง</p>
        <p className="text-xl sm:text-2xl font-black tracking-[0.2em] text-violet-700">{roomCode}</p>
      </div>
      <button
        type="button"
        onClick={onLeave}
        className="text-xs font-bold text-slate-500 px-2 py-2 min-w-[2.5rem]"
      >
        ออก
      </button>
    </header>
  );
}

function GuessTiles({ word, feedback }: { word: string; feedback: Array<'correct' | 'present' | 'absent'> }) {
  return (
    <div className="flex gap-1.5">
      {word.split('').map((letter, i) => (
        <div
          key={`${word}-${i}`}
          className={cn(
            'w-9 h-9 rounded-lg border flex items-center justify-center text-sm font-black uppercase',
            FEEDBACK_STYLES[feedback[i] ?? 'absent'],
          )}
        >
          {letter}
        </div>
      ))}
    </div>
  );
}

export default function WordGamePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const userData = useAuthStore((s) => s.userData);

  const roomCodeParam = params.get('room')?.toUpperCase() ?? '';
  const [roomCode, setRoomCode] = useState(roomCodeParam);
  const [joinInput, setJoinInput] = useState('');
  const [guessInput, setGuessInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName =
    String(userData?.name ?? userData?.displayName ?? user?.displayName ?? 'ผู้เล่น').trim() || 'ผู้เล่น';

  const room = useWordGameRoom(roomCode || null);
  const uid = user?.uid ?? '';

  const playerList = useMemo(
    () =>
      Object.entries(room.players)
        .map(([id, p]) => ({ id, ...p }))
        .sort((a, b) => a.joinedAt - b.joinedAt),
    [room.players],
  );

  const isHost = room.meta?.hostId === uid;
  const isMyTurn = room.meta?.status === 'playing' && room.turn?.currentPlayerId === uid;
  const myGuessCount = room.players[uid]?.guessCount ?? 0;

  const setRoom = (code: string) => {
    const normalized = code.toUpperCase();
    setRoomCode(normalized);
    setParams(normalized ? { room: normalized } : {});
    setError(null);
  };

  const handleCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const code = await createWordGameRoom(displayName);
      setRoom(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สร้างห้องไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const doJoin = async (code: string) => {
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalized)) {
      setError('รหัสห้อง 6 ตัว');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await joinWordGameRoom(normalized, displayName);
      setRoom(normalized);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'เข้าห้องไม่สำเร็จ';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = () => void doJoin(joinInput);

  const handleStart = async () => {
    if (!roomCode) return;
    setBusy(true);
    setError(null);
    try {
      await startWordGame(roomCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เริ่มเกมไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleGuess = async () => {
    if (!roomCode || !isValidGuess(guessInput)) {
      setError(`กรอกคำภาษาอังกฤษ ${WORD_LENGTH} ตัวอักษร`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitWordGameGuess(roomCode, guessInput);
      setGuessInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ส่งคำตอบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!roomCode) return;
    setBusy(true);
    try {
      await leaveWordGameRoom(roomCode);
    } catch {
      // ignore if playing
    } finally {
      setBusy(false);
      setRoom('');
    }
  };

  if (!roomCode) {
    return (
      <PageFrame className="justify-center py-4">
        <div style={GLASS} className="rounded-2xl p-5 sm:p-6 space-y-4 w-full">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800">เกมทายคำ 5 ตัวอักษร</h1>
            <p className="text-sm text-slate-500 mt-1">
              Multiplayer แบบสลับตา · คำจาก{' '}
              <a
                href="https://random-word-api.herokuapp.com/word?length=5"
                className="text-blue-600 underline"
                target="_blank"
                rel="noreferrer"
              >
                Random Word API
              </a>
            </p>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleCreate()}
            className="w-full py-3.5 rounded-2xl bg-violet-600 text-white font-black flex items-center justify-center gap-2 hover:bg-violet-700 disabled:opacity-60"
          >
            <HiPlus className="w-5 h-5" />
            สร้างห้องใหม่
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white/90 px-3 text-xs text-slate-400 font-bold">หรือเข้ารหัสห้อง</span>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="รหัส 6 ตัว"
              className="flex-1 rounded-xl border border-slate-200 px-3 py-3 text-center font-black tracking-widest uppercase text-lg"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleJoin()}
              className="px-5 rounded-xl bg-slate-800 text-white font-black hover:bg-slate-900 disabled:opacity-60"
            >
              เข้าร่วม
            </button>
          </div>

          {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame>
      <RoomHeader
        roomCode={roomCode}
        onBack={() => navigate('/portal')}
        onLeave={() => void handleLeave()}
      />

      <div className="flex-1 flex flex-col min-h-0 gap-3">
      {room.loading && (
        <div style={GLASS} className="flex-1 rounded-2xl p-6 flex items-center justify-center text-sm text-slate-500 animate-pulse">
          กำลังโหลดห้อง...
        </div>
      )}

      {!room.loading && !room.meta && (
        <div style={GLASS} className="flex-1 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm font-bold text-slate-600">ไม่พบห้องหรือคุณยังไม่ได้เข้าร่วม</p>
          <button
            type="button"
            onClick={() => void doJoin(roomCode)}
            className="px-5 py-2.5 rounded-full bg-violet-600 text-white text-sm font-black"
          >
            เข้าร่วมห้องนี้
          </button>
        </div>
      )}

      {room.meta?.status === 'lobby' && (
        <div style={GLASS} className="flex-1 flex flex-col min-h-0 rounded-2xl p-5 gap-4">
          <div className="shrink-0 flex items-center gap-2">
            <HiUsers className="w-5 h-5 text-violet-600" />
            <h2 className="font-black text-slate-800">Lobby · รอผู้เล่น</h2>
            <span className="ml-auto text-xs font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
              {playerList.length}/{room.meta.maxPlayers}
            </span>
          </div>

          <ul className="flex-1 min-h-0 overflow-y-auto space-y-2">
            {playerList.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm"
              >
                <span className="font-bold text-slate-700">{p.name}</span>
                {p.id === room.meta?.hostId && (
                  <span className="text-[10px] font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                    HOST
                  </span>
                )}
              </li>
            ))}
          </ul>

          <div className="shrink-0 pt-1">
            {isHost ? (
              <button
                type="button"
                disabled={busy || playerList.length < 2}
                onClick={() => void handleStart()}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 text-white font-black flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-50"
              >
                <HiPlay className="w-5 h-5" />
                เริ่มเกม (ต้องมี ≥2 คน)
              </button>
            ) : (
              <p className="text-center text-sm text-slate-500 font-medium py-2">รอเจ้าของห้องเริ่มเกม...</p>
            )}
          </div>
        </div>
      )}

      {room.meta?.status === 'playing' && (
        <div style={GLASS} className="flex-1 flex flex-col min-h-0 rounded-2xl p-5 gap-4">
          <div className="shrink-0 rounded-xl bg-violet-50 border border-violet-100 px-3 py-2.5 text-center">
            {isMyTurn ? (
              <p className="text-sm font-black text-violet-700">ถึงตาคุณแล้ว! ทายคำ 5 ตัวอักษร</p>
            ) : (
              <p className="text-sm font-bold text-slate-600">
                ตาของ{' '}
                <span className="text-violet-700">
                  {room.players[room.turn?.currentPlayerId ?? '']?.name ?? 'ผู้เล่น'}
                </span>
              </p>
            )}
            <p className="text-[10px] text-slate-400 mt-0.5">
              คุณทายไปแล้ว {myGuessCount}/{MAX_TURNS_PER_PLAYER} ครั้ง
            </p>
          </div>

          {isMyTurn && myGuessCount < MAX_TURNS_PER_PLAYER && (
            <div className="shrink-0 flex gap-2">
              <input
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, WORD_LENGTH))}
                maxLength={WORD_LENGTH}
                placeholder="apple"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-3 text-center font-black uppercase tracking-widest text-lg"
              />
              <button
                type="button"
                disabled={busy || guessInput.length !== WORD_LENGTH}
                onClick={() => void handleGuess()}
                className="px-5 rounded-xl bg-violet-600 text-white font-black disabled:opacity-50"
              >
                ส่ง
              </button>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
            {room.guesses.length === 0 && (
              <p className="text-xs text-center text-slate-400 py-8">ยังไม่มีใครทาย — รอตาแรก</p>
            )}
            {room.guesses.map((g) => (
              <div key={g.id} className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400">{g.playerName}</p>
                <GuessTiles word={g.word} feedback={g.feedback} />
              </div>
            ))}
          </div>
        </div>
      )}

      {room.meta?.status === 'finished' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={GLASS}
          className="flex-1 flex flex-col justify-center rounded-2xl p-5 sm:p-6 space-y-4 text-center"
        >
          <h2 className="text-xl font-black text-slate-800">จบเกม!</h2>
          {room.result?.winnerName ? (
            <p className="text-sm text-emerald-700 font-bold">
              ผู้ชนะ: <span className="font-black">{room.result.winnerName}</span>
            </p>
          ) : (
            <p className="text-sm text-slate-600 font-medium">ไม่มีใครทายถูก — ครบรอบแล้ว</p>
          )}
          {room.result?.secretWord && (
            <p className="text-sm text-slate-500">
              คำปริศนา:{' '}
              <span className="font-black uppercase text-violet-700">{room.result.secretWord}</span>
            </p>
          )}
          <button
            type="button"
            onClick={() => setRoom('')}
            className="w-full py-3 rounded-full bg-slate-800 text-white text-sm font-black mt-2"
          >
            กลับหน้าหลักเกม
          </button>
        </motion.div>
      )}

        {error && <p className="shrink-0 text-sm font-bold text-rose-600 text-center pb-1">{error}</p>}
      </div>
    </PageFrame>
  );
}
