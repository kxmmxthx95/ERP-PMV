import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Pencil, Trash2, Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import type { UserData } from '@/types/user';
import { useUserForm } from '@/hooks/useUserForm';
import { toast } from 'sonner';
import { collection, onSnapshot, setDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import firebaseApp from '@/lib/firebase';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import FormModal from '@/components/ui/FormModal';

// ── Styles helpers ──────────────────────────────────────────────────────────
const glassCard: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.65)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255, 255, 255, 0.8)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
};

// ── Constants ───────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  student:  { label: 'นักเรียน',   color: '#7c3aed', bg: '#f3e8ff' },
  parent:   { label: 'ผู้ปกครอง', color: '#2563eb', bg: '#dbeafe' },
  teacher:  { label: 'ครูผู้สอน',  color: '#e11d48', bg: '#ffe4e6' },
  staff:    { label: 'เจ้าหน้าที่', color: '#059669', bg: '#d1fae5' },
  admin:    { label: 'ผู้บริหาร',   color: '#d97706', bg: '#fef3c7' },
  sysadmin: { label: 'SysAdmin', color: '#64748b', bg: '#f1f5f9' },
};

export default function SysAdminUsers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [users, setUsers] = useState<UserData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Helper สำหรับจัดรูปแบบเบอร์โทรศัพท์ (0xx-xxx-xxxx)
  const formatPhone = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 10);
    let formatted = cleaned;
    if (cleaned.length > 3 && cleaned.length <= 6) {
      formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    } else if (cleaned.length > 6) {
      formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return formatted;
  };

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

  // ดึง State และ Logic ทั้งหมดมาจาก Hook ที่เราสร้างขึ้นใหม่
  const {
    isOpen: isAddOpen,
    setIsOpen: setIsAddOpen,
    prefix: newPrefix,
    setPrefix: setNewPrefix,
    firstName: newFirstName,
    setFirstName: setNewFirstName,
    lastName: newLastName,
    setLastName: setNewLastName,
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
    prefixes,
    departments,
    handleSubmit: handleAddUser,
    setFormForEdit,
    resetForm
  } = useUserForm(async (newUser) => {
    // นำเบอร์โทรศัพท์ (และข้อมูลที่อาจตกหล่น) มารวมเข้ากับ Payload ก่อนบันทึก
    const completeUserData = {
      ...newUser,
      phone: newPhone,
    };

    if (editingUserId) {
      await updateDoc(doc(db, 'users', editingUserId), completeUserData as any);
      setEditingUserId(null);
    } else {
      try {
        // 1. สร้างบัญชีใน Firebase Auth ด้วย Secondary App (เพื่อไม่ให้ Admin ถูกล็อกเอาท์)
        const secondaryApp = getApps().find(app => app.name === 'SecondaryApp') 
          || initializeApp(firebaseApp.options, 'SecondaryApp');
        const secondaryAuth = getAuth(secondaryApp);
        
        // ดึงอีเมลจากฟอร์มและทำความสะอาดข้อมูล
        const emailToCreate = (completeUserData.email || newEmail).trim().toLowerCase();
        const cleanPassword = newPassword.trim();
        
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          emailToCreate, 
          cleanPassword
        );
        const newUid = userCredential.user.uid;
        await secondaryAuth.signOut(); // ล้าง session ที่จำลองขึ้นมา

        // 2. บันทึกข้อมูลลง Firestore โดยใช้ UID ที่ผูกกับ Auth
        await setDoc(doc(db, 'users', newUid), completeUserData);
      } catch (error: any) {
        console.error("เกิดข้อผิดพลาดในการสร้างบัญชี:", error);
        if (error.code === 'auth/email-already-in-use') {
          alert("ไม่สามารถสร้างบัญชีได้: อีเมลนี้ถูกใช้งานไปแล้วในระบบ");
        } else {
          alert("ไม่สามารถสร้างบัญชีได้: " + (error as Error).message);
        }
      }
    }
  });

  const filteredUsers = users.filter((u) => {
    const name = u.name || u.displayName || '';
    const email = u.email || '';
    const matchSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchDept = filterDepartment === 'all' || u.department === filterDepartment;
    return matchSearch && matchRole && matchDept;
  });

  // ── Pagination Logic ──
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRole, filterDepartment]);

  const toggleStatus = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (user) await updateDoc(doc(db, 'users', id), { status: user.status === 'active' ? 'inactive' : 'active' });
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบรายชื่อผู้ใช้งานนี้?\n\n*หมายเหตุ: การลบนี้จะลบเฉพาะข้อมูลโปรไฟล์ หากต้องการใช้อีเมลนี้สมัครใหม่ คุณต้องไปลบบัญชีออกจาก Firebase Console (Authentication) ด้วยตนเอง')) {
      await deleteDoc(doc(db, 'users', id));
      toast.success('ลบข้อมูลโปรไฟล์สำเร็จ (อย่าลบลบบัญชีใน Firebase Console หากต้องการใช้อีเมลซ้ำ)');
    }
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

  return (
    <div className="space-y-5 text-black">
      
      {/* ── Header & Actions ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-black/85 tracking-tight">การจัดการผู้ใช้และสิทธิ์</h1>
          <p className="text-xs text-black/40 mt-0.5">Directory, Role Assignor & Access Control</p>
        </motion.div>

        {/* Filters & Add Button (Unified Segmented Control) */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.1 }} 
          className="flex flex-col sm:flex-row items-center gap-0.5 w-full md:w-auto rounded-xl shadow-sm"
          style={{
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            padding: '0.15rem',
          }}
        >
          {/* Search */}
          <div className="relative w-full sm:w-52 flex-shrink-0">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black/30 z-10" />
            <Input 
              placeholder="ค้นหาชื่อ หรือ อีเมล..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-2 py-0.5 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] placeholder:text-black/30 shadow-none focus-visible:ring-0 h-auto rounded-md transition-colors"
            />
          </div>

          {/* Filter */}
          <div className="w-full sm:w-32 flex-shrink-0">
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-full px-2 py-0.5 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] text-black/70 shadow-none focus:ring-0 h-auto rounded-md transition-colors">
                <SelectValue placeholder="ทุกบทบาท (All Roles)" />
              </SelectTrigger>
              <SelectContent className="bg-white/80 backdrop-blur-xl border-white/50 rounded-xl">
                <SelectItem value="all" className="rounded-lg text-[11px]">ทุกบทบาท</SelectItem>
                <SelectItem value="student" className="rounded-lg text-[11px]">นักเรียน</SelectItem>
                <SelectItem value="teacher" className="rounded-lg text-[11px]">ครูผู้สอน</SelectItem>
                <SelectItem value="parent" className="rounded-lg text-[11px]">ผู้ปกครอง</SelectItem>
                <SelectItem value="staff" className="rounded-lg text-[11px]">เจ้าหน้าที่</SelectItem>
                <SelectItem value="admin" className="rounded-lg text-[11px]">ผู้บริหาร</SelectItem>
                <SelectItem value="sysadmin" className="rounded-lg text-[11px]">SysAdmin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Department */}
          <div className="w-full sm:w-32 flex-shrink-0">
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="w-full px-2 py-0.5 bg-transparent hover:bg-black/5 border-none outline-none text-[11px] text-black/70 shadow-none focus:ring-0 h-auto rounded-md transition-colors">
                <SelectValue placeholder="เลือกแผนก" />
              </SelectTrigger>
              <SelectContent className="bg-white/80 backdrop-blur-xl border-white/50 rounded-xl">
                <SelectItem value="all" className="rounded-lg text-[11px]">เลือกแผนก</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id} className="rounded-lg text-[11px]">{dept.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Add Button */}
          <Button
            onClick={handleAddNewUserClick}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] h-auto border-0 bg-[#1e1e1e] hover:bg-[#2a2a2a] flex-shrink-0"
            style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
          >
            <Plus size={14} />
            เพิ่มผู้ใช้ใหม่
          </Button>
        </motion.div>
      </div>

      {/* ── Table ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-3xl overflow-hidden" style={glassCard}>
        <div className="overflow-x-auto">
          <Table className="w-full text-sm text-left border-collapse">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b-black/5" style={{ background: 'rgba(0,0,0,0.03)' }}>
                <TableHead className="px-3 py-2.5 font-semibold text-black/40 text-[11px] uppercase tracking-wider h-auto">User Directory</TableHead>
                <TableHead className="px-3 py-2.5 font-semibold text-black/40 text-[11px] uppercase tracking-wider h-auto">Role Assignor</TableHead>
                <TableHead className="px-3 py-2.5 font-semibold text-black/40 text-[11px] uppercase tracking-wider h-auto">Access Control</TableHead>
                <TableHead className="px-3 py-2.5 font-semibold text-black/40 text-[11px] uppercase tracking-wider h-auto text-center">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-black/[0.04]">
              {paginatedUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-black/[0.015] transition-colors border-b-black/5">
                  {/* 1. User Directory */}
                  <TableCell className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-[11px] shrink-0">
                        {(user.name || user.displayName || '?').charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-black/75">{user.name || user.displayName || 'ไม่มีชื่อ'}</p>
                        <p className="text-[10px] text-black/40">{user.email || 'ไม่มีอีเมล'}</p>
                      </div>
                    </div>
                  </TableCell>

                  {/* 2. Role Assignor */}
                  <TableCell className="px-3 py-2">
                    <Select 
                      value={user.role}
                      onValueChange={async (val) => {
                        await updateDoc(doc(db, 'users', user.id), { role: val });
                      }}
                    >
                      <SelectTrigger 
                        className="text-[10px] font-semibold px-2 py-0.5 h-auto rounded-full border-none shadow-none focus:ring-0 w-[95px]"
                        style={{ 
                          color: ROLE_LABELS[user.role]?.color || '#000',
                          backgroundColor: ROLE_LABELS[user.role]?.bg || '#eee'
                        }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl min-w-[95px]">
                        <SelectItem value="student" className="text-[10px] rounded-lg">นักเรียน</SelectItem>
                        <SelectItem value="parent" className="text-[10px] rounded-lg">ผู้ปกครอง</SelectItem>
                        <SelectItem value="teacher" className="text-[10px] rounded-lg">ครูผู้สอน</SelectItem>
                        <SelectItem value="staff" className="text-[10px] rounded-lg">เจ้าหน้าที่</SelectItem>
                        <SelectItem value="admin" className="text-[10px] rounded-lg">ผู้บริหาร</SelectItem>
                        <SelectItem value="sysadmin" className="text-[10px] rounded-lg">SysAdmin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* 3. Access Control (Active/Inactive) */}
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div 
                        className="relative w-9 h-5 rounded-full cursor-pointer transition-colors duration-200"
                        style={{ backgroundColor: user.status === 'active' ? '#10b981' : 'rgba(0,0,0,0.1)' }}
                        onClick={() => toggleStatus(user.id)}
                      >
                        <motion.div
                          layout
                          initial={false}
                          animate={{ x: user.status === 'active' ? 18 : 2 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className="absolute top-0.5 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                      </div>
                      <span className={`text-[10px] font-bold ${user.status === 'active' ? 'text-emerald-600' : 'text-black/30'}`}>
                        {user.status === 'active' ? 'เปิดใช้งาน' : 'ระงับ'}
                      </span>
                    </div>
                  </TableCell>


                  {/* 4. Actions */}
                  <TableCell className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)} className="h-6 w-6 text-black/40 hover:text-blue-600 hover:bg-blue-50 rounded-md outline-none focus-visible:ring-0 transition-colors" title="แก้ไขข้อมูล">
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id)} className="h-6 w-6 text-black/40 hover:text-red-600 hover:bg-red-50 rounded-md outline-none focus-visible:ring-0 transition-colors" title="ลบผู้ใช้งาน">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="px-3 py-8 text-center text-black/40 text-xs">
                    ไม่พบข้อมูลผู้ใช้งาน
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="flex items-center justify-center gap-1 mt-4"
        >
          <Button
            variant="ghost"
            size="icon"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            className="h-8 w-8 rounded-full text-black/40 hover:bg-black/5 disabled:opacity-20"
          >
            <ChevronLeft size={16} />
          </Button>

          <div className="flex items-center gap-1 mx-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
              if (totalPages > 7) {
                if (page !== 1 && page !== totalPages && Math.abs(page - currentPage) > 2) {
                  if (page === 2 || page === totalPages - 1) return <span key={page} className="text-xs text-black/20 px-1">...</span>;
                  return null;
                }
              }

              const isActive = currentPage === page;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 min-w-[32px] px-2 rounded-full text-xs font-bold transition-all ${
                    isActive 
                      ? 'bg-[#1e1e1e] text-white shadow-md scale-110' 
                      : 'text-black/40 hover:bg-black/5 hover:text-black/70'
                  }`}
                >
                  {page}
                </button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            className="h-8 w-8 rounded-full text-black/40 hover:bg-black/5 disabled:opacity-20"
          >
            <ChevronRight size={16} />
          </Button>
        </motion.div>
      )}

      {/* ── Add/Edit User Modal ── */}
      <FormModal
        open={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
          setEditingUserId(null);
        }}
        title={editingUserId ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}
        subtitle={editingUserId ? `แก้ไขข้อมูลของ ${newFirstName} ${newLastName}` : 'กรอกข้อมูลพื้นฐานเพื่อสร้างบัญชีผู้ใช้งานใหม่ในระบบ'}
        icon={<Pencil size={18} />}
        onSubmit={() => handleAddUser()}
        submitLabel={editingUserId ? 'บันทึกการแก้ไข' : 'ยืนยันสร้างผู้ใช้'}
      >
        <div className="space-y-4 py-2">
          {/* คำนำหน้า */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">คำนำหน้าหน้า</label>
            <Select value={newPrefix} onValueChange={setNewPrefix}>
              <SelectTrigger className="w-full h-10 rounded-xl bg-black/[0.03] border-transparent transition-all text-xs focus:ring-slate-300">
                <SelectValue placeholder="เลือกคำนำหน้า" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-xl shadow-lg">
                {prefixes.map((px) => (
                  <SelectItem key={px} value={px} className="text-xs rounded-lg">{px}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ชื่อ */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">ชื่อ <span className="text-red-500">*</span></label>
            <Input 
              required
              placeholder="กรุณากรอกชื่อ" 
              value={newFirstName}
              onChange={(e) => setNewFirstName(e.target.value)}
              className="h-10 rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none text-xs font-medium"
            />
          </div>

          {/* นามสกุล */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">นามสกุล <span className="text-red-500">*</span></label>
            <Input 
              required
              placeholder="กรุณากรอกนามสกุล" 
              value={newLastName}
              onChange={(e) => setNewLastName(e.target.value)}
              className="h-10 rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none text-xs font-medium"
            />
          </div>
            
          {/* บทบาท */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">บทบาท (Role) <span className="text-red-500">*</span></label>
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger className="w-full h-10 rounded-xl bg-black/[0.03] border-transparent transition-all text-xs focus:ring-slate-300">
                <SelectValue placeholder="เลือกบทบาท" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-xl shadow-lg">
                <SelectItem value="student" className="text-xs rounded-lg">นักเรียน</SelectItem>
                <SelectItem value="parent" className="text-xs rounded-lg">ผู้ปกครอง</SelectItem>
                <SelectItem value="teacher" className="text-xs rounded-lg">ครูผู้สอน</SelectItem>
                <SelectItem value="staff" className="text-xs rounded-lg">เจ้าหน้าที่</SelectItem>
                <SelectItem value="admin" className="text-xs rounded-lg">ผู้บริหาร</SelectItem>
                <SelectItem value="sysadmin" className="text-xs rounded-lg">SysAdmin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* แผนก */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">แผนก <span className="text-red-500">*</span></label>
            <Select value={newDepartment} onValueChange={setNewDepartment}>
              <SelectTrigger className="w-full h-10 rounded-xl bg-black/[0.03] border-transparent transition-all text-xs focus:ring-slate-300">
                <SelectValue placeholder="เลือกแผนก" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-xl shadow-lg">
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id} className="text-xs rounded-lg">{dept.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
            
          {/* อีเมล */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">อีเมล <span className="text-red-500">*</span></label>
            <Input 
              required
              type="email"
              placeholder="กรุณากรอกอีเมล (email@school.ac.th)" 
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="h-10 rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none text-xs font-medium"
            />
          </div>

          {/* เบอร์โทรศัพท์ */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
            <Input 
              required
              type="tel"
              placeholder="กรุณากรอกเบอร์โทรศัพท์ (08X-XXX-XXXX)" 
              value={newPhone}
              onChange={(e) => setNewPhone(formatPhone(e.target.value))}
              maxLength={12}
              className="h-10 rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none text-xs font-medium"
            />
          </div>

          {/* รหัสผ่าน */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-black/40 uppercase tracking-widest pl-1">
              {editingUserId ? 'รหัสผ่านใหม่ (ไม่บังคับ)' : 'รหัสผ่านครอบครัว'} <span className="text-red-500">{!editingUserId && '*'}</span>
            </label>
            <div className="relative">
              <Input 
                key={showPassword ? 'text' : 'password'}
                required={!editingUserId}
                type={showPassword ? 'text' : 'password'}
                placeholder={editingUserId ? "เว้นว่างไว้หากไม่ต้องการเปลี่ยน" : "กรุณาตั้งรหัสผ่านเริ่มต้น"} 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-10 rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none pr-10 text-xs font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>
      </FormModal>

    </div>
  );
}