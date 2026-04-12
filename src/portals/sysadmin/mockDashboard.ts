export const stats = [
  {
    label: 'บัญชีผู้ใช้ทั้งหมด',
    value: '1,248',
    sub: '+12% จากเดือนที่แล้ว',
    trend: 'up',
    icon: 'group',
    glow: '#7c3aed',
    gradient: 'from-violet-500 to-indigo-500',
  },
  {
    label: 'ผู้ใช้ออนไลน์วันนี้',
    value: '87',
    sub: '+5% จากเมื่อวาน',
    trend: 'up',
    icon: 'person_check',
    glow: '#059669',
    gradient: 'from-emerald-400 to-teal-500',
  },
  {
    label: 'พื้นที่จัดเก็บ (GB)',
    value: '45',
    sub: '45 / 100 GB ที่ใช้',
    trend: 'neutral',
    icon: 'database',
    glow: '#d97706',
    gradient: 'from-amber-400 to-orange-500',
  },
  {
    label: 'สถานะระบบ',
    value: 'Online',
    sub: 'Uptime 99.9%',
    trend: 'up',
    icon: 'heart_check',
    glow: '#0ea5e9',
    gradient: 'from-sky-400 to-blue-500',
  },
];

export const roleBreakdown = [
  { role: 'นักเรียน',      count: 650, pct: 92, color: '#7c3aed' },
  { role: 'ผู้ปกครอง',    count: 310, pct: 68, color: '#2563eb' },
  { role: 'ครูผู้สอน',    count: 84,  pct: 38, color: '#e11d48' },
  { role: 'เจ้าหน้าที่', count: 28,  pct: 25, color: '#059669' },
  { role: 'ผู้บริหาร', count: 12,  pct: 15, color: '#d97706' },
  { role: 'System Admin', count: 4,   pct: 6,  color: '#64748b' },
];

export const quickActions = [
  { label: 'เพิ่มผู้ใช้',   icon: 'person_add',          path: '/sysadmin/users',    glow: '#7c3aed', gradient: 'from-violet-500 to-indigo-500' },
  { label: 'กำหนดสิทธิ์',  icon: 'admin_panel_settings', path: '/sysadmin/roles',    glow: '#2563eb', gradient: 'from-sky-500 to-blue-600' },
  { label: 'Backup ข้อมูล', icon: 'cloud_upload',         path: '/sysadmin/settings', glow: '#d97706', gradient: 'from-amber-400 to-orange-500' },
  { label: 'ดู Audit Log',  icon: 'history',              path: '/sysadmin/logs',     glow: '#059669', gradient: 'from-emerald-400 to-teal-500' },
];

export const systemServices = [
  { name: 'Firebase Auth',      latency: '12ms',  ok: true },
  { name: 'Firestore Database', latency: '28ms',  ok: true },
  { name: 'Cloud Storage',      latency: '45ms',  ok: true },
  { name: 'Cloud Functions',    latency: '120ms', ok: true },
  { name: 'FCM Notifications',  latency: '65ms',  ok: true },
];

export const recentLogs = [
  { id: 1, action: 'User Role Updated',      user: 'admin_somchai',    time: '10 นาทีที่แล้ว',   timestamp: '2026-04-12T14:35:00',  status: 'success' as const,  category: 'user' as const },
  { id: 2, action: 'System Backup Created',  user: 'system',           time: '1 ชั่วโมงที่แล้ว',  timestamp: '2026-04-12T13:45:00', status: 'success' as const,  category: 'system' as const },
  { id: 3, action: 'Failed Login Attempt',   user: 'unknown@mail.com', time: '2 ชั่วโมงที่แล้ว',  timestamp: '2026-04-12T12:45:00', status: 'warning' as const,  category: 'security' as const },
  { id: 4, action: 'New Teacher Registered', user: 'admin_malee',      time: '3 ชั่วโมงที่แล้ว',  timestamp: '2026-04-12T11:45:00', status: 'success' as const,  category: 'user' as const },
  { id: 5, action: 'Academic Year Changed',  user: 'sysadmin_root',    time: '1 วันที่แล้ว',     timestamp: '2026-04-11T10:00:00', status: 'success' as const,  category: 'academic' as const },
  { id: 6, action: 'Security Rule Modified', user: 'sysadmin_root',    time: '1 วันที่แล้ว',     timestamp: '2026-04-11T09:30:00', status: 'warning' as const,  category: 'security' as const },
  { id: 7, action: 'Database Optimization',  user: 'system',           time: '2 วันที่แล้ว',     timestamp: '2026-04-10T22:00:00', status: 'success' as const,  category: 'system' as const },
  { id: 8, action: 'Bulk Student Import',    user: 'admin_nida',       time: '2 วันที่แล้ว',     timestamp: '2026-04-10T15:20:00', status: 'success' as const,  category: 'data' as const },
  { id: 9, action: 'Failed Backup Attempt',  user: 'system',           time: '3 วันที่แล้ว',     timestamp: '2026-04-09T20:00:00', status: 'error' as const,    category: 'system' as const },
  { id: 10, action: 'Class Schedule Updated', user: 'admin_somchai',   time: '3 วันที่แล้ว',     timestamp: '2026-04-09T10:15:00', status: 'success' as const,  category: 'academic' as const },
  { id: 11, action: 'Invalid API Request',   user: 'api_client_003',   time: '4 วันที่แล้ว',     timestamp: '2026-04-08T18:45:00', status: 'warning' as const,  category: 'security' as const },
  { id: 12, action: 'User Account Disabled', user: 'admin_malee',      time: '4 วันที่แล้ว',     timestamp: '2026-04-08T14:30:00', status: 'success' as const,  category: 'user' as const },
  { id: 13, action: 'Grade Data Exported',   user: 'admin_nida',       time: '5 วันที่แล้ว',     timestamp: '2026-04-07T16:00:00', status: 'success' as const,  category: 'data' as const },
  { id: 14, action: 'Server Performance Issue', user: 'monitoring',     time: '5 วันที่แล้ว',     timestamp: '2026-04-07T09:15:00', status: 'warning' as const,  category: 'system' as const },
  { id: 15, action: 'Firestore Rules Updated', user: 'sysadmin_root',  time: '6 วันที่แล้ว',     timestamp: '2026-04-06T11:00:00', status: 'success' as const,  category: 'security' as const },
  { id: 16, action: 'Parent Account Created', user: 'admin_somchai',   time: '1 สัปดาห์ที่แล้ว',  timestamp: '2026-04-05T13:45:00', status: 'success' as const,  category: 'user' as const },
  { id: 17, action: 'Unauthorized Access Attempt', user: 'unknown_ip', time: '1 สัปดาห์ที่แล้ว',  timestamp: '2026-04-05T02:30:00', status: 'error' as const,    category: 'security' as const },
  { id: 18, action: 'Attendance Data Synced', user: 'system',          time: '1 สัปดาห์ที่แล้ว',  timestamp: '2026-04-04T23:59:00', status: 'success' as const,  category: 'data' as const },
  { id: 19, action: 'API Rate Limit Exceeded', user: 'api_client_001', time: '8 วันที่แล้ว',     timestamp: '2026-04-04T17:20:00', status: 'warning' as const,  category: 'system' as const },
  { id: 20, action: 'Term Configuration Changed', user: 'sysadmin_root', time: '1 สัปดาห์ที่แล้ว',  timestamp: '2026-04-03T10:30:00', status: 'success' as const,  category: 'academic' as const },
  { id: 21, action: 'Certificate Template Updated', user: 'admin_malee', time: '2 สัปดาห์ที่แล้ว', timestamp: '2026-03-29T14:00:00', status: 'success' as const,  category: 'data' as const },
];