import { useState } from 'react';
import type { UserData } from '@/types/user';
import { useNamePrefix, type PrefixGroup } from '@/hooks/useNamePrefix';
import { useSchoolStructure } from '@/hooks/useSchoolStructure';

export function useUserForm(onSuccess: (user: Omit<UserData, 'id'>) => void) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('student');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const prefixGroup = (role === 'student' || role === 'teacher' ? role : 'adult') as PrefixGroup;
  const { prefixes, formatFullName, extractNameParts } = useNamePrefix(prefixGroup);
  const { departments } = useSchoolStructure();

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    setPrefix(''); // เคลียร์คำนำหน้าทิ้งเมื่อเปลี่ยนบทบาท
  };

  const resetForm = () => {
    setPrefix('');
    setFirstName('');
    setLastName('');
    setEmail('');
    setRole('student');
    setDepartment('');
    setPhone('');
    setPassword('');
  };

  // ดึงข้อมูลเดิมมาแสดงในฟอร์มเมื่อกดแก้ไข
  const setFormForEdit = (user: UserData) => {
    setRole(user.role);
    setEmail(user.email);
    setDepartment('');
    setPhone('');
    setPassword('********');
    
    const parts = extractNameParts(user.name);
    setPrefix(parts.prefix);
    setFirstName(parts.firstName);
    setLastName(parts.lastName);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prefix || !firstName || !lastName || !email || !department || !phone || !password) return;

    const fullName = formatFullName(prefix, firstName, lastName);
    const newUserObj: Omit<UserData, 'id'> = {
      name: fullName,
      email: email,
      role: role,
      status: 'active',
      lastLogin: 'ไม่เคยเข้าสู่ระบบ',
      department: department,
    };

    onSuccess(newUserObj); // ส่งข้อมูลกลับไปให้ Component หลักจัดการต่อ
    setIsOpen(false);
    resetForm();
  };

  return {
    isOpen, setIsOpen, prefix, setPrefix, firstName, setFirstName,
    lastName, setLastName, email, setEmail, role, handleRoleChange,
    department, setDepartment, phone, setPhone, password, setPassword,
    prefixes, departments, handleSubmit, setFormForEdit, resetForm
  };
}