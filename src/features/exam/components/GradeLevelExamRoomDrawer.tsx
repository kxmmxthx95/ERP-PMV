import { useEffect, useMemo, useState } from 'react';
import { HiChevronLeft, HiChevronRight, HiClock, HiXMark } from 'react-icons/hi2';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  formatExamRoomStatus,
  formatExamRoomStatusColor,
  resolveExamRoomGradeLevel,
} from '@/features/exam/utils/examDashboardStats';
import { cn } from '@/lib/utils';
import type { ExamRoom } from '@/types/exam';

const ROOMS_PER_PAGE = 10;

const DRAWER_CONTENT_CLASS = cn(
  'h-dvh flex flex-col p-0 rounded-none bg-white/95 backdrop-blur-xl',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:rounded-l-3xl',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
);

type GradeLevelSummary = {
  gradeLevel: string;
  color: string;
  bg: string;
  border: string;
  count: number;
};

function formatCreatedAt(value?: number): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveRoomGradeLabel(room: ExamRoom): string {
  if (room.className?.trim()) return room.className;
  if (room.gradeLevel?.trim()) return room.gradeLevel;
  return 'ไม่ระบุชั้นเรียน';
}

function matchRoomGradeLevel(room: ExamRoom, gradeLevel: string): boolean {
  const resolved = resolveExamRoomGradeLevel(room) || 'ไม่ระบุระดับชั้น';
  return resolved === gradeLevel;
}

type Props = {
  open: boolean;
  onClose: () => void;
  grade: GradeLevelSummary | null;
  rooms: ExamRoom[];
};

export default function GradeLevelExamRoomDrawer({
  open,
  onClose,
  grade,
  rooms,
}: Props) {
  const [page, setPage] = useState(1);

  const gradeRooms = useMemo(() => {
    if (!grade) return [];
    return rooms
      .filter((room) => matchRoomGradeLevel(room, grade.gradeLevel))
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [rooms, grade]);

  const totalPages = Math.max(1, Math.ceil(gradeRooms.length / ROOMS_PER_PAGE));

  useEffect(() => {
    setPage(1);
  }, [grade?.gradeLevel, open]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const paginatedRooms = useMemo(() => {
    const start = (page - 1) * ROOMS_PER_PAGE;
    return gradeRooms.slice(start, start + ROOMS_PER_PAGE);
  }, [gradeRooms, page]);

  const rangeStart = gradeRooms.length === 0 ? 0 : (page - 1) * ROOMS_PER_PAGE + 1;
  const rangeEnd = Math.min(page * ROOMS_PER_PAGE, gradeRooms.length);

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <div className="flex h-full min-h-0 flex-col">
          <DrawerHeader className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl border text-base font-black shadow-sm"
                  style={{
                    color: grade?.color,
                    borderColor: grade?.border,
                    backgroundColor: grade?.bg ?? 'rgba(255,255,255,0.72)',
                  }}
                >
                  {grade?.gradeLevel === 'ไม่ระบุระดับชั้น' ? '?' : grade?.gradeLevel}
                </div>
                <div className="min-w-0 text-left">
                  <DrawerTitle className="truncate text-base font-black text-slate-900">
                    {grade?.gradeLevel ?? 'ระดับชั้น'}
                  </DrawerTitle>
                  <DrawerDescription className="text-xs font-semibold text-slate-500">
                    ห้องสอบระดับชั้นนี้ {gradeRooms.length} ห้อง
                  </DrawerDescription>
                </div>
              </div>
              <DrawerClose asChild>
                <button
                  type="button"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50"
                  aria-label="ปิด"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {gradeRooms.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-400">
                ยังไม่มีห้องสอบในระดับชั้นนี้
              </p>
            ) : (
              <div className="space-y-2">
                {paginatedRooms.map((room) => (
                  <div
                    key={room.id}
                    className="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-black text-slate-900">{room.title}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">
                          {room.subjectName || 'ไม่ระบุวิชา'} · {resolveRoomGradeLabel(room)}
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                          {room.teacherName || 'ไม่ระบุครูผู้สอน'}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black',
                          formatExamRoomStatusColor(room.status),
                        )}
                      >
                        {formatExamRoomStatus(room.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-400">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                        <HiClock className="h-3 w-3" />
                        สร้างเมื่อ {formatCreatedAt(room.createdAt)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                        {room.questionCount ?? 0} ข้อ
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                        ภาคเรียน {room.semester}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {gradeRooms.length > 0 && totalPages > 1 && (
            <div className="shrink-0 border-t border-slate-100 px-5 py-3">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                <p className="text-[11px] font-semibold text-slate-400">
                  แสดง {rangeStart}–{rangeEnd} จาก {gradeRooms.length} ห้อง
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <HiChevronLeft className="h-3.5 w-3.5" />
                    ก่อนหน้า
                  </button>
                  <span className="px-2 text-[11px] font-medium text-slate-400">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    className="flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    ถัดไป
                    <HiChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
