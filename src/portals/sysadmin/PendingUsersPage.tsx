import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, query, where, onSnapshot, updateDoc, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle, XCircle, UserCheck, Phone, Mail, StickyNote } from 'lucide-react';

interface PendingUser {
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  role?: string;
  createdAt: any;
}

const ROLE_OPTIONS = [
  { value: 'student',  label: 'นักเรียน' },
  { value: 'parent',   label: 'ผู้ปกครอง' },
  { value: 'teacher',  label: 'ครูผู้สอน' },
  { value: 'staff',    label: 'เจ้าหน้าที่' },
  { value: 'admin',    label: 'ผู้บริหาร' },
  { value: 'sysadmin', label: 'SysAdmin' },
];

const ROLE_COLORS: Record<string, string> = {
  student:  'bg-violet-100 text-violet-700',
  parent:   'bg-blue-100 text-blue-700',
  teacher:  'bg-rose-100 text-rose-700',
  staff:    'bg-emerald-100 text-emerald-700',
  admin:    'bg-amber-100 text-amber-700',
  sysadmin: 'bg-slate-100 text-slate-700',
};

const glassCard: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.65)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255, 255, 255, 0.8)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
};

export default function PendingUsersPage() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [recentApproved, setRecentApproved] = useState<PendingUser[]>([]);
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');

  // Real-time listener สำหรับ registration requests
  useEffect(() => {
    const qPending = query(collection(db, 'registration_requests'), where('status', '==', 'pending'));
    const unsubPending = onSnapshot(qPending, (snap) => {
      const users = snap.docs.map(d => ({ uid: d.id, ...d.data() } as PendingUser));
      setPendingUsers(users.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
    });

    const qApproved = query(collection(db, 'registration_requests'), where('status', '==', 'approved'));
    const unsubApproved = onSnapshot(qApproved, (snap) => {
      const users = snap.docs.map(d => ({ uid: d.id, ...d.data() } as PendingUser));
      setRecentApproved(users.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds));
    });

    return () => {
      unsubPending();
      unsubApproved();
    };
  }, []);

  const handleApprove = async (user: PendingUser) => {
    const role = selectedRole[user.uid] || user.role;
    if (!role) {
      toast.error('กรุณาเลือก Role ก่อนอนุมัติ');
      return;
    }

    setApprovingId(user.uid);
    try {
      // 1. คัดลอกข้อมูลไปยัง users หลัก ชนิดที่อนุมัติแล้ว
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        role,
        status: 'active',
        isActive: true,
        approvedAt: new Date(),
        createdAt: user.createdAt,
      });

      // 2. อัปเดตสถานะใน registration_requests (หรือจะลบเลยก็ได้ แต่เก็บไว้ดูประวัติใน tab 'อนุมัติแล้ว' ก่อน)
      await updateDoc(doc(db, 'registration_requests', user.uid), {
        role,
        status: 'approved',
        approvedAt: new Date(),
      });

      toast.success(`อนุมัติบัญชี ${user.displayName} เรียบร้อย (${role})`);
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (user: PendingUser) => {
    if (!confirm(`ยืนยันการปฏิเสธบัญชี "${user.displayName}"?`)) return;

    setRejectingId(user.uid);
    try {
      // ปฏิเสธคือการลบคำขอนี้ทิ้งไปเลย (หรืออัปเดตเป็น rejected)
      await updateDoc(doc(db, 'registration_requests', user.uid), {
        status: 'rejected',
        isActive: false,
        rejectedAt: new Date(),
      });
      toast.success(`ปฏิเสธบัญชี ${user.displayName} แล้ว`);
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setRejectingId(null);
    }
  };

  const handleDelete = async (uid: string) => {
    if (!confirm('ยืนยันการลบคำขอนี้ออกจากระบบ? (ไม่สามารถกู้คืนได้)')) return;
    try {
      await deleteDoc(doc(db, 'registration_requests', uid));
      toast.success('ลบคำขอเรียบร้อย');
    } catch (error: any) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate?.() ?? new Date(timestamp);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-5 text-black">
      {/* ── Header & Actions ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-black/85 tracking-tight">อนุมัติบัญชีผู้ใช้</h1>
          <p className="text-xs text-black/40 mt-0.5">จัดการคำขอสมัครสมาชิกและกำหนด Role ให้ผู้ใช้ใหม่</p>
        </motion.div>

        {/* Actions / Status Badge */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.1 }}
          className="flex items-center gap-3"
        >
          {pendingUsers.length > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-bold text-amber-700">
                รออนุมัติ {pendingUsers.length} รายการ
              </span>
            </div>
          )}
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {[
          { id: 'pending', label: 'รออนุมัติ', count: pendingUsers.length },
          { id: 'approved', label: 'อนุมัติแล้ว', count: recentApproved.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-violet-500 text-violet-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === tab.id ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: Pending */}
      {activeTab === 'pending' && (
        <>
          {pendingUsers.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl flex flex-col items-center justify-center py-16 text-center shadow-sm"
              style={glassCard}
            >
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-slate-600 font-medium">ไม่มีบัญชีที่รออนุมัติ</p>
              <p className="text-slate-400 text-sm mt-1">ทุกบัญชีได้รับการจัดการแล้ว</p>
            </motion.div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={glassCard}>
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100">
                    <TableHead className="text-xs font-semibold text-slate-500 py-3">ชื่อ-นามสกุล</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 py-3">ข้อมูลติดต่อ</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 py-3">หมายเหตุ</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 py-3">วันที่สมัคร</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 py-3">บทบาทที่สมัคร</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 py-3 w-40">อนุมัติเป็น Role</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 py-3 text-right">จัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.map((user) => (
                    <TableRow key={user.uid} className="border-b border-slate-50 hover:bg-white/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {user.displayName?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{user.displayName}</p>
                            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.phone ? (
                          <div className="flex items-center gap-1 text-xs text-slate-600">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            {user.phone}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.note ? (
                          <div className="flex items-start gap-1 text-xs text-slate-600 max-w-[160px]">
                            <StickyNote className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                            <span className="line-clamp-2">{user.note}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-slate-500">{formatDate(user.createdAt)}</span>
                      </TableCell>
                      <TableCell>
                        {user.role ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_COLORS[user.role] || 'bg-slate-100'}`}>
                            {ROLE_OPTIONS.find(r => r.value === user.role)?.label || user.role}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">ไม่ได้ระบุ</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={selectedRole[user.uid] || user.role || ''}
                          onValueChange={(value) =>
                            setSelectedRole(prev => ({ ...prev, [user.uid]: value }))
                          }
                        >
                          <SelectTrigger className="h-8 text-xs rounded-full border-slate-200 bg-white/80">
                            <SelectValue placeholder="เลือก Role..." />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(user)}
                            disabled={approvingId === user.uid || !(selectedRole[user.uid] || user.role)}
                            className="h-8 px-3 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-full disabled:opacity-40"
                          >
                            {approvingId === user.uid ? (
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5 mr-1" />
                                อนุมัติ
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(user)}
                            disabled={rejectingId === user.uid}
                            className="h-8 px-3 text-xs border-red-200 text-red-500 hover:bg-red-50 rounded-full"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            ปฏิเสธ
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Tab: Approved */}
      {activeTab === 'approved' && (
        <div className="rounded-2xl overflow-hidden" style={glassCard}>
          {recentApproved.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-slate-500">ยังไม่มีบัญชีที่อนุมัติ</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-100">
                  <TableHead className="text-xs font-semibold text-slate-500 py-3">ชื่อ-นามสกุล</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 py-3">อีเมล</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 py-3">Role</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 py-3">วันที่สมัคร</TableHead>
                  <TableHead className="text-xs font-semibold text-slate-500 py-3 text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentApproved.map((user) => (
                  <TableRow key={user.uid} className="border-b border-slate-50 hover:bg-white/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 bg-gradient-to-br ${
                          user.role === 'teacher' ? 'from-rose-400 to-pink-500' :
                          user.role === 'admin' ? 'from-sky-400 to-blue-500' :
                          user.role === 'staff' ? 'from-emerald-400 to-teal-500' :
                          'from-violet-400 to-indigo-500'
                        }`}>
                          {user.displayName?.charAt(0) || '?'}
                        </div>
                        <p className="text-sm font-semibold text-slate-800">{user.displayName}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-500">{user.email}</span>
                    </TableCell>
                    <TableCell>
                      {user.role && (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${ROLE_COLORS[user.role] || 'bg-slate-100 text-slate-600'}`}>
                          {ROLE_OPTIONS.find(r => r.value === user.role)?.label ?? user.role}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-500">{formatDate(user.createdAt)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(user.uid)}
                        className="h-8 px-3 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                      >
                        ลบ
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-2xl p-4 bg-blue-50/60 border border-blue-100">
        <p className="text-xs font-semibold text-blue-700 mb-1">หมายเหตุสำคัญ</p>
        <ul className="text-xs text-blue-600 space-y-1 list-disc list-inside">
          <li>ผู้ใช้ที่อนุมัติแล้วจะสามารถเข้าสู่ระบบได้ตาม Role ที่กำหนด</li>
          <li>Custom Claims (สิทธิ์ใน Firebase Auth) จะตั้งค่าโดยอัตโนมัติผ่าน Cloud Function</li>
          <li>หากยังไม่ได้ตั้ง Cloud Function ให้ใช้ Firebase Console → Authentication เพื่อยืนยัน</li>
        </ul>
      </div>
    </div>
  );
}
