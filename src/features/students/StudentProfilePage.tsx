import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, MapPin, Users, ArrowLeft,
  Camera, Loader2, ClipboardList, Trash2, Plus, Info, X, GraduationCap, AlertCircle, Navigation
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import type { Student, BloodType } from '@/types/student';
import { useNamePrefix } from '@/hooks/useNamePrefix';
import { useStudentManager } from '@/hooks/useStudentManager';
import { ThaiAddressInputGroup } from '@/components/ThaiAddressInputGroup';
import { checkStudentCompletion } from '@/utils/studentValidation';

type ProfileTab = 'personal' | 'academic' | 'family' | 'address';

const calcAge = (birthDate?: string) => {
  if (!birthDate) return undefined;
  const birth = new Date(birthDate);
  const today = new Date();
  return today.getFullYear() - birth.getFullYear();
};

const F = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div className="space-y-1">
    <label className="text-[11px] md:text-[12px] font-black text-slate-700">
      {label} {required && <span className="text-rose-500">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = "w-full h-8 md:h-9 px-3 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none focus:border-blue-500 transition-all";
const viewCls  = "w-full min-h-[32px] md:min-h-[36px] px-3 py-1.5 md:py-2 bg-slate-50 border border-transparent rounded-lg text-[13px] font-bold text-slate-600 break-words flex items-center";

const GoogleMapPicker = ({ lat, lng, onChange, isEditMode }: { lat?: number, lng?: number, onChange: (lat: number, lng: number) => void, isEditMode: boolean }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
    if (!apiKey) return;

    const initMap = () => {
      if (!mapRef.current || !(window as any).google) return;
      const center = { lat: lat || 13.7563, lng: lng || 100.5018 };
      
      if (!googleMapRef.current) {
        const map = new (window as any).google.maps.Map(mapRef.current, {
          center,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        googleMapRef.current = map;

        const marker = new (window as any).google.maps.Marker({
          position: center,
          map,
          draggable: isEditMode,
        });
        markerRef.current = marker;

        marker.addListener('dragend', () => {
          const pos = marker.getPosition();
          onChange(pos.lat(), pos.lng());
        });

        map.addListener('click', (e: any) => {
          if (!isEditMode) return;
          marker.setPosition(e.latLng);
          onChange(e.latLng.lat(), e.latLng.lng());
        });
      } else {
        markerRef.current?.setDraggable(isEditMode);
      }
    };

    const existingScript = document.querySelector('script[src^="https://maps.googleapis.com/maps/api/js"]');

    if (!(window as any).google) {
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
        script.async = true;
        script.defer = true;
        script.onload = initMap;
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener('load', initMap);
      }
    } else {
      initMap();
    }

    return () => {
      if (existingScript) {
        existingScript.removeEventListener('load', initMap);
      }
    };
  }, [isEditMode]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('เบราว์เซอร์ของคุณไม่รองรับการระบุตำแหน่ง');
      return;
    }

    const loadingToast = toast.loading('กำลังระบุตำแหน่งปัจจุบัน...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onChange(latitude, longitude);
        if (googleMapRef.current && markerRef.current) {
          const newPos = { lat: latitude, lng: longitude };
          markerRef.current.setPosition(newPos);
          googleMapRef.current.setCenter(newPos);
          googleMapRef.current.setZoom(17);
        }
        toast.dismiss(loadingToast);
        toast.success('ระบุตำแหน่งปัจจุบันสำเร็จ');
      },
      (error) => {
        toast.dismiss(loadingToast);
        let msg = 'ไม่สามารถดึงตำแหน่งปัจจุบันได้';
        if (error.code === error.PERMISSION_DENIED) msg = 'โปรดอนุญาตการเข้าถึงตำแหน่งที่ตั้ง';
        else if (error.code === error.TIMEOUT) msg = 'การระบุตำแหน่งใช้เวลานานเกินไป';
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    if (markerRef.current && lat && lng) {
      const currentPos = markerRef.current.getPosition();
      if (currentPos.lat() !== lat || currentPos.lng() !== lng) {
        const newPos = { lat, lng };
        markerRef.current.setPosition(newPos);
        googleMapRef.current?.setCenter(newPos);
      }
    }
  }, [lat, lng]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-100 shadow-inner group">
      <div ref={mapRef} className="w-full h-full min-h-[300px] bg-slate-50" />
      {isEditMode && (
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm hover:bg-white text-blue-600 px-3 py-2 rounded-xl shadow-lg border border-blue-50 flex items-center gap-2 text-[12px] font-black transition-all active:scale-95"
        >
          <Navigation size={14} className="fill-blue-600/10" />
          ใช้ตำแหน่งปัจจุบัน
        </button>
      )}
    </div>
  );
};

function StudentProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { prefixes: studentPrefixes } = useNamePrefix('student');
  const { prefixes: adultPrefixes } = useNamePrefix('adult');

  const [loading, setLoading]     = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [modalMember, setModalMember] = useState<any>(null);
  const [tab, setTab]             = useState<ProfileTab>('personal');
  const [data, setData]           = useState<Student | null>(null);
  const [form, setForm]           = useState<Student | null>(null);

  useEffect(() => {
    async function fetch() {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, 'students', user.uid));
        if (snap.exists()) {
          const s = { id: snap.id, ...snap.data() } as Student;
          setData(s); setForm(s);
        } else {
          toast.error('ไม่พบข้อมูลนักเรียนของคุณในระบบ');
        }
      } catch { toast.error('โหลดข้อมูลล้มเหลว'); }
      finally   { setLoading(false); }
    }
    fetch();
  }, [user]);

  const set = (key: keyof Student, value: any) =>
    setForm(prev => prev ? { ...prev, [key]: value } : null);

  const addFamilyMember = () => {
    const newMember = { id: Date.now().toString(), prefix: '', firstName: '', lastName: '', relation: '', age: 0, occupation: '', income: 0 };
    setModalMember(newMember);
    setShowFamilyModal(true);
  };

  const editFamilyMember = (member: any) => {
    setModalMember({ ...member });
    setShowFamilyModal(true);
  };

  const saveModalMember = () => {
    if (!modalMember || !form) return;
    const currentMembers = form.familyMembers || [];
    const exists = currentMembers.find(m => m.id === modalMember.id);
    let newMembers;
    if (exists) {
      newMembers = currentMembers.map(m => m.id === modalMember.id ? modalMember : m);
    } else {
      newMembers = [...currentMembers, modalMember];
    }
    set('familyMembers', newMembers);
    setShowFamilyModal(false);
    setModalMember(null);
  };

  const removeFamilyMember = (id: string) => {
    if (!form) return;
    set('familyMembers', (form.familyMembers || []).filter(m => m.id !== id));
  };
  const performSave = async (formData: Student) => {
    if (!user?.uid) return;
    try {
      const { id: _id, ...fields } = formData as any;
      
      // Generate a summary for the main 'address' field to keep it in sync
      const addressSummary = [
        fields.address_houseNo && `บ้านเลขที่ ${fields.address_houseNo}`,
        fields.address_moo && `หมู่ ${fields.address_moo}`,
        fields.address_village && `หมู่บ้าน/อาคาร ${fields.address_village}`,
        fields.address_street && `ถนน ${fields.address_street}`,
        fields.address_subdistrict && `ต./แขวง ${fields.address_subdistrict}`,
        fields.address_district && `อ./เขต ${fields.address_district}`,
        fields.address_province && `จ.${fields.address_province}`,
        fields.address_postalCode
      ].filter(Boolean).join(' ');

      const cleanFields = Object.keys(fields).reduce((acc: any, key) => {
        if (fields[key] !== undefined) acc[key] = fields[key];
        return acc;
      }, {});

      // Always update the main address summary
      cleanFields.address = addressSummary;

      await updateDoc(doc(db, 'students', user.uid), cleanFields);
      await updateDoc(doc(db, 'users', user.uid), {
        firstName: cleanFields.firstName, lastName: cleanFields.lastName,
        prefix: cleanFields.prefix, email: cleanFields.email,
        phone: cleanFields.phone, photoURL: cleanFields.photoURL,
        studentCode: cleanFields.studentCode,
        name: `${cleanFields.prefix}${cleanFields.firstName} ${cleanFields.lastName}`,
      });
      setData(formData);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!isEditMode || !form || !data) return;
    
    // Simple check to avoid saving if no changes
    const isChanged = JSON.stringify(form) !== JSON.stringify(data);
    if (!isChanged) return;

    const timer = setTimeout(() => {
      performSave(form);
    }, 2000);

    return () => clearTimeout(timer);
  }, [form, isEditMode]);


  const { students } = useStudentManager();

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `students/${user.uid}/photo`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      set('photoURL', url);
    } catch { toast.error('อัปโหลดรูปไม่สำเร็จ'); }
    finally { setUploading(false); }
  };

  const rightPortal = document.getElementById('header-portal-right-actions');

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <div className="w-8 h-8 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">กำลังโหลดข้อมูล...</p>
    </div>
  );

  if (!data || !form) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-slate-400 font-bold">ไม่พบข้อมูลนักเรียน</p>
      <button onClick={() => navigate(-1)} className="text-blue-500 font-bold flex items-center gap-2">
        <ArrowLeft size={16} /> กลับหน้าหลัก
      </button>
    </div>
  );

  const STATUS_COLOR: Record<string, string> = { active: '#10b981', inactive: '#f59e0b', graduated: '#6366f1', transferred: '#94a3b8' };
  const STATUS_LABEL: Record<string, string> = { active: 'กำลังศึกษา', inactive: 'พักการศึกษา', graduated: 'จบการศึกษา', transferred: 'ย้ายออก' };

  const tabs: { id: ProfileTab; label: string; icon: any }[] = [
    { id: 'personal', label: 'ข้อมูลส่วนตัว',   icon: User },
    { id: 'academic', label: 'การศึกษา',      icon: GraduationCap },
    { id: 'family',   label: 'ครอบครัว',       icon: Users },
    { id: 'address',  label: 'ที่อยู่',           icon: MapPin },
  ];

  const completion = form ? checkStudentCompletion(form) : null;

  return (
    <div className="flex flex-col h-full overflow-hidden font-sukhumvit">
      {/* Header Portal for Back Button */}
      {rightPortal && createPortal(
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-700 hover:bg-white/40 transition-colors"
          style={{
            background: 'rgba(255,255,255,0.35)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.55)',
          }}
        >
          <ArrowLeft size={16} />
        </button>,
        rightPortal
      )}

      <div className="flex flex-col flex-1 overflow-hidden">

        {/* ── Apple Music–Style Hero Header ── */}
        <div className="flex flex-row md:flex-row gap-4 md:gap-8 p-4 md:p-2 shrink-0 items-center md:items-start mb-8 text-left">
          {/* Photo */}
          <div className="w-32 h-32 md:w-52 md:h-52 rounded-xl overflow-hidden border border-slate-200/60 shrink-0 group relative transition-all duration-500 hover:-translate-y-1">
            <img
              src={form.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${form.id}`}
              className={`w-full h-full object-cover transition-all duration-700 ${isEditMode ? 'blur-sm scale-110' : 'group-hover:scale-110'}`}
              alt={form.firstName}
            />
            {isEditMode && (
              <label className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center cursor-pointer backdrop-blur-[2px]">
                {uploading ? <Loader2 className="text-white animate-spin mb-2" size={24} /> : <Camera className="text-white mb-2" size={24} />}
                <span className="text-white text-[10px] md:text-[11px] font-black uppercase tracking-widest">{uploading ? '...' : 'เปลี่ยน'}</span>
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
            )}
          </div>

          {/* Info & Actions */}
          <div className="flex flex-col flex-1 min-w-0 h-32 md:h-52 justify-between py-1">
                <div>
                  <h1 className="text-lg md:text-3xl font-black text-slate-900 tracking-tight leading-tight mb-0.5 truncate">
                    {data.prefix}{data.firstName} {data.lastName}
                  </h1>
                  <div className="flex items-center gap-3">
                    <p className="text-[15px] md:text-lg font-bold text-blue-600 mb-1 md:mb-3">รหัส: {data.studentCode}</p>
                    {completion && !completion.isComplete && (
                      <div className="mb-1 md:mb-3 flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full text-[10px] md:text-[11px] font-black border border-rose-100">
                        <AlertCircle size={12} />
                        <span>ข้อมูลไม่ครบ</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[9px] md:text-[12px] font-medium text-slate-400 uppercase tracking-widest flex items-center justify-start gap-2">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: STATUS_COLOR[data.status] || '#94a3b8' }} />
                {STATUS_LABEL[data.status] || 'ไม่ทราบสถานะ'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-start gap-3 mt-3 md:mt-0">
              {/* Edit Mode Toggle */}
              <div className="flex items-center gap-2 md:gap-3 md:px-5 md:py-2 md:bg-[#f2f2f7] rounded-full">
                <span className="hidden md:block text-[13px] font-black text-slate-400 uppercase tracking-widest">โหมดแก้ไข</span>
                <div
                  onClick={async () => {
                    if (isEditMode && form) {
                      try {
                        await performSave(form);
                        toast.success('บันทึกเรียบร้อย');
                      } catch (err) {
                        toast.error('บันทึกไม่สำเร็จ');
                      }
                    }
                    setIsEditMode(!isEditMode);
                  }}
                  className={`w-7 h-4 md:w-9 md:h-5 rounded-full p-0.5 flex cursor-pointer transition-colors ${isEditMode ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}
                >
                  <motion.div layout className="w-3 h-3 md:w-4 md:h-4 bg-white rounded-full shadow-sm" />
                </div>
              </div>

              {isEditMode && (
                <div className="flex items-center gap-2 px-3">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ระบบบันทึกอัตโนมัติ</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100/80 mb-6" />

        {/* ── Tab Navigation ── */}
        <div className="flex justify-around md:justify-start gap-4 md:gap-8 border-b border-slate-100 mb-6 px-2 overflow-x-auto scrollbar-hide shrink-0">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            
            // Check if this specific tab's category is incomplete
            let isCategoryIncomplete = false;
            if (completion) {
              if (t.id === 'personal' && !completion.categories.personal) isCategoryIncomplete = true;
              if (t.id === 'academic' && !completion.categories.education) isCategoryIncomplete = true;
              if (t.id === 'family' && !completion.categories.family) isCategoryIncomplete = true;
            }

            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 py-3 px-4 md:px-1 border-b-2 transition-all relative whitespace-nowrap ${active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <div className="relative">
                  <Icon size={20} className="md:w-4 md:h-4" />
                  {isCategoryIncomplete && (
                    <div className="absolute -top-1.5 -right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white" />
                  )}
                </div>
                <span className="hidden md:block text-[13px] font-black">{t.label}</span>
                {active && (
                  <motion.div layoutId="profileTab" className="absolute bottom-[-2px] left-0 right-0 h-[2px] bg-blue-600" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-16 px-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab + isEditMode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >

              {/* ─ Personal ─ */}
              {tab === 'personal' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <F label="เลขประจำตัว" required>
                      {isEditMode
                        ? <input value={form.studentCode ?? ''} onChange={e => set('studentCode', e.target.value)} className={inputCls} />
                        : <div className={viewCls}>{data.studentCode || '-'}</div>}
                    </F>
                    <F label="คำนำหน้า" required>
                      {isEditMode
                        ? <select value={form.prefix || ''} onChange={e => set('prefix', e.target.value)} className={inputCls}>
                            <option value="" disabled>โปรดเลือก</option>
                            {studentPrefixes.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        : <div className={viewCls}>{data.prefix || '-'}</div>}
                    </F>
                    <F label="ชื่อ" required>
                      {isEditMode
                        ? <input value={form.firstName} onChange={e => set('firstName', e.target.value)} className={inputCls} />
                        : <div className={viewCls}>{data.firstName}</div>}
                    </F>
                    <F label="นามสกุล" required>
                      {isEditMode
                        ? <input value={form.lastName} onChange={e => set('lastName', e.target.value)} className={inputCls} />
                        : <div className={viewCls}>{data.lastName}</div>}
                    </F>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <F label="ชื่อเล่น">
                      {isEditMode
                        ? <input value={form.nickname ?? ''} onChange={e => set('nickname', e.target.value)} className={inputCls} />
                        : <div className={viewCls}>{data.nickname || '-'}</div>}
                    </F>
                    <F label="วันเกิด">
                      {isEditMode
                        ? <input type="date" value={form.birthDate ?? ''} onChange={e => set('birthDate', e.target.value)} className={inputCls} />
                        : <div className={viewCls}>{data.birthDate || '-'}</div>}
                    </F>
                    <F label="อายุ (ปี)">
                      <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-[13px] font-bold text-slate-400 min-h-[38px] flex items-center">
                        {calcAge(data.birthDate) ? `${calcAge(data.birthDate)} ปี` : '-'}
                      </div>
                    </F>
                    <F label="หมู่เลือด">
                      {isEditMode
                        ? <select value={form.bloodType ?? ''} onChange={e => set('bloodType', e.target.value as BloodType)} className={inputCls}>
                            <option value="">ไม่ระบุ</option>
                            {['A','B','AB','O'].map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        : <div className={viewCls}>{data.bloodType || 'ไม่ระบุ'}</div>}
                    </F>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <F label="สัญชาติ">
                      {isEditMode
                        ? <input value={form.nationality ?? ''} onChange={e => set('nationality', e.target.value)} className={inputCls} />
                        : <div className={viewCls}>{data.nationality || '-'}</div>}
                    </F>
                    <F label="ศาสนา">
                      {isEditMode
                        ? <select value={form.religion ?? ''} onChange={e => set('religion', e.target.value)} className={inputCls}>
                            <option value="">ไม่ระบุ</option>
                            {['พุทธ', 'คริสต์', 'อิสลาม', 'ฮินดู', 'ซิกข์', 'อื่น ๆ'].map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        : <div className={viewCls}>{data.religion || '-'}</div>}
                    </F>
                    <div className="col-span-2">
                      <F label="ข้อมูลการแพ้">
                        {isEditMode
                          ? <input value={form.allergies ?? ''} onChange={e => set('allergies', e.target.value)} placeholder="เช่น แพ้อาหาร, แพ้ยา" className={inputCls} />
                          : <div className={viewCls}>{data.allergies || '-'}</div>}
                      </F>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <F label="เบอร์โทรศัพท์" required>
                      {isEditMode
                        ? <input value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} className={inputCls} />
                        : <div className={viewCls}>{data.phone || '-'}</div>}
                    </F>
                    <F label="อีเมล" required>
                      {isEditMode
                        ? <input type="email" value={form.email ?? ''} disabled className={`${inputCls} opacity-60 bg-slate-50 cursor-not-allowed font-bold`} />
                        : <div className={viewCls}>{data.email || '-'}</div>}
                    </F>
                  </div>

                  {/* Social and Financial Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-4">
                    {/* เพื่อนสนิท Section */}
                    <div className="space-y-4">
                      <h3 className="text-[14px] font-black text-slate-800 flex items-center gap-2">
                        เพื่อนสนิทในโรงเรียน
                      </h3>
                      <div className="space-y-3">
                        <F label="เพื่อนสนิทคนที่ 1">
                          {isEditMode
                            ? <input list="student-list" value={form.friends_inSchool1 ?? ''} onChange={e => set('friends_inSchool1', e.target.value)} placeholder="ชื่อเพื่อนสนิท (ระบุ - หากไม่มี)" className={inputCls} />
                            : <div className={viewCls}>{data.friends_inSchool1 || '-'}</div>}
                        </F>
                        <F label="เพื่อนสนิทคนที่ 2">
                          {isEditMode
                            ? <input list="student-list" value={form.friends_inSchool2 ?? ''} onChange={e => set('friends_inSchool2', e.target.value)} placeholder="ชื่อเพื่อนสนิท (ระบุ - หากไม่มี)" className={inputCls} />
                            : <div className={viewCls}>{data.friends_inSchool2 || '-'}</div>}
                        </F>
                        <F label="เพื่อนที่อยู่ใกล้บ้าน">
                          {isEditMode
                            ? <input value={form.friends_outside ?? ''} onChange={e => set('friends_outside', e.target.value)} placeholder="ระบุชื่อเพื่อน (ระบุ - หากไม่มี)" className={inputCls} />
                            : <div className={viewCls}>{data.friends_outside || '-'}</div>}
                        </F>
                      </div>
                    </div>

                    {/* ข้อมูลการเงิน Section */}
                    <div className="space-y-4">
                      <h3 className="text-[14px] font-black text-slate-800 flex items-center gap-2">
                        ข้อมูลการเงิน
                      </h3>
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[13px] font-bold text-slate-700">ได้เงินมาโรงเรียนวันละ <span className="text-rose-500">*</span></span>
                          <div className="flex items-center gap-2">
                            {isEditMode
                              ? <input type="number" value={form.financial_dailyAllowance ?? ''} onChange={e => set('financial_dailyAllowance', Number(e.target.value))} className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-center font-bold outline-none focus:border-blue-500" />
                              : <span className="font-black text-blue-600">{data.financial_dailyAllowance || 0}</span>}
                            <span className="text-[13px] font-bold text-slate-500">บาท</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[13px] font-bold text-slate-700">เหลือเก็บวันละ <span className="text-rose-500">*</span></span>
                          <div className="flex items-center gap-2">
                            {isEditMode
                              ? <input type="number" value={form.financial_dailySavings ?? ''} onChange={e => set('financial_dailySavings', Number(e.target.value))} className="w-24 px-3 py-1.5 border border-slate-200 rounded-lg text-center font-bold outline-none focus:border-blue-500" />
                              : <span className="font-black text-blue-600">{data.financial_dailySavings || 0}</span>}
                            <span className="text-[13px] font-bold text-slate-500">บาท <span className="text-[10px] font-medium text-slate-400">(กรอก 0 ถ้าไม่มี)</span></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 pt-2">
                          <span className="text-rose-500 font-bold">*</span>
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="radio"
                              name="financial_status"
                              checked={isEditMode ? form.financial_status === 'enough' : data.financial_status === 'enough'}
                              onChange={() => isEditMode && set('financial_status', 'enough')}
                              disabled={!isEditMode}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className={`text-[13px] font-bold transition-colors ${isEditMode ? 'group-hover:text-blue-600' : ''} ${ (isEditMode ? form.financial_status === 'enough' : data.financial_status === 'enough') ? 'text-blue-600' : 'text-slate-600'}`}>พอใช้</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="radio"
                              name="financial_status"
                              checked={isEditMode ? form.financial_status === 'not_enough' : data.financial_status === 'not_enough'}
                              onChange={() => isEditMode && set('financial_status', 'not_enough')}
                              disabled={!isEditMode}
                              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                            />
                            <span className={`text-[13px] font-bold transition-colors ${isEditMode ? 'group-hover:text-blue-600' : ''} ${ (isEditMode ? form.financial_status === 'not_enough' : data.financial_status === 'not_enough') ? 'text-blue-600' : 'text-slate-600'}`}>ไม่พอใช้</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─ Academic ─ */}
              {tab === 'academic' && (
                <div className="space-y-8">
                  {/* Subject Preferences */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-4 bg-emerald-500 rounded-full" />
                        <h3 className="text-[14px] font-black text-slate-800">วิชาที่ชอบ / ถนัด</h3>
                      </div>
                      <F label="วิชาที่ชอบ">
                        {isEditMode
                          ? <input value={form.edu_favoriteSubject ?? ''} onChange={e => set('edu_favoriteSubject', e.target.value)} placeholder="ระบุชื่อวิชา" className={inputCls} />
                          : <div className={viewCls}>{data.edu_favoriteSubject || '-'}</div>}
                      </F>
                      <F label="เหตุผลที่ชอบ">
                        {isEditMode
                          ? <textarea value={form.edu_favoriteSubjectReason ?? ''} onChange={e => set('edu_favoriteSubjectReason', e.target.value)} placeholder="ระบุเหตุผล..." className={`${inputCls} min-h-[80px] py-2 resize-none`} />
                          : <div className={`${viewCls} min-h-[80px] items-start`}>{data.edu_favoriteSubjectReason || '-'}</div>}
                      </F>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-4 bg-rose-500 rounded-full" />
                        <h3 className="text-[14px] font-black text-slate-800">วิชาที่ไม่ชอบ / ไม่ถนัด</h3>
                      </div>
                      <F label="วิชาที่ไม่ชอบ">
                        {isEditMode
                          ? <input value={form.edu_leastFavoriteSubject ?? ''} onChange={e => set('edu_leastFavoriteSubject', e.target.value)} placeholder="ระบุชื่อวิชา" className={inputCls} />
                          : <div className={viewCls}>{data.edu_leastFavoriteSubject || '-'}</div>}
                      </F>
                      <F label="เหตุผลที่ไม่ชอบ">
                        {isEditMode
                          ? <textarea value={form.edu_leastFavoriteSubjectReason ?? ''} onChange={e => set('edu_leastFavoriteSubjectReason', e.target.value)} placeholder="ระบุเหตุผล..." className={`${inputCls} min-h-[80px] py-2 resize-none`} />
                          : <div className={`${viewCls} min-h-[80px] items-start`}>{data.edu_leastFavoriteSubjectReason || '-'}</div>}
                      </F>
                    </div>
                  </div>

                  <div className="h-px bg-slate-100" />

                  {/* Talents and GPAX */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-[14px] font-black text-slate-800">ความสามารถพิเศษ</h3>
                      <F label="ความสามารถพิเศษ / รางวัลที่เคยได้รับ">
                        {isEditMode
                          ? <textarea value={form.edu_specialTalent ?? ''} onChange={e => set('edu_specialTalent', e.target.value)} placeholder="เช่น เล่นดนตรี, กีฬา, งานศิลปะ..." className={`${inputCls} min-h-[100px] py-2 resize-none`} />
                          : <div className={`${viewCls} min-h-[100px] items-start`}>{data.edu_specialTalent || '-'}</div>}
                      </F>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-[14px] font-black text-slate-800">ความรู้สึกต่อการเรียน</h3>
                        <div className="flex items-center gap-6">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="radio"
                              name="edu_selfPerception"
                              checked={isEditMode ? form.edu_selfPerception === 'no_problem' : data.edu_selfPerception === 'no_problem'}
                              onChange={() => isEditMode && set('edu_selfPerception', 'no_problem')}
                              disabled={!isEditMode}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className={`text-[13px] font-bold ${ (isEditMode ? form.edu_selfPerception === 'no_problem' : data.edu_selfPerception === 'no_problem') ? 'text-blue-600' : 'text-slate-600'}`}>ไม่มีปัญหา</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="radio"
                              name="edu_selfPerception"
                              checked={isEditMode ? form.edu_selfPerception === 'has_problem' : data.edu_selfPerception === 'has_problem'}
                              onChange={() => isEditMode && set('edu_selfPerception', 'has_problem')}
                              disabled={!isEditMode}
                              className="w-4 h-4 text-blue-600"
                            />
                            <span className={`text-[13px] font-bold ${ (isEditMode ? form.edu_selfPerception === 'has_problem' : data.edu_selfPerception === 'has_problem') ? 'text-blue-600' : 'text-slate-600'}`}>มีปัญหา</span>
                          </label>
                        </div>

                        {(isEditMode ? form.edu_selfPerception === 'has_problem' : data.edu_selfPerception === 'has_problem') && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            className="mt-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-100/50 space-y-4"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-1">
                                <span className="text-[11px] font-black text-amber-600 uppercase tracking-wider">ปัญหาที่พบ</span>
                                {isEditMode
                                  ? <input value={form.edu_problemDetail ?? ''} onChange={e => set('edu_problemDetail', e.target.value)} placeholder="ระบุรายละเอียดปัญหา..." className={`${inputCls} bg-white/80 border-amber-200/50 focus:border-amber-400`} />
                                  : <div className="text-[14px] font-bold text-slate-700">{data.edu_problemDetail || '-'}</div>}
                              </div>
                              <div className="space-y-1">
                                <span className="text-[11px] font-black text-amber-600 uppercase tracking-wider">สาเหตุของปัญหา</span>
                                {isEditMode
                                  ? <input value={form.edu_problemCause ?? ''} onChange={e => set('edu_problemCause', e.target.value)} placeholder="ระบุสาเหตุ..." className={`${inputCls} bg-white/80 border-amber-200/50 focus:border-amber-400`} />
                                  : <div className="text-[14px] font-bold text-slate-700">{data.edu_problemCause || '-'}</div>}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─ Family ─ */}
              {tab === 'family' && (
                <div className="space-y-8">
                  {/* Family Count Section */}
                  <div className="flex items-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[14px] font-black text-slate-700">สมาชิกในครอบครัวมีทั้งหมด <span className="text-rose-500">*</span></span>
                    {isEditMode ? (
                      <input
                        type="number"
                        value={form.familyCount ?? ''}
                        onChange={e => set('familyCount', Number(e.target.value))}
                        className="w-20 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-black text-blue-600 outline-none focus:border-blue-500"
                      />
                    ) : (
                      <div className="w-12 h-10 flex items-center justify-center bg-blue-50 rounded-xl font-black text-blue-600 border border-blue-100">
                        {data.familyCount || 0}
                      </div>
                    )}
                    <span className="text-[13px] font-bold text-slate-400">คน (รวมตัวนักเรียน)</span>
                  </div>

                  {/* Family Members Table */}
                  <div className="space-y-4">
                    {/* Desktop Table View */}
                    <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-100 shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-blue-50/50">
                          <tr>
                            <th className="px-4 py-3 text-[12px] font-black text-blue-600 uppercase tracking-wider w-12 text-center">#</th>
                            <th className="px-4 py-3 text-[12px] font-black text-blue-600 uppercase tracking-wider">ชื่อ - สกุล</th>
                            <th className="px-4 py-3 text-[12px] font-black text-blue-600 uppercase tracking-wider">ความสัมพันธ์</th>
                            <th className="px-4 py-3 text-[12px] font-black text-blue-600 uppercase tracking-wider w-20">อายุ</th>

                            <th className="px-4 py-3 text-[12px] font-black text-blue-600 uppercase tracking-wider">อาชีพ</th>
                            <th className="px-4 py-3 text-[12px] font-black text-blue-600 uppercase tracking-wider w-32">รายได้/เดือน</th>
                            {isEditMode && <th className="px-4 py-3 text-[12px] font-black text-rose-600 uppercase tracking-wider w-12 text-center">จัดการ</th>}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-50">
                          {(isEditMode ? (form.familyMembers || []) : (data.familyMembers || [])).map((member, idx) => (
                            <tr key={member.id} className="hover:bg-slate-50/30 transition-colors">
                              <td className="px-4 py-2 text-[13px] font-bold text-slate-400 text-center">{idx + 1}</td>
                              <td className="px-4 py-2">
                                <span className="font-bold text-[13px] text-slate-600">{(member.prefix || '') + (member.firstName || '-') + ' ' + (member.lastName || '')}</span>
                              </td>
                              <td className="px-4 py-2">
                                <span className="font-bold text-[13px] text-slate-600">{member.relation || '-'}</span>
                              </td>
                              <td className="px-4 py-2 text-center">
                                <span className="font-bold text-[13px] text-slate-600">{member.age || '-'}</span>
                              </td>

                              <td className="px-4 py-2">
                                <span className="font-bold text-[13px] text-slate-600">{member.occupation || '-'}</span>
                              </td>
                              <td className="px-4 py-2 text-right">
                                <span className="font-bold text-[13px] text-slate-600">{member.income?.toLocaleString() || '0'} ฿</span>
                              </td>
                              {isEditMode && (
                                <td className="px-4 py-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => editFamilyMember(member)} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                                      <ClipboardList size={14} />
                                    </button>
                                    <button onClick={() => removeFamilyMember(member.id)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                          {(isEditMode ? (form.familyMembers || []) : (data.familyMembers || [])).length === 0 && (
                            <tr>
                              <td colSpan={isEditMode ? 8 : 7} className="px-4 py-8 text-center text-slate-400 font-bold text-[13px]">ยังไม่มีข้อมูลสมาชิกในครอบครัว</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-3">
                      {(isEditMode ? (form.familyMembers || []) : (data.familyMembers || [])).map((member, idx) => (
                        <div key={member.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[12px] font-black text-blue-600">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="text-[14px] font-black text-slate-700">{(member.prefix || '') + (member.firstName || 'ไม่ระบุชื่อ') + ' ' + (member.lastName || '')}</p>
                              <p className="text-[12px] font-bold text-slate-400">{member.relation || 'ไม่ระบุความสัมพันธ์'}</p>
                            </div>
                          </div>
                          {isEditMode && (
                            <div className="flex items-center gap-2">
                              <button onClick={() => editFamilyMember(member)} className="p-2 text-blue-500 bg-blue-50 rounded-xl">
                                <ClipboardList size={16} />
                              </button>
                              <button onClick={() => removeFamilyMember(member.id)} className="p-2 text-rose-500 bg-rose-50 rounded-xl">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {(isEditMode ? (form.familyMembers || []) : (data.familyMembers || [])).length === 0 && (
                        <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-slate-400 font-bold text-[13px]">
                          ยังไม่มีข้อมูลสมาชิกในครอบครัว
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (!isEditMode) setIsEditMode(true);
                        addFamilyMember();
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all font-black text-[12px] uppercase tracking-wider"
                    >
                      <Plus size={14} />
                      เพิ่มสมาชิก
                    </button>
                  </div>

                  {/* Guardian Section */}
                  <div className="pt-6 space-y-6">
                    <div className="flex items-center gap-2 text-slate-400">
                      <div className="h-px flex-1 bg-slate-100" />
                      <span className="text-[11px] font-black uppercase tracking-[0.2em]">ข้อมูลผู้ปกครอง (ฉุกเฉิน)</span>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <F label="คำนำหน้า">
                        {isEditMode ? (
                          <select value={form.guardianPrefix ?? ''} onChange={e => set('guardianPrefix', e.target.value)} className={inputCls}>
                            <option value="">— ไม่ระบุ —</option>
                            {adultPrefixes.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        ) : (
                          <div className={viewCls}>{data.guardianPrefix || '-'}</div>
                        )}
                      </F>
                      <F label="ชื่อ">
                        {isEditMode ? (
                          <input value={form.guardianFirstName ?? ''} onChange={e => set('guardianFirstName', e.target.value)} className={inputCls} />
                        ) : (
                          <div className={viewCls}>{data.guardianFirstName || '-'}</div>
                        )}
                      </F>
                      <F label="นามสกุล">
                        {isEditMode ? (
                          <input value={form.guardianLastName ?? ''} onChange={e => set('guardianLastName', e.target.value)} className={inputCls} />
                        ) : (
                          <div className={viewCls}>{data.guardianLastName || '-'}</div>
                        )}
                      </F>
                      <F label="ความสัมพันธ์">
                        {isEditMode ? (
                          <select value={form.guardianRelation ?? ''} onChange={e => set('guardianRelation', e.target.value)} className={inputCls}>
                            {['บิดา','มารดา','ผู้ปกครอง','ปู่/ตา','ย่า/ยาย','อื่น ๆ'].map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : (
                          <div className={viewCls}>{data.guardianRelation || '-'}</div>
                        )}
                      </F>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <F label="เบอร์โทรศัพท์">
                        {isEditMode ? (
                          <input value={form.guardianPhone ?? ''} onChange={e => set('guardianPhone', e.target.value)} className={inputCls} />
                        ) : (
                          <div className={viewCls}>{data.guardianPhone || '-'}</div>
                        )}
                      </F>
                    </div>
                  </div>
                </div>
              )}

              {/* ─ Address ─ */}
               {tab === 'address' && (
                <div className="space-y-6">
                  {/* Migration Hint for Old Address Data */}
                  {(data?.address || form?.address) && (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-amber-800 font-black text-[13px]">
                        <Info size={16} /> ข้อมูลที่อยู่เดิม (ตรวจพบข้อมูลเดิมในระบบ)
                      </div>
                      <p className="text-[13px] text-amber-700 font-medium bg-white/50 p-3 rounded-lg border border-amber-200/50">
                        {data?.address || form?.address}
                      </p>
                      <p className="text-[11px] text-amber-600 font-bold uppercase tracking-wider">
                        * โปรดนำข้อมูลด้านบนมาแยกกรอกลงในช่องด้านล่างเพื่อความถูกต้องของระบบที่อยู่ใหม่
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-4">
                    <F label="หมู่บ้าน/อาคาร">
                      {isEditMode
                        ? <input value={form.address_village ?? ''} onChange={e => set('address_village', e.target.value)} placeholder="หมู่บ้าน/อาคาร" className={inputCls} />
                        : <div className={viewCls}>{data.address_village || '-'}</div>}
                    </F>
                    <F label="บ้านเลขที่">
                      {isEditMode
                        ? <input value={form.address_houseNo ?? ''} onChange={e => set('address_houseNo', e.target.value)} placeholder="บ้านเลขที่" className={inputCls} />
                        : <div className={viewCls}>{data.address_houseNo || '-'}</div>}
                    </F>
                    <F label="หมู่">
                      {isEditMode
                        ? <input value={form.address_moo ?? ''} onChange={e => set('address_moo', e.target.value)} placeholder="หมู่ที่" className={inputCls} />
                        : <div className={viewCls}>{data.address_moo || '-'}</div>}
                    </F>
                    <F label="ถนน">
                      {isEditMode
                        ? <input value={form.address_street ?? ''} onChange={e => set('address_street', e.target.value)} placeholder="ถนน" className={inputCls} />
                        : <div className={viewCls}>{data.address_street || '-'}</div>}
                    </F>
                  </div>
                  <div className="pt-4">
                    <ThaiAddressInputGroup
                      subdistrict={form.address_subdistrict ?? ''}
                      district={form.address_district ?? ''}
                      province={form.address_province ?? ''}
                      postalCode={form.address_postalCode ?? ''}
                      onChange={(updates) => {
                        setForm(prev => prev ? {
                          ...prev,
                          address_subdistrict: updates.subdistrict,
                          address_district: updates.district,
                          address_province: updates.province,
                          address_postalCode: updates.postalCode,
                        } : prev);
                      }}
                      isEditMode={isEditMode}
                      viewCls={viewCls}
                      inputCls={inputCls}
                    />
                  </div>

                  <div className="pt-4">
                    <F label="ตำแหน่งที่ตั้ง (Google Maps)">
                      <div className="h-80 w-full mt-2">
                        <GoogleMapPicker
                          lat={isEditMode ? form.address_latitude : data.address_latitude}
                          lng={isEditMode ? form.address_longitude : data.address_longitude}
                          isEditMode={isEditMode}
                          onChange={(lat, lng) => {
                            set('address_latitude', lat);
                            set('address_longitude', lng);
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-2 font-bold uppercase tracking-wider">
                        {isEditMode ? 'คลิกบนแผนที่หรือลากหมุดเพื่อระบุตำแหน่งที่ตั้งบ้าน' : 'ตำแหน่งที่ตั้งบ้านของนักเรียน'}
                      </p>
                    </F>
                  </div>
                </div>
              )}


            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Family Member Modal ── */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showFamilyModal && modalMember && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-white"
              >
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-blue-50/30">
                  <h3 className="text-lg font-black text-slate-900">จัดการข้อมูลสมาชิก</h3>
                  <button onClick={() => setShowFamilyModal(false)} className="p-2 hover:bg-white rounded-xl transition-colors">
                    <X size={20} className="text-slate-400" />
                  </button>
                </div>

                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="grid grid-cols-[80px,1fr,1fr] gap-2 md:col-span-2">
                      <F label="คำนำหน้า" required>
                        <select 
                          value={modalMember.prefix || ''} 
                          onChange={e => setModalMember({...modalMember, prefix: e.target.value})} 
                          className={inputCls}
                        >
                          <option value="">เลือก</option>
                          {adultPrefixes.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </F>
                      <F label="ชื่อ" required>
                        <input 
                          value={modalMember.firstName || ''} 
                          onChange={e => setModalMember({...modalMember, firstName: e.target.value})} 
                          className={inputCls} 
                          placeholder="ชื่อ"
                        />
                      </F>
                      <F label="นามสกุล" required>
                        <input 
                          value={modalMember.lastName || ''} 
                          onChange={e => setModalMember({...modalMember, lastName: e.target.value})} 
                          className={inputCls} 
                          placeholder="นามสกุล"
                        />
                      </F>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <F label="ความสัมพันธ์" required>
                      <input 
                        value={modalMember.relation || ''} 
                        onChange={e => setModalMember({...modalMember, relation: e.target.value})} 
                        className={inputCls} 
                        placeholder="เช่น บิดา, มารดา"
                      />
                    </F>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <F label="อายุ (ปี)">
                      <input 
                        type="number"
                        value={modalMember.age || ''} 
                        onChange={e => setModalMember({...modalMember, age: Number(e.target.value)})} 
                        className={inputCls} 
                      />
                    </F>
                    <F label="อาชีพ">
                      <input 
                        value={modalMember.occupation || ''} 
                        onChange={e => setModalMember({...modalMember, occupation: e.target.value})} 
                        className={inputCls} 
                      />
                    </F>
                  </div>

                  <F label="รายได้ต่อเดือน (บาท)">
                    <div className="relative">
                      <input 
                        type="number"
                        value={modalMember.income || ''} 
                        onChange={e => setModalMember({...modalMember, income: Number(e.target.value)})} 
                        className={`${inputCls} pr-10`} 
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[12px]">฿</span>
                    </div>
                  </F>
                </div>

                <div className="p-6 bg-slate-50/50 flex gap-3">
                  <button 
                    onClick={() => setShowFamilyModal(false)}
                    className="flex-1 py-3 bg-white border border-slate-200 rounded-2xl text-[14px] font-black text-slate-500 hover:bg-slate-100 transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    onClick={saveModalMember}
                    className="flex-1 py-3 bg-blue-600 rounded-2xl text-[14px] font-black text-white hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                  >
                    บันทึกข้อมูล
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      <datalist id="student-list">
        {students.map(s => (
          <option key={s.id} value={`${s.prefix}${s.firstName} ${s.lastName}`} />
        ))}
      </datalist>
    </div>
  );
};

export default StudentProfilePage;
