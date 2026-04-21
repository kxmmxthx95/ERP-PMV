// src/router/AppRouter.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";

// Layouts
import DashboardLayout from "@/components/layout/DashboardLayout";
import PortalLayout from "@/components/layout/PortalLayout";

// Pages
import LoginPage from "@/features/auth/LoginPage";
import SignupPage from "@/features/auth/SignupPage";
import PendingUsersPage from "@/portals/sysadmin/PendingUsersPage";
import SysAdminUsers from "@/portals/sysadmin/SysAdminUsers";
import SysAdminLogs from "@/portals/sysadmin/SysAdminLogs";
import { SysAdminSettings } from "@/portals/sysadmin/settings";
import AcademicCalendar from "@/features/calendar/AcademicCalendar";
import CurriculumManager from "@/features/curriculum/CurriculumManager";
import ScheduleEditor from "@/features/schedule/ScheduleEditor";
import TeacherManager from "@/features/teachers/TeacherManager";
import SyllabusManager from "@/features/syllabus/SyllabusManager";
import TeacherSyllabusPage from "@/portals/teacher/TeacherSyllabusPage";
import ClassManager from "@/features/classes/ClassManager";
import StudentManager from "@/features/students/StudentManager";
import RolePermissionManager from "@/features/roles/RolePermissionManager";

export const AppRouter = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/unauthorized" element={<div className="p-10">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>} />

      {/* 🛡️ SysAdmin Portal — DashboardLayout */}
      <Route element={<ProtectedRoute />}>
        <Route path="/sysadmin" element={<DashboardLayout />}>
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users"    element={<SysAdminUsers />} />
          <Route path="pending-users" element={<PendingUsersPage />} />
          <Route path="roles"    element={<RolePermissionManager />} />
          <Route path="schools"  element={<div className="p-4">โรงเรียน / สาขา</div>} />
          <Route path="structure" element={<CurriculumManager />} />
          <Route path="logs"     element={<SysAdminLogs />} />
          <Route path="settings" element={<SysAdminSettings />} />
          <Route path="calendar"    element={<AcademicCalendar />} />
          <Route path="curriculum"  element={<CurriculumManager />} />
          <Route path="schedule"    element={<ScheduleEditor />} />
          <Route path="teachers"    element={<TeacherManager />} />
          <Route path="syllabus"    element={<SyllabusManager />} />
          <Route path="classes"     element={<ClassManager />} />
          <Route path="students"    element={<StudentManager />} />
          <Route path="syllabus"    element={<SyllabusManager />} />
        </Route>
      </Route>

      {/* 👔 Admin Portal — DashboardLayout */}
      <Route element={<ProtectedRoute/>}>
        <Route path="/admin" element={<DashboardLayout />}>
          <Route index element={<div className="p-4">Admin Dashboard</div>} />
          <Route path="teachers"      element={<TeacherManager />} />
          <Route path="syllabus"      element={<SyllabusManager />} />
          <Route path="classes"       element={<ClassManager />} />
          <Route path="staff"         element={<div className="p-4">จัดการเจ้าหน้าที่</div>} />
          <Route path="students"      element={<StudentManager />} />
          <Route path="announcements" element={<div className="p-4">ประกาศ</div>} />
          <Route path="reports"       element={<div className="p-4">รายงาน</div>} />
          <Route path="calendar"      element={<AcademicCalendar />} />
          <Route path="curriculum"    element={<CurriculumManager />} />
        </Route>
      </Route>

      {/* 🏢 Staff Portal — DashboardLayout */}
      <Route element={<ProtectedRoute/>}>
        <Route path="/staff" element={<DashboardLayout />}>
          <Route index element={<div className="p-4">Staff Dashboard</div>} />
          <Route path="students"      element={<StudentManager />} />
          <Route path="attendance"    element={<div className="p-4">บันทึกการเข้าเรียน</div>} />
          <Route path="schedule"      element={<div className="p-4">ตารางงาน</div>} />
          <Route path="documents"     element={<div className="p-4">เอกสาร</div>} />
          <Route path="announcements" element={<div className="p-4">ประกาศ</div>} />
          <Route path="calendar"      element={<AcademicCalendar />} />
        </Route>
      </Route>

      {/* 📚 Teacher Portal — DashboardLayout */}
      <Route element={<ProtectedRoute/>}>
        <Route path="/teacher" element={<DashboardLayout />}>
          <Route index element={<div className="p-4">Teacher Dashboard</div>} />
          <Route path="schedule"   element={<ScheduleEditor />} />
          <Route path="syllabus"   element={<TeacherSyllabusPage />} />
          <Route path="students"   element={<StudentManager />} />
          <Route path="attendance" element={<div className="p-4">บันทึกการเข้าเรียน</div>} />
          <Route path="grades"     element={<div className="p-4">จัดการคะแนน</div>} />
          <Route path="reports"    element={<div className="p-4">รายงานผล</div>} />
          <Route path="calendar"   element={<AcademicCalendar />} />
        </Route>
      </Route>

      {/* 🎓 Student Portal — PortalLayout (รูปแบบเดิม) */}
      <Route element={<ProtectedRoute/>}>
        <Route path="/student" element={<PortalLayout />}>
          <Route index element={<div>Student Dashboard</div>} />
        </Route>
      </Route>

      {/* 👨‍👩‍👧 Parent Portal — PortalLayout (รูปแบบเดิม) */}
      <Route element={<ProtectedRoute/>}>
        <Route path="/parent" element={<PortalLayout />}>
          <Route index element={<div>Parent Dashboard</div>} />
        </Route>
      </Route>

      {/* Default Route */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<div className="p-10">404 - ไม่พบหน้านี้</div>} />
    </Routes>
  );
};