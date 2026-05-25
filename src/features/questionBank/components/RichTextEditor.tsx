import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, List, Sigma, Image as ImageIcon, Loader2, Superscript, Subscript } from 'lucide-react';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

interface Props {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: number;
  compact?: boolean;
  maxImageHeight?: number;
}

/**
 * Lightweight Rich Text Editor (contentEditable)
 * — รองรับ Bold/Italic/Underline/List + แทรกสมการ inline (LaTeX-style placeholder)
 * — ไม่ต้องพึ่ง library ใหญ่ ๆ เช่น TipTap (จะเพิ่มภายหลังได้)
 */
export default function RichTextEditor({
  value, onChange, disabled, placeholder = 'พิมพ์โจทย์ที่นี่...', minHeight = 140, compact = false, maxImageHeight,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastValueRef = useRef(value);
  const [isUploading, setIsUploading] = useState(false);

  // Sync external value -> DOM
  // Important: when editor mounts in edit mode, ref.innerHTML is still empty
  // even if `value` already has content, so we must hydrate DOM from `value`.
  useEffect(() => {
    if (!ref.current) return;
    const nextHtml = value || '';
    if (ref.current.innerHTML !== nextHtml) {
      ref.current.innerHTML = nextHtml;
    }
    lastValueRef.current = nextHtml;
  }, [value]);

  const exec = (cmd: string, arg?: string) => {
    if (disabled) return;
    document.execCommand(cmd, false, arg);
    handleInput();
  };

  const insertEquation = () => {
    if (disabled) return;
    const eq = window.prompt('ใส่สมการ (LaTeX) เช่น  v = u + at  หรือ  E = mc^2');
    if (!eq) return;
    document.execCommand('insertHTML', false,
      `<span class="px-1.5 py-0.5 mx-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-[12px]">$${eq}$</span>&nbsp;`
    );
    handleInput();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || disabled) return;

    try {
      setIsUploading(true);
      const filename = `${Date.now()}_${file.name}`;
      const storageRef = sRef(storage, `questions/images/${filename}`);
      
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);

      if (ref.current) {
        ref.current.focus();
        const imgHeight = maxImageHeight ?? (compact ? 120 : 300);
        document.execCommand('insertHTML', false, 
          `<div class="my-1 flex justify-center">
            <img src="${url}" alt="uploaded image" class="max-w-full rounded-xl border border-slate-100 shadow-sm" style="max-height: ${imgHeight}px;" />
          </div><p>&nbsp;</p>`
        );
        handleInput();
      }
    } catch (error) {
      console.error('Image upload failed:', error);
      alert('อัพโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleInput = () => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    lastValueRef.current = html;
    onChange(html);
  };

  return (
    <div
      className={`overflow-hidden transition-all ${compact ? 'rounded-2xl' : 'rounded-3xl'}`}
      style={{
        background: 'rgba(255,255,255,0.6)',
        border: '1px solid #cbd5e1',
      }}
    >
      {/* Toolbar */}
      <div className={`flex items-center gap-1 border-b border-white/40 bg-white/30 ${compact ? 'px-2 py-1' : 'px-3 py-2'}`}>
        <ToolBtn onClick={() => exec('bold')}        disabled={disabled} icon={<Bold size={compact ? 11 : 13} />}      title="Bold" />
        <ToolBtn onClick={() => exec('italic')}      disabled={disabled} icon={<Italic size={compact ? 11 : 13} />}    title="Italic" />
        <ToolBtn onClick={() => exec('underline')}   disabled={disabled} icon={<Underline size={compact ? 11 : 13} />} title="Underline" />
        <div className="w-px h-4 bg-slate-300/60 mx-1" />
        <ToolBtn onClick={() => exec('superscript')} disabled={disabled} icon={<Superscript size={compact ? 11 : 13} />} title="ตัวยก" />
        <ToolBtn onClick={() => exec('subscript')}   disabled={disabled} icon={<Subscript size={compact ? 11 : 13} />} title="ตัวห้อย" />
        <div className="w-px h-4 bg-slate-300/60 mx-1" />
        {!compact && (
          <>
            <ToolBtn onClick={() => exec('insertUnorderedList')} disabled={disabled} icon={<List size={13} />} title="Bullet list" />
            <div className="w-px h-4 bg-slate-300/60 mx-1" />
          </>
        )}
        <ToolBtn onClick={insertEquation} disabled={disabled} icon={<Sigma size={compact ? 11 : 13} />} title="แทรกสมการ" />
        <ToolBtn 
          onClick={() => fileInputRef.current?.click()} 
          disabled={disabled || isUploading} 
          icon={isUploading ? <Loader2 size={compact ? 11 : 13} className="animate-spin" /> : <ImageIcon size={compact ? 11 : 13} />} 
          title="แทรกรูปภาพในตัวเลือก" 
        />
        <input 
          ref={fileInputRef}
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleImageUpload}
        />
      </div>

      {/* Editable area */}
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        className={`px-4 font-sarabun text-slate-700 outline-none ${compact ? 'py-2 text-[12px]' : 'py-3 text-[13px]'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        style={{ minHeight: compact ? 36 : minHeight }}
        data-placeholder={placeholder}
      />

      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}

function ToolBtn({
  onClick, icon, title, disabled,
}: { onClick: () => void; icon: React.ReactNode; title: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-white/70 hover:text-slate-900 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {icon}
    </button>
  );
}
