import { useEffect, useState } from 'react';
import { HiXMark } from 'react-icons/hi2';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { DRAWER_HEADER_ICON_BTN, DRAWER_HEADER_RIGHT_ACTIONS } from '@/lib/drawerHeaderBtn';
import { useAuth } from '@/hooks/useAuth';
import { resolveStudentByAuthUser } from '@/lib/resolveStudentProfile';
import { Skeleton } from '@/components/ui/skeleton';
import StudentQuickLeaveWidget from './StudentQuickLeaveWidget';

const AVATAR_BY_GENDER = {
  male: { normal: '/BOY/23.png', active: '/BOY/24.png' },
  female: { normal: '/cg1.png', active: '/cg2.png' },
} as const;

const DRAWER_CONTENT_CLASS = cn(
  'flex h-dvh max-h-dvh flex-col overflow-hidden bg-transparent p-0 before:hidden',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'sm:h-full sm:max-h-full sm:p-2.5',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-md',
);

const DRAWER_PANEL_CLASS = cn(
  'flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-white',
  'sm:rounded-4xl sm:border sm:border-slate-200/80 sm:shadow-2xl',
);

export default function StudentAvatarWidget() {
  const { user, userData } = useAuth();
  const [gender, setGender] = useState<'male' | 'female'>('female');
  const [showMenu, setShowMenu] = useState(false);
  const [showLeaveDrawer, setShowLeaveDrawer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGender() {
      if (!user?.uid) return;
      try {
        const student = await resolveStudentByAuthUser(user.uid, {
          studentCode: typeof userData?.studentCode === 'string' ? userData.studentCode : undefined,
          email: user.email ?? undefined,
        });
        if (student?.prefix === 'นาย' || student?.prefix === 'เด็กชาย') setGender('male');
        else if (student?.prefix === 'นางสาว' || student?.prefix === 'เด็กหญิง') setGender('female');
      } catch {
        // silent fail — keep default
      } finally {
        setLoading(false);
      }
    }
    void fetchGender();
  }, [user, userData?.studentCode]);

  const avatar = AVATAR_BY_GENDER[gender];

  if (loading) {
    return (
      <div className="flex items-end justify-center w-full h-full sm:h-[420px] overflow-hidden">
        <Skeleton className="h-[70%] aspect-[3/5] rounded-3xl bg-slate-200" />
      </div>
    );
  }

  return (
    <div className="relative flex items-end justify-center w-full h-full sm:h-[420px] overflow-hidden">
      <div className="absolute top-4 inset-x-0 z-20 flex flex-col items-center gap-1 px-4 text-center">
        <h1 className="pointer-events-none font-sukhumvit text-xl font-black text-slate-800">กดที่ตัวละคร</h1>
        <p className="pointer-events-none font-sukhumvit text-[13px] font-bold text-slate-500">เพื่อเข้าสู่ระบบการลาของโรงเรียน</p>
        {showMenu && (
          <button
            type="button"
            onClick={() => { setShowMenu(false); setShowLeaveDrawer(true); }}
            className="mt-2 rounded-full bg-rose-500 px-4 py-2 text-[13px] font-black text-white shadow-lg active:scale-95 transition-transform font-sukhumvit"
          >
            ยื่นคำขอลา
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => setShowMenu((v) => !v)}
        className="relative h-[70%] flex items-end select-none"
      >
        <img
          src={avatar.normal}
          alt="Avatar"
          draggable={false}
          className={cn(
            'h-full w-auto max-w-none object-contain transition-opacity duration-500',
            showMenu ? 'opacity-0' : 'opacity-100',
          )}
        />
        <img
          src={avatar.active}
          alt=""
          draggable={false}
          className={cn(
            'absolute inset-0 h-full w-auto max-w-none object-contain transition-opacity duration-500',
            showMenu ? 'opacity-100' : 'opacity-0',
          )}
        />
      </button>

      {showMenu && (
        <button
          type="button"
          className="fixed inset-0 z-10"
          aria-label="ปิดเมนู"
          onClick={() => setShowMenu(false)}
        />
      )}

      <Drawer open={showLeaveDrawer} onOpenChange={setShowLeaveDrawer} direction="right">
        <DrawerContent className={DRAWER_CONTENT_CLASS}>
          <div className={DRAWER_PANEL_CLASS}>
            <DrawerHeader className="shrink-0 border-b border-slate-100 px-5 pb-3 pt-5">
              <div className="relative flex min-h-10 items-center justify-start">
                <DrawerTitle className="font-sukhumvit text-[15px] font-black text-slate-800 text-left">
                  ยื่นคำขอลา
                </DrawerTitle>
                <div className={DRAWER_HEADER_RIGHT_ACTIONS}>
                  <button
                    type="button"
                    onClick={() => setShowLeaveDrawer(false)}
                    className={DRAWER_HEADER_ICON_BTN}
                    aria-label="ปิด"
                  >
                    <HiXMark size={16} />
                  </button>
                </div>
              </div>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scrollbar-hide">
              <StudentQuickLeaveWidget defaultView="form" />
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
