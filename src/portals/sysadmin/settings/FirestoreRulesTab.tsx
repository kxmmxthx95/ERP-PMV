import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database, Copy, Check, RotateCcw, ChevronDown, ChevronRight,
  AlertTriangle, Info, ShieldCheck, ShieldAlert, Code2,
  Layers, FlaskConical, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GLASS_CARD } from './constants';

// ── Default Rules ─────────────────────────────────────────────────────────────
const DEFAULT_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helper Functions ────────────────────────────────────────────────────
    function isAuth() {
      return request.auth != null;
    }

    function role() {
      return request.auth.token.role;
    }

    function isRole(r) {
      return isAuth() && role() == r;
    }

    function isAnyRole(roles) {
      return isAuth() && role() in roles;
    }

    function isSysAdmin() {
      return isRole('sysadmin');
    }

    function isAdmin() {
      return isAnyRole(['admin', 'sysadmin']);
    }

    function isTeacher() {
      return isAnyRole(['teacher', 'admin', 'sysadmin']);
    }

    function isStaff() {
      return isAnyRole(['staff', 'admin', 'sysadmin']);
    }

    function isOwner(uid) {
      return isAuth() && request.auth.uid == uid;
    }

    // ── Users Collection ────────────────────────────────────────────────────
    match /users/{userId} {
      allow read: if isAuth();
      allow create: if isSysAdmin();
      allow update: if isOwner(userId) || isAdmin();
      allow delete: if isSysAdmin();
    }

    // ── Students Collection ─────────────────────────────────────────────────
    match /students/{studentId} {
      allow read: if isAuth() && (
        isAnyRole(['teacher', 'staff', 'admin', 'sysadmin']) ||
        isOwner(resource.data.uid) ||
        (isRole('parent') && request.auth.uid in resource.data.parentUIDs)
      );
      allow create: if isAdmin();
      allow update: if isAdmin() || isTeacher();
      allow delete: if isSysAdmin();
    }

    // ── Classes Collection ──────────────────────────────────────────────────
    match /classes/{classId} {
      allow read: if isAuth();
      allow write: if isAdmin();
    }

    // ── Grades Collection ───────────────────────────────────────────────────
    match /grades/{gradeId} {
      allow read: if isAuth() && (
        isAnyRole(['teacher', 'staff', 'admin', 'sysadmin']) ||
        isOwner(resource.data.studentId) ||
        (isRole('parent') && request.auth.uid in
          get(/databases/$(database)/documents/students/$(resource.data.studentId)).data.parentUIDs)
      );
      allow create: if isTeacher();
      allow update: if isTeacher() && (
        resource.data.teacherId == request.auth.uid || isAdmin()
      );
      allow delete: if isAdmin();
    }

    // ── Schedules Collection ────────────────────────────────────────────────
    match /schedules/{scheduleId} {
      allow read: if isAuth();
      allow write: if isAdmin();
    }

    // ── Attendance Collection ───────────────────────────────────────────────
    match /attendance/{attendanceId} {
      allow read: if isAuth() && (
        isAnyRole(['teacher', 'staff', 'admin', 'sysadmin']) ||
        isOwner(resource.data.studentId) ||
        (isRole('parent') && request.auth.uid in
          get(/databases/$(database)/documents/students/$(resource.data.studentId)).data.parentUIDs)
      );
      allow create: if isTeacher();
      allow update: if isTeacher() && (
        resource.data.recordedBy == request.auth.uid || isAdmin()
      );
      allow delete: if isAdmin();
    }

    // ── Notifications Collection ────────────────────────────────────────────
    match /notifications/{notifId} {
      allow read: if isAuth() && (
        role() in resource.data.targetRoles ||
        request.auth.uid in resource.data.targetUIDs ||
        isAdmin()
      );
      allow create: if isAnyRole(['teacher', 'staff', 'admin', 'sysadmin']);
      allow update: if isAdmin() ||
        resource.data.createdBy == request.auth.uid;
      allow delete: if isAdmin();
    }

    // ── Academic Years Collection ───────────────────────────────────────────
    match /academicYears/{yearId} {
      allow read: if isAuth();
      allow write: if isSysAdmin();
    }

    // ── System Config Collection ────────────────────────────────────────────
    match /systemConfig/{configId} {
      allow read: if isAuth();
      allow write: if isSysAdmin();
    }
  }
}`;

// ── Snippet Library ───────────────────────────────────────────────────────────
const SNIPPETS = [
  {
    id: 'helper-functions',
    label: 'Helper Functions',
    description: 'ฟังก์ชันช่วยตรวจสอบ role และ auth',
    color: '#7c3aed',
    code: `function isAuth() {
  return request.auth != null;
}

function role() {
  return request.auth.token.role;
}

function isRole(r) {
  return isAuth() && role() == r;
}

function isAnyRole(roles) {
  return isAuth() && role() in roles;
}

function isSysAdmin() {
  return isRole('sysadmin');
}

function isAdmin() {
  return isAnyRole(['admin', 'sysadmin']);
}

function isOwner(uid) {
  return isAuth() && request.auth.uid == uid;
}`,
  },
  {
    id: 'users-rule',
    label: 'Users Collection',
    description: 'Rule สำหรับ collection users',
    color: '#0891b2',
    code: `match /users/{userId} {
  allow read: if isAuth();
  allow create: if isSysAdmin();
  allow update: if isOwner(userId) || isAdmin();
  allow delete: if isSysAdmin();
}`,
  },
  {
    id: 'grades-rule',
    label: 'Grades Collection',
    description: 'Rule สำหรับ grades พร้อม parent access',
    color: '#059669',
    code: `match /grades/{gradeId} {
  allow read: if isAuth() && (
    isAnyRole(['teacher', 'staff', 'admin', 'sysadmin']) ||
    isOwner(resource.data.studentId) ||
    (isRole('parent') && request.auth.uid in
      get(/databases/$(database)/documents/students/$(resource.data.studentId)).data.parentUIDs)
  );
  allow create: if isTeacher();
  allow update: if isTeacher() && (
    resource.data.teacherId == request.auth.uid || isAdmin()
  );
  allow delete: if isAdmin();
}`,
  },
  {
    id: 'notifications-rule',
    label: 'Notifications Collection',
    description: 'Rule สำหรับ notifications ตาม targetRoles',
    color: '#d97706',
    code: `match /notifications/{notifId} {
  allow read: if isAuth() && (
    role() in resource.data.targetRoles ||
    request.auth.uid in resource.data.targetUIDs ||
    isAdmin()
  );
  allow create: if isAnyRole(['teacher', 'staff', 'admin', 'sysadmin']);
  allow update: if isAdmin() ||
    resource.data.createdBy == request.auth.uid;
  allow delete: if isAdmin();
}`,
  },
  {
    id: 'deny-all',
    label: 'Deny All (Lockdown)',
    description: 'ปิดการเข้าถึงทั้งหมด — ใช้ใน emergency',
    color: '#dc2626',
    code: `match /{document=**} {
  allow read, write: if false;
}`,
  },
];

// ── Rule Tester ───────────────────────────────────────────────────────────────
type TesterRole = 'student' | 'parent' | 'teacher' | 'staff' | 'admin' | 'sysadmin' | 'unauthenticated';
type TesterOperation = 'read' | 'create' | 'update' | 'delete';
type TesterCollection = 'users' | 'students' | 'grades' | 'schedules' | 'attendance' | 'notifications' | 'academicYears' | 'systemConfig';

interface TesterResult {
  allowed: boolean;
  reason: string;
}

function simulateRule(
  collection: TesterCollection,
  operation: TesterOperation,
  role: TesterRole,
): TesterResult {
  if (role === 'unauthenticated') {
    return { allowed: false, reason: 'ไม่ได้ล็อกอิน — isAuth() = false' };
  }

  const isAdmin = role === 'admin' || role === 'sysadmin';
  const isSysAdmin = role === 'sysadmin';
  const isTeacher = role === 'teacher' || isAdmin;
  const isStaffOrAbove = role === 'staff' || isTeacher;

  const rules: Record<TesterCollection, Record<TesterOperation, () => TesterResult>> = {
    users: {
      read:   () => ({ allowed: true,    reason: 'isAuth() = true → อนุญาต' }),
      create: () => ({ allowed: isSysAdmin, reason: isSysAdmin ? 'isSysAdmin() = true' : 'ต้องเป็น sysadmin เท่านั้น' }),
      update: () => ({ allowed: role === 'student' ? false : true, reason: isAdmin ? 'isAdmin() = true' : role === 'student' ? 'student ไม่สามารถแก้ไข user อื่นได้' : 'isOwner() = true (สมมติเป็น owner)' }),
      delete: () => ({ allowed: isSysAdmin, reason: isSysAdmin ? 'isSysAdmin() = true' : 'ต้องเป็น sysadmin เท่านั้น' }),
    },
    students: {
      read:   () => ({ allowed: isStaffOrAbove || role === 'student' || role === 'parent', reason: isStaffOrAbove ? `isAnyRole(['teacher','staff','admin','sysadmin'])` : 'owner หรือ parent' }),
      create: () => ({ allowed: isAdmin, reason: isAdmin ? 'isAdmin() = true' : 'ต้องเป็น admin หรือ sysadmin' }),
      update: () => ({ allowed: isAdmin || isTeacher, reason: isAdmin ? 'isAdmin()' : isTeacher ? 'isTeacher()' : 'ต้องเป็น teacher ขึ้นไป' }),
      delete: () => ({ allowed: isSysAdmin, reason: isSysAdmin ? 'isSysAdmin() = true' : 'ต้องเป็น sysadmin เท่านั้น' }),
    },
    grades: {
      read:   () => ({ allowed: isStaffOrAbove || role === 'student' || role === 'parent', reason: isStaffOrAbove ? 'teacher/staff/admin' : 'student (own) หรือ parent' }),
      create: () => ({ allowed: isTeacher, reason: isTeacher ? 'isTeacher()' : 'ต้องเป็น teacher ขึ้นไป' }),
      update: () => ({ allowed: isTeacher, reason: isTeacher ? 'isTeacher() && isOwner(teacherId) หรือ isAdmin()' : 'ต้องเป็น teacher ขึ้นไป' }),
      delete: () => ({ allowed: isAdmin, reason: isAdmin ? 'isAdmin()' : 'ต้องเป็น admin หรือ sysadmin' }),
    },
    schedules: {
      read:   () => ({ allowed: true,    reason: 'isAuth() = true → อนุญาต' }),
      create: () => ({ allowed: isAdmin, reason: isAdmin ? 'isAdmin()' : 'ต้องเป็น admin หรือ sysadmin' }),
      update: () => ({ allowed: isAdmin, reason: isAdmin ? 'isAdmin()' : 'ต้องเป็น admin หรือ sysadmin' }),
      delete: () => ({ allowed: isAdmin, reason: isAdmin ? 'isAdmin()' : 'ต้องเป็น admin หรือ sysadmin' }),
    },
    attendance: {
      read:   () => ({ allowed: isStaffOrAbove || role === 'student' || role === 'parent', reason: isStaffOrAbove ? 'teacher/staff/admin' : 'student หรือ parent' }),
      create: () => ({ allowed: isTeacher, reason: isTeacher ? 'isTeacher()' : 'ต้องเป็น teacher ขึ้นไป' }),
      update: () => ({ allowed: isTeacher, reason: isTeacher ? 'isTeacher() && isOwner(recordedBy) หรือ isAdmin()' : 'ต้องเป็น teacher ขึ้นไป' }),
      delete: () => ({ allowed: isAdmin,   reason: isAdmin ? 'isAdmin()' : 'ต้องเป็น admin หรือ sysadmin' }),
    },
    notifications: {
      read:   () => ({ allowed: true, reason: 'อนุญาตถ้า role อยู่ใน targetRoles หรือ uid ใน targetUIDs (สมมติตรงเงื่อนไข)' }),
      create: () => ({ allowed: isStaffOrAbove, reason: isStaffOrAbove ? `isAnyRole(['teacher','staff','admin','sysadmin'])` : 'ต้องเป็น staff ขึ้นไป' }),
      update: () => ({ allowed: isAdmin, reason: isAdmin ? 'isAdmin() หรือ createdBy == uid' : 'ต้องเป็น admin หรือ creator' }),
      delete: () => ({ allowed: isAdmin, reason: isAdmin ? 'isAdmin()' : 'ต้องเป็น admin หรือ sysadmin' }),
    },
    academicYears: {
      read:   () => ({ allowed: true,       reason: 'isAuth() = true → อนุญาต' }),
      create: () => ({ allowed: isSysAdmin, reason: isSysAdmin ? 'isSysAdmin()' : 'ต้องเป็น sysadmin เท่านั้น' }),
      update: () => ({ allowed: isSysAdmin, reason: isSysAdmin ? 'isSysAdmin()' : 'ต้องเป็น sysadmin เท่านั้น' }),
      delete: () => ({ allowed: isSysAdmin, reason: isSysAdmin ? 'isSysAdmin()' : 'ต้องเป็น sysadmin เท่านั้น' }),
    },
    systemConfig: {
      read:   () => ({ allowed: true,       reason: 'isAuth() = true → อนุญาต' }),
      create: () => ({ allowed: isSysAdmin, reason: isSysAdmin ? 'isSysAdmin()' : 'ต้องเป็น sysadmin เท่านั้น' }),
      update: () => ({ allowed: isSysAdmin, reason: isSysAdmin ? 'isSysAdmin()' : 'ต้องเป็น sysadmin เท่านั้น' }),
      delete: () => ({ allowed: isSysAdmin, reason: isSysAdmin ? 'isSysAdmin()' : 'ต้องเป็น sysadmin เท่านั้น' }),
    },
  };

  return rules[collection][operation]();
}

// ── Section Component ─────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  iconColor = '#1e1e1e',
  title,
  description,
  children,
  collapsible = false,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  iconColor?: string;
  title: string;
  description: string;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-2xl overflow-hidden" style={GLASS_CARD}>
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        style={{ borderBottom: open ? '1px solid rgba(0,0,0,0.07)' : 'none' }}
        onClick={() => collapsible && setOpen(o => !o)}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0"
          style={{ background: `${iconColor}14`, border: `1px solid ${iconColor}25` }}
        >
          <Icon size={14} style={{ color: iconColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-black/75 text-xs leading-none">{title}</h2>
          <p className="text-[10px] text-black/35 mt-0.5">{description}</p>
        </div>
        {collapsible && (
          open
            ? <ChevronDown size={14} className="text-black/30 flex-shrink-0" />
            : <ChevronRight size={14} className="text-black/30 flex-shrink-0" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-4 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FirestoreRulesTab() {
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [copied, setCopied] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [activeSnippet, setActiveSnippet] = useState<string | null>(null);
  const [testerRole, setTesterRole] = useState<TesterRole>('teacher');
  const [testerCollection, setTesterCollection] = useState<TesterCollection>('grades');
  const [testerOp, setTesterOp] = useState<TesterOperation>('read');
  const [testerResult, setTesterResult] = useState<TesterResult | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rules);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setRules(DEFAULT_RULES);
  };

  const handleSave = () => {
    localStorage.setItem('school_firestore_rules', rules);
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  const handleInsertSnippet = (code: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newRules = rules.slice(0, start) + '\n' + code + '\n' + rules.slice(end);
    setRules(newRules);
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + code.length + 2;
      ta.focus();
    }, 0);
  };

  const handleTest = () => {
    const result = simulateRule(testerCollection, testerOp, testerRole);
    setTesterResult(result);
  };

  const ROLES: TesterRole[] = ['student', 'parent', 'teacher', 'staff', 'admin', 'sysadmin', 'unauthenticated'];
  const OPERATIONS: TesterOperation[] = ['read', 'create', 'update', 'delete'];
  const COLLECTIONS: TesterCollection[] = ['users', 'students', 'grades', 'schedules', 'attendance', 'notifications', 'academicYears', 'systemConfig'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      {/* ── Info Banner ── */}
      <div
        className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
        style={{ background: '#0891b20a', border: '1px solid #0891b220' }}
      >
        <Info size={12} className="mt-0.5 flex-shrink-0" style={{ color: '#0891b2' }} />
        <p className="text-[10px] leading-relaxed" style={{ color: '#0891b2' }}>
          Rules ที่แสดงอยู่นี้เป็น <strong>ข้อมูลอ้างอิง</strong> เท่านั้น
          การ deploy จริงต้องทำผ่าน <strong>Firebase Console</strong> หรือ <code className="font-mono bg-cyan-100 px-1 rounded">firebase deploy --only firestore:rules</code>
        </p>
      </div>

      {/* ── Code Editor ── */}
      <Section icon={Code2} iconColor="#1e1e1e" title="Firestore Security Rules" description="แก้ไข rules และคัดลอกไปใช้ใน Firebase Console">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <span className="text-[10px] text-black/30 ml-1 font-mono">firestore.rules</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-black/45 hover:text-black/65 hover:bg-black/05 transition-colors"
            >
              <RotateCcw size={10} />
              รีเซ็ต
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all"
              style={{
                background: copied ? '#059669' + '14' : 'rgba(0,0,0,0.05)',
                color: copied ? '#059669' : 'rgba(0,0,0,0.55)',
                border: `1px solid ${copied ? '#05966925' : 'transparent'}`,
              }}
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
              {copied ? 'คัดลอกแล้ว!' : 'คัดลอก'}
            </button>
          </div>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={rules}
            onChange={e => setRules(e.target.value)}
            rows={24}
            spellCheck={false}
            className="w-full px-4 py-3 rounded-xl text-[11px] font-mono leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-slate-300"
            style={{
              background: '#1a1a2e',
              color: '#e2e8f0',
              border: '1px solid rgba(255,255,255,0.08)',
              minHeight: 300,
            }}
          />
        </div>
      </Section>

      {/* ── Snippet Library ── */}
      <Section icon={Layers} iconColor="#7c3aed" title="Snippet Library" description="คลิกเพื่อดูโค้ด หรือแทรกลงใน editor" collapsible>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {SNIPPETS.map(snip => (
            <div
              key={snip.id}
              className="rounded-xl overflow-hidden cursor-pointer transition-all"
              style={{
                border: `1px solid ${activeSnippet === snip.id ? snip.color + '40' : 'rgba(0,0,0,0.07)'}`,
                background: activeSnippet === snip.id ? snip.color + '08' : 'rgba(255,255,255,0.5)',
              }}
              onClick={() => setActiveSnippet(activeSnippet === snip.id ? null : snip.id)}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div>
                  <p className="text-[11px] font-bold text-black/70">{snip.label}</p>
                  <p className="text-[10px] text-black/35">{snip.description}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: snip.color }}
                  />
                  {activeSnippet === snip.id
                    ? <ChevronDown size={12} className="text-black/30" />
                    : <ChevronRight size={12} className="text-black/30" />}
                </div>
              </div>
              <AnimatePresence initial={false}>
                {activeSnippet === snip.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <pre
                      className="text-[10px] font-mono leading-relaxed px-3 py-2 overflow-x-auto"
                      style={{
                        background: '#1a1a2e',
                        color: '#a5b4fc',
                        borderTop: `1px solid ${snip.color}20`,
                      }}
                    >
                      {snip.code}
                    </pre>
                    <div
                      className="px-3 py-2 flex justify-end"
                      style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}
                    >
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); handleInsertSnippet(snip.code); }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold text-white transition-colors"
                        style={{ background: snip.color }}
                      >
                        <Code2 size={10} />
                        แทรกใน Editor
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Rule Tester ── */}
      <Section icon={FlaskConical} iconColor="#059669" title="Rule Simulator" description="ทดสอบว่า role ใดสามารถทำ operation ใดได้บ้าง (จำลองจาก rules ข้างต้น)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-black/40 uppercase tracking-wide">Role</p>
            <Select value={testerRole} onValueChange={(v) => { setTesterRole(v as TesterRole); setTesterResult(null); }}>
              <SelectTrigger className="h-8 text-xs rounded-lg bg-slate-50/50 border-slate-200 focus:ring-1 focus:ring-slate-300 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-xl">
                {ROLES.map(r => (
                  <SelectItem key={r} value={r} className="text-xs rounded-lg">{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-black/40 uppercase tracking-wide">Collection</p>
            <Select value={testerCollection} onValueChange={(v) => { setTesterCollection(v as TesterCollection); setTesterResult(null); }}>
              <SelectTrigger className="h-8 text-xs rounded-lg bg-slate-50/50 border-slate-200 focus:ring-1 focus:ring-slate-300 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-xl">
                {COLLECTIONS.map(c => (
                  <SelectItem key={c} value={c} className="text-xs rounded-lg">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-black/40 uppercase tracking-wide">Operation</p>
            <Select value={testerOp} onValueChange={(v) => { setTesterOp(v as TesterOperation); setTesterResult(null); }}>
              <SelectTrigger className="h-8 text-xs rounded-lg bg-slate-50/50 border-slate-200 focus:ring-1 focus:ring-slate-300 shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-xl">
                {OPERATIONS.map(o => (
                  <SelectItem key={o} value={o} className="text-xs rounded-lg">{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <button
          type="button"
          onClick={handleTest}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors w-full justify-center mt-1"
          style={{ background: '#059669' }}
        >
          <FlaskConical size={12} />
          ทดสอบ Rule
        </button>

        <AnimatePresence>
          {testerResult && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2.5 px-3 py-3 rounded-xl"
              style={{
                background: testerResult.allowed ? '#059669' + '0a' : '#ef4444' + '0a',
                border: `1px solid ${testerResult.allowed ? '#059669' : '#ef4444'}25`,
              }}
            >
              {testerResult.allowed
                ? <ShieldCheck size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#059669' }} />
                : <ShieldAlert size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} />}
              <div>
                <p className="text-xs font-bold" style={{ color: testerResult.allowed ? '#059669' : '#dc2626' }}>
                  {testerResult.allowed ? 'อนุญาต (allow)' : 'ปฏิเสธ (deny)'}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: testerResult.allowed ? '#047857' : '#b91c1c' }}>
                  {testerResult.reason}
                </p>
                <p className="text-[10px] mt-1 text-black/35">
                  <span className="font-mono bg-black/05 px-1 rounded">{testerRole}</span>
                  {' → '}
                  <span className="font-mono bg-black/05 px-1 rounded">{testerOp}</span>
                  {' on '}
                  <span className="font-mono bg-black/05 px-1 rounded">{testerCollection}</span>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Section>

      {/* ── Deploy Guide ── */}
      <Section icon={Database} iconColor="#d97706" title="วิธี Deploy Rules" description="ขั้นตอนการนำ rules ไปใช้งานจริงบน Firebase" collapsible>
        <div className="space-y-3">
          {[
            {
              step: '1',
              title: 'คัดลอก Rules',
              desc: 'กด "คัดลอก" ที่ด้านบนของ editor เพื่อคัดลอก rules ทั้งหมด',
            },
            {
              step: '2',
              title: 'เปิด Firebase Console',
              desc: 'ไปที่ Firestore Database → Rules tab ใน Firebase Console',
            },
            {
              step: '3',
              title: 'วาง Rules',
              desc: 'วาง rules ที่คัดลอกมาลงใน editor ของ Firebase Console',
            },
            {
              step: '4',
              title: 'Publish',
              desc: 'กด "Publish" และรอ 1–2 นาทีสำหรับ rules ให้มีผล',
            },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5"
                style={{ background: '#d97706' }}
              >
                {item.step}
              </div>
              <div>
                <p className="text-xs font-semibold text-black/70">{item.title}</p>
                <p className="text-[10px] text-black/40 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}

          <div
            className="flex items-start gap-2 px-3 py-2 rounded-xl mt-1"
            style={{ background: '#ef4444' + '0a', border: '1px solid #ef444420' }}
          >
            <AlertTriangle size={11} className="mt-0.5 flex-shrink-0 text-red-500" />
            <p className="text-[10px] leading-relaxed text-red-600">
              ทดสอบ rules ในสภาพแวดล้อม staging ก่อนเสมอ
              เพราะ rules ที่ผิดพลาดอาจทำให้ผู้ใช้เข้าไม่ถึงข้อมูล
            </p>
          </div>
        </div>
      </Section>

      {/* ── Save Bar ── */}
      <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={GLASS_CARD}>
        <p className="text-xs text-black/40">
          {savedMsg
            ? <span className="text-emerald-600 font-semibold">บันทึกลง localStorage แล้ว</span>
            : <span>บันทึกเป็น draft ใน browser <span className="opacity-60">(ต้อง deploy ผ่าน Firebase Console)</span></span>}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-black/45 hover:text-black/65 hover:bg-black/05 transition-colors"
          >
            <RotateCcw size={11} />
            รีเซ็ต
          </button>
          <Button
            onClick={handleSave}
            className="flex items-center gap-1.5 h-7 px-3 text-xs rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white font-semibold"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          >
            <Save size={11} />
            บันทึก Draft
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
