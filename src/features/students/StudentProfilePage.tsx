import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Loader2 } from 'lucide-react';
import { HiUser, HiUsers, HiMapPin, HiCheckCircle, HiExclamationCircle } from 'react-icons/hi2';
import { useAuth } from '@/hooks/useAuth';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { resolveStudentByAuthUser } from '@/lib/resolveStudentProfile';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Student } from '@/types/student';
import { useNamePrefix } from '@/hooks/useNamePrefix';
import { checkStudentCompletion } from '@/utils/studentValidation';
import { StudentDetailFormTab, type StudentDetailTab } from '@/features/students/components/StudentDetailFormTab';
import { getInitials } from '@/features/profile/profileLayoutShared';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

type AlertPopup = {
  open: boolean;
  variant: 'success' | 'error';
  title: string;
  description?: string;
};

const STATUS_LABEL: Record<string, string> = {
  active: 'กำลังศึกษา',
  inactive: 'พักการศึกษา',
  graduated: 'จบการศึกษา',
  transferred: 'ย้ายออก',
};

const STATUS_COLOR: Record<string, string> = {
  active: '#10b981',
  inactive: '#f59e0b',
  graduated: '#6366f1',
  transferred: '#94a3b8',
};

const TAB_META: { id: StudentDetailTab; label: string; icon: typeof HiUser }[] = [
  { id: 'personal', label: 'ข้อมูลส่วนตัว', icon: HiUser },
  { id: 'family', label: 'ครอบครัว', icon: HiUsers },
  { id: 'map', label: 'แผนที่บ้าน', icon: HiMapPin },
];

function StudentProfilePage() {
  const { user, userData } = useAuth();
  const { prefixes: adultPrefixes } = useNamePrefix('adult');

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tab, setTab] = useState<StudentDetailTab>('personal');
  const [data, setData] = useState<Student | null>(null);
  const [form, setForm] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);
  const [alertPopup, setAlertPopup] = useState<AlertPopup>({
    open: false,
    variant: 'success',
    title: '',
  });

  const showAlert = (variant: AlertPopup['variant'], title: string, description?: string) => {
    setAlertPopup({ open: true, variant, title, description });
  };

  useEffect(() => {
    async function fetch() {
      if (!user?.uid) return;
      try {
        const resolved = await resolveStudentByAuthUser(user.uid, {
          studentCode: typeof userData?.studentCode === 'string' ? userData.studentCode : undefined,
          email: user.email ?? undefined,
        });
        if (resolved) {
          setData(resolved);
          setForm(resolved);
        } else {
          showAlert('error', 'ไม่พบข้อมูลนักเรียน', 'ไม่พบข้อมูลนักเรียนของคุณในระบบ');
        }
      } catch {
        showAlert('error', 'โหลดข้อมูลล้มเหลว', 'กรุณาลองใหม่อีกครั้ง');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [user, userData?.studentCode, user?.email]);

  const set = (key: keyof Student, value: unknown) =>
    setForm(prev => (prev ? { ...prev, [key]: value } : null));

  const performSave = async (formData: Student) => {
    if (!user?.uid || !formData.id) return;
    const studentDocId = formData.id;
    try {
      const { id: _id, ...fields } = formData as Student & { id: string };

      const addressSummary = [
        fields.address_houseNo && `บ้านเลขที่ ${fields.address_houseNo}`,
        fields.address_moo && `หมู่ ${fields.address_moo}`,
        fields.address_village && `หมู่บ้าน/อาคาร ${fields.address_village}`,
        fields.address_street && `ถนน ${fields.address_street}`,
        fields.address_subdistrict && `ต./แขวง ${fields.address_subdistrict}`,
        fields.address_district && `อ./เขต ${fields.address_district}`,
        fields.address_province && `จ.${fields.address_province}`,
        fields.address_postalCode,
      ]
        .filter(Boolean)
        .join(' ');

      const cleanFields = Object.keys(fields).reduce((acc: Record<string, unknown>, key) => {
        const val = fields[key as keyof typeof fields];
        if (val !== undefined) acc[key] = val;
        return acc;
      }, {});

      cleanFields.address = addressSummary;
      cleanFields.authUid = user.uid;
      cleanFields.userId = user.uid;

      await updateDoc(doc(db, 'students', studentDocId), cleanFields);

      const userPatch = Object.fromEntries(
        Object.entries({
          firstName: cleanFields.firstName,
          lastName: cleanFields.lastName,
          prefix: cleanFields.prefix,
          email: cleanFields.email,
          phone: cleanFields.phone,
          photoURL: cleanFields.photoURL,
          studentCode: cleanFields.studentCode,
          name: `${cleanFields.prefix}${cleanFields.firstName} ${cleanFields.lastName}`,
        }).filter(([, value]) => value !== undefined),
      );
      await updateDoc(doc(db, 'users', user.uid), userPatch);
      setData(formData);
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form?.id) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `students/${form.id}/photo`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      set('photoURL', url);
    } catch {
      showAlert('error', 'อัปโหลดรูปไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setUploading(false);
    }
  };

  const toggleEditMode = async () => {
    if (isEditMode && form) {
      const isChanged = JSON.stringify(form) !== JSON.stringify(data);
      if (isChanged) {
        setSaving(true);
        try {
          await performSave(form);
          showAlert('success', 'บันทึกเรียบร้อย', 'ข้อมูลของคุณถูกบันทึกแล้ว');
        } catch {
          showAlert('error', 'บันทึกไม่สำเร็จ', 'กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่');
          return;
        } finally {
          setSaving(false);
        }
      }
      setIsEditMode(false);
      return;
    }
    setIsEditMode(true);
  };

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <p className="text-sm font-bold uppercase tracking-widest text-slate-400">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  if (!data || !form) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-white px-4">
        <p className="font-bold text-slate-400">ไม่พบข้อมูลนักเรียน</p>
      </div>
    );
  }

  const displayName = `${data.prefix}${data.firstName} ${data.lastName}`.trim();
  const email = form.email || user?.email || '-';
  const photoURL = form.photoURL || '';
  const completion = checkStudentCompletion(form);
  const activeTabMeta = TAB_META.find(t => t.id === tab)!;

  return (
    <>
    <div className="h-full w-full overflow-y-auto bg-white px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-lg space-y-5">
          <header className="flex flex-col items-center pt-2 pb-1 text-center">
            <div className="relative">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="h-24 w-24 rounded-full object-cover ring-4 ring-slate-100"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 text-2xl font-black text-slate-500 ring-4 ring-slate-50">
                  {getInitials(displayName)}
                </div>
              )}
              {isEditMode && (
                <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded-full bg-black/40 backdrop-blur-[2px]">
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  ) : (
                    <Camera className="h-5 w-5 text-white" />
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
                </label>
              )}
            </div>

            <h1 className="mt-4 max-w-full break-words text-2xl font-black text-slate-900">{displayName}</h1>
            <p className="mt-1 max-w-full break-all text-sm font-medium text-slate-400">{email}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-bold text-blue-600">รหัส {data.studentCode}</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: STATUS_COLOR[data.status] || '#94a3b8' }}
                />
                {STATUS_LABEL[data.status] || 'ไม่ทราบสถานะ'}
              </span>
              {!completion.isComplete && (
                <span className="rounded-full border border-rose-100 bg-rose-50 px-2 py-0.5 text-[11px] font-black text-rose-600">
                  ข้อมูลไม่ครบ
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
                <span className="text-[11px] font-black text-slate-500">
                  {isEditMode ? 'ปิดเพื่อบันทึก' : 'แก้ไขข้อมูล'}
                </span>
                <Switch
                  checked={isEditMode}
                  disabled={saving}
                  aria-label={isEditMode ? 'ปิดโหมดแก้ไขและบันทึก' : 'เปิดโหมดแก้ไขข้อมูล'}
                  onCheckedChange={() => void toggleEditMode()}
                  className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-300"
                />
                {saving && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600" />}
              </label>
            </div>
          </header>

          <div className="flex rounded-2xl bg-slate-100/90 p-1">
            {TAB_META.map(t => {
              const Icon = t.icon;
              const active = tab === t.id;
              const incomplete = !completion.categories[t.id];

              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-black transition-all sm:text-xs',
                    active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{t.label}</span>
                  {incomplete && (
                    <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500" />
                  )}
                </button>
              );
            })}
          </div>

          <section className="rounded-3xl bg-slate-50/90 p-4 sm:p-5">
            <h2 className="text-sm font-black text-slate-900">{activeTabMeta.label}</h2>
            <div className="mt-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tab + (isEditMode ? '-edit' : '-view')}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <StudentDetailFormTab
                    tab={tab}
                    viewData={data}
                    formData={form}
                    isEditMode={isEditMode}
                    onChange={set}
                    guardianPrefixes={adultPrefixes}
                    studentId={form.id}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </section>
        </div>
    </div>

    <Dialog open={alertPopup.open} onOpenChange={open => setAlertPopup(prev => ({ ...prev, open }))}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader className="items-center text-center">
          <div
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full',
              alertPopup.variant === 'success'
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-rose-100 text-rose-600',
            )}
          >
            {alertPopup.variant === 'success' ? (
              <HiCheckCircle className="h-7 w-7" />
            ) : (
              <HiExclamationCircle className="h-7 w-7" />
            )}
          </div>
          <DialogTitle
            className={cn(
              'text-lg font-black',
              alertPopup.variant === 'success' ? 'text-emerald-600' : 'text-rose-600',
            )}
          >
            {alertPopup.title}
          </DialogTitle>
          {alertPopup.description ? (
            <DialogDescription className="text-sm text-slate-600">{alertPopup.description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <Button
          type="button"
          className="w-full rounded-2xl font-bold"
          onClick={() => setAlertPopup(prev => ({ ...prev, open: false }))}
        >
          ตกลง
        </Button>
      </DialogContent>
    </Dialog>
    </>
  );
}

export default StudentProfilePage;
