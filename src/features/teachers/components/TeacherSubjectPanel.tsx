import { useState, useMemo } from 'react';
import { BookOpen, Edit2, ToggleLeft, ToggleRight, Search, Filter, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { TeacherProfile } from '@/types/teacher';
import type { Subject, Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG, CATEGORY_CONFIG } from '@/types/curriculum';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';
import { useSubjectGroup } from '@/hooks/useSubjectGroup';

interface TeacherSubjectPanelProps {
  teacher: TeacherProfile;
  allSubjects: Subject[];
  onEdit: () => void;
  onToggleStatus: () => void;
  onToggleSubject: (subjectId: string) => void;
}

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

export default function TeacherSubjectPanel({
  teacher,
  allSubjects,
  onEdit,
  onToggleStatus,
  onToggleSubject,
}: TeacherSubjectPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchGrade, setSearchGrade] = useState('all');
  const [searchGroup, setSearchGroup] = useState('all');
  const [searchDept, setSearchDept] = useState<Department | 'all'>('all');

  const [currentSearchPage, setCurrentSearchPage] = useState(1);
  const SEARCH_ITEMS_PER_PAGE = 8;

  const { departments, getGradesBySection } = useSchoolStructure();
  const { sortedGroups } = useSubjectGroup(allSubjects);

  const cfg = DEPARTMENT_CONFIG[teacher.department];

  const grades = searchDept !== 'all' 
    ? getGradesBySection(searchDept === 'early' ? 'early-childhood' : searchDept as any) 
    : [];

  const assignedSubjects = useMemo(() => 
    allSubjects.filter(s => teacher.teachingSubjectIds.includes(s.id)),
  [allSubjects, teacher.teachingSubjectIds]);

  const hasFilters = searchTerm.trim() !== '' || searchGrade !== 'all' || searchGroup !== 'all' || searchDept !== 'all';

  const filteredSubjects = useMemo(() => {
    if (!hasFilters) return [];
    
    return allSubjects.filter(s => {
      const matchSearch = !searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDept = searchDept === 'all' || s.department === searchDept;
      const matchGrade = searchGrade === 'all' || s.gradeLevel === searchGrade;
      // Match group
      const matchGroup = searchGroup === 'all' || sortedGroups.find(g => g.id === searchGroup)?.subjectIds.includes(s.id);
      
      return matchSearch && matchDept && matchGrade && matchGroup;
    });
  }, [allSubjects, searchTerm, searchDept, searchGrade, searchGroup, sortedGroups, hasFilters]);

  const totalSearchPages = Math.ceil(filteredSubjects.length / SEARCH_ITEMS_PER_PAGE);
  const paginatedSubjects = filteredSubjects.slice((currentSearchPage - 1) * SEARCH_ITEMS_PER_PAGE, currentSearchPage * SEARCH_ITEMS_PER_PAGE);

  // Helpers to reset page
  const updateFilter = (fn: () => void) => {
    fn();
    setCurrentSearchPage(1);
  };

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden" style={glassCard}>
      {/* Teacher Info Header */}
      <div className="px-5 pt-5 pb-4 border-b border-black/05">
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-base font-bold shrink-0"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {teacher.name.replace('ครู', '').trim().charAt(0)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-black/80">{teacher.name}</h2>
              <span
                className="text-[10px] px-2 py-0.5 rounded-lg font-semibold"
                style={{ background: cfg.bg, color: cfg.color }}
              >
                {cfg.label}
              </span>
              {teacher.status === 'inactive' && (
                <span className="text-[10px] px-2 py-0.5 rounded-lg bg-black/06 text-black/40 font-semibold">
                  ไม่ active
                </span>
              )}
            </div>
            <p className="text-xs text-black/40 mt-0.5">
              {teacher.position && <span className="mr-2">{teacher.position}</span>}
            </p>
          </div>

          <div className="flex gap-1.5 shrink-0">
            <Button variant="outline" size="sm" onClick={onEdit}
              className="h-7 px-2.5 text-xs rounded-lg border-black/10">
              <Edit2 size={11} className="mr-1" />แก้ไข
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggleStatus}
              className="h-7 px-2.5 text-xs rounded-lg text-black/50">
              {teacher.status === 'active'
                ? <ToggleRight size={13} className="mr-1 text-emerald-500" />
                : <ToggleLeft size={13} className="mr-1" />}
              {teacher.status === 'active' ? 'Active' : 'Inactive'}
            </Button>
          </div>
        </div>
      </div>
      {/* Search & Filter Section (Moved Up) */}
      <div className="px-5 py-3 border-b border-black/05 space-y-3 bg-black/[0.01]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-black/40" />
            <span className="text-xs font-bold text-black/70">ค้นหาและเพิ่มวิชา</span>
          </div>
          {hasFilters && (
             <button 
               onClick={() => updateFilter(() => {
                 setSearchTerm('');
                 setSearchGrade('all');
                 setSearchGroup('all');
                 setSearchDept('all');
               })}
               className="text-[10px] text-red-500 hover:underline"
             >
               ล้างตัวกรอง
             </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
           <div className="relative w-[140px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/30" />
              <Input 
                value={searchTerm}
                onChange={e => updateFilter(() => setSearchTerm(e.target.value))}
                placeholder="ค้นหาวิจา..."
                className="h-8 pl-8 text-[10px] rounded-xl bg-white border-black/10 focus-visible:ring-1 focus-visible:ring-slate-300"
              />
           </div>
           <Select value={searchDept} onValueChange={v => updateFilter(() => { setSearchDept(v as any); setSearchGrade('all'); })}>
             <SelectTrigger className="h-8 flex-1 text-[10px] rounded-xl bg-white border-black/10 px-2 min-w-[70px]">
               <SelectValue placeholder="แผนก" />
             </SelectTrigger>
             <SelectContent className="rounded-xl">
               <SelectItem value="all" className="text-xs">ทุกแผนก</SelectItem>
               {departments.map(d => <SelectItem key={d.id} value={d.id} className="text-xs">{d.label}</SelectItem>)}
             </SelectContent>
           </Select>
           <Select value={searchGrade} onValueChange={v => updateFilter(() => setSearchGrade(v))} disabled={searchDept === 'all'}>
             <SelectTrigger className="h-8 flex-1 text-[10px] rounded-xl bg-white border-black/10 px-2 min-w-[60px]">
               <SelectValue placeholder="ชั้น" />
             </SelectTrigger>
             <SelectContent className="rounded-xl">
               <SelectItem value="all" className="text-xs">ทุกชั้น</SelectItem>
               {grades.map(g => <SelectItem key={g.id} value={g.id} className="text-xs">{g.label}</SelectItem>)}
             </SelectContent>
           </Select>
           <Select value={searchGroup} onValueChange={v => updateFilter(() => setSearchGroup(v))}>
             <SelectTrigger className="h-8 flex-1 text-[10px] rounded-xl bg-white border-black/10 px-2 min-w-[80px]">
               <SelectValue placeholder="กลุ่มสาระ" />
             </SelectTrigger>
             <SelectContent className="rounded-xl">
               <SelectItem value="all" className="text-xs">ทุกกลุ่มสาระ</SelectItem>
               {sortedGroups.map(g => <SelectItem key={g.id} value={g.id} className="text-xs">{g.name}</SelectItem>)}
             </SelectContent>
           </Select>

        </div>
      </div>

      {/* Assigned subjects summary */}
      <div className="px-5 py-4 border-b border-black/05">
         <div className="flex items-center gap-1.5 mb-2">
           <BookOpen size={12} className="text-black/40" />
           <span className="text-[11px] font-bold text-black/60">วิชาที่รับผิดชอบ ({assignedSubjects.length})</span>
         </div>
         <div className="flex gap-1.5 flex-wrap">
           {assignedSubjects.length === 0 ? (
             <p className="text-[10px] text-black/30 italic">ยังไม่ได้รับผิดชอบวิชาใดๆ</p>
           ) : (
             assignedSubjects.map(s => (
              <Badge 
                key={s.id} 
                variant="outline" 
                className="text-[9px] h-6 rounded-lg bg-black/5 border-transparent text-black/60 flex items-center gap-1 pr-1"
              >
                {s.code}
                <button onClick={() => onToggleSubject(s.id)} className="hover:text-red-500 transition-colors">
                  <X size={10} />
                </button>
              </Badge>
             ))
           )}
         </div>
      </div>

      {/* Subject Search Results List */}
      <div className="flex-1 flex flex-col min-h-0 bg-black/[0.005]">


        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          {!hasFilters ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-black/20">
              <Search size={32} className="mb-2 opacity-40" />
              <p className="text-xs font-semibold">กรุณาพิมพ์หรือเลือกตัวกรอง</p>
              <p className="text-[10px]">เพื่อค้นหาวิชาที่ต้องการมอบหมาย</p>
            </div>
          ) : paginatedSubjects.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center text-black/30">
              <p className="text-xs">ไม่พบวิชาที่ค้นหา</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <ul className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
                {paginatedSubjects.map(subject => {
                   const isAssigned = teacher.teachingSubjectIds.includes(subject.id);
                   const subjDeptCfg = DEPARTMENT_CONFIG[subject.department];
                   const catCfg = CATEGORY_CONFIG[subject.category];
                   
                   return (
                     <li key={subject.id}>
                       <button
                         onClick={() => onToggleSubject(subject.id)}
                         className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left border ${isAssigned ? 'bg-emerald-50/50 border-emerald-200/50' : 'bg-white border-black/5 hover:border-black/10 shadow-sm'}`}
                       >
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/5 text-black/50">{subject.code}</span>
                              <span className="text-[11px] font-bold text-black/70 truncate">{subject.name}</span>
                           </div>
                           <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[9px] text-black/30">{subjDeptCfg.label}</span>
                              <span className="text-[9px] text-black/30">·</span>
                              <span className="text-[9px] text-black/30" style={{ color: catCfg.color }}>{catCfg.label}</span>
                           </div>
                         </div>
                         
                         {isAssigned ? (
                           <Badge className="bg-emerald-500 text-white border-0 text-[10px] h-6 px-2">มอบหมายแล้ว</Badge>
                         ) : (
                           <Button size="sm" variant="ghost" className="h-6 text-[10px] text-blue-500 hover:text-blue-600 hover:bg-blue-50">
                             <Plus size={10} className="mr-1" /> เพิ่ม
                           </Button>
                         )}
                       </button>
                     </li>
                   );
                })}
              </ul>
              
              {/* Pagination Footer */}
              {totalSearchPages > 1 && (
                <div className="px-5 py-2 bg-white/50 border-t border-black/05 flex items-center justify-between backdrop-blur-sm mt-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentSearchPage === 1}
                    onClick={() => setCurrentSearchPage(p => Math.max(1, p - 1))}
                    className="h-7 px-2 text-[10px] font-bold text-black/40 hover:bg-black/5"
                  >
                    ก่อนหน้า
                  </Button>
                  <span className="text-[10px] font-bold text-black/30">
                    หน้า {currentSearchPage} / {totalSearchPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentSearchPage === totalSearchPages}
                    onClick={() => setCurrentSearchPage(p => Math.min(totalSearchPages, p + 1))}
                    className="h-7 px-2 text-[10px] font-bold text-black/40 hover:bg-black/5"
                  >
                    ถัดไป
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
