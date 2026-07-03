/** ป้ายตัวเลือกปรนัยมาตรฐาน (ก–ฉ สูงสุด 6 ตัวเลือก) */
export const DEFAULT_OPTION_LABELS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'] as const;

export type OptionLabel = (typeof DEFAULT_OPTION_LABELS)[number];
