import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, CheckCircle2, BookOpen, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { DEPARTMENT_CONFIG, type Department } from '@/types/curriculum';

interface CurriculumOption {
  id: string;
  name: string;
  semester: 1 | 2;
  count: number;
  credits: number;
  hours: number;
}

interface GradeRow {
  grade: string;
  curriculums: CurriculumOption[];
}

interface CurriculumRegistrationTabProps {
  activeYear: string;
  allYears: string[];
  getYearRegistrationGrid: (year: string, dept: Department) => GradeRow[];
  cloneCurriculum: (fromYear: string, toYear: string, overwrite?: boolean) => { cloned: number; skipped: number };
  onSelectCell: (grade: string, semester: 1 | 2) => void;
}

const containerAnim = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const rowAnim = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.25 } },
};

export default function CurriculumRegistrationTab({
  activeYear,
  allYears,
  getYearRegistrationGrid,
  cloneCurriculum,
  onSelectCell,
}: CurriculumRegistrationTabProps) {
  const [activeDept, setActiveDept] = useState<Department>('primary');
  const [cloneOpen, setCloneOpen] = useState(false);
  const [fromYear, setFromYear] = useState('');
  const [overwrite, setOverwrite] = useState(false);
  const [cloneResult, setCloneResult] = useState<{ cloned: number; skipped: number } | null>(null);

  const deptCfg = DEPARTMENT_CONFIG[activeDept];
  const grid = getYearRegistrationGrid(activeYear, activeDept);
  const sourceYears = allYears.filter(y => y !== activeYear);

  const configuredCount = grid.filter(r => r.curriculums.length > 0).length;
  const totalCells = grid.length;
  const configuredCells = configuredCount;

  const handleClone = () => {
    if (!fromYear) return;
    const result = cloneCurriculum(fromYear, activeYear, overwrite);
    setCloneResult(result);
  };

  const closeClone = () => {
    setCloneOpen(false);
    setCloneResult(null);
    setFromYear('');
    setOverwrite(false);
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-black/80">ลงทะเบียนหลักสูตร ปีการศึกษา {activeYear}</h2>
          <p className="text-xs text-black/40 mt-0.5">
            กำหนดวิชาที่เรียนในแต่ละระดับชั้นและภาคเรียน
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs h-8 border-black/15"
          onClick={() => setCloneOpen(true)}
          disabled={sourceYears.length === 0}
        >
          <Copy size={13} />
          Clone จากปีก่อน
        </Button>
      </div>

      {/* Department tabs */}
      <div
        className="inline-flex gap-1 rounded-xl p-1"
        style={{
          background: 'rgba(255,255,255,0.5)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.7)',
        }}
      >
        {(['early', 'primary', 'secondary'] as Department[]).map(dept => {
          const cfg = DEPARTMENT_CONFIG[dept];
          const active = dept === activeDept;
          return (
            <button
              key={dept}
              onClick={() => setActiveDept(dept)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150"
              style={{
                background: active ? cfg.bg : 'transparent',
                color: active ? cfg.color : 'rgba(0,0,0,0.45)',
                border: active ? `1px solid ${cfg.border}` : '1px solid transparent',
              }}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* Progress summary */}
      <div
        className="rounded-2xl p-4 flex items-center gap-4"
        style={{
          background: deptCfg.bg,
          border: `1px solid ${deptCfg.border}`,
        }}
      >
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold" style={{ color: deptCfg.color }}>
              ความคืบหน้าการลงทะเบียน
            </span>
            <span className="text-xs font-bold" style={{ color: deptCfg.color }}>
              {configuredCells}/{totalCells}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: deptCfg.color }}
              initial={{ width: 0 }}
              animate={{ width: `${totalCells > 0 ? (configuredCells / totalCells) * 100 : 0}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold" style={{ color: deptCfg.color }}>
            {configuredCount}/{grid.length}
          </p>
          <p className="text-[10px] text-black/40">ระดับชั้น</p>
        </div>
      </div>

      {/* Registration grid */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.85)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        }}
      >
        {/* Table header */}
        <div
          className="grid grid-cols-[1fr_2fr] text-xs font-bold text-black/50 px-4 py-3"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
        >
          <span>ระดับชั้น</span>
          <span>ชื่อหลักสูตร</span>
        </div>

        {/* Rows */}
        <motion.div variants={containerAnim} initial="hidden" animate="show">
          {grid.map((row, i) => (
            <motion.div
              key={row.grade}
              variants={rowAnim}
              className="grid grid-cols-[1fr_2fr] px-4 py-3 items-center gap-4"
              style={{ borderBottom: i < grid.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}
            >
              {/* Grade label */}
              <span className="text-sm font-semibold text-black/75">{row.grade}</span>

              {/* Curriculum dropdown */}
              <CurriculumDropdown
                curriculums={row.curriculums}
                deptColor={deptCfg.color}
                deptBg={deptCfg.bg}
                deptBorder={deptCfg.border}
                onSelect={() => onSelectCell(row.grade, 1)}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Empty state for no grades */}
      {grid.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-black/30">
          <BookOpen size={36} className="mb-3 opacity-40" />
          <p className="text-sm font-medium">ไม่มีข้อมูลระดับชั้นสำหรับแผนกนี้</p>
        </div>
      )}

      {/* Clone dialog */}
      <Dialog open={cloneOpen} onOpenChange={v => !v && closeClone()}>
        <DialogContent
          className="max-w-sm rounded-2xl border-0 p-0 overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
          }}
        >
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-black/5">
            <DialogTitle className="text-sm font-bold text-black/80 flex items-center gap-2">
              <Copy size={15} />
              Clone หลักสูตรจากปีก่อน
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 py-4 space-y-4">
            {cloneResult ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">Clone สำเร็จ</p>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      คัดลอก {cloneResult.cloned} หลักสูตร
                      {cloneResult.skipped > 0 && `, ข้าม ${cloneResult.skipped} รายการ (มีอยู่แล้ว)`}
                    </p>
                  </div>
                </div>
                <Button className="w-full h-9 text-sm" onClick={closeClone}>
                  ปิด
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-black/60">คัดลอกจากปีการศึกษา</label>
                  <Select value={fromYear} onValueChange={setFromYear}>
                    <SelectTrigger className="rounded-lg text-sm h-9">
                      <SelectValue placeholder="เลือกปีการศึกษา..." />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceYears.map(y => (
                        <SelectItem key={y} value={y}>ปีการศึกษา {y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-black/40">คัดลอกไปยัง: ปีการศึกษา {activeYear}</p>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <div
                    className="w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0"
                    style={{
                      background: overwrite ? '#1e1e1e' : 'transparent',
                      borderColor: overwrite ? '#1e1e1e' : 'rgba(0,0,0,0.2)',
                    }}
                    onClick={() => setOverwrite(v => !v)}
                  >
                    {overwrite && <CheckCircle2 size={10} className="text-white" />}
                  </div>
                  <span className="text-xs text-black/65">
                    แทนที่ข้อมูลเดิมหากมีอยู่แล้ว
                  </span>
                </label>

                {!overwrite && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                    <AlertCircle size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-amber-700">
                      ระดับชั้นที่มีข้อมูลอยู่แล้วจะถูกข้ามไป
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button variant="ghost" size="sm" className="flex-1 h-9 text-sm" onClick={closeClone}>
                    ยกเลิก
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 h-9 text-sm text-white bg-black hover:bg-black/80"
                    onClick={handleClone}
                    disabled={!fromYear}
                  >
                    <Copy size={13} className="mr-1.5" />
                    Clone
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CurriculumDropdown({
  curriculums,
  deptColor,
  deptBg,
  deptBorder,
  onSelect,
}: {
  curriculums: CurriculumOption[];
  deptColor: string;
  deptBg: string;
  deptBorder: string;
  onSelect: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    curriculums.length > 0 ? curriculums[0].id : null
  );

  const selectedCurriculum = curriculums.find(c => c.id === selectedId);

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedId || 'none'} onValueChange={(val) => {
        if (val !== 'none') {
          setSelectedId(val);
          onSelect();
        }
      }}>
        <SelectTrigger
          className="rounded-lg text-sm h-9 flex-1"
          style={{
            background: curriculums.length > 0 ? deptBg : 'rgba(0,0,0,0.04)',
            border: `1px solid ${curriculums.length > 0 ? deptBorder : 'rgba(0,0,0,0.08)'}`,
            color: curriculums.length > 0 ? deptColor : 'rgba(0,0,0,0.30)',
          }}
        >
          <SelectValue placeholder="ยังไม่กำหนด" />
        </SelectTrigger>
        <SelectContent>
          {curriculums.length === 0 ? (
            <div className="p-2 text-xs text-black/40">ไม่มีหลักสูตร</div>
          ) : (
            curriculums.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} • {c.count} วิชา • {c.credits} หน่วยกิต
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {selectedCurriculum && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: deptBg, color: deptColor }}>
          <CheckCircle2 size={12} />
          <span>{selectedCurriculum.count} วิชา</span>
        </div>
      )}
    </div>
  );
}
