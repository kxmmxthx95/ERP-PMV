import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthStore } from "@/store/authStore";

const googleProvider = new GoogleAuthProvider();

export const authService = {
  // Login ด้วย Email
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

  // ฟังก์ชันสำคัญ: ติดตามสถานะและดึง Role จาก Custom Claims
  listenToAuthChanges: () => {
    const { setUser, setLoading, logout } = useAuthStore.getState();
    
    return onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        // ดึง ID Token Result เพื่ออ่าน Custom Claims (role)
        const idTokenResult = await user.getIdTokenResult();
        let role = idTokenResult.claims.role as string;
        
        // [DEV MODE] ดึง Role จำลองมาใช้งานถ้าอยู่ในการพัฒนา
        if (import.meta.env.DEV) {
          const devRole = localStorage.getItem('dev_role');
          if (devRole) role = devRole;
        }

        if (!role) role = 'student'; // Default เป็น student หากไม่มี role
        setUser(user, role);
      } else {
        logout();
      }
      setLoading(false);
    });
  }
};