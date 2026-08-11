import { cn } from '@/lib/utils';

export type LeavePageTab = 'my' | 'team' | 'report' | 'settings';

export type LeavePageTabOption = {
  key: LeavePageTab;
  label: string;
};

interface LeavePageTabMenuProps {
  tabs: LeavePageTabOption[];
  pageTab: LeavePageTab;
  onTabChange: (tab: LeavePageTab) => void;
}

export default function LeavePageTabMenu({
  tabs,
  pageTab,
  onTabChange,
}: LeavePageTabMenuProps) {
  return (
    <div className="shrink-0 flex justify-center w-full overflow-x-auto scrollbar-hide">
      <div className="flex items-center rounded-full border border-white bg-white/60 p-1 shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        {tabs.map((tab) => {
          const isActive = pageTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-1.5 text-[11px] font-black sm:px-5',
                isActive
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-500 hover:bg-black/5 hover:text-slate-800',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
