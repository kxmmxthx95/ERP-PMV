import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { HiUsers, HiAcademicCap } from 'react-icons/hi2';
import FormModal from '@/components/ui/FormModal';
import { DEPARTMENT_CONFIG, type CurriculumVersion } from '@/types/curriculum';

interface AssignGradesModalProps {
  open: boolean;
  onClose: () => void;
  version: CurriculumVersion | null;
  allVersions: CurriculumVersion[];
  onAssign: (versionId: string, grades: string[]) => Promise<void>;
}

type DeptId = keyof typeof DEPARTMENT_CONFIG;

const DEPT_ORDER: DeptId[] = ['early', 'primary', 'secondary'];

export default function AssignGradesModal({
  open,
  onClose,
  version,
  allVersions,
  onAssign,
}: AssignGradesModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && version) {
      setSelected(version.assignedGrades || []);
    }
  }, [open, version]);

  if (!version) return null;

  // Map: grade → which version currently owns it (excluding current)
  const gradeOwnerMap: Record<string, CurriculumVersion> = {};
  allVersions.forEach(v => {
    if (v.id === version.id) return;
    (v.assignedGrades || []).forEach(g => { gradeOwnerMap[g] = v; });
  });

  const toggleGrade = (grade: string) => {
    setSelected(prev =>
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onAssign(version.id, selected);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="กำหนดชั้นเรียน"
      subtitle={`เลือกชั้นเรียนที่จะใช้หลักสูตร "${version.name}" (${version.year})`}
      icon={<HiUsers size={18} />}
      onSubmit={handleSubmit}
      submitLabel={isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
      submitDisabled={isSubmitting}
      maxWidth="sm"
    >
      <div className="py-2 space-y-5">
        {DEPT_ORDER.map(deptId => {
          const dept = DEPARTMENT_CONFIG[deptId];
          return (
            <div key={deptId}>
              {/* Department header */}
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-5 h-5 rounded-lg flex items-center justify-center"
                  style={{ background: dept.color + '20' }}
                >
                  <HiAcademicCap size={11} style={{ color: dept.color }} />
                </div>
                <span className="text-[11px] font-black font-sukhumvit" style={{ color: dept.color }}>
                  {dept.label}
                </span>
              </div>

              {/* Grade pills */}
              <div className="flex flex-wrap gap-2 pl-7">
                {dept.grades.map(grade => {
                  const isSelected = selected.includes(grade);
                  const owner = gradeOwnerMap[grade];
                  const isConflict = !!owner && !isSelected;

                  return (
                    <motion.button
                      key={grade}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      onClick={() => toggleGrade(grade)}
                      className="relative flex flex-col items-center px-3 py-2 rounded-2xl border transition-all duration-200"
                      style={isSelected ? {
                        background: dept.color + '15',
                        borderColor: dept.color + '60',
                        boxShadow: `0 0 0 2px ${dept.color}30`,
                      } : {
                        background: 'rgba(0,0,0,0.03)',
                        borderColor: 'rgba(0,0,0,0.08)',
                      }}
                    >
                      <span
                        className="text-[12px] font-black font-sarabun"
                        style={{ color: isSelected ? dept.color : 'rgba(0,0,0,0.55)' }}
                      >
                        {grade}
                      </span>
                      {isConflict && (
                        <span className="text-[8px] font-bold text-amber-500 font-sukhumvit mt-0.5 leading-none">
                          {owner.name.length > 6 ? owner.name.slice(0, 6) + '…' : owner.name}
                        </span>
                      )}
                      {isSelected && (
                        <motion.div
                          layoutId={`check-${grade}`}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-white text-[9px] font-black"
                          style={{ background: dept.color }}
                        >
                          ✓
                        </motion.div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Summary */}
        <div
          className="mt-2 px-4 py-3 rounded-2xl flex items-center gap-3"
          style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.07)' }}
        >
          <HiUsers size={14} className="text-black/40 shrink-0" />
          <p className="text-[11px] font-bold text-black/55 font-sukhumvit">
            {selected.length === 0
              ? 'ยังไม่ได้เลือกชั้นเรียน'
              : `เลือก ${selected.length} ชั้นเรียน: ${selected.sort((a, b) => {
                  const ai = [...DEPARTMENT_CONFIG.early.grades, ...DEPARTMENT_CONFIG.primary.grades, ...DEPARTMENT_CONFIG.secondary.grades].indexOf(a);
                  const bi = [...DEPARTMENT_CONFIG.early.grades, ...DEPARTMENT_CONFIG.primary.grades, ...DEPARTMENT_CONFIG.secondary.grades].indexOf(b);
                  return ai - bi;
                }).join(', ')}`
            }
          </p>
        </div>
      </div>
    </FormModal>
  );
}
