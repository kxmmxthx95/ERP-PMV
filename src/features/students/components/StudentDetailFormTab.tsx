import { FileUp, LocateFixed } from 'lucide-react';
import {
  HiMapPin,
  HiUser,
  HiPhone,
  HiUsers,
  HiHome,
  HiPhoto,
} from 'react-icons/hi2';
import type { IconType } from 'react-icons';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import { storage } from '@/lib/firebase';
import type { Student } from '@/types/student';
import {
  calcStudentAge,
  compressImage,
  DETAIL_INPUT_CLS,
  DetailViewField,
  EDUCATION_OPTIONS,
  formatNationalId,
  GoogleMapPicker,
  MAP_ADDRESS_INPUT_CLS,
  isNationalIdComplete,
  normalizeNationalId,
  useCurrentLocation,
} from './studentDetailFormShared';

export type StudentDetailTab = 'personal' | 'family' | 'map';

function SectionHeading({
  icon: Icon,
  iconClassName,
  children,
}: {
  icon: IconType;
  iconClassName: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-2 text-[14px] font-black text-slate-800">
      <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} />
      {children}
    </h3>
  );
}

type Props = {
  tab: StudentDetailTab;
  viewData: Student;
  formData: Student;
  isEditMode: boolean;
  onChange: (key: keyof Student, value: unknown) => void;
  guardianPrefixes: string[];
  studentId: string;
};

export function StudentDetailFormTab({
  tab,
  viewData,
  formData,
  isEditMode,
  onChange,
  guardianPrefixes,
  studentId,
}: Props) {
  const handleUseCurrentLocation = useCurrentLocation(isEditMode, (lat, lng) => {
    onChange('address_latitude', lat);
    onChange('address_longitude', lng);
  });

  if (tab === 'personal') {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <SectionHeading icon={HiUser} iconClassName="text-blue-600">
            ข้อมูลพื้นฐาน
          </SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[12px] font-black text-slate-700">คำนำหน้า <span className="text-rose-500">*</span></label>
              {isEditMode ? (
                <select value={formData.prefix || ''} onChange={e => onChange('prefix', e.target.value)} className={DETAIL_INPUT_CLS}>
                  <option value="เด็กชาย">เด็กชาย</option>
                  <option value="เด็กหญิง">เด็กหญิง</option>
                  <option value="นาย">นาย</option>
                  <option value="นางสาว">นางสาว</option>
                </select>
              ) : (
                <DetailViewField value={viewData.prefix} />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-black text-slate-700">ชื่อ <span className="text-rose-500">*</span></label>
              {isEditMode ? (
                <input value={formData.firstName || ''} onChange={e => onChange('firstName', e.target.value)} placeholder="ชื่อ" className={DETAIL_INPUT_CLS} />
              ) : (
                <DetailViewField value={viewData.firstName} />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-black text-slate-700">นามสกุล <span className="text-rose-500">*</span></label>
              {isEditMode ? (
                <input value={formData.lastName || ''} onChange={e => onChange('lastName', e.target.value)} placeholder="นามสกุล" className={DETAIL_INPUT_CLS} />
              ) : (
                <DetailViewField value={viewData.lastName} />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-black text-slate-700">ชื่อเล่น <span className="text-rose-500">*</span></label>
              {isEditMode ? (
                <input value={formData.nickname || ''} onChange={e => onChange('nickname', e.target.value)} placeholder="ระบุ - หากไม่มี" className={DETAIL_INPUT_CLS} />
              ) : (
                <DetailViewField value={viewData.nickname} />
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1 md:col-span-2">
              <label className="text-[12px] font-black text-slate-700">
                เลขบัตรประชาชน <span className="text-rose-500">*</span>
              </label>
              {isEditMode ? (
                <input
                  value={formatNationalId(formData.nationalId) ?? ''}
                  onChange={(e) => onChange('nationalId', normalizeNationalId(e.target.value))}
                  inputMode="numeric"
                  placeholder="X-XXXX-XXXXX-XX-X"
                  maxLength={17}
                  className={DETAIL_INPUT_CLS}
                />
              ) : (
                <DetailViewField
                  value={
                    isNationalIdComplete(viewData.nationalId)
                      ? formatNationalId(viewData.nationalId)
                      : undefined
                  }
                />
              )}
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div className="space-y-4">
          <SectionHeading icon={HiPhone} iconClassName="text-violet-600">
            ข้อมูลติดต่อและสุขภาพ
          </SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-[12px] font-black text-slate-700">หมู่เลือด <span className="text-rose-500">*</span></label>
              {isEditMode ? (
                <select value={formData.bloodType || ''} onChange={e => onChange('bloodType', e.target.value)} className={DETAIL_INPUT_CLS}>
                  <option value="">เลือก</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="AB">AB</option>
                  <option value="O">O</option>
                </select>
              ) : (
                <DetailViewField value={viewData.bloodType} />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-black text-slate-700">เบอร์โทรศัพท์ <span className="text-rose-500">*</span></label>
              {isEditMode ? (
                <input value={formData.phone || ''} onChange={e => onChange('phone', e.target.value)} className={DETAIL_INPUT_CLS} />
              ) : (
                <DetailViewField value={viewData.phone} />
              )}
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-[12px] font-black text-slate-700">อีเมล <span className="text-rose-500">*</span></label>
              {isEditMode ? (
                <input type="email" value={formData.email || ''} disabled placeholder="example@school.ac.th" className={`${DETAIL_INPUT_CLS} bg-slate-50 text-slate-400 cursor-not-allowed`} />
              ) : (
                <DetailViewField value={viewData.email} />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-black text-slate-700">วัน/เดือน/ปีเกิด <span className="text-rose-500">*</span></label>
              {isEditMode ? (
                <input type="date" value={formData.birthDate || ''} onChange={e => onChange('birthDate', e.target.value)} className={DETAIL_INPUT_CLS} />
              ) : (
                <DetailViewField value={viewData.birthDate} />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-black text-slate-700">อายุ (ปี)</label>
              <DetailViewField value={calcStudentAge(viewData.birthDate)} className="bg-slate-100 border-slate-200 text-slate-400" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'family') {
    const guardianType = isEditMode ? formData.guardianType : viewData.guardianType;

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <SectionHeading icon={HiUser} iconClassName="text-blue-600">
            ข้อมูลบิดา
          </SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {([
              ['father_prefix', 'คำนำหน้า', 'select', guardianPrefixes] as const,
              ['father_firstName', 'ชื่อ', 'text'] as const,
              ['father_lastName', 'นามสกุล', 'text'] as const,
              ['father_phone', 'เบอร์โทรศัพท์', 'text'] as const,
            ]).map(([key, label, type, options]) => (
              <div key={key} className="space-y-1">
                <label className="text-[12px] font-black text-slate-700">{label} <span className="text-rose-500">*</span></label>
                {isEditMode ? (
                  type === 'select' ? (
                    <select value={(formData[key] as string) || ''} onChange={e => onChange(key, e.target.value)} className={DETAIL_INPUT_CLS}>
                      <option value="">เลือก</option>
                      {options!.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : (
                    <input value={(formData[key] as string) || ''} onChange={e => onChange(key, e.target.value)} className={DETAIL_INPUT_CLS} />
                  )
                ) : (
                  <DetailViewField value={viewData[key]} />
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[12px] font-black text-slate-700">ระดับการศึกษา <span className="text-rose-500">*</span></label>
              {isEditMode ? (
                <select value={formData.father_education || ''} onChange={e => onChange('father_education', e.target.value)} className={DETAIL_INPUT_CLS}>
                  <option value="">เลือก</option>
                  {EDUCATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <DetailViewField value={viewData.father_education} />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-black text-slate-700">อาชีพ <span className="text-rose-500">*</span></label>
              {isEditMode ? (
                <input value={formData.father_occupation || ''} onChange={e => onChange('father_occupation', e.target.value)} className={DETAIL_INPUT_CLS} />
              ) : (
                <DetailViewField value={viewData.father_occupation} />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-black text-slate-700">เงินเดือน (บาท) <span className="text-rose-500">*</span></label>
              {isEditMode ? (
                <input type="number" value={formData.father_salary ?? ''} onChange={e => onChange('father_salary', e.target.value === '' ? '' : Number(e.target.value))} className={DETAIL_INPUT_CLS} />
              ) : (
                <DetailViewField value={viewData.father_salary != null ? viewData.father_salary.toLocaleString() : undefined} />
              )}
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div className="space-y-4">
          <SectionHeading icon={HiUser} iconClassName="text-pink-600">
            ข้อมูลมารดา
          </SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {([
              ['mother_prefix', 'คำนำหน้า', 'select', guardianPrefixes] as const,
              ['mother_firstName', 'ชื่อ', 'text'] as const,
              ['mother_lastName', 'นามสกุล', 'text'] as const,
              ['mother_phone', 'เบอร์โทรศัพท์', 'text'] as const,
            ]).map(([key, label, type, options]) => (
              <div key={key} className="space-y-1">
                <label className="text-[12px] font-black text-slate-700">{label} <span className="text-rose-500">*</span></label>
                {isEditMode ? (
                  type === 'select' ? (
                    <select value={(formData[key] as string) || ''} onChange={e => onChange(key, e.target.value)} className={DETAIL_INPUT_CLS}>
                      <option value="">เลือก</option>
                      {options!.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  ) : (
                    <input value={(formData[key] as string) || ''} onChange={e => onChange(key, e.target.value)} className={DETAIL_INPUT_CLS} />
                  )
                ) : (
                  <DetailViewField value={viewData[key]} />
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[12px] font-black text-slate-700">ระดับการศึกษา <span className="text-rose-500">*</span></label>
              {isEditMode ? (
                <select value={formData.mother_education || ''} onChange={e => onChange('mother_education', e.target.value)} className={DETAIL_INPUT_CLS}>
                  <option value="">เลือก</option>
                  {EDUCATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <DetailViewField value={viewData.mother_education} />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-black text-slate-700">อาชีพ <span className="text-rose-500">*</span></label>
              {isEditMode ? (
                <input value={formData.mother_occupation || ''} onChange={e => onChange('mother_occupation', e.target.value)} className={DETAIL_INPUT_CLS} />
              ) : (
                <DetailViewField value={viewData.mother_occupation} />
              )}
            </div>
            <div className="space-y-1">
              <label className="text-[12px] font-black text-slate-700">เงินเดือน (บาท) <span className="text-rose-500">*</span></label>
              {isEditMode ? (
                <input type="number" value={formData.mother_salary ?? ''} onChange={e => onChange('mother_salary', e.target.value === '' ? '' : Number(e.target.value))} className={DETAIL_INPUT_CLS} />
              ) : (
                <DetailViewField value={viewData.mother_salary != null ? viewData.mother_salary.toLocaleString() : undefined} />
              )}
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div className="space-y-4 pt-2">
          <SectionHeading icon={HiUsers} iconClassName="text-emerald-600">
            ผู้ปกครอง
          </SectionHeading>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[12px] font-black text-slate-700 shrink-0">ผู้ปกครองนักเรียนคือ <span className="text-rose-500">*</span></span>
            <div className="flex gap-6">
              {([
                { value: 'father', label: 'บิดา' },
                { value: 'mother', label: 'มารดา' },
                { value: 'other', label: 'อื่นๆ' },
              ] as const).map(opt => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="guardianType"
                    value={opt.value}
                    checked={guardianType === opt.value}
                    onChange={() => isEditMode && onChange('guardianType', opt.value)}
                    disabled={!isEditMode}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-[13px] font-bold text-slate-700">{opt.label}</span>
                </label>
              ))}
            </div>
            {!guardianType && (
              <div className="px-3 py-1.5 bg-red-50 border border-red-400 rounded-lg text-[12px] font-bold text-red-600">
                กรอกข้อมูลให้ครบถ้วน
              </div>
            )}
          </div>

          {guardianType === 'other' && (
            <div className="space-y-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-100 mt-2">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ข้อมูลผู้ปกครอง (กรณีอื่นๆ)</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {([
                  ['guardianPrefix', 'คำนำหน้า', 'select', guardianPrefixes] as const,
                  ['guardianFirstName', 'ชื่อ', 'text'] as const,
                  ['guardianLastName', 'นามสกุล', 'text'] as const,
                  ['guardianPhone', 'เบอร์โทรศัพท์', 'text'] as const,
                ]).map(([key, label, type, options]) => (
                  <div key={key} className="space-y-1">
                    <label className="text-[12px] font-black text-slate-700">{label} <span className="text-rose-500">*</span></label>
                    {isEditMode ? (
                      type === 'select' ? (
                        <select value={(formData[key] as string) || ''} onChange={e => onChange(key, e.target.value)} className={DETAIL_INPUT_CLS}>
                          <option value="">เลือก</option>
                          {options!.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      ) : (
                        <input value={(formData[key] as string) || ''} onChange={e => onChange(key, e.target.value)} className={DETAIL_INPUT_CLS} />
                      )
                    ) : (
                      <DetailViewField value={viewData[key]} />
                    )}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-black text-slate-700">ระดับการศึกษา <span className="text-rose-500">*</span></label>
                  {isEditMode ? (
                    <select value={formData.guardian_education || ''} onChange={e => onChange('guardian_education', e.target.value)} className={DETAIL_INPUT_CLS}>
                      <option value="">เลือก</option>
                      {EDUCATION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <DetailViewField value={viewData.guardian_education} />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-black text-slate-700">อาชีพ <span className="text-rose-500">*</span></label>
                  {isEditMode ? (
                    <input value={formData.guardian_occupation || ''} onChange={e => onChange('guardian_occupation', e.target.value)} className={DETAIL_INPUT_CLS} />
                  ) : (
                    <DetailViewField value={viewData.guardian_occupation} />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-black text-slate-700">เงินเดือน (บาท) <span className="text-rose-500">*</span></label>
                  {isEditMode ? (
                    <input type="number" value={formData.guardian_salary ?? ''} onChange={e => onChange('guardian_salary', e.target.value === '' ? '' : Number(e.target.value))} className={DETAIL_INPUT_CLS} />
                  ) : (
                    <DetailViewField value={viewData.guardian_salary != null ? viewData.guardian_salary.toLocaleString() : undefined} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const lat = isEditMode ? formData.address_latitude : viewData.address_latitude;
  const lng = isEditMode ? formData.address_longitude : viewData.address_longitude;
  const mapImageURL = isEditMode ? formData.address_mapImageURL : viewData.address_mapImageURL;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <SectionHeading icon={HiHome} iconClassName="text-blue-600">
          ที่อยู่ปัจจุบัน
        </SectionHeading>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              ['address_houseNo', 'บ้านเลขที่'] as const,
              ['address_moo', 'หมู่ที่'] as const,
              ['address_village', 'ชื่อหมู่บ้าน/ชุมชน'] as const,
            ]).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{label} <span className="text-rose-500">*</span></label>
                {isEditMode ? (
                  <input
                    value={(formData[key] as string) || ''}
                    onChange={e => onChange(key, e.target.value)}
                    placeholder={key === 'address_moo' || key === 'address_village' ? 'ระบุ - หากไม่มี' : undefined}
                    className={MAP_ADDRESS_INPUT_CLS}
                  />
                ) : (
                  <DetailViewField value={viewData[key]} isWhiteBg />
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {([
              ['address_subdistrict', 'ตำบล'] as const,
              ['address_district', 'อำเภอ'] as const,
              ['address_province', 'จังหวัด'] as const,
              ['address_postalCode', 'รหัสไปรษณีย์'] as const,
            ]).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{label} <span className="text-rose-500">*</span></label>
                {isEditMode ? (
                  <input value={(formData[key] as string) || ''} onChange={e => onChange(key, e.target.value)} className={MAP_ADDRESS_INPUT_CLS} />
                ) : (
                  <DetailViewField value={viewData[key]} isWhiteBg />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <SectionHeading icon={HiMapPin} iconClassName="text-violet-600">
              พิกัดแผนที่บ้าน
            </SectionHeading>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Latitude</label>
                  {isEditMode ? (
                    <input type="number" step="any" value={formData.address_latitude ?? ''} onChange={e => onChange('address_latitude', parseFloat(e.target.value))} placeholder="เช่น 13.7563" className={DETAIL_INPUT_CLS} />
                  ) : (
                    <DetailViewField value={viewData.address_latitude} isWhiteBg />
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Longitude</label>
                  {isEditMode ? (
                    <input type="number" step="any" value={formData.address_longitude ?? ''} onChange={e => onChange('address_longitude', parseFloat(e.target.value))} placeholder="เช่น 100.5018" className={DETAIL_INPUT_CLS} />
                  ) : (
                    <DetailViewField value={viewData.address_longitude} isWhiteBg />
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={!isEditMode}
                className="w-full py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-black text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LocateFixed size={14} className="text-blue-600" />
                ดึงตำแหน่งปัจจุบัน
              </button>

              {lat && lng ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-slate-200 rounded-xl text-[13px] font-black text-slate-700 hover:bg-slate-100 hover:border-slate-300 transition-all group shadow-sm"
                >
                  <HiMapPin size={16} className="text-blue-600 group-hover:scale-110 transition-transform" />
                  เปิดใน Google Maps
                </a>
              ) : (
                <div className="p-4 bg-white/50 border border-dashed border-slate-200 rounded-2xl text-center">
                  <p className="text-[11px] font-bold text-slate-400">ระบุพิกัดเพื่อแสดงปุ่มนำทาง</p>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 shadow-sm bg-white p-2">
            <GoogleMapPicker
              lat={lat}
              lng={lng}
              isEditMode={isEditMode}
              onChange={(newLat, newLng) => {
                onChange('address_latitude', newLat);
                onChange('address_longitude', newLng);
              }}
            />
          </div>
        </div>

        <div className="space-y-4 h-fit">
          <SectionHeading icon={HiPhoto} iconClassName="text-rose-600">
            รูปภาพแผนที่บ้าน
          </SectionHeading>
          <div className="space-y-5 h-fit">
            <div className="aspect-[4/3] bg-white border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden relative group">
              {mapImageURL ? (
                <img src={mapImageURL} className="w-full h-full object-cover" alt="Map" />
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
                        if (!file) return;
                        try {
                          const compressed = await compressImage(file);
                          const storageRef = ref(storage, `students/${studentId}/house_map.jpg`);
                          await uploadBytes(storageRef, compressed);
                          const url = await getDownloadURL(storageRef);
                          onChange('address_mapImageURL', url);
                          toast.success('อัปโหลดรูปภาพแผนที่เรียบร้อย');
                        } catch {
                          toast.error('เกิดข้อผิดพลาดในการอัปโหลด');
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
    </div>
  );
}
