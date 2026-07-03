import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, School, Info, BookOpen, Calendar, Database, Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { httpsCallable } from 'firebase/functions';

import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNamePrefix } from '@/hooks/useNamePrefix';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AcademicYearSettings {
  currentYear: string;
  startDate: string;
  endDate: string;
  activeSemester: 1 | 2 | 3;
}

interface GeneralSettings {
  schoolName: string;
  schoolNameEn: string;
  schoolCode: string;
  addressLine1: string;
  subDistrict: string;
  district: string;
  province: string;
  postalCode: string;
  phone: string;
  website: string;
  logoUrl: string;
  licenseePrefix: string;
  licenseeFirstName: string;
  licenseeLastName: string;
  principalPrefix: string;
  principalFirstName: string;
  principalName: string;
  principalLastName: string;
  isSystemActive: boolean;
}

interface SemesterConfig {
  startDate: string;
  endDate: string;
}

interface DeptSemesters {
  semester1: SemesterConfig;
  semester2: SemesterConfig;
  summerEnabled: boolean;
  summerSemester: SemesterConfig;
}

interface DeptSemesterSettings {
  kindergarten: DeptSemesters;
  primary: DeptSemesters;
  secondary: DeptSemesters;
}

interface StaffAttendanceMigrationResult {
  success: boolean;
  dryRun: boolean;
  range: { from: string | null; to: string | null };
  scannedLegacyDocs: number;
  groupedUserDateRecords: number;
  duplicateGroups: number;
  migratedEntries: number;
  preservedExistingBetter: number;
  touchedDays: number;
  skippedInvalidDocs: number;
  skippedOutOfRangeDocs: number;
}

interface LocalAttendanceDoc {
  id: string;
  data: Record<string, unknown>;
}

// ─── Tabs ───────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'general', label: 'ข้อมูลโรงเรียน', icon: School },
  { id: 'semesters', label: 'ตั้งค่าแผนก', icon: Calendar },
] as const;
type TabId = 'general' | 'semesters' | 'migration';

const DEPT_TABS = [
  { id: 'kindergarten', label: 'อนุบาล', labelEn: 'Kindergarten', color: '#f59e0b' },
  { id: 'primary', label: 'ประถม', labelEn: 'Primary', color: '#3b82f6' },
  { id: 'secondary', label: 'มัธยม', labelEn: 'Secondary', color: '#7c3aed' },
] as const;
type DeptId = typeof DEPT_TABS[number]['id'];

// ─── Defaults ───────────────────────────────────────────────────────────────

const now = new Date();
const currentYearAD = now.getFullYear();
const currentYearBE = currentYearAD + 543;

const defaultAcademic: AcademicYearSettings = {
  currentYear: currentYearBE.toString(),
  startDate: `${currentYearAD}-05-15`,
  endDate: `${currentYearAD + 1}-03-07`,
  activeSemester: 1,
};

const defaultGeneral: GeneralSettings = {
  schoolName: 'โรงเรียนปิยะมิตรวิทยา',
  schoolNameEn: 'Piyamit Wittaya School',
  schoolCode: '',
  addressLine1: '',
  subDistrict: '',
  district: '',
  province: '',
  postalCode: '',
  phone: '',
  website: '',
  logoUrl: '',
  licenseePrefix: 'นาย',
  licenseeFirstName: '',
  licenseeLastName: '',
  principalPrefix: 'นาย',
  principalFirstName: '',
  principalName: '',
  principalLastName: '',
  isSystemActive: true,
};

const defaultDeptSemesters: DeptSemesters = {
  semester1: { startDate: `${currentYearAD}-05-15`, endDate: `${currentYearAD}-10-11` },
  semester2: { startDate: `${currentYearAD}-11-01`, endDate: `${currentYearAD + 1}-03-07` },
  summerEnabled: false,
  summerSemester: { startDate: `${currentYearAD + 1}-03-17`, endDate: `${currentYearAD + 1}-05-09` },
};

const defaultSemesters: DeptSemesterSettings = {
  kindergarten: { ...defaultDeptSemesters },
  primary: { ...defaultDeptSemesters },
  secondary: { ...defaultDeptSemesters },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const SectionCard = ({
  title, icon: Icon, children, accent, className = '', action,
}: {
  title: string; icon: React.ElementType; children: React.ReactNode; accent?: string; className?: string; action?: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className={`rounded-3xl p-5 flex flex-col ${className}`}
    style={{
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(40px) saturate(180%)',
      border: '1px solid rgba(255,255,255,0.85)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.04)',
    }}
  >
    <div className="flex items-center justify-between mb-4 shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accent ?? '#0f172a' }}>
          <Icon size={13} className="text-white" />
        </div>
        <h2 className="text-[15px] font-black text-slate-800 font-sukhumvit tracking-tight uppercase">{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </motion.div>
);

const FieldLabel = ({ label, required }: { label: string; required?: boolean }) => (
  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-sukhumvit block mb-1">
    {label} {required && <span className="text-rose-400">*</span>}
  </label>
);

const inputStyle = "w-full h-9 rounded-xl border text-[13px] font-medium focus-visible:ring-2 focus-visible:ring-blue-500/20 shadow-none font-sarabun";
const inputInlineStyle = { background: 'rgba(255,255,255,0.7)', borderColor: 'rgba(200,200,220,0.5)' };

const Toggle = ({ value, onChange, color = '#0f172a' }: { value: boolean; onChange: (v: boolean) => void; color?: string }) => (
  <button onClick={() => onChange(!value)} className="relative w-9 h-5 rounded-full transition-all duration-300 flex-shrink-0" style={{ background: value ? color : '#e2e8f0' }}>
    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-300 ${value ? 'left-4' : 'left-0.5'}`} />
  </button>
);

const DateRangePicker = ({ label, value, onChange, color }: {
  label: string; value: SemesterConfig; onChange: (v: SemesterConfig) => void; color: string;
}) => (
  <div className="rounded-2xl p-3 border" style={{ borderColor: `${color}20`, background: `${color}06` }}>
    <div className="flex items-center gap-1.5 mb-2">
      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
      <span className="text-[11px] font-black text-slate-600 font-sukhumvit uppercase tracking-tight">{label}</span>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div>
        <FieldLabel label="เปิด" />
        <Input type="date" value={value.startDate} onChange={e => onChange({ ...value, startDate: e.target.value })} className={inputStyle} style={inputInlineStyle} />
      </div>
      <div>
        <FieldLabel label="ปิด" />
        <Input type="date" value={value.endDate} onChange={e => onChange({ ...value, endDate: e.target.value })} className={inputStyle} style={inputInlineStyle} />
      </div>
    </div>
  </div>
);

// ─── Semester Card per Dept ──────────────────────────────────────────────────

const DeptSemesterCard = ({ label, labelEn, color, value, onChange }: {
  label: string; labelEn: string; color: string; value: DeptSemesters; onChange: (v: DeptSemesters) => void;
}) => {
  const [showEdit, setShowEdit] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-[2rem] p-6 flex flex-col gap-4 overflow-hidden relative transition-all duration-500 ${(!showEdit || !value.summerEnabled) ? 'aspect-square' : 'min-h-0 h-auto'}`}
      style={{
        background: '#ffffff',
        border: `1px solid #f1f5f9`,
        boxShadow: `0 10px 40px rgba(0,0,0,0.04)`,
      }}
    >

      <AnimatePresence mode="wait">
        {!showEdit ? (
          <motion.div
            key="main"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="flex flex-col h-full justify-between flex-1"
          >
            {/* Top Row: Name and Edit Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <h3 className="text-[24px] font-black text-slate-800 font-sukhumvit tracking-tight leading-tight">{label}</h3>
                <span className="text-[12px] font-bold text-slate-400 font-sukhumvit uppercase tracking-[0.1em]">{labelEn}</span>
              </div>
              <div className="z-10">
                <Toggle value={showEdit} onChange={setShowEdit} color={color} />
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center py-2">
              <span className="text-[13px] font-black text-slate-400 font-sukhumvit uppercase tracking-[0.2em] mb-2">เปิดเรียนครั้งถัดไป</span>
              <div className="flex flex-col items-center">
                {(() => {
                  const now = new Date();
                  const dates = [
                    { label: 'เทอม 1', date: value.semester1.startDate },
                    { label: 'เทอม 2', date: value.semester2.startDate },
                    ...(value.summerEnabled ? [{ label: 'Summer', date: value.summerSemester.startDate }] : [])
                  ].filter(d => d.date && new Date(d.date) >= now)
                   .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                  const next = dates[0];
                  if (!next) return <span className="text-[18px] font-bold text-slate-300 font-sarabun italic">ยังไม่มีกำหนดการ</span>;

                  const [y, m, d] = next.date.split('-');
                  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
                  
                  return (
                    <>
                      <div className="text-[40px] font-black text-slate-800 font-sukhumvit tracking-tighter leading-none mb-2">
                        {parseInt(d)} {months[parseInt(m) - 1]} {parseInt(y) + 543}
                      </div>
                      <div className="text-[14px] font-black text-slate-400 font-sukhumvit uppercase tracking-[0.1em]">
                        ({next.label})
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Bottom Row: Avatar and Status */}
            <div className="mt-auto flex items-end justify-between">
              <div className="relative group cursor-pointer">
                <div className="w-16 h-16 rounded-full border-4 border-white shadow-xl flex items-center justify-center transition-transform group-hover:scale-105 duration-300 overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}15, ${color}30)` }}>
                  <div className="w-full h-full rounded-full flex items-center justify-center bg-white/40 backdrop-blur-sm text-slate-700">
                    <GraduationCap size={28} style={{ color }} />
                  </div>
                </div>
                <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full border-[2.5px] border-white bg-emerald-500 shadow-md flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                </div>
              </div>

              <div className="text-right">
                {/* Status removed per request */}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="edit"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="flex flex-col gap-4 flex-1"
          >
            {/* Header for Edit view */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm border border-slate-100" style={{ background: `${color}10` }}>
                  <Calendar size={13} style={{ color }} />
                </div>
                <h4 className="text-[14px] font-black text-slate-700 font-sukhumvit">กำหนดการ ({label})</h4>
              </div>
              <div className="z-10">
                <Toggle value={showEdit} onChange={setShowEdit} color={color} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pr-1 pb-1">
              <DateRangePicker
                label="เทอม 1"
                color={color}
                value={value.semester1}
                onChange={v => onChange({ ...value, semester1: v })}
              />
              <DateRangePicker
                label="เทอม 2"
                color={color}
                value={value.semester2}
                onChange={v => onChange({ ...value, semester2: v })}
              />

              <div className="rounded-2xl px-4 py-3 border flex items-center justify-between mt-1" style={{ borderColor: `${color}20`, background: `${color}05` }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center bg-white shadow-sm border border-slate-100">
                    <BookOpen size={12} style={{ color }} />
                  </div>
                  <span className="text-[12px] font-black text-slate-700 uppercase tracking-wide font-sukhumvit">เพิ่มภาคฤดูร้อน</span>
                </div>
                <Toggle value={value.summerEnabled} onChange={v => onChange({ ...value, summerEnabled: v })} color={color} />
              </div>

              <AnimatePresence>
                {value.summerEnabled && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="pt-2">
                      <DateRangePicker
                        label="ภาคฤดูร้อน"
                        color="#f43f5e"
                        value={value.summerSemester}
                        onChange={v => onChange({ ...value, summerSemester: v })}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { showSearch } = useOutletContext<{ showSearch: boolean }>();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.getElementById('header-portal-center'));
  }, []);

  const [editAcademic, setEditAcademic] = useState(false);
  const [editIdentity, setEditIdentity] = useState(false);
  const [editLocation, setEditLocation] = useState(false);

  const [academic, setAcademic] = useState<AcademicYearSettings>(defaultAcademic);
  const [general, setGeneral] = useState<GeneralSettings>(defaultGeneral);
  const [semesters, setSemesters] = useState<DeptSemesterSettings>(defaultSemesters);

  // Migration state
  const [migrationRunning, setMigrationRunning] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [migrationMessage, setMigrationMessage] = useState('');
  const [staffMigrationRunning, setStaffMigrationRunning] = useState(false);
  const [staffMigrationStatus, setStaffMigrationStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [staffMigrationMessage, setStaffMigrationMessage] = useState('');
  const [staffMigrationFrom, setStaffMigrationFrom] = useState('');
  const [staffMigrationTo, setStaffMigrationTo] = useState('');
  const [staffMigrationResult, setStaffMigrationResult] = useState<StaffAttendanceMigrationResult | null>(null);

  const { prefixes } = useNamePrefix('teacher');

  const initialLoadRef = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Load ──
  useEffect(() => {
    const load = async () => {
      try {
        const [acadSnap, genSnap, semSnap] = await Promise.all([
          getDoc(doc(db, 'settings', 'academic_year')),
          getDoc(doc(db, 'settings', 'general')),
          getDoc(doc(db, 'settings', 'dept_semesters')),
        ]);
        if (acadSnap.exists()) setAcademic({ ...defaultAcademic, ...acadSnap.data() as AcademicYearSettings });
        if (genSnap.exists()) setGeneral({ ...defaultGeneral, ...genSnap.data() as GeneralSettings });
        if (semSnap.exists()) setSemesters({ ...defaultSemesters, ...semSnap.data() as DeptSemesterSettings });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
        setTimeout(() => { initialLoadRef.current = false; }, 800);
      }
    };
    load();
  }, []);

  // ── Auto-save (debounced 1.2s) ──
  useEffect(() => {
    if (initialLoadRef.current) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await Promise.all([
          setDoc(doc(db, 'settings', 'academic_year'), academic),
          general.schoolName.trim() ? setDoc(doc(db, 'settings', 'general'), general) : Promise.resolve(),
          setDoc(doc(db, 'settings', 'dept_semesters'), semesters),
        ]);
      } catch (err) { console.error(err); }
    }, 1200);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [academic, general, semesters]);

  const academicYearTH = parseInt(academic.currentYear) || currentYearBE;
  const academicYearEN = academicYearTH - 543;

  const updateDeptSemester = (dept: DeptId, val: DeptSemesters) => {
    setSemesters(prev => ({ ...prev, [dept]: val }));
  };

  const runEnrollmentMigration = async () => {
    setMigrationRunning(true);
    setMigrationStatus('running');
    setMigrationMessage('กำลังประมวลผล...');

    try {
      console.log('🚀 Starting enrollment migration...');

      // 1. Fetch all students
      const studentsSnap = await getDocs(collection(db, 'students'));
      const studentsWithClassroom = studentsSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(s => s.classroomId);

      console.log(`Found ${studentsWithClassroom.length} students with classroomId`);

      // 2. Fetch all classes
      const classesSnap = await getDocs(collection(db, 'classes'));
      const classesMap = new Map(
        classesSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as any])
      );

      console.log(`Found ${classesMap.size} classes`);

      // 3. Check existing enrollments
      const existingEnrollmentsSnap = await getDocs(collection(db, 'enrollments'));
      const existingPairs = new Set(
        existingEnrollmentsSnap.docs.map(
          d => `${d.data().studentId}:${d.data().classId}`
        )
      );

      console.log(`Found ${existingPairs.size} existing enrollment records`);

      // 4. Create batch
      let createdCount = 0;
      const batch = writeBatch(db);

      for (const student of studentsWithClassroom) {
        const classData = classesMap.get(student.classroomId);
        if (!classData) {
          console.warn(`⚠️  Student ${student.id} classroom not found`);
          continue;
        }

        const pair = `${student.id}:${student.classroomId}`;
        if (existingPairs.has(pair)) {
          console.log(`📌 Enrollment already exists: ${pair}`);
          continue;
        }

        const enrollmentRef = doc(collection(db, 'enrollments'));
        batch.set(enrollmentRef, {
          studentId: student.id,
          classId: student.classroomId,
          className: classData.className || '',
          academicYearId: classData.academicYearId || classData.academicYear || '2569',
          departmentId: classData.departmentId || '',
          gradeLevel: student.gradeLevel || classData.gradeLevel || '',
          semester: 1,
          status: 'studying',
          enrolledAt: new Date().toISOString().slice(0, 10),
        });

        createdCount++;
        console.log(`✅ Queued enrollment: ${student.id} → ${student.classroomId}`);
      }

      if (createdCount === 0) {
        setMigrationStatus('success');
        setMigrationMessage('ไม่มีการลงทะเบียนใหม่ที่ต้องสร้าง (ข้อมูลสมบูรณ์แล้ว)');
        toast.success('ข้อมูลลงทะเบียนสมบูรณ์แล้ว');
        return;
      }

      // 5. Commit batch
      await batch.commit();

      setMigrationStatus('success');
      setMigrationMessage(`สร้างการลงทะเบียนเสร็จสมบูรณ์! (${createdCount} รายการ)`);
      toast.success(`สร้าง ${createdCount} รายการลงทะเบียนสำเร็จ`);
      console.log(`✨ Migration complete! Created ${createdCount} enrollment records`);
    } catch (error) {
      console.error('❌ Migration failed:', error);
      setMigrationStatus('error');
      setMigrationMessage(error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการมิเกรชัน');
      toast.error('เกิดข้อผิดพลาด: ' + (error instanceof Error ? error.message : 'ไม่ทราบสาเหตุ'));
    } finally {
      setMigrationRunning(false);
    }
  };

  const parseDateInRange = (date: string, from: string, to: string) => {
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  };

  const toMillis = (value: unknown): number => {
    if (!value) return 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'object' && value !== null && 'toMillis' in value) {
      const fn = (value as { toMillis?: unknown }).toMillis;
      if (typeof fn === 'function') {
        try {
          return (fn as () => number)();
        } catch {
          return 0;
        }
      }
    }
    return 0;
  };

  const scoreAttendanceRecord = (data: Record<string, unknown>): number => {
    let score = 0;
    if (data.checkInTime) score += 1;
    if (data.checkOutTime) score += 2;
    if (typeof data.status === 'string' && data.status.length > 0) score += 1;
    if (typeof data.note === 'string' && data.note.length > 0) score += 1;
    return score;
  };

  const pickBestAttendanceRecord = (records: LocalAttendanceDoc[]): LocalAttendanceDoc => {
    return records.reduce((best, current) => {
      const bestScore = scoreAttendanceRecord(best.data);
      const currentScore = scoreAttendanceRecord(current.data);
      if (currentScore > bestScore) return current;
      if (currentScore < bestScore) return best;

      const bestCheckOut = toMillis(best.data.checkOutTime);
      const currentCheckOut = toMillis(current.data.checkOutTime);
      if (currentCheckOut !== bestCheckOut) {
        return currentCheckOut > bestCheckOut ? current : best;
      }

      const bestCheckIn = toMillis(best.data.checkInTime);
      const currentCheckIn = toMillis(current.data.checkInTime);
      if (bestCheckIn === 0 && currentCheckIn > 0) return current;
      if (currentCheckIn === 0 && bestCheckIn > 0) return best;
      if (bestCheckIn !== currentCheckIn) {
        return currentCheckIn < bestCheckIn ? current : best;
      }

      const bestLastTime = Math.max(bestCheckOut, bestCheckIn);
      const currentLastTime = Math.max(currentCheckOut, currentCheckIn);
      return currentLastTime > bestLastTime ? current : best;
    });
  };

  const runStaffAttendanceMigrationLocal = async (dryRun: boolean) => {
    const from = staffMigrationFrom.trim();
    const to = staffMigrationTo.trim();
    const dateReg = /^\d{4}-\d{2}-\d{2}$/;

    if (from && !dateReg.test(from)) throw new Error('รูปแบบวันที่เริ่มต้นไม่ถูกต้อง (YYYY-MM-DD)');
    if (to && !dateReg.test(to)) throw new Error('รูปแบบวันที่สิ้นสุดไม่ถูกต้อง (YYYY-MM-DD)');
    if (from && to && from > to) throw new Error('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');

    const legacySnap = await getDocs(collection(db, 'staff_attendance'));
    const grouped = new Map<string, LocalAttendanceDoc[]>();
    let invalid = 0;
    let outOfRange = 0;

    legacySnap.forEach((docSnap) => {
      const row = docSnap.data() as Record<string, unknown>;
      const userId = typeof row.userId === 'string' ? row.userId.trim() : '';
      const date = typeof row.date === 'string' ? row.date.trim() : '';
      if (!userId || !date || !dateReg.test(date)) {
        invalid += 1;
        return;
      }
      if (!parseDateInRange(date, from, to)) {
        outOfRange += 1;
        return;
      }

      const key = `${userId}__${date}`;
      const arr = grouped.get(key) ?? [];
      arr.push({ id: docSnap.id, data: row });
      grouped.set(key, arr);
    });

    let batch = writeBatch(db);
    let opCount = 0;
    const BATCH_LIMIT = 450;
    let migratedEntries = 0;
    let preservedExistingBetter = 0;
    let touchedDays = 0;
    let duplicateGroups = 0;
    const dayTouched = new Set<string>();
    const nowIso = new Date().toISOString();

    for (const [key, records] of grouped.entries()) {
      if (records.length > 1) duplicateGroups += 1;
      const [userId, date] = key.split('__');
      const legacyBest = pickBestAttendanceRecord(records);

      const targetRef = doc(db, 'staff_attendance_by_date', date, 'entries', userId);
      const targetSnap = await getDoc(targetRef);
      const candidates: LocalAttendanceDoc[] = [legacyBest];
      if (targetSnap.exists()) {
        candidates.push({ id: 'existing-target', data: targetSnap.data() as Record<string, unknown> });
      }
      const winner = pickBestAttendanceRecord(candidates);

      if (winner.id === 'existing-target') {
        preservedExistingBetter += 1;
        continue;
      }

      if (!dayTouched.has(date)) {
        const dayRef = doc(db, 'staff_attendance_by_date', date);
        batch.set(dayRef, { date, updatedAt: nowIso }, { merge: true });
        dayTouched.add(date);
        opCount += 1;
        touchedDays += 1;
      }

      batch.set(targetRef, {
        ...legacyBest.data,
        userId,
        date,
        migratedFromLegacyAt: nowIso,
        migratedFromLegacyDocId: legacyBest.id,
        updatedAt: nowIso,
      }, { merge: true });
      opCount += 1;
      migratedEntries += 1;

      if (opCount >= BATCH_LIMIT) {
        if (!dryRun) await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
        dayTouched.clear();
      }
    }

    if (opCount > 0 && !dryRun) {
      await batch.commit();
    }

    return {
      success: true,
      dryRun,
      range: { from: from || null, to: to || null },
      scannedLegacyDocs: legacySnap.size,
      groupedUserDateRecords: grouped.size,
      duplicateGroups,
      migratedEntries,
      preservedExistingBetter,
      touchedDays,
      skippedInvalidDocs: invalid,
      skippedOutOfRangeDocs: outOfRange,
    } as StaffAttendanceMigrationResult;
  };

  const runStaffAttendanceMigration = async (dryRun: boolean) => {
    setStaffMigrationRunning(true);
    setStaffMigrationStatus('running');
    setStaffMigrationMessage(dryRun ? 'กำลังจำลองผลลัพธ์ (Dry Run)...' : 'กำลังย้ายข้อมูลลงเวลา...');
    setStaffMigrationResult(null);

    try {
      if (staffMigrationFrom && staffMigrationTo && staffMigrationFrom > staffMigrationTo) {
        throw new Error('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');
      }

      const migrateFn = httpsCallable(functions, 'migrateStaffAttendanceByDate');
      const payload: { dryRun: boolean; from?: string; to?: string } = { dryRun };
      if (staffMigrationFrom) payload.from = staffMigrationFrom;
      if (staffMigrationTo) payload.to = staffMigrationTo;

      const res = await migrateFn(payload);
      const result = res.data as StaffAttendanceMigrationResult;
      setStaffMigrationResult(result);
      setStaffMigrationStatus('success');

      const summaryMsg = dryRun
        ? `Dry Run สำเร็จ: พบที่ต้องย้าย ${result.migratedEntries} รายการ`
        : `ย้ายสำเร็จ: ย้าย ${result.migratedEntries} รายการ (${result.touchedDays} วัน)`;
      setStaffMigrationMessage(summaryMsg);
      toast.success(summaryMsg);
    } catch (error) {
      const originalMsg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเรียก Cloud Function';
      const shouldFallbackToLocal =
        originalMsg.toLowerCase().includes('invoker')
        || originalMsg.toLowerCase().includes('permission')
        || originalMsg.toLowerCase().includes('not-found')
        || originalMsg.toLowerCase().includes('unavailable');

      if (shouldFallbackToLocal) {
        try {
          setStaffMigrationMessage('Cloud Function ใช้งานไม่ได้ กำลังสลับเป็นโหมด Local...');
          const localResult = await runStaffAttendanceMigrationLocal(dryRun);
          setStaffMigrationResult(localResult);
          setStaffMigrationStatus('success');
          const summaryMsg = dryRun
            ? `Dry Run (Local) สำเร็จ: พบที่ต้องย้าย ${localResult.migratedEntries} รายการ`
            : `ย้าย (Local) สำเร็จ: ย้าย ${localResult.migratedEntries} รายการ (${localResult.touchedDays} วัน)`;
          setStaffMigrationMessage(summaryMsg);
          toast.success(summaryMsg);
          return;
        } catch (localError) {
          const localMsg = localError instanceof Error ? localError.message : 'เกิดข้อผิดพลาดในโหมด Local';
          setStaffMigrationStatus('error');
          setStaffMigrationMessage(`${originalMsg} | Fallback Local failed: ${localMsg}`);
          toast.error(localMsg);
          return;
        }
      }

      setStaffMigrationStatus('error');
      setStaffMigrationMessage(originalMsg);
      toast.error(originalMsg);
    } finally {
      setStaffMigrationRunning(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-8 h-8 border-[3px] border-slate-200 border-t-slate-700 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="relative w-full bg-transparent h-full font-sarabun">
      {portalTarget && createPortal(
        <div className="flex items-center bg-white/60 backdrop-blur-xl border border-white p-1 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.04)] pointer-events-auto">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-1.5 rounded-full text-[11px] font-black transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-black/5'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>,
        portalTarget
      )}

      <div className={`max-w-[1200px] mx-auto flex flex-col h-full transition-all duration-300 gap-4 ${showSearch ? 'pt-1' : 'pt-4'} pb-16`}>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <AnimatePresence mode="wait">

            {/* General Info Tab */}
            {activeTab === 'general' && (
              <motion.div key="general" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-4 pb-4">

                {/* Academic Year */}
                <SectionCard
                  title="ปีการศึกษา"
                  icon={GraduationCap}
                  accent="#0f172a"
                  action={
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-400 font-sukhumvit tracking-widest uppercase">แก้ไข</span>
                      <Toggle value={editAcademic} onChange={setEditAcademic} color="#3b82f6" />
                    </div>
                  }
                >
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
                    <div>
                      <FieldLabel label="ปีการศึกษา (พ.ศ.)" required />
                      <Input
                        type="number"
                        value={academic.currentYear}
                        onChange={e => setAcademic({ ...academic, currentYear: e.target.value })}
                        className={inputStyle}
                        style={inputInlineStyle}
                        disabled={!editAcademic}
                      />
                    </div>
                    <div>
                      <FieldLabel label="ค.ศ." />
                      <div className="h-9 rounded-xl border flex items-center px-4 text-[13px] font-bold text-slate-500 bg-slate-50/60 border-slate-200/50">{academicYearEN}</div>
                    </div>
                    <div>
                      <FieldLabel label="วันเริ่มต้นปีการศึกษา" />
                      <div className="relative">
                        <BookOpen size={13} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                        <Input
                          type="date"
                          value={academic.startDate}
                          onChange={e => setAcademic({ ...academic, startDate: e.target.value })}
                          className={`${inputStyle} pl-8`}
                          style={inputInlineStyle}
                          disabled={!editAcademic}
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel label="วันสิ้นสุดปีการศึกษา" />
                      <div className="relative">
                        <BookOpen size={13} className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                        <Input
                          type="date"
                          value={academic.endDate}
                          onChange={e => setAcademic({ ...academic, endDate: e.target.value })}
                          className={`${inputStyle} pl-8`}
                          style={inputInlineStyle}
                          disabled={!editAcademic}
                        />
                      </div>
                    </div>
                    <div>
                      <FieldLabel label="ภาคเรียนปัจจุบัน" required />
                      <Select
                        value={String(academic.activeSemester ?? 1)}
                        onValueChange={v => setAcademic({ ...academic, activeSemester: Number(v) as 1 | 2 | 3 })}
                        disabled={!editAcademic}
                      >
                        <SelectTrigger className={inputStyle} style={inputInlineStyle}>
                          <SelectValue placeholder="เลือกภาคเรียน" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">ภาคเรียนที่ 1</SelectItem>
                          <SelectItem value="2">ภาคเรียนที่ 2</SelectItem>
                          <SelectItem value="3">ภาคฤดูร้อน</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-4 h-9 rounded-2xl flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-black text-emerald-700 font-sukhumvit tracking-wider">
                      ปีการศึกษา {academicYearTH} &nbsp;·&nbsp; {academic.startDate || '—'} ถึง {academic.endDate || '—'}
                    </span>
                  </div>
                </SectionCard>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <SectionCard
                    title="ข้อมูลสถานศึกษา"
                    icon={School}
                    action={
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 font-sukhumvit tracking-widest uppercase">แก้ไข</span>
                        <Toggle value={editIdentity} onChange={setEditIdentity} color="#3b82f6" />
                      </div>
                    }
                  >
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <FieldLabel label="ชื่อสถานศึกษา (TH)" required />
                        <Input value={general.schoolName} onChange={e => setGeneral({ ...general, schoolName: e.target.value })} className={inputStyle} style={inputInlineStyle} disabled={!editIdentity} />
                      </div>
                      <div>
                        <FieldLabel label="ชื่อสถานศึกษา (EN)" />
                        <Input value={general.schoolNameEn} onChange={e => setGeneral({ ...general, schoolNameEn: e.target.value })} className={inputStyle} style={inputInlineStyle} disabled={!editIdentity} />
                      </div>
                      <div>
                        <FieldLabel label="รหัสสถานศึกษา" />
                        <Input value={general.schoolCode} onChange={e => setGeneral({ ...general, schoolCode: e.target.value })} className={inputStyle} style={inputInlineStyle} disabled={!editIdentity} />
                      </div>
                      <div className="flex flex-col gap-2">
                        <FieldLabel label="ผู้รับใบอนุญาต" />
                        <div className="grid grid-cols-4 gap-2">
                          <div className="col-span-1">
                            <Select
                              value={general.licenseePrefix}
                              onValueChange={val => setGeneral({ ...general, licenseePrefix: val })}
                              disabled={!editIdentity}
                            >
                              <SelectTrigger className={inputStyle} style={inputInlineStyle}>
                                <SelectValue placeholder="เลือกคำนำหน้า" />
                              </SelectTrigger>
                              <SelectContent className="font-sarabun">
                                {prefixes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-3 grid grid-cols-2 gap-2">
                            <Input placeholder="ชื่อ" value={general.licenseeFirstName} onChange={e => setGeneral({ ...general, licenseeFirstName: e.target.value })} className={inputStyle} style={inputInlineStyle} disabled={!editIdentity} />
                            <Input placeholder="นามสกุล" value={general.licenseeLastName} onChange={e => setGeneral({ ...general, licenseeLastName: e.target.value })} className={inputStyle} style={inputInlineStyle} disabled={!editIdentity} />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <FieldLabel label="ผู้อำนวยการ" />
                        <div className="grid grid-cols-4 gap-2">
                          <div className="col-span-1">
                            <Select
                              value={general.principalPrefix}
                              onValueChange={val => setGeneral({ ...general, principalPrefix: val })}
                              disabled={!editIdentity}
                            >
                              <SelectTrigger className={inputStyle} style={inputInlineStyle}>
                                <SelectValue placeholder="เลือกคำนำหน้า" />
                              </SelectTrigger>
                              <SelectContent className="font-sarabun">
                                {prefixes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-3 grid grid-cols-2 gap-2">
                            <Input placeholder="ชื่อ" value={general.principalFirstName} onChange={e => setGeneral({ ...general, principalFirstName: e.target.value })} className={inputStyle} style={inputInlineStyle} disabled={!editIdentity} />
                            <Input placeholder="นามสกุล" value={general.principalLastName} onChange={e => setGeneral({ ...general, principalLastName: e.target.value })} className={inputStyle} style={inputInlineStyle} disabled={!editIdentity} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard
                    title="ข้อมูลที่ตั้งโรงเรียน"
                    icon={Info}
                    action={
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 font-sukhumvit tracking-widest uppercase">แก้ไข</span>
                        <Toggle value={editLocation} onChange={setEditLocation} color="#3b82f6" />
                      </div>
                    }
                  >
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <FieldLabel label="ที่อยู่ (เลขที่, หมู่, ซอย, ถนน)" />
                        <Input value={general.addressLine1} onChange={e => setGeneral({ ...general, addressLine1: e.target.value })} className={inputStyle} style={inputInlineStyle} disabled={!editLocation} />
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <FieldLabel label="ตำบล/แขวง" />
                          <Input value={general.subDistrict} onChange={e => setGeneral({ ...general, subDistrict: e.target.value })} className={inputStyle} style={inputInlineStyle} disabled={!editLocation} />
                        </div>
                        <div>
                          <FieldLabel label="อำเภอ/เขต" />
                          <Input value={general.district} onChange={e => setGeneral({ ...general, district: e.target.value })} className={inputStyle} style={inputInlineStyle} disabled={!editLocation} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <FieldLabel label="จังหวัด" />
                          <Input value={general.province} onChange={e => setGeneral({ ...general, province: e.target.value })} className={inputStyle} style={inputInlineStyle} disabled={!editLocation} />
                        </div>
                        <div>
                          <FieldLabel label="รหัสไปรษณีย์" />
                          <Input value={general.postalCode} onChange={e => setGeneral({ ...general, postalCode: e.target.value })} className={inputStyle} style={inputInlineStyle} disabled={!editLocation} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <FieldLabel label="เบอร์โทรศัพท์" />
                          <Input value={general.phone} onChange={e => setGeneral({ ...general, phone: e.target.value })} className={inputStyle} style={inputInlineStyle} disabled={!editLocation} />
                        </div>
                        <div>
                          <FieldLabel label="เว็บไซต์" />
                          <Input value={general.website} onChange={e => setGeneral({ ...general, website: e.target.value })} className={inputStyle} style={inputInlineStyle} disabled={!editLocation} />
                        </div>
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <FieldLabel label="URL Logo" />
                          <Input value={general.logoUrl} onChange={e => setGeneral({ ...general, logoUrl: e.target.value })} className={inputStyle} style={inputInlineStyle} disabled={!editLocation} />
                        </div>
                        {general.logoUrl && <img src={general.logoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-contain border bg-white flex-shrink-0" />}
                      </div>
                    </div>
                  </SectionCard>
                </div>
              </motion.div>
            )}

            {/* Semesters Tab */}
            {activeTab === 'semesters' && (
              <motion.div key="semesters" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 items-start">
                {DEPT_TABS.map(dept => (
                  <DeptSemesterCard
                    key={dept.id}
                    label={dept.label}
                    labelEn={dept.labelEn}
                    color={dept.color}
                    value={semesters[dept.id]}
                    onChange={val => updateDeptSemester(dept.id, val)}
                  />
                ))}
              </motion.div>
            )}

            {/* Migration Tab */}
            {activeTab === 'migration' && (
              <motion.div key="migration" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-4 pb-4 max-w-2xl">

                <SectionCard
                  title="ย้ายข้อมูลการลงทะเบียน"
                  icon={Database}
                  accent="#7c3aed"
                >
                  <div className="flex flex-col gap-4">
                    <p className="text-[13px] text-slate-600 leading-relaxed">
                      สร้างบันทึกการลงทะเบียนสำหรับนักเรียนที่อยู่ในห้องเรียนแล้ว แต่ยังไม่มีบันทึกในระบบ
                    </p>

                    <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
                      <div className="flex gap-3">
                        <Info className="text-blue-600 flex-shrink-0 mt-0.5" size={16} />
                        <div className="flex-1 text-[12px] text-blue-700">
                          <p className="font-bold mb-1">สำหรับใช้เมื่อ:</p>
                          <ul className="list-disc list-inside space-y-1 text-blue-600">
                            <li>นักเรียนถูกเพิ่มไปยังห้องเรียนแล้วแต่ลงทะเบียนหายไป</li>
                            <li>เมื่อทำการเลื่อนชั้นครั้งแรกจากระบบเก่า</li>
                            <li>เพื่อให้นักเรียนปรากฏในระบบเช็คชื่อ</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {migrationStatus !== 'idle' && (
                      <div className={`rounded-2xl p-4 flex items-start gap-3 border ${
                        migrationStatus === 'running' ? 'bg-amber-50 border-amber-200' :
                        migrationStatus === 'success' ? 'bg-emerald-50 border-emerald-200' :
                        'bg-rose-50 border-rose-200'
                      }`}>
                        {migrationStatus === 'running' && (
                          <Loader2 className="text-amber-600 animate-spin flex-shrink-0 mt-0.5" size={16} />
                        )}
                        {migrationStatus === 'success' && (
                          <CheckCircle2 className="text-emerald-600 flex-shrink-0 mt-0.5" size={16} />
                        )}
                        {migrationStatus === 'error' && (
                          <AlertCircle className="text-rose-600 flex-shrink-0 mt-0.5" size={16} />
                        )}
                        <div className="flex-1">
                          <p className={`text-[12px] font-bold ${
                            migrationStatus === 'running' ? 'text-amber-700' :
                            migrationStatus === 'success' ? 'text-emerald-700' :
                            'text-rose-700'
                          }`}>
                            {migrationMessage}
                          </p>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={runEnrollmentMigration}
                      disabled={migrationRunning}
                      className={`w-full py-3 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all duration-300 ${
                        migrationRunning
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                          : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20 active:scale-95'
                      }`}
                    >
                      {migrationRunning && <Loader2 size={14} className="animate-spin" />}
                      {migrationRunning ? 'กำลังประมวลผล...' : 'เริ่มสร้างการลงทะเบียน'}
                    </button>
                  </div>
                </SectionCard>

                <SectionCard
                  title="ย้ายข้อมูลลงเวลาทำงาน (ย้อนหลัง)"
                  icon={Database}
                  accent="#0891b2"
                >
                  <div className="flex flex-col gap-4">
                    <p className="text-[13px] text-slate-600 leading-relaxed">
                      ย้ายข้อมูลจากโครงสร้างเก่า <code className="font-mono text-[12px]">staff_attendance</code> ไปเป็น
                      <code className="font-mono text-[12px]"> staff_attendance_by_date/{"{date}"}/entries/{"{userId}"}</code>
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <FieldLabel label="จากวันที่ (ไม่บังคับ)" />
                        <Input
                          type="date"
                          value={staffMigrationFrom}
                          onChange={e => setStaffMigrationFrom(e.target.value)}
                          className={inputStyle}
                          style={inputInlineStyle}
                          disabled={staffMigrationRunning}
                        />
                      </div>
                      <div>
                        <FieldLabel label="ถึงวันที่ (ไม่บังคับ)" />
                        <Input
                          type="date"
                          value={staffMigrationTo}
                          onChange={e => setStaffMigrationTo(e.target.value)}
                          className={inputStyle}
                          style={inputInlineStyle}
                          disabled={staffMigrationRunning}
                        />
                      </div>
                    </div>

                    <div className="bg-cyan-50 rounded-2xl p-4 border border-cyan-200">
                      <div className="flex gap-3">
                        <Info className="text-cyan-600 flex-shrink-0 mt-0.5" size={16} />
                        <div className="flex-1 text-[12px] text-cyan-700">
                          <p className="font-bold mb-1">คำแนะนำ:</p>
                          <ul className="list-disc list-inside space-y-1 text-cyan-600">
                            <li>กด <b>Dry Run</b> ก่อนทุกครั้งเพื่อดูจำนวนที่ต้องย้าย</li>
                            <li>ระบบจะเลือกข้อมูลที่สมบูรณ์กว่าอัตโนมัติเมื่อข้อมูลซ้ำ</li>
                            <li>การย้ายนี้ไม่ลบข้อมูลเก่า</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    {staffMigrationStatus !== 'idle' && (
                      <div className={`rounded-2xl p-4 flex items-start gap-3 border ${
                        staffMigrationStatus === 'running' ? 'bg-amber-50 border-amber-200' :
                        staffMigrationStatus === 'success' ? 'bg-emerald-50 border-emerald-200' :
                        'bg-rose-50 border-rose-200'
                      }`}>
                        {staffMigrationStatus === 'running' && (
                          <Loader2 className="text-amber-600 animate-spin flex-shrink-0 mt-0.5" size={16} />
                        )}
                        {staffMigrationStatus === 'success' && (
                          <CheckCircle2 className="text-emerald-600 flex-shrink-0 mt-0.5" size={16} />
                        )}
                        {staffMigrationStatus === 'error' && (
                          <AlertCircle className="text-rose-600 flex-shrink-0 mt-0.5" size={16} />
                        )}
                        <div className="flex-1">
                          <p className={`text-[12px] font-bold ${
                            staffMigrationStatus === 'running' ? 'text-amber-700' :
                            staffMigrationStatus === 'success' ? 'text-emerald-700' :
                            'text-rose-700'
                          }`}>
                            {staffMigrationMessage}
                          </p>
                        </div>
                      </div>
                    )}

                    {staffMigrationResult && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[12px] text-slate-700">
                        <p className="font-bold mb-2">สรุปผลการประมวลผล</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <span>Legacy ทั้งหมด:</span><span className="font-semibold text-right">{staffMigrationResult.scannedLegacyDocs}</span>
                          <span>กลุ่ม user+date:</span><span className="font-semibold text-right">{staffMigrationResult.groupedUserDateRecords}</span>
                          <span>กลุ่มข้อมูลซ้ำ:</span><span className="font-semibold text-right">{staffMigrationResult.duplicateGroups}</span>
                          <span>ย้าย/อัปเดตแล้ว:</span><span className="font-semibold text-right">{staffMigrationResult.migratedEntries}</span>
                          <span>ข้ามเพราะของใหม่ดีกว่า:</span><span className="font-semibold text-right">{staffMigrationResult.preservedExistingBetter}</span>
                          <span>จำนวนวันแตะข้อมูล:</span><span className="font-semibold text-right">{staffMigrationResult.touchedDays}</span>
                          <span>ข้ามข้อมูลผิดรูปแบบ:</span><span className="font-semibold text-right">{staffMigrationResult.skippedInvalidDocs}</span>
                          <span>ข้ามนอกช่วงวันที่:</span><span className="font-semibold text-right">{staffMigrationResult.skippedOutOfRangeDocs}</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button
                        onClick={() => runStaffAttendanceMigration(true)}
                        disabled={staffMigrationRunning}
                        className={`w-full py-3 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all duration-300 ${
                          staffMigrationRunning
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-700 hover:bg-slate-800 text-white shadow-lg shadow-slate-700/20 active:scale-95'
                        }`}
                      >
                        {staffMigrationRunning && <Loader2 size={14} className="animate-spin" />}
                        {staffMigrationRunning ? 'กำลังประมวลผล...' : 'Dry Run'}
                      </button>

                      <button
                        onClick={() => runStaffAttendanceMigration(false)}
                        disabled={staffMigrationRunning}
                        className={`w-full py-3 rounded-2xl font-bold text-[13px] flex items-center justify-center gap-2 transition-all duration-300 ${
                          staffMigrationRunning
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-lg shadow-cyan-600/20 active:scale-95'
                        }`}
                      >
                        {staffMigrationRunning && <Loader2 size={14} className="animate-spin" />}
                        {staffMigrationRunning ? 'กำลังประมวลผล...' : 'ย้ายข้อมูลจริง'}
                      </button>
                    </div>
                  </div>
                </SectionCard>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}
