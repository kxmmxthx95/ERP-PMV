import {
  HiOutlineLanguage,
  HiOutlineCalculator,
  HiOutlineBeaker,
  HiOutlineGlobeAsiaAustralia,
  HiOutlineHeart,
  HiOutlinePaintBrush,
  HiOutlineBriefcase,
  HiOutlineChatBubbleLeftRight,
  HiOutlineSparkles,
  HiOutlineBookOpen,
} from 'react-icons/hi2';

const THEME_COLORS: Record<string, string[]> = {
  blue: ['#3b82f6', '#60a5fa', '#2563eb'],
  emerald: ['#10b981', '#34d399', '#059669'],
  sky: ['#0ea5e9', '#38bdf8', '#0284c7'],
  rose: ['#f43f5e', '#fb7185', '#e11d48'],
  orange: ['#f97316', '#fb923c', '#ea580c'],
  purple: ['#a855f7', '#c084fc', '#9333ea'],
  red: ['#ef4444', '#f87171', '#dc2626'],
  stone: ['#78716c', '#a8a29e', '#57534e'],
  gray: ['#6b7280', '#9ca3af', '#4b5563'],
};

export function getSubjectColors(subjectGroup?: string): string[] {
  const g = (subjectGroup || '').toLowerCase();
  if (g.includes('thai') || g.includes('ภาษาไทย')) return THEME_COLORS.rose;
  if (g.includes('math') || g.includes('คณิต')) return THEME_COLORS.blue;
  if (g.includes('science') || g.includes('วิทยา')) return THEME_COLORS.emerald;
  if (g.includes('social') || g.includes('สังคม')) return THEME_COLORS.orange;
  if (g.includes('health') || g.includes('pe') || g.includes('พลศึกษา') || g.includes('สุขศึกษา')) return THEME_COLORS.red;
  if (g.includes('art') || g.includes('ศิลป')) return THEME_COLORS.purple;
  if (g.includes('career') || g.includes('งาน')) return THEME_COLORS.stone;
  if (g.includes('foreign') || g.includes('lang') || g.includes('ภาษา') || g.includes('ต่างประเทศ')) return THEME_COLORS.sky;
  return THEME_COLORS.gray;
}

export function SubjectIcon({ subjectGroup, className, size = 18 }: { subjectGroup?: string; className?: string; size?: number }) {
  const g = (subjectGroup || '').toLowerCase();
  const props = { size, className: className || 'text-white drop-shadow-sm' };

  if (g.includes('thai') || g.includes('ภาษาไทย')) return <HiOutlineLanguage {...props} />;
  if (g.includes('math') || g.includes('คณิต')) return <HiOutlineCalculator {...props} />;
  if (g.includes('science') || g.includes('วิทยา')) return <HiOutlineBeaker {...props} />;
  if (g.includes('social') || g.includes('สังคม')) return <HiOutlineGlobeAsiaAustralia {...props} />;
  if (g.includes('health') || g.includes('pe') || g.includes('สุขศึกษา') || g.includes('พลศึกษา')) return <HiOutlineHeart {...props} />;
  if (g.includes('art') || g.includes('ศิลป')) return <HiOutlinePaintBrush {...props} />;
  if (g.includes('career') || g.includes('งาน')) return <HiOutlineBriefcase {...props} />;
  if (g.includes('foreign') || g.includes('lang') || g.includes('ต่างประเทศ') || g.includes('ภาษา')) return <HiOutlineChatBubbleLeftRight {...props} />;
  if (g.includes('activity') || g.includes('กิจกรรม')) return <HiOutlineSparkles {...props} />;
  return <HiOutlineBookOpen {...props} />;
}

export function subjectIconGradient(subjectGroup?: string): string {
  const colors = getSubjectColors(subjectGroup);
  return `linear-gradient(135deg, ${colors[1]} 0%, ${colors[0]} 100%)`;
}

export function isMathSubject(subjectName: string, subjectGroup?: string): boolean {
  const g = (subjectGroup || '').toLowerCase();
  if (g === 'math' || g.includes('math') || g.includes('คณิต')) return true;
  const lower = (subjectName || '').toLowerCase();
  return lower.includes('คณิต') || lower.includes('math');
}

export function isThaiSubject(subjectName: string, subjectGroup?: string): boolean {
  const g = (subjectGroup || '').toLowerCase();
  if (g === 'thai' || g.includes('thai') || g.includes('ภาษาไทย')) return true;
  const lower = (subjectName || '').toLowerCase();
  if (lower.includes('อังกฤษ') || lower.includes('english') || lower.includes('ต่างประเทศ')) return false;
  if (lower.includes('ภาษาไทย')) return true;
  return lower.includes('ไทย') && !lower.includes('ต่างประเทศ');
}

export function isScienceSubject(subjectName: string, subjectGroup?: string): boolean {
  const g = (subjectGroup || '').toLowerCase();
  if (g === 'science' || g.includes('science') || g.includes('วิทย')) return true;
  const lower = (subjectName || '').toLowerCase();
  return (
    lower.includes('วิทย') ||
    lower.includes('science') ||
    lower.includes('ชีว') ||
    lower.includes('เคมี') ||
    lower.includes('ฟิสิก') ||
    lower.includes('biology') ||
    lower.includes('chemistry') ||
    lower.includes('physics')
  );
}

export function isSocialSubject(subjectName: string, subjectGroup?: string): boolean {
  const g = (subjectGroup || '').toLowerCase();
  if (g === 'social' || g.includes('social') || g.includes('สังคม')) return true;
  const lower = (subjectName || '').toLowerCase();
  return (
    lower.includes('สังคม') ||
    lower.includes('ประวัติ') ||
    lower.includes('ภูมิ') ||
    lower.includes('หน้าที่พลเมือง') ||
    lower.includes('ศาสน') ||
    lower.includes('เศรษฐ') ||
    lower.includes('social') ||
    lower.includes('history') ||
    lower.includes('geography') ||
    lower.includes('civics')
  );
}

export function isForeignLanguageSubject(subjectName: string, subjectGroup?: string): boolean {
  if (isThaiSubject(subjectName, subjectGroup)) return false;
  const g = (subjectGroup || '').toLowerCase();
  if (g === 'foreign' || g.includes('foreign')) return true;
  if ((g.includes('lang') || g === 'language') && !g.includes('thai')) return true;
  const lower = (subjectName || '').toLowerCase();
  if (lower.includes('ภาษาไทย')) return false;
  return (
    lower.includes('ภาษาต่างประเทศ') ||
    lower.includes('อังกฤษ') ||
    lower.includes('english') ||
    lower.includes('จีน') ||
    lower.includes('ญี่ปุ่น') ||
    lower.includes('ฝรั่งเศส') ||
    lower.includes('เยอรมัน') ||
    lower.includes('สเปน') ||
    lower.includes('เกาหลี') ||
    lower.includes('french') ||
    lower.includes('japanese') ||
    lower.includes('chinese') ||
    lower.includes('korean') ||
    (lower.includes('ภาษา') && !lower.includes('ไทย'))
  );
}

export function isArtSubject(subjectName: string, subjectGroup?: string): boolean {
  const g = (subjectGroup || '').toLowerCase();
  if (g === 'art' || g === 'arts' || g.includes('art') || g.includes('ศิลป')) return true;
  const lower = (subjectName || '').toLowerCase();
  return (
    lower.includes('ศิลป') ||
    lower.includes('ดนตรี') ||
    lower.includes('นาฏ') ||
    lower.includes('ทัศนศิลป') ||
    lower.includes('วาด') ||
    lower.includes('art') ||
    lower.includes('music')
  );
}

export function isCareerSubject(subjectName: string, subjectGroup?: string): boolean {
  const g = (subjectGroup || '').toLowerCase();
  if (g === 'careers' || g === 'career' || g === 'work' || g.includes('career')) return true;
  const lower = (subjectName || '').toLowerCase();
  return (
    lower.includes('การงาน') ||
    lower.includes('อาชีพ') ||
    lower.includes('คอมพิวเตอร์') ||
    lower.includes('เทคโน') ||
    lower.includes('career') ||
    lower.includes('vocational')
  );
}

export function isHealthSubject(subjectName: string, subjectGroup?: string): boolean {
  const g = (subjectGroup || '').toLowerCase();
  if (g === 'health' || g === 'pe' || g.includes('health') || g.includes('pe')) return true;
  const lower = (subjectName || '').toLowerCase();
  return (
    lower.includes('สุขศึกษา') ||
    lower.includes('พลศึกษา') ||
    lower.includes('พละ') ||
    lower.includes('ออกกำลัง') ||
    lower.includes('health') ||
    lower.includes('physical')
  );
}

const MATH_SYMBOLS = ['+', '−', '×', '÷', '=', 'π', '√', '∑'] as const;
const THAI_CONSONANTS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ', 'ช', 'ซ'] as const;
const SCIENCE_MARKS = ['H₂O', 'CO₂', 'O₂', 'NaCl', 'DNA', 'pH', 'ATP'] as const;
const SOCIAL_MARKS = ['สังคม', 'ประวัติ', 'ภูมิ', 'รัฐ', 'โลก', 'N', 'E'] as const;
const FOREIGN_MARKS = ['ABC', 'Hello', 'Aa', 'EN', '文', 'Fr', '⇄'] as const;
const FOREIGN_LETTERS = ['A', 'B', 'C', 'Z', 'ñ', 'あ', 'Ω'] as const;
const ART_MARKS = ['♪', '♫', '♩', 'Art', 'Hue', 'Tone', '♬'] as const;
const CAREER_MARKS = ['งาน', 'อาชีพ', 'CV', 'Pro', 'Go', 'OK', '⚙'] as const;
const HEALTH_MARKS = ['สุข', 'พล', 'Fit', 'Run', 'Rep', 'GO', '♥'] as const;

function MathSubjectCardPattern() {
  return (
    <>
      <HiOutlineCalculator
        className="absolute -right-3 top-6 h-[4.5rem] w-[4.5rem] text-white/[0.13] rotate-[14deg]"
        strokeWidth={1.2}
      />
      <HiOutlineCalculator
        className="absolute -left-4 bottom-10 h-[3.25rem] w-[3.25rem] text-white/[0.08] -rotate-[18deg]"
        strokeWidth={1.2}
      />

      <span className="absolute left-[18%] top-[38%] text-[1.75rem] font-black leading-none text-white/[0.11] select-none rotate-[-8deg]">
        {MATH_SYMBOLS[0]}
      </span>
      <span className="absolute right-[28%] top-[22%] text-[1.35rem] font-black leading-none text-white/[0.09] select-none rotate-[12deg]">
        {MATH_SYMBOLS[2]}
      </span>
      <span className="absolute right-[12%] bottom-[34%] text-[1.5rem] font-black leading-none text-white/[0.1] select-none rotate-[-14deg]">
        {MATH_SYMBOLS[3]}
      </span>
      <span className="absolute left-[8%] bottom-[22%] text-[1.1rem] font-black leading-none text-white/[0.08] select-none">
        {MATH_SYMBOLS[4]}
      </span>
      <span className="absolute right-[42%] bottom-[12%] text-[1.65rem] font-black leading-none text-white/[0.12] select-none rotate-[6deg]">
        {MATH_SYMBOLS[5]}
      </span>
      <span className="absolute left-[42%] top-[14%] text-[1.15rem] font-black leading-none text-white/[0.07] select-none rotate-[-20deg]">
        {MATH_SYMBOLS[1]}
      </span>
      <span className="absolute left-[58%] top-[52%] text-[1rem] font-black leading-none text-white/[0.07] select-none rotate-[16deg]">
        {MATH_SYMBOLS[6]}
      </span>
      <span className="absolute right-[6%] top-[48%] text-[0.95rem] font-black leading-none text-white/[0.06] select-none rotate-[-10deg]">
        {MATH_SYMBOLS[7]}
      </span>

      <div className="absolute -right-[12%] -bottom-[18%] h-[46%] w-[46%] rounded-full border-[3px] border-white/[0.08]" />
      <div className="absolute -left-[8%] -top-[12%] h-[38%] w-[38%] rounded-full bg-white/[0.06]" />
    </>
  );
}

function ThaiKanokMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} fill="currentColor" aria-hidden>
      <path
        opacity="0.55"
        d="M60 10 C72 26, 88 22, 84 38 C98 42, 94 58, 78 54 C82 70, 66 78, 56 64 C44 78, 28 70, 32 54 C16 58, 12 42, 26 38 C22 22, 38 26, 50 10 C54 22, 58 22, 60 10 Z"
      />
      <path
        opacity="0.35"
        d="M60 30 C68 40, 78 38, 76 48 C84 50, 82 60, 72 58 C74 68, 64 72, 58 64 C50 72, 40 68, 42 58 C32 60, 30 50, 38 48 C36 38, 46 40, 54 30 C56 38, 58 38, 60 30 Z"
      />
    </svg>
  );
}

function ThaiSubjectCardPattern() {
  return (
    <>
      <HiOutlineLanguage
        className="absolute -right-2 top-5 h-[4.25rem] w-[4.25rem] text-white/[0.12] rotate-[10deg]"
        strokeWidth={1.2}
      />
      <HiOutlineLanguage
        className="absolute -left-3 bottom-11 h-[3.1rem] w-[3.1rem] text-white/[0.07] -rotate-[14deg]"
        strokeWidth={1.2}
      />

      <ThaiKanokMotif className="absolute -right-7 -top-7 h-32 w-32 text-white/[0.11]" />
      <ThaiKanokMotif className="absolute -left-8 bottom-2 h-24 w-24 text-white/[0.08] rotate-[165deg]" />

      <div className="absolute left-[9%] top-[24%] flex items-center gap-1.5 rotate-[-22deg]">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-2.5 w-2.5 rotate-45 border border-white/[0.14] bg-white/[0.04]"
            style={{ opacity: 0.55 + i * 0.08 }}
          />
        ))}
      </div>
      <div className="absolute right-[14%] bottom-[28%] flex flex-col gap-1 rotate-[18deg]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-1">
            <div className="h-2 w-2 rotate-45 border border-white/[0.12] bg-white/[0.05]" />
            <div className="h-2 w-2 rotate-45 border border-white/[0.1]" />
          </div>
        ))}
      </div>

      <span className="absolute left-[20%] top-[42%] text-[1.85rem] font-black leading-none text-white/[0.11] select-none font-sarabun rotate-[-6deg]">
        {THAI_CONSONANTS[0]}
      </span>
      <span className="absolute right-[30%] top-[18%] text-[1.45rem] font-black leading-none text-white/[0.09] select-none font-sarabun rotate-[11deg]">
        {THAI_CONSONANTS[1]}
      </span>
      <span className="absolute right-[10%] bottom-[36%] text-[1.6rem] font-black leading-none text-white/[0.1] select-none font-sarabun rotate-[-12deg]">
        {THAI_CONSONANTS[2]}
      </span>
      <span className="absolute left-[7%] bottom-[24%] text-[1.2rem] font-black leading-none text-white/[0.08] select-none font-sarabun">
        {THAI_CONSONANTS[3]}
      </span>
      <span className="absolute right-[44%] bottom-[14%] text-[1.55rem] font-black leading-none text-white/[0.11] select-none font-sarabun rotate-[5deg]">
        {THAI_CONSONANTS[4]}
      </span>
      <span className="absolute left-[46%] top-[13%] text-[1.05rem] font-black leading-none text-white/[0.07] select-none font-sarabun rotate-[-18deg]">
        {THAI_CONSONANTS[5]}
      </span>
      <span className="absolute left-[56%] top-[50%] text-[1rem] font-black leading-none text-white/[0.07] select-none font-sarabun rotate-[15deg]">
        {THAI_CONSONANTS[6]}
      </span>
      <span className="absolute right-[5%] top-[46%] text-[2rem] font-black leading-none text-white/[0.06] select-none font-sarabun rotate-[-8deg]">
        ๛
      </span>

      <svg
        className="absolute inset-x-0 bottom-0 h-10 text-white/[0.08]"
        viewBox="0 0 400 40"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path
          fill="currentColor"
          d="M0 28 C40 12, 80 36, 120 20 S200 12, 240 26 S320 34, 400 18 L400 40 L0 40 Z"
        />
      </svg>

      <div className="absolute -left-[7%] -bottom-[16%] h-[44%] w-[44%] rounded-full border-[3px] border-white/[0.09]" />
      <div className="absolute right-[6%] top-[38%] h-9 w-9 rotate-45 rounded-sm border border-white/[0.1] bg-white/[0.04]" />
    </>
  );
}

function AtomMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" aria-hidden>
      <circle cx="50" cy="50" r="5.5" fill="currentColor" stroke="none" opacity="0.55" />
      <ellipse cx="50" cy="50" rx="36" ry="13" strokeWidth="1.8" opacity="0.38" />
      <ellipse cx="50" cy="50" rx="36" ry="13" strokeWidth="1.8" opacity="0.38" transform="rotate(60 50 50)" />
      <ellipse cx="50" cy="50" rx="36" ry="13" strokeWidth="1.8" opacity="0.38" transform="rotate(120 50 50)" />
      <circle cx="86" cy="50" r="2.5" fill="currentColor" stroke="none" opacity="0.45" />
      <circle cx="22" cy="32" r="2" fill="currentColor" stroke="none" opacity="0.35" />
      <circle cx="28" cy="72" r="2" fill="currentColor" stroke="none" opacity="0.35" />
    </svg>
  );
}

function DnaHelixMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 120" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <path d="M12 8 C28 24, 4 40, 20 56 S28 88, 12 104" opacity="0.4" />
      <path d="M36 8 C20 24, 44 40, 28 56 S20 88, 36 104" opacity="0.4" />
      {[20, 36, 52, 68, 84].map((y) => (
        <line key={y} x1="14" y1={y} x2="34" y2={y} opacity="0.28" />
      ))}
    </svg>
  );
}

function ScienceSubjectCardPattern() {
  return (
    <>
      <HiOutlineBeaker
        className="absolute -right-3 top-6 h-[4.5rem] w-[4.5rem] text-white/[0.13] rotate-[12deg]"
        strokeWidth={1.2}
      />
      <HiOutlineBeaker
        className="absolute -left-4 bottom-10 h-[3.2rem] w-[3.2rem] text-white/[0.08] -rotate-[16deg]"
        strokeWidth={1.2}
      />

      <AtomMotif className="absolute -right-8 top-1 h-28 w-28 text-white/[0.11]" />
      <AtomMotif className="absolute left-[4%] bottom-[8%] h-20 w-20 text-white/[0.08] rotate-[24deg]" />
      <DnaHelixMotif className="absolute right-[10%] bottom-[6%] h-24 w-10 text-white/[0.1] rotate-[8deg]" />

      <span className="absolute left-[18%] top-[36%] text-[1.15rem] font-black leading-none text-white/[0.11] select-none rotate-[-8deg] tracking-tight">
        {SCIENCE_MARKS[0]}
      </span>
      <span className="absolute right-[28%] top-[20%] text-[1rem] font-black leading-none text-white/[0.09] select-none rotate-[10deg] tracking-tight">
        {SCIENCE_MARKS[1]}
      </span>
      <span className="absolute right-[11%] bottom-[38%] text-[1.05rem] font-black leading-none text-white/[0.1] select-none rotate-[-12deg] tracking-tight">
        {SCIENCE_MARKS[2]}
      </span>
      <span className="absolute left-[8%] bottom-[26%] text-[0.95rem] font-black leading-none text-white/[0.08] select-none tracking-tight">
        {SCIENCE_MARKS[3]}
      </span>
      <span className="absolute right-[40%] bottom-[16%] text-[1.2rem] font-black leading-none text-white/[0.11] select-none rotate-[6deg] tracking-tight">
        {SCIENCE_MARKS[4]}
      </span>
      <span className="absolute left-[44%] top-[14%] text-[0.95rem] font-black leading-none text-white/[0.07] select-none rotate-[-16deg]">
        {SCIENCE_MARKS[5]}
      </span>
      <span className="absolute left-[58%] top-[50%] text-[0.9rem] font-black leading-none text-white/[0.07] select-none rotate-[14deg] tracking-tight">
        {SCIENCE_MARKS[6]}
      </span>

      <svg
        className="absolute left-[12%] top-[22%] h-10 w-14 text-white/[0.09]"
        viewBox="0 0 56 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <circle cx="10" cy="20" r="6" opacity="0.55" />
        <circle cx="46" cy="20" r="6" opacity="0.55" />
        <line x1="16" y1="20" x2="40" y2="20" opacity="0.45" />
        <line x1="16" y1="16" x2="40" y2="16" opacity="0.35" />
        <line x1="16" y1="24" x2="40" y2="24" opacity="0.35" />
      </svg>

      <div className="absolute -right-[10%] -bottom-[16%] h-[44%] w-[44%] rounded-full border-[3px] border-white/[0.08]" />
      <div className="absolute -left-[6%] -top-[10%] h-[34%] w-[34%] rounded-full bg-white/[0.06]" />
      <div className="absolute right-[7%] top-[42%] h-2.5 w-2.5 rounded-full bg-white/[0.12]" />
      <div className="absolute right-[11%] top-[48%] h-1.5 w-1.5 rounded-full bg-white/[0.08]" />
      <div className="absolute right-[9%] top-[52%] h-2 w-2 rounded-full bg-white/[0.1]" />
    </>
  );
}

function GlobeGridMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" stroke="currentColor" aria-hidden>
      <circle cx="50" cy="50" r="38" strokeWidth="1.8" opacity="0.42" />
      <ellipse cx="50" cy="50" rx="14" ry="38" strokeWidth="1.4" opacity="0.32" />
      <ellipse cx="50" cy="50" rx="28" ry="38" strokeWidth="1.2" opacity="0.24" />
      <line x1="12" y1="50" x2="88" y2="50" strokeWidth="1.2" opacity="0.28" />
      <path d="M12 32 C28 40, 72 40, 88 32" strokeWidth="1.1" opacity="0.22" />
      <path d="M12 68 C28 60, 72 60, 88 68" strokeWidth="1.1" opacity="0.22" />
    </svg>
  );
}

function CompassMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} fill="none" stroke="currentColor" aria-hidden>
      <circle cx="40" cy="40" r="30" strokeWidth="1.6" opacity="0.38" />
      <circle cx="40" cy="40" r="22" strokeWidth="1" opacity="0.22" />
      <polygon points="40,14 44,38 40,34 36,38" fill="currentColor" stroke="none" opacity="0.45" />
      <polygon points="40,66 44,42 40,46 36,42" fill="currentColor" stroke="none" opacity="0.28" />
      <line x1="40" y1="10" x2="40" y2="16" strokeWidth="1.4" opacity="0.35" />
      <line x1="40" y1="64" x2="40" y2="70" strokeWidth="1.4" opacity="0.35" />
      <line x1="10" y1="40" x2="16" y2="40" strokeWidth="1.4" opacity="0.35" />
      <line x1="64" y1="40" x2="70" y2="40" strokeWidth="1.4" opacity="0.35" />
    </svg>
  );
}

function SocialSubjectCardPattern() {
  return (
    <>
      <HiOutlineGlobeAsiaAustralia
        className="absolute -right-3 top-6 h-[4.5rem] w-[4.5rem] text-white/[0.13] rotate-[10deg]"
        strokeWidth={1.2}
      />
      <HiOutlineGlobeAsiaAustralia
        className="absolute -left-4 bottom-10 h-[3.2rem] w-[3.2rem] text-white/[0.08] -rotate-[14deg]"
        strokeWidth={1.2}
      />

      <GlobeGridMotif className="absolute -right-9 top-0 h-32 w-32 text-white/[0.11]" />
      <CompassMotif className="absolute left-[2%] bottom-[10%] h-[4.5rem] w-[4.5rem] text-white/[0.1] rotate-[-12deg]" />

      <svg
        className="absolute right-[8%] bottom-[8%] h-16 w-20 text-white/[0.09]"
        viewBox="0 0 80 64"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <path d="M8 48 L24 18 L40 42 L56 24 L72 48 Z" opacity="0.35" />
        <line x1="8" y1="48" x2="72" y2="48" opacity="0.28" />
        <circle cx="24" cy="18" r="3" fill="currentColor" stroke="none" opacity="0.4" />
        <circle cx="56" cy="24" r="2.5" fill="currentColor" stroke="none" opacity="0.35" />
      </svg>

      <span className="absolute left-[18%] top-[36%] text-[1.2rem] font-black leading-none text-white/[0.11] select-none font-sukhumvit rotate-[-7deg]">
        {SOCIAL_MARKS[0]}
      </span>
      <span className="absolute right-[30%] top-[18%] text-[1rem] font-black leading-none text-white/[0.09] select-none font-sukhumvit rotate-[9deg]">
        {SOCIAL_MARKS[1]}
      </span>
      <span className="absolute right-[10%] bottom-[36%] text-[1.05rem] font-black leading-none text-white/[0.1] select-none font-sukhumvit rotate-[-11deg]">
        {SOCIAL_MARKS[2]}
      </span>
      <span className="absolute left-[7%] bottom-[24%] text-[0.95rem] font-black leading-none text-white/[0.08] select-none font-sukhumvit">
        {SOCIAL_MARKS[3]}
      </span>
      <span className="absolute right-[42%] bottom-[14%] text-[1.1rem] font-black leading-none text-white/[0.11] select-none font-sukhumvit rotate-[5deg]">
        {SOCIAL_MARKS[4]}
      </span>
      <span className="absolute left-[46%] top-[13%] text-[1rem] font-black leading-none text-white/[0.08] select-none rotate-[-14deg]">
        {SOCIAL_MARKS[5]}
      </span>
      <span className="absolute left-[58%] top-[50%] text-[1rem] font-black leading-none text-white/[0.07] select-none rotate-[12deg]">
        {SOCIAL_MARKS[6]}
      </span>
      <span className="absolute right-[5%] top-[44%] text-[1.35rem] font-black leading-none text-white/[0.08] select-none rotate-[-6deg]">
        ⚖
      </span>

      <div className="absolute left-[11%] top-[22%] flex flex-col gap-1.5 rotate-[8deg]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-white/[0.12]" />
            <div className="h-px w-5 bg-white/[0.1] self-center" />
          </div>
        ))}
      </div>

      <div className="absolute -right-[10%] -bottom-[16%] h-[44%] w-[44%] rounded-full border-[3px] border-white/[0.08]" />
      <div className="absolute -left-[6%] -top-[10%] h-[34%] w-[34%] rounded-full bg-white/[0.06]" />
      <div className="absolute right-[18%] top-[40%] h-2 w-2 rounded-full border border-white/[0.14] bg-white/[0.08]" />
    </>
  );
}

function SpeechBubbleMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 88 72" className={className} fill="currentColor" aria-hidden>
      <path
        opacity="0.14"
        d="M10 8h52a10 10 0 0 1 10 10v18a10 10 0 0 1-10 10H34l-10 12v-12H10a10 10 0 0 1-10-10V18a10 10 0 0 1 10-10z"
      />
      <path
        opacity="0.1"
        d="M58 24h20a8 8 0 0 1 8 8v12a8 8 0 0 1-8 8H68l-6 8v-8H58a8 8 0 0 1-8-8V32a8 8 0 0 1 8-8z"
      />
    </svg>
  );
}

function ForeignLanguageSubjectCardPattern() {
  return (
    <>
      <HiOutlineChatBubbleLeftRight
        className="absolute -right-3 top-6 h-[4.5rem] w-[4.5rem] text-white/[0.13] rotate-[8deg]"
        strokeWidth={1.2}
      />
      <HiOutlineChatBubbleLeftRight
        className="absolute -left-4 bottom-10 h-[3.2rem] w-[3.2rem] text-white/[0.08] -rotate-[12deg]"
        strokeWidth={1.2}
      />

      <SpeechBubbleMotif className="absolute -right-6 top-2 h-24 w-28 text-white" />
      <SpeechBubbleMotif className="absolute left-[0%] bottom-[14%] h-20 w-24 text-white rotate-[165deg]" />

      <span className="absolute right-[14%] top-[10%] text-[2.4rem] font-black leading-none text-white/[0.1] select-none tracking-tighter rotate-[6deg]">
        Aa
      </span>

      <span className="absolute left-[18%] top-[36%] text-[1.1rem] font-black leading-none text-white/[0.11] select-none rotate-[-8deg] tracking-wide">
        {FOREIGN_MARKS[0]}
      </span>
      <span className="absolute right-[30%] top-[20%] text-[0.95rem] font-black leading-none text-white/[0.09] select-none rotate-[10deg]">
        {FOREIGN_MARKS[1]}
      </span>
      <span className="absolute right-[10%] bottom-[36%] text-[1.15rem] font-black leading-none text-white/[0.1] select-none rotate-[-11deg]">
        {FOREIGN_MARKS[2]}
      </span>
      <span className="absolute left-[7%] bottom-[24%] text-[0.95rem] font-black leading-none text-white/[0.08] select-none tracking-wide">
        {FOREIGN_MARKS[3]}
      </span>
      <span className="absolute right-[40%] bottom-[14%] text-[1.25rem] font-black leading-none text-white/[0.11] select-none rotate-[4deg]">
        {FOREIGN_MARKS[4]}
      </span>
      <span className="absolute left-[44%] top-[14%] text-[0.9rem] font-black leading-none text-white/[0.07] select-none rotate-[-15deg]">
        {FOREIGN_MARKS[5]}
      </span>
      <span className="absolute left-[58%] top-[50%] text-[1.05rem] font-black leading-none text-white/[0.08] select-none rotate-[12deg]">
        {FOREIGN_MARKS[6]}
      </span>

      <span className="absolute left-[22%] top-[16%] text-[1.5rem] font-black leading-none text-white/[0.09] select-none rotate-[-18deg]">
        {FOREIGN_LETTERS[0]}
      </span>
      <span className="absolute right-[22%] top-[44%] text-[1.25rem] font-black leading-none text-white/[0.08] select-none rotate-[14deg]">
        {FOREIGN_LETTERS[1]}
      </span>
      <span className="absolute left-[12%] top-[52%] text-[1.1rem] font-black leading-none text-white/[0.07] select-none rotate-[8deg]">
        {FOREIGN_LETTERS[2]}
      </span>
      <span className="absolute right-[6%] top-[48%] text-[1.35rem] font-black leading-none text-white/[0.07] select-none rotate-[-6deg]">
        {FOREIGN_LETTERS[3]}
      </span>
      <span className="absolute left-[50%] bottom-[22%] text-[1rem] font-black leading-none text-white/[0.06] select-none rotate-[20deg]">
        {FOREIGN_LETTERS[4]}
      </span>
      <span className="absolute right-[48%] top-[28%] text-[1rem] font-black leading-none text-white/[0.06] select-none">
        {FOREIGN_LETTERS[5]}
      </span>
      <span className="absolute left-[36%] bottom-[10%] text-[1.1rem] font-black leading-none text-white/[0.07] select-none rotate-[-10deg]">
        {FOREIGN_LETTERS[6]}
      </span>

      <svg
        className="absolute left-[10%] top-[24%] h-8 w-12 text-white/[0.1]"
        viewBox="0 0 48 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden
      >
        <path d="M6 16 H18" opacity="0.45" />
        <path d="M14 12 L18 16 L14 20" opacity="0.45" />
        <path d="M42 16 H30" opacity="0.45" />
        <path d="M34 12 L30 16 L34 20" opacity="0.45" />
      </svg>

      <span className="absolute right-[8%] bottom-[10%] text-[1.6rem] font-serif leading-none text-white/[0.08] select-none rotate-[3deg]">
        “ ”
      </span>

      <div className="absolute -right-[10%] -bottom-[16%] h-[44%] w-[44%] rounded-full border-[3px] border-white/[0.08]" />
      <div className="absolute -left-[6%] -top-[10%] h-[34%] w-[34%] rounded-full bg-white/[0.06]" />
      <div className="absolute right-[20%] top-[38%] h-7 w-10 rounded-lg border border-white/[0.12] bg-white/[0.05] rotate-[6deg]" />
    </>
  );
}

function PaletteMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 88 72" className={className} fill="none" stroke="currentColor" aria-hidden>
      <ellipse cx="44" cy="40" rx="30" ry="22" strokeWidth="1.8" opacity="0.38" />
      <circle cx="44" cy="40" r="6" strokeWidth="1.4" opacity="0.3" />
      <circle cx="28" cy="34" r="4.5" fill="currentColor" stroke="none" opacity="0.28" />
      <circle cx="40" cy="28" r="4.5" fill="currentColor" stroke="none" opacity="0.24" />
      <circle cx="54" cy="30" r="4.5" fill="currentColor" stroke="none" opacity="0.26" />
      <circle cx="58" cy="44" r="4.5" fill="currentColor" stroke="none" opacity="0.22" />
      <circle cx="32" cy="46" r="4.5" fill="currentColor" stroke="none" opacity="0.2" />
      <path d="M62 18 C68 24, 72 30, 68 36" strokeWidth="2" opacity="0.32" strokeLinecap="round" />
    </svg>
  );
}

function BrushStrokeMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 48" className={className} fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden>
      <path d="M8 34 C28 18, 48 30, 68 16 S98 24, 112 10" strokeWidth="3" opacity="0.18" />
      <path d="M12 40 C34 28, 56 38, 78 26 S102 32, 110 24" strokeWidth="2" opacity="0.12" />
    </svg>
  );
}

function ArtSubjectCardPattern() {
  return (
    <>
      <HiOutlinePaintBrush
        className="absolute -right-3 top-6 h-[4.5rem] w-[4.5rem] text-white/[0.13] rotate-[12deg]"
        strokeWidth={1.2}
      />
      <HiOutlinePaintBrush
        className="absolute -left-4 bottom-10 h-[3.2rem] w-[3.2rem] text-white/[0.08] -rotate-[16deg]"
        strokeWidth={1.2}
      />

      <PaletteMotif className="absolute -right-8 top-1 h-28 w-32 text-white/[0.11]" />
      <BrushStrokeMotif className="absolute inset-x-[8%] bottom-[10%] h-10 text-white/[0.1] rotate-[-4deg]" />

      <span className="absolute left-[18%] top-[36%] text-[1.45rem] font-black leading-none text-white/[0.11] select-none rotate-[-10deg]">
        {ART_MARKS[0]}
      </span>
      <span className="absolute right-[28%] top-[18%] text-[1.25rem] font-black leading-none text-white/[0.09] select-none rotate-[8deg]">
        {ART_MARKS[1]}
      </span>
      <span className="absolute right-[10%] bottom-[36%] text-[1.35rem] font-black leading-none text-white/[0.1] select-none rotate-[-12deg]">
        {ART_MARKS[2]}
      </span>
      <span className="absolute left-[7%] bottom-[24%] text-[0.95rem] font-black leading-none text-white/[0.08] select-none tracking-wide">
        {ART_MARKS[3]}
      </span>
      <span className="absolute right-[40%] bottom-[14%] text-[0.9rem] font-black leading-none text-white/[0.09] select-none rotate-[5deg]">
        {ART_MARKS[4]}
      </span>
      <span className="absolute left-[44%] top-[14%] text-[0.9rem] font-black leading-none text-white/[0.07] select-none rotate-[-14deg]">
        {ART_MARKS[5]}
      </span>
      <span className="absolute left-[58%] top-[50%] text-[1.2rem] font-black leading-none text-white/[0.08] select-none rotate-[14deg]">
        {ART_MARKS[6]}
      </span>

      <div className="absolute left-[12%] top-[20%] flex gap-2 rotate-[-8deg]">
        <div className="h-3 w-3 rounded-full bg-white/[0.16]" />
        <div className="h-2.5 w-2.5 rounded-full bg-white/[0.12] mt-1" />
        <div className="h-2 w-2 rounded-full bg-white/[0.1] mt-2" />
      </div>
      <div className="absolute right-[16%] top-[42%] flex flex-col gap-1.5 rotate-[12deg]">
        <div className="h-2 w-2 rounded-full bg-white/[0.14]" />
        <div className="h-3.5 w-3.5 rounded-full bg-white/[0.1]" />
        <div className="h-2 w-2 rounded-full bg-white/[0.08]" />
      </div>

      <svg
        className="absolute left-[10%] top-[48%] h-12 w-10 text-white/[0.09]"
        viewBox="0 0 40 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden
      >
        <rect x="8" y="10" width="24" height="28" rx="3" opacity="0.35" />
        <path d="M12 18 H28 M12 24 H24 M12 30 H26" opacity="0.28" />
        <path d="M20 6 L24 10 H16 Z" fill="currentColor" stroke="none" opacity="0.25" />
      </svg>

      <div className="absolute right-[6%] top-[22%] h-8 w-8 rotate-12 border-2 border-white/[0.12] bg-white/[0.05]" />
      <div className="absolute right-[10%] top-[30%] h-5 w-5 rotate-45 border border-white/[0.1] bg-white/[0.04]" />

      <div className="absolute -right-[10%] -bottom-[16%] h-[44%] w-[44%] rounded-full border-[3px] border-white/[0.08]" />
      <div className="absolute -left-[6%] -top-[10%] h-[34%] w-[34%] rounded-full bg-white/[0.06]" />
    </>
  );
}

function GearMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" className={className} fill="none" stroke="currentColor" aria-hidden>
      <circle cx="40" cy="40" r="10" strokeWidth="1.8" opacity="0.38" />
      <circle cx="40" cy="40" r="4" fill="currentColor" stroke="none" opacity="0.3" />
      {[0, 45, 90, 135].map((deg) => (
        <rect
          key={deg}
          x="36"
          y="8"
          width="8"
          height="12"
          rx="2"
          fill="currentColor"
          stroke="none"
          opacity="0.28"
          transform={`rotate(${deg} 40 40)`}
        />
      ))}
      {[22.5, 67.5, 112.5, 157.5].map((deg) => (
        <rect
          key={deg}
          x="37"
          y="12"
          width="6"
          height="9"
          rx="1.5"
          fill="currentColor"
          stroke="none"
          opacity="0.2"
          transform={`rotate(${deg} 40 40)`}
        />
      ))}
    </svg>
  );
}

function BlueprintGridMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 72" className={className} fill="none" stroke="currentColor" aria-hidden>
      {[12, 24, 36, 48, 60].map((y) => (
        <line key={`h-${y}`} x1="0" y1={y} x2="100" y2={y} strokeWidth="0.8" opacity="0.14" />
      ))}
      {[12, 28, 44, 60, 76, 92].map((x) => (
        <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="72" strokeWidth="0.8" opacity="0.12" />
      ))}
      <rect x="18" y="14" width="28" height="20" strokeWidth="1.4" opacity="0.22" />
      <path d="M56 42 H88 V62 H56 Z" strokeWidth="1.4" opacity="0.2" />
    </svg>
  );
}

function CareerSubjectCardPattern() {
  return (
    <>
      <HiOutlineBriefcase
        className="absolute -right-3 top-6 h-[4.5rem] w-[4.5rem] text-white/[0.13] rotate-[10deg]"
        strokeWidth={1.2}
      />
      <HiOutlineBriefcase
        className="absolute -left-4 bottom-10 h-[3.2rem] w-[3.2rem] text-white/[0.08] -rotate-[14deg]"
        strokeWidth={1.2}
      />

      <GearMotif className="absolute -right-7 top-2 h-24 w-24 text-white/[0.11]" />
      <GearMotif className="absolute left-[2%] bottom-[12%] h-[3.5rem] w-[3.5rem] text-white/[0.08] rotate-[18deg]" />
      <BlueprintGridMotif className="absolute right-[6%] bottom-[6%] h-16 w-24 text-white/[0.09] rotate-[-6deg]" />

      <span className="absolute left-[18%] top-[36%] text-[1.15rem] font-black leading-none text-white/[0.11] select-none font-sukhumvit rotate-[-7deg]">
        {CAREER_MARKS[0]}
      </span>
      <span className="absolute right-[30%] top-[18%] text-[1rem] font-black leading-none text-white/[0.09] select-none font-sukhumvit rotate-[9deg]">
        {CAREER_MARKS[1]}
      </span>
      <span className="absolute right-[10%] bottom-[36%] text-[1.05rem] font-black leading-none text-white/[0.1] select-none tracking-wide rotate-[-11deg]">
        {CAREER_MARKS[2]}
      </span>
      <span className="absolute left-[7%] bottom-[24%] text-[0.95rem] font-black leading-none text-white/[0.08] select-none tracking-wide">
        {CAREER_MARKS[3]}
      </span>
      <span className="absolute right-[42%] bottom-[14%] text-[0.95rem] font-black leading-none text-white/[0.09] select-none rotate-[5deg]">
        {CAREER_MARKS[4]}
      </span>
      <span className="absolute left-[46%] top-[14%] text-[0.95rem] font-black leading-none text-white/[0.07] select-none rotate-[-14deg]">
        {CAREER_MARKS[5]}
      </span>
      <span className="absolute left-[58%] top-[50%] text-[1.15rem] font-black leading-none text-white/[0.08] select-none rotate-[12deg]">
        {CAREER_MARKS[6]}
      </span>

      <svg
        className="absolute left-[10%] top-[22%] h-10 w-10 text-white/[0.1]"
        viewBox="0 0 40 40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M12 28 C18 12, 30 12, 28 28" opacity="0.38" />
        <path d="M28 28 L34 34" opacity="0.35" />
        <circle cx="34" cy="34" r="2" fill="currentColor" stroke="none" opacity="0.3" />
      </svg>

      <svg
        className="absolute right-[18%] top-[38%] h-9 w-9 text-white/[0.09] rotate-[24deg]"
        viewBox="0 0 36 36"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <path d="M8 26 L16 8 L24 26 Z" opacity="0.32" />
        <line x1="11" y1="20" x2="21" y2="20" opacity="0.28" />
      </svg>

      <div className="absolute left-[12%] top-[48%] flex gap-1 rotate-[6deg]">
        <div className="h-1 w-6 bg-white/[0.12] rounded-full" />
        <div className="h-1 w-4 bg-white/[0.08] rounded-full mt-1.5" />
        <div className="h-1 w-5 bg-white/[0.1] rounded-full mt-3" />
      </div>

      <div className="absolute -right-[10%] -bottom-[16%] h-[44%] w-[44%] rounded-full border-[3px] border-white/[0.08]" />
      <div className="absolute -left-[6%] -top-[10%] h-[34%] w-[34%] rounded-full bg-white/[0.06]" />
      <div className="absolute right-[8%] top-[20%] h-6 w-8 rounded-md border border-white/[0.12] bg-white/[0.05] rotate-[-8deg]" />
    </>
  );
}

function HeartbeatMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 36" className={className} fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden>
      <path
        d="M0 18 H22 L28 8 L34 28 L40 12 L46 18 H120"
        strokeWidth="2.2"
        opacity="0.34"
      />
    </svg>
  );
}

function DumbbellMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 72 32" className={className} fill="none" stroke="currentColor" aria-hidden>
      <rect x="6" y="10" width="10" height="12" rx="2" strokeWidth="1.6" opacity="0.34" />
      <rect x="56" y="10" width="10" height="12" rx="2" strokeWidth="1.6" opacity="0.34" />
      <line x1="16" y1="16" x2="56" y2="16" strokeWidth="2.4" opacity="0.3" strokeLinecap="round" />
    </svg>
  );
}

function TrackMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 56" className={className} fill="none" stroke="currentColor" aria-hidden>
      <ellipse cx="50" cy="28" rx="42" ry="18" strokeWidth="1.6" opacity="0.28" />
      <ellipse cx="50" cy="28" rx="30" ry="12" strokeWidth="1.2" opacity="0.18" />
      <path d="M8 28 H92" strokeWidth="1" opacity="0.14" strokeDasharray="4 4" />
    </svg>
  );
}

function HealthSubjectCardPattern() {
  return (
    <>
      <HiOutlineHeart
        className="absolute -right-3 top-6 h-[4.5rem] w-[4.5rem] text-white/[0.13] rotate-[8deg]"
        strokeWidth={1.2}
      />
      <HiOutlineHeart
        className="absolute -left-4 bottom-10 h-[3.2rem] w-[3.2rem] text-white/[0.08] -rotate-[12deg]"
        strokeWidth={1.2}
      />

      <HeartbeatMotif className="absolute inset-x-[6%] top-[12%] h-8 text-white/[0.1] rotate-[-3deg]" />
      <DumbbellMotif className="absolute -right-6 top-[38%] h-8 w-20 text-white/[0.11] rotate-[12deg]" />
      <TrackMotif className="absolute left-[0%] bottom-[8%] h-14 w-28 text-white/[0.09] rotate-[-8deg]" />

      <span className="absolute left-[18%] top-[36%] text-[1.1rem] font-black leading-none text-white/[0.11] select-none font-sukhumvit rotate-[-7deg]">
        {HEALTH_MARKS[0]}
      </span>
      <span className="absolute right-[30%] top-[20%] text-[1.05rem] font-black leading-none text-white/[0.09] select-none font-sukhumvit rotate-[9deg]">
        {HEALTH_MARKS[1]}
      </span>
      <span className="absolute right-[10%] bottom-[36%] text-[1rem] font-black leading-none text-white/[0.1] select-none tracking-wide rotate-[-11deg]">
        {HEALTH_MARKS[2]}
      </span>
      <span className="absolute left-[7%] bottom-[24%] text-[0.95rem] font-black leading-none text-white/[0.08] select-none tracking-wide">
        {HEALTH_MARKS[3]}
      </span>
      <span className="absolute right-[42%] bottom-[14%] text-[0.95rem] font-black leading-none text-white/[0.09] select-none rotate-[5deg]">
        {HEALTH_MARKS[4]}
      </span>
      <span className="absolute left-[46%] top-[14%] text-[0.95rem] font-black leading-none text-white/[0.07] select-none rotate-[-14deg]">
        {HEALTH_MARKS[5]}
      </span>
      <span className="absolute left-[58%] top-[50%] text-[1.2rem] font-black leading-none text-white/[0.1] select-none rotate-[10deg]">
        {HEALTH_MARKS[6]}
      </span>

      <svg
        className="absolute right-[14%] top-[44%] h-12 w-10 text-white/[0.09]"
        viewBox="0 0 40 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="28" cy="8" r="4" opacity="0.32" />
        <path d="M28 12 V22 M24 16 H32" opacity="0.3" />
        <path d="M10 38 C10 30, 16 24, 22 24 C18 24, 16 20, 18 16 C20 12, 24 12, 26 16 C28 20, 26 24, 22 24 C28 24, 34 30, 34 38" opacity="0.28" />
      </svg>

      <svg
        className="absolute left-[10%] top-[22%] h-9 w-9 text-white/[0.08]"
        viewBox="0 0 36 36"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <circle cx="18" cy="18" r="12" opacity="0.28" />
        <path d="M18 6 V10 M18 26 V30 M6 18 H10 M26 18 H30" opacity="0.22" />
        <polygon points="18,12 20,18 18,16 16,18" fill="currentColor" stroke="none" opacity="0.24" />
      </svg>

      <div className="absolute right-[6%] top-[22%] flex gap-1 rotate-[15deg]">
        <div className="h-2 w-2 rounded-full bg-white/[0.12]" />
        <div className="h-2.5 w-2.5 rounded-full bg-white/[0.1] -mt-1" />
        <div className="h-2 w-2 rounded-full bg-white/[0.08] mt-0.5" />
      </div>

      <div className="absolute -right-[10%] -bottom-[16%] h-[44%] w-[44%] rounded-full border-[3px] border-white/[0.08]" />
      <div className="absolute -left-[6%] -top-[10%] h-[34%] w-[34%] rounded-full bg-white/[0.06]" />
    </>
  );
}

type SubjectPatternKind = 'math' | 'thai' | 'science' | 'social' | 'foreign' | 'art' | 'career' | 'health';

function resolveSubjectPatternKind(subjectName: string, subjectGroup?: string): SubjectPatternKind | null {
  if (isMathSubject(subjectName, subjectGroup)) return 'math';
  if (isThaiSubject(subjectName, subjectGroup)) return 'thai';
  if (isScienceSubject(subjectName, subjectGroup)) return 'science';
  if (isSocialSubject(subjectName, subjectGroup)) return 'social';
  if (isForeignLanguageSubject(subjectName, subjectGroup)) return 'foreign';
  if (isArtSubject(subjectName, subjectGroup)) return 'art';
  if (isCareerSubject(subjectName, subjectGroup)) return 'career';
  if (isHealthSubject(subjectName, subjectGroup)) return 'health';
  return null;
}

/** Decorative overlay for solid subject cards */
export function SubjectGradeCardPattern({
  subjectName,
  subjectGroup,
}: {
  subjectName: string;
  subjectGroup?: string;
}) {
  const kind = resolveSubjectPatternKind(subjectName, subjectGroup);
  if (!kind) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {kind === 'math' && <MathSubjectCardPattern />}
      {kind === 'thai' && <ThaiSubjectCardPattern />}
      {kind === 'science' && <ScienceSubjectCardPattern />}
      {kind === 'social' && <SocialSubjectCardPattern />}
      {kind === 'foreign' && <ForeignLanguageSubjectCardPattern />}
      {kind === 'art' && <ArtSubjectCardPattern />}
      {kind === 'career' && <CareerSubjectCardPattern />}
      {kind === 'health' && <HealthSubjectCardPattern />}
    </div>
  );
}
