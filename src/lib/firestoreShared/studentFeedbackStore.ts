import { collection, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { createSharedStore } from './createSharedStore';
import { listenQueryWithGetDocs } from './listenWithGetDocs';
import type { FeedbackStatus, StudentFeedback } from '@/types/feedback';

function mapFeedback(id: string, raw: Record<string, unknown>): StudentFeedback {
  const statusRaw = raw.status;
  const status: FeedbackStatus =
    statusRaw === 'in_progress' || statusRaw === 'resolved' ? statusRaw : 'new';

  const modeRaw = raw.mode;
  const mode = modeRaw === 'anonymous' ? 'anonymous' : 'identified';

  const categoryRaw = raw.category;
  const category =
    categoryRaw === 'academic' || categoryRaw === 'facilities' || categoryRaw === 'cafeteria'
      ? categoryRaw
      : 'general';

  return {
    id,
    mode,
    category,
    message: typeof raw.message === 'string' ? raw.message : '',
    status,
    gradeLevel: typeof raw.gradeLevel === 'string' ? raw.gradeLevel : 'ไม่ระบุ',
    department: typeof raw.department === 'string' ? raw.department : 'ไม่ระบุ',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    studentId: typeof raw.studentId === 'string' ? raw.studentId : null,
    studentName: typeof raw.studentName === 'string' ? raw.studentName : null,
    adminNote: typeof raw.adminNote === 'string' ? raw.adminNote : null,
  };
}

let sharedFeedback: StudentFeedback[] = [];

export const studentFeedbackStore = createSharedStore<StudentFeedback[]>(
  (emit) => {
    const q = query(collection(db, 'student_feedback'), orderBy('createdAt', 'desc'));
    return listenQueryWithGetDocs(
      q,
      (rows) => rows.map((r) => mapFeedback(r.id, r)),
      (items) => {
        sharedFeedback = items;
        emit(items);
      },
      sharedFeedback,
      'studentFeedbackStore',
    );
  },
  sharedFeedback,
);
