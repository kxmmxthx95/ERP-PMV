import { useState, useEffect, type ReactNode } from 'react'
import type { Student, NewStudent, Gender } from '@/types/student'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { useNamePrefix } from '@/hooks/useNamePrefix'
import { cn } from '@/lib/utils'

interface StudentFormModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: NewStudent) => void
  editingStudent?: Student | null
  /** ปีการศึกษาเริ่มต้นเมื่อเพิ่มใหม่ (เช่น จากปีที่ใช้งานอยู่) */
  defaultAcademicYearId?: string
}

const DEFAULT_FORM: NewStudent = {
  studentCode: '',
  prefix: '',
  firstName: '',
  lastName: '',
  firstNameEn: '',
  lastNameEn: '',
  gender: 'male',
  phone: '',
  email: '',
  allergies: '',
  guardianPrefix: '',
  guardianFirstName: '',
  guardianLastName: '',
  guardianPhone: '',
  guardianRelation: 'บิดา',
  academicYearId: '',
  status: 'active',
}

const FIELD_INPUT =
  'h-10 rounded-xl border-none bg-slate-50/70 px-4 text-xs font-bold focus-visible:bg-slate-50/90 focus-visible:ring-2 focus-visible:ring-slate-900/20'

const FIELD_LABEL = 'pl-1 text-[10px] font-black uppercase tracking-wider text-slate-600'

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <label className={FIELD_LABEL}>
      {children}
      {required ? <span className="text-destructive"> *</span> : null}
    </label>
  )
}

export default function StudentFormModal({
  open,
  onClose,
  onSubmit,
  editingStudent,
  defaultAcademicYearId,
}: StudentFormModalProps) {
  const { prefixes: studentPrefixes } = useNamePrefix('student')
  const [form, setForm] = useState<NewStudent>(DEFAULT_FORM)
  const isEditing = !!editingStudent

  useEffect(() => {
    if (editingStudent) {
      const { id: _id, createdAt: _c, ...rest } = editingStudent as Student & {
        id: string
        createdAt: string
      }
      setForm({ ...DEFAULT_FORM, ...rest })
    } else {
      setForm({
        ...DEFAULT_FORM,
        academicYearId: defaultAcademicYearId ?? '',
      })
    }
  }, [editingStudent, open, defaultAcademicYearId])

  const set = <K extends keyof NewStudent>(key: K, value: NewStudent[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handlePrefixChange = (prefix: string) => {
    let gender: Gender = 'male'
    if (['ด.ญ.', 'นางสาว', 'น.ส.', 'นาง', 'ว่าที่ร.ต.หญิง'].includes(prefix)) {
      gender = 'female'
    } else if (['ด.ช.', 'นาย', 'ว่าที่ร.ต.'].includes(prefix)) {
      gender = 'male'
    }
    setForm((prev) => ({ ...prev, prefix, gender }))
  }

  const handlePhoneChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 10)
    let formatted = digits
    if (digits.length > 3 && digits.length <= 6) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`
    } else if (digits.length > 6) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    }
    set('phone', formatted)
  }

  const canSubmit =
    !!form.prefix &&
    !!form.studentCode.trim() &&
    !!form.firstName.trim() &&
    !!form.lastName.trim() &&
    !!form.phone?.trim() &&
    !!form.email?.trim() &&
    !!form.academicYearId?.trim()

  const handleSubmit = () => {
    if (!canSubmit) return
    const year = form.academicYearId?.trim() ?? ''
    onSubmit({
      ...form,
      academicYearId: year,
    })
    if (isEditing) {
      onClose()
      return
    }
    // Keep modal open — reset for next student, keep ปีการศึกษา
    setForm({
      ...DEFAULT_FORM,
      academicYearId: year || defaultAcademicYearId || '',
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent
        className="w-[92vw] overflow-hidden rounded-2xl border-none p-0 shadow-2xl sm:max-w-lg"
        style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        }}
      >
        <div className="flex max-h-[90vh] flex-col">
          <div className="flex flex-col bg-transparent px-6 pb-2 pt-6 sm:px-8 sm:pb-3 sm:pt-8">
            <DialogTitle className="text-lg font-black tracking-tight text-slate-800 sm:text-xl">
              {isEditing ? 'แก้ไขนักเรียน' : 'เพิ่มนักเรียนใหม่'}
            </DialogTitle>
          </div>

          <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-6 py-4 sm:px-8">
            {/* ข้อมูลส่วนตัว */}
            <div className="space-y-4">
              <p className="pl-1 text-[10px] font-black uppercase tracking-wider text-slate-500">
                ข้อมูลส่วนตัว
              </p>

              <div className="space-y-1">
                <FieldLabel required>ปีการศึกษา</FieldLabel>
                <Input
                  value={form.academicYearId ?? ''}
                  onChange={(e) => set('academicYearId', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="เช่น 2569"
                  inputMode="numeric"
                  className={FIELD_INPUT}
                />
              </div>

              <div className="space-y-1">
                <FieldLabel required>เลขประจำตัว</FieldLabel>
                <Input
                  value={form.studentCode}
                  onChange={(e) => set('studentCode', e.target.value)}
                  placeholder="กรอกเลขประจำตัวนักเรียน"
                  className={FIELD_INPUT}
                />
              </div>

              <div className="space-y-1">
                <FieldLabel required>คำนำหน้า</FieldLabel>
                <select
                  value={form.prefix}
                  onChange={(e) => handlePrefixChange(e.target.value)}
                  className={cn(FIELD_INPUT, 'w-full outline-none')}
                >
                  <option value="" disabled>
                    กรุณาเลือกคำนำหน้า
                  </option>
                  {studentPrefixes.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <FieldLabel required>ชื่อ</FieldLabel>
                  <Input
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                    placeholder="กรุณากรอกชื่อ"
                    className={FIELD_INPUT}
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel required>นามสกุล</FieldLabel>
                  <Input
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                    placeholder="กรุณากรอกนามสกุล"
                    className={FIELD_INPUT}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <FieldLabel required>เบอร์โทรศัพท์</FieldLabel>
                  <Input
                    value={form.phone ?? ''}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="08X-XXX-XXXX"
                    className={FIELD_INPUT}
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel required>อีเมล</FieldLabel>
                  <Input
                    type="email"
                    value={form.email ?? ''}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="example@email.com"
                    className={FIELD_INPUT}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-white/20 px-6 pb-6 pt-4 sm:px-8 sm:pb-8">
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="h-10 w-full rounded-xl font-bold"
            >
              {isEditing ? 'บันทึก' : 'เพิ่ม'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
