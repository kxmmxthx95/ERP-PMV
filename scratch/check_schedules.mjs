import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Use application default credentials (from firebase login)
if (!getApps().length) {
  initializeApp({ projectId: 'pmv1-90180' });
}

const db = getFirestore();

const snap = await db.collection('schedules').get();
const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

console.log('Total schedules:', docs.length);

// Group by classId+day+period+year+semester
const grouped = {};
docs.forEach(e => {
  const key = [e.classId, e.day, e.period, e.year, e.semester].join('|');
  if (!grouped[key]) grouped[key] = [];
  grouped[key].push(e);
});

console.log('\n--- Duplicates (same slot) ---');
let hasDup = false;
for (const [key, entries] of Object.entries(grouped)) {
  if (entries.length > 1) {
    hasDup = true;
    console.log(`\nSLOT: ${key} (${entries.length} entries)`);
    entries.forEach(e => {
      console.log(`  id: ${e.id}  subject: ${e.subjectCode} ${e.subjectName}  teacher: ${e.teacherName}`);
    });
  }
}
if (!hasDup) console.log('No duplicates found');

console.log('\n--- All schedules ---');
docs.forEach(e => {
  console.log(`id:${e.id} class:${e.classId} day:${e.day} period:${e.period} subject:${e.subjectCode} year:${e.year} sem:${e.semester}`);
});
