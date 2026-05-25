import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyD-fake-key",
  authDomain: "methaedu.firebaseapp.com",
  projectId: "methaedu",
  storageBucket: "methaedu.appspot.com",
  messagingSenderId: "12345",
  appId: "1:12345:web:12345"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkData() {
  const querySnapshot = await getDocs(query(collection(db, 'classes'), limit(5)));
  querySnapshot.forEach((doc) => {
    console.log(doc.id, ' => ', JSON.stringify(doc.data(), null, 2));
  });
}

checkData();
