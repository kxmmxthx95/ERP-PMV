import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Minus, Pencil, Trash2, BookOpen, GripVertical, X, Upload, Download, Link, Sparkles, MousePointer2, PlusCircle, BookText } from 'lucide-react';
import {
  CATEGORY_CONFIG, DEPARTMENT_CONFIG, SUBJECT_GROUP_CONFIG,
  type Subject, type Department, type SubjectCategory, type SubjectGroupId,
} from '@/types/curriculum';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';
import { useSubjectGroup } from '@/hooks/useSubjectGroup';
import { Skeleton } from '@/components/ui/skeleton';

const glassCard: React.CSSProperties = {
  background: 'rgba(255,255,255,0.70)',
  backdropFilter: 'blur(24px) saturate(160%)',
  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
};

const CATEGORIES: (SubjectCategory | 'all')[] = ['all', 'core', 'added', 'elective', 'activity'];
const CATEGORY_ALL_LABEL = 'ทั้งหมด';

interface SubjectMasterPanelProps {
  subjects: Subject[];
  assignedSubjectIds?: string[];
  onAddSubject: () => void;
  onAddBulkSubjects?: (subjects: Omit<Subject, 'id'>[]) => Promise<void>;
  onEditSubject: (subject: Subject) => void;
  onDeleteSubject: (id: string) => void;
  onToggleSubject: (id: string) => void;
  isEditMode?: boolean;
  // Shared Filter Props
  search: string;
  setSearch: (s: string) => void;
  filterDepartment: string;
  setFilterDepartment: (d: string) => void;
  filterGrade: string;
  setFilterGrade: (g: string) => void;
  filterGroup: string;
  setFilterGroup: (g: string) => void;
  categoryFilter: SubjectCategory | 'all';
  setCategoryFilter: (c: SubjectCategory | 'all') => void;
  isLoading?: boolean;
}

export default function SubjectMasterPanel({
  subjects,
  assignedSubjectIds = [],
  onAddSubject,
  onAddBulkSubjects,
  onEditSubject,
  onDeleteSubject,
  onToggleSubject,
  isEditMode = false,
  search, setSearch,
  filterDepartment, setFilterDepartment,
  filterGrade, setFilterGrade,
  filterGroup, setFilterGroup,
  categoryFilter, setCategoryFilter,
  isLoading = false,
}: SubjectMasterPanelProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const { departments, getGradesBySection } = useSchoolStructure();
  const { sortedGroups, subjectsByGroup } = useSubjectGroup(subjects);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');

  const handleClearFilters = () => {
    setSearch('');
    setFilterDepartment('all');
    setFilterGrade('all');
    setFilterGroup('all');
    setCategoryFilter('all');
  };

  const hasFilters = search.trim() !== '' || filterDepartment !== 'all' || filterGrade !== 'all' || filterGroup !== 'all' || categoryFilter !== 'all';

  const grades = filterDepartment !== 'all' ? getGradesBySection(filterDepartment as any) : [];

  const filtered = subjects
    .filter(s => filterDepartment === 'all' || s.department === filterDepartment)
    .filter(s => filterGrade === 'all' || (s as any).gradeLevel === filterGrade || (s as any).grade === filterGrade)
    .filter(s => categoryFilter === 'all' || s.category === categoryFilter)
    .filter(s => {
      if (filterGroup === 'all') return true;
      // ตรวจสอบว่า subject อยู่ในกลุ่มที่เลือก
      for (const groupId of Object.keys(subjectsByGroup)) {
        if (subjectsByGroup[groupId]?.some(sub => sub.id === s.id) &&
          (subjectsByGroup as any)[groupId] === sortedGroups.find(g => g.id === filterGroup)?.subjectIds) {
          return true;
        }
      }
      // ใช้ simple check: หา group ที่มี subject นี้
      const groupWithSubject = sortedGroups.find(g => g.subjectIds.includes(s.id));
      return groupWithSubject?.id === filterGroup;
    })
    .filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()),
    );

  // ── Pagination ──
  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, filterDepartment, filterGrade, filterGroup]);

  // จัดกลุ่มวิชาตามกลุ่มสาระ (ใช้ Hook เดิมช่วยย่อยข้อมูลที่กรองหน้าปัจจุบัน)
  const { subjectsByGroup: groupedBySubjectGroup } = useSubjectGroup(paginated);

  const deptCfg = filterDepartment !== 'all' && DEPARTMENT_CONFIG[filterDepartment as Department]
    ? DEPARTMENT_CONFIG[filterDepartment as Department]
    : { bg: 'rgba(0,0,0,0.05)', color: '#1e1e1e', border: 'transparent', label: 'เลือกแผนก' };
  const totalCredits = filtered.reduce((sum, s) => sum + s.credits, 0);

  // ── normalize gradeLevel: ป.1→p1, ม.3→m3, อ.2→k2 ──────────────────────────
  const normalizeGradeLevel = (raw: string): string => {
    if (!raw) return '';
    const s = raw.trim();
    const map: Record<string, string> = {
      'เตรียมอนุบาล': 'pre-k', 'เตรียมฯ': 'pre-k', 'pre-k': 'pre-k',
      'อนุบาล 1': 'k1', 'อนุบาล1': 'k1', 'อ.1': 'k1', 'k1': 'k1',
      'อนุบาล 2': 'k2', 'อนุบาล2': 'k2', 'อ.2': 'k2', 'k2': 'k2',
      'อนุบาล 3': 'k3', 'อนุบาล3': 'k3', 'อ.3': 'k3', 'k3': 'k3',
      'ป.1': 'p1', 'ป1': 'p1', 'ประถม 1': 'p1', 'ประถม1': 'p1', 'p1': 'p1',
      'ป.2': 'p2', 'ป2': 'p2', 'ประถม 2': 'p2', 'ประถม2': 'p2', 'p2': 'p2',
      'ป.3': 'p3', 'ป3': 'p3', 'ประถม 3': 'p3', 'ประถม3': 'p3', 'p3': 'p3',
      'ป.4': 'p4', 'ป4': 'p4', 'ประถม 4': 'p4', 'ประถม4': 'p4', 'p4': 'p4',
      'ป.5': 'p5', 'ป5': 'p5', 'ประถม 5': 'p5', 'ประถม5': 'p5', 'p5': 'p5',
      'ป.6': 'p6', 'ป6': 'p6', 'ประถม 6': 'p6', 'ประถม6': 'p6', 'p6': 'p6',
      'ม.1': 'm1', 'ม1': 'm1', 'มัธยม 1': 'm1', 'มัธยม1': 'm1', 'm1': 'm1',
      'ม.2': 'm2', 'ม2': 'm2', 'มัธยม 2': 'm2', 'มัธยม2': 'm2', 'm2': 'm2',
      'ม.3': 'm3', 'ม3': 'm3', 'มัธยม 3': 'm3', 'มัธยม3': 'm3', 'm3': 'm3',
      'ม.4': 'm4', 'ม4': 'm4', 'มัธยม 4': 'm4', 'มัธยม4': 'm4', 'm4': 'm4',
      'ม.5': 'm5', 'ม5': 'm5', 'มัธยม 5': 'm5', 'มัธยม5': 'm5', 'm5': 'm5',
      'ม.6': 'm6', 'ม6': 'm6', 'มัธยม 6': 'm6', 'มัธยม6': 'm6', 'm6': 'm6',
    };
    return map[s] ?? s;
  };

  // ── normalize category: ภาษาไทย / ผิด → ID จริง ────────────────────────────
  const normalizeCategory = (raw: string): SubjectCategory => {
    if (!raw) return 'core';
    const s = raw.trim().toLowerCase().replace(/\s+/g, '');
    const map: Record<string, SubjectCategory> = {
      'core': 'core',
      'พื้นฐาน': 'core',
      'วิชาพื้นฐาน': 'core',
      'added': 'added',
      'add': 'added',
      'เพิ่มเติม': 'added',
      'วิชาเพิ่มเติม': 'added',
      'elective': 'elective',
      'เลือกเสรี': 'elective',
      'วิชาเลือกเสรี': 'elective',
      'เลือก': 'elective',
      'วิชาเลือก': 'elective',
      'activity': 'activity',
      'กิจกรรม': 'activity',
      'กิจกรรมพัฒนาผู้เรียน': 'activity',
      'กิจกรรมฯ': 'activity',
    };
    return map[s] ?? 'core';
  };

  // ── helper: อ่าน category จาก subjectData (รองรับหลายชื่อ column) ────────────
  const readCategory = (row: Record<string, string>): SubjectCategory =>
    normalizeCategory(
      row['หมวดหมู่วิชา'] || row['หมวดหมู่'] || row['หมวดวิชา'] || row['ประเภทวิชา'] || row['category'] || row['Category'] || ''
    );

  // ── helper: อ่าน subjectGroup จาก subjectData (รองรับหลายชื่อ column) ─────────
  const readSubjectGroup = (row: Record<string, string>): string =>
    normalizeSubjectGroup(
      row['กลุ่มสาระการเรียนรู้'] || row['กลุ่มสาระ'] || row['กลุ่ม'] || row['subjectGroup'] || row['subject_group'] || ''
    );

  // ── normalize subjectGroup: ชื่อย่อ/ผิด → ID จริง ───────────────────────────
  const normalizeSubjectGroup = (raw: string): string => {
    if (!raw) return 'other';
    const s = raw.trim().toLowerCase();
    const map: Record<string, string> = {
      'thai': 'thai', 'ภาษาไทย': 'thai',
      'math': 'math', 'คณิตศาสตร์': 'math', 'คณิต': 'math',
      'science': 'science', 'วิทยาศาสตร์': 'science', 'วิทย์': 'science',
      'social': 'social', 'สังคม': 'social', 'สังคมศึกษา': 'social',
      'health_pe': 'health_pe', 'health': 'health_pe', 'สุขศึกษา': 'health_pe', 'พลศึกษา': 'health_pe',
      'arts': 'arts', 'art': 'arts', 'ศิลปะ': 'arts',
      'careers': 'careers', 'career': 'careers', 'การงาน': 'careers', 'การงานอาชีพ': 'careers',
      'foreign_lang': 'foreign_lang', 'foreign': 'foreign_lang', 'ภาษาต่างประเทศ': 'foreign_lang', 'ภาษาอังกฤษ': 'foreign_lang',
      'other': 'other', 'อื่นๆ': 'other', 'กิจกรรม': 'other',
    };
    return map[s] ?? 'other';
  };

  const handleDownloadTemplate = () => {
    const header = "รหัสวิชา,ชื่อวิชา,หน่วยกิต,ชั่วโมงต่อสัปดาห์,ชั่วโมงเต็ม,แผนก,ระดับชั้น,กลุ่มสาระการเรียนรู้,หมวดหมู่วิชา,คำอธิบาย\n";
    const hint = "[คำแนะนำ],[คำแนะนำ],[ตัวเลข เช่น 1.0],[ตัวเลข เช่น 2],[ตัวเลข เช่น 40],[early=ปฐมวัย / primary=ประถม / secondary=มัธยม],[ป.1-ป.6 / ม.1-ม.6 / อ.1-อ.3 (ถ้ามี)],[thai/math/science/social/health_pe/arts/careers/foreign_lang/other],[core=พื้นฐาน / added=เพิ่มเติม / elective=เลือกเสรี / activity=กิจกรรม],[ไม่บังคับ]\n";
    const sample = "ท11101,ภาษาไทย,1,2,40,primary,ป.1,thai,core,วิชาพื้นฐานภาษาไทย\n";
    const blob = new Blob(["\ufeff" + header + hint + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "subject_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAddBulkSubjects) return;

    setIsUploading(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
      if (lines.length < 2) throw new Error("ไฟล์ว่างเปล่าหรือไม่มีข้อมูล");

      // strip BOM จาก header บรรทัดแรก
      const rawHeader = lines[0].replace(/^\uFEFF/, '');
      const headers = rawHeader.split(',').map(h => h.trim());
      const parsedSubjects: Omit<Subject, 'id'>[] = [];

      const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(regex).map(v => v.replace(/^"|"$/g, '').trim());
        const subjectData = headers.reduce((acc, header, index) => {
          acc[header] = values[index];
          return acc;
        }, {} as Record<string, string>);

        // ข้ามแถว hint (ขึ้นต้นด้วย [คำแนะนำ])
        const code = subjectData['รหัสวิชา'] || subjectData['รหัสวิชา(ไทย)'];
        if (!code || code.startsWith('[')) continue;

        const name = subjectData['ชื่อวิชา'] || subjectData['ชื่อวิชา(ไทย)'];
        if (!name || name.startsWith('[')) continue;

        parsedSubjects.push({
          code: code.toUpperCase(),
          name,
          credits: parseFloat(subjectData['หน่วยกิต']) || 0,
          hoursPerWeek: parseInt(subjectData['ชั่วโมงต่อสัปดาห์']) || 0,
          totalHours: parseInt(subjectData['ชั่วโมงเต็ม']) || 0,
          department: (subjectData['แผนก(early/primary/secondary)'] || subjectData['แผนก'] || 'primary') as Department,
          gradeLevel: normalizeGradeLevel(subjectData['ระดับชั้น'] || ''),
          subjectGroup: readSubjectGroup(subjectData),
          category: readCategory(subjectData),
          description: subjectData['คำอธิบาย'] || '',
        } as any);
      }

      if (parsedSubjects.length > 0) {
        await onAddBulkSubjects(parsedSubjects);
        alert(`เพิ่มแล้ว ${parsedSubjects.length} วิชา`);
      } else {
        alert('ไม่พบข้อมูลวิชาที่สมบูรณ์ในไฟล์');
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการอ่านไฟล์ CSV');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // แปลง Google Sheets URL → CSV export URL (รองรับทั้ง share link และ publish link)
  const toSheetCsvUrl = (url: string): string | null => {
    // รูปแบบ "Publish to web" → ใช้ตรง ๆ ได้เลย
    if (url.includes('/pub?') || url.includes('/pub#')) {
      return url.includes('output=csv') ? url : url.replace(/output=\w+/, 'output=csv');
    }
    // รูปแบบ share link → แปลงเป็น export
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) return null;
    const id = match[1];
    const gidMatch = url.match(/[#&?]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : '0';
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  };

  const handleImportFromSheet = async () => {
    if (!sheetUrl.trim() || !onAddBulkSubjects) return;
    const csvUrl = toSheetCsvUrl(sheetUrl.trim());
    if (!csvUrl) {
      alert('URL ไม่ถูกต้อง — กรุณาวาง URL ของ Google Sheets');
      return;
    }
    setIsUploading(true);
    try {
      // ใช้ CORS proxy เพื่อหลีกเลี่ยง browser CORS restriction
      const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(csvUrl)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
      if (lines.length < 2) throw new Error('ไม่มีข้อมูล');

      const rawHeader = lines[0].replace(/^\uFEFF/, '');
      const headers = rawHeader.split(',').map(h => h.trim());
      const parsedSubjects: Omit<Subject, 'id'>[] = [];
      const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(regex).map(v => v.replace(/^"|"$/g, '').trim());
        const subjectData = headers.reduce((acc, header, index) => {
          acc[header] = values[index];
          return acc;
        }, {} as Record<string, string>);

        const code = subjectData['รหัสวิชา'] || subjectData['รหัสวิชา(ไทย)'];
        if (!code || code.startsWith('[')) continue;
        const name = subjectData['ชื่อวิชา'] || subjectData['ชื่อวิชา(ไทย)'];
        if (!name || name.startsWith('[')) continue;

        parsedSubjects.push({
          code: code.toUpperCase(),
          name,
          credits: parseFloat(subjectData['หน่วยกิต']) || 0,
          hoursPerWeek: parseInt(subjectData['ชั่วโมงต่อสัปดาห์']) || 0,
          totalHours: parseInt(subjectData['ชั่วโมงเต็ม']) || 0,
          department: (subjectData['แผนก(early/primary/secondary)'] || subjectData['แผนก'] || 'primary') as Department,
          gradeLevel: normalizeGradeLevel(subjectData['ระดับชั้น'] || ''),
          subjectGroup: readSubjectGroup(subjectData),
          category: readCategory(subjectData),
          description: subjectData['คำอธิบาย'] || '',
        } as any);
      }

      if (parsedSubjects.length > 0) {
        await onAddBulkSubjects(parsedSubjects);
        alert(`นำเข้าสำเร็จ ${parsedSubjects.length} วิชา`);
        setSheetUrl('');
        setShowUrlInput(false);
      } else {
        alert('ไม่พบข้อมูลวิชาที่สมบูรณ์ใน Sheet\nตรวจสอบว่า header ตรงกับเทมเพลต');
      }
    } catch (err) {
      console.error(err);
      alert(
        'นำเข้าไม่สำเร็จ\n\nวิธีแก้:\n' +
        '1. ไปที่ Google Sheets → File → Share → Publish to web\n' +
        '2. เลือก "Comma-separated values (.csv)" แล้วกด Publish\n' +
        '3. คัดลอก URL ที่ได้มาวางที่นี่'
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="rounded-3xl overflow-hidden flex flex-col h-full"
      style={{ ...glassCard, minHeight: 0 }}
    >
      {/* Header */}
      <div className="p-2.5 sm:p-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg bg-[#1e1e1e] flex items-center justify-center text-white shadow-sm flex-shrink-0"
            >
              <BookOpen size={14} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-black/80 leading-none">คลังวิชา</p>
              <p className="text-[9px] text-black/40 mt-0.5">{deptCfg.label} · {filtered.length} วิชา · {totalCredits} นก.</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-1 justify-end">
            <div className="relative w-full max-w-[140px] sm:max-w-[180px]">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-black/30 z-10" />
              <Input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหา..."
                className="w-full pl-7 pr-2 py-1.5 bg-black/5 hover:bg-black/10 border-transparent outline-none text-xs placeholder:text-black/40 shadow-none focus-visible:ring-1 focus-visible:ring-slate-300 h-auto rounded-lg transition-colors"
              />
            </div>

            <div className="flex gap-1.5 ml-1.5 border-l border-black/10 pl-1.5">
              <Button
                onClick={handleDownloadTemplate}
                variant="ghost"
                className="w-[28px] h-[28px] p-0 rounded-lg text-black/40 hover:text-[#1e1e1e] hover:bg-black/5 shrink-0"
                title="โหลดเทมเพลต CSV"
              >
                <Download size={14} />
              </Button>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="ghost"
                disabled={isUploading || !onAddBulkSubjects}
                className="w-[28px] h-[28px] p-0 rounded-lg text-black/40 hover:text-[#1e1e1e] hover:bg-black/5 shrink-0"
                title="อัปโหลด CSV"
              >
                <Upload size={14} />
              </Button>
              <Button
                onClick={() => setShowUrlInput(v => !v)}
                variant="ghost"
                disabled={isUploading || !onAddBulkSubjects}
                className={`w-[28px] h-[28px] p-0 rounded-lg hover:bg-black/5 shrink-0 transition-colors ${showUrlInput ? 'text-emerald-600 bg-emerald-50' : 'text-black/40 hover:text-[#1e1e1e]'}`}
                title="นำเข้าจาก Google Sheets"
              >
                <Link size={14} />
              </Button>
              <Button
                onClick={onAddSubject}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold text-white transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] h-auto border-0 bg-[#1e1e1e] hover:bg-[#2a2a2a] flex-shrink-0"
                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
              >
                <Plus size={13} />
                เพิ่มวิชา
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Google Sheets URL Input */}
      <AnimatePresence>
        {showUrlInput && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pt-2 pb-1.5 space-y-1.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'rgba(16,185,129,0.03)' }}>
              <div className="flex gap-1.5 items-center">
                <Link size={12} className="text-emerald-500 shrink-0" />
                <Input
                  value={sheetUrl}
                  onChange={e => setSheetUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleImportFromSheet()}
                  placeholder="วาง URL Google Sheets ที่นี่..."
                  className="flex-1 h-7 text-xs bg-white/60 border-black/10 rounded-lg px-2 focus-visible:ring-1 focus-visible:ring-emerald-400"
                />
                <Button
                  onClick={handleImportFromSheet}
                  disabled={isUploading || !sheetUrl.trim()}
                  size="sm"
                  className="h-7 px-3 text-[11px] font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shrink-0"
                >
                  {isUploading ? 'กำลังนำเข้า...' : 'นำเข้า'}
                </Button>
              </div>
              <p className="text-[9px] text-black/40 pl-5">
                ต้องทำ <span className="font-semibold text-emerald-600">File → Share → Publish to web → CSV</span> ก่อนวาง URL
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter Section - Static */}
      <div className="p-2.5 sm:p-3 space-y-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'rgba(0,0,0,0.01)' }}>
        <div className="flex flex-col sm:flex-row gap-1.5">
          <Select value={filterDepartment} onValueChange={(val) => {
            setFilterDepartment(val);
            setFilterGrade('all');
            setFilterGroup('all');
          }}>
            <SelectTrigger className="w-full sm:flex-1 px-2 py-1 bg-black/5 hover:bg-black/10 border-transparent text-xs text-black/70 shadow-none focus:ring-1 focus:ring-slate-300 h-auto rounded-lg transition-colors flex-shrink-0">
              <SelectValue placeholder="แผนก" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
              <SelectItem value="all" className="text-xs rounded-lg">แผนกทั้งหมด</SelectItem>
              {departments.map(d => (
                <SelectItem key={d.id} value={d.id} className="text-xs rounded-lg">{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterGrade} onValueChange={setFilterGrade} disabled={filterDepartment === 'all'}>
            <SelectTrigger className="w-full sm:flex-1 px-2 py-1 bg-black/5 hover:bg-black/10 border-transparent text-xs text-black/70 shadow-none focus:ring-1 focus:ring-slate-300 h-auto rounded-lg transition-colors flex-shrink-0">
              <SelectValue placeholder="ชั้น" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
              <SelectItem value="all" className="text-xs rounded-lg">เลือกระดับชั้น</SelectItem>
              {grades.map(g => (
                <SelectItem key={g.id} value={g.id} className="text-xs rounded-lg">{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterGroup} onValueChange={setFilterGroup}>
            <SelectTrigger className="w-full sm:flex-1 px-2 py-1 bg-black/5 hover:bg-black/10 border-transparent text-xs text-black/70 shadow-none focus:ring-1 focus:ring-slate-300 h-auto rounded-lg transition-colors flex-shrink-0">
              <SelectValue placeholder="กลุ่มสาระ" />
            </SelectTrigger>
            <SelectContent className="bg-white/90 backdrop-blur-xl border-white/50 rounded-xl">
              <SelectItem value="all" className="text-xs rounded-lg">ทั้งหมด</SelectItem>
              {sortedGroups.map(g => (
                <SelectItem key={g.id} value={g.id} className="text-xs rounded-lg">{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AnimatePresence>
            {hasFilters && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, width: 0 }}
                animate={{ opacity: 1, scale: 1, width: 'auto' }}
                exit={{ opacity: 0, scale: 0.8, width: 0 }}
                className="flex items-center"
              >
                <Button
                  onClick={handleClearFilters}
                  variant="ghost"
                  className="h-auto py-1 px-2 text-[10px] text-red-500/70 hover:text-red-600 hover:bg-red-50 whitespace-nowrap ml-1 sm:ml-0 flex-shrink-0"
                >
                  <X size={12} className="mr-0.5" /> ล้าง
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div
          className="flex gap-1 overflow-x-auto rounded-xl shadow-sm max-w-full"
          style={{
            background: 'rgba(255, 255, 255, 0.4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            padding: '0.25rem',
          }}
        >
          {CATEGORIES.map(cat => {
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className="flex items-center justify-center px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 flex-shrink-0 flex-1"
                style={{
                  background: active ? '#1e1e1e' : 'transparent',
                  color: active ? '#fff' : 'rgba(0, 0, 0, 0.6)',
                  boxShadow: active ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                }}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.05)';
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                {cat === 'all' ? CATEGORY_ALL_LABEL : CATEGORY_CONFIG[cat].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table/List Section */}
      <motion.div
        layout
        className="flex-1 overflow-y-auto px-2.5 py-2 space-y-2.5 min-h-0"
      >
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center gap-3 px-2.5 py-2 rounded-xl border border-black/5 bg-white/40 shadow-sm">
                <Skeleton className="w-14 h-4 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="w-3/4 h-3 rounded" />
                  <Skeleton className="w-1/4 h-2 rounded" />
                </div>
                <Skeleton className="w-10 h-3 rounded" />
              </div>
            ))}
          </div>
        ) : search.trim() === '' && filterDepartment === 'all' && filterGrade === 'all' && filterGroup === 'all' ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-black/30 border border-dashed border-black/10 rounded-2xl bg-black/[0.02] mt-2">
            <Search size={28} className="mb-2 opacity-50" />
            <p className="text-xs font-medium">กรุณาพิมพ์ข้อความค้นหา</p>
            <p className="text-[10px] mt-1">หรือเลือกตัวกรองแผนก/ระดับชั้น เพื่อแสดงวิชา</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <BookOpen size={28} className="text-black/15 mb-2" />
            <p className="text-xs text-black/40 font-medium">ไม่พบวิชาที่ค้นหา</p>
          </div>
        ) : (
          sortedGroups.map(group => {
            const groupSubjects = groupedBySubjectGroup[group.id] || [];
            if (groupSubjects.length === 0) return null;

            const showHeader = filterGroup === 'all';

            return (
              <div
                key={group.id}
                className="space-y-1"
              >
                {showHeader && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 mt-1 first:mt-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-black/20" />
                    <h4 className="text-[10px] font-bold text-black/50 uppercase tracking-wider">{group.name}</h4>
                  </div>
                )}
                {groupSubjects.map((subject: Subject) => (
                  <SubjectRow
                    key={subject.id}
                    subject={subject}
                    isAssigned={assignedSubjectIds.includes(subject.id)}
                    onEdit={() => onEditSubject(subject)}
                    onDelete={() => onDeleteSubject(subject.id)}
                    onToggleSubject={() => {
                      if (filterDepartment !== 'all' && filterGrade !== 'all') {
                        onToggleSubject(subject.id);
                      }
                    }}
                    canToggle={filterDepartment !== 'all' && filterGrade !== 'all'}
                    isEditMode={isEditMode}
                  />
                ))}
              </div>
            );
          })
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="px-3 py-2 border-t border-black/5 bg-white/40 flex items-center justify-between mt-auto shrink-0 backdrop-blur-md">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="h-7 text-[10px] px-2.5 rounded-lg bg-white/60 hover:bg-white shadow-none"
            >
              ก่อนหน้า
            </Button>
            <span className="text-[10px] text-black/50 font-medium">
              หน้า {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="h-7 text-[10px] px-2.5 rounded-lg bg-white/60 hover:bg-white shadow-none"
            >
              ถัดไป
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ── Subject Row ───────────────────────────────────────────────────────────────
function SubjectRow({
  subject,
  isAssigned,
  onEdit,
  onDelete,
  onToggleSubject,
  isEditMode = false,
  canToggle = true,
}: {
  subject: Subject;
  isAssigned: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSubject: () => void;
  isEditMode?: boolean;
  canToggle?: boolean;
}) {
  const catCfg = CATEGORY_CONFIG[subject.category];
  const groupCfg = SUBJECT_GROUP_CONFIG[(subject.subjectGroup || 'other') as SubjectGroupId];

  const categoryIcons: Record<SubjectCategory, React.ReactNode> = {
    core: <BookText size={10} />,
    added: <PlusCircle size={10} />,
    elective: <MousePointer2 size={10} />,
    activity: <Sparkles size={10} />,
  };

  return (
    <div
      draggable={!isAssigned && isEditMode}
      onDragStart={(e) => {
        if (isAssigned || !isEditMode) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData('text/plain', subject.id);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all border ${
        isAssigned
          ? 'bg-emerald-50/50 border-emerald-100/50'
          : (isEditMode && canToggle)
            ? 'hover:shadow-sm cursor-grab active:cursor-grabbing'
            : 'border-transparent'
      }`}
      style={{
        backgroundColor: !isAssigned ? groupCfg.bg : undefined,
        borderColor: !isAssigned ? groupCfg.border : undefined,
      }}
    >
      {/* Drag handle icon */}
      {!isAssigned && (
        <div className="opacity-0 group-hover:opacity-40 transition-opacity -ml-1 flex-shrink-0 text-black/40">
          <GripVertical size={13} />
        </div>
      )}

      {/* Code badge */}
      <span
        className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
        style={{ background: 'rgba(0,0,0,0.05)', color: groupCfg.color }}
      >
        {subject.code}
      </span>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-semibold text-black/80 truncate">{subject.name}</p>
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold border flex-shrink-0 whitespace-nowrap transition-colors"
            style={{
              background: catCfg.bg,
              color: catCfg.color,
              borderColor: catCfg.border || 'transparent'
            }}
          >
            {categoryIcons[subject.category]}
            {catCfg.label}
          </div>
          {isAssigned && (
            <span className="px-1 py-0.5 rounded-full text-[7px] font-bold bg-emerald-500 text-white flex-shrink-0 whitespace-nowrap shadow-sm shadow-emerald-500/20">
              อยู่ในแผน
            </span>
          )}
        </div>
      </div>

      {/* Credits + hours */}
      <div className="flex-shrink-0 text-right whitespace-nowrap">
        <p className="text-[9px] font-bold text-black/60">{subject.credits} นก. / {subject.hoursPerWeek}ชม.</p>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-center gap-1 transition-all">
        {isEditMode && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSubject}
              disabled={!canToggle && !isAssigned}
              title={!canToggle && !isAssigned ? "กรุณาเลือกแผนก และ ระดับชั้น ด้านบนก่อน จึงจะสามารถเพิ่มรายวิชาได้" : (isAssigned ? "นำออกจากแผน" : "เพิ่มเข้าแผน")}
              className={`w-6 h-6 rounded-md flex items-center justify-center transition-all shadow-sm focus-visible:ring-0 ${isAssigned
                ? "bg-red-500 text-white hover:bg-red-600"
                : canToggle ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-black/5 text-black/20"
                }`}
            >
              {isAssigned ? <Minus size={13} /> : <Plus size={13} />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              className="w-6 h-6 rounded-md flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm focus-visible:ring-0"
            >
              <Pencil size={12} />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="w-6 h-6 rounded-md flex items-center justify-center bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm focus-visible:ring-0"
            >
              <Trash2 size={12} />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
