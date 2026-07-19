import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Use application default credentials (from firebase login)
if (!getApps().length) {
  initializeApp({ projectId: 'pmv1-90180' });
}

const db = getFirestore();

// ── 1. หาห้องสอบที่เกี่ยวข้อง: ภาษาต่างประเทศ + กลางภาค + ปีการศึกษา 2569 ──
const roomsSnap = await db.collection('exam_rooms').get();
const rooms = roomsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

const candidateRooms = rooms.filter((r) => {
  const title = String(r.title || '');
  const subject = String(r.subjectName || '');
  const year = String(r.academicYearId || '');
  return (
    (subject.includes('ภาษาต่างประเทศ') || subject.includes('English') || title.includes('ภาษาต่างประเทศ'))
    && (title.includes('กลางภาค') || title.includes('midterm'))
    && (year.includes('2569') || year.includes('69'))
  );
});

console.log(`พบห้องสอบที่ตรงเงื่อนไข: ${candidateRooms.length} ห้อง\n`);
candidateRooms.forEach((r) => {
  console.log(`- roomId: ${r.id}`);
  console.log(`  title: ${r.title}`);
  console.log(`  className: ${r.className} (classId: ${r.classId})`);
  console.log(`  subjectName: ${r.subjectName}`);
  console.log(`  academicYearId: ${r.academicYearId} semester: ${r.semester}`);
  console.log(`  currentRound: ${r.currentRound} status: ${r.status}`);
  console.log('');
});

if (candidateRooms.length === 0) {
  console.log('ไม่พบห้องสอบที่ตรงเงื่อนไข — ลองดูรายชื่อห้องสอบภาษาต่างประเทศทั้งหมดแทน:');
  const fallback = rooms.filter((r) => String(r.subjectName || '').includes('ภาษาต่างประเทศ'));
  fallback.forEach((r) => {
    console.log(`- roomId: ${r.id} | title: ${r.title} | className: ${r.className} | year: ${r.academicYearId}`);
  });
  process.exit(0);
}

// ── 2. โหลดข้อมูลนักเรียนทั้งหมด เพื่อเทียบ classId จริงของแต่ละคน ──
const studentsSnap = await db.collection('students').get();
const studentById = new Map(studentsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));

// ── 3. ตรวจสอบ attempts ในแต่ละห้อง หาใครที่ classId จริงไม่ตรงกับห้องสอบ ──
for (const room of candidateRooms) {
  const attemptsSnap = await db.collection('exam_rooms').doc(room.id).collection('attempts').get();
  const attempts = attemptsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  console.log(`\n=== ห้องสอบ: ${room.title} (${room.className}) — ${attempts.length} attempts ===`);

  const mismatches = [];
  attempts.forEach((a) => {
    const student = studentById.get(a.studentId);
    const studentClassId = student?.classId;
    const studentClassName = student?.className;
    const isMismatch = studentClassId && room.classId && studentClassId !== room.classId;
    if (isMismatch) {
      mismatches.push({ attempt: a, student, studentClassName });
    }
  });

  if (mismatches.length === 0) {
    console.log('  ไม่พบนักเรียนที่ classId ไม่ตรงกับห้องสอบ');
  } else {
    console.log(`  พบนักเรียน ${mismatches.length} คนที่ห้องเรียนจริงไม่ตรงกับห้องสอบนี้:`);
    mismatches.forEach(({ attempt, student, studentClassName }) => {
      console.log(`  - attemptId: ${attempt.id}`);
      console.log(`    studentId: ${attempt.studentId} | ชื่อ: ${attempt.studentName || student?.firstName + ' ' + student?.lastName}`);
      console.log(`    ห้องเรียนจริง: ${studentClassName} | ห้องสอบนี้ตั้งไว้สำหรับ: ${room.className}`);
      console.log(`    round: ${attempt.round} | status: ${attempt.status} | score: ${attempt.score}`);
      console.log(`    startedAt: ${new Date(attempt.startedAt).toLocaleString('th-TH')}`);
    });
  }
}
