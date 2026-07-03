import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { useImageLongPressPreview } from '@/features/questionBank/hooks/useImageLongPressPreview';

interface Props {
  html: string;
  variant?: 'question' | 'option';
  className?: string;
  onImagePreview?: (url: string) => void;
}

/** Read-only HTML — ให้ตรงกับ RichTextEditor (ขนาดฟอนต์ / พื้นหลัง / ระยะบรรทัด) */
export default function ExamQuestionContent({
  html,
  variant = 'question',
  className,
  onImagePreview,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  useImageLongPressPreview(containerRef, onImagePreview, Boolean(onImagePreview));

  return (
    <div
      ref={containerRef}
      className={cn(
        'exam-question-content font-sarabun text-slate-800 leading-relaxed',
        variant === 'question'
          ? 'rounded-xl bg-white px-4 py-4 text-[14px] shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]'
          : 'min-w-0 flex-1 bg-white py-2 px-4 text-[12px]',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
