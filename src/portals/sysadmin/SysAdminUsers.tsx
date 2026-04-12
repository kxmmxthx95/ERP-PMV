import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import type { UserData } from '@/types/user';
import { ROLE_LABELS } from '@/types/mockUsers';
import { useUserForm } from '@/hooks/useUserForm';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// ── Styles helpers ──────────────────────────────────────────────────────────
const glassCard: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.65)',
  backdropFilter: 'blur(24px) saturate(150%)',
  WebkitBackdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255, 255, 255, 0.8)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.04)',
};

export default function SysAdminUsers() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [users, setUsers] = useState<UserData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);

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
    if (editingUserId) {
      await updateDoc(doc(db, 'users', editingUserId), newUser as any);
      setEditingUserId(null);
    } else {
      await addDoc(collection(db, 'users'), newUser);
    }
  });

  const filteredUsers = users.filter((u) => {
    const matchSearch = u.name.includes(searchTerm) || u.email.includes(searchTerm);
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
    if (window.confirm('คุณแน่ใจหรือไม่ที่จะลบผู้ใช้งานนี้?')) {
      await deleteDoc(doc(db, 'users', id));
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
                <TableHead className="px-3 py-2.5 font-semibold text-black/40 text-[11px] uppercase tracking-wider h-auto">Last Login</TableHead>
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
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-xs text-black/75">{user.name}</p>
                        <p className="text-[10px] text-black/40">{user.email}</p>
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
                  <TableCell className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={user.status === 'active'}
                        onCheckedChange={() => toggleStatus(user.id)}
                        className="data-[state=checked]:bg-[#10b981] focus-visible:ring-0 focus-visible:ring-offset-0 border-transparent scale-[0.8] origin-left"
                      />
                      <span className={`text-[10px] font-bold ${user.status === 'active' ? 'text-[#10b981]' : 'text-slate-400'}`}>
                        {user.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>

                  {/* 4. Last Login */}
                  <TableCell className="px-3 py-2 text-[11px] text-black/40">
                    {user.lastLogin}
                  </TableCell>

                  {/* 5. Actions */}
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
                  <TableCell colSpan={5} className="px-3 py-8 text-center text-black/40 text-xs">
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
          className="flex items-center justify-center gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            className="h-8 rounded-full text-xs font-medium"
          >
            ← ก่อนหน้า
          </Button>
          <div className="text-xs font-medium text-black/40 px-2">
            หน้า {currentPage} / {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            className="h-8 rounded-full text-xs font-medium"
          >
            ถัดไป →
          </Button>
        </motion.div>
      )}

      {/* ── Add User Dialog (Pop-up) ── */}
      <Dialog open={isAddOpen} onOpenChange={(open) => {
        setIsAddOpen(open);
        if (!open) setEditingUserId(null);
      }}>
        <DialogContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-3xl shadow-2xl sm:max-w-[500px] p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">{editingUserId ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานใหม่'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleAddUser} className="space-y-4 pt-2">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-4 space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">คำนำหน้า</label>
                <Select value={newPrefix} onValueChange={setNewPrefix} required>
                  <SelectTrigger className="w-full h-8 text-xs rounded-xl bg-slate-50/50 border-slate-200 focus:ring-1 focus:ring-slate-300 shadow-none">
                    <SelectValue placeholder="เลือก" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-xl shadow-lg">
                    {prefixes.map((px) => (
                      <SelectItem key={px} value={px} className="text-xs rounded-lg">{px}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="col-span-4 space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">ชื่อ</label>
                <Input 
                  required
                  placeholder="ชื่อ" 
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  className="h-8 text-xs rounded-xl bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
                />
              </div>
              
              <div className="col-span-4 space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">นามสกุล</label>
                <Input 
                  required
                  placeholder="นามสกุล" 
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  className="h-8 text-xs rounded-xl bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">บทบาท (Role)</label>
                <Select value={newRole} onValueChange={setNewRole} required>
                  <SelectTrigger className="w-full h-8 text-xs rounded-xl bg-slate-50/50 border-slate-200 focus:ring-1 focus:ring-slate-300 shadow-none">
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
              
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">แผนก</label>
                <Select value={newDepartment} onValueChange={setNewDepartment} required>
                  <SelectTrigger className="w-full h-8 text-xs rounded-xl bg-slate-50/50 border-slate-200 focus:ring-1 focus:ring-slate-300 shadow-none">
                    <SelectValue placeholder="เลือกแผนก" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-xl border-white/50 rounded-xl shadow-lg">
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id} className="text-xs rounded-lg">{dept.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">อีเมล</label>
                <Input 
                  required
                  type="email"
                  placeholder="email@school.ac.th" 
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-8 text-xs rounded-xl bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">เบอร์โทรศัพท์</label>
                <Input 
                  required
                  type="tel"
                  placeholder="08X-XXX-XXXX" 
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="h-8 text-xs rounded-xl bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">รหัสผ่าน</label>
              <Input 
                required
                type="password"
                placeholder="ตั้งรหัสผ่านเริ่มต้น" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-8 text-xs rounded-xl bg-slate-50/50 border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
              />
            </div>
            
            <DialogFooter className="pt-4 gap-2 sm:gap-0">
              <Button type="button" variant="ghost" onClick={() => setIsAddOpen(false)} className="h-8 text-[11px] rounded-lg hover:bg-slate-100 font-medium">
                ยกเลิก
              </Button>
              <Button type="submit" className="h-8 text-[11px] rounded-lg bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white font-medium">
                บันทึกข้อมูล
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}