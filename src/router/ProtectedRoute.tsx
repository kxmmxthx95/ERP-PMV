// src/router/ProtectedRoute.tsx
import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const ProtectedRoute = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">Loading Security...</div>;
  }

  // ถ้าไม่ได้ Login ให้กลับไปหน้า Login
  // [DEV] คอมเมนต์ส่วนนี้ออกชั่วคราวเพื่อทะลุการเช็ค Login
  // if (!user) {
  //   return <Navigate to="/login" replace />;
  // }

  // ถ้า Role ไม่ตรงกับที่กำหนด ให้ไปหน้า Unauthorized
  // [DEV] คอมเมนต์ส่วนนี้ออกชั่วคราวเพื่อทะลุการเช็ค Role
  // if (!allowedRoles.includes(role || "")) {
  //   return <Navigate to="/unauthorized" replace />;
  // }

  // ถ้าผ่านทุกเงื่อนไข ให้แสดงผลหน้าที่อยู่ข้างใน
  return <Outlet />;
};