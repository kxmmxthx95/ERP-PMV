import DeptCoverFlow from '@/components/DeptCoverFlow';
import type { Department } from '@/types/curriculum';

type Props = {
  onSelectDept: (dept: Department) => void;
  versionCounts?: Partial<Record<Department, number>>;
  /** Default: all departments */
  departments?: Department[];
};

export default function CurriculumDeptCoverFlow({
  onSelectDept,
  versionCounts,
  departments,
}: Props) {
  return (
    <DeptCoverFlow
      title="หลักสูตร"
      subtitle="เลือกแผนกวิชาเพื่อดูหลักสูตรในแต่ละสายการเรียน"
      countLabel="หลักสูตร"
      selectHint="ดูหลักสูตร"
      onSelectDept={onSelectDept}
      counts={versionCounts}
      departments={departments}
    />
  );
}
