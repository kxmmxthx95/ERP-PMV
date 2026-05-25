import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { LessonPlan, LessonMaterial, MaterialType, NewLessonPlan } from '@/types/lessonPlan';

interface Props {
  open: boolean;
  initial?: LessonPlan | null;
  teacherId: string;
  teacherName: string;
  departmentId: string;
  academicYearId: string;
  semester: 1 | 2;
  onClose: () => void;
  onSave: (data: NewLessonPlan) => Promise<void>;
}

const GLASS: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(24px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.90)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
};

const MATERIAL_TYPES: { value: MaterialType; label: string }[] = [
  { value: 'pdf',   label: 'PDF' },
  { value: 'link',  label: 'ลิงก์เว็บ' },
  { value: 'video', label: 'วิดีโอ' },
  { value: 'image', label: 'รูปภาพ' },
  { value: 'other', label: 'อื่นๆ' },
];

const empty = (): Omit<NewLessonPlan, 'teacherId' | 'teacherName' | 'departmentId' | 'academicYearId' | 'semester' | 'status'> => ({
  courseId: '',
  courseName: '',
  gradeLevel: '',
  title: '',
  weekNumber: 1,
  objectives: [''],
  activities: '',
  evaluationMethod: '',
  materials: [],
  linkedSessionIds: [],
});

export default function LessonPlanFormModal({
  open, initial, teacherId, teacherName, departmentId, academicYearId, semester,
  onClose, onSave,
}: Props) {
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        courseId: initial.courseId,
        courseName: initial.courseName,
        gradeLevel: initial.gradeLevel,
        title: initial.title,
        weekNumber: initial.weekNumber,
        objectives: initial.objectives.length ? initial.objectives : [''],
        activities: initial.activities,
        evaluationMethod: initial.evaluationMethod,
        materials: initial.materials,
        linkedSessionIds: initial.linkedSessionIds,
      });
    } else {
      setForm(empty());
    }
  }, [initial, open]);

  if (!open) return null;

  const setField = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  // Objectives helpers
  const setObjective = (i: number, val: string) =>
    setField('objectives', form.objectives.map((o, idx) => idx === i ? val : o));
  const addObjective = () => setField('objectives', [...form.objectives, '']);
  const removeObjective = (i: number) =>
    setField('objectives', form.objectives.filter((_, idx) => idx !== i));

  // Materials helpers
  const setMaterial = (i: number, mat: Partial<LessonMaterial>) =>
    setField('materials', form.materials.map((m, idx) => idx === i ? { ...m, ...mat } : m));
  const addMaterial = () =>
    setField('materials', [...form.materials, { type: 'link', name: '', url: '' }]);
  const removeMaterial = (i: number) =>
    setField('materials', form.materials.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!form.title.trim() || !form.courseId.trim()) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        teacherId,
        teacherName,
        departmentId,
        academicYearId,
        semester,
        status: 'draft',
        objectives: form.objectives.filter(o => o.trim()),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl" style={GLASS}>
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-white/60"
          style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', borderRadius: '1.5rem 1.5rem 0 0' }}>
          <h2 className="text-lg font-black text-slate-800 font-sukhumvit">
            {initial ? 'แก้ไขแผนการสอน' : 'สร้างแผนการสอนใหม่'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Course + Week */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 font-sarabun">รหัสวิชา *</label>
              <input
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-sarabun focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="เช่น ว31201"
                value={form.courseId}
                onChange={e => setField('courseId', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 font-sarabun">สัปดาห์ที่ *</label>
              <input
                type="number" min={1} max={20}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-sarabun focus:outline-none focus:ring-2 focus:ring-indigo-300"
                value={form.weekNumber}
                onChange={e => setField('weekNumber', Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 font-sarabun">ชื่อวิชา</label>
              <input
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-sarabun focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="เช่น ฟิสิกส์"
                value={form.courseName}
                onChange={e => setField('courseName', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 font-sarabun">ระดับชั้น</label>
              <input
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-sarabun focus:outline-none focus:ring-2 focus:ring-indigo-300"
                placeholder="เช่น ม.4"
                value={form.gradeLevel}
                onChange={e => setField('gradeLevel', e.target.value)}
              />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 font-sarabun">หัวข้อแผนการสอน *</label>
            <input
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-sarabun focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="เช่น การเคลื่อนที่แนวตรง: ความเร็วและอัตราเร็ว"
              value={form.title}
              onChange={e => setField('title', e.target.value)}
            />
          </div>

          {/* Objectives */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 font-sarabun">จุดประสงค์การเรียนรู้</label>
              <button onClick={addObjective}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors font-sarabun">
                <Plus size={12} /> เพิ่ม
              </button>
            </div>
            {form.objectives.map((obj, i) => (
              <div key={i} className="flex gap-2">
                <span className="mt-2 text-xs text-slate-400 font-bold w-4 shrink-0">{i + 1}.</span>
                <input
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-sarabun focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  placeholder="จุดประสงค์..."
                  value={obj}
                  onChange={e => setObjective(i, e.target.value)}
                />
                {form.objectives.length > 1 && (
                  <button onClick={() => removeObjective(i)}
                    className="mt-1 p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Activities */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 font-sarabun">กิจกรรมการสอน</label>
            <textarea
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-sarabun focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
              placeholder="ระบุกิจกรรมการเรียนการสอนตามลำดับ..."
              value={form.activities}
              onChange={e => setField('activities', e.target.value)}
            />
          </div>

          {/* Evaluation */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-600 font-sarabun">วิธีวัดผลและประเมินผล</label>
            <input
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-sarabun focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="เช่น ตรวจแบบฝึกหัดท้ายบท, สังเกตพฤติกรรม"
              value={form.evaluationMethod}
              onChange={e => setField('evaluationMethod', e.target.value)}
            />
          </div>

          {/* Materials */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-600 font-sarabun">สื่อและแหล่งเรียนรู้</label>
              <button onClick={addMaterial}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors font-sarabun">
                <Plus size={12} /> เพิ่มสื่อ
              </button>
            </div>
            {form.materials.map((mat, i) => (
              <div key={i} className="flex gap-2 items-start p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <select
                  className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-sarabun shrink-0"
                  value={mat.type}
                  onChange={e => setMaterial(i, { type: e.target.value as MaterialType })}
                >
                  {MATERIAL_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <div className="flex-1 space-y-1.5">
                  <input
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-sarabun focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="ชื่อสื่อ"
                    value={mat.name}
                    onChange={e => setMaterial(i, { name: e.target.value })}
                  />
                  <input
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-sarabun focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    placeholder="URL หรือที่อยู่ไฟล์"
                    value={mat.url}
                    onChange={e => setMaterial(i, { url: e.target.value })}
                  />
                </div>
                <button onClick={() => removeMaterial(i)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {form.materials.length === 0 && (
              <p className="text-xs text-slate-400 font-sarabun text-center py-2">ยังไม่มีสื่อการสอน</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 px-6 py-4 border-t border-white/60"
          style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(12px)', borderRadius: '0 0 1.5rem 1.5rem' }}>
          <button onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors font-sarabun">
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim() || !form.courseId.trim()}
            className="px-6 py-2 rounded-xl text-sm font-bold text-white transition-all font-sarabun disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {saving ? 'กำลังบันทึก...' : initial ? 'บันทึกการแก้ไข' : 'สร้างแผนการสอน'}
          </button>
        </div>
      </div>
    </div>
  );
}
