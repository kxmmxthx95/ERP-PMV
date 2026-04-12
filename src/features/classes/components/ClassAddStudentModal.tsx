import { useState, useEffect, useMemo } from 'react';
import { X, Search, UserPlus, User } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { collection, onSnapshot, doc, writeBatch, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ClassRoom } from '@/types/class';
import { toast } from 'sonner';

interface StudentData {
  id: string;
  name: string;
  email: string;
  gradeLevel?: string;
  classId?: string;
}

interface ClassAddStudentModalProps {
  open: boolean;
  onClose: () => void;
  classRoom: ClassRoom | null;
}

export default function ClassAddStudentModal({ open, onClose, classRoom }: ClassAddStudentModalProps) {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // ── Fetch Students ──
  useEffect(() => {
    if (!open || !classRoom) return;

    // ดึงเฉพาะ user ที่มีบทบาทเป็น student
    const q = query(collection(db, 'users'), where('role', '==', 'student'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudentData));
      
      // กรอง 1: ต้องไม่มี classId (ยังไม่ได้อยู่ห้องไหน)
      // กรอง 2: ต้องอยู่ระดับชั้นเดียวกันกับห้องนี้ (อนุโลมคนที่ไม่มี gradeLevel ให้แสดงเผื่อไว้ด้วยในตอนทดสอบ)
      const eligible = fetched.filter(s => 
        (!s.classId || s.classId.trim() === '') && 
        (s.gradeLevel === classRoom.gradeLevel || !s.gradeLevel)
      );
      
      setStudents(eligible);
    });

    return () => unsubscribe();
  }, [open, classRoom]);

  // ── Reset State ──
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setSearch('');
    }
  }, [open]);

  // ── Handlers ──
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    return students.filter(s => s.name.includes(search) || s.email.includes(search));
  }, [students, search]);

  const toggleStudent = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSave = async () => {
    if (!classRoom || selectedIds.size === 0) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      
      // อัปเดตข้อมูลนักเรียนแต่ละคนให้ระบุว่าอยู่ห้องนี้
      selectedIds.forEach(id => {
        const ref = doc(db, 'users', id);
        batch.update(ref, { classId: classRoom.id, className: classRoom.className });
      });

      await batch.commit();
      toast.success(`เพิ่มนักเรียน ${selectedIds.size} คน เข้าห้อง ${classRoom.className} สำเร็จ`);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('เกิดข้อผิดพลาดในการเพิ่มนักเรียน');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        className="max-w-sm sm:max-w-[450px] rounded-3xl border-0 p-0 overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(32px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
        }}
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-black/05">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-black/80 flex items-center gap-2">
              <UserPlus size={18} className="text-emerald-600" />
              เพิ่มนักเรียนเข้าห้อง {classRoom?.className}
            </DialogTitle>
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-black/40 hover:bg-black/06 transition-colors">
              <X size={15} />
            </button>
          </div>
          <p className="text-xs text-black/40 mt-1">
            แสดงเฉพาะนักเรียนชั้น {classRoom?.gradeLevel} ที่ยังไม่มีห้องเรียน
          </p>
        </DialogHeader>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-4">
          {/* Search Box */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ หรือ อีเมล..."
              className="w-full pl-9 h-9 text-xs rounded-xl bg-black/[0.03] border-transparent focus-visible:ring-1 focus-visible:ring-slate-300 shadow-none"
            />
          </div>

          {/* Student List */}
          <div className="space-y-1.5">
            {filteredStudents.length === 0 ? (
              <div className="py-8 text-center text-black/30 flex flex-col items-center gap-2">
                <User size={24} className="opacity-50" />
                <p className="text-xs">ไม่พบนักเรียนที่สามารถเพิ่มได้</p>
              </div>
            ) : (
              filteredStudents.map(student => (
                <div
                  key={student.id}
                  onClick={() => toggleStudent(student.id)}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-black/5 hover:bg-black/[0.02] cursor-pointer transition-colors"
                >
                  <Checkbox 
                    checked={selectedIds.has(student.id)} 
                    className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 rounded-[4px]"
                  />
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-[11px] shrink-0">
                    {student.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-black/75 truncate">{student.name}</p>
                    <p className="text-[10px] text-black/40 truncate">{student.email}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 flex items-center justify-between border-t border-black/[0.04]">
          <p className="text-xs font-medium text-black/40">
            เลือกแล้ว {selectedIds.size} คน
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8 rounded-lg border-black/10">
              ยกเลิก
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={selectedIds.size === 0 || isSaving}
              className="text-xs h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40"
            >
              {isSaving ? 'กำลังบันทึก...' : 'เพิ่มลงห้องเรียน'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}