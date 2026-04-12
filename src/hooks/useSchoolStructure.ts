import { useMemo } from 'react';

export function useSchoolStructure() {
  // ข้อมูลระดับชั้นเรียน (เตรียมอนุบาล - มัธยมปลาย)
  const gradeLevels = useMemo(() => [
    { id: 'pre-k', label: 'เตรียมอนุบาล', shortLabel: 'เตรียมฯ', section: 'early-childhood' },
    { id: 'k1', label: 'อนุบาลปีที่ 1', shortLabel: 'อ.1', section: 'early-childhood' },
    { id: 'k2', label: 'อนุบาลปีที่ 2', shortLabel: 'อ.2', section: 'early-childhood' },
    { id: 'k3', label: 'อนุบาลปีที่ 3', shortLabel: 'อ.3', section: 'early-childhood' },
    { id: 'p1', label: 'ประถมศึกษาปีที่ 1', shortLabel: 'ป.1', section: 'primary' },
    { id: 'p2', label: 'ประถมศึกษาปีที่ 2', shortLabel: 'ป.2', section: 'primary' },
    { id: 'p3', label: 'ประถมศึกษาปีที่ 3', shortLabel: 'ป.3', section: 'primary' },
    { id: 'p4', label: 'ประถมศึกษาปีที่ 4', shortLabel: 'ป.4', section: 'primary' },
    { id: 'p5', label: 'ประถมศึกษาปีที่ 5', shortLabel: 'ป.5', section: 'primary' },
    { id: 'p6', label: 'ประถมศึกษาปีที่ 6', shortLabel: 'ป.6', section: 'primary' },
    { id: 'm1', label: 'มัธยมศึกษาปีที่ 1', shortLabel: 'ม.1', section: 'secondary' },
    { id: 'm2', label: 'มัธยมศึกษาปีที่ 2', shortLabel: 'ม.2', section: 'secondary' },
    { id: 'm3', label: 'มัธยมศึกษาปีที่ 3', shortLabel: 'ม.3', section: 'secondary' },
    { id: 'm4', label: 'มัธยมศึกษาปีที่ 4', shortLabel: 'ม.4', section: 'secondary' },
    { id: 'm5', label: 'มัธยมศึกษาปีที่ 5', shortLabel: 'ม.5', section: 'secondary' },
    { id: 'm6', label: 'มัธยมศึกษาปีที่ 6', shortLabel: 'ม.6', section: 'secondary' },
  ], []);

  // ข้อมูลภาคเรียน
  const semesters = useMemo(() => [
    { id: 1, label: 'ภาคเรียนที่ 1', shortLabel: 'เทอม 1' },
    { id: 2, label: 'ภาคเรียนที่ 2', shortLabel: 'เทอม 2' },
    { id: 3, label: 'ภาคเรียนที่ 3 (ฤดูร้อน)', shortLabel: 'ฤดูร้อน' },
  ], []);

  // ข้อมูลแผนก
  const departments = useMemo(() => [
    { id: 'early-childhood', label: 'ปฐมวัย' },
    { id: 'primary', label: 'ประถมศึกษา' },
    { id: 'secondary', label: 'มัธยมศึกษา' },
  ], []);

  // ฟังก์ชันช่วยกรองระดับชั้นตามแผนก
  const getGradesBySection = (section: 'early-childhood' | 'primary' | 'secondary') => 
    gradeLevels.filter(grade => grade.section === section);

  return { gradeLevels, departments, semesters, getGradesBySection };
}
