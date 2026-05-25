import { useState } from 'react';
import type { UserData, UserStatus } from '@/types/user';
import { useNamePrefix, type PrefixGroup } from '@/hooks/useNamePrefix';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useEffect } from 'react';
import { toast } from 'sonner';

export function useUserForm(onSuccess: (user: Omit<UserData, 'id'> & { password?: string }) => Promise<void>) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstNameEn, setFirstNameEn] = useState('');
  const [lastNameEn, setLastNameEn] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('student');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [lineToken, setLineToken] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear() + 543);

  // ── Auto-fill Logic ──────────────────────────────────────────────────────
  useEffect(() => {
    const fetchStudentData = async () => {
      if (role === 'student' && studentCode.length === 5) {
        try {
          const q = query(collection(db, 'students'), where('studentCode', '==', studentCode));
          const querySnap = await getDocs(q);
          
          if (!querySnap.empty) {
            const data = querySnap.docs[0].data();
            if (data.prefix) setPrefix(data.prefix);
            if (data.firstName) setFirstName(data.firstName);
            if (data.lastName) setLastName(data.lastName);
            if (data.firstNameEn) setFirstNameEn(data.firstNameEn);
            if (data.lastNameEn) setLastNameEn(data.lastNameEn);
            if (data.email) setEmail(data.email);
            if (data.phone) setPhone(data.phone);
            if (data.photoURL) setPhotoURL(data.photoURL);
            toast.success(`ดึงข้อมูลนักเรียนรหัส ${studentCode} สำเร็จ`);
          }
        } catch (err) {
          console.error("Error fetching student data:", err);
        }
      }
    };

    fetchStudentData();
  }, [studentCode, role]);

  const prefixGroup = (role === 'student' || role === 'teacher' ? role : 'adult') as PrefixGroup;
  const { prefixes, formatFullName, extractNameParts } = useNamePrefix(prefixGroup);
  const { departments } = useSchoolStructure();

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
  };

  const resetForm = () => {
    setPrefix('');
    setFirstName('');
    setLastName('');
    setFirstNameEn('');
    setLastNameEn('');
    setEmail('');
    setRole('student');
    setDepartment('');
    setPhone('');
    setPassword('');
    setPhotoURL('');
    setLineToken('');
    setDeviceId('');
    setStudentCode('');
    setGradeLevel('');
    setAcademicYear(new Date().getFullYear() + 543);
  };

  const setFormForEdit = (user: UserData) => {
    setRole(user.role);
    setEmail(user.email);
    setDepartment(user.department || '');
    setPhone((user as any).phone || '');
    setPassword('********');
    setPhotoURL(user.photoURL || '');
    setFirstNameEn(user.firstNameEn || '');
    setLastNameEn(user.lastNameEn || '');
    setLineToken(user.lineToken || '');
    setDeviceId(user.deviceId || '');
    setStudentCode(user.studentCode || '');
    setGradeLevel((user as any).gradeLevel || '');
    setAcademicYear((user as any).academicYear || (new Date().getFullYear() + 543));

    const parts = extractNameParts(user.name || (user as any).displayName || '');
    setPrefix(parts.prefix);
    setFirstName(parts.firstName);
    setLastName(parts.lastName);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const DEFAULT_PASSWORD = '123456';

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    const cleanPrefix = (prefix || '').trim();
    const cleanFirstName = (firstName || '').trim();
    const cleanLastName = (lastName || '').trim();
    const cleanFirstNameEn = (firstNameEn || '').trim();
    const cleanLastNameEn = (lastNameEn || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanDepartment = (department || '').trim();
    const cleanPhone = (phone || '').trim();
    const cleanPassword = (password || '').trim();

    if (!cleanPrefix || !cleanFirstName || !cleanLastName || !cleanEmail || !cleanPhone) {
      alert('กรุณากรอกข้อมูลให้ครบ: คำนำหน้า ชื่อ นามสกุล เบอร์โทร และอีเมล');
      return;
    }

    const fullName = formatFullName(cleanPrefix, cleanFirstName, cleanLastName);
    const newUserObj = {
      name: fullName,
      firstName: cleanFirstName,
      lastName: cleanLastName,
      firstNameEn: cleanFirstNameEn,
      lastNameEn: cleanLastNameEn,
      email: cleanEmail,
      role: role,
      status: 'active' as UserStatus,
      lastLogin: 'ไม่เคยเข้าสู่ระบบ',
      department: cleanDepartment,
      phone: cleanPhone,
      photoURL: photoURL.trim(),
      lineToken: lineToken.trim(),
      deviceId: deviceId.trim(),
      studentCode: studentCode.trim(),
      gradeLevel: gradeLevel,
      academicYear: academicYear,
      // Allow empty password from UI; backend account creation will use default password.
      password: cleanPassword || DEFAULT_PASSWORD,
    };

    setIsSubmitting(true);
    try {
      await onSuccess(newUserObj);
      setIsOpen(false);
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    isOpen, setIsOpen, prefix, setPrefix, firstName, setFirstName,
    lastName, setLastName, firstNameEn, setFirstNameEn, lastNameEn, setLastNameEn,
    email, setEmail, role, handleRoleChange,
    department, setDepartment, phone, setPhone, password, setPassword,
    photoURL, setPhotoURL, lineToken, setLineToken, deviceId, setDeviceId,
    studentCode, setStudentCode, gradeLevel, setGradeLevel, academicYear, setAcademicYear,
    prefixes, departments, handleSubmit, setFormForEdit, resetForm, isSubmitting
  };
}
