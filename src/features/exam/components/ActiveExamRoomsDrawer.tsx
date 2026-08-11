import { HiChevronRight, HiXMark } from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  DRAWER_HEADER_ICON_BTN,
  DRAWER_HEADER_RIGHT_ACTIONS,
} from '@/lib/drawerHeaderBtn';
import { cn } from '@/lib/utils';
import type { ExamRoom } from '@/types/exam';

const DRAWER_CONTENT_CLASS = cn(
  'h-dvh flex flex-col p-0 rounded-none bg-white/95 backdrop-blur-xl',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:rounded-l-3xl',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
);

type Props = {
  open: boolean;
  onClose: () => void;
  rooms: ExamRoom[];
  onSelectRoom: (room: ExamRoom) => void;
};

function LiveDot() {
  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0" aria-hidden>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
    </span>
  );
}

export default function ActiveExamRoomsDrawer({
  open,
  onClose,
  rooms,
  onSelectRoom,
}: Props) {
  const sorted = [...rooms].sort((a, b) => (b.startTime ?? b.createdAt ?? 0) - (a.startTime ?? a.createdAt ?? 0));

  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) onClose(); }} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <div className="flex h-full min-h-0 flex-col">
          <DrawerHeader className="shrink-0 border-b border-slate-100 px-5 pb-3 pt-5">
            <div className="relative flex min-h-10 items-center justify-center">
              <div className="min-w-0 flex-1 pr-12 text-left">
                <DrawerTitle className="flex items-center gap-2 text-[15px] font-black font-sukhumvit text-slate-800">
                  <LiveDot />
                  ห้องสอบที่กำลังเปิดอยู่
                </DrawerTitle>
                <DrawerDescription className="mt-0.5 text-[11px] font-bold text-slate-500 font-sukhumvit">
                  {sorted.length > 0
                    ? `${sorted.length} ห้องกำลังเปิดสอบ`
                    : 'ยังไม่มีห้องสอบที่เปิดอยู่'}
                </DrawerDescription>
              </div>
              <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                <button
                  type="button"
                  onClick={onClose}
                  className={DRAWER_HEADER_ICON_BTN}
                  aria-label="ปิด"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              </div>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 scrollbar-hide">
            {sorted.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-12 text-center text-[13px] font-sarabun text-muted-foreground">
                ยังไม่มีห้องสอบที่กำลังเปิดอยู่
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {sorted.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => {
                      onSelectRoom(room);
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-3 text-left transition-colors hover:bg-emerald-50"
                  >
                    <LiveDot />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-black text-foreground font-sukhumvit">
                        {room.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] font-bold text-muted-foreground font-sukhumvit">
                        {[room.teacherName, room.className || room.gradeLevel, room.subjectName]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                        {' · '}
                        รอบ {room.currentRound ?? 1}
                      </span>
                    </span>
                    <HiChevronRight className="h-4 w-4 shrink-0 text-emerald-600" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
