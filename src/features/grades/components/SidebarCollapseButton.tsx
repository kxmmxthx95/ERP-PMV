import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { HEADER_ICON_BTN } from '@/lib/headerIconBtn';
import { cn } from '@/lib/utils';

/** Desktop-only: collapse / expand GradeBook-style left sidebar (Reminders-style). */
export default function SidebarCollapseButton({
  collapsed,
  onToggle,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(HEADER_ICON_BTN, 'hidden h-7 w-7 border-0 bg-transparent shadow-none lg:inline-flex', className)}
      title={collapsed ? 'แสดงแถบด้านซ้าย' : 'ซ่อนแถบด้านซ้าย'}
      aria-label={collapsed ? 'แสดงแถบด้านซ้าย' : 'ซ่อนแถบด้านซ้าย'}
      aria-pressed={collapsed}
    >
      {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
    </button>
  );
}
