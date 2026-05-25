import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap, ChevronDown, Settings2, Upload, RefreshCw, BookOpen, AlertCircle, ClipboardList,
  ArrowLeft, Users, TrendingUp, Monitor,
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useTeachingManager } from '@/hooks/useTeachingManager';
import { useGradeBook } from '@/hooks/useGradeBook';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import GradeTable from './components/GradeTable';
import GradeConfigPanel from './components/GradeConfigPanel';
import { Switch } from '@/components/ui/switch';
import { GLASS } from '@/components/layouts/PortalLayout';
import type { GradeWeightConfig } from '@/types/grades';
import { CATEGORY_CONFIG, DEPARTMENT_CONFIG, type Department, type Subject } from '@/types/curriculum';
import { GRADE_LEVEL_ORDER } from '@/types/class';
import type { Exam, ExamScore, ExamType } from '@/types/teaching';
import type { ExamRoom, ExamAttempt } from '@/types/exam';

type Tab = 'table' | 'config' | 'exams';

const EXAM_TYPE_LABEL: Record<ExamType, string> = {
  midterm: 'กลางภาค',
  final: 'ปลายภาค',
  quiz: 'เก็บคะแนน',
  makeup: 'แก้ตัว',
};

const EXAM_TYPE_COLOR: Record<ExamType, { text: string; bg: string }> = {
  midterm: { text: '#e11d48', bg: '#ffe4e6' },
  final: { text: '#7c3aed', bg: '#f3e8ff' },
  quiz: { text: '#d97706', bg: '#fef3c7' },
  makeup: { text: '#059669', bg: '#d1fae5' },
};

function SelectField({
  label, value, onChange, children, disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest font-sukhumvit">{label}</label>
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          className="w-full h-10 rounded-3xl pl-3 pr-8 text-xs font-medium font-sarabun appearance-none outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(200,180,255,0.4)' }}
        >
          {children}
        </select>
        <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

export default function GradeBookPage() {
  const { user, role } = useAuth();
  const { year: academicYear, activeSemester } = useActiveAcademicYear();
  const teachingMgr = useTeachingManager(user?.uid ?? '');
  const gradeBook = useGradeBook();
  const curriculum = useCurriculum();
  const { coursesByVersion, loadCoursesForVersion } = useCurriculumVersioned();

  const [filterDepartment, setFilterDepartment] = useState<string>('');
  const [filterGradeLevel, setFilterGradeLevel] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>((activeSemester as 1 | 2) ?? 1);

  const [activeTab, setActiveTab] = useState<Tab>('table');
  const [showAsPercentage, setShowAsPercentage] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishDone, setPublishDone] = useState(false);

  const [examLoading, setExamLoading] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [subjectExams, setSubjectExams] = useState<Exam[]>([]);
  const [examScoresByExamId, setExamScoresByExamId] = useState<Record<string, ExamScore[]>>({});
  const [selectedExamId, setSelectedExamId] = useState('');

  // ── Online exam rooms (exam_rooms collection) ─────────────────────────────
  const [onlineRooms, setOnlineRooms] = useState<ExamRoom[]>([]);
  const [onlineAttemptsByRoomId, setOnlineAttemptsByRoomId] = useState<Record<string, ExamAttempt[]>>({});
  const [selectedOnlineRoomId, setSelectedOnlineRoomId] = useState('');

  const availableClasses = useMemo(() => {
    const all = teachingMgr.classes;
    if (role === 'teacher' && user?.uid) {
      return all.filter(c => (c.enrolledCourses ?? []).some(ec => ec.teacherId === user.uid));
    }
    return all;
  }, [teachingMgr.classes, role, user?.uid]);

  const availableDepartments = useMemo(() => {
    const depts = new Set<string>();
    availableClasses.forEach(c => c.departmentId && depts.add(c.departmentId));
    return Array.from(depts);
  }, [availableClasses]);

  const availableGrades = useMemo(() => {
    if (!filterDepartment) return [];
    const grades = new Set<string>();
    availableClasses
      .filter(c => c.departmentId === filterDepartment)
      .forEach(c => c.gradeLevel && grades.add(c.gradeLevel));
    return Array.from(grades).sort((a, b) => (GRADE_LEVEL_ORDER[a] ?? 99) - (GRADE_LEVEL_ORDER[b] ?? 99));
  }, [availableClasses, filterDepartment]);

  const filteredClasses = useMemo(() => {
    if (!filterDepartment || !filterGradeLevel) return [];
    return availableClasses.filter(c => c.departmentId === filterDepartment && c.gradeLevel === filterGradeLevel);
  }, [availableClasses, filterDepartment, filterGradeLevel]);

  const selectedClass = useMemo(
    () => availableClasses.find(c => c.id === selectedClassId) ?? null,
    [availableClasses, selectedClassId],
  );

  const allVersionedCourses = useMemo(
    () => Object.values(coursesByVersion).flat(),
    [coursesByVersion],
  );

  const subjectById = useMemo(() => {
    const m = new Map<string, Subject>();

    curriculum.subjects.forEach(s => m.set(s.id, s));

    allVersionedCourses.forEach(v => {
      if (m.has(v.id)) return;
      const department = v.department === 'early' || v.department === 'primary' || v.department === 'secondary'
        ? v.department
        : 'secondary';
      const category = v.category === 'basic' ? 'core' : v.category === 'additional' ? 'added' : 'activity';
      m.set(v.id, {
        id: v.id,
        code: v.courseCode ?? '',
        name: v.courseName,
        credits: v.credit || 0,
        hoursPerWeek: v.periodsPerWeek ?? 1,
        totalHours: v.totalHours ?? (v.periodsPerWeek ?? 1) * 18,
        department,
        category,
        subjectGroup: v.subjectGroup,
        gradeLevel: v.gradeLevel,
      });
    });

    teachingMgr.mySubjects.forEach(s => {
      if (!m.has(s.id)) m.set(s.id, s);
    });

    return m;
  }, [curriculum.subjects, allVersionedCourses, teachingMgr.mySubjects]);

  const availableSubjects = useMemo(() => {
    if (!selectedClass) return [];
    const teacherId = user?.uid ?? '';
    const byId = new Set<string>();

    (selectedClass.enrolledCourses ?? []).forEach(ec => {
      const passSemester = ec.semester == null || ec.semester === selectedSemester;
      const passTeacher = role !== 'teacher' || ec.teacherId === teacherId;
      if (passSemester && passTeacher) byId.add(ec.subjectId);
    });

    return Array.from(byId)
      .map(id => subjectById.get(id))
      .filter((s): s is Subject => Boolean(s))
      .sort((a, b) => (a.code || '').localeCompare(b.code || '') || a.name.localeCompare(b.name, 'th'));
  }, [selectedClass, selectedSemester, role, user?.uid, subjectById]);

  const selectedSubject = useMemo(
    () => availableSubjects.find(s => s.id === selectedSubjectId) ?? null,
    [availableSubjects, selectedSubjectId],
  );

  const selectedExam = useMemo(
    () => subjectExams.find(ex => ex.id === selectedExamId) ?? null,
    [subjectExams, selectedExamId],
  );

  const selectedExamRows = useMemo(() => {
    if (!selectedClassId || !selectedExamId) return [];
    const students = teachingMgr.getStudentsForClass(selectedClassId).map(({ student }) => ({
      studentId: student.id,
      studentName: `${student.prefix}${student.firstName} ${student.lastName}`,
      studentCode: student.studentCode ?? '',
    }));
    const scoreMap = new Map((examScoresByExamId[selectedExamId] ?? []).map(sc => [sc.studentId, sc]));
    return students.map(st => {
      const score = scoreMap.get(st.studentId);
      return {
        ...st,
        absent: score?.absent ?? false,
        score: score?.score,
        note: score?.note ?? '',
      };
    });
  }, [selectedClassId, selectedExamId, teachingMgr, examScoresByExamId]);

  const examCards = useMemo(() => {
    return subjectExams.map(exam => {
      const scores = examScoresByExamId[exam.id] ?? [];
      const gradedScores = scores.filter(s => !s.absent && typeof s.score === 'number').map(s => s.score as number);
      const avg = gradedScores.length > 0
        ? Math.round((gradedScores.reduce((sum, n) => sum + n, 0) / gradedScores.length) * 10) / 10
        : null;
      const classStudentCount = teachingMgr.getStudentsForClass(exam.classId).length;
      const totalCount = scores.length > 0 ? scores.length : classStudentCount;
      return {
        ...exam,
        gradedCount: gradedScores.length,
        totalCount,
        avgScore: avg,
      };
    });
  }, [subjectExams, examScoresByExamId, teachingMgr]);

  // computed: online exam room cards
  const onlineRoomCards = useMemo(() => {
    return onlineRooms.map(room => {
      const attempts = onlineAttemptsByRoomId[room.id] ?? [];
      const gradedAttempts = attempts.filter(a => typeof a.score === 'number');
      const classStudentCount = teachingMgr.getStudentsForClass(room.classId ?? '').length;
      const totalCount = attempts.length > 0 ? attempts.length : classStudentCount;
      const avg = gradedAttempts.length > 0
        ? Math.round((gradedAttempts.reduce((s, a) => s + (a.score as number), 0) / gradedAttempts.length) * 10) / 10
        : null;
      const maxScore = room.settings?.scoreCollectionMaxScore ?? room.totalPoints ?? 100;
      return { ...room, gradedCount: gradedAttempts.length, totalCount, avgScore: avg, maxScore };
    });
  }, [onlineRooms, onlineAttemptsByRoomId, teachingMgr]);

  // computed: rows for selected online room detail
  const selectedOnlineRoom = useMemo(
    () => onlineRoomCards.find(r => r.id === selectedOnlineRoomId) ?? null,
    [onlineRoomCards, selectedOnlineRoomId],
  );

  const selectedOnlineRoomRows = useMemo(() => {
    if (!selectedOnlineRoomId || !selectedClassId) return [];
    const students = teachingMgr.getStudentsForClass(selectedClassId).map(({ student }) => ({
      studentId: student.id,
      studentName: `${student.prefix}${student.firstName} ${student.lastName}`,
      studentCode: student.studentCode ?? '',
    }));
    const attMap = new Map(
      (onlineAttemptsByRoomId[selectedOnlineRoomId] ?? []).map(a => [a.studentId, a]),
    );
    return students.map(st => {
      const att = attMap.get(st.studentId);
      return {
        ...st,
        status: att?.status ?? null,
        score: att?.score ?? null,
        round: att?.round ?? null,
      };
    });
  }, [selectedOnlineRoomId, selectedClassId, teachingMgr, onlineAttemptsByRoomId]);

  useEffect(() => {
    if (!selectedClassId) return;
    setSelectedSubjectId('');
    setSelectedExamId('');
    setSelectedOnlineRoomId('');
    setActiveTab('table');
  }, [selectedSemester, selectedClassId]);

  // reset tab เมื่อเปลี่ยนวิชา
  useEffect(() => {
    setSelectedExamId('');
    setSelectedOnlineRoomId('');
    setActiveTab('table');
  }, [selectedSubjectId]);

  // Load versioned courses when a class with a curriculumPackageId is selected
  useEffect(() => {
    if (!selectedClass?.curriculumPackageId) return;
    loadCoursesForVersion(selectedClass.curriculumPackageId);
  }, [selectedClass?.curriculumPackageId, loadCoursesForVersion]);

  useEffect(() => {
    if (!selectedClassId || !selectedSubjectId || !academicYear) return;
    if (!selectedClass || !selectedSubject) return;

    const students = teachingMgr.getStudentsForClass(selectedClassId).map(({ student }) => ({
      studentId: student.id,
      studentName: `${student.prefix}${student.firstName} ${student.lastName}`,
      studentCode: student.studentCode ?? '',
      photoURL: student.photoURL,
      gender: student.gender as 'male' | 'female' | undefined,
    }));

    const departmentId = (selectedClass.departmentId ?? 'secondary') as Department;

    gradeBook.loadGradeBook({
      subjectId: selectedSubjectId,
      subjectName: selectedSubject.name,
      subjectCode: selectedSubject.code ?? '',
      classId: selectedClassId,
      className: selectedClass.className,
      teacherId: user?.uid ?? '',
      departmentId,
      academicYearId: String(academicYear),
      semester: selectedSemester,
      students,
    });
  }, [selectedClassId, selectedSubjectId, selectedSemester, academicYear, selectedClass, selectedSubject, user?.uid, teachingMgr, gradeBook]);

  useEffect(() => {
    let cancelled = false;

    const loadExams = async () => {
      if (!selectedClassId || !selectedSubjectId || !academicYear) {
        setSubjectExams([]);
        setExamScoresByExamId({});
        setSelectedExamId('');
        setOnlineRooms([]);
        setOnlineAttemptsByRoomId({});
        setSelectedOnlineRoomId('');
        setExamError(null);
        return;
      }

      setExamLoading(true);
      setExamError(null);

      try {
        const exams: Exam[] = [];
        const scoresMap: Record<string, ExamScore[]> = {};


        // ── 2. exam_rooms collection (online exam) ─────────────────────────
        // ยิง 2 query พร้อมกัน: by classId และ by gradeLevel (ห้องสอบอาจผูกแค่ระดับชั้น)
        // กรองวิชาใน client เพราะ gradeBookSubjectId อยู่ใน nested settings field
        const selectedGradeLevel = selectedClass?.gradeLevel ?? '';
        const [roomsByClass, roomsByGrade] = await Promise.all([
          getDocs(query(
            collection(db, 'exam_rooms'),
            where('classId', '==', selectedClassId),
            where('academicYearId', '==', String(academicYear)),
            where('semester', '==', selectedSemester),
          )),
          selectedGradeLevel
            ? getDocs(query(
                collection(db, 'exam_rooms'),
                where('gradeLevel', '==', selectedGradeLevel),
                where('academicYearId', '==', String(academicYear)),
                where('semester', '==', selectedSemester),
              ))
            : Promise.resolve(null),
        ]);
        // merge และ dedup ด้วย id
        const roomsSnapDocs = [
          ...roomsByClass.docs,
          ...(roomsByGrade?.docs.filter(d => !roomsByClass.docs.some(c => c.id === d.id)) ?? []),
        ];
        const roomsSnap = { docs: roomsSnapDocs };

        const normalizeTs = (val: unknown): number => {
          if (typeof val === 'number') return val;
          if (val && typeof (val as { toMillis?: () => number }).toMillis === 'function')
            return (val as { toMillis: () => number }).toMillis();
          if (val && typeof (val as { seconds?: number }).seconds === 'number')
            return (val as { seconds: number; nanoseconds?: number }).seconds * 1000 + ((val as { nanoseconds?: number }).nanoseconds ?? 0) / 1e6;
          return 0;
        };

        const rooms = roomsSnap.docs
          .map(d => {
            const raw = d.data();
            return {
              ...raw,
              id: d.id,
              startTime: normalizeTs(raw.startTime),
              endTime: normalizeTs(raw.endTime),
              createdAt: normalizeTs(raw.createdAt),
            } as ExamRoom;
          })
          .filter(r => {
            // ตรวจสอบการผูกวิชา (priority): gradeBookSubjects > gradeBookSubjectId > subjectId
            const linked = r.settings?.gradeBookSubjects ?? [];
            if (linked.length > 0) {
              // มีการผูกวิชาแบบ array → ตรวจว่า subjectId ตรง
              return linked.some(s => s.subjectId === selectedSubjectId);
            }
            if (r.settings?.gradeBookSubjectId) {
              // มีการผูกวิชาแบบ single field → ตรวจ field นั้น
              return r.settings.gradeBookSubjectId === selectedSubjectId;
            }
            // ไม่มีการผูกวิชาผ่าน settings → fallback: ตรวจ subjectId ตรงๆ
            // (แสดงเฉพาะที่ scoreCollectionEnabled เพื่อป้องกันห้องที่ไม่เกี่ยวข้อง)
            if (r.settings?.scoreCollectionEnabled === true) {
              return r.subjectId === selectedSubjectId;
            }
            return false;
          })
          .sort((a, b) => b.createdAt - a.createdAt);

        const attemptsMap: Record<string, ExamAttempt[]> = {};

        await Promise.all(rooms.map(async (room) => {
          const attSnap = await getDocs(query(
            collection(db, 'exam_rooms', room.id, 'attempts'),
            where('status', 'in', ['submitted', 'graded']),
          ));
          attSnap.docs.forEach(d => {
            const raw = d.data();
            const att = {
              ...raw,
              id: d.id,
              roomId: room.id,
              startedAt: normalizeTs(raw.startedAt),
              submittedAt: raw.submittedAt ? normalizeTs(raw.submittedAt) : null,
              lastSavedAt: normalizeTs(raw.lastSavedAt),
            } as ExamAttempt;
            if (!attemptsMap[room.id]) attemptsMap[room.id] = [];
            attemptsMap[room.id].push(att);
          });
        }));

        if (cancelled) return;
        setSubjectExams(exams);
        setExamScoresByExamId(scoresMap);
        setSelectedExamId(prev => (prev && exams.some(e => e.id === prev) ? prev : ''));
        setOnlineRooms(rooms);
        setOnlineAttemptsByRoomId(attemptsMap);
        setSelectedOnlineRoomId('');
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setSubjectExams([]);
        setExamScoresByExamId({});
        setSelectedExamId('');
        setOnlineRooms([]);
        setOnlineAttemptsByRoomId({});
        setSelectedOnlineRoomId('');
        setExamError('ไม่สามารถโหลดรายการการสอบได้');
      } finally {
        if (!cancelled) setExamLoading(false);
      }
    };

    loadExams();
    return () => { cancelled = true; };
  }, [selectedClassId, selectedSubjectId, selectedSemester, academicYear]);

  const handlePublish = async () => {
    if (!selectedClass || !selectedSubject || !academicYear) return;
    setPublishing(true);
    setPublishDone(false);
    await gradeBook.publishGrades({
      subjectId: selectedSubjectId,
      subjectName: selectedSubject.name,
      subjectCode: selectedSubject.code ?? '',
      classId: selectedClassId,
      className: selectedClass.className,
      teacherId: user?.uid ?? '',
      departmentId: (selectedClass.departmentId ?? 'secondary') as Department,
      academicYearId: String(academicYear),
      semester: selectedSemester,
    });
    setPublishing(false);
    setPublishDone(true);
    setTimeout(() => setPublishDone(false), 3000);
  };

  const handleReload = () => {
    if (!selectedClass || !selectedSubject || !academicYear) return;
    const students = teachingMgr.getStudentsForClass(selectedClassId).map(({ student }) => ({
      studentId: student.id,
      studentName: `${student.prefix}${student.firstName} ${student.lastName}`,
      studentCode: student.studentCode ?? '',
      photoURL: student.photoURL,
      gender: student.gender as 'male' | 'female' | undefined,
    }));
    gradeBook.loadGradeBook({
      subjectId: selectedSubjectId,
      subjectName: selectedSubject.name,
      subjectCode: selectedSubject.code ?? '',
      classId: selectedClassId,
      className: selectedClass.className,
      teacherId: user?.uid ?? '',
      departmentId: (selectedClass.departmentId ?? 'secondary') as Department,
      academicYearId: String(academicYear),
      semester: selectedSemester,
      students,
    });
  };

  if (!academicYear) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-3 rounded-2xl border border-amber-200">
          <AlertCircle size={16} />
          <p className="text-sm font-sarabun">กรุณาตั้งค่าปีการศึกษาก่อนใช้งาน</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-[2rem] p-4 flex flex-col gap-3 shrink-0"
        style={GLASS}
      >
        <div className="flex items-center gap-2">
          {selectedSubjectId ? (
            <button
              onClick={() => { setSelectedSubjectId(''); setSelectedExamId(''); }}
              className="w-9 h-9 flex items-center justify-center rounded-2xl bg-white/60 text-slate-500 hover:bg-white/80 transition-colors shadow-sm"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
              <GraduationCap size={16} className="text-white" />
            </div>
          )}
          <div>
            <p className="text-[14px] font-black text-slate-800 font-sukhumvit">
              {selectedSubjectId && selectedSubject ? selectedSubject.name : 'สมุดบันทึกคะแนน'}
            </p>
            <p className="text-[11px] text-slate-400 font-sarabun">
              {selectedSubjectId && selectedClass ? `${selectedClass.className} · ` : ''}ปีการศึกษา {academicYear} · ภาคเรียนที่ {selectedSemester}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={handleReload}
            className="ml-auto w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors"
          >
            <RefreshCw size={13} />
          </motion.button>
        </div>

        {!selectedSubjectId && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <SelectField
            label="Step 1: แผนก"
            value={filterDepartment}
            onChange={v => {
              setFilterDepartment(v);
              setFilterGradeLevel('');
              setSelectedClassId('');
              setSelectedSubjectId('');
              setSelectedExamId('');
            }}
          >
            <option value="">— เลือกแผนก —</option>
            {availableDepartments.map(d => (
              <option key={d} value={d}>{DEPARTMENT_CONFIG[d as Department]?.label ?? d}</option>
            ))}
          </SelectField>

          <SelectField
            label="Step 2: ระดับชั้น"
            value={filterGradeLevel}
            disabled={!filterDepartment}
            onChange={v => {
              setFilterGradeLevel(v);
              setSelectedClassId('');
              setSelectedSubjectId('');
              setSelectedExamId('');
            }}
          >
            <option value="">— เลือกระดับชั้น —</option>
            {availableGrades.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </SelectField>

          <SelectField
            label="Step 3: ห้อง"
            value={selectedClassId}
            disabled={!filterDepartment || !filterGradeLevel}
            onChange={v => {
              setSelectedClassId(v);
              setSelectedSubjectId('');
              setSelectedExamId('');
            }}
          >
            <option value="">— เลือกห้องเรียน —</option>
            {filteredClasses.map(c => (
              <option key={c.id} value={c.id}>{c.className}</option>
            ))}
          </SelectField>
        </div>
        )}

        {selectedClassId && !selectedSubjectId && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit">เทอม</span>
              {[1, 2].map(sem => (
                <button
                  key={sem}
                  onClick={() => setSelectedSemester(sem as 1 | 2)}
                  className="px-3 py-1.5 rounded-full text-[11px] font-bold font-sukhumvit transition-all"
                  style={{
                    background: selectedSemester === sem ? '#0f172a' : 'rgba(241,245,249,0.8)',
                    color: selectedSemester === sem ? '#fff' : '#64748b',
                  }}
                >
                  ภาคเรียนที่ {sem}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider font-sukhumvit">
                รายวิชาที่ลงทะเบียนในห้องนี้
              </p>
              {availableSubjects.length === 0 ? (
                <div className="rounded-2xl px-4 py-3 text-[12px] text-slate-400 font-sarabun border border-dashed border-slate-200 bg-white/60">
                  ยังไม่มีรายวิชาที่ลงทะเบียนสำหรับภาคเรียนที่ {selectedSemester}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {availableSubjects.map(subject => {
                    const isActive = selectedSubjectId === subject.id;
                    const cat = CATEGORY_CONFIG[subject.category];
                    return (
                      <button
                        key={subject.id}
                        onClick={() => {
                          setSelectedSubjectId(subject.id);
                          setSelectedExamId('');
                        }}
                        className="text-left rounded-2xl p-3 border transition-all"
                        style={{
                          background: isActive ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.8)',
                          borderColor: isActive ? 'rgba(15,23,42,0.95)' : 'rgba(226,232,240,0.9)',
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-[9px] font-bold px-2 py-0.5 rounded-lg font-sukhumvit"
                            style={{ background: isActive ? 'rgba(255,255,255,0.12)' : cat.bg, color: isActive ? '#fff' : cat.color }}
                          >
                            {cat.label}
                          </span>
                          {subject.code && (
                            <span className={`text-[10px] font-sarabun ${isActive ? 'text-white/70' : 'text-slate-400'}`}>
                              {subject.code}
                            </span>
                          )}
                        </div>
                        <p className={`text-[12px] font-bold font-sukhumvit line-clamp-2 ${isActive ? 'text-white' : 'text-slate-800'}`}>
                          {subject.name}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {selectedClassId && selectedSubjectId && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'rgba(241,245,249,0.8)' }}>
              {([
                { key: 'table' as Tab, icon: <BookOpen size={11} />, label: 'ตารางคะแนนรวม' },
                { key: 'config' as Tab, icon: <Settings2 size={11} />, label: 'ตั้งค่าเกรด' },
                { key: 'exams' as Tab, icon: <ClipboardList size={11} />, label: 'คะแนนการสอบ' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold font-sukhumvit transition-all"
                  style={{
                    background: activeTab === tab.key ? '#0f172a' : 'transparent',
                    color: activeTab === tab.key ? '#fff' : '#64748b',
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {activeTab !== 'exams' && (
              <motion.button
                whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={handlePublish}
                disabled={publishing || gradeBook.summaries.length === 0}
              className="ml-auto h-9 px-4 rounded-xl text-xs font-bold text-white font-sukhumvit flex items-center gap-1.5 disabled:opacity-50 transition-all"
              style={{
                background: publishDone
                  ? 'linear-gradient(135deg,#059669,#047857)'
                  : 'linear-gradient(135deg,#3b82f6,#2563eb)',
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
              }}
            >
              {publishing
                ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Upload size={12} />
              }
                {publishDone ? 'บันทึกแล้ว ✓' : 'บันทึกเกรด'}
              </motion.button>
            )}
          </div>
        )}
      </motion.div>

      <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide space-y-3">
        {!filterDepartment ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm font-sarabun">เริ่มจากเลือกแผนกก่อน</div>
        ) : !filterGradeLevel ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm font-sarabun">เลือกระดับชั้นเพื่อไป Step ถัดไป</div>
        ) : !selectedClassId ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm font-sarabun">เลือกห้องเรียนเพื่อแสดงรายวิชา</div>
        ) : !selectedSubjectId ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-sm font-sarabun">เลือกวิชาเพื่อดูการสอบและคะแนนนักเรียน</div>
        ) : activeTab === 'exams' ? (
          /* ── Exams Tab ── */
          <AnimatePresence mode="wait">
            {!selectedExamId && !selectedOnlineRoomId ? (
              /* ── Grid view: รายการสอบทั้งหมด ── */
              <motion.div key="exam-grid"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-4"
              >
                {examLoading ? (
                  <div className="py-10 text-center text-[12px] text-slate-400 font-sarabun">กำลังโหลดการสอบ...</div>
                ) : examError ? (
                  <div className="py-10 text-center text-[12px] text-rose-500 font-sarabun">{examError}</div>
                ) : (
                  <>
                    {/* ── ส่วน: ห้องสอบออนไลน์ ── */}
                    <div className="rounded-[1.5rem] p-4 flex flex-col gap-3"
                      style={{ ...GLASS, background: 'rgba(255,255,255,0.78)' }}>
                      <div className="flex items-center gap-2">
                        <Monitor size={13} className="text-violet-500 shrink-0" />
                        <p className="text-[12px] font-black text-slate-700 font-sukhumvit">ห้องสอบออนไลน์</p>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full font-sukhumvit"
                          style={{ background: 'rgba(124,58,237,0.08)', color: '#7c3aed' }}>
                          เก็บคะแนนอัตโนมัติ
                        </span>
                      </div>
                      {onlineRoomCards.length === 0 ? (
                        <p className="text-[11px] text-slate-400 font-sarabun py-4 text-center">
                          ยังไม่มีห้องสอบออนไลน์สำหรับวิชานี้
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                          {onlineRoomCards.map(room => {
                            const scoreEnabled = room.settings?.scoreCollectionEnabled === true;
                            const scoreTypeCfg: Record<string, { label: string; color: string; bg: string }> = {
                              classwork: { label: 'เก็บคะแนน', color: '#d97706', bg: '#fef3c7' },
                              quiz:      { label: 'ทดสอบย่อย', color: '#d97706', bg: '#fef3c7' },
                              midterm:   { label: 'กลางภาค',   color: '#e11d48', bg: '#ffe4e6' },
                              final:     { label: 'ปลายภาค',   color: '#7c3aed', bg: '#f3e8ff' },
                            };
                            const scoreType = room.settings?.scoreCollectionType ?? 'classwork';
                            const typeCfg = scoreTypeCfg[scoreType] ?? scoreTypeCfg.classwork;
                            const statusCfg: Record<string, { label: string; color: string }> = {
                              upcoming: { label: 'รอเปิด',   color: '#2563eb' },
                              active:   { label: 'กำลังสอบ', color: '#059669' },
                              closed:   { label: 'ปิดแล้ว',  color: '#94a3b8' },
                            };
                            const stCfg = statusCfg[room.status] ?? statusCfg.closed;
                            const pct = room.totalCount > 0
                              ? Math.round((room.gradedCount / room.totalCount) * 100) : 0;
                            return (
                              <motion.button key={room.id}
                                whileHover={{ scale: scoreEnabled ? 1.01 : 1 }}
                                whileTap={{ scale: scoreEnabled ? 0.98 : 1 }}
                                onClick={() => scoreEnabled && setSelectedOnlineRoomId(room.id)}
                                className="text-left rounded-2xl p-4 border transition-all flex flex-col gap-2"
                                style={{
                                  background: scoreEnabled ? 'rgba(255,255,255,0.92)' : 'rgba(248,250,252,0.7)',
                                  borderColor: scoreEnabled ? 'rgba(226,232,240,0.9)' : 'rgba(226,232,240,0.5)',
                                  cursor: scoreEnabled ? 'pointer' : 'default',
                                  opacity: scoreEnabled ? 1 : 0.72,
                                }}
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  {scoreEnabled ? (
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg font-sukhumvit"
                                      style={{ background: typeCfg.bg, color: typeCfg.color }}>
                                      {typeCfg.label}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg font-sukhumvit"
                                      style={{ background: 'rgba(148,163,184,0.12)', color: '#94a3b8' }}>
                                      ยังไม่เปิดเก็บคะแนน
                                    </span>
                                  )}
                                  <span className="text-[9px] font-bold ml-auto font-sarabun" style={{ color: stCfg.color }}>
                                    ● {stCfg.label}
                                  </span>
                                </div>
                                <p className="text-[13px] font-black text-slate-800 font-sukhumvit line-clamp-2">{room.title}</p>
                                {scoreEnabled ? (
                                  <>
                                    <p className="text-[10px] text-slate-400 font-sarabun">
                                      {room.maxScore} คะแนน · รอบที่ {room.completedRounds}/{room.settings?.maxAttempts === 0 ? '∞' : (room.settings?.maxAttempts ?? 1)}
                                    </p>
                                    <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
                                      <div className="flex items-center gap-1 text-[10px] font-sarabun text-slate-500">
                                        <Users size={10} /><span>{room.gradedCount}/{room.totalCount} คน</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-[10px] font-sarabun text-slate-500">
                                        <TrendingUp size={10} /><span>เฉลี่ย {room.avgScore ?? '-'}</span>
                                      </div>
                                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden ml-auto">
                                        <div className="h-full rounded-full transition-all"
                                          style={{ width: `${pct}%`, background: '#7c3aed' }} />
                                      </div>
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-[10px] text-slate-400 font-sarabun">
                                    เปิด "นำคะแนนไปใช้" ในห้องสอบเพื่อแสดงผลที่นี่
                                  </p>
                                )}
                              </motion.button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </motion.div>
            ) : selectedOnlineRoomId && selectedOnlineRoom ? (
              /* ── Online room detail ── */
              <motion.div key="online-detail"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                <button
                  onClick={() => setSelectedOnlineRoomId('')}
                  className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold font-sukhumvit text-slate-600 bg-white/80 border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft size={12} />กลับรายการสอบ
                </button>

                <div className="rounded-[1.5rem] p-4 flex flex-col gap-3"
                  style={{ ...GLASS, background: 'rgba(255,255,255,0.82)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Monitor size={13} className="text-violet-500 shrink-0" />
                      <p className="text-[13px] font-black text-slate-800 font-sukhumvit line-clamp-1">
                        {selectedOnlineRoom.title}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-sarabun shrink-0">
                      {selectedOnlineRoomRows.length} คน
                    </span>
                  </div>
                  <div className="rounded-2xl overflow-hidden border border-slate-100">
                    <div className="grid grid-cols-[2rem_1fr_6rem_6rem] gap-2 px-4 py-2 bg-slate-50">
                      <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit">#</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit">นักเรียน</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit text-center">สถานะ</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit text-center">
                        คะแนน/{selectedOnlineRoom.maxScore}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100 bg-white/80">
                      {selectedOnlineRoomRows.map((row, idx) => (
                        <div key={row.studentId} className="grid grid-cols-[2rem_1fr_6rem_6rem] gap-2 px-4 py-2.5 items-center">
                          <span className="text-[10px] font-bold text-slate-400 font-sukhumvit">{idx + 1}</span>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-slate-800 font-sukhumvit truncate">{row.studentName}</p>
                            <p className="text-[9px] text-slate-400 font-sarabun">{row.studentCode}</p>
                          </div>
                          <span className="text-center">
                            {row.status === 'graded' ? (
                              <span className="text-[9px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full font-sukhumvit">ตรวจแล้ว</span>
                            ) : row.status === 'submitted' ? (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-sukhumvit">ส่งแล้ว</span>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-sukhumvit">ไม่มีข้อมูล</span>
                            )}
                          </span>
                          <span className="text-center text-[11px] font-black text-slate-700 font-sukhumvit">
                            {row.score !== null ? row.score : '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* ── Manual exam detail (เดิม) ── */
              <motion.div key="exam-detail"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-col gap-3"
              >
                <button
                  onClick={() => setSelectedExamId('')}
                  className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold font-sukhumvit text-slate-600 bg-white/80 border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <ArrowLeft size={12} />กลับรายการสอบ
                </button>

                {examCards.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-[1.5rem] p-4"
                    style={{ ...GLASS, background: 'rgba(255,255,255,0.78)' }}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sukhumvit mb-2">เลือกการสอบ</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                      {examCards.map(exam => {
                        const active = selectedExamId === exam.id;
                        const cfg = EXAM_TYPE_COLOR[exam.type];
                        return (
                          <button key={exam.id}
                            onClick={() => setSelectedExamId(active ? '' : exam.id)}
                            className="shrink-0 text-left rounded-2xl px-3 py-2.5 border transition-all min-w-[160px]"
                            style={{
                              background: active ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.88)',
                              borderColor: active ? 'rgba(15,23,42,0.95)' : 'rgba(226,232,240,0.9)',
                            }}
                          >
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md font-sukhumvit"
                                style={{ background: active ? 'rgba(255,255,255,0.12)' : cfg.bg, color: active ? '#fff' : cfg.text }}>
                                {EXAM_TYPE_LABEL[exam.type]}
                              </span>
                            </div>
                            <p className={`text-[11px] font-bold font-sukhumvit line-clamp-1 ${active ? 'text-white' : 'text-slate-800'}`}>
                              {exam.title}
                            </p>
                            <p className={`text-[9px] font-sarabun mt-0.5 ${active ? 'text-white/60' : 'text-slate-400'}`}>
                              {exam.examDate} · {exam.gradedCount}/{exam.totalCount} คน
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                <AnimatePresence>
                  {selectedExam && (
                    <motion.div key={selectedExam.id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      className="rounded-[1.5rem] p-4"
                      style={{ ...GLASS, background: 'rgba(255,255,255,0.82)' }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <p className="text-[13px] font-black text-slate-800 font-sukhumvit">
                          คะแนนนักเรียน: {selectedExam.title}
                        </p>
                        <span className="text-[11px] text-slate-400 font-sarabun">{selectedExamRows.length} คน</span>
                      </div>
                      <div className="rounded-2xl overflow-hidden border border-slate-100">
                        <div className="grid grid-cols-[2rem_1fr_6rem_6rem] gap-2 px-4 py-2 bg-slate-50">
                          <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit">#</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit">นักเรียน</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit text-center">สถานะ</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase font-sukhumvit text-center">คะแนน</span>
                        </div>
                        <div className="divide-y divide-slate-100 bg-white/80">
                          {selectedExamRows.map((row, idx) => (
                            <div key={row.studentId} className="grid grid-cols-[2rem_1fr_6rem_6rem] gap-2 px-4 py-2.5 items-center">
                              <span className="text-[10px] font-bold text-slate-400 font-sukhumvit">{idx + 1}</span>
                              <div className="min-w-0">
                                <p className="text-[11px] font-bold text-slate-800 font-sukhumvit truncate">{row.studentName}</p>
                                <p className="text-[9px] text-slate-400 font-sarabun">{row.studentCode}</p>
                              </div>
                              <span className="text-center">
                                {row.absent ? (
                                  <span className="text-[9px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full font-sukhumvit">ขาดสอบ</span>
                                ) : (
                                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-sukhumvit">เข้าสอบ</span>
                                )}
                              </span>
                              <span className="text-center text-[11px] font-black text-slate-700 font-sukhumvit">
                                {row.score ?? '-'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          /* ── Table & Config Tabs ── */
          <>
            {/* Grade book */}
            {gradeBook.isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
                  <p className="text-[12px] text-slate-400 font-sarabun">กำลังโหลดข้อมูลคะแนนรวม...</p>
                </div>
              </div>
            ) : gradeBook.error ? (
              <div className="flex items-center justify-center h-32">
                <div className="flex items-center gap-2 text-rose-500 bg-rose-50 px-4 py-3 rounded-2xl border border-rose-200">
                  <AlertCircle size={15} />
                  <p className="text-sm font-sarabun">{gradeBook.error}</p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {activeTab === 'table' ? (
                  <motion.div key="table"
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                    {gradeBook.config && (
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center bg-white/40 p-3 rounded-2xl border border-white/60 mb-1">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sukhumvit">มุมมองการแสดงผล</span>
                            <span className="text-xs font-bold text-slate-600 font-sarabun">ปรับแต่งการแสดงคะแนนในตาราง</span>
                          </div>
                          <div className="flex items-center gap-3 bg-white/60 px-3 py-1.5 rounded-xl border border-slate-200/40">
                            <label className="flex items-center gap-2 cursor-pointer group">
                              <span className="text-[11px] font-bold text-slate-500 group-hover:text-slate-700 transition-colors font-sarabun">แสดงเป็นเปอร์เซ็นต์</span>
                              <Switch
                                checked={showAsPercentage}
                                onCheckedChange={setShowAsPercentage}
                              />
                            </label>
                          </div>
                        </div>
                        <GradeTable
                          summaries={gradeBook.summaries}
                          config={gradeBook.config}
                          showAsPercentage={showAsPercentage}
                          editable={role === 'teacher' || role === 'admin' || role === 'sysadmin'}
                          onUpdateScore={gradeBook.updateStudentScore}
                        />
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div key="config"
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                    {gradeBook.config && (
                      <GradeConfigPanel
                        config={gradeBook.config}
                        onSave={async (updated: GradeWeightConfig) => {
                          await gradeBook.saveConfig(updated);
                          gradeBook.recalculate(updated);
                        }}
                        onRecalculate={gradeBook.recalculate}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </>
        )}
      </div>
    </div>
  );
}
