export const SUBJECT_THEMES = {
  math: "blue",
  science: "emerald",
  language: "sky",
  thai: "rose",
  social: "orange",
  art: "purple",
  health: "red",
  work: "stone",
  default: "gray" // เผื่อวิชาเลือกเสรีอื่นๆ
} as const;

export type SubjectThemeKey = keyof typeof SUBJECT_THEMES;
