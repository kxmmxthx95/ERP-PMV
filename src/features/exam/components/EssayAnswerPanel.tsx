import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ImageZoomModal from '@/features/exam/components/ImageZoomModal';
import {
  parseExamAnswerValue,
  serializeExamAnswer,
} from '@/lib/exam/examAnswerFormat';
import { uploadExamAnswerImage } from '@/features/exam/utils/uploadExamAnswerImage';

interface Props {
  questionId: string;
  value?: string;
  readOnly?: boolean;
  roomId: string;
  attemptId: string;
  onSave: (questionId: string, value: string) => void;
  onCameraSessionChange?: (active: boolean) => void;
  className?: string;
}

export default function EssayAnswerPanel({
  questionId,
  value,
  readOnly = false,
  roomId,
  attemptId,
  onSave,
  onCameraSessionChange,
  className,
}: Props) {
  const parsed = parseExamAnswerValue(value);
  const [text, setText] = useState(parsed.text);
  const [imageUrl, setImageUrl] = useState(parsed.imageUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const next = parseExamAnswerValue(value);
    setText(next.text);
    setImageUrl(next.imageUrl);
  }, [questionId, value]);

  const persist = useCallback((nextText: string, nextImageUrl?: string) => {
    onSave(questionId, serializeExamAnswer(nextText, nextImageUrl));
  }, [onSave, questionId]);

  const scheduleTextSave = useCallback((nextText: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persist(nextText, imageUrl);
    }, 450);
  }, [imageUrl, persist]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const endCameraSession = useCallback(() => {
    setTimeout(() => onCameraSessionChange?.(false), 1200);
  }, [onCameraSessionChange]);

  const openCamera = () => {
    if (readOnly || uploading) return;
    setUploadError(null);
    onCameraSessionChange?.(true);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      endCameraSession();
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      const url = await uploadExamAnswerImage(roomId, attemptId, questionId, file);
      setImageUrl(url);
      persist(text, url);
    } catch {
      setUploadError('อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setUploading(false);
      endCameraSession();
    }
  };

  const removeImage = () => {
    if (readOnly || uploading) return;
    setImageUrl(undefined);
    persist(text);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <textarea
        value={text}
        onChange={(event) => {
          const nextText = event.target.value;
          setText(nextText);
          scheduleTextSave(nextText);
        }}
        onBlur={() => persist(text, imageUrl)}
        disabled={readOnly}
        placeholder="พิมพ์คำตอบของคุณที่นี่..."
        rows={6}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-sarabun text-slate-800 leading-relaxed outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500 resize-y min-h-[140px]"
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openCamera}
          disabled={readOnly || uploading}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-bold font-sukhumvit text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
          {uploading ? 'กำลังอัปโหลด...' : 'ถ่ายรูปคำตอบ'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {uploadError && (
        <p className="text-[12px] font-bold text-rose-600 font-sarabun">{uploadError}</p>
      )}

      {imageUrl && (
        <div className="relative inline-block max-w-full">
          <img
            src={imageUrl}
            alt="รูปคำตอบ"
            onClick={() => setZoomImageUrl(imageUrl || null)}
            className="max-h-56 w-auto max-w-full rounded-xl border border-slate-200 bg-white object-contain cursor-pointer hover:opacity-90 transition-opacity"
          />
          {!readOnly && (
            <button
              type="button"
              onClick={removeImage}
              disabled={uploading}
              className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-sm transition-colors hover:bg-rose-50 hover:text-rose-600"
              aria-label="ลบรูป"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
      <ImageZoomModal src={zoomImageUrl} onClose={() => setZoomImageUrl(null)} />
    </div>
  );
}
