import { useState } from 'react';
import { toast } from 'sonner';
import { HiOutlinePlus, HiOutlinePencilSquare } from 'react-icons/hi2';
import FormModal, {
  SettingsGroup,
  SettingsRow,
  modalLabelCls,
  modalInputCls,
  modalSelectCls,
} from '@/components/ui/FormModal';
import { useBehaviorCatalog, useBehaviorCatalogActions } from '@/hooks/useBehaviorScore';
import type { BehaviorTemplate, BehaviorType, BehaviorSeverity, NewBehaviorTemplate } from '@/types/behavior';
import { cn } from '@/lib/utils';
import {
  BEHAVIOR_SEVERITY_OPTIONS,
  behaviorSeverityBadgeClass,
  getBehaviorSeverityLabel,
} from '../utils/behaviorSeverity';

interface BehaviorCatalogManagerProps {
  open: boolean;
  onClose: () => void;
}

const EMPTY_FORM: NewBehaviorTemplate = {
  label: '',
  points: 5,
  type: 'positive',
  isActive: true,
  order: 0,
};

export default function BehaviorCatalogManager({ open, onClose }: BehaviorCatalogManagerProps) {
  const { templates, loading, refresh } = useBehaviorCatalog();
  const { createTemplate, updateTemplate, toggleActive } = useBehaviorCatalogActions();

  const [editing, setEditing] = useState<BehaviorTemplate | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewBehaviorTemplate>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function openCreateForm() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(t: BehaviorTemplate) {
    setEditing(t);
    setForm({
      label: t.label,
      points: t.points,
      type: t.type,
      severity: t.type === 'negative' ? (t.severity ?? 'medium') : undefined,
      isActive: t.isActive,
      order: t.order,
    });
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!form.label.trim()) {
      toast.error('กรุณากรอกชื่อรายการ');
      return;
    }
    const signedPoints = form.type === 'positive' ? Math.abs(form.points) : -Math.abs(form.points);
    const payload: NewBehaviorTemplate = {
      ...form,
      points: signedPoints,
      severity: form.type === 'negative' ? (form.severity ?? 'medium') : undefined,
    };
    setSaving(true);
    try {
      if (editing) {
        await updateTemplate(editing.id, payload);
        toast.success('แก้ไขรายการพฤติกรรมแล้ว');
      } else {
        await createTemplate(payload);
        toast.success('เพิ่มรายการพฤติกรรมแล้ว');
      }
      setShowForm(false);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(t: BehaviorTemplate) {
    try {
      await toggleActive(t.id, !t.isActive);
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'อัปเดตไม่สำเร็จ');
    }
  }

  const positiveTemplates = templates.filter((t) => t.type === 'positive');
  const negativeTemplates = templates.filter((t) => t.type === 'negative');

  return (
    <>
      <FormModal
        open={open && !showForm}
        onClose={onClose}
        title="จัดการรายการพฤติกรรม"
        subtitle="กำหนดรายการและคะแนนที่ครูสามารถบันทึกได้"
        onSubmit={openCreateForm}
        submitLabel="เพิ่มรายการ"
        showCancel={true}
        maxWidth="lg"
      >
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <SettingsGroup label="ความดี (คะแนนบวก)">
              {positiveTemplates.length === 0 && (
                <div className="px-8 py-4 text-sm text-slate-400">ยังไม่มีรายการ</div>
              )}
              {positiveTemplates.map((t) => (
                <SettingsRow key={t.id} label={t.label} noChevron>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-emerald-600">+{t.points}</span>
                    <button onClick={() => openEditForm(t)} className="text-slate-400 hover:text-slate-700">
                      <HiOutlinePencilSquare size={16} />
                    </button>
                    <button
                      onClick={() => handleToggle(t)}
                      className={cn(
                        'text-[11px] font-bold px-2 py-1 rounded-lg',
                        t.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400',
                      )}
                    >
                      {t.isActive ? 'ใช้งาน' : 'ปิดอยู่'}
                    </button>
                  </div>
                </SettingsRow>
              ))}
            </SettingsGroup>

            <SettingsGroup label="ผิดระเบียบ (คะแนนลบ)">
              {negativeTemplates.length === 0 && (
                <div className="px-8 py-4 text-sm text-slate-400">ยังไม่มีรายการ</div>
              )}
              {negativeTemplates.map((t) => (
                <SettingsRow key={t.id} label={t.label} noChevron>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'rounded-md border px-1.5 py-0.5 text-[10px] font-black',
                        behaviorSeverityBadgeClass(t.severity),
                      )}
                    >
                      {getBehaviorSeverityLabel(t.severity)}
                    </span>
                    <span className="text-sm font-black text-rose-600">{t.points}</span>
                    <button onClick={() => openEditForm(t)} className="text-slate-400 hover:text-slate-700">
                      <HiOutlinePencilSquare size={16} />
                    </button>
                    <button
                      onClick={() => handleToggle(t)}
                      className={cn(
                        'text-[11px] font-bold px-2 py-1 rounded-lg',
                        t.isActive ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400',
                      )}
                    >
                      {t.isActive ? 'ใช้งาน' : 'ปิดอยู่'}
                    </button>
                  </div>
                </SettingsRow>
              ))}
            </SettingsGroup>
          </>
        )}
      </FormModal>

      <FormModal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'แก้ไขรายการพฤติกรรม' : 'เพิ่มรายการพฤติกรรม'}
        icon={<HiOutlinePlus size={16} />}
        onSubmit={handleSubmit}
        submitLabel={saving ? 'กำลังบันทึก...' : 'บันทึก'}
        submitDisabled={saving}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className={modalLabelCls}>ชื่อรายการ</label>
            <input
              className={modalInputCls}
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="เช่น มาสาย"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={modalLabelCls}>ประเภท</label>
              <select
                className={modalSelectCls}
                value={form.type}
                onChange={(e) => {
                  const type = e.target.value as BehaviorType;
                  setForm((f) => ({
                    ...f,
                    type,
                    severity: type === 'negative' ? (f.severity ?? 'medium') : undefined,
                  }));
                }}
              >
                <option value="positive">ความดี (+)</option>
                <option value="negative">ผิดระเบียบ (-)</option>
              </select>
            </div>
            <div>
              <label className={modalLabelCls}>คะแนน</label>
              <input
                type="number"
                min={1}
                className={modalInputCls}
                value={Math.abs(form.points)}
                onChange={(e) => setForm((f) => ({ ...f, points: Number(e.target.value) || 0 }))}
              />
            </div>
          </div>
          {form.type === 'negative' && (
            <div>
              <label className={modalLabelCls}>ความรุนแรง</label>
              <select
                className={modalSelectCls}
                value={form.severity ?? 'medium'}
                onChange={(e) => setForm((f) => ({
                  ...f,
                  severity: e.target.value as BehaviorSeverity,
                }))}
              >
                {BEHAVIOR_SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </FormModal>
    </>
  );
}
