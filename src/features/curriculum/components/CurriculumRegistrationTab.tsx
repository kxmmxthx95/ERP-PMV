import { useState } from 'react';
import { BookOpen, Plus, Trash2, UserPlus, Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface CurriculumMap {
  id: string;
  name: string;
  academicYear: string;
  graduationYear?: string;
}

interface CurriculumRegistrationTabProps {
  maps: CurriculumMap[];
  deleteCurriculumMap: (id: string) => Promise<void>;
  onSelectMap: (mapId: string) => void;
  onAdd?: () => void;
  isLoading?: boolean;
}

export default function CurriculumRegistrationTab({
  maps,
  deleteCurriculumMap,
  onSelectMap,
  onAdd,
  isLoading = false,
}: CurriculumRegistrationTabProps) {
  const [importOpen, setImportOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<{ id: string; name: string } | null>(null);

  // Filter table
  const [filterYear] = useState<string>('all');

  const allCurriculums = [...maps].sort((a, b) => Number(b.academicYear) - Number(a.academicYear));
  const curriculumList = filterYear === 'all' ? allCurriculums : allCurriculums.filter(m => m.academicYear === filterYear);
  // const uniqueYears = [...new Set(maps.map(m => m.academicYear))].sort((a, b) => Number(b) - Number(a));

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`คุณต้องการลบหลักสูตร "${name}" แน่หรือไม่?\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) {
      await deleteCurriculumMap(id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-black/80">ลงทะเบียนหลักสูตร</h2>
          <p className="text-xs text-black/40 mt-0.5">
            สร้างและจัดการหลักสูตรทุกปีการศึกษา
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="gap-1.5 text-xs h-8 bg-[#1e1e1e] hover:bg-[#2a2a2a] text-white"
            onClick={onAdd}
          >
            <Plus size={13} />
            สร้างหลักสูตร
          </Button>
        </div>
      </div>

      {/* Curriculum list table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.85)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/[0.02] text-[10px] uppercase tracking-wider font-bold text-black/40 border-b border-black/5">
                <th className="py-3 px-5 whitespace-nowrap">ชื่อหลักสูตร</th>
                <th className="py-3 px-5 whitespace-nowrap text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="border-b border-black/[0.04] last:border-0">
                    <td className="py-3 px-5">
                      <Skeleton className="h-4 w-3/4 rounded" />
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="flex justify-end gap-1">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <Skeleton className="h-8 w-8 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : curriculumList.map(c => (
                <tr
                  key={c.id}
                  className="hover:bg-black/[0.02] transition-colors border-b border-black/[0.04] last:border-0"
                >
                  <td className="py-3 px-5 text-xs font-bold text-black/80">{c.name}</td>
                  <td className="py-3 px-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        title="จัดการรายวิชาในหลักสูตร"
                        onClick={() => onSelectMap(c.id)}
                      >
                        <Settings2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                        title="นำเข้านักเรียน"
                        onClick={() => {
                          setImportTarget({ id: c.id, name: c.name });
                          setImportOpen(true);
                        }}
                      >
                        <UserPlus size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                        title="ลบ"
                        onClick={() => handleDelete(c.id, c.name)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {curriculumList.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center text-black/30">
                      <BookOpen size={36} className="mb-3 opacity-40" />
                      <p className="text-sm font-medium">
                        ไม่พบข้อมูลหลักสูตรในระบบ
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Students Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent
          className="max-w-md rounded-2xl border-0 p-0 overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.14)',
          }}
        >
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-black/5">
            <DialogTitle className="text-sm font-bold text-black/80 flex items-center gap-2">
              <UserPlus size={15} />
              นำเข้านักเรียนเข้าสู่หลักสูตร
            </DialogTitle>
            <DialogDescription className="sr-only">
              นำเข้านักเรียนเข้าสู่ระบบจากไฟล์ Excel หรือเลือกจากรายชื่อที่มี
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4 space-y-4">
            <div className="p-3 bg-black/[0.03] rounded-xl border border-black/5">
              <p className="text-xs font-semibold text-black/60 mb-1">หลักสูตรเป้าหมาย:</p>
              <p className="text-sm font-bold text-black/80">{importTarget?.name}</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-black/60">วิธีการนำเข้า</label>
              <Select defaultValue="excel">
                <SelectTrigger className="rounded-xl text-sm h-9 bg-black/[0.03] border-black/5">
                  <SelectValue placeholder="เลือกรูปแบบการนำเข้า" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excel">ไฟล์ Excel / CSV</SelectItem>
                  <SelectItem value="manual">เลือกจากรายชื่อนักเรียนที่มี</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-black/60">ไฟล์รายชื่อ</label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-3 pb-4">
                    <UserPlus className="w-6 h-6 mb-2 text-slate-500" />
                    <p className="mb-1 text-xs text-slate-500"><span className="font-semibold text-emerald-600">คลิกเพื่ออัปโหลด</span> หรือลากไฟล์มาวาง</p>
                    <p className="text-[10px] text-slate-500">.xlsx, .xls, .csv</p>
                  </div>
                  <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={() => alert('ฟังก์ชันการอัพโหลดจะถูกดำเนินการในส่วนหลังบ้าน')} />
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-black/5 mt-4">
              <Button variant="ghost" size="sm" className="flex-1 h-9 text-xs font-semibold" onClick={() => setImportOpen(false)}>
                ยกเลิก
              </Button>
              <Button
                size="sm"
                className="flex-1 h-9 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  alert('จำลองการนำเข้านักเรียนสำเร็จ');
                  setImportOpen(false);
                }}
              >
                ยืนยันการนำเข้า
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
