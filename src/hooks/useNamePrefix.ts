import { useMemo } from 'react';

export type PrefixGroup = 'student' | 'adult' | 'teacher';

export const ALL_PREFIXES = [
  'ด.ช.', 'ด.ญ.', 'นาย', 'นางสาว', 'นาง', 'ครู', 'ดร.', 'ผศ.', 'รศ.', 'ศ.', 'ว่าที่ร.ต.หญิง', 'ว่าที่ร.ต.'
];

export function useNamePrefix(group: PrefixGroup = 'adult') {
  // ดึงรายการคำนำหน้าตามกลุ่มเป้าหมาย
  const prefixes = useMemo(() => {
    switch (group) {
      case 'student':
        return ['ด.ช.', 'ด.ญ.', 'นาย', 'นางสาว', 'นาง'];
      case 'teacher':
        return [
          'นาย',
          'นาง',
          'นางสาว',
          'ครู',
          'ดร.',
          'ผศ.',
          'รศ.',
          'ศ.',
          'ว่าที่ร.ต.',
          'ว่าที่ร.ต.หญิง'
        ];
      case 'adult':
      default:
        return ['นาย', 'นาง', 'นางสาว'];
    }
  }, [group]);

  // ฟังก์ชันช่วยจัดรูปแบบชื่อเต็ม เช่น "นายสมชาย ใจดี"
  const formatFullName = (prefix: string, firstName: string, lastName: string) => {
    return `${prefix}${firstName} ${lastName}`;
  };

  // ฟังก์ชันช่วยแยกคำนำหน้า ชื่อ และนามสกุล ออกจากชื่อเต็ม
  const extractNameParts = (fullName: string = '') => {
    if (!fullName) return { prefix: '', firstName: '', lastName: '' };
    const parts = fullName.split(' ');
    const last = parts.length > 1 ? parts.pop() || '' : '';
    let firstAndPrefix = parts.join(' ');
    
    let foundPrefix = '';
    for (const px of ALL_PREFIXES) {
      if (firstAndPrefix.startsWith(px)) {
        foundPrefix = px;
        firstAndPrefix = firstAndPrefix.substring(px.length);
        break;
      }
    }
    return { prefix: foundPrefix, firstName: firstAndPrefix.trim(), lastName: last };
  };

  return { prefixes, formatFullName, extractNameParts };
}