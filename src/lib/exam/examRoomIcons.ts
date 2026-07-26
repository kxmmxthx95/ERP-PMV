import type { SubjectGroupId } from '@/types/curriculum';

/** 3D icon ต่อสาระย่อย — กลุ่ม/สาระย่อยอื่นที่ยังไม่มีไอคอน fallback ไปที่ BLANK */
const EXAM_ROOM_SUB_SUBJECT_ICONS: Partial<Record<SubjectGroupId, Record<string, string>>> = {
  science: {
    'ฟิสิกส์': '/EXAM%20ROOM/PHYSIC.webp',
    'เคมี': '/EXAM%20ROOM/CHEM.webp',
    'ชีววิทยา': '/EXAM%20ROOM/BIO.webp',
    'วิทยาศาสตร์ทั่วไป': '/EXAM%20ROOM/GEN.webp',
    'วิทยาการคำนวณ': '/EXAM%20ROOM/COM.webp',
  },
  social: {
    'ศาสนา ศีลธรรม จริยธรรม': '/EXAM%20ROOM/SOC/12.webp',
    'หน้าที่พลเมือง': '/EXAM%20ROOM/SOC/7.webp',
    'ประวัติศาสตร์': '/EXAM%20ROOM/SOC/8.webp',
    'ภูมิศาสตร์': '/EXAM%20ROOM/SOC/11.webp',
    'เศรษฐศาสตร์': '/EXAM%20ROOM/SOC/9.webp',
  },
};
/** ไอคอนระดับสาระหลัก — ใช้เมื่อไม่มีไอคอนเฉพาะสาระย่อย (ไม่สนสาระย่อยที่เลือก) */
const EXAM_ROOM_GROUP_ICONS: Partial<Record<SubjectGroupId, string>> = {
  math: '/EXAM%20ROOM/MATH.webp',
  foreign: '/EXAM%20ROOM/ENG.webp',
  thai: '/EXAM%20ROOM/THAI.webp',
};

const EXAM_ROOM_BLANK_ICON = '/EXAM%20ROOM/BLANK.webp';

export function resolveExamRoomIconSrc(room: { subjectGroupId?: string; subSubjectGroup?: string }): string {
  const groupId = room.subjectGroupId as SubjectGroupId | undefined;
  const sub = room.subSubjectGroup?.trim();
  if (groupId && sub && EXAM_ROOM_SUB_SUBJECT_ICONS[groupId]?.[sub]) {
    return EXAM_ROOM_SUB_SUBJECT_ICONS[groupId]![sub];
  }
  if (groupId && EXAM_ROOM_GROUP_ICONS[groupId]) return EXAM_ROOM_GROUP_ICONS[groupId]!;
  return EXAM_ROOM_BLANK_ICON;
}
