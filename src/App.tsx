import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/features/auth/authService';
import { PermissionGate } from '@/components/PermissionGate';
import { Toaster } from '@/components/ui/sonner';

// ── Layouts ──
const PortalLayout = lazy(() => import('./components/layouts/PortalLayout'));

// ── Auth Pages ──
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));

// ── Home ──
const HomePage = lazy(() => import('@/features/home/HomePage'));

// ── Feature Pages ──
const UsersPage = lazy(() => import('@/features/users/UsersPage'));
const LogsPage = lazy(() => import('@/features/logs/LogsPage'));
const AcademicCalendar = lazy(() => import('@/features/calendar/AcademicCalendar'));
const CurriculumManager = lazy(() => import('@/features/curriculum/CurriculumManager'));
const ScheduleEditor = lazy(() => import('@/features/schedule/ScheduleEditor'));
const TeacherManager = lazy(() => import('@/features/teachers/TeacherManager'));
const ClassManager = lazy(() => import('@/features/classes/ClassManager'));
const StudentManager = lazy(() => import('@/features/students/StudentManager'));
const RolePermissionManager = lazy(() => import('@/features/roles/RolePermissionManager'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const CourseMigrationTool = lazy(() => import('@/features/settings/CourseMigrationTool'));
const ExamLayout = lazy(() => import('@/features/exam/ExamLayout'));
const ExamDashboardPage = lazy(() => import('@/features/exam/ExamDashboardPage'));
const ExamManager = lazy(() => import('@/features/exam/ExamManager'));
const StudentExamPage = lazy(() => import('@/features/exam/StudentExamPage'));
const QuestionBankManager = lazy(() => import('@/features/questionBank/QuestionBankManager'));
const StaffAttendancePage = lazy(() => import('@/features/attendance/StaffAttendancePage'));
const TeacherKpiPage = lazy(() => import('@/features/teacherKpi/TeacherKpiPage'));
const FingerprintDeviceManagerPage = lazy(() => import('@/features/fingerprintDevices/FingerprintDeviceManagerPage'));
const AttendanceCenterPage = lazy(() => import('@/features/attendance/AttendanceCenterPage'));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage'));
const LeaveManagementPage = lazy(() => import('@/features/leave/LeaveManagementPage'));
const LeaveReportPage = lazy(() => import('@/features/leave/LeaveReportPage'));
const LessonPlanManager = lazy(() => import('@/features/lessonPlan/LessonPlanManager'));
const MicroSyllabusPage = lazy(() => import('@/features/microSyllabus/MicroSyllabusPage'));
const DutySchedulePage = lazy(() => import('@/features/duty/DutySchedulePage'));
const ReportControlCenter = lazy(() => import('@/features/reports/ReportControlCenter'));
const AnnouncementsPage = lazy(() => import('@/features/announcements/AnnouncementsPage'));
const FeedbackPage = lazy(() => import('@/features/feedback/FeedbackPage'));
const BehaviorScorePage = lazy(() => import('@/features/behavior/BehaviorScorePage'));
const GradeBookPage = lazy(() => import('@/features/grades/GradeBookPage'));
const LineConnectPage = lazy(() => import('@/features/profile/LineConnectPage'));
const LineCheckInPage = lazy(() => import('@/features/lineCheckIn/LineCheckInPage'));
const MorningRollCallLayout = lazy(() => import('@/features/attendance/MorningRollCallLayout'));
const MorningRollCallPage = lazy(() => import('@/features/attendance/MorningRollCallPage'));
const MorningRollCallDashboardPage = lazy(() => import('@/features/attendance/MorningRollCallDashboardPage'));
const FuturePlanPage = lazy(() => import('@/features/futurePlan/FuturePlanPage'));
const WordGamePage = lazy(() => import('@/features/wordGame/WordGamePage'));
const AiAgentCommandPage = lazy(() => import('@/features/aiAgents/AiAgentCommandPage'));
const TasksPage = lazy(() => import('@/features/tasks/TasksPage'));
const AdminTuitionView = lazy(() => import('@/features/tuition/AdminTuitionView'));
const TuitionLayout = lazy(() => import('@/features/tuition/TuitionLayout'));
const TuitionDashboardPage = lazy(() => import('@/features/tuition/TuitionDashboardPage'));
const TuitionCampaignsPage = lazy(() => import('@/features/tuition/TuitionCampaignsPage'));
const CoursesPage = lazy(() => import('@/features/courses/CoursesPage'));
const CoursePlayerPage = lazy(() => import('@/features/courses/CoursePlayerPage'));


/** แสดง component การเข้าเรียน (ของนักเรียน) */
function AttendanceRouter() {
  return <AttendanceCenterPage />;
}

/**
 * Component สำหรับตรวจสอบสถานะการ Login
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #fce7f3, #fda4af)' }}
      >
        <div className="w-8 h-8 border-3 border-pink-300 border-t-pink-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RouteLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );
}


export default function App() {
  useEffect(() => {
    const unsubscribe = authService.listenToAuthChanges();
    return () => unsubscribe();
  }, []);

  return (
    <Router>
<Suspense fallback={<RouteLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login"  element={<LoginPage />} />
          <Route path="/signup" element={<LoginPage />} />
          <Route path="/line/connect" element={<LineConnectPage />} />
          <Route path="/line/checkin" element={<LineCheckInPage />} />

          {/* ── Portal Pages (Nested under PortalLayout) ── */}
          <Route
            path="/portal"
            element={
              <ProtectedRoute>
                <PortalLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<HomePage />} />

            {/* ── ทุก route ด้านล่างถูกป้องกันด้วย PermissionGate ──
                featureKey ต้องตรงกับ FEATURE_LIST ใน src/types/rolePermission.ts
                สิทธิ์บริหารจาก /portal/roles — ไม่ต้องแตะ Firebase Rules ──────── */}

            <Route path="users" element={
              <PermissionGate featureKey="users">
                <UsersPage />
              </PermissionGate>
            } />
            <Route path="logs" element={
              <PermissionGate featureKey="logs">
                <LogsPage />
              </PermissionGate>
            } />
            <Route path="roles" element={
              <PermissionGate featureKey="roles">
                <RolePermissionManager />
              </PermissionGate>
            } />
            <Route path="calendar" element={
              <PermissionGate featureKey="calendar">
                <AcademicCalendar />
              </PermissionGate>
            } />
            <Route path="curriculum" element={
              <PermissionGate featureKey="curriculum">
                <CurriculumManager />
              </PermissionGate>
            } />
            <Route path="schedule" element={
              <PermissionGate featureKey="schedule">
                <ScheduleEditor />
              </PermissionGate>
            } />
            <Route path="teachers" element={
              <PermissionGate featureKey="teachers">
                <TeacherManager />
              </PermissionGate>
            } />
            <Route path="lesson-plan" element={
              <PermissionGate featureKey="lessonPlan">
                <LessonPlanManager />
              </PermissionGate>
            } />
            <Route path="micro-syllabus" element={
              <PermissionGate featureKey="microSyllabus">
                <MicroSyllabusPage />
              </PermissionGate>
            } />
            <Route path="classes" element={
              <PermissionGate featureKey="classes">
                <ClassManager />
              </PermissionGate>
            } />
            <Route path="students" element={
              <PermissionGate featureKey="students">
                <StudentManager />
              </PermissionGate>
            } />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="exams" element={
              <PermissionGate featureKey="exams">
                <ExamLayout />
              </PermissionGate>
            }>
              <Route path="rooms" element={<ExamManager />} />
              <Route index element={<ExamDashboardPage />} />
            </Route>
            <Route path="question-bank" element={
              <PermissionGate featureKey="questionBank">
                <QuestionBankManager />
              </PermissionGate>
            } />
            <Route path="ai-agents" element={
              <PermissionGate featureKey="aiAgents">
                <AiAgentCommandPage />
              </PermissionGate>
            } />
            <Route path="tasks" element={
              <PermissionGate featureKey="tasks">
                <TasksPage />
              </PermissionGate>
            } />
            <Route path="grades" element={
              <PermissionGate featureKey="grades">
                <GradeBookPage />
              </PermissionGate>
            } />
            <Route path="attendance" element={
              <PermissionGate featureKey="attendance">
                <AttendanceRouter />
              </PermissionGate>
            } />
            <Route path="staff-attendance" element={
              <PermissionGate featureKey="staffAttendance">
                <StaffAttendancePage />
              </PermissionGate>
            } />
            <Route path="fingerprint-devices" element={
              <PermissionGate featureKey="fingerprintDevices">
                <FingerprintDeviceManagerPage />
              </PermissionGate>
            } />
            <Route path="teacher-kpi" element={
              <PermissionGate featureKey="teacherKpi">
                <TeacherKpiPage />
              </PermissionGate>
            } />
            <Route path="morning-rollcall" element={
              <PermissionGate featureKey="morningRollCall">
                <MorningRollCallLayout />
              </PermissionGate>
            }>
              <Route path="dashboard" element={<Navigate to="/portal/morning-rollcall" replace />} />
              <Route path="check" element={<MorningRollCallPage />} />
              <Route index element={<MorningRollCallDashboardPage />} />
            </Route>
            <Route path="leave" element={
              <PermissionGate featureKey="leave">
                <LeaveManagementPage />
              </PermissionGate>
            } />
            <Route path="leave/report" element={
              <PermissionGate featureKey="leave">
                <LeaveReportPage />
              </PermissionGate>
            } />
            <Route path="duty-schedule" element={
              <PermissionGate featureKey="dutySchedule">
                <DutySchedulePage />
              </PermissionGate>
            } />
            <Route path="report-control" element={
              <PermissionGate featureKey="reports" require="edit">
                <ReportControlCenter />
              </PermissionGate>
            } />
            <Route path="announcements" element={
              <PermissionGate featureKey="announcements">
                <AnnouncementsPage />
              </PermissionGate>
            } />
            <Route path="feedback" element={
              <PermissionGate featureKey="feedback">
                <FeedbackPage />
              </PermissionGate>
            } />
            <Route path="behavior" element={
              <PermissionGate featureKey="behaviorScore">
                <BehaviorScorePage />
              </PermissionGate>
            } />
            <Route path="future-plan" element={
              <PermissionGate featureKey="futurePlan">
                <FuturePlanPage />
              </PermissionGate>
            } />
            <Route path="tuition" element={
              <PermissionGate featureKey="tuition">
                <TuitionLayout />
              </PermissionGate>
            }>
              <Route index element={<TuitionDashboardPage />} />
              <Route path="campaigns" element={<TuitionCampaignsPage />} />
              <Route path="campaigns/:campaignId" element={<AdminTuitionView />} />
            </Route>
            <Route path="courses" element={
              <PermissionGate featureKey="courseOnDemand">
                <CoursesPage />
              </PermissionGate>
            } />
            <Route path="courses/:courseId" element={
              <PermissionGate featureKey="courseOnDemand">
                <CoursePlayerPage />
              </PermissionGate>
            } />
            <Route path="word-game" element={
              <PermissionGate featureKey="wordGame">
                <WordGamePage />
              </PermissionGate>
            } />
            {/* settings — sysadmin เท่านั้น require='full' */}
            <Route path="settings" element={
              <PermissionGate featureKey="settings" require="full">
                <SettingsPage />
              </PermissionGate>
            } />
            
            <Route path="migrate" element={
              <PermissionGate featureKey="settings" require="full">
                <CourseMigrationTool />
              </PermissionGate>
            } />
          </Route>

          {/* Student exam room (standalone — no portal layout) */}
          <Route path="/exam/:roomId" element={<StudentExamPage />} />

          {/* Legacy redirects */}
          <Route path="/" element={<Navigate to="/portal" replace />} />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Routes>
      </Suspense>
      <Toaster position="bottom-center" />
    </Router>
  );
}
