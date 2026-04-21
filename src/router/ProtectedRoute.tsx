// src/router/ProtectedRoute.tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const ProtectedRoute = () => {
  const { user, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span className="text-sm font-medium text-white/70">กำลังตรวจสอบสิทธิ์...</span>
        </div>
      </div>
    );
  }

  // 1. ถ้าไม่ได้ Login ให้กลับไปหน้า Login พร้อมจำ URL เดิมไว้ (เพื่อ Redirect กลับมาได้)
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. God Mode Bypass: ผู้ดูแลระบบสูงสุดเข้าได้ทุกหน้าโดยไม่ต้องสน URL
  if (user.email === 'sysadmin@pmv.com' || role === 'sysadmin') {
    return <Outlet />;
  }

  // 3. ดึง path แรกสุดมาเช็คว่าเป็น portal ของบทบาทไหน (เช่น /teacher/schedule -> teacher)
  const targetPortal = location.pathname.split('/')[1];
  const validPortals = ['sysadmin', 'admin', 'staff', 'teacher', 'student', 'parent'];

  // 4. ถ้า path เป็นของ Portal หลัก แต่ Role ของผู้ใช้ไม่ตรงกัน ให้เตะกลับไปหน้า Portal ของตัวเอง
  if (validPortals.includes(targetPortal) && role !== targetPortal) {
    // สมมติว่านักเรียนแอบเข้า /teacher จะถูกเตะกลับไปที่ /student อัตโนมัติ
    return <Navigate to={`/${role || 'login'}`} replace />;
  }

  // 5. ถ้าผ่านทุกเงื่อนไข ให้แสดงผลหน้าที่อยู่ข้างใน
  return <Outlet />;
};