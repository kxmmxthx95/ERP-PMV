import { useMemo, useRef, useState } from 'react';
import { HiOutlineArrowUpTray, HiOutlineEye, HiOutlineMagnifyingGlass, HiOutlineTrash } from 'react-icons/hi2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  matchesUniversitySearch,
  type ThaiUniversity,
} from '@/data/thaiUniversities';
import {
  useUniversityLogoMap,
  useUniversityLogoMutations,
} from '@/hooks/useUniversityLogos';
import { findMytcasForThaiUniversity } from '@/data/universityBridge';
import { usePickerUniversities } from '@/hooks/usePickerUniversities';
import { UniversityLogo } from '@/features/futurePlan/components/UniversityLogo';
import { toast } from 'sonner';

interface UniversityLogoSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UniversityLogoSettingsModal({
  open,
  onOpenChange,
}: UniversityLogoSettingsModalProps) {
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<ThaiUniversity | null>(null);
  const [previewUni, setPreviewUni] = useState<ThaiUniversity | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: logoMap } = useUniversityLogoMap();
  const { upload, remove } = useUniversityLogoMutations();
  const { pickerUniversities, isLoading: catalogLoading, mytcasUniversities } = usePickerUniversities();

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return pickerUniversities;
    return pickerUniversities.filter((u) => matchesUniversitySearch(u, q));
  }, [pickerUniversities, search]);

  const handlePickFile = (uni: ThaiUniversity) => {
    setPending(uni);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pending) return;

    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพ');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('ไฟล์ใหญ่เกิน 5 MB');
      return;
    }

    try {
      await upload.mutateAsync({
        domain: pending.domain,
        name: pending.nameTh || pending.name,
        file,
      });
      toast.success(`อัปโหลด Logo ${pending.nameTh || pending.name} เรียบร้อย`);
    } catch {
      toast.error('อัปโหลดไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setPending(null);
    }
  };

  const handleRemove = async (uni: ThaiUniversity) => {
    try {
      await remove.mutateAsync({
        domain: uni.domain,
        name: uni.nameTh || uni.name,
      });
      toast.success('ลบ Logo ที่อัปโหลดแล้ว');
    } catch {
      toast.error('ลบไม่สำเร็จ');
    }
  };

  const isBusy = upload.isPending || remove.isPending;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            'w-full border-none p-0 shadow-2xl overflow-hidden',
            'max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:left-0 max-sm:right-0',
            'max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-none',
            'max-sm:rounded-t-[1.75rem] max-sm:rounded-b-none max-sm:h-[92dvh] max-sm:max-h-[92dvh]',
            'sm:w-[92vw] sm:max-w-2xl sm:rounded-[2.5rem]',
          )}
          style={{
            background: 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          }}
        >
          <div className="flex h-full max-sm:h-[92dvh] sm:max-h-[90vh] flex-col">
            <div className="shrink-0 px-5 sm:px-8 pt-5 sm:pt-8 pb-2 sm:pb-3">
              <DialogTitle className="text-base sm:text-xl font-black text-slate-800 tracking-tight pr-10 leading-snug">
                ตั้งค่า Logo มหาวิทยาลัย
              </DialogTitle>
            </div>

            <div className="shrink-0 px-5 sm:px-8 pb-3">
              <div className="relative">
                <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหามหาวิทยาลัย..."
                  className="h-11 sm:h-10 pl-9 rounded-xl bg-slate-50/70 border-none text-sm font-medium"
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-2 custom-scrollbar space-y-2.5 sm:space-y-2">
              {catalogLoading && pickerUniversities.length <= 67 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-7 h-7 border-2 border-[#E3E7FC] border-t-[#0056FF] rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-8">ไม่พบมหาวิทยาลัย</p>
              ) : (
                filtered.map((uni) => {
                  const hasCustom = logoMap?.has(uni.domain);
                  const cardClass = cn(
                    'rounded-2xl border p-3 sm:p-3 transition-colors',
                    hasCustom
                      ? 'bg-emerald-50/50 border-emerald-100/80'
                      : 'bg-white/40 border-white/30',
                  );
                  const actionButtons = (
                    <>
                      <button
                        type="button"
                        onClick={() => setPreviewUni(uni)}
                        className="flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-xl sm:rounded-lg text-slate-500 hover:bg-slate-100 transition-colors active:scale-95"
                        title="ดูตัวอย่าง Logo"
                      >
                        <HiOutlineEye className="w-4 h-4" />
                      </button>
                      {hasCustom && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleRemove(uni)}
                          className="flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-xl sm:rounded-lg text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50 active:scale-95"
                          title="ลบ Logo ที่อัปโหลด"
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handlePickFile(uni)}
                        className="flex h-10 sm:h-8 flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl sm:rounded-lg bg-slate-900 text-white px-4 sm:px-3 text-xs sm:text-[11px] font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 active:scale-95"
                      >
                        <HiOutlineArrowUpTray className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        {hasCustom ? 'เปลี่ยน' : 'อัปโหลด'}
                      </button>
                    </>
                  );

                  return (
                    <div key={uni.domain} className={cardClass}>
                      <div className="flex items-center gap-3">
                        <UniversityLogo domain={uni.domain} label={uni.nameTh} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 leading-snug line-clamp-2 sm:truncate">
                            {uni.nameTh || uni.name}
                          </p>
                          {uni.domain && (
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{uni.domain}</p>
                          )}
                        </div>
                        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                          {actionButtons}
                        </div>
                      </div>
                      <div className="flex sm:hidden items-center gap-2 mt-3 pt-3 border-t border-slate-100/70">
                        {actionButtons}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <DialogFooter className="shrink-0 px-5 sm:px-8 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-white/20 sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="w-full sm:w-auto rounded-xl font-bold text-slate-500 h-11 sm:h-10 bg-slate-50/80 sm:bg-transparent hover:bg-slate-100/80"
              >
                ปิด
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewUni != null} onOpenChange={(next) => !next && setPreviewUni(null)}>
        <DialogContent
          className={cn(
            'w-full border-none p-0 shadow-2xl overflow-hidden',
            'max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:left-0 max-sm:right-0',
            'max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-none',
            'max-sm:rounded-t-[1.75rem] max-sm:rounded-b-none',
            'sm:w-[92vw] sm:max-w-sm sm:rounded-[2rem]',
          )}
          style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          }}
        >
          {previewUni && (
            <div className="flex flex-col items-center px-5 sm:px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] gap-4">
              <DialogTitle className="text-base font-black text-slate-800 text-center leading-snug px-6">
                {previewUni.nameTh || previewUni.name}
              </DialogTitle>
              {previewUni.domain && (
                <DialogDescription className="text-[11px] text-slate-400 text-center -mt-2">
                  {previewUni.domain}
                </DialogDescription>
              )}

              <div className="flex items-center justify-center w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-white border border-[#E3E7FC] shadow-sm">
                <UniversityLogo
                  university={previewUni}
                  domain={previewUni.domain}
                  label={previewUni.nameTh}
                  size="lg"
                  className="w-20 h-20 sm:w-24 sm:h-24"
                />
              </div>

              <p className="text-[11px] font-medium text-slate-500 text-center px-2">
                {previewUni.domain && logoMap?.has(previewUni.domain)
                  ? 'แสดง Logo ที่อัปโหลดแล้ว'
                  : findMytcasForThaiUniversity(previewUni, mytcasUniversities)
                    ? 'แสดง Logo จาก MyTCAS'
                    : 'แสดง Logo จาก Google'}
              </p>

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 w-full pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreviewUni(null)}
                  className="flex-1 rounded-xl font-bold h-11 sm:h-10"
                >
                  ปิด
                </Button>
                <Button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    handlePickFile(previewUni);
                    setPreviewUni(null);
                  }}
                  className="flex-1 rounded-xl bg-slate-900 text-white font-bold h-11 sm:h-10 hover:bg-slate-800"
                >
                  {logoMap?.has(previewUni.domain) ? 'เปลี่ยน Logo' : 'อัปโหลด Logo'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
