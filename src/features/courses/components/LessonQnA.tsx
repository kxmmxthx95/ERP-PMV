/**
 * Phase 3 — LessonQnA
 *
 * Real-time Q&A comment section using Firebase onSnapshot.
 * The subscription is created once per (courseId, lessonId) pair and
 * cleaned up properly on unmount or when either ID changes.
 * No infinite loops: courseId and lessonId are primitive strings in
 * the dependency array, so the effect only re-runs when the lesson changes.
 */

import { useEffect, useRef, useState } from 'react';
import { HiOutlineChatBubbleLeftRight, HiPaperAirplane } from 'react-icons/hi2';
import { useLessonComments } from '../hooks/useLessonComments';
import { cn } from '@/lib/utils';

const ROLE_BADGE: Record<string, string> = {
  teacher: 'bg-blue-100 text-blue-700',
  admin: 'bg-purple-100 text-purple-700',
  sysadmin: 'bg-gray-200 text-gray-700',
  student: 'bg-emerald-100 text-emerald-700',
};

function formatTimestamp(ts: { seconds: number } | null): string {
  if (!ts) return '';
  return new Date(ts.seconds * 1000).toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  courseId: string;
  lessonId: string;
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

export function LessonQnA({ courseId, lessonId, currentUser }: Props) {
  const { comments, isLoading, postComment } = useLessonComments(courseId, lessonId);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new comments arrive.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setInput('');
    try {
      await postComment(text, currentUser);
    } catch (err) {
      console.error('[LessonQnA] postComment error:', err);
      setInput(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[320px]">
      {/* Comment list */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {isLoading && (
          <div className="flex items-center justify-center h-24 text-sm text-black/40">
            กำลังโหลดความคิดเห็น...
          </div>
        )}

        {!isLoading && comments.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-black/30">
            <HiOutlineChatBubbleLeftRight className="size-8" />
            <span className="text-sm">ยังไม่มีคำถาม — เป็นคนแรกที่ถาม!</span>
          </div>
        )}

        {comments.map((c) => {
          const isOwnMessage = c.authorId === currentUser.id;
          return (
            <div
              key={c.id}
              className={cn('flex gap-2.5', isOwnMessage ? 'flex-row-reverse' : 'flex-row')}
            >
              {/* Avatar */}
              <div className="shrink-0 size-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold select-none">
                {c.authorName.charAt(0).toUpperCase()}
              </div>

              {/* Bubble */}
              <div className={cn('max-w-[75%] space-y-1', isOwnMessage && 'items-end')}>
                <div
                  className={cn(
                    'flex items-center gap-1.5 text-xs',
                    isOwnMessage ? 'flex-row-reverse' : 'flex-row',
                  )}
                >
                  <span className="font-semibold text-black/70">{c.authorName}</span>
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                      ROLE_BADGE[c.authorRole] ?? 'bg-gray-100 text-gray-600',
                    )}
                  >
                    {c.authorRole === 'teacher' ? 'ครู' : c.authorRole === 'student' ? 'นักเรียน' : c.authorRole}
                  </span>
                  <span className="text-black/30">{formatTimestamp(c.createdAt as { seconds: number } | null)}</span>
                </div>
                <div
                  className={cn(
                    'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words',
                    isOwnMessage
                      ? 'bg-blue-600 text-white rounded-tr-sm'
                      : 'bg-black/5 text-black/80 rounded-tl-sm',
                  )}
                >
                  {c.content}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="mt-4 flex gap-2 items-end border-t border-black/8 pt-4">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ถามคำถามหรือแสดงความคิดเห็น… (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"
          rows={2}
          disabled={isSending}
          className="flex-1 resize-none rounded-xl border border-black/10 bg-black/3 px-3.5 py-2.5 text-sm text-black/80 placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all disabled:opacity-50"
        />
        <button
          onClick={() => void handleSend()}
          disabled={!input.trim() || isSending}
          className="shrink-0 h-10 w-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
          aria-label="ส่งความคิดเห็น"
        >
          <HiPaperAirplane className="size-4" />
        </button>
      </div>
    </div>
  );
}
