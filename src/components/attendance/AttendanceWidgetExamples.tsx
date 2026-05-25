/**
 * AttendanceWidgetExamples.tsx
 *
 * This file demonstrates various ways to use the AttendanceCheckInWidget
 * in different dashboard and portal layouts.
 */

import AttendanceCheckInWidget from './AttendanceCheckInWidget';

/**
 * Example 1: Dashboard Widget Grid
 * Shows multiple compact widgets in a grid layout
 */
export function DashboardWidgetGridExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div>
        <h3 className="text-sm font-bold text-slate-700 mb-3">Attendance</h3>
        <AttendanceCheckInWidget compact={true} />
      </div>
      {/* Other widgets go here */}
    </div>
  );
}

/**
 * Example 2: Staff Portal - Full Page
 * Full-featured widget with history for staff portal
 */
export function StaffPortalExample() {
  return (
    <div className="max-w-2xl mx-auto">
      <AttendanceCheckInWidget
        compact={false}
        showHistory={true}
        onStatusChange={(status) => {
          // Optional: Log, send analytics, etc.
          console.log('Attendance status:', status);
        }}
      />
    </div>
  );
}

/**
 * Example 3: Home Page Widget
 * Compact version for home/dashboard page
 */
export function HomePageWidgetExample() {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-bold text-slate-800">Daily Check-In</h2>
      <AttendanceCheckInWidget
        compact={true}
        showHistory={false}
      />
    </section>
  );
}

/**
 * Example 4: Sidebar Integration
 * Very compact for sidebar or mobile quick access
 */
export function SidebarExample() {
  return (
    <div className="sticky top-4">
      <AttendanceCheckInWidget
        compact={true}
        showHistory={false}
      />
    </div>
  );
}

/**
 * Example 5: Full Dashboard with Context
 * Complete example showing widget in context
 */
export function FullDashboardExample() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Welcome back! Here's your daily overview.</p>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Attendance widget */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-3">Attendance</h2>
            <AttendanceCheckInWidget
              compact={false}
              showHistory={true}
              onStatusChange={() => {
                // Integration with your analytics or notification system
              }}
            />
          </div>

          {/* Other content */}
          <div className="bg-white/30 backdrop-blur-md rounded-3xl p-6 border border-white/20">
            <h3 className="font-bold text-slate-800">Quick Links</h3>
            {/* Add your content here */}
          </div>
        </div>

        {/* Right column - Sidebar */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-600 px-1">Quick Access</h3>

          {/* Compact attendance widget for sidebar */}
          <AttendanceCheckInWidget
            compact={true}
            showHistory={false}
          />

          {/* Other sidebar widgets */}
        </div>
      </div>
    </div>
  );
}

/**
 * Example 6: Conditional Rendering based on Role
 * Different widget sizes based on user role
 */
export function RoleBasedExample({ userRole }: { userRole: string }) {
  // Staff see full widget with history
  if (userRole === 'staff') {
    return <AttendanceCheckInWidget compact={false} showHistory={true} />;
  }

  // Admins see compact version (they're not checking in)
  if (userRole === 'admin') {
    return null;
  }

  // Teachers see compact version
  return <AttendanceCheckInWidget compact={true} />;
}

/**
 * Example 7: With Loading State Management
 * Integration with parent component state
 */
export function WithStateExample() {
  const handleStatusChange = (status: 'present' | 'late' | 'absent') => {
    // Send to analytics, update database, etc.
    console.log('Status changed to:', status);
  };

  return (
    <div className="space-y-4">
      <AttendanceCheckInWidget
        compact={true}
        showHistory={true}
        onStatusChange={handleStatusChange}
      />

      {/* Related content can go here */}
    </div>
  );
}

/**
 * Example 8: Mobile Responsive Layout
 * Optimized for mobile-first responsive design
 */
export function MobileResponsiveExample() {
  return (
    <div className="w-full max-w-full px-4 py-6">
      {/* Automatically responsive - compact on mobile, full on desktop */}
      <AttendanceCheckInWidget
        compact={true}
        showHistory={true}
      />
    </div>
  );
}
