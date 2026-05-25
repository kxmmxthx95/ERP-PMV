import { db } from './lib/firebase';
import { collection, getDocs, query, limit } from 'firebase/firestore';

async function debug() {
  const snap = await getDocs(query(collection(db, 'students'), limit(5)));
  console.log('--- Students Sample ---');
  snap.forEach(doc => {
    console.log(doc.id, doc.data());
  });
  
  const clSnap = await getDocs(query(collection(db, 'classes'), limit(5)));
  console.log('--- Classes Sample ---');
  clSnap.forEach(doc => {
    console.log(doc.id, doc.data());
  });
  
  const enSnap = await getDocs(query(collection(db, 'enrollments'), limit(5)));
  console.log('--- Enrollments Sample ---');
  enSnap.forEach(doc => {
    console.log(doc.id, doc.data());
  });
}

debug();
