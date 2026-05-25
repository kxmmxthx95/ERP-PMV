import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Pencil, Trash2, Eye, EyeOff, Camera, LogOut, RotateCcw, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { UserData } from '@/types/user';
import { ROLE_LABELS } from '@/types/mockUsers';
import { useUserForm } from '@/hooks/useUserForm';
import { useNamePrefix } from '@/hooks/useNamePrefix';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';
import UserFilterCapsule from './components/UserFilterCapsule';
import UserImportModal from './components/UserImportModal';
import {
  collection,
  getDocs,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore';
import { authService } from '@/features/auth/authService';
import { httpsCallable } from 'firebase/functions';
import { db, functions as cloudFunctions } from '@/lib/firebase';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

// ── Constants & Helpers ──────────────────────────────────────────────────────

const schoolDepartments = [
  { id: 'preschool', label: 'ปฐมวัย' },
  { id: 'primary', label: 'ประถมศึกษา' },
  { id: 'secondary', label: 'มัธยมศึกษา' },
];

const getRoleStyle = (role: string) => {
  return ROLE_LABELS[role as keyof typeof ROLE_LABELS] || { label: role, color: '#64748b', bg: '#f1f5f9' };
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [filterRole, setFilterRole] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const { gradeLevels } = useSchoolStructure();
  const [users, setUsers] = useState<UserData[]>([]);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isMdOrBelow, setIsMdOrBelow] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMdOrBelow(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleForceLogoutAll = async () => {
    const ok = window.confirm('ต้องการบังคับผู้ใช้ทุกคนให้ออกจากระบบทันทีใช่หรือไม่?');
    if (!ok) return;
    try {
      await setDoc(doc(db, 'system_config', 'auth_controls'), {
        forceLogoutAllAt: serverTimestamp(),
        forcedByUid: currentUser?.uid ?? null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      await authService.logout();
    } catch (error) {
      console.error('force logout all failed:', error);
      toast.error('บังคับออกทุกผู้ใช้ไม่สำเร็จ');
    }
  };

  // Handle Bulk Import Events
  useEffect(() => {
    const handleImportUser = async (e: any) => {
      const data = e.detail;
      const { uid, email, prefix, firstName, lastName, role, department, studentCode, phone } = data;
      const timestamp = new Date().toISOString();

      try {
        // 1. Create User Document only
        await setDoc(doc(db, 'users', uid), {
          uid,
          email,
          prefix,
          firstName,
          lastName,
          name: `${prefix || ''}${firstName || ''} ${lastName || ''}`,
          role,
          department: department || '',
          studentCode: studentCode || '',
          phone: phone || '',
          status: 'active',
          mustChangePassword: true,
          isActive: true,
          createdAt: timestamp,
        });
      } catch (err) {
        console.error("Bulk Import Sync Error:", err);
      }
    };

    window.addEventListener('import-user', handleImportUser);
    return () => window.removeEventListener('import-user', handleImportUser);
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const fetchedUsers = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as UserData[];
      setUsers(fetchedUsers);
    });
    return () => unsubscribe();
  }, []);

  const photoInputRef = useRef<HTMLInputElement>(null);

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 400;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = url;
    });

  const {
    isOpen: isAddOpen,
    setIsOpen: setIsAddOpen,
    isSubmitting: isAddSubmitting,
    prefix: newPrefix,
    setPrefix: setNewPrefix,
    firstName: newFirstName,
    setFirstName: setNewFirstName,
    lastName: newLastName,
    setLastName: setNewLastName,
    firstNameEn: newFirstNameEn,
    setFirstNameEn: setNewFirstNameEn,
    lastNameEn: newLastNameEn,
    setLastNameEn: setNewLastNameEn,
    email: newEmail,
    setEmail: setNewEmail,
    role: newRole,
    handleRoleChange: setNewRole,
    department: newDepartment,
    setDepartment: setNewDepartment,
    phone: newPhone,
    setPhone: setNewPhone,
    password: newPassword,
    setPassword: setNewPassword,
    photoURL: newPhotoURL,
    setPhotoURL: setNewPhotoURL,
    lineToken: newLineToken,
    setLineToken: setNewLineToken,
    deviceId: newDeviceId,
    setDeviceId: setNewDeviceId,
    studentCode: newStudentCode,
    setStudentCode: setNewStudentCode,
    gradeLevel: newGradeLevel,
    setGradeLevel: setNewGradeLevel,
    academicYear: newAcademicYear,
    setAcademicYear: setNewAcademicYear,
    handleSubmit: handleAddUser,
    setFormForEdit,
    resetForm
  } = useUserForm(async (newUser) => {
    const userData = newUser as any;
    if (editingUserId) {
      const { password: _pw, ...updateData } = userData;

      // 1. Update users collection
      await updateDoc(doc(db, 'users', editingUserId), updateData);

      setEditingUserId(null);
      toast.success('อัปเดตข้อมูลสำเร็จ');
    } else {
      // 1. สร้าง Firebase Auth account
      const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userData.email,
            password: userData.password,
            returnSecureToken: false,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        const msg = err?.error?.message || 'สร้างบัญชีไม่สำเร็จ';
        if (msg === 'EMAIL_EXISTS') {
          toast.error('อีเมลนี้มีในระบบแล้ว');
          throw new Error('อีเมลนี้มีในระบบแล้ว');
        }
        toast.error(`เกิดข้อผิดพลาด: ${msg}`);
        throw new Error(msg);
      }

      const { localId: uid } = await res.json();

      // 2. สร้าง User Document
      const { password: _pw, ...userWithoutPassword } = userData;
      const timestamp = new Date().toISOString();

      await setDoc(doc(db, 'users', uid), {
        ...userWithoutPassword,
        uid,
        mustChangePassword: true,
        isActive: true,
        createdAt: timestamp,
      });

      toast.success(`สร้างบัญชีสำเร็จ — รหัสผ่านเริ่มต้น: ${userData.password}`);
    }
  });

  const prefixGroup = useMemo(() => {
    if (newRole === 'student') return 'student';
    if (newRole === 'teacher') return 'teacher';
    return 'adult';
  }, [newRole]);

  const { prefixes: dynamicPrefixes } = useNamePrefix(prefixGroup);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const name = `${u.prefix || ''}${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
      const matchSearch = name.includes(searchTerm.toLowerCase()) || (u.email || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchRole = filterRole === 'all' || u.role === filterRole;
      const matchDept = filterDepartment === 'all' || u.department === filterDepartment;
      return matchSearch && matchRole && matchDept;
    });
  }, [users, searchTerm, filterRole, filterDepartment]);

  const isFiltered = filterRole !== 'all' || filterDepartment !== 'all' || searchTerm !== '';

  const paginatedUsers = filteredUsers;

  const handleDeleteUser = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ ${user.firstName || ''} ${user.lastName || ''}?`)) return;

    const authUid = (user as any).uid || user.id;

    // ลบข้อมูลใน Firestore ทั้งหมด
    try {
      await deleteDoc(doc(db, 'users', id));
      await deleteDoc(doc(db, 'students', id)).catch(() => { });
      await deleteDoc(doc(db, 'teachers', id)).catch(() => { });
      const enrollQ = query(collection(db, 'enrollments'), where('studentId', '==', id));
      const enrollSnap = await getDocs(enrollQ);
      await Promise.all(enrollSnap.docs.map(d => deleteDoc(d.ref)));

      // คัดลอก UID ไว้ให้ลบ Auth ด้วยตัวเองที่ Console
      navigator.clipboard.writeText(authUid).catch(() => { });
      toast.success(
        `ลบข้อมูลในระบบเรียบร้อยแล้ว\nUID: ${authUid.substring(0, 16)}...\n(คัดลอก UID แล้ว — กรุณาลบบัญชีที่ Firebase Console ด้วย)`,
        {
          duration: 8000,
          action: {
            label: 'เปิด Console',
            onClick: () => window.open('https://console.firebase.google.com/project/pmv-one/authentication/users', '_blank'),
          },
        }
      );
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
  };

  const getAuthUidFromUser = (user: UserData): string => {
    return String((user as any).authUid || (user as any).uid || user.id);
  };

  const getCallableErrorMessage = (error: unknown, fallback: string): string => {
    const maybe = error as { message?: unknown };
    if (typeof maybe?.message === 'string' && maybe.message.trim()) {
      return maybe.message;
    }
    return fallback;
  };

  const handleForceLogout = async (targetUser: UserData) => {
    if (!confirm(`บังคับให้ออกจากระบบทันทีสำหรับ ${targetUser.firstName || targetUser.email} ?`)) return;

    try {
      const callable = httpsCallable(cloudFunctions, 'forceLogoutUser');
      await callable({
        userId: targetUser.id,
        authUid: getAuthUidFromUser(targetUser),
      });
      toast.success('บังคับออกจากระบบเรียบร้อย');
    } catch (error) {
      console.error('force logout failed:', error);
      toast.error(getCallableErrorMessage(error, 'บังคับออกจากระบบไม่สำเร็จ'));
    }
  };

  const handleHardReset = async (targetUser: UserData) => {
    if (currentUser?.uid === targetUser.id || currentUser?.uid === getAuthUidFromUser(targetUser)) {
      toast.error('ไม่สามารถ Hard Reset บัญชีที่กำลังใช้งานอยู่');
      return;
    }
    if (!confirm(`Hard Reset ผู้ใช้ ${targetUser.firstName || targetUser.email} ?\nระบบจะรีเซ็ตรหัสผ่านและบังคับออกจากระบบทันที`)) return;

    try {
      const callable = httpsCallable(cloudFunctions, 'hardResetUser');
      const result = await callable({
        userId: targetUser.id,
        authUid: getAuthUidFromUser(targetUser),
      });

      const payload = result.data as { tempPassword?: string };
      const tempPassword = payload?.tempPassword;
      if (typeof tempPassword === 'string' && tempPassword) {
        await navigator.clipboard.writeText(tempPassword).catch(() => {});
        toast.success(`Hard Reset สำเร็จ — รหัสผ่านชั่วคราว: ${tempPassword} (คัดลอกแล้ว)`, { duration: 10000 });
      } else {
        toast.success('Hard Reset สำเร็จ');
      }
    } catch (error) {
      console.error('hard reset failed:', error);
      toast.error(getCallableErrorMessage(error, 'Hard Reset ไม่สำเร็จ'));
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await updateDoc(doc(db, 'users', id), { status: newStatus });
  };

  const handleEditUser = (user: UserData) => {
    setEditingUserId(user.id);
    setFormForEdit(user);
    setIsAddOpen(true);
  };

  const handleAddNewUserClick = () => {
    setEditingUserId(null);
    resetForm();
    setIsAddOpen(true);
  };

  const capsuleElement = (
    <UserFilterCapsule
      filterRole={filterRole}
      onRoleChange={(role) => {
        setFilterRole(role);
        setFilterDepartment('all');
      }}
      filterDepartment={filterDepartment}
      onDepartmentChange={setFilterDepartment}
      onAdd={handleAddNewUserClick}
      onImport={() => setIsImportModalOpen(true)}
      onForceLogout={handleForceLogoutAll}
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      isSearchMode={isSearchMode}
      onSearchModeChange={setIsSearchMode}
    />
  );

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* Desktop (lg+): inject capsule into header portal */}
      {!isMdOrBelow && createPortal(
        capsuleElement,
        document.getElementById('header-portal-filters') || document.body
      )}

      {/* Tablet/Mobile (< lg): render capsule as floating bottom bar */}
      {isMdOrBelow && (
        <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div className="pointer-events-auto">
            {capsuleElement}
          </div>
        </div>
      )}

      <UserImportModal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={() => {
          // Refresh or handle completion
        }}
      />

      {isFiltered ? (
        <ScrollArea className="flex-1 min-h-0 pb-20">
          <div 
            className="grid gap-4 sm:gap-6 pt-4 px-1"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
          >
            {paginatedUsers.map((user, i) => {
              const roleStyle = getRoleStyle(user.role);
              const isActive = user.status === 'active';

              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.01 }}
                  className="flex flex-col gap-1.5 group cursor-pointer select-none"
                  onClick={() => setActiveCardId(prev => (prev === user.id ? null : user.id))}
                >
                  <div className={`relative aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200/60 transition-all duration-300 ${!isActive ? 'opacity-50 grayscale' : 'hover:shadow-lg'}`}>
                    {(user as any).photoURL ? (
                      <>
                        <img
                          src={(user as any).photoURL}
                          alt={user.firstName}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-transparent z-0" />
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                        <div
                          className="w-16 h-16 rounded-full flex items-center justify-center text-white font-black shadow-inner"
                          style={{ fontSize: '24px', background: roleStyle.bg || '#e2e8f0', color: roleStyle.color || '#475569' }}
                        >
                          {(user.firstName || '?').charAt(0)}
                        </div>
                      </div>
                    )}

                    <AnimatePresence>
                      {activeCardId === user.id && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] grid grid-cols-3 gap-2 p-3 place-items-center z-20"
                          onClick={(e) => {
                            if (e.target === e.currentTarget) {
                              setActiveCardId(null);
                            }
                          }}
                        >
                          <Button size="icon" onClick={() => handleEditUser(user)} className="w-8 h-8 rounded-full bg-white text-slate-900 hover:bg-slate-100 shadow-xl">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" onClick={() => toggleStatus(user.id, user.status)} className="w-8 h-8 rounded-full bg-white text-slate-900 hover:bg-slate-100 shadow-xl">
                            {isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button size="icon" onClick={() => handleDeleteUser(user.id)} className="w-8 h-8 rounded-full bg-rose-500 text-white hover:bg-rose-600 shadow-xl">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            title="บังคับออกจากระบบ"
                            onClick={() => handleForceLogout(user)}
                            className="w-8 h-8 rounded-full bg-amber-500 text-white hover:bg-amber-600 shadow-xl"
                          >
                            <LogOut className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            title="Hard Reset"
                            onClick={() => handleHardReset(user)}
                            className="w-8 h-8 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="px-0.5 mt-0.5 space-y-0">
                    <p className="text-[10px] sm:text-[14px] font-bold text-slate-800 leading-tight truncate">
                      {user.firstName}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5">
                      <span className="text-[8px] sm:text-[10px] font-bold px-1 py-0 rounded bg-slate-100 text-slate-500 uppercase tracking-wider w-fit">
                        {roleStyle.label}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4 opacity-60">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
            <Users size={40} className="text-slate-300" />
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-500">กรุณาเลือกตัวกรองเพื่อแสดงข้อมูล</p>
            <p className="text-[11px] text-slate-400 mt-1">เลือกประเภทผู้ใช้หรือแผนกเพื่อเริ่มต้น</p>
          </div>
        </div>
      )}
      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) setEditingUserId(null);
      }}>
        <DialogContent
          className="w-[92vw] sm:max-w-md rounded-[2rem] sm:rounded-[2.5rem] border-none p-0 shadow-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)'
          }}
        >
          <div className="px-5 sm:px-6 pt-6 sm:pt-7 pb-2 sm:pb-3 flex justify-between items-center bg-transparent">
            <DialogTitle className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
              {editingUserId ? 'แก้ไขข้อมูลผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
            </DialogTitle>
          </div>

          <form onSubmit={handleAddUser} className="px-5 sm:px-6 pb-6 sm:pb-7 space-y-3 max-h-[80vh] overflow-y-auto custom-scrollbar">
            {/* 1. Role & Department (Full Width) */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">บทบาท</label>
                <Select value={newRole || ''} onValueChange={setNewRole} required>
                  <SelectTrigger className="w-full h-9 rounded-xl bg-slate-50 border-none shadow-none text-xs font-bold">
                    <SelectValue placeholder="เลือกบทบาท" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {Object.entries(ROLE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {['teacher', 'student'].includes(newRole) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-1"
                  >
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">แผนก</label>
                    <Select value={newDepartment || ''} onValueChange={setNewDepartment}>
                      <SelectTrigger className="w-full h-9 rounded-xl bg-slate-50 border-none shadow-none text-xs font-bold">
                        <SelectValue placeholder="เลือกแผนก" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {schoolDepartments.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </motion.div>

                  {newRole === 'student' && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-1"
                    >
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">เลขประจำตัว</label>
                      <Input
                        value={newStudentCode}
                        onChange={(e) => setNewStudentCode(e.target.value)}
                        placeholder="เลขประจำตัวนักเรียน"
                        className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
                      />
                    </motion.div>
                  )}
                </div>
              )}

              {newRole === 'student' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-1"
                  >
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ปีการศึกษา</label>
                    <Input
                      type="number"
                      value={newAcademicYear}
                      onChange={(e) => setNewAcademicYear(Number(e.target.value))}
                      placeholder="เช่น 2567"
                      className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-1"
                  >
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ระดับชั้น</label>
                    <Select value={newGradeLevel || ''} onValueChange={setNewGradeLevel}>
                      <SelectTrigger className="w-full h-9 rounded-xl bg-slate-50 border-none shadow-none text-xs font-bold">
                        <SelectValue placeholder="เลือกระดับชั้น" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {gradeLevels.map(g => (
                          <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </motion.div>
                </div>
              )}
            </div>

            {/* 2. Thai Name */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">คำนำหน้า</label>
                <Select value={newPrefix || ''} onValueChange={setNewPrefix} required>
                  <SelectTrigger className="h-9 rounded-xl bg-slate-50 border-none shadow-none text-xs font-bold">
                    <SelectValue placeholder="เลือก" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {dynamicPrefixes.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-4 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ชื่อ (ไทย)</label>
                <Input required value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4" />
              </div>
              <div className="sm:col-span-5 space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">นามสกุล (ไทย)</label>
                <Input required value={newLastName} onChange={(e) => setNewLastName(e.target.value)} className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4" />
              </div>
            </div>

            {/* 3. English Name (Restored) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">First Name (English)</label>
                <Input value={newFirstNameEn} onChange={(e) => setNewFirstNameEn(e.target.value)} className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Last Name (English)</label>
                <Input value={newLastNameEn} onChange={(e) => setNewLastNameEn(e.target.value)} className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4" />
              </div>
            </div>

            {/* 4. Email & Phone (Restored) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">อีเมล</label>
                <Input required type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">เบอร์โทร</label>
                <Input
                  required
                  value={newPhone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    let formatted = val;
                    if (val.length > 3 && val.length <= 6) {
                      formatted = `${val.slice(0, 3)}-${val.slice(3)}`;
                    } else if (val.length > 6) {
                      formatted = `${val.slice(0, 3)}-${val.slice(3, 6)}-${val.slice(6, 10)}`;
                    }
                    setNewPhone(formatted);
                  }}
                  placeholder="08X-XXX-XXXX"
                  className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">รูปภาพ</label>
              <div
                className="relative h-24 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-slate-400 transition-all overflow-hidden group"
                onClick={() => photoInputRef.current?.click()}
              >
                {newPhotoURL ? (
                  <img src={newPhotoURL} alt="preview" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                ) : (
                  <>
                    <Camera size={20} className="text-slate-400" />
                    <p className="text-[11px] font-bold text-slate-500">คลิกเพื่ออัปโหลดรูปภาพ</p>
                  </>
                )}
                {newPhotoURL && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setNewPhotoURL(''); }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-rose-500/90 hover:bg-rose-600 text-white shadow-lg transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setNewPhotoURL(await compressImage(file));
                  e.target.value = '';
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">รหัสผ่าน (เว้นว่างได้ ระบบจะใช้ค่าเริ่มต้น)</label>
              <div className="relative">
                <Input 
                  type={showPassword ? "text" : "password"} 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold pl-4 pr-10" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">LINE Token</label>
                <Input value={newLineToken} onChange={(e) => setNewLineToken(e.target.value)} placeholder="LINE Notify Token" className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Device ID</label>
                <Input value={newDeviceId} onChange={(e) => setNewDeviceId(e.target.value)} placeholder="เลขอุปกรณ์" className="h-9 rounded-xl bg-slate-50 border-none text-xs font-bold px-4" />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="rounded-xl font-bold text-slate-500 h-10">ยกเลิก</Button>
              <Button type="submit" disabled={isAddSubmitting} className="rounded-xl bg-slate-900 text-white font-bold px-10 h-10 shadow-lg shadow-slate-900/20">
                {isAddSubmitting ? 'กำลังสร้างบัญชี...' : 'บันทึก'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
