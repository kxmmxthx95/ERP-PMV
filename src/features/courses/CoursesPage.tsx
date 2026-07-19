import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineFilm,
  HiOutlinePlusCircle,
  HiOutlineAcademicCap,
  HiOutlineXMark,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
} from 'react-icons/hi2';
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { logActivity } from '@/lib/activityLogger';
import { cn } from '@/lib/utils';
import { useCourseList } from './hooks/useCourseList';
import type { Course } from '@/types/course';
import type { SchoolClass } from '@/types/schedule';
import type { UserData } from '@/types/user';

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  published: { label: 'เผยแพร่', class: 'bg-emerald-100 text-emerald-700' },
  draft:     { label: 'แบบร่าง',  class: 'bg-amber-100 text-amber-700' },
  archived:  { label: 'เก็บถาวร', class: 'bg-gray-100 text-gray-500' },
};

// ── Create Course Modal ───────────────────────────────────────────────────────

interface CreateCourseForm {
  title: string;
  subjectName: string;
  subjectCode: string;
  description: string;
  status: 'draft' | 'published';
  classIds: string[];
}

const EMPTY_FORM: CreateCourseForm = {
  title: '',
  subjectName: '',
  subjectCode: '',
  description: '',
  status: 'draft',
  classIds: [],
};

interface CreateCourseModalProps {
  teacherId: string;
  teacherName: string;
  academicYearId: string;
  departmentId: string;
  onClose: () => void;
  onCreated: (courseId: string) => void;
}

function CreateCourseModal({
  teacherId,
  teacherName,
  academicYearId,
  departmentId,
  onClose,
  onCreated,
}: CreateCourseModalProps) {
  const [form, setForm] = useState<CreateCourseForm>(EMPTY_FORM);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch class list once when modal opens
  useEffect(() => {
    let cancelled = false;
    void getDocs(
      query(collection(db, 'classes'), where('academicYearId', '==', academicYearId)),
    ).then((snap) => {
      if (cancelled) return;
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as SchoolClass))
        .sort((a, b) => (a.className ?? '').localeCompare(b.className ?? '', 'th'));
      setClasses(rows);
      setClassesLoading(false);
    });
    return () => { cancelled = true; };
  }, [academicYearId]);

  const setField = <K extends keyof CreateCourseForm>(key: K, value: CreateCourseForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleClass = (id: string) => {
    setForm((prev) => ({
      ...prev,
      classIds: prev.classIds.includes(id)
        ? prev.classIds.filter((c) => c !== id)
        : [...prev.classIds, id],
    }));
  };

  const handleSubmit = useCallback(async () => {
    const title = form.title.trim();
    if (!title) { setError('กรุณากรอกชื่อคอร์ส'); return; }

    setSaving(true);
    setError(null);

    try {
      const docRef = await addDoc(collection(db, 'courses'), {
        title,
        description: form.description.trim(),
        subjectName: form.subjectName.trim(),
        subjectCode: form.subjectCode.trim(),
        thumbnailURL: '',
        departmentId,
        academicYearId,
        classIds: form.classIds,
        teacherId,
        teacherName,
        status: form.status,
        lessonCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await logActivity({
        action: 'course_create',
        category: 'academic',
        detail: `สร้างคอร์ส: ${title}`,
        targetId: docRef.id,
      });

      onCreated(docRef.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด กรุณาลองใหม่');
      setSaving(false);
    }
  }, [form, teacherId, teacherName, academicYearId, departmentId, onCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          className="w-full max-w-lg rounded-2xl border border-black/10 shadow-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/8">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-xl bg-blue-600 flex items-center justify-center">
                <HiOutlinePlusCircle className="size-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-black/80">สร้างคอร์สใหม่</p>
                <p className="text-[11px] text-black/40">ปีการศึกษา {academicYearId}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={saving}
              className="size-8 rounded-xl flex items-center justify-center hover:bg-black/6 transition-colors disabled:opacity-40"
            >
              <HiOutlineXMark className="size-4 text-black/50" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">

            {/* ชื่อคอร์ส */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-black/50 uppercase tracking-wider">
                ชื่อคอร์ส <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="เช่น คณิตศาสตร์พื้นฐาน ม.1"
                className="w-full h-9 px-3.5 rounded-xl border border-black/10 bg-black/3 text-sm text-black/80 placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                disabled={saving}
                autoFocus
              />
            </div>

            {/* ชื่อวิชา + รหัสวิชา */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-black/50 uppercase tracking-wider">
                  ชื่อวิชา
                </label>
                <input
                  type="text"
                  value={form.subjectName}
                  onChange={(e) => setField('subjectName', e.target.value)}
                  placeholder="เช่น คณิตศาสตร์"
                  className="w-full h-9 px-3.5 rounded-xl border border-black/10 bg-black/3 text-sm text-black/80 placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-black/50 uppercase tracking-wider">
                  รหัสวิชา
                </label>
                <input
                  type="text"
                  value={form.subjectCode}
                  onChange={(e) => setField('subjectCode', e.target.value)}
                  placeholder="เช่น M1001"
                  className="w-full h-9 px-3.5 rounded-xl border border-black/10 bg-black/3 text-sm text-black/80 placeholder:text-black/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                  disabled={saving}
                />
              </div>
            </div>

            {/* คำอธิบาย */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-black/50 uppercase tracking-wider">
                คำอธิบาย
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                placeholder="อธิบายเนื้อหาของคอร์สโดยย่อ..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-black/3 text-sm text-black/80 placeholder:text-black/30 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                disabled={saving}
              />
            </div>

            {/* สถานะ */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-black/50 uppercase tracking-wider">
                สถานะ
              </label>
              <div className="flex gap-2">
                {(['draft', 'published'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setField('status', s)}
                    disabled={saving}
                    className={cn(
                      'flex-1 h-9 rounded-xl border text-sm font-medium transition-all',
                      form.status === s
                        ? s === 'published'
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'bg-amber-400 border-amber-400 text-white'
                        : 'border-black/10 text-black/50 hover:bg-black/4',
                    )}
                  >
                    {s === 'draft' ? '📝 แบบร่าง' : '🌐 เผยแพร่'}
                  </button>
                ))}
              </div>
              {form.status === 'draft' && (
                <p className="text-[11px] text-black/40">นักเรียนจะยังไม่เห็นคอร์สนี้จนกว่าจะเปลี่ยนเป็น "เผยแพร่"</p>
              )}
            </div>

            {/* ห้องเรียน */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-black/50 uppercase tracking-wider">
                ห้องเรียนที่เข้าถึงได้
                {form.classIds.length > 0 && (
                  <span className="ml-1.5 text-blue-600">({form.classIds.length} ห้อง)</span>
                )}
              </label>
              {classesLoading ? (
                <div className="text-xs text-black/40 py-2">กำลังโหลดรายชื่อห้องเรียน…</div>
              ) : classes.length === 0 ? (
                <div className="text-xs text-black/40 py-2">ไม่พบห้องเรียนในปีการศึกษานี้</div>
              ) : (
                <div className="rounded-xl border border-black/8 overflow-hidden divide-y divide-black/5">
                  {classes.map((cls) => (
                    <label
                      key={cls.id}
                      className={cn(
                        'flex items-center gap-3 px-3.5 py-2.5 cursor-pointer select-none transition-colors',
                        form.classIds.includes(cls.id) ? 'bg-blue-50' : 'hover:bg-black/3',
                        saving && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={form.classIds.includes(cls.id)}
                        onChange={() => toggleClass(cls.id)}
                        disabled={saving}
                        className="size-4 rounded border-black/20 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black/75">
                          {cls.className ?? cls.label ?? cls.id}
                        </p>
                        {cls.gradeLevel && (
                          <p className="text-[11px] text-black/40">{cls.gradeLevel}</p>
                        )}
                      </div>
                      {form.classIds.includes(cls.id) && (
                        <HiOutlineCheckCircle className="size-4 text-blue-500 shrink-0" />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                <HiOutlineExclamationTriangle className="size-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-black/6">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 h-9 rounded-xl border border-black/10 text-sm text-black/55 hover:bg-black/4 transition-colors disabled:opacity-40"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving || !form.title.trim()}
              className="flex-1 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors"
            >
              {saving ? 'กำลังสร้าง…' : 'สร้างคอร์ส'}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Course card ───────────────────────────────────────────────────────────────

function CourseCard({ course, onClick }: { course: Course; onClick: () => void }) {
  const badge = STATUS_BADGE[course.status] ?? STATUS_BADGE.draft;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col text-left overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm hover:shadow-md transition-shadow group"
    >
      <div className="relative w-full aspect-video bg-gradient-to-br from-blue-500 to-indigo-600 overflow-hidden">
        {course.thumbnailURL ? (
          <img src={course.thumbnailURL} alt={course.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <HiOutlineFilm className="size-10 text-white/40" />
          </div>
        )}
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs font-semibold">
          {course.lessonCount} บทเรียน
        </div>
      </div>

      <div className="px-4 py-3.5 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <h3 className="flex-1 text-sm font-bold text-black/80 line-clamp-2 leading-snug group-hover:text-blue-700 transition-colors">
            {course.title}
          </h3>
          <span className={cn('shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold', badge.class)}>
            {badge.label}
          </span>
        </div>
        {course.subjectName && <p className="text-xs text-black/45">{course.subjectName}</p>}
        <div className="flex items-center gap-1.5 text-xs text-black/40 mt-1">
          <div className="size-4 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-blue-600">{course.teacherName.charAt(0)}</span>
          </div>
          <span className="truncate">{course.teacherName}</span>
        </div>
      </div>
    </motion.button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const navigate = useNavigate();
  const { user, userData, role } = useAuth();
  const { year } = useActiveAcademicYear();
  const [showCreate, setShowCreate] = useState(false);

  const ud = userData as UserData | null;

  const { courses, isLoading, refresh } = useCourseList({
    role: role ?? undefined,
    userId: user?.uid,
    classId: (ud as unknown as { classId?: string })?.classId,
  });

  const isTeacher = role === 'teacher' || role === 'admin' || role === 'sysadmin';

  const teacherName = ud?.firstName
    ? `${ud.prefix ?? ''}${ud.firstName} ${ud.lastName ?? ''}`.trim()
    : (user?.displayName ?? '');

  const handleCreated = useCallback((courseId: string) => {
    setShowCreate(false);
    refresh();
    navigate(`/portal/courses/${courseId}`);
  }, [navigate, refresh]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <HiOutlineAcademicCap className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-black/80">คอร์สออนไลน์</h1>
            <p className="text-xs text-black/40">Course on Demand / VOD</p>
          </div>
        </div>

        {isTeacher && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-sm font-medium transition-all"
          >
            <HiOutlinePlusCircle className="size-4" />
            สร้างคอร์ส
          </button>
        )}
      </div>

      {/* Course grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-black/8 overflow-hidden animate-pulse">
              <div className="aspect-video bg-black/6" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-black/6 rounded-full w-3/4" />
                <div className="h-3 bg-black/6 rounded-full w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-black/30">
          <HiOutlineFilm className="size-12" />
          <div className="text-center">
            <p className="text-sm font-medium">ยังไม่มีคอร์สในระบบ</p>
            {isTeacher && (
              <p className="text-xs mt-1">คลิก "สร้างคอร์ส" เพื่อเริ่มต้น</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onClick={() => navigate(`/portal/courses/${course.id}`)}
            />
          ))}
        </div>
      )}

      {/* Create Course Modal */}
      {showCreate && (
        <CreateCourseModal
          teacherId={user?.uid ?? ''}
          teacherName={teacherName}
          academicYearId={year}
          departmentId={ud?.department ?? ''}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
