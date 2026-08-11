import DeptCoverFlow from '@/components/DeptCoverFlow';
import type { Department } from '@/types/curriculum';

type Props = {
  onSelectDept: (dept: Department) => void;
  teacherCounts?: Partial<Record<Department, number>>;
  /** Default: all departments */
  departments?: Department[];
};

export default function TeacherDeptCoverFlow({
  onSelectDept,
  teacherCounts,
  departments,
}: Props) {
  return (
    <DeptCoverFlow
      title="จัดการครู"
      subtitle="เลือกแผนกวิชาเพื่อดูรายชื่อครูในแต่ละสายการเรียน"
      countLabel="ครู"
      selectHint="ดูรายชื่อครู"
      onSelectDept={onSelectDept}
      counts={teacherCounts}
      departments={departments}
    />
  );
}
