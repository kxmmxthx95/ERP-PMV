import { db } from './lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

async function debug() {
  console.log('--- Checking Classes ---');
  const classSnap = await getDocs(collection(db, 'classes'));
  classSnap.forEach(d => {
    const data = d.data();
    console.log(`Class: ${data.className} | YearID: ${data.academicYearId} | Year: ${data.academicYear} | Dept: ${data.departmentId} | Grade: ${data.gradeLevel}`);
  });

  console.log('\n--- Checking Curriculum Versions (New) ---');
  const verSnap = await getDocs(collection(db, 'curriculums'));
  verSnap.forEach(d => {
    const data = d.data();
    console.log(`Version: ${data.name} | Year: ${data.year} | Grades: ${JSON.stringify(data.assignedGrades)}`);
  });

  console.log('\n--- Checking Curriculum Maps (Old) ---');
  const mapSnap = await getDocs(collection(db, 'curriculum_maps'));
  mapSnap.forEach(d => {
    const data = d.data();
    console.log(`Map: ${data.name} | Year: ${data.academicYear} | Depts: ${Object.keys(data.sections || {})}`);
  });
}

debug();
