import { createContext, useContext, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ExamNavMenu, type ExamNavTab } from '@/features/exam/components/ExamNavCapsule';

type ExamShellContextValue = {
  hideNav: boolean;
  setHideNav: (hide: boolean) => void;
};

export const ExamShellContext = createContext<ExamShellContextValue | null>(null);

export function useExamShell(): ExamShellContextValue | null {
  return useContext(ExamShellContext);
}

function getActiveTab(pathname: string): ExamNavTab {
  return pathname.includes('/portal/exams/rooms') ? 'rooms' : 'dashboard';
}

export default function ExamLayout() {
  const { pathname } = useLocation();
  const [hideNav, setHideNav] = useState(false);
  const value = useMemo(() => ({ hideNav, setHideNav }), [hideNav]);

  return (
    <ExamShellContext.Provider value={value}>
      {!hideNav && <ExamNavMenu active={getActiveTab(pathname)} />}
      <div className="flex min-h-0 flex-col md:flex-1">
        <Outlet />
      </div>
    </ExamShellContext.Provider>
  );
}
