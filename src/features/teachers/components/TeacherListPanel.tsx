import { useState } from 'react';
import { Plus, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import React from 'react';
import type { TeacherProfile } from '@/types/teacher';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';

interface TeacherListPanelProps {
  teachers: TeacherProfile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}


const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

export default function TeacherListPanel({
  teachers,
  selectedId,
  onSelect,
  onAdd,
}: TeacherListPanelProps) {

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const totalPages = Math.ceil(teachers.length / ITEMS_PER_PAGE);
  const paginated = teachers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Handlers

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden" style={glassCard}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-black/05 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-black/80">รายชื่อครู</p>
          <p className="text-[11px] text-black/35 mt-0.5">{teachers.filter(t => t.status === 'active').length} คน (active)</p>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all shadow-sm"
          style={{ background: '#1e1e1e' }}
        >
          <Plus size={13} />
          เพิ่มครู
        </button>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-black/30">
            <p className="text-xs font-medium">ไม่พบรายชื่อครู</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.04]">
            {paginated.map(teacher => {
              const cfg = DEPARTMENT_CONFIG[teacher.department];
              const isSelected = selectedId === teacher.id;

              return (
                <li key={teacher.id}>
                  <button
                    onClick={() => onSelect(teacher.id)}
                    className="w-full text-left px-4 py-3 transition-colors hover:bg-black/[0.015]"
                    style={isSelected ? { background: 'rgba(0,0,0,0.035)' } : undefined}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="size-8 rounded-full shrink-0 mt-0.5" style={{ background: cfg.bg }}>
                        <AvatarImage src={teacher.photoURL} alt={teacher.name} className="rounded-full" />
                        <AvatarFallback 
                          className="rounded-full" 
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          <User size={16} />
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-black/80 truncate">{teacher.name}</span>
                          {teacher.status === 'inactive' && (
                            <span className="text-[9px] text-black/30 bg-black/05 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">OFF</span>
                          )}
                        </div>
                        {teacher.position && (
                          <p className="text-[10px] text-black/40 mt-0.5">
                            {teacher.position}
                          </p>
                        )}

                      </div>

                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0 rounded-lg border-black/10 text-black/40 font-mono py-0 h-5"
                      >
                        {teacher.teachingSubjectIds.length} วิชา
                      </Badge>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-3 py-2 bg-black/[0.02] border-t border-black/05 flex items-center justify-center gap-1 backdrop-blur-md mt-auto">
          <Button
            variant="ghost"
            size="icon"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="h-7 w-7 rounded-lg text-black/40 hover:bg-black/5 disabled:opacity-20 transition-all"
          >
            <ChevronLeft size={14} />
          </Button>

          <div className="flex items-center gap-1 mx-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              // Show limited pages if too many
              if (totalPages > 5) {
                if (page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 1) {
                  if (page === 2 || page === totalPages - 1) return <span key={page} className="text-[10px] text-black/20 px-0.5">...</span>;
                  return null;
                }
              }

              const isActive = currentPage === page;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-7 min-w-[28px] px-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    isActive 
                      ? 'bg-[#1e1e1e] text-white shadow-sm' 
                      : 'text-black/40 hover:bg-black/5 hover:text-black/70'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            className="h-7 w-7 rounded-lg text-black/40 hover:bg-black/5 disabled:opacity-20 transition-all"
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}
