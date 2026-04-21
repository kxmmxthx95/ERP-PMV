import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  getDocs,
  limit,
  doc,
  getDoc
} from "firebase/firestore";
import { useAuthStore } from "@/store/authStore";

const googleProvider = new GoogleAuthProvider();

export const authService = {
  // Login สนับสนุนทั้ง Email และ Username/รหัสประจำตัว
  login: async (identifier: string, pass: string) => {
    // ลบช่องว่างหัวท้าย
    const cleanId = identifier.trim();
    if (!cleanId) throw new Error('กรุณาระบุอีเมลหรือรหัสประจำตัว');

    let email = cleanId;

    // ถ้า cleanId ไม่มี @ แสดงว่าเป็น Username หรือ Employee Code
    if (!cleanId.includes('@')) {
      const idUpper = cleanId.toUpperCase();
      console.log('Resolving identifier:', cleanId, ' (Upper:', idUpper + ')');
      
      // 1. ค้นหาในคอลเลกชัน users (ฟิลด์ username)
      // ลองหาทั้งแบบปกติและตัวพิมพ์ใหญ่
      let usersQuery = query(collection(db, 'users'), where('username', '==', cleanId), limit(1));
      let userSnap = await getDocs(usersQuery);
      
      if (userSnap.empty) {
        usersQuery = query(collection(db, 'users'), where('username', '==', idUpper), limit(1));
        userSnap = await getDocs(usersQuery);
      }

      if (!userSnap.empty) {
        email = userSnap.docs[0].data().email;
        console.log('Resolved from users:', email);
      } else {
        // 2. ค้นหาในคอลเลกชัน teachers (ฟิลด์ employeeCode)
        let teachersQuery = query(collection(db, 'teachers'), where('employeeCode', '==', cleanId), limit(1));
        let teacherSnap = await getDocs(teachersQuery);
        
        if (teacherSnap.empty) {
          teachersQuery = query(collection(db, 'teachers'), where('employeeCode', '==', idUpper), limit(1));
          teacherSnap = await getDocs(teachersQuery);
        }
        
        if (!teacherSnap.empty) {
          email = teacherSnap.docs[0].data().email;
          console.log('Resolved from teachers:', email);
        } else {
          throw new Error('ไม่พบชื่อผู้ใช้งานหรือรหัสประจำตัวนี้ในระบบ');
        }
      }
    }

    if (!email) throw new Error('ไม่สามารถระบุอีเมลสำหรับบัญชีนี้ได้');

    return signInWithEmailAndPassword(auth, email.trim().toLowerCase(), pass.trim());
  },

  // Login ด้วย Email (Legacy / Direct)
  loginWithEmail: (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  },

  // Login ด้วย Google
  loginWithGoogle: () => {
    return signInWithPopup(auth, googleProvider);
  },

  // Logout
  logout: () => {
    if (import.meta.env.DEV) {
      localStorage.removeItem('dev_role');
    }
    return signOut(auth);
  },

  // ฟังก์ชันสำคัญ: ติดตามสถานะและดึง Role
  listenToAuthChanges: () => {
    const { setUser, setLoading, logout } = useAuthStore.getState();
    
    return onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        console.log('--- Auth Change Detected ---');
        console.log('User UID:', user.uid);
        console.log('User Email:', user.email);

        // 1. ลองดึงจาก Custom Claims ก่อน
        const idTokenResult = await user.getIdTokenResult();
        let role = idTokenResult.claims.role as string;
        console.log('Custom Claims Role:', role);

        // [GOD MODE BYPASS] สิทธิพิเศษสำหรับ Super Admin หลัก
        if (user.email === 'sysadmin@pmv.com') {
          role = 'sysadmin';
          console.log('--- SYSTEM OVERRIDE: GOD MODE ACTIVATED FOR sysadmin@pmv.com ---');
        }
        
        // 2. Fallback ไปที่ Firestore ถ้ายังไม่มี Claim (และไม่ใช่ God Mode)
        if (!role) {
          console.log('No role in claims, checking Firestore fallback...');
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              role = userDoc.data().role;
              console.log('Found role in Firestore:', role);
            } else {
              console.warn('No document found in Firestore users collection for this UID');
            }
          } catch (error) {
            console.error('Firestore fallback error:', error);
          }
        }
        
        // 3. [DEV MODE] บังคับ Role
        if (import.meta.env.DEV) {
          const devRole = localStorage.getItem('dev_role');
          if (devRole) {
            role = devRole;
            console.log('Overriding with Dev Role:', role);
          }
        }

        // ค่าเริ่มต้นถ้าหาอะไรไม่เจอจริงๆ
        if (!role) {
          console.log('Last resort: defaulting to student');
          role = 'student';
        }

        setUser(user, role);
        console.log('--- Auth Setup Complete (Role:', role, ') ---');
      } else {
        console.log('No user session found, logging out...');
        logout();
      }
      setLoading(false);
    });
  }
};