import type { MultipleChoiceOption, NewQuestion, Question, QuestionDifficulty } from '@/types/questionBank';
import { DEFAULT_OPTION_LABELS } from '@/features/questionBank/utils/optionLabels';

export const PDF_OPTION_LABELS = DEFAULT_OPTION_LABELS;
export const PDF_OPTION_IDS = ['1', '2', '3', '4', '5', '6'] as const;
export type PdfOptionCount = 4 | 5 | 6;
export const PDF_YESNO_LABELS = ['ใช่', 'ไม่ใช่'] as const;

export type PdfQuestionMode = 'choice' | 'yesno' | 'text';

export interface PdfAnswerKeyEntry {
  /** เลขข้อ เช่น "20" หรือข้อย่อย "20.1" */
  label: string;
  mode: PdfQuestionMode;
  correctIndex: number;
  correctText: string;
  explanationText: string;
  explanationImageUrl: string;
}

export function defaultPdfAnswerKeyEntry(label: string): PdfAnswerKeyEntry {
  return {
    label,
    mode: 'choice',
    correctIndex: -1,
    correctText: '',
    explanationText: '',
    explanationImageUrl: '',
  };
}

export function isPdfSubQuestionLabel(label: string): boolean {
  return /^\d+\.\d+$/.test(label.trim());
}

export function getPdfParentLabel(label: string): string {
  const trimmed = label.trim();
  const dot = trimmed.indexOf('.');
  return dot === -1 ? trimmed : trimmed.slice(0, dot);
}

export function hasPdfSubQuestions(entries: PdfAnswerKeyEntry[], index: number): boolean {
  const entry = entries[index];
  if (!entry || isPdfSubQuestionLabel(entry.label)) return false;
  const parentLabel = entry.label.trim();
  return entries.some(
    (other) => isPdfSubQuestionLabel(other.label) && getPdfParentLabel(other.label) === parentLabel,
  );
}

export function inferPdfMainQuestionCount(entries: PdfAnswerKeyEntry[]): number {
  let maxMain = countPdfMainQuestions(entries);
  for (const entry of entries) {
    const parent = getPdfParentLabel(entry.label);
    const n = Number(parent);
    if (Number.isFinite(n) && n > 0) maxMain = Math.max(maxMain, n);
  }
  return maxMain;
}

export function countPdfMainQuestions(entries: PdfAnswerKeyEntry[]): number {
  return entries.filter((entry) => !entry.label.includes('.')).length;
}

export function rebuildPdfEntriesForMainCount(
  prev: PdfAnswerKeyEntry[],
  mainCount: number,
): PdfAnswerKeyEntry[] {
  const subsByParent = new Map<string, PdfAnswerKeyEntry[]>();
  for (const entry of prev) {
    if (!entry.label.includes('.')) continue;
    const parent = getPdfParentLabel(entry.label);
    const list = subsByParent.get(parent) ?? [];
    list.push(entry);
    subsByParent.set(parent, list);
  }
  for (const [parent, subs] of subsByParent) {
    subs.sort((a, b) => {
      const aSub = Number(a.label.slice(parent.length + 1));
      const bSub = Number(b.label.slice(parent.length + 1));
      return aSub - bSub;
    });
  }

  const result: PdfAnswerKeyEntry[] = [];
  for (let i = 1; i <= mainCount; i += 1) {
    const label = String(i);
    const existingMain = prev.find((entry) => entry.label === label);
    result.push(existingMain ?? defaultPdfAnswerKeyEntry(label));
    result.push(...(subsByParent.get(label) ?? []));
  }
  return result;
}

export function insertPdfSubQuestion(
  entries: PdfAnswerKeyEntry[],
  anchorIndex: number,
): PdfAnswerKeyEntry[] {
  const anchor = entries[anchorIndex];
  if (!anchor) return entries;

  const parentLabel = getPdfParentLabel(anchor.label);
  let maxSub = 0;
  for (const entry of entries) {
    if (!entry.label.startsWith(`${parentLabel}.`)) continue;
    const rest = entry.label.slice(parentLabel.length + 1);
    if (/^\d+$/.test(rest)) maxSub = Math.max(maxSub, Number(rest));
  }

  const newEntry = defaultPdfAnswerKeyEntry(`${parentLabel}.${maxSub + 1}`);
  let insertAt = anchorIndex + 1;
  for (let i = anchorIndex + 1; i < entries.length; i += 1) {
    if (getPdfParentLabel(entries[i].label) === parentLabel) insertAt = i + 1;
    else break;
  }

  const next = [...entries];
  next.splice(insertAt, 0, newEntry);
  return next;
}

export function removePdfSubQuestion(
  entries: PdfAnswerKeyEntry[],
  index: number,
): PdfAnswerKeyEntry[] {
  const entry = entries[index];
  if (!entry || !entry.label.includes('.')) return entries;
  return entries.filter((_, i) => i !== index);
}

export function parsePdfLabelFromQuestionText(text: string, fallbackIndex: number): string {
  const attrMatch = text.match(/data-pdf-label="([^"]+)"/);
  if (attrMatch?.[1]) return attrMatch[1];
  const legacyMatch = text.match(/ข้อที่\s+([\d.]+)/);
  if (legacyMatch?.[1]) return legacyMatch[1];
  return String(fallbackIndex + 1);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

export function buildPdfQuestionText(label: string, explanationText?: string): string {
  const safeLabel = label.trim() || '1';
  const head = `<p data-pdf-label="${escapeHtml(safeLabel)}">ข้อที่ ${escapeHtml(safeLabel)}</p>`;
  const text = explanationText?.trim();
  if (!text) return head;
  return `${head}<div data-pdf-explanation="1"><p>${escapeHtml(text)}</p></div>`;
}

export function parsePdfExplanationFromQuestion(q: Question): {
  explanationText: string;
  explanationImageUrl: string;
} {
  const explanationImageUrl = q.images?.[0] ?? '';
  const match = q.questionText.match(/<div data-pdf-explanation="1">([\s\S]*?)<\/div>/);
  if (!match) {
    return { explanationText: '', explanationImageUrl };
  }
  return { explanationText: stripHtml(match[1]), explanationImageUrl };
}

export function buildPdfOptionChoices(optionCount: PdfOptionCount): MultipleChoiceOption[] {
  return Array.from({ length: optionCount }, (_, i) => ({
    id: PDF_OPTION_IDS[i],
    text: PDF_OPTION_LABELS[i],
    isCorrect: false,
  }));
}

function buildPdfYesNoChoices(): MultipleChoiceOption[] {
  return PDF_YESNO_LABELS.map((text, i) => ({
    id: PDF_OPTION_IDS[i],
    text,
    isCorrect: false,
  }));
}

function isPdfYesNoOptions(options: MultipleChoiceOption[]): boolean {
  if (options.length !== 2) return false;
  return options[0]?.text?.trim() === PDF_YESNO_LABELS[0]
    && options[1]?.text?.trim() === PDF_YESNO_LABELS[1];
}

export function buildPdfExamQuestions(
  optionCount: PdfOptionCount,
  entries: PdfAnswerKeyEntry[],
  meta: {
    curriculumYear: string;
    subjectGroup?: NewQuestion['subjectGroup'];
    department?: string;
    gradeLevel?: string;
    createdBy: string;
    createdByName?: string;
  },
): NewQuestion[] {
  const difficulty: QuestionDifficulty = 'medium';
  let orderIndex = 0;
  const result: NewQuestion[] = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (hasPdfSubQuestions(entries, index)) continue;

    const base = {
      curriculumYear: meta.curriculumYear,
      subjectGroup: meta.subjectGroup,
      department: meta.department,
      gradeLevel: meta.gradeLevel,
      difficulty,
      questionText: buildPdfQuestionText(entry.label, entry.explanationText),
      images: entry.explanationImageUrl.trim() ? [entry.explanationImageUrl.trim()] : [],
      orderIndex,
      createdBy: meta.createdBy,
      createdByName: meta.createdByName,
    };

    if (entry.mode === 'yesno') {
      const correctIdx = Math.min(1, Math.max(0, entry.correctIndex));
      const options = buildPdfYesNoChoices().map((opt, oi) => ({
        ...opt,
        isCorrect: oi === correctIdx,
      }));
      result.push({ ...base, type: 'multiple_choice' as const, payload: { options } });
    } else if (entry.mode === 'text') {
      result.push({
        ...base,
        type: 'essay' as const,
        payload: {
          rubric: '',
          maxScore: 1,
          expectedAnswer: entry.correctText.trim(),
        },
      });
    } else {
      const correctIdx = entry.correctIndex;
      const options = buildPdfOptionChoices(optionCount).map((opt, oi) => ({
        ...opt,
        isCorrect: oi === correctIdx,
      }));
      result.push({ ...base, type: 'multiple_choice' as const, payload: { options } });
    }

    orderIndex += 1;
  }

  return result;
}

function inferPdfOptionCount(length: number): PdfOptionCount {
  if (length >= 6) return 6;
  if (length === 5) return 5;
  return 4;
}

export function parsePdfAnswerKeyFromQuestions(questions: Question[]): {
  questionCount: number;
  optionCount: PdfOptionCount;
  entries: PdfAnswerKeyEntry[];
} {
  const sorted = [...questions].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  const firstMc = sorted.find((q) => q.type === 'multiple_choice');
  const firstOptions =
    firstMc?.type === 'multiple_choice'
      ? (firstMc.payload as { options?: MultipleChoiceOption[] }).options ?? []
      : [];
  let optionCount: PdfOptionCount = 4;
  if (firstOptions.length > 0 && !isPdfYesNoOptions(firstOptions)) {
    optionCount = inferPdfOptionCount(firstOptions.length);
  }

  const entries: PdfAnswerKeyEntry[] = sorted.map((q, index) => {
    const label = parsePdfLabelFromQuestionText(q.questionText ?? '', index + 1);
    const { explanationText, explanationImageUrl } = parsePdfExplanationFromQuestion(q);
    if (q.type === 'essay') {
      const payload = q.payload as { expectedAnswer?: string };
      return {
        label,
        mode: 'text' as const,
        correctIndex: 0,
        correctText: typeof payload.expectedAnswer === 'string' ? payload.expectedAnswer : '',
        explanationText,
        explanationImageUrl,
      };
    }
    const opts = (q.payload as { options?: MultipleChoiceOption[] }).options ?? [];
    const idx = opts.findIndex((o) => o.isCorrect);
    if (isPdfYesNoOptions(opts)) {
      return {
        label,
        mode: 'yesno' as const,
        correctIndex: idx >= 0 ? idx : 0,
        correctText: '',
        explanationText,
        explanationImageUrl,
      };
    }
    return {
      label,
      mode: 'choice' as const,
      correctIndex: idx >= 0 ? idx : -1,
      correctText: '',
      explanationText,
      explanationImageUrl,
    };
  });

  const mainCount = inferPdfMainQuestionCount(entries);
  const normalizedEntries = rebuildPdfEntriesForMainCount(entries, mainCount);

  return {
    questionCount: mainCount,
    optionCount,
    entries: normalizedEntries,
  };
}

export function formatPdfCorrectLabel(optionCount: PdfOptionCount, entry: PdfAnswerKeyEntry): string {
  if (entry.mode === 'text') {
    return entry.correctText.trim() || '(ข้อความ)';
  }
  if (entry.mode === 'yesno') {
    if (entry.correctIndex < 0 || entry.correctIndex > 1) return '-';
    return PDF_YESNO_LABELS[entry.correctIndex];
  }
  if (entry.correctIndex < 0 || entry.correctIndex >= optionCount) return '-';
  return PDF_OPTION_LABELS[entry.correctIndex];
}

export function hasPdfExplanation(entry: PdfAnswerKeyEntry): boolean {
  return entry.explanationText.trim().length > 0 || entry.explanationImageUrl.trim().length > 0;
}
