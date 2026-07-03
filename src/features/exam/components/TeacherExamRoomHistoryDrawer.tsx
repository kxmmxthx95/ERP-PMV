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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/features/profile/profileLayoutShared';
import {
  formatExamRoomStatus,
  formatExamRoomStatusColor,
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

type TeacherSummary = {
  teacherId: string;
  teacherName: string;
  teacherPhotoURL?: string;
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

type Props = {
  open: boolean;
  onClose: () => void;
  teacher: TeacherSummary | null;
  rooms: ExamRoom[];
};

export default function TeacherExamRoomHistoryDrawer({
  open,
  onClose,
  teacher,
  rooms,
}: Props) {
  const [page, setPage] = useState(1);

  const teacherRooms = useMemo(() => {
    if (!teacher) return [];
    const teacherId = teacher.teacherId.trim();
    return rooms
      .filter((room) => (room.teacherId?.trim() || 'unknown') === teacherId)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [rooms, teacher]);

  const totalPages = Math.max(1, Math.ceil(teacherRooms.length / ROOMS_PER_PAGE));

  useEffect(() => {
    setPage(1);
  }, [teacher?.teacherId, open]);

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const paginatedRooms = useMemo(() => {
    const start = (page - 1) * ROOMS_PER_PAGE;
    return teacherRooms.slice(start, start + ROOMS_PER_PAGE);
  }, [teacherRooms, page]);

  const rangeStart = teacherRooms.length === 0 ? 0 : (page - 1) * ROOMS_PER_PAGE + 1;
  const rangeEnd = Math.min(page * ROOMS_PER_PAGE, teacherRooms.length);

  return (
    <Drawer open={open} onOpenChange={(next) => !next && onClose()} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <div className="flex h-full min-h-0 flex-col">
          <DrawerHeader className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="size-12 shrink-0 border-2 border-white shadow-sm">
                  <AvatarImage src={teacher?.teacherPhotoURL} alt={teacher?.teacherName} />
                  <AvatarFallback className="bg-sky-100 text-sm font-black text-sky-700">
                    {getInitials(teacher?.teacherName ?? '?')}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 text-left">
                  <DrawerTitle className="truncate text-base font-black text-slate-900">
                    {teacher?.teacherName ?? 'ครูผู้สอน'}
                  </DrawerTitle>
                  <DrawerDescription className="text-xs font-semibold text-slate-500">
                    ประวัติการสร้างห้องสอบ {teacherRooms.length} ห้อง
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
            {teacherRooms.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm font-semibold text-slate-400">
                ยังไม่มีประวัติห้องสอบ
              </p>
            ) : (
              <div className="space-y-2">
                {paginatedRooms.map((room, index) => (
                  <div
                    key={room.id}
                    className="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-500">
                          ห้องที่ {teacherRooms.length - ((page - 1) * ROOMS_PER_PAGE + index)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm font-black text-slate-900">{room.title}</p>
                        <p className="mt-1 text-[11px] font-semibold text-slate-500">
                          {room.subjectName || 'ไม่ระบุวิชา'} · {resolveRoomGradeLabel(room)}
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

          {teacherRooms.length > 0 && totalPages > 1 && (
            <div className="shrink-0 border-t border-slate-100 px-5 py-3">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
                <p className="text-[11px] font-semibold text-slate-400">
                  แสดง {rangeStart}–{rangeEnd} จาก {teacherRooms.length} ห้อง
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
