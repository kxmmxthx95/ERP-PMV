import {
  collection,
  getDocs,
  writeBatch,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * One-time migration: Create enrollment documents for all students
 * already assigned to classrooms via student.classroomId
 *
 * This fixes the case where students were added to classes via
 * StudentTransitionTab but enrollment records were never created.
 *
 * Usage in browser console:
 *   import { createEnrollmentsFromClassrooms } from '@/lib/migrations/createEnrollmentsFromClassrooms'
 *   await createEnrollmentsFromClassrooms()
 */
export async function createEnrollmentsFromClassrooms() {
  console.log('🚀 Starting enrollment migration...');

  try {
    // 1. Fetch all students
    const studentsSnap = await getDocs(collection(db, 'students'));
    const studentsWithClassroom = studentsSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(s => s.classroomId); // Only students assigned to a classroom

    console.log(`Found ${studentsWithClassroom.length} students with classroomId`);

    // 2. Fetch all classes to get department + academicYear info
    const classesSnap = await getDocs(collection(db, 'classes'));
    const classesMap = new Map(
      classesSnap.docs.map(d => [d.id, { id: d.id, ...d.data() } as any])
    );

    console.log(`Found ${classesMap.size} classes`);

    // 3. Check existing enrollments
    const existingEnrollmentsSnap = await getDocs(
      collection(db, 'enrollments')
    );
    const existingPairs = new Set(
      existingEnrollmentsSnap.docs.map(
        d => `${d.data().studentId}:${d.data().classId}`
      )
    );

    console.log(`Found ${existingPairs.size} existing enrollment records`);

    // 4. Create batch of enrollments
    let createdCount = 0;
    const batch = writeBatch(db);

    for (const student of studentsWithClassroom) {
      const classData = classesMap.get(student.classroomId);
      if (!classData) {
        console.warn(
          `⚠️  Student ${student.id} has classroomId ${student.classroomId} but classroom not found`
        );
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
      console.log(
        `✅ Queued enrollment: ${student.id} → ${student.classroomId}`
      );
    }

    if (createdCount === 0) {
      console.log('ℹ️  No new enrollments to create');
      return;
    }

    // 5. Commit batch
    await batch.commit();
    console.log(
      `✨ Migration complete! Created ${createdCount} enrollment records`
    );
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}
