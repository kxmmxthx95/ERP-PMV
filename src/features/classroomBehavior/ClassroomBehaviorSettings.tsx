import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { HiCog6Tooth } from 'react-icons/hi2';
import { Dialog, DialogContent, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useCurriculum } from '@/hooks/useCurriculum';
import { useCurriculumVersioned } from '@/hooks/useCurriculumVersioned';
import { useClassroomBehaviorConfig } from '@/hooks/useClassroomBehaviorConfig';
import { logActivity } from '@/lib/activityLogger';
import { HEADER_ICON_BTN } from '@/lib/headerIconBtn';
import { SUBJECT_GROUP_CONFIG, type SubjectGroupId } from '@/types/curriculum';
import { subjectKey } from '@/types/classroomBehavior';

type Item = { name: string; group: SubjectGroupId };

const groupOf = (g?: string): SubjectGroupId => (g && g in SUBJECT_GROUP_CONFIG ? (g as SubjectGroupId) : 'other');

/** Header gear: admin picks subjects that don't need classroom-behavior rating (school-wide). */
export default function ClassroomBehaviorSettings() {
  const { excluded, save } = useClassroomBehaviorConfig();
  const curriculum = useCurriculum();
  const { versions, coursesByVersion, loadCoursesForVersion } = useCurriculumVersioned();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);

  // Load every version's courses once the dialog opens (admin-only, on demand).
  useEffect(() => {
    if (!open) return;
    for (const v of versions) if (!coursesByVersion[v.id]) void loadCoursesForVersion(v.id);
  }, [open, versions, coursesByVersion, loadCoursesForVersion]);

  const items = useMemo(() => {
    const m = new Map<string, Item>();
    const add = (name: string, group?: string) => {
      const k = subjectKey(name);
      if (k && !m.has(k)) m.set(k, { name: k, group: groupOf(group) });
    };
    for (const s of curriculum.subjects) if (s.category !== 'activity') add(s.name, s.subjectGroup);
    for (const c of Object.values(coursesByVersion).flat()) {
      if (c.category === 'basic' || c.category === 'additional') add(c.courseName, c.subjectGroup);
    }
    for (const k of excluded) add(k); // keep already-excluded names uncheckable even if the course vanished
    return [...m.values()];
  }, [curriculum.subjects, coursesByVersion, excluded]);

  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const byGroup = new Map<SubjectGroupId, Item[]>();
    for (const it of items) {
      if (needle && !it.name.toLowerCase().includes(needle)) continue;
      byGroup.set(it.group, [...(byGroup.get(it.group) ?? []), it]);
    }
    return [...byGroup.entries()]
      .sort(([a], [b]) => SUBJECT_GROUP_CONFIG[a].order - SUBJECT_GROUP_CONFIG[b].order)
      .map(([g, list]) => [g, list.sort((a, b) => a.name.localeCompare(b.name, 'th'))] as const);
  }, [items, q]);

  const toggle = (name: string) =>
    setDraft((d) => {
      const next = new Set(d);
      if (!next.delete(name)) next.add(name);
      return next;
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      const list = [...draft].sort((a, b) => a.localeCompare(b, 'th'));
      await save(list);
      logActivity({ action: 'classroom_behavior_settings', category: 'data', targetId: 'classroomBehavior', detail: `ไม่ต้องประเมิน ${list.length} วิชา` });
      toast.success('บันทึกการตั้งค่าแล้ว');
      setOpen(false);
    } catch {
      toast.error('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) { setDraft(new Set(excluded)); setQ(''); }
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className={HEADER_ICON_BTN} title="ตั้งค่าวิชาที่ไม่ต้องประเมิน" aria-label="ตั้งค่าวิชาที่ไม่ต้องประเมิน">
          <HiCog6Tooth size={16} />
        </button>
      </DialogTrigger>
      <DialogContent className="w-[92vw] sm:max-w-lg rounded-2xl border-none p-0 shadow-2xl overflow-hidden">
        <div className="flex max-h-[90vh] flex-col">
          <div className="px-6 sm:px-8 pt-6 sm:pt-8 pb-2">
            <DialogTitle className="text-lg sm:text-xl font-black tracking-tight">วิชาที่ไม่ต้องประเมิน</DialogTitle>
            <p className="mt-1 text-xs text-muted-foreground">ติ๊กวิชาที่ไม่ต้องประเมินพฤติกรรม มีผลกับทุกห้อง ผลที่บันทึกไว้เดิมไม่ถูกลบ</p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 sm:px-8 py-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 pl-1">ค้นหาวิชา</label>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ชื่อวิชา" className="h-10 rounded-xl border-none bg-slate-50/70 text-xs font-bold" />
            </div>
            {sections.map(([g, list]) => (
              <div key={g} className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-600 pl-1">{SUBJECT_GROUP_CONFIG[g].name}</p>
                {list.map((it) => (
                  <label key={it.name} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold hover:bg-muted/40">
                    <Checkbox checked={draft.has(it.name)} onCheckedChange={() => toggle(it.name)} />
                    <span className="min-w-0 truncate">{it.name}</span>
                  </label>
                ))}
              </div>
            ))}
            {!sections.length && <p className="py-6 text-center text-sm text-muted-foreground">ไม่พบวิชา</p>}
          </div>
          <DialogFooter className="px-6 sm:px-8 pt-4 pb-6 sm:pb-8 border-t border-border">
            <Button type="button" className="w-full rounded-xl font-bold h-10" disabled={saving} onClick={handleSave}>
              {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
