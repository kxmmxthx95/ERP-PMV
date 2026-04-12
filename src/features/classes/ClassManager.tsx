import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DoorOpen, Plus, Search, Users, LayoutGrid, Layers, Pencil, UserPlus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useClassManager } from '@/hooks/useClassManager';
import ClassFormModal from './components/ClassFormModal';
import type { ClassRoom, NewClassRoom } from '@/types/class';
import type { Department } from '@/types/curriculum';
import { DEPARTMENT_CONFIG } from '@/types/curriculum';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
};

export default function ClassManager() {
  const mgr = useClassManager();
  const { getGradesBySection, gradeLevels } = useSchoolStructure();

  const [modalOpen,     setModalOpen]     = useState(false);
  const [editingClass,  setEditingClass]  = useState<ClassRoom | null>(null);
  const [currentPage,   setCurrentPage]   = useState(1);

  const openCreate = () => { setEditingClass(null); setModalOpen(true); };
  const openEdit   = (cls: ClassRoom) => { setEditingClass(cls); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingClass(null); };

  const normalizedDept = mgr.filterDept === 'early' ? 'early-childhood' : mgr.filterDept;
  const grades = mgr.filterDept !== 'all' ? getGradesBySection(normalizedDept as any) : [];

  const hasSearch = mgr.searchQ.trim().length > 0 || mgr.filterDept !== 'all' || mgr.filterGrade !== 'all';

  // Department list for filter dropdown
  const departments: { id: Department; label: string }[] = [
    { id: 'early', label: DEPARTMENT_CONFIG.early.label },
    { id: 'primary', label: DEPARTMENT_CONFIG.primary.label },
    { id: 'secondary', label: DEPARTMENT_CONFIG.secondary.label },
  ];
  const deptIdMap: Record<Department, string> = {
    early: 'early-childhood',
    primary: 'primary',
    secondary: 'secondary',
  };

  // ── Pagination Logic ──
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(mgr.filteredCards.length / ITEMS_PER_PAGE);
  const paginatedCards = mgr.filteredCards.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [mgr.searchQ, mgr.filterDept, mgr.filterGrade]);

  return (
    <div className="space-y-5 text-black">
      {/* ── Header & Actions ── */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        {/* Header Info */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2.5">
            <DoorOpen size={22} className="text-black/70" />
            <h1 className="text-xl font-bold text-black/85 tracking-tight">จัดการชั้นเรียน</h1>
          </div>
          <p className="text-xs text-black/40 mt-0.5">
            ปีการศึกษา {mgr.yearId} · ภาคเรียนที่ {mgr.semester}
            {' · '}
            <span className="font-semibold text-black/60">แสดง {mgr.filteredCards.length} / {mgr.summary.total} ห้อง</span>
            {' · '}
            <span className="font-semibold text-blue-600">{mgr.summary.totalStudents.toLocaleString()} คน</span>
          </p>
        </motion.div>

        {/* Filters & Add Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col sm:flex-row items-center gap-0.5 w-full md:w-auto rounded-xl shadow-sm"
          style={{
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            padding: '0.15rem',
          }}
        >
          {/* Search */}
          <div className="relative w-full sm:w-48 flex-shrink-0">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/30 z-10" />
            <Input
              value={mgr.searchQ}
              onChange={e => mgr.setSearchQ(e.target.value)}
              placeholder="ค้นหาห้อง / ครู..."
              className="w-full pl-7 pr-2 py-0.5 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] placeholder:text-black/30 shadow-none focus-visible:ring-0 h-auto rounded-md transition-colors"
            />
          </div>

          {/* Dept Filter */}
          <div className="w-full sm:w-28 flex-shrink-0">
            <Select value={mgr.filterDept} onValueChange={(val) => { mgr.setFilterDept(val as any); mgr.setFilterGrade('all'); }}>
              <SelectTrigger className="w-full px-2 py-0.5 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] text-black/70 shadow-none focus:ring-0 h-auto rounded-md transition-colors">
                <SelectValue placeholder="เลือกแผนก" />
              </SelectTrigger>
              <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
                <SelectItem value="all" className="text-[11px] rounded-lg">เลือกแผนก</SelectItem>
                {departments.map(d => {
                  const val = deptIdMap[d.id] ?? d.id;
                  return <SelectItem key={d.id} value={val} className="text-[11px] rounded-lg">{d.label}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Grade Filter */}
          <div className="w-full sm:w-28 flex-shrink-0">
            <Select value={mgr.filterGrade} onValueChange={mgr.setFilterGrade} disabled={mgr.filterDept === 'all'}>
              <SelectTrigger className="w-full px-2 py-0.5 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] text-black/70 shadow-none focus:ring-0 h-auto rounded-md transition-colors disabled:opacity-50">
                <SelectValue placeholder="เลือกระดับชั้น" />
              </SelectTrigger>
              <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
                <SelectItem value="all" className="text-[11px] rounded-lg">เลือกระดับชั้น</SelectItem>
                {grades.map(g => (
                  <SelectItem key={g.id} value={g.id} className="text-[11px] rounded-lg">{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Add Button */}
          <Button
            onClick={openCreate}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] h-auto border-0 bg-[#1e1e1e] hover:bg-[#2a2a2a] flex-shrink-0"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          >
            <Plus size={14} />
            สร้างห้องเรียน
          </Button>
        </motion.div>
      </div>

      {/* ── Summary KPI ── */}
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3"
      >
        <KpiCard
          icon={<LayoutGrid size={16} />}
          label="ห้องเรียนทั้งหมด"
          value={mgr.summary.total}
          unit="ห้อง"
          color="#6366f1"
        />
        <KpiCard
          icon={<Users size={16} />}
          label="นักเรียนทั้งหมด"
          value={mgr.summary.totalStudents}
          unit="คน"
          color="#0ea5e9"
          subLabel={`จาก ${mgr.summary.totalCapacity} คน (ความจุ)`}
        />
        <KpiCard
          icon={<Layers size={16} />}
          label="ห้องเต็ม"
          value={mgr.summary.fullClasses}
          unit="ห้อง"
          color="#ef4444"
          subLabel="นักเรียนเต็มความจุ"
        />
        {/* Dept breakdown */}
        <div className="rounded-2xl px-4 py-3" style={glassCard}>
          <p className="text-[10px] text-black/40 font-semibold mb-2">แยกตามแผนก</p>
          <div className="space-y-1">
            {mgr.deptSummary.filter(d => d.count > 0).map(d => (
              <div key={d.dept} className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: d.cfg.color }}>{d.cfg.label}</span>
                <span className="text-[11px] font-bold text-black/60">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Table Content ── */}
      {!hasSearch ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-48 gap-3 text-black/30 bg-white/40 rounded-2xl border border-black/5 shadow-sm"
        >
          <Search size={32} className="opacity-40" />
          <p className="text-sm font-medium">กรุณาพิมพ์ค้นหา หรือเลือกตัวกรองเพื่อดูข้อมูลห้องเรียน</p>
        </motion.div>
      ) : mgr.filteredCards.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-40 gap-2 text-black/25 bg-white/40 rounded-2xl border border-black/5 shadow-sm"
        >
          <DoorOpen size={28} className="opacity-40" />
          <p className="text-sm font-medium">ไม่พบห้องเรียนที่ค้นหา</p>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-3xl overflow-hidden" style={glassCard}>
          <div className="overflow-x-auto">
            <Table className="w-full text-sm text-left border-collapse">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b-black/5" style={{ background: 'rgba(0,0,0,0.03)' }}>
                  <TableHead className="px-4 py-3 font-semibold text-black/40 text-[11px] uppercase tracking-wider h-auto">ห้องเรียน</TableHead>
                  <TableHead className="px-4 py-3 font-semibold text-black/40 text-[11px] uppercase tracking-wider h-auto">ระดับชั้น</TableHead>
                  <TableHead className="px-4 py-3 font-semibold text-black/40 text-[11px] uppercase tracking-wider h-auto">แผนก</TableHead>
                  <TableHead className="px-4 py-3 font-semibold text-black/40 text-[11px] uppercase tracking-wider h-auto">ครูประจำชั้น</TableHead>
                  <TableHead className="px-4 py-3 font-semibold text-black/40 text-[11px] uppercase tracking-wider h-auto text-center">นักเรียน</TableHead>
                  <TableHead className="px-4 py-3 font-semibold text-black/40 text-[11px] uppercase tracking-wider h-auto text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-black/[0.04]">
                {paginatedCards.map((card) => {
                  const gradeObj = gradeLevels.find(g => g.id === card.classRoom.gradeLevel || g.shortLabel === card.classRoom.gradeLevel);
                  const displayGrade = gradeObj ? gradeObj.label : card.classRoom.gradeLevel;
                  const deptCfg = DEPARTMENT_CONFIG[card.classRoom.departmentId as Department] ?? { bg: 'transparent', color: '#000', label: 'ไม่ระบุ' };
                  
                  return (
                    <TableRow key={card.classRoom.id} className="hover:bg-black/[0.015] transition-colors border-b-black/5">
                      <TableCell className="px-4 py-2.5">
                        <span className="font-bold text-xs text-black/75">{card.classRoom.className}</span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <span className="text-xs text-black/60">{displayGrade}</span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <span
                          className="px-2.5 py-1 rounded-md text-[10px] font-bold shrink-0 inline-block"
                          style={{ background: deptCfg.bg, color: deptCfg.color }}
                        >
                          {deptCfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ background: deptCfg.bg, color: deptCfg.color }}
                          >
                            {card.homeroomTeacher?.name.replace('ครู', '').trim().charAt(0) ?? '?'}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-black/70 truncate max-w-[120px] sm:max-w-none">
                              {card.homeroomTeacher?.name ?? <span className="text-black/30 italic">ยังไม่ได้กำหนด</span>}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-center">
                        <span className="text-xs font-medium text-black/60">
                          {card.classRoom.studentCount} / {card.classRoom.maxStudents}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => alert('ฟีเจอร์นำเข้านักเรียนเข้าห้องเรียนกำลังพัฒนา')} className="h-7 w-7 text-black/40 hover:text-emerald-600 hover:bg-emerald-50 rounded-md outline-none focus-visible:ring-0 transition-colors" title="เพิ่มนักเรียน">
                            <UserPlus size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(card.classRoom)} className="h-7 w-7 text-black/40 hover:text-orange-600 hover:bg-orange-50 rounded-md outline-none focus-visible:ring-0 transition-colors" title="แก้ไข">
                            <Pencil size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => {
                            if (window.confirm(`คุณแน่ใจหรือไม่ที่จะลบห้อง ${card.classRoom.className}? ข้อมูลทั้งหมดจะถูกลบอย่างถาวร`)) {
                              mgr.deleteClass(card.classRoom.id);
                            }
                          }} className="h-7 w-7 text-black/40 hover:text-red-600 hover:bg-red-50 rounded-md outline-none focus-visible:ring-0 transition-colors" title="ลบห้องเรียน">
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </motion.div>
      )}

      {/* ── Pagination ── */}
      {hasSearch && totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex items-center justify-center gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            className="h-8 rounded-full text-xs font-medium"
          >
            ← ก่อนหน้า
          </Button>
          <div className="text-xs font-medium text-black/40 px-2">
            หน้า {currentPage} / {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            className="h-8 rounded-full text-xs font-medium"
          >
            ถัดไป →
          </Button>
        </motion.div>
      )}

      {/* ── Modal ── */}
      <ClassFormModal
        open={modalOpen}
        editingClass={editingClass}
        yearId={mgr.yearId}
        semester={mgr.semester}
        teachers={mgr.availableTeachers}
        onClose={closeModal}
        onSubmit={(data: NewClassRoom) => mgr.addClass(data)}
        onUpdate={(id, data) => mgr.updateClass(id, data)}
        onDelete={id => mgr.deleteClass(id)}
      />
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, unit, color, subLabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  color: string;
  subLabel?: string;
}) {
  return (
    <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={glassCard}>
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}15`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-black/40 font-semibold truncate">{label}</p>
        <p className="text-xl font-bold text-black/75 leading-tight">
          {value.toLocaleString()}
          <span className="text-[11px] font-normal text-black/35 ml-1">{unit}</span>
        </p>
        {subLabel && <p className="text-[9px] text-black/30 mt-0.5">{subLabel}</p>}
      </div>
    </div>
  );
}
