import { lazy, Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, LayoutGrid, FileUp,
  DoorOpen, ArrowUpCircle, MoreHorizontal,
  Trash2, Phone, MapPin,
  User, BookOpen, ChevronDown, AlertCircle,
  Users, Home, ClipboardList,
  Camera, Loader2
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { toast } from 'sonner';
import { useStudentManager } from '@/hooks/useStudentManager';
import { useActiveAcademicYear } from '@/hooks/useActiveAcademicYear';
import { useNamePrefix } from '@/hooks/useNamePrefix';
import StudentFormModal from './components/StudentFormModal';
import type { Student } from '@/types/student';

const StudentCsvImportModal = lazy(() => import('./components/StudentCsvImportModal'));
const StudentImportTab = lazy(() => import('./components/StudentImportTab'));
const ClassroomAssignmentTab = lazy(() => import('./components/ClassroomAssignmentTab'));
const StudentTransitionTab = lazy(() => import('./components/StudentTransitionTab'));

type StudentTab = 'list' | 'import' | 'class' | 'promote';
type DetailTab = 'personal' | 'family' | 'academic' | 'visit' | 'map' | 'registration';

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

const GRADE_ORDER: Record<string, string[]> = {
  early: ['อ.1', 'อ.2', 'อ.3'],
  primary: ['ป.1', 'ป.2', 'ป.3', 'ป.4', 'ป.5', 'ป.6'],
  secondary: ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'],
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-50">
      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
        <Icon size={14} className="text-slate-400" />
      </div>
      <div>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{label}</p>
        <p className="text-[13px] text-slate-700 font-bold">{value}</p>
      </div>
    </div>
  );
}

const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to Blob failed'));
        }, 'image/jpeg', quality);
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

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

    if (!(window as any).google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }
  }, [isEditMode]);

  useEffect(() => {
    if (markerRef.current && lat && lng) {
      const currentPos = markerRef.current.getPosition();
      if (Math.abs(currentPos.lat() - lat) > 0.0001 || Math.abs(currentPos.lng() - lng) > 0.0001) {
        const newPos = { lat, lng };
        markerRef.current.setPosition(newPos);
        googleMapRef.current?.panTo(newPos);
      }
    }
  }, [lat, lng]);

  return (
    <div className="relative">
      <div ref={mapRef} className="w-full h-[400px] rounded-3xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100" />
      {!isEditMode && (
        <div className="absolute inset-0 bg-transparent" />
      )}
    </div>
  );
};

function StudentAutocompleteInput({
  value,
  onChange,
  placeholder,
  students,
  className
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  students: Student[];
  className?: string;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const suggestions = useMemo(() => {
    if (!inputValue || inputValue.length < 2) return [];
    const q = inputValue.toLowerCase();
    return students.filter(s => {
      const full = `${s.prefix}${s.firstName} ${s.lastName}`.toLowerCase();
      const code = (s.studentCode || '').toString().toLowerCase();
      return full.includes(q) || code.includes(q);
    }).slice(0, 5);
  }, [inputValue, students]);

  return (
    <div className="relative w-full">
      <input
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder={placeholder}
        className={className}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-[100] w-full mt-1 bg-white/95 backdrop-blur-xl border border-slate-100 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          {suggestions.map(s => (
            <div
              key={s.id}
              onClick={() => {
                const name = `${s.prefix}${s.firstName} ${s.lastName}`;
                setInputValue(name);
                onChange(name);
                setShowSuggestions(false);
              }}
              className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-slate-50 last:border-0"
            >
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-black text-slate-700">{s.prefix}{s.firstName} {s.lastName}</p>
                <p className="text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">{s.studentCode}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StudentManager() {
  const { year: academicYear } = useActiveAcademicYear();

  const {
    students,
    filteredStudentCards, filter, setFilter,
    availableClasses,
    addStudent, updateStudent, deleteStudent, toggleStudentStatus,
    getStudentById, getStudentEnrollments,
  } = useStudentManager(academicYear ?? '2568');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { prefixes: guardianPrefixes } = useNamePrefix('adult');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent] = useState<Student | null>(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StudentTab>('list');
  const [detailTab, setDetailTab] = useState<DetailTab>('personal');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [isEditMode, setIsEditMode] = useState(false);
  const [detailForm, setDetailForm] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isSavingChanges, setIsSavingChanges] = useState(false);
  const selectedStudent = selectedId ? getStudentById(selectedId) : null;
  const selectedEnrollments = selectedId ? getStudentEnrollments(selectedId) : [];

  // Sync detail form when selected student changes
  useEffect(() => {
    if (selectedStudent) {
      setDetailForm(selectedStudent);
      setHasPendingChanges(false);
    }
  }, [selectedStudent]);

  const handleDetailFormChange = (key: string, value: any) => {
    setDetailForm((prev: any) => ({ ...prev, [key]: value }));
    setHasPendingChanges(true);
  };

  const handleSaveDetailChanges = async () => {
    if (!selectedId || !detailForm || isSavingChanges) return;

    setIsSavingChanges(true);
    try {
      const payload = { ...detailForm };
      delete payload.id;
      await updateStudent(selectedId, payload);
      setHasPendingChanges(false);
      setIsEditMode(false);
      toast.success('บันทึกข้อมูลเรียบร้อย');
    } catch (error) {
      console.error('Save student detail error:', error);
      toast.error('บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setIsSavingChanges(false);
    }
  };

  const handleEditModeToggle = () => {
    if (isEditMode && hasPendingChanges) {
      const shouldDiscard = confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากโหมดแก้ไขและยกเลิกการเปลี่ยนแปลงหรือไม่?');
      if (!shouldDiscard) return;
      if (selectedStudent) setDetailForm(selectedStudent);
      setHasPendingChanges(false);
    }
    setIsEditMode(prev => !prev);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;

    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      return;
    }

    setIsUploading(true);
    const loadingToast = toast.loading('กำลังอัปโหลดและบีบอัดรูปภาพ...');

    try {
      // 1. Compress
      const compressedBlob = await compressImage(file);
      
      // 2. Upload
      const fileName = `student_photos/${selectedId}_${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, compressedBlob);
      const url = await getDownloadURL(storageRef);

      // 3. Keep in draft form and save with "บันทึก" button
      setDetailForm((prev: any) => ({ ...prev, photoURL: url }));
      setHasPendingChanges(true);
      
      toast.success('อัปโหลดรูปภาพสำเร็จ (รอบันทึกข้อมูล)', { id: loadingToast });
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปโหลด', { id: loadingToast });
    } finally {
      setIsUploading(false);
    }
  };

  // Sync search query to filter
  useEffect(() => {
    setFilter(prev => ({ ...prev, searchText: searchQuery }));
  }, [searchQuery]);

  // Auto-select first student if none selected
  useEffect(() => {
    if (!selectedId && filteredStudentCards.length > 0) {
      setSelectedId(filteredStudentCards[0].student.id);
    }
  }, [filteredStudentCards, selectedId]);

  const handleFormSubmit = async (data: any) => {
    if (editingStudent) {
      await updateStudent(editingStudent.id, data);
    } else {
      const newStudent = await addStudent(data);
      setSelectedId(newStudent.id);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteStudent(id);
    if (selectedId === id) {
      const next = filteredStudentCards.find(c => c.student.id !== id);
      setSelectedId(next?.student.id ?? null);
    }
  };

  const toggleStudentSelection = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedStudentIds(next);
  };



  const calcAge = (birthDate?: string) => {
    if (!birthDate) return undefined;
    const birth = new Date(birthDate);
    const age = new Date().getFullYear() - birth.getFullYear();
    return `${age} ปี`;
  };

  const headerPortal = document.getElementById('header-portal-center');

  const navigation = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center h-9 border border-black/[0.07] p-1 rounded-full bg-white/50 backdrop-blur-md pointer-events-auto"
    >
      {[
        { id: 'list', label: 'รายชื่อ', icon: LayoutGrid },
        { id: 'import', label: 'นำเข้า', icon: FileUp },
        { id: 'class', label: 'ห้องเรียน', icon: DoorOpen },
        { id: 'promote', label: 'เลื่อนชั้น', icon: ArrowUpCircle },
      ].map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as StudentTab)}
            className={`flex items-center justify-center h-full px-5 rounded-full text-[10.5px] font-black transition-all whitespace-nowrap gap-1.5 ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-black/35 hover:text-black/60 hover:bg-black/[0.02]'}`}
          >
            <Icon size={13} className="sm:hidden" />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </motion.div>
  );

  return (
    <div className="flex h-full w-full bg-transparent overflow-hidden pb-4 gap-6 font-sukhumvit">
      {headerPortal && createPortal(navigation, headerPortal)}

      {activeTab === 'list' ? (
        <div className="flex flex-1 min-w-0 h-full overflow-hidden relative">

          {/* LEFT PANEL — Detail View */}
          <div className="flex-1 min-w-0 flex flex-col pr-4 overflow-hidden">

            {selectedStudent ? (
              <motion.div
                key={selectedStudent.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full overflow-hidden"
              >
                {/* Apple Music Style Header */}
                <div className="flex flex-col md:flex-row gap-8 p-2 shrink-0 items-start mb-8">
                  {/* Album Art — student photo */}
                  <div className="w-48 h-48 md:w-56 md:h-56 rounded-xl overflow-hidden shadow-[0_8px_25px_-10px_rgba(0,0,0,0.25)] shrink-0 group relative transition-all duration-500 hover:shadow-[0_12px_30px_-12px_rgba(0,0,0,0.3)] hover:-translate-y-1">
                    <img
                      src={(isEditMode ? detailForm?.photoURL : selectedStudent.photoURL) || selectedStudent.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedStudent.id}`}
                      className={`w-full h-full object-cover transition-all duration-700 ${isEditMode ? 'blur-sm scale-110' : 'group-hover:scale-110'}`}
                      alt={selectedStudent.firstName}
                    />
                    
                    {isEditMode ? (
                      <label className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center cursor-pointer transition-all backdrop-blur-[2px]">
                        {isUploading ? (
                          <Loader2 className="text-white animate-spin mb-2" size={32} />
                        ) : (
                          <Camera className="text-white mb-2" size={32} />
                        )}
                        <span className="text-white text-[12px] font-black uppercase tracking-widest">
                          {isUploading ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูปถ่าย'}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          disabled={isUploading}
                        />
                      </label>
                    ) : (
                      <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors pointer-events-none" />
                    )}
                  </div>

                  {/* Info & Actions */}
                  <div className="flex flex-col h-48 md:h-56 justify-between py-1">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight mb-1">
                        {selectedStudent.prefix}{selectedStudent.firstName} {selectedStudent.lastName}
                      </h2>
                      <p className="text-lg font-bold text-blue-600 mb-3">
                        รหัส: {selectedStudent.studentCode}
                      </p>
                      <p className="text-[12px] font-medium text-slate-400 mb-0 uppercase tracking-widest opacity-60 flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full inline-block"
                          style={{ background: STATUS_COLOR[selectedStudent.status] || '#94a3b8' }}
                        />
                        {STATUS_LABEL[selectedStudent.status] || 'ไม่ทราบสถานะ'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Edit Mode Toggle Switch */}
                      <div className="flex items-center gap-3 px-5 py-2 bg-[#f2f2f7] rounded-full transition-all">
                        <span className="text-[13px] font-black text-slate-400 uppercase tracking-widest">โหมดแก้ไข</span>
                        <div
                          onClick={handleEditModeToggle}
                          className={`w-9 h-5 rounded-full p-0.5 flex cursor-pointer transition-colors ${isEditMode ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}
                        >
                          <motion.div
                            layout
                            className="w-4 h-4 bg-white rounded-full shadow-sm"
                          />
                        </div>
                      </div>

                      <AnimatePresence mode="wait">
                        {isEditMode && (
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            className="flex flex-wrap items-center gap-3"
                          >
                            <motion.button
                              whileHover={{ scale: hasPendingChanges && !isSavingChanges ? 1.02 : 1 }}
                              whileTap={{ scale: hasPendingChanges && !isSavingChanges ? 0.98 : 1 }}
                              onClick={handleSaveDetailChanges}
                              disabled={!hasPendingChanges || isSavingChanges}
                              className={`flex items-center gap-2 px-6 py-2 rounded-full transition-all font-bold text-[13px] shadow-sm border ${hasPendingChanges && !isSavingChanges ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600' : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'}`}
                            >
                              {isSavingChanges && <Loader2 size={15} className="animate-spin" />}
                              บันทึก
                            </motion.button>


                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => toggleStudentStatus(selectedStudent.id)}
                              className={`flex items-center gap-2 px-5 py-2 rounded-full transition-all font-bold text-[13px] ${selectedStudent.status === 'active' ? 'bg-white text-blue-600' : 'bg-rose-50 text-rose-600'} shadow-sm border border-black/5`}
                            >
                              <div className={`w-9 h-5 rounded-full p-0.5 flex transition-colors ${selectedStudent.status === 'active' ? 'bg-blue-500 justify-end' : 'bg-rose-500 justify-start'}`}>
                                <motion.div
                                  layout
                                  className="w-4 h-4 bg-white rounded-full shadow-sm"
                                />
                              </div>
                              {selectedStudent.status === 'active' ? 'พักการเรียน' : 'เปิดสถานะ'}
                            </motion.button>

                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                if (confirm(`ลบรายชื่อ ${selectedStudent.prefix}${selectedStudent.firstName}?`)) {
                                  handleDelete(selectedStudent.id);
                                }
                              }}
                              className="flex items-center gap-2 px-6 py-2 bg-[#fff1f2] hover:bg-[#ffe4e6] text-rose-600 rounded-full transition-all font-bold text-[13px] shadow-sm"
                            >
                              <Trash2 size={15} strokeWidth={3} />
                              ลบข้อมูล
                            </motion.button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-100/80 mb-8" />

                {/* Tab Navigation */}
                <div className="flex items-center gap-8 mb-6 border-b border-slate-100 px-2 overflow-x-auto scrollbar-hide">
                  {[
                    { id: 'personal', label: 'ข้อมูลส่วนตัว', icon: User },
                    { id: 'family', label: 'ข้อมูลครอบครัว', icon: Users },
                    { id: 'academic', label: 'ข้อมูลการศึกษา', icon: BookOpen },
                    { id: 'registration', label: 'ประวัติลงทะเบียน', icon: ClipboardList },
                    { id: 'visit', label: 'ข้อมูลเยี่ยมบ้าน', icon: Home },
                    { id: 'map', label: 'แผนที่บ้าน', icon: MapPin },
                  ].map((tab) => {
                    const isActive = detailTab === tab.id;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setDetailTab(tab.id as DetailTab)}
                        className={`flex items-center gap-2 py-3 px-1 border-b-2 transition-all relative ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                      >
                        <Icon size={16} />
                        <span className="text-[13px] font-black whitespace-nowrap">{tab.label}</span>
                        {isActive && (
                          <motion.div
                            layoutId="activeDetailTab"
                            className="absolute bottom-[-2px] left-0 right-0 h-[2px] bg-blue-600"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Detail Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide pb-12 min-h-0">
                  <div className="px-2">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={detailTab + (isEditMode ? '-edit' : '-view')}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        {detailTab === 'personal' && (
                          <div className="space-y-6">

                            <div className="grid grid-cols-4 gap-4">
                              <div className="space-y-1">
                                <label className="text-[12px] font-black text-slate-700">คำนำหน้า <span className="text-rose-500">*</span></label>
                                {isEditMode ? (
                                  <select
                                    value={detailForm?.prefix || ''}
                                    onChange={e => handleDetailFormChange('prefix', e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none focus:border-blue-500 transition-all"
                                  >
                                    <option value="เด็กชาย">เด็กชาย</option>
                                    <option value="เด็กหญิง">เด็กหญิง</option>
                                    <option value="นาย">นาย</option>
                                    <option value="นางสาว">นางสาว</option>
                                  </select>
                                ) : (
                                  <div className="px-3 py-2 bg-slate-50 border border-transparent rounded-lg text-[13px] font-bold text-slate-600">{selectedStudent.prefix}</div>
                                )}
                              </div>
                              <div className="space-y-1 col-span-1">
                                <label className="text-[12px] font-black text-slate-700">ชื่อ <span className="text-rose-500">*</span></label>
                                {isEditMode ? (
                                  <input
                                    value={detailForm?.firstName || ''}
                                    onChange={e => handleDetailFormChange('firstName', e.target.value)}
                                    placeholder="ชื่อ"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none focus:border-blue-500 transition-all"
                                  />
                                ) : (
                                  <div className="px-3 py-2 bg-slate-50 border border-transparent rounded-lg text-[13px] font-bold text-slate-600">{selectedStudent.firstName}</div>
                                )}
                              </div>
                              <div className="space-y-1 col-span-1">
                                <label className="text-[12px] font-black text-slate-700">นามสกุล <span className="text-rose-500">*</span></label>
                                {isEditMode ? (
                                  <input
                                    value={detailForm?.lastName || ''}
                                    onChange={e => handleDetailFormChange('lastName', e.target.value)}
                                    placeholder="นามสกุล"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none focus:border-blue-500 transition-all"
                                  />
                                ) : (
                                  <div className="px-3 py-2 bg-slate-50 border border-transparent rounded-lg text-[13px] font-bold text-slate-600">{selectedStudent.lastName}</div>
                                )}
                              </div>
                              <div className="space-y-1">
                                <label className="text-[12px] font-black text-slate-700">ชื่อเล่น <span className="text-rose-500">*</span></label>
                                {isEditMode ? (
                                  <input
                                    value={detailForm?.nickname || ''}
                                    onChange={e => handleDetailFormChange('nickname', e.target.value)}
                                    placeholder="ระบุ - หากไม่มี"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none focus:border-blue-500 transition-all"
                                  />
                                ) : (
                                  <div className="px-3 py-2 bg-slate-50 border border-transparent rounded-lg text-[13px] font-bold text-slate-600">{selectedStudent.nickname || '-'}</div>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                              <div className="space-y-1">
                                <label className="text-[12px] font-black text-slate-700">หมู่เลือด <span className="text-rose-500">*</span></label>
                                {isEditMode ? (
                                  <select
                                    value={detailForm?.bloodType || ''}
                                    onChange={e => handleDetailFormChange('bloodType', e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none focus:border-blue-500 transition-all"
                                  >
                                    <option value="">เลือก</option>
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="AB">AB</option>
                                    <option value="O">O</option>
                                  </select>
                                ) : (
                                  <div className="px-3 py-2 bg-slate-50 border border-transparent rounded-lg text-[13px] font-bold text-slate-600">{selectedStudent.bloodType || '-'}</div>
                                )}
                              </div>
                              <div className="space-y-1">
                                <label className="text-[12px] font-black text-slate-700">เบอร์โทรศัพท์ <span className="text-rose-500">*</span></label>
                                {isEditMode ? (
                                  <input
                                    value={detailForm?.phone || ''}
                                    onChange={e => handleDetailFormChange('phone', e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none focus:border-blue-500 transition-all"
                                  />
                                ) : (
                                  <div className="px-3 py-2 bg-slate-50 border border-transparent rounded-lg text-[13px] font-bold text-slate-600">{selectedStudent.phone || '-'}</div>
                                )}
                              </div>
                              <div className="space-y-1 col-span-2">
                                <label className="text-[12px] font-black text-slate-700">อีเมล <span className="text-rose-500">*</span></label>
                                {isEditMode ? (
                                  <input
                                    type="email"
                                    value={detailForm?.email || ''}
                                    onChange={e => handleDetailFormChange('email', e.target.value)}
                                    placeholder="example@school.ac.th"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none focus:border-blue-500 transition-all"
                                  />
                                ) : (
                                  <div className="px-3 py-2 bg-slate-50 border border-transparent rounded-lg text-[13px] font-bold text-slate-600">{selectedStudent.email || '-'}</div>
                                )}
                              </div>
                              <div className="space-y-1">
                                <label className="text-[12px] font-black text-slate-700">วัน/เดือน/ปีเกิด <span className="text-rose-500">*</span></label>
                                {isEditMode ? (
                                  <input
                                    type="date"
                                    value={detailForm?.birthDate || ''}
                                    onChange={e => handleDetailFormChange('birthDate', e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none focus:border-blue-500 transition-all"
                                  />
                                ) : (
                                  <div className="px-3 py-2 bg-slate-50 border border-transparent rounded-lg text-[13px] font-bold text-slate-600">{selectedStudent.birthDate || '-'}</div>
                                )}
                              </div>
                              <div className="space-y-1">
                                <label className="text-[12px] font-black text-slate-700">อายุ (ปี)</label>
                                <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-[13px] font-bold text-slate-400">
                                  {calcAge(selectedStudent.birthDate) || '-'}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-12">
                              {/* เพื่อนสนิท Section */}
                              <div className="space-y-4">
                                <h3 className="text-[14px] font-black text-slate-800">
                                  เพื่อนสนิทในโรงเรียน
                                </h3>
                                <div className="space-y-3">
                                  {[1, 2].map(i => (
                                    <div key={i} className="space-y-1">
                                      {isEditMode ? (
                                        <StudentAutocompleteInput
                                          value={detailForm?.[`friends_inSchool${i}`] || ''}
                                          onChange={val => handleDetailFormChange(`friends_inSchool${i}`, val)}
                                          placeholder="เพื่อนสนิทในโรงเรียน (ระบุ - หากไม่มี)"
                                          students={students}
                                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-bold outline-none focus:border-blue-500 transition-all"
                                        />
                                      ) : (
                                        <div className="px-3 py-2 bg-slate-50 border border-transparent rounded-lg text-[13px] font-bold text-slate-600">
                                          {(selectedStudent[`friends_inSchool${i}` as keyof Student] as any) || '-'}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  <div className="space-y-1">
                                    <label className="text-[12px] font-black text-slate-700">เพื่อนที่อยู่ใกล้บ้าน</label>
                                    {isEditMode ? (
                                      <input
                                        value={detailForm?.friends_outside || ''}
                                        onChange={e => handleDetailFormChange('friends_outside', e.target.value)}
                                        placeholder="ระบุชื่อเพื่อน (ระบุ - หากไม่มี)"
                                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-[13px] font-bold outline-none"
                                      />
                                    ) : (
                                      <div className="px-3 py-2 bg-slate-50 border border-transparent rounded-lg text-[13px] font-bold text-slate-600">
                                        {selectedStudent.friends_outside || '-'}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* ข้อมูลการเงิน Section */}
                              <div className="space-y-4">
                                <h3 className="text-[14px] font-black text-slate-800">
                                  ข้อมูลการเงิน
                                </h3>
                                <div className="space-y-4">
                                  <div className="flex items-center gap-3">
                                    <span className="text-[13px] font-bold text-slate-700">ได้เงินมาโรงเรียนวันละ <span className="text-rose-500">*</span></span>
                                    {isEditMode ? (
                                      <input
                                        type="number"
                                        value={detailForm?.financial_dailyAllowance || ''}
                                        onChange={e => handleDetailFormChange('financial_dailyAllowance', Number(e.target.value))}
                                        className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold"
                                      />
                                    ) : (
                                      <span className="font-black text-blue-600">{selectedStudent.financial_dailyAllowance || 0}</span>
                                    )}
                                    <span className="text-[13px] font-bold text-slate-500">บาท</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[13px] font-bold text-slate-700">เหลือเก็บวันละ <span className="text-rose-500">*</span></span>
                                    {isEditMode ? (
                                      <input
                                        type="number"
                                        value={detailForm?.financial_dailySavings || ''}
                                        onChange={e => handleDetailFormChange('financial_dailySavings', Number(e.target.value))}
                                        className="w-20 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold"
                                      />
                                    ) : (
                                      <span className="font-black text-blue-600">{selectedStudent.financial_dailySavings || 0}</span>
                                    )}
                                    <span className="text-[13px] font-bold text-slate-500">บาท (กรอก 0 ถ้าไม่มี)</span>
                                  </div>
                                  <div className="flex items-center gap-6 pt-2">
                                    <span className="text-rose-500 font-bold">*</span>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name="financial_status"
                                        checked={isEditMode ? detailForm?.financial_status === 'enough' : selectedStudent.financial_status === 'enough'}
                                        onChange={() => isEditMode && handleDetailFormChange('financial_status', 'enough')}
                                        disabled={!isEditMode}
                                        className="w-4 h-4 text-blue-600"
                                      />
                                      <span className="text-[13px] font-bold">พอใช้</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                      <input
                                        type="radio"
                                        name="financial_status"
                                        checked={isEditMode ? detailForm?.financial_status === 'not_enough' : selectedStudent.financial_status === 'not_enough'}
                                        onChange={() => isEditMode && handleDetailFormChange('financial_status', 'not_enough')}
                                        disabled={!isEditMode}
                                        className="w-4 h-4 text-blue-600"
                                      />
                                      <span className="text-[13px] font-bold">ไม่พอใช้</span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {detailTab === 'family' && (
                          <div className="space-y-6">

                            <div className="flex items-center gap-3 mb-6">
                              <span className="text-[13px] font-bold text-slate-700">สมาชิกในครอบครัวมีทั้งหมด <span className="text-rose-500">*</span></span>
                              {isEditMode ? (
                                <input
                                  type="number"
                                  value={detailForm?.familyCount || ''}
                                  onChange={e => handleDetailFormChange('familyCount', Number(e.target.value))}
                                  className="w-20 px-3 py-1.5 border border-slate-200 rounded-lg text-center font-bold"
                                />
                              ) : (
                                <span className="font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-lg">{selectedStudent.familyCount || 0}</span>
                              )}
                              <span className="text-[13px] font-bold text-slate-500">คน (รวมตัวนักเรียน)</span>
                            </div>

                            <div className="overflow-x-auto border border-slate-100 rounded-2xl">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-blue-50 text-[12px] font-black text-blue-600">
                                    <th className="p-3 border-b border-blue-100 text-center w-12">#</th>
                                    <th className="p-3 border-b border-blue-100 min-w-[150px]">ชื่อ - สกุล</th>
                                    <th className="p-3 border-b border-blue-100 min-w-[100px]">ความสัมพันธ์</th>
                                    <th className="p-3 border-b border-blue-100 w-20">อายุ</th>
                                    <th className="p-3 border-b border-blue-100">การศึกษา</th>
                                    <th className="p-3 border-b border-blue-100">อาชีพ</th>
                                    <th className="p-3 border-b border-blue-100">รายได้/เดือน</th>
                                    <th className="p-3 border-b border-blue-100 text-center w-12">ลบ</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {((isEditMode ? detailForm?.familyMembers : selectedStudent.familyMembers) || []).map((m: any, idx: number) => (
                                    <tr key={m.id || idx} className="hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                                      <td className="p-3 text-center text-[13px] font-bold text-slate-400">{idx + 1}</td>
                                      <td className="p-2">
                                        {isEditMode ? (
                                          <div className="flex gap-2">
                                            <input
                                              value={m.firstName || ''}
                                              onChange={e => {
                                                const members = [...(detailForm.familyMembers || [])];
                                                members[idx] = { ...members[idx], firstName: e.target.value };
                                                handleDetailFormChange('familyMembers', members);
                                              }}
                                              placeholder="ชื่อ"
                                              className="w-full px-2 py-1.5 border border-slate-100 rounded-lg text-[13px] font-bold"
                                            />
                                            <input
                                              value={m.lastName || ''}
                                              onChange={e => {
                                                const members = [...(detailForm.familyMembers || [])];
                                                members[idx] = { ...members[idx], lastName: e.target.value };
                                                handleDetailFormChange('familyMembers', members);
                                              }}
                                              placeholder="นามสกุล"
                                              className="w-full px-2 py-1.5 border border-slate-100 rounded-lg text-[13px] font-bold"
                                            />
                                          </div>
                                        ) : (
                                          <span className="text-[13px] font-bold text-slate-700">{(m.prefix || '') + (m.firstName || '') + ' ' + (m.lastName || '') || '-'}</span>
                                        )}
                                      </td>
                                      <td className="p-2">
                                        {isEditMode ? (
                                          <input
                                            value={m.relation || ''}
                                            onChange={e => {
                                              const members = [...(detailForm.familyMembers || [])];
                                              members[idx] = { ...members[idx], relation: e.target.value };
                                              handleDetailFormChange('familyMembers', members);
                                            }}
                                            className="w-full px-2 py-1.5 border border-slate-100 rounded-lg text-[13px] font-bold"
                                          />
                                        ) : (
                                          <span className="text-[13px] font-bold text-slate-700">{m.relation || '-'}</span>
                                        )}
                                      </td>
                                      <td className="p-2">
                                        {isEditMode ? (
                                          <input
                                            type="number"
                                            value={m.age || ''}
                                            onChange={e => {
                                              const members = [...(detailForm.familyMembers || [])];
                                              members[idx] = { ...members[idx], age: Number(e.target.value) };
                                              handleDetailFormChange('familyMembers', members);
                                            }}
                                            className="w-full px-2 py-1.5 border border-slate-100 rounded-lg text-[13px] font-bold text-center"
                                          />
                                        ) : (
                                          <span className="text-[13px] font-bold text-slate-700 block text-center">{m.age || '-'}</span>
                                        )}
                                      </td>
                                      <td className="p-2">
                                        {isEditMode ? (
                                          <input
                                            value={m.education || ''}
                                            onChange={e => {
                                              const members = [...(detailForm.familyMembers || [])];
                                              members[idx] = { ...members[idx], education: e.target.value };
                                              handleDetailFormChange('familyMembers', members);
                                            }}
                                            className="w-full px-2 py-1.5 border border-slate-100 rounded-lg text-[13px] font-bold"
                                          />
                                        ) : (
                                          <span className="text-[13px] font-bold text-slate-700">{m.education || '-'}</span>
                                        )}
                                      </td>
                                      <td className="p-2">
                                        {isEditMode ? (
                                          <input
                                            value={m.occupation || ''}
                                            onChange={e => {
                                              const members = [...(detailForm.familyMembers || [])];
                                              members[idx] = { ...members[idx], occupation: e.target.value };
                                              handleDetailFormChange('familyMembers', members);
                                            }}
                                            className="w-full px-2 py-1.5 border border-slate-100 rounded-lg text-[13px] font-bold"
                                          />
                                        ) : (
                                          <span className="text-[13px] font-bold text-slate-700">{m.occupation || '-'}</span>
                                        )}
                                      </td>
                                      <td className="p-2">
                                        {isEditMode ? (
                                          <input
                                            type="number"
                                            value={m.income || ''}
                                            onChange={e => {
                                              const members = [...(detailForm.familyMembers || [])];
                                              members[idx] = { ...members[idx], income: Number(e.target.value) };
                                              handleDetailFormChange('familyMembers', members);
                                            }}
                                            className="w-full px-2 py-1.5 border border-slate-100 rounded-lg text-[13px] font-bold"
                                          />
                                        ) : (
                                          <span className="text-[13px] font-bold text-slate-700">{m.income ? m.income.toLocaleString() : '-'}</span>
                                        )}
                                      </td>
                                      <td className="p-2 text-center">
                                        {isEditMode && (
                                          <button
                                            onClick={() => {
                                              const members = (detailForm.familyMembers || []).filter((_: any, i: number) => i !== idx);
                                              handleDetailFormChange('familyMembers', members);
                                            }}
                                            className="text-rose-500 hover:text-rose-700 p-1.5 hover:bg-rose-50 rounded-lg transition-all"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                  {isEditMode && (detailForm?.familyMembers || []).length === 0 && (
                                    <tr>
                                      <td colSpan={8} className="p-12 text-center text-slate-400 font-bold italic">ยังไม่มีข้อมูลสมาชิกครอบครัว</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {isEditMode && (
                              <button
                                onClick={() => {
                                  const members = [...(detailForm.familyMembers || [])];
                                  members.push({ id: Date.now().toString(), name: '', relation: '', age: 0, education: '', occupation: '', income: 0 });
                                  handleDetailFormChange('familyMembers', members);
                                }}
                                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[13px] font-black shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
                              >
                                <X size={16} className="rotate-45" />
                                เพิ่มสมาชิก
                              </button>
                            )}

                            <div className="h-px bg-slate-100 my-8" />

                            <div className="grid grid-cols-2 gap-12">
                              <div>
                                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">ข้อมูลผู้ปกครอง (ฉุกเฉิน)</h3>
                                <div className="space-y-4">
                                  {isEditMode ? (
                                    <>
                                      <div className="flex gap-2">
                                        <div className="w-24 space-y-1">
                                          <label className="text-[10px] font-black text-slate-400 uppercase">คำนำหน้า</label>
                                          <select
                                            value={detailForm?.guardianPrefix || ''}
                                            onChange={e => handleDetailFormChange('guardianPrefix', e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                                          >
                                            <option value="">เลือก</option>
                                            {guardianPrefixes.map(p => <option key={p} value={p}>{p}</option>)}
                                          </select>
                                        </div>
                                        <div className="flex-1 space-y-1">
                                          <label className="text-[10px] font-black text-slate-400 uppercase">ชื่อ</label>
                                          <input
                                            value={detailForm?.guardianFirstName || ''}
                                            onChange={e => handleDetailFormChange('guardianFirstName', e.target.value)}
                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all"
                                          />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                          <label className="text-[10px] font-black text-slate-400 uppercase">นามสกุล</label>
                                          <input
                                            value={detailForm?.guardianLastName || ''}
                                            onChange={e => handleDetailFormChange('guardianLastName', e.target.value)}
                                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase">เบอร์โทรติดต่อ</label>
                                        <input
                                          value={detailForm?.guardianPhone || ''}
                                          onChange={e => handleDetailFormChange('guardianPhone', e.target.value)}
                                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all"
                                        />
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <InfoRow icon={User} label="ชื่อผู้ปกครอง" value={`${selectedStudent.guardianPrefix || ''}${selectedStudent.guardianFirstName} ${selectedStudent.guardianLastName || ''}${selectedStudent.guardianRelation ? ` (${selectedStudent.guardianRelation})` : ''}`} />
                                      <InfoRow icon={Phone} label="เบอร์โทร" value={selectedStudent.guardianPhone} />
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {detailTab === 'academic' && (
                          <div className="space-y-6">

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[12px] font-black text-slate-700">วิชาที่ชอบมากที่สุด <span className="text-rose-500">*</span></label>
                                {isEditMode ? (
                                  <input value={detailForm?.edu_favoriteSubject || ''} onChange={e => handleDetailFormChange('edu_favoriteSubject', e.target.value)} placeholder="ระบุ - หากไม่มี" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none" />
                                ) : (
                                  <div className="px-3 py-2 bg-slate-50 rounded-lg text-[13px] font-bold text-slate-600">{selectedStudent.edu_favoriteSubject || '-'}</div>
                                )}
                              </div>
                              <div className="space-y-1">
                                <label className="text-[12px] font-black text-slate-700">เพราะ: <span className="text-rose-500">*</span></label>
                                {isEditMode ? (
                                  <input value={detailForm?.edu_favoriteSubjectReason || ''} onChange={e => handleDetailFormChange('edu_favoriteSubjectReason', e.target.value)} placeholder="ระบุเหตุผล หรือ - หากไม่มี" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none" />
                                ) : (
                                  <div className="px-3 py-2 bg-slate-50 rounded-lg text-[13px] font-bold text-slate-600">{selectedStudent.edu_favoriteSubjectReason || '-'}</div>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <label className="text-[12px] font-black text-slate-700">วิชาที่ชอบน้อยที่สุด <span className="text-rose-500">*</span></label>
                                {isEditMode ? (
                                  <input value={detailForm?.edu_leastFavoriteSubject || ''} onChange={e => handleDetailFormChange('edu_leastFavoriteSubject', e.target.value)} placeholder="ระบุ - หากไม่มี" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none" />
                                ) : (
                                  <div className="px-3 py-2 bg-slate-50 rounded-lg text-[13px] font-bold text-slate-600">{selectedStudent.edu_leastFavoriteSubject || '-'}</div>
                                )}
                              </div>
                              <div className="space-y-1">
                                <label className="text-[12px] font-black text-slate-700">เพราะ: <span className="text-rose-500">*</span></label>
                                {isEditMode ? (
                                  <input value={detailForm?.edu_leastFavoriteSubjectReason || ''} onChange={e => handleDetailFormChange('edu_leastFavoriteSubjectReason', e.target.value)} placeholder="ระบุเหตุผล หรือ - หากไม่มี" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none" />
                                ) : (
                                  <div className="px-3 py-2 bg-slate-50 rounded-lg text-[13px] font-bold text-slate-600">{selectedStudent.edu_leastFavoriteSubjectReason || '-'}</div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[12px] font-black text-slate-700">ความสามารถพิเศษ <span className="text-rose-500">*</span></label>
                              {isEditMode ? (
                                <input value={detailForm?.edu_specialTalent || ''} onChange={e => handleDetailFormChange('edu_specialTalent', e.target.value)} placeholder="ระบุ - หากไม่มี" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none" />
                              ) : (
                                <div className="px-3 py-2 bg-slate-50 rounded-lg text-[13px] font-bold text-slate-600">{selectedStudent.edu_specialTalent || '-'}</div>
                              )}
                            </div>


                            <div className="p-6 bg-amber-50 border border-amber-100 rounded-2xl space-y-4">
                              <label className="text-[13px] font-black text-slate-800 block">นักเรียนคิดว่าตนเอง: <span className="text-rose-500">*</span></label>
                              <div className="flex gap-6">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="edu_selfPerception"
                                    checked={isEditMode ? detailForm?.edu_selfPerception === 'no_problem' : selectedStudent.edu_selfPerception === 'no_problem'}
                                    onChange={() => isEditMode && handleDetailFormChange('edu_selfPerception', 'no_problem')}
                                    disabled={!isEditMode}
                                    className="w-4 h-4 text-blue-600"
                                  />
                                  <span className="text-[13px] font-bold">ไม่มีปัญหาด้านการเรียน</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name="edu_selfPerception"
                                    checked={isEditMode ? detailForm?.edu_selfPerception === 'has_problem' : selectedStudent.edu_selfPerception === 'has_problem'}
                                    onChange={() => isEditMode && handleDetailFormChange('edu_selfPerception', 'has_problem')}
                                    disabled={!isEditMode}
                                    className="w-4 h-4 text-blue-600"
                                  />
                                  <span className="text-[13px] font-bold">มีปัญหาด้านการเรียน</span>
                                </label>
                              </div>
                              <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1">
                                  {isEditMode ? (
                                    <input value={detailForm?.edu_problemDetail || ''} onChange={e => handleDetailFormChange('edu_problemDetail', e.target.value)} placeholder="ถ้ามี ปัญหาคือ... (ระบุ - หากไม่มี)" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none" />
                                  ) : (
                                    <div className="text-[13px] font-bold text-slate-600 italic">ปัญหา: {selectedStudent.edu_problemDetail || '-'}</div>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  {isEditMode ? (
                                    <input value={detailForm?.edu_problemCause || ''} onChange={e => handleDetailFormChange('edu_problemCause', e.target.value)} placeholder="สาเหตุ... (ระบุ - หากไม่มี)" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none" />
                                  ) : (
                                    <div className="text-[13px] font-bold text-slate-600 italic">สาเหตุ: {selectedStudent.edu_problemCause || '-'}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {detailTab === 'registration' && (
                          <div className="space-y-6">
                            <div>
                              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">
                                ประวัติการลงทะเบียนเรียน
                              </h3>
                              {!selectedEnrollments || selectedEnrollments.length === 0 ? (
                                <div className="p-12 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                    <ClipboardList size={20} className="text-slate-300" />
                                  </div>
                                  <p className="text-xs text-slate-400 font-bold">ยังไม่มีประวัติการลงทะเบียนในระบบ</p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {selectedEnrollments.map(e => (
                                    <div key={e.id} className="p-5 rounded-2xl bg-white border border-slate-100 flex items-center justify-between hover:shadow-md hover:border-blue-100 transition-all group">
                                      <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                          <span className="text-xs font-black">{e.gradeLevel}</span>
                                        </div>
                                        <div>
                                          <p className="text-[14px] font-black text-slate-800">{e.className} · ภาคเรียน {e.semester}</p>
                                          <p className="text-[11px] font-bold text-slate-400 mt-0.5">ปีการศึกษา {e.academicYearId}</p>
                                        </div>
                                      </div>
                                      <span
                                        className="text-[10px] font-black px-3 py-1.5 rounded-full"
                                        style={{
                                          background: e.status === 'studying' ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.1)',
                                          color: e.status === 'studying' ? '#10b981' : '#64748b',
                                        }}
                                      >
                                        {e.status === 'studying' ? 'กำลังศึกษา' : e.status === 'graduated' ? 'จบการศึกษา' : 'ย้ายออก'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {detailTab === 'visit' && (
                          <div className="space-y-8">

                            {/* Section 1-5 */}
                            <div className="grid grid-cols-1 gap-y-8">
                              <div className="space-y-3">
                                <label className="text-[13px] font-black text-slate-800">1. สถานภาพครอบครัวของนักเรียน <span className="text-rose-500">*</span></label>
                                <div className="flex gap-6">
                                  {['warm', 'unwarm'].map(val => (
                                    <label key={val} className="flex items-center gap-2 cursor-pointer group">
                                      <input
                                        type="radio"
                                        name="visit_familyStatus"
                                        checked={(isEditMode ? detailForm?.visit_familyStatus : selectedStudent.visit_familyStatus) === val}
                                        onChange={() => isEditMode && handleDetailFormChange('visit_familyStatus', val)}
                                        disabled={!isEditMode}
                                        className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                                      />
                                      <span className="text-[13px] font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{val === 'warm' ? 'อบอุ่น' : 'ไม่อบอุ่น'}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <label className="text-[13px] font-black text-slate-800">2. พบว่าบิดาและมารดาเสียชีวิต <span className="text-rose-500">*</span></label>
                                <div className="flex gap-6">
                                  {[true, false].map(val => (
                                    <label key={val.toString()} className="flex items-center gap-2 cursor-pointer group">
                                      <input
                                        type="radio"
                                        name="visit_bothParentsDeceased"
                                        checked={(isEditMode ? detailForm?.visit_bothParentsDeceased : selectedStudent.visit_bothParentsDeceased) === val}
                                        onChange={() => isEditMode && handleDetailFormChange('visit_bothParentsDeceased', val)}
                                        disabled={!isEditMode}
                                        className="w-4 h-4 text-blue-600"
                                      />
                                      <span className="text-[13px] font-bold text-slate-600">{val ? 'ใช่' : 'ไม่ใช่'}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <label className="text-[13px] font-black text-slate-800">3. พบว่าบิดาหรือมารดาเสียชีวิต <span className="text-rose-500">*</span></label>
                                <div className="flex gap-6">
                                  {[true, false].map(val => (
                                    <label key={val.toString()} className="flex items-center gap-2 cursor-pointer group">
                                      <input
                                        type="radio"
                                        name="visit_fatherOrMotherDeceased"
                                        checked={(isEditMode ? detailForm?.visit_fatherOrMotherDeceased : selectedStudent.visit_fatherOrMotherDeceased) === val}
                                        onChange={() => isEditMode && handleDetailFormChange('visit_fatherOrMotherDeceased', val)}
                                        disabled={!isEditMode}
                                        className="w-4 h-4 text-blue-600"
                                      />
                                      <span className="text-[13px] font-bold text-slate-600">{val ? 'ใช่' : 'ไม่ใช่'}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <label className="text-[13px] font-black text-slate-800">4. พบว่าบิดาหรือมารดาเลิกรากัน <span className="text-rose-500">*</span></label>
                                <div className="flex gap-6">
                                  {[true, false].map(val => (
                                    <label key={val.toString()} className="flex items-center gap-2 cursor-pointer group">
                                      <input
                                        type="radio"
                                        name="visit_parentsDivorced"
                                        checked={(isEditMode ? detailForm?.visit_parentsDivorced : selectedStudent.visit_parentsDivorced) === val}
                                        onChange={() => isEditMode && handleDetailFormChange('visit_parentsDivorced', val)}
                                        disabled={!isEditMode}
                                        className="w-4 h-4 text-blue-600"
                                      />
                                      <span className="text-[13px] font-bold text-slate-600">{val ? 'ใช่' : 'ไม่ใช่'}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-3">
                                <label className="text-[13px] font-black text-slate-800">5. พบว่านักเรียนไม่ได้อาศัยกับบิดาหรือมารดาของตนเอง <span className="text-rose-500">*</span></label>
                                <div className="flex gap-6">
                                  {[true, false].map(val => (
                                    <label key={val.toString()} className="flex items-center gap-2 cursor-pointer group">
                                      <input
                                        type="radio"
                                        name="visit_notLivingWithParents"
                                        checked={(isEditMode ? detailForm?.visit_notLivingWithParents : selectedStudent.visit_notLivingWithParents) === val}
                                        onChange={() => isEditMode && handleDetailFormChange('visit_notLivingWithParents', val)}
                                        disabled={!isEditMode}
                                        className="w-4 h-4 text-blue-600"
                                      />
                                      <span className="text-[13px] font-bold text-slate-600">{val ? 'ใช่' : 'ไม่ใช่'}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Section 6: Health */}
                            <div className="p-6 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-4">
                              <label className="text-[13px] font-black text-slate-800 block">6. พบว่านักเรียนมีปัญหาสุขภาพ <span className="text-rose-500">*</span></label>
                              <div className="flex items-center gap-8">
                                <div className="flex gap-6">
                                  {[false, true].map(val => (
                                    <label key={val.toString()} className="flex items-center gap-2 cursor-pointer group">
                                      <input
                                        type="radio"
                                        name="visit_healthProblem"
                                        checked={(isEditMode ? detailForm?.visit_healthProblem : selectedStudent.visit_healthProblem) === val}
                                        onChange={() => isEditMode && handleDetailFormChange('visit_healthProblem', val)}
                                        disabled={!isEditMode}
                                        className="w-4 h-4 text-blue-600"
                                      />
                                      <span className="text-[13px] font-bold text-slate-600">{val ? 'ใช่' : 'ไม่ใช่'}</span>
                                    </label>
                                  ))}
                                </div>
                                <div className="flex-1 flex items-center gap-3">
                                  <span className="text-[13px] font-bold text-slate-500 whitespace-nowrap">ปัญหาคือ:</span>
                                  {isEditMode ? (
                                    <input
                                      value={detailForm?.visit_healthProblemDetail || ''}
                                      onChange={e => handleDetailFormChange('visit_healthProblemDetail', e.target.value)}
                                      placeholder="โปรดระบุปัญหา... (ระบุ - หากไม่มี)"
                                      className="flex-1 bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none text-[13px] font-bold py-1 transition-all"
                                    />
                                  ) : (
                                    <span className="text-[13px] font-bold text-slate-700 italic border-b border-slate-100 flex-1">{selectedStudent.visit_healthProblemDetail || '-'}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Section 7: Risks */}
                            <div className="p-6 bg-rose-50/30 border border-rose-100 rounded-2xl space-y-4">
                              <label className="text-[13px] font-black text-rose-600 flex items-center gap-2">
                                <AlertCircle size={16} />
                                7. พบว่านักเรียนมีพฤติกรรมเสี่ยงด้านใดบ้าง * (ตอบอย่างน้อย 1 ข้อ หากไม่มีให้เลือกช่องไม่มี)
                              </label>
                              <div className="grid grid-cols-3 gap-y-4 gap-x-8">
                                {[
                                  { key: 'none', label: 'ไม่มีความเสี่ยง' },
                                  { key: 'health', label: 'สุขภาพ' },
                                  { key: 'substance', label: 'การใช้สารเสพติด' },
                                  { key: 'violence', label: 'ความรุนแรง' },
                                  { key: 'travel', label: 'การเดินทางมาเรียน' },
                                  { key: 'sexual', label: 'ด้านเพศ' },
                                  { key: 'gaming', label: 'การติดเกมส์' }
                                ].map(risk => (
                                  <label key={risk.key} className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                      type="checkbox"
                                      checked={isEditMode
                                        ? (detailForm?.visit_risks || []).includes(risk.key)
                                        : (selectedStudent.visit_risks || []).includes(risk.key)}
                                      onChange={() => {
                                        if (!isEditMode) return;
                                        const current = detailForm?.visit_risks || [];
                                        const next = current.includes(risk.key)
                                          ? current.filter((k: string) => k !== risk.key)
                                          : [...current, risk.key];
                                        handleDetailFormChange('visit_risks', next);
                                      }}
                                      disabled={!isEditMode}
                                      className="w-4 h-4 text-rose-500 rounded border-slate-300 focus:ring-rose-500"
                                    />
                                    <span className="text-[13px] font-bold text-slate-600 group-hover:text-slate-900">{risk.label}</span>
                                  </label>
                                ))}
                                <div className="col-span-2 flex items-center gap-3">
                                  <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                      type="checkbox"
                                      checked={isEditMode
                                        ? (detailForm?.visit_risks || []).includes('others')
                                        : (selectedStudent.visit_risks || []).includes('others')}
                                      onChange={() => {
                                        if (!isEditMode) return;
                                        const current = detailForm?.visit_risks || [];
                                        const next = current.includes('others')
                                          ? current.filter((k: string) => k !== 'others')
                                          : [...current, 'others'];
                                        handleDetailFormChange('visit_risks', next);
                                      }}
                                      disabled={!isEditMode}
                                      className="w-4 h-4 text-rose-500 rounded border-slate-300"
                                    />
                                    <span className="text-[13px] font-bold text-slate-600 whitespace-nowrap">อื่นๆ</span>
                                  </label>
                                  {isEditMode ? (
                                    <input
                                      value={detailForm?.visit_riskDetail || ''}
                                      onChange={e => handleDetailFormChange('visit_riskDetail', e.target.value)}
                                      placeholder="ระบุความเสี่ยงอื่นๆ... (หากไม่มีเว้นว่างไว้)"
                                      className="flex-1 bg-transparent border-b border-rose-200 focus:border-rose-500 outline-none text-[13px] font-bold py-1 transition-all"
                                    />
                                  ) : (
                                    <span className="text-[13px] font-bold text-slate-700 italic border-b border-rose-50 flex-1">{selectedStudent.visit_riskDetail || '-'}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Section 8: Economic */}
                            <div className="space-y-3">
                              <label className="text-[13px] font-black text-slate-800">8. พบว่านักเรียนมีปัญหาด้านเศรษฐกิจ <span className="text-rose-500">*</span></label>
                              <div className="flex gap-6">
                                {[true, false].map(val => (
                                  <label key={val.toString()} className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                      type="radio"
                                      name="visit_economicProblem"
                                      checked={(isEditMode ? detailForm?.visit_economicProblem : selectedStudent.visit_economicProblem) === val}
                                      onChange={() => isEditMode && handleDetailFormChange('visit_economicProblem', val)}
                                      disabled={!isEditMode}
                                      className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-[13px] font-bold text-slate-600">{val ? 'ใช่' : 'ไม่ใช่'}</span>
                                  </label>
                                ))}
                              </div>
                            </div>

                            {/* Section 9: Advisor Opinion */}
                            <div className="p-6 bg-amber-50/50 border border-amber-100 rounded-2xl space-y-4">
                              <label className="text-[13px] font-black text-slate-800 block">9. ในฐานะครูที่ปรึกษา มีความคิดเห็นว่าควรได้รับการช่วยเหลือเร่งด่วน <span className="text-rose-500">*</span></label>
                              <div className="flex gap-6">
                                {[true, false].map(val => (
                                  <label key={val.toString()} className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                      type="radio"
                                      name="visit_urgentHelpNeeded"
                                      checked={(isEditMode ? detailForm?.visit_urgentHelpNeeded : selectedStudent.visit_urgentHelpNeeded) === val}
                                      onChange={() => isEditMode && handleDetailFormChange('visit_urgentHelpNeeded', val)}
                                      disabled={!isEditMode}
                                      className="w-4 h-4 text-blue-600"
                                    />
                                    <span className="text-[13px] font-bold text-slate-600">{val ? 'ใช่' : 'ไม่ใช่'}</span>
                                  </label>
                                ))}
                              </div>
                              <div className="space-y-1">
                                {isEditMode ? (
                                  <input
                                    value={detailForm?.visit_urgentHelpDetail || ''}
                                    onChange={e => handleDetailFormChange('visit_urgentHelpDetail', e.target.value)}
                                    placeholder="อธิบายถึงการช่วยเหลือเร่งด่วน... (ระบุ - หากไม่มี)"
                                    className="w-full bg-transparent border-b border-amber-200 focus:border-amber-500 outline-none text-[13px] font-bold py-1 transition-all"
                                  />
                                ) : (
                                  <p className="text-[13px] font-bold text-slate-700 italic">{selectedStudent.visit_urgentHelpDetail || '-'} </p>
                                )}
                              </div>
                            </div>

                            <div className="h-px bg-slate-100 my-8" />

                            {/* Section 10-17: Grid layout */}
                            <div className="space-y-8">
                              <div className="space-y-4">
                                <label className="text-[13px] font-black text-slate-800 block">10. สถานะที่อยู่อาศัย <span className="text-rose-500">*</span></label>
                                <div className="flex gap-8">
                                  {[
                                    { key: 'own', label: 'บ้านตนเอง' },
                                    { key: 'rent', label: 'บ้านเช่า' },
                                    { key: 'relative', label: 'บ้านญาติ' },
                                    { key: 'welfare', label: 'ที่พักสวัสดิการ' }
                                  ].map(item => (
                                    <label key={item.key} className="flex items-center gap-2 cursor-pointer group">
                                      <input
                                        type="radio"
                                        name="visit_housingStatus"
                                        checked={(isEditMode ? detailForm?.visit_housingStatus : selectedStudent.visit_housingStatus) === item.key}
                                        onChange={() => isEditMode && handleDetailFormChange('visit_housingStatus', item.key)}
                                        disabled={!isEditMode}
                                        className="w-4 h-4 text-blue-600"
                                      />
                                      <span className="text-[13px] font-bold text-slate-600">{item.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-4">
                                <label className="text-[13px] font-black text-slate-800 block">11. ลักษณะของที่อยู่อาศัย <span className="text-rose-500">*</span></label>
                                <div className="flex items-center gap-8">
                                  <div className="flex gap-8">
                                    {[
                                      { key: 'single_floor', label: 'บ้านชั้นเดียว' },
                                      { key: 'two_floors', label: 'บ้าน 2 ชั้น' }
                                    ].map(item => (
                                      <label key={item.key} className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                          type="radio"
                                          name="visit_housingType"
                                          checked={(isEditMode ? detailForm?.visit_housingType : selectedStudent.visit_housingType) === item.key}
                                          onChange={() => isEditMode && handleDetailFormChange('visit_housingType', item.key)}
                                          disabled={!isEditMode}
                                          className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-[13px] font-bold text-slate-600">{item.label}</span>
                                      </label>
                                    ))}
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                      <input
                                        type="radio"
                                        name="visit_housingType"
                                        checked={(isEditMode ? detailForm?.visit_housingType : selectedStudent.visit_housingType) === 'others'}
                                        onChange={() => isEditMode && handleDetailFormChange('visit_housingType', 'others')}
                                        disabled={!isEditMode}
                                        className="w-4 h-4 text-blue-600"
                                      />
                                      <span className="text-[13px] font-bold text-slate-600">อื่นๆ</span>
                                    </label>
                                  </div>
                                  {isEditMode ? (
                                    <input
                                      value={detailForm?.visit_housingTypeDetail || ''}
                                      onChange={e => handleDetailFormChange('visit_housingTypeDetail', e.target.value)}
                                      placeholder="โปรดระบุ..."
                                      className="flex-1 max-w-[200px] bg-transparent border-b border-slate-200 focus:border-blue-500 outline-none text-[13px] font-bold py-1 transition-all"
                                    />
                                  ) : (
                                    <span className="text-[13px] font-bold text-slate-700 italic">{selectedStudent.visit_housingTypeDetail || ''}</span>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-12">
                                <div className="space-y-4">
                                  <label className="text-[13px] font-black text-slate-800 block">12. สภาพแวดล้อมชุมชนที่นักเรียนอาศัยอยู่ <span className="text-rose-500">*</span></label>
                                  <div className="flex gap-8">
                                    {[
                                      { key: 'safe', label: 'ปลอดภัย' },
                                      { key: 'unsafe', label: 'ไม่ปลอดภัย' }
                                    ].map(item => (
                                      <label key={item.key} className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                          type="radio"
                                          name="visit_communityEnvironment"
                                          checked={(isEditMode ? detailForm?.visit_communityEnvironment : selectedStudent.visit_communityEnvironment) === item.key}
                                          onChange={() => isEditMode && handleDetailFormChange('visit_communityEnvironment', item.key)}
                                          disabled={!isEditMode}
                                          className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-[13px] font-bold text-slate-600">{item.label}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <label className="text-[13px] font-black text-slate-800 block">13. ความประพฤติของนักเรียนขณะอยู่บ้าน <span className="text-rose-500">*</span></label>
                                  <div className="flex gap-8">
                                    {[
                                      { key: 'good', label: 'เรียบร้อย' },
                                      { key: 'disobedient', label: 'ดื้อไม่เชื่อฟังผู้ปกครอง' }
                                    ].map(item => (
                                      <label key={item.key} className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                          type="radio"
                                          name="visit_homeBehavior"
                                          checked={(isEditMode ? detailForm?.visit_homeBehavior : selectedStudent.visit_homeBehavior) === item.key}
                                          onChange={() => isEditMode && handleDetailFormChange('visit_homeBehavior', item.key)}
                                          disabled={!isEditMode}
                                          className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-[13px] font-bold text-slate-600">{item.label}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <label className="text-[13px] font-black text-slate-800 block">14. หน้าที่ความรับผิดชอบของนักเรียนต่อทางบ้าน <span className="text-rose-500">*</span></label>
                                <div className="flex gap-8">
                                  {[
                                    { key: 'has_tasks', label: 'มีหน้าที่ได้รับมอบหมาย' },
                                    { key: 'no_tasks', label: 'ไม่มีหน้าที่ได้รับมอบหมาย' }
                                  ].map(item => (
                                    <label key={item.key} className="flex items-center gap-2 cursor-pointer group">
                                      <input
                                        type="radio"
                                        name="visit_homeResponsibility"
                                        checked={(isEditMode ? detailForm?.visit_homeResponsibility : selectedStudent.visit_homeResponsibility) === item.key}
                                        onChange={() => isEditMode && handleDetailFormChange('visit_homeResponsibility', item.key)}
                                        disabled={!isEditMode}
                                        className="w-4 h-4 text-blue-600"
                                      />
                                      <span className="text-[13px] font-bold text-slate-600">{item.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-12">
                                <div className="space-y-4">
                                  <label className="text-[13px] font-black text-slate-800 block">15. การหารายได้พิเศษในช่วงวันหยุดหรือเวลาเลิกเรียน <span className="text-rose-500">*</span></label>
                                  <div className="flex gap-8">
                                    {[true, false].map(val => (
                                      <label key={val.toString()} className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                          type="radio"
                                          name="visit_partTimeIncome"
                                          checked={(isEditMode ? detailForm?.visit_partTimeIncome : selectedStudent.visit_partTimeIncome) === val}
                                          onChange={() => isEditMode && handleDetailFormChange('visit_partTimeIncome', val)}
                                          disabled={!isEditMode}
                                          className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-[13px] font-bold text-slate-600">{val ? 'มี' : 'ไม่มี'}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <label className="text-[13px] font-black text-slate-800 block">16. การเข้าถึงอินเทอร์เน็ต <span className="text-rose-500">*</span></label>
                                  <div className="flex gap-8">
                                    {[true, false].map(val => (
                                      <label key={val.toString()} className="flex items-center gap-2 cursor-pointer group">
                                        <input
                                          type="radio"
                                          name="visit_internetAccess"
                                          checked={(isEditMode ? detailForm?.visit_internetAccess : selectedStudent.visit_internetAccess) === val}
                                          onChange={() => isEditMode && handleDetailFormChange('visit_internetAccess', val)}
                                          disabled={!isEditMode}
                                          className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-[13px] font-bold text-slate-600">{val ? 'เข้าถึงได้' : 'ไม่สามารถเข้าถึงได้'}</span>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <label className="text-[13px] font-black text-slate-800 block">17. ความพร้อมของอุปกรณ์การเรียน <span className="text-rose-500">*</span></label>
                                <div className="flex gap-8">
                                  {[
                                    { key: 'ready', label: 'มีความพร้อม' },
                                    { key: 'not_ready', label: 'ไม่มีความพร้อม' }
                                  ].map(item => (
                                    <label key={item.key} className="flex items-center gap-2 cursor-pointer group">
                                      <input
                                        type="radio"
                                        name="visit_learningEquipment"
                                        checked={(isEditMode ? detailForm?.visit_learningEquipment : selectedStudent.visit_learningEquipment) === item.key}
                                        onChange={() => isEditMode && handleDetailFormChange('visit_learningEquipment', item.key)}
                                        disabled={!isEditMode}
                                        className="w-4 h-4 text-blue-600"
                                      />
                                      <span className="text-[13px] font-bold text-slate-600">{item.label}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {detailTab === 'map' && (
                          <div className="space-y-8">

                            {/* ที่อยู่ปัจจุบัน Section */}
                            <div className="p-8 bg-slate-50 border border-slate-100 rounded-3xl space-y-6">
                              <h3 className="text-[16px] font-black text-slate-800">
                                ที่อยู่ปัจจุบัน
                              </h3>
                              <div className="grid grid-cols-3 gap-6">
                                <div className="space-y-1">
                                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">บ้านเลขที่ <span className="text-rose-500">*</span></label>
                                  {isEditMode ? (
                                    <input value={detailForm?.address_houseNo || ''} onChange={e => handleDetailFormChange('address_houseNo', e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                                  ) : (
                                    <div className="px-4 py-2 bg-white border border-transparent rounded-xl text-sm font-bold text-slate-700">{selectedStudent.address_houseNo || '-'}</div>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">หมู่ที่ <span className="text-rose-500">*</span></label>
                                  {isEditMode ? (
                                    <input value={detailForm?.address_moo || ''} onChange={e => handleDetailFormChange('address_moo', e.target.value)} placeholder="ระบุ - หากไม่มี" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                                  ) : (
                                    <div className="px-4 py-2 bg-white border border-transparent rounded-xl text-sm font-bold text-slate-700">{selectedStudent.address_moo || '-'}</div>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">ชื่อหมู่บ้าน/ชุมชน <span className="text-rose-500">*</span></label>
                                  {isEditMode ? (
                                    <input value={detailForm?.address_village || ''} onChange={e => handleDetailFormChange('address_village', e.target.value)} placeholder="ระบุ - หากไม่มี" className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                                  ) : (
                                    <div className="px-4 py-2 bg-white border border-transparent rounded-xl text-sm font-bold text-slate-700">{selectedStudent.address_village || '-'}</div>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-4 gap-6">
                                <div className="space-y-1">
                                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">ตำบล <span className="text-rose-500">*</span></label>
                                  {isEditMode ? (
                                    <input value={detailForm?.address_subdistrict || ''} onChange={e => handleDetailFormChange('address_subdistrict', e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                                  ) : (
                                    <div className="px-4 py-2 bg-white border border-transparent rounded-xl text-sm font-bold text-slate-700">{selectedStudent.address_subdistrict || '-'}</div>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">อำเภอ <span className="text-rose-500">*</span></label>
                                  {isEditMode ? (
                                    <input value={detailForm?.address_district || ''} onChange={e => handleDetailFormChange('address_district', e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                                  ) : (
                                    <div className="px-4 py-2 bg-white border border-transparent rounded-xl text-sm font-bold text-slate-700">{selectedStudent.address_district || '-'}</div>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">จังหวัด <span className="text-rose-500">*</span></label>
                                  {isEditMode ? (
                                    <input value={detailForm?.address_province || ''} onChange={e => handleDetailFormChange('address_province', e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                                  ) : (
                                    <div className="px-4 py-2 bg-white border border-transparent rounded-xl text-sm font-bold text-slate-700">{selectedStudent.address_province || '-'}</div>
                                  )}
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">รหัสไปรษณีย์ <span className="text-rose-500">*</span></label>
                                  {isEditMode ? (
                                    <input value={detailForm?.address_postalCode || ''} onChange={e => handleDetailFormChange('address_postalCode', e.target.value)} className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all" />
                                  ) : (
                                    <div className="px-4 py-2 bg-white border border-transparent rounded-xl text-sm font-bold text-slate-700">{selectedStudent.address_postalCode || '-'}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-8">
                              {/* Left: Coordinates & Interactive Map */}
                              <div className="space-y-6">
                                <div className="p-8 bg-slate-50 border border-slate-100 rounded-3xl space-y-6">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                                      <MapPin size={20} />
                                    </div>
                                    <div>
                                      <h3 className="text-sm font-black text-slate-900">พิกัดละติจูด/ลองจิจูด</h3>
                                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Coordinates</p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Latitude</label>
                                      {isEditMode ? (
                                        <input
                                          type="number"
                                          step="any"
                                          value={detailForm?.address_latitude || ''}
                                          onChange={e => handleDetailFormChange('address_latitude', parseFloat(e.target.value))}
                                          placeholder="เช่น 13.7563"
                                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all"
                                        />
                                      ) : (
                                        <div className="px-4 py-2 bg-white border border-transparent rounded-xl text-sm font-bold text-slate-700">{selectedStudent.address_latitude || 'ยังไม่ได้ระบุ'}</div>
                                      )}
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Longitude</label>
                                      {isEditMode ? (
                                        <input
                                          type="number"
                                          step="any"
                                          value={detailForm?.address_longitude || ''}
                                          onChange={e => handleDetailFormChange('address_longitude', parseFloat(e.target.value))}
                                          placeholder="เช่น 100.5018"
                                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all"
                                        />
                                      ) : (
                                        <div className="px-4 py-2 bg-white border border-transparent rounded-xl text-sm font-bold text-slate-700">{selectedStudent.address_longitude || 'ยังไม่ได้ระบุ'}</div>
                                      )}
                                    </div>
                                  </div>

                                  {(isEditMode ? detailForm?.address_latitude : selectedStudent.address_latitude) && (isEditMode ? detailForm?.address_longitude : selectedStudent.address_longitude) ? (
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${isEditMode ? detailForm?.address_latitude : selectedStudent.address_latitude},${isEditMode ? detailForm?.address_longitude : selectedStudent.address_longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-center gap-2 w-full py-3 bg-white border border-slate-200 rounded-2xl text-[13px] font-black text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all group shadow-sm"
                                    >
                                      <MapPin size={16} className="text-blue-600 group-hover:scale-110 transition-transform" />
                                      เปิดใน Google Maps
                                    </a>
                                  ) : (
                                    <div className="p-4 bg-white/50 border border-dashed border-slate-200 rounded-2xl text-center">
                                      <p className="text-[11px] font-bold text-slate-400">ระบุพิกัดเพื่อแสดงปุ่มนำทาง</p>
                                    </div>
                                  )}
                                </div>

                                <div className="overflow-hidden rounded-3xl border border-slate-100 shadow-sm bg-white p-2">
                                  <GoogleMapPicker
                                    lat={isEditMode ? detailForm?.address_latitude : selectedStudent.address_latitude}
                                    lng={isEditMode ? detailForm?.address_longitude : selectedStudent.address_longitude}
                                    isEditMode={isEditMode}
                                    onChange={(lat, lng) => {
                                      handleDetailFormChange('address_latitude', lat);
                                      handleDetailFormChange('address_longitude', lng);
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Right: Photo Map Section */}
                              <div className="p-8 bg-slate-50 border border-slate-100 rounded-3xl space-y-6 h-fit">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-2xl bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
                                    <FileUp size={20} />
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-black text-slate-900">รูปภาพแผนที่บ้าน</h3>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">House Map Photo</p>
                                  </div>
                                </div>

                                <div className="aspect-[4/3] bg-white border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden relative group">
                                  {(isEditMode ? detailForm?.address_mapImageURL : selectedStudent.address_mapImageURL) ? (
                                    <img
                                      src={isEditMode ? detailForm?.address_mapImageURL : selectedStudent.address_mapImageURL}
                                      className="w-full h-full object-cover"
                                      alt="Map"
                                    />
                                  ) : (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
                                      <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                                        <FileUp size={24} strokeWidth={1.5} />
                                      </div>
                                      <p className="text-[11px] font-bold uppercase tracking-widest">ยังไม่มีรูปภาพแผนที่</p>
                                      <p className="text-[10px] text-slate-300 font-bold">สามารถอัปโหลดรูปภาพที่วาดหรือถ่ายไว้ได้</p>
                                    </div>
                                  )}

                                  {isEditMode && (
                                    <div className="absolute inset-0 bg-blue-600/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                                      <label className="cursor-pointer px-6 py-2 bg-white text-blue-600 rounded-full text-[12px] font-black shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                                        อัปโหลดรูปภาพ
                                        <input
                                          type="file"
                                          className="hidden"
                                          accept="image/*"
                                          onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              try {
                                                const compressed = await compressImage(file);
                                                const storageRef = ref(storage, `students/${selectedStudent.id}/house_map.jpg`);
                                                await uploadBytes(storageRef, compressed);
                                                const url = await getDownloadURL(storageRef);
                                                handleDetailFormChange('address_mapImageURL', url);
                                                toast.success('อัปโหลดรูปภาพแผนที่เรียบร้อย');
                                              } catch (error) {
                                                console.error(error);
                                                toast.error('เกิดข้อผิดพลาดในการอัปโหลด');
                                              }
                                            }
                                          }}
                                        />
                                      </label>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>

                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-300">
                <User size={64} className="opacity-10 mb-4" />
                <p className="text-sm font-black opacity-30 uppercase tracking-widest">เลือกนักเรียนเพื่อดูรายละเอียด</p>
              </div>
            )}
          </div>

          {/* DIVIDER */}
          <div className="w-px bg-slate-200/80 shrink-0 self-stretch" />

          {/* RIGHT PANEL — Student List */}
          <div className="w-[20%] lg:w-[250px] xl:w-[320px] shrink-0 flex flex-col pl-4 pt-1">

            {/* Cascading Filter */}
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex items-center bg-[#f2f2f7] rounded-full p-1 overflow-x-auto scrollbar-hide">
                {/* 1. Year */}
                <div className="relative group/filter shrink-0">
                  <select
                    value={filter.academicYearId || ''}
                    onChange={e => setFilter(prev => ({ ...prev, academicYearId: e.target.value, gradeLevel: '', classId: '' }))}
                    className="appearance-none pl-4 pr-6 py-1.5 bg-transparent hover:bg-black/5 text-blue-600 transition-all font-bold text-[12px] outline-none cursor-pointer border-r border-slate-200/60"
                  >
                    <option value="2565">ปี 2565</option>
                    <option value="2566">ปี 2566</option>
                    <option value="2567">ปี 2567</option>
                    <option value="2568">ปี 2568</option>
                    <option value="2569">ปี 2569</option>
                    <option value="2570">ปี 2570</option>
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400 group-hover/filter:text-blue-600 transition-colors">
                    <ChevronDown size={12} />
                  </div>
                </div>

                {/* 2. Department */}
                <div className="relative group/filter shrink-0">
                  <select
                    value={filter.department || ''}
                    onChange={e => {
                      setFilter(prev => ({ ...prev, department: e.target.value, gradeLevel: '', classId: '' }));
                    }}
                    className="appearance-none pl-4 pr-6 py-1.5 bg-transparent hover:bg-black/5 text-blue-600 transition-all font-bold text-[12px] outline-none cursor-pointer border-r border-slate-200/60"
                  >
                    <option value="">แผนก</option>
                    <option value="early">ปฐมวัย</option>
                    <option value="primary">ประถมฯ</option>
                    <option value="secondary">มัธยมฯ</option>
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400 group-hover/filter:text-blue-600 transition-colors">
                    <ChevronDown size={12} />
                  </div>
                </div>

                {/* 3. Grade */}
                <div className="relative group/filter shrink-0">
                  <select
                    value={filter.gradeLevel || ''}
                    disabled={!filter.department}
                    onChange={e => setFilter(prev => ({ ...prev, gradeLevel: e.target.value, classId: '' }))}
                    className="appearance-none pl-4 pr-6 py-1.5 bg-transparent hover:bg-black/5 text-blue-600 transition-all font-bold text-[12px] outline-none cursor-pointer border-r border-slate-200/60 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <option value="">ชั้น</option>
                    {filter.department && GRADE_ORDER[filter.department]?.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400 group-hover/filter:text-blue-600 transition-colors">
                    <ChevronDown size={12} />
                  </div>
                </div>

                {/* 4. Class */}
                <div className="relative group/filter shrink-0 flex-1">
                  <select
                    value={filter.classId || ''}
                    onChange={e => setFilter(prev => ({ ...prev, classId: e.target.value }))}
                    disabled={!filter.gradeLevel}
                    className="appearance-none w-full pl-4 pr-6 py-1.5 bg-transparent hover:bg-black/5 text-blue-600 transition-all font-bold text-[12px] outline-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <option value="">ห้อง</option>
                    {availableClasses.map(c => (
                      <option key={c.classId} value={c.classId}>{c.className}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400 group-hover/filter:text-blue-600 transition-colors">
                    <ChevronDown size={12} />
                  </div>
                </div>
              </div>
            </div>

            {/* Search + Select All */}
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                <input
                  type="text"
                  placeholder="ค้นหา..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-white/70 backdrop-blur-md border border-slate-200 rounded-full text-[10px] font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-300 transition-all w-full outline-none placeholder:text-slate-400 shadow-sm"
                />
              </div>
            </div>

            <div className="h-px bg-slate-100/80 mb-2" />

            {/* Student List — List style matching ClassroomAssignmentTab */}
            <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col pt-1">
              <AnimatePresence>
                {filteredStudentCards.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-slate-400 opacity-50 border-2 border-dashed border-slate-200 rounded-2xl">
                    <Search size={22} className="mb-2" />
                    <span className="text-xs font-bold">ไม่พบรายชื่อ</span>
                  </div>
                ) : (
                  filteredStudentCards.map(({ student, currentGrade }) => {
                    const isSelected = selectedStudentIds.has(student.id);
                    const isActive = selectedId === student.id;

                    return (
                      <motion.div
                        key={student.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => {
                          setSelectedId(student.id);
                          if (selectedStudentIds.size > 0) toggleStudentSelection(student.id);
                        }}
                        className={`group relative flex items-center transition-all cursor-pointer mx-2 my-1.5 ${isSelected || isActive
                          ? 'bg-blue-600 text-white rounded-2xl p-2.5 px-4 z-10'
                          : 'p-2 px-4 border-b border-slate-50/50 hover:bg-slate-50/80 rounded-xl'
                          }`}
                      >
                        <div className="flex-1 flex items-center gap-4 min-w-0">
                          {/* Avatar */}
                          <div className={`w-10 h-10 rounded-xl overflow-hidden shadow-sm shrink-0 transition-all duration-300 ${isSelected || isActive ? 'bg-white p-0.5' : 'bg-slate-100 group-hover:scale-105'}`}>
                            <img
                              src={student.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${student.id}&backgroundColor=f8fafc`}
                              alt="avatar"
                              className="w-full h-full object-cover rounded-[10px]"
                            />
                          </div>

                          {/* Name & ID */}
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-[13px] font-bold truncate tracking-tight block ${isSelected || isActive ? 'text-white' : 'text-slate-900'}`}>
                              {student.prefix}{student.firstName} {student.lastName}
                            </h4>
                            <p className={`text-[10px] font-medium tracking-tight ${isSelected || isActive ? 'text-blue-100/70' : 'text-slate-400'}`}>
                              ID: {student.studentCode || 'N/A'}
                            </p>
                          </div>

                          {/* Action Info */}
                          <div className="flex items-center gap-3 shrink-0">
                            {isSelected || isActive ? (
                              null
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-300 uppercase">
                                  {currentGrade}
                                </span>
                                <MoreHorizontal size={14} className="text-slate-300 group-hover:text-slate-400" />
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>

            {/* Footer count */}
            <div className="pt-3 border-t border-slate-100 mt-2">
              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest text-center">
                รวม {filteredStudentCards.length} รายชื่อ
              </p>
            </div>
          </div>

          {/* Floating Action Bar — when students are multi-selected */}
          <AnimatePresence>
            {selectedStudentIds.size > 0 && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/80 backdrop-blur-2xl text-slate-900 px-4 py-2 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex items-center gap-4 border border-white scale-90 sm:scale-100"
              >
                <div className="flex items-center gap-2">
                  <div className="bg-blue-500 w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white">
                    {selectedStudentIds.size}
                  </div>
                  <span className="font-bold text-[11px] uppercase tracking-wider text-slate-500">รายการที่เลือก</span>
                </div>

                <div className="w-[1px] h-4 bg-slate-200" />

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveTab('class')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-tight flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
                >
                  <DoorOpen size={12} />
                  จัดห้องเรียน
                </motion.button>

                <button
                  onClick={() => setSelectedStudentIds(new Set())}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : activeTab === 'import' ? (
        <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">กำลังโหลด...</div>}>
          <StudentImportTab />
        </Suspense>
      ) : activeTab === 'class' ? (
        <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">กำลังโหลด...</div>}>
          <ClassroomAssignmentTab />
        </Suspense>
      ) : (
        <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">กำลังโหลด...</div>}>
          <StudentTransitionTab />
        </Suspense>
      )}

      <StudentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleFormSubmit}
        editingStudent={editingStudent}
      />
      <Suspense fallback={null}>
        <StudentCsvImportModal
          open={csvModalOpen}
          onClose={() => setCsvModalOpen(false)}
        />
      </Suspense>
    </div>
  );
}
