import { 
  Calculator, Atom, Languages, BookOpenText, 
  Landmark, Palette, HeartPulse, Briefcase, BookMarked 
} from 'lucide-react';

// 1. สร้าง Mapping Object เก็บทั้งสีและไอคอน
export const SUBJECT_CONFIG = {
  math: { theme: "blue", icon: Calculator, label: "คณิตศาสตร์" },
  science: { theme: "emerald", icon: Atom, label: "วิทยาศาสตร์ฯ" },
  language: { theme: "sky", icon: Languages, label: "ภาษาต่างประเทศ" },
  thai: { theme: "rose", icon: BookOpenText, label: "ภาษาไทย" },
  social: { theme: "orange", icon: Landmark, label: "สังคมศึกษาฯ" },
  art: { theme: "purple", icon: Palette, label: "ศิลปะ" },
  health: { theme: "red", icon: HeartPulse, label: "สุขศึกษาและพละฯ" },
  work: { theme: "stone", icon: Briefcase, label: "การงานอาชีพ" },
  default: { theme: "gray", icon: BookMarked, label: "วิชาเพิ่มเติม" }
};

// 2. วิธีนำไปใช้ใน Component
export default function SubjectCard({ subjectType = 'default' }) {
  // ดึงค่า Config มาใช้
  const config = SUBJECT_CONFIG[subjectType] || SUBJECT_CONFIG.default;
  
  // แปลง Component ไอคอนเป็นตัวแปร (ต้องขึ้นต้นด้วยตัวพิมพ์ใหญ่)
  const IconComponent = config.icon;

  return (
    <div className={`p-4 rounded-2xl bg-${config.theme}-100/40`}>
      <div className={`w-10 h-10 rounded-full bg-${config.theme}-500 text-white flex items-center justify-center mb-3`}>
        {/* เรนเดอร์ Icon พร้อมกำหนดขนาดตรงนี้ */}
        <IconComponent size={20} strokeWidth={2.5} />
      </div>
      <h3 className="font-bold">{config.label}</h3>
    </div>
  );
}