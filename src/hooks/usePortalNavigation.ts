import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

/**
 * Hook สำหรับจัดการการนำทางโดยอิงตาม Role ของผู้ใช้
 */
export const usePortalNavigation = () => {
  const navigate = useNavigate();
  const { role } = useAuthStore();

  /**
   * นำทางไปยังหน้าหลัก (Dashboard) ของแต่ละ Role
   */
  const goToDashboard = () => {
    if (!role) {
      navigate("/login");
      return;
    }
    navigate(`/${role}`); // เช่น /student, /teacher, /admin
  };

  /**
   * นำทางไปยังฟีเจอร์ย่อยภายใน Portal ปัจจุบัน
   * @param path - เส้นทางย่อย เช่น 'grades', 'schedule', 'profile'
   */
  const goToSubPage = (path: string) => {
    if (!role) return;
    navigate(`/${role}/${path}`);
  };

  /**
   * สร้าง Path สำหรับใช้งานในลิงก์หรือเมนูต่างๆ
   */
  const getPortalPath = (path: string) => {
    return `/${role}/${path}`;
  };

  return { goToDashboard, goToSubPage, getPortalPath, currentRole: role };
};