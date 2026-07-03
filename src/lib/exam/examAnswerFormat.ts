export type ParsedExamAnswer = {
  text: string;
  imageUrl?: string;
};

export function parseExamAnswerValue(raw: string | undefined | null): ParsedExamAnswer {
  if (!raw?.trim()) return { text: '' };

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      if ('text' in record || 'imageUrl' in record) {
        return {
          text: typeof record.text === 'string' ? record.text : '',
          imageUrl: typeof record.imageUrl === 'string' && record.imageUrl.trim()
            ? record.imageUrl.trim()
            : undefined,
        };
      }
    }
  } catch {
    // plain text answer
  }

  return { text: raw };
}

export function getExamAnswerText(raw: string | undefined | null): string {
  return parseExamAnswerValue(raw).text;
}

export function serializeExamAnswer(text: string, imageUrl?: string): string {
  const trimmedText = text.trim();
  if (imageUrl?.trim()) {
    return JSON.stringify({ text: trimmedText, imageUrl: imageUrl.trim() });
  }
  return trimmedText;
}

export function isExamAnswerFilled(
  raw: string | undefined | null,
  isEssay = false,
): boolean {
  if (!raw?.trim()) return false;
  if (!isEssay) return true;

  const { text, imageUrl } = parseExamAnswerValue(raw);
  return text.trim().length > 0 || Boolean(imageUrl);
}

export function isHtmlContent(value: string): boolean {
  return /<(?:p|div|img|br|span|ul|ol|li|table|h[1-6])\b/i.test(value);
}

/** แปลงคำตอบ (plain / JSON essay / HTML ตัวเลือก) เป็น HTML สำหรับแสดงผล */
export function formatExamAnswerDisplayHtml(raw: string | undefined | null): string {
  if (!raw?.trim()) return '';

  const trimmed = raw.trim();
  if (isHtmlContent(trimmed)) return trimmed;

  const { text, imageUrl } = parseExamAnswerValue(raw);
  const parts: string[] = [];

  if (text.trim()) {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br />');
    parts.push(`<p>${escaped}</p>`);
  }

  if (imageUrl) {
    parts.push(
      `<div class="my-1 flex justify-center"><img src="${imageUrl}" alt="คำตอบ" class="max-w-full max-h-28 rounded-lg border border-slate-200 object-contain" /></div>`,
    );
  }

  return parts.join('');
}
