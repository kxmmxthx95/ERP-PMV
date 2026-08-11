/**
 * ชื่อวิชา/สาระไทย → ตัวย่ออังกฤษ 3–4 ตัว สำหรับหัวตาราง
 * (ใช้ร่วม midterm matrix / grade assessment)
 */

const SUBJECT_HEADER_ABBR: Record<string, string> = {
  ภาษาไทย: 'THAI',
  คณิตศาสตร์: 'MATH',
  วิทยาศาสตร์และเทคโนโลยี: 'SCI',
  'สังคมศึกษา ศาสนา และวัฒนธรรม': 'SOC',
  สุขศึกษาและพลศึกษา: 'HPE',
  ศิลปะ: 'ARTS',
  การงานอาชีพ: 'CARE',
  ภาษาต่างประเทศ: 'LANG',
  'สอบเข้า ม.4': 'ADM',
  'O-NET': 'ONET',
  'A-LEVEL': 'ALVL',
  'อื่นๆ / กิจกรรม': 'OTH',
  วิทยาศาสตร์ทั่วไป: 'GSCI',
  ฟิสิกส์: 'PHYS',
  เคมี: 'CHEM',
  ชีววิทยา: 'BIO',
  'โลก ดาราศาสตร์ และอวกาศ': 'ASTR',
  วิทยาการคำนวณ: 'COMP',
  คณิตศาสตร์พื้นฐาน: 'MBAS',
  คณิตศาสตร์เพิ่มเติม: 'MEXT',
  วิทยาศาสตร์พื้นฐาน: 'SBAS',
  วิทยาศาสตร์เพิ่มเติม: 'SEXT',
  ภาษาอังกฤษพื้นฐาน: 'EBAS',
  ภาษาอังกฤษเพิ่มเติม: 'EEXT',
  ภาษาอังกฤษ: 'ENG',
  ภาษาจีน: 'CHIN',
  ภาษาญี่ปุ่น: 'JPN',
  ภาษาฝรั่งเศส: 'FRN',
  'ศาสนา ศีลธรรม จริยธรรม': 'REL',
  หน้าที่พลเมือง: 'CIV',
  เศรษฐศาสตร์: 'ECON',
  ประวัติศาสตร์: 'HIST',
  ภูมิศาสตร์: 'GEOG',
  ต้านทุจริต: 'ANTI',
};

/** คำสำคัญในชื่อวิชา → ตัวย่อ (match บางส่วน) */
const NAME_CONTAINS_ABBR: [string, string][] = [
  ['ภาษาไทย', 'THAI'],
  ['คณิต', 'MATH'],
  ['ฟิสิกส์', 'PHYS'],
  ['เคมี', 'CHEM'],
  ['ชีววิทยา', 'BIO'],
  ['วิทยาการคำนวณ', 'COMP'],
  ['คอมพิวเตอร์', 'COMP'],
  ['วิทยาศาสตร์พื้นฐาน', 'SBAS'],
  ['วิทยาศาสตร์เพิ่มเติม', 'SEXT'],
  ['วิทยาศาสตร์', 'SCI'],
  ['ต้านทุจริต', 'ANTI'],
  ['ทุจริต', 'ANTI'],
  ['สังคม', 'SOC'],
  ['ประวัติศาสตร์', 'HIST'],
  ['ภูมิศาสตร์', 'GEOG'],
  ['เศรษฐศาสตร์', 'ECON'],
  ['หน้าที่พลเมือง', 'CIV'],
  ['ศาสนา', 'REL'],
  ['สุขศึกษา', 'HPE'],
  ['พลศึกษา', 'HPE'],
  ['ศิลปะ', 'ARTS'],
  ['ดนตรี', 'ARTS'],
  ['นาฏศิลป์', 'ARTS'],
  ['การงาน', 'CARE'],
  ['ภาษาอังกฤษพื้นฐาน', 'EBAS'],
  ['ภาษาอังกฤษเพิ่มเติม', 'EEXT'],
  ['ภาษาอังกฤษ', 'ENG'],
  ['อังกฤษ', 'ENG'],
  ['ภาษาจีน', 'CHIN'],
  ['ภาษาญี่ปุ่น', 'JPN'],
  ['ภาษาฝรั่งเศส', 'FRN'],
  ['O-NET', 'ONET'],
  ['ONET', 'ONET'],
  ['A-LEVEL', 'ALVL'],
];

/**
 * แปลงชื่อวิชาเป็นตัวย่อ EN สำหรับหัวตาราง
 * tooltip ยังใช้ชื่อเต็มไทยได้
 */
export function subjectNameToEnAbbr(
  subjectName: string | undefined | null,
  subjectCode?: string | undefined | null,
): string {
  const name = String(subjectName ?? '').trim();
  if (name) {
    const exact = SUBJECT_HEADER_ABBR[name];
    if (exact) return exact;
    for (const [key, abbr] of NAME_CONTAINS_ABBR) {
      if (name.includes(key)) return abbr;
    }
    const latinFromName = name.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (latinFromName.length >= 3) return latinFromName.slice(0, 4);
  }

  const code = String(subjectCode ?? '').trim();
  if (code) {
    const latinFromCode = code.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (latinFromCode.length >= 2) return latinFromCode.slice(0, 4);
    // รหัสไทย เช่น ท21101 → ใช้ตัวอักษรแรก map
    const letter = code.charAt(0);
    const CODE_LETTER: Record<string, string> = {
      ท: 'THAI',
      ค: 'MATH',
      ว: 'SCI',
      ส: 'SOC',
      พ: 'HPE',
      ศ: 'ARTS',
      ง: 'CARE',
      อ: 'ENG',
    };
    if (CODE_LETTER[letter]) return CODE_LETTER[letter];
  }

  return 'OTH';
}
