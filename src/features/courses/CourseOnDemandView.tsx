/**
 * Phase 2 — CourseOnDemandView
 *
 * Split-View layout:
 *   Left  → Glassmorphism lesson sidebar (grouped by week/topic)
 *   Right → Optimized video player + tabbed content area
 *
 * Performance guarantees:
 *   • video element uses preload="none" — no bandwidth until the student clicks play
 *   • video element is keyed on lesson ID — unmounts/remounts when lesson changes,
 *     stopping previous playback and applying preload="none" cleanly
 *   • All onSnapshot listeners live in useCourse and are cleaned up on unmount
 *   • groupedLessons is memoized — no new Map on every render
 *   • Teacher upload validates 100 MB hard limit client-side before any network call
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytesResumable } from 'firebase/storage';
import {
  HiOutlineArrowDownTray,
  HiOutlineCheckCircle,
  HiOutlineChevronRight,
  HiOutlineCloudArrowUp,
  HiOutlineDocument,
  HiOutlineExclamationTriangle,
  HiOutlineFilm,
  HiOutlinePlayCircle,
  HiOutlineXMark,
  HiVideoCamera,
} from 'react-icons/hi2';
import { db, storage } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { logActivity } from '@/lib/activityLogger';
import { useCourse } from './hooks/useCourse';
import { useLessonSubmission } from './hooks/useLessonSubmission';
import { LessonQnA } from './components/LessonQnA';
import type { Lesson, LessonAttachment } from '@/types/course';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_UPLOAD_MB = 100;

type TabKey = 'materials' | 'assignment' | 'qa';

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'materials', label: 'เอกสาร', emoji: '📄' },
  { key: 'assignment', label: 'งาน', emoji: '📝' },
  { key: 'qa', label: 'Q&A', emoji: '💬' },
];

const ATTACHMENT_ICON: Record<string, string> = {
  pdf: '📕',
  doc: '📘',
  ppt: '📊',
  video: '🎬',
  other: '📎',
};

// ── Props ────────────────────────────────────────────────────────────────────

interface CurrentUser {
  id: string;
  name: string;
  role: string;
  studentCode?: string;
  classId?: string;
}

interface Props {
  courseId: string;
  currentUser: CurrentUser;
}

// ── Teacher upload modal ─────────────────────────────────────────────────────

interface UploadState {
  percent: number;
  phase: 'idle' | 'uploading' | 'saving' | 'done' | 'error';
  errorMsg?: string;
}

interface TeacherUploadModalProps {
  courseId: string;
  lesson: Lesson;
  onClose: () => void;
  onDone: (videoURL: string) => void;
}

function TeacherUploadModal({ courseId, lesson, onClose, onDone }: TeacherUploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sizeError, setSizeError] = useState(false);
  const [upload, setUpload] = useState<UploadState>({ percent: 0, phase: 'idle' });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setSizeError(false);
    if (!f) { setFile(null); return; }

    if (f.size > MAX_UPLOAD_BYTES) {
      setSizeError(true);
      setFile(f);
      return;
    }
    setFile(f);
  };

  const handleUpload = useCallback(async () => {
    if (!file || sizeError || upload.phase === 'uploading') return;
    setUpload({ percent: 0, phase: 'uploading' });

    const timestamp = Date.now();
    const path = `courses/${courseId}/lessons/${lesson.id}/${timestamp}_${file.name}`;
    const sRef = storageRef(storage, path);
    const task = uploadBytesResumable(sRef, file);

    task.on(
      'state_changed',
      (snap) => {
        setUpload({
          percent: Math.round((snap.bytesTransferred / snap.totalBytes) * 100),
          phase: 'uploading',
        });
      },
      (err) => {
        setUpload({ percent: 0, phase: 'error', errorMsg: err.message });
      },
      async () => {
        try {
          setUpload({ percent: 100, phase: 'saving' });
          const downloadURL = await getDownloadURL(task.snapshot.ref);
          await updateDoc(doc(db, 'courses', courseId, 'lessons', lesson.id), {
            videoURL: downloadURL,
            updatedAt: serverTimestamp(),
          });
          await logActivity({
            action: 'lesson_video_upload',
            category: 'academic',
            detail: `อัปโหลดวิดีโอบทเรียน "${lesson.title}" (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
            targetId: lesson.id,
          });
          setUpload({ percent: 100, phase: 'done' });
          onDone(downloadURL);
        } catch (err) {
          setUpload({
            percent: 0,
            phase: 'error',
            errorMsg: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
          });
        }
      },
    );
  }, [file, sizeError, upload.phase, courseId, lesson.id, lesson.title, onDone]);

  const isUploading = upload.phase === 'uploading' || upload.phase === 'saving';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-black/10 shadow-2xl"
        style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(20px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/8">
          <div className="flex items-center gap-2">
            <HiVideoCamera className="size-5 text-blue-600" />
            <span className="text-sm font-semibold text-black/80">อัปโหลดวิดีโอ</span>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="size-7 rounded-lg flex items-center justify-center hover:bg-black/8 transition-colors disabled:opacity-40"
          >
            <HiOutlineXMark className="size-4 text-black/60" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-black/50">
            บทเรียน: <span className="font-semibold text-black/70">{lesson.title}</span>
          </p>

          {/* Drop zone / file picker */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className={cn(
              'w-full border-2 border-dashed rounded-xl p-6 text-center transition-colors',
              sizeError
                ? 'border-red-400 bg-red-50'
                : file
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-black/15 hover:border-blue-400 hover:bg-blue-50/50',
              isUploading && 'opacity-60 cursor-not-allowed',
            )}
          >
            <HiOutlineCloudArrowUp className={cn('size-8 mx-auto mb-2', sizeError ? 'text-red-400' : 'text-black/30')} />
            {file ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-black/70 break-all">{file.name}</p>
                <p className={cn('text-xs', sizeError ? 'text-red-600 font-semibold' : 'text-black/40')}>
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                  {sizeError && ' — เกินขีดจำกัด!'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-black/50">คลิกเพื่อเลือกไฟล์วิดีโอ</p>
                <p className="text-xs text-black/30">MP4, MOV, AVI ฯลฯ</p>
              </div>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />

          {/* 100 MB hard-limit warning */}
          {sizeError && (
            <div className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <HiOutlineExclamationTriangle className="size-5 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-red-700">
                  ไฟล์ใหญ่เกิน {MAX_UPLOAD_MB} MB
                </p>
                <p className="text-xs text-red-600">
                  ระบบจำกัดขนาดไฟล์ไว้ที่ {MAX_UPLOAD_MB} MB ต่อคลิป กรุณาตัดวิดีโอออกเป็นตอนๆ
                  (เช่น ใช้ Handbrake หรือ iMovie) แล้วอัปโหลดแยกกันทีละบทเรียน
                </p>
              </div>
            </div>
          )}

          {/* Upload progress */}
          {(upload.phase === 'uploading' || upload.phase === 'saving') && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-black/50">
                <span>{upload.phase === 'saving' ? 'บันทึกข้อมูล…' : 'กำลังอัปโหลด…'}</span>
                <span>{upload.percent}%</span>
              </div>
              <div className="h-2 bg-black/8 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${upload.percent}%` }}
                />
              </div>
            </div>
          )}

          {upload.phase === 'done' && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
              <HiOutlineCheckCircle className="size-5 shrink-0" />
              <span className="text-sm font-medium">อัปโหลดสำเร็จ!</span>
            </div>
          )}

          {upload.phase === 'error' && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700">
              <HiOutlineExclamationTriangle className="size-5 shrink-0" />
              <span className="text-sm">{upload.errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="flex-1 h-9 rounded-xl border border-black/12 text-sm text-black/60 hover:bg-black/5 transition-colors disabled:opacity-40"
          >
            {upload.phase === 'done' ? 'ปิด' : 'ยกเลิก'}
          </button>
          {upload.phase !== 'done' && (
            <button
              onClick={() => void handleUpload()}
              disabled={!file || sizeError || isUploading}
              className="flex-1 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
            >
              {isUploading ? 'กำลังอัปโหลด…' : 'อัปโหลด'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Lesson sidebar item ───────────────────────────────────────────────────────

function LessonItem({
  lesson,
  isActive,
  onClick,
}: {
  lesson: Lesson;
  isActive: boolean;
  onClick: () => void;
}) {
  const durationLabel = lesson.videoDurationSec
    ? `${Math.floor(lesson.videoDurationSec / 60)}:${String(lesson.videoDurationSec % 60).padStart(2, '0')}`
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all group',
        isActive
          ? 'bg-blue-600 text-white shadow-sm'
          : 'hover:bg-black/5 text-black/75',
      )}
    >
      <div
        className={cn(
          'shrink-0 mt-0.5 size-7 rounded-lg flex items-center justify-center',
          isActive ? 'bg-white/20' : 'bg-black/6',
        )}
      >
        {lesson.videoURL ? (
          <HiOutlinePlayCircle className={cn('size-4', isActive ? 'text-white' : 'text-blue-600')} />
        ) : (
          <HiOutlineFilm className={cn('size-4', isActive ? 'text-white/60' : 'text-black/30')} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium leading-snug', isActive ? 'text-white' : 'text-black/80')}>
          {lesson.title}
        </p>
        <div className={cn('flex items-center gap-2 mt-0.5 text-xs', isActive ? 'text-white/60' : 'text-black/40')}>
          {durationLabel && <span>{durationLabel}</span>}
          {lesson.attachments.length > 0 && (
            <span>{lesson.attachments.length} เอกสาร</span>
          )}
          {!lesson.videoURL && (
            <span className={isActive ? 'text-white/50' : 'text-amber-500'}>ยังไม่มีวิดีโอ</span>
          )}
        </div>
      </div>

      <HiOutlineChevronRight
        className={cn(
          'size-4 shrink-0 mt-1.5 transition-transform',
          isActive ? 'text-white/60 translate-x-0.5' : 'text-black/25 group-hover:translate-x-0.5',
        )}
      />
    </button>
  );
}

// ── Materials tab ─────────────────────────────────────────────────────────────

function MaterialsTab({ attachments }: { attachments: LessonAttachment[] }) {
  if (attachments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-black/30">
        <HiOutlineDocument className="size-8" />
        <span className="text-sm">ไม่มีเอกสารสำหรับบทเรียนนี้</span>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {attachments.map((a) => (
        <li key={a.id}>
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-xl border border-black/8 hover:bg-black/4 hover:border-black/15 transition-all group"
          >
            <span className="text-xl">{ATTACHMENT_ICON[a.type] ?? '📎'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-black/80 truncate">{a.name}</p>
              {a.sizeBytes && (
                <p className="text-xs text-black/40">{(a.sizeBytes / 1024).toFixed(0)} KB</p>
              )}
            </div>
            <HiOutlineArrowDownTray className="size-4 text-black/30 group-hover:text-blue-600 transition-colors shrink-0" />
          </a>
        </li>
      ))}
    </ul>
  );
}

// ── Assignment tab ────────────────────────────────────────────────────────────

function AssignmentTab({
  lesson,
  currentUser,
  courseId,
}: {
  lesson: Lesson;
  currentUser: CurrentUser;
  courseId: string;
}) {
  const isStudent = currentUser.role === 'student';
  const { submission, isLoading, uploadSubmission } = useLessonSubmission(
    courseId,
    lesson.id,
    isStudent ? currentUser.id : undefined,
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<{
    phase: 'idle' | 'uploading' | 'done' | 'error';
    percent: number;
    errorMsg?: string;
    sizeError?: boolean;
  }>({ phase: 'idle', percent: 0 });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadState({ phase: 'error', percent: 0, sizeError: true, errorMsg: `ไฟล์ใหญ่เกิน ${MAX_UPLOAD_MB} MB` });
      return;
    }

    setUploadState({ phase: 'uploading', percent: 0 });

    try {
      await uploadSubmission(
        file,
        {
          id: currentUser.id,
          name: currentUser.name,
          studentCode: currentUser.studentCode,
          classId: currentUser.classId ?? '',
        },
        (p) => setUploadState({ phase: p.state === 'success' ? 'done' : 'uploading', percent: p.percent }),
      );
      setUploadState({ phase: 'done', percent: 100 });
    } catch (err) {
      setUploadState({
        phase: 'error',
        percent: 0,
        errorMsg: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด',
      });
    }

    if (inputRef.current) inputRef.current.value = '';
  };

  if (!lesson.hasAssignment) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-black/30">
        <span className="text-2xl">📋</span>
        <span className="text-sm">บทเรียนนี้ไม่มีงานส่ง</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {lesson.assignmentDescription && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-100">
          <p className="text-xs font-semibold text-blue-700 mb-1">คำอธิบายงาน</p>
          <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">
            {lesson.assignmentDescription}
          </p>
          {lesson.assignmentDueDateStr && (
            <p className="mt-2 text-xs text-blue-500">กำหนดส่ง: {lesson.assignmentDueDateStr}</p>
          )}
        </div>
      )}

      {isStudent && (
        <>
          {isLoading ? (
            <div className="text-sm text-black/40">กำลังโหลด…</div>
          ) : submission ? (
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50">
              <HiOutlineCheckCircle className="size-5 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-emerald-800">ส่งงานแล้ว</p>
                <a
                  href={submission.fileURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 hover:underline truncate block"
                >
                  {submission.fileName}
                </a>
                {submission.grade != null && (
                  <p className="text-xs text-emerald-700 mt-0.5">คะแนน: <strong>{submission.grade}</strong></p>
                )}
              </div>
            </div>
          ) : null}

          {/* Drop zone */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploadState.phase === 'uploading'}
            className={cn(
              'w-full border-2 border-dashed rounded-xl p-8 text-center transition-colors',
              uploadState.phase === 'error' && uploadState.sizeError
                ? 'border-red-400 bg-red-50'
                : 'border-black/15 hover:border-blue-400 hover:bg-blue-50/50',
              uploadState.phase === 'uploading' && 'opacity-60 cursor-not-allowed',
            )}
          >
            <HiOutlineCloudArrowUp className="size-7 mx-auto mb-2 text-black/30" />
            <p className="text-sm text-black/50">
              {submission ? 'ส่งงานใหม่ (เขียนทับงานเก่า)' : 'คลิกเพื่อเลือกไฟล์งาน'}
            </p>
            <p className="text-xs text-black/30 mt-0.5">ขนาดสูงสุด {MAX_UPLOAD_MB} MB</p>
          </button>
          <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />

          {uploadState.phase === 'uploading' && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-black/50">
                <span>กำลังอัปโหลด…</span>
                <span>{uploadState.percent}%</span>
              </div>
              <div className="h-1.5 bg-black/8 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${uploadState.percent}%` }}
                />
              </div>
            </div>
          )}

          {uploadState.phase === 'error' && (
            <div className="flex gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <HiOutlineExclamationTriangle className="size-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">{uploadState.errorMsg}</p>
                {uploadState.sizeError && (
                  <p className="text-xs text-red-600 mt-0.5">
                    กรุณาบีบอัดไฟล์หรือตัดออกเป็นส่วนๆ แล้วลองใหม่
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CourseOnDemandView({ courseId, currentUser }: Props) {
  const { course, lessons, isLoading, error } = useCourse(courseId);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('materials');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isTeacher = currentUser.role === 'teacher' || currentUser.role === 'admin' || currentUser.role === 'sysadmin';

  // Derive the active lesson; fall back to the first published lesson.
  const selectedLesson = useMemo<Lesson | null>(() => {
    if (!lessons.length) return null;
    const byId = lessons.find((l) => l.id === selectedLessonId);
    if (byId) return byId;
    return lessons.find((l) => l.isPublished) ?? lessons[0];
  }, [lessons, selectedLessonId]);

  // Group lessons by week (or fall back to topic, then a default group).
  const groupedLessons = useMemo(() => {
    const groups = new Map<string, Lesson[]>();
    lessons.forEach((lesson) => {
      const key =
        lesson.week != null
          ? `สัปดาห์ที่ ${lesson.week}`
          : (lesson.topic ?? 'บทเรียนทั้งหมด');
      const group = groups.get(key);
      if (group) group.push(lesson);
      else groups.set(key, [lesson]);
    });
    return groups;
  }, [lessons]);

  const handleLessonSelect = useCallback((id: string) => {
    setSelectedLessonId(id);
    setActiveTab('materials');
  }, []);

  const handleUploadDone = useCallback(() => {
    setShowUploadModal(false);
  }, []);

  // ── Loading / error states ──

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-black/40 text-sm">
        กำลังโหลดคอร์ส…
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-red-500 text-sm">
        <HiOutlineExclamationTriangle className="size-5" />
        {error ?? 'ไม่พบคอร์ส'}
      </div>
    );
  }

  // ── Layout ──

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-2xl border border-black/8 shadow-sm bg-white">
      {/* ── Left sidebar ── */}
      <div
        className={cn(
          'flex-shrink-0 flex flex-col border-r border-black/8 transition-all duration-200 overflow-hidden',
          sidebarOpen ? 'w-72 xl:w-80' : 'w-0',
        )}
        style={{ background: 'rgba(248,248,255,0.95)' }}
      >
        {/* Course header */}
        <div className="px-4 py-4 border-b border-black/8">
          <h1 className="text-sm font-bold text-black/80 leading-snug line-clamp-2">
            {course.title}
          </h1>
          {course.subjectName && (
            <p className="text-xs text-black/40 mt-0.5">{course.subjectName}</p>
          )}
          <p className="text-xs text-black/40 mt-0.5">
            {course.teacherName} · {lessons.length} บทเรียน
          </p>
        </div>

        {/* Lesson list */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-4">
          {groupedLessons.size === 0 && (
            <p className="text-xs text-black/30 text-center py-8">ยังไม่มีบทเรียน</p>
          )}
          {Array.from(groupedLessons.entries()).map(([groupLabel, groupLessons]) => (
            <div key={groupLabel}>
              <p className="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider text-black/35">
                {groupLabel}
              </p>
              {groupLessons.map((lesson) => (
                <LessonItem
                  key={lesson.id}
                  lesson={lesson}
                  isActive={lesson.id === (selectedLesson?.id ?? null)}
                  onClick={() => handleLessonSelect(lesson.id)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-black/8 shrink-0">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="size-8 rounded-lg flex items-center justify-center hover:bg-black/6 transition-colors"
            aria-label={sidebarOpen ? 'ซ่อนรายการบทเรียน' : 'แสดงรายการบทเรียน'}
          >
            <div className="flex flex-col gap-1 items-center">
              <div className="w-4 h-0.5 bg-black/50 rounded" />
              <div className="w-3 h-0.5 bg-black/50 rounded" />
              <div className="w-4 h-0.5 bg-black/50 rounded" />
            </div>
          </button>
          <h2 className="text-sm font-semibold text-black/70 truncate">
            {selectedLesson?.title ?? 'เลือกบทเรียน'}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!selectedLesson ? (
            <div className="flex items-center justify-center h-64 text-black/30 text-sm">
              เลือกบทเรียนจากแถบด้านซ้าย
            </div>
          ) : (
            <div className="flex flex-col">
              {/* ── Video player ── */}
              <div className="bg-black relative">
                {selectedLesson.videoURL ? (
                  /*
                   * key={selectedLesson.id} forces React to unmount and remount
                   * the <video> element when the lesson changes. This ensures:
                   *   1. The previous video stops playing immediately
                   *   2. preload="none" is applied fresh (no lingering buffer)
                   *   3. The new src is loaded from scratch
                   */
                  <video
                    key={selectedLesson.id}
                    src={selectedLesson.videoURL}
                    poster={selectedLesson.thumbnailURL}
                    preload="none"
                    controls
                    controlsList="nodownload"
                    className="w-full aspect-video object-contain"
                    playsInline
                  />
                ) : (
                  <div className="w-full aspect-video flex flex-col items-center justify-center gap-3 bg-black/90">
                    <HiOutlineFilm className="size-12 text-white/20" />
                    <p className="text-white/40 text-sm">บทเรียนนี้ยังไม่มีวิดีโอ</p>
                    {isTeacher && (
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="flex items-center gap-2 px-4 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
                      >
                        <HiOutlineCloudArrowUp className="size-4" />
                        อัปโหลดวิดีโอ
                      </button>
                    )}
                  </div>
                )}

                {/* Teacher upload overlay button (when video exists) */}
                {isTeacher && selectedLesson.videoURL && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="absolute top-3 right-3 flex items-center gap-1.5 px-3 h-8 rounded-lg bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white text-xs font-medium transition-colors"
                  >
                    <HiOutlineCloudArrowUp className="size-3.5" />
                    เปลี่ยนวิดีโอ
                  </button>
                )}
              </div>

              {/* Lesson info */}
              <div className="px-5 py-4 border-b border-black/8">
                <h3 className="text-base font-bold text-black/85">{selectedLesson.title}</h3>
                {selectedLesson.description && (
                  <p className="text-sm text-black/55 mt-1 leading-relaxed">
                    {selectedLesson.description}
                  </p>
                )}
              </div>

              {/* ── Tabs ── */}
              <div className="px-5 pt-4">
                {/* Tab bar */}
                <div className="flex gap-1 p-1 rounded-xl bg-black/5 w-fit mb-5">
                  {TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        'px-4 h-8 rounded-lg text-sm font-medium transition-all',
                        activeTab === tab.key
                          ? 'bg-white text-black/80 shadow-sm'
                          : 'text-black/45 hover:text-black/65',
                      )}
                    >
                      <span className="mr-1.5">{tab.emoji}</span>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab panels */}
                <div className="pb-8">
                  {activeTab === 'materials' && (
                    <MaterialsTab attachments={selectedLesson.attachments} />
                  )}
                  {activeTab === 'assignment' && (
                    <AssignmentTab
                      lesson={selectedLesson}
                      currentUser={currentUser}
                      courseId={courseId}
                    />
                  )}
                  {activeTab === 'qa' && (
                    <LessonQnA
                      courseId={courseId}
                      lessonId={selectedLesson.id}
                      currentUser={currentUser}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Teacher upload modal */}
      {showUploadModal && selectedLesson && (
        <TeacherUploadModal
          courseId={courseId}
          lesson={selectedLesson}
          onClose={() => setShowUploadModal(false)}
          onDone={handleUploadDone}
        />
      )}
    </div>
  );
}
