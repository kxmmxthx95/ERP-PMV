import { createContext, useContext, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';

type ExamShellContextValue = {
  hideNav: boolean;
  setHideNav: (hide: boolean) => void;
};

export const ExamShellContext = createContext<ExamShellContextValue | null>(null);

export function useExamShell(): ExamShellContextValue | null {
  return useContext(ExamShellContext);
}

export default function ExamLayout() {
  const [hideNav, setHideNav] = useState(false);
  const value = useMemo(() => ({ hideNav, setHideNav }), [hideNav]);

  return (
    <ExamShellContext.Provider value={value}>
      <Outlet />
    </ExamShellContext.Provider>
  );
}
