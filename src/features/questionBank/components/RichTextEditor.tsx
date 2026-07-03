import { useEffect, useRef, useState, useCallback } from 'react';
import { Bold, Italic, Underline, List, Sigma, Image as ImageIcon, Loader2, Superscript, Subscript, Strikethrough, AlignLeft, AlignCenter, AlignRight, AlignJustify, Omega } from 'lucide-react';
import { ref as sRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { safeStorageFilename, imageUploadContentType } from '@/lib/safeStorageFilename';

import { cn } from '@/lib/utils';
import SpecialCharactersDialog from './SpecialCharactersDialog';
import { buildFractionTemplateHtml, isInsideSuperscript, type FractionMode } from './fractionHtml';

function focusFractionSlot(slot: HTMLElement) {
  slot.focus();
  const range = document.createRange();
  range.selectNodeContents(slot);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function FractionIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <line x1="5" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <text x="9" y="5.2" textAnchor="middle" fontSize="4.5" fill="currentColor" fontFamily="serif">a</text>
      <text x="9" y="12.8" textAnchor="middle" fontSize="4.5" fill="currentColor" fontFamily="serif">b</text>
    </svg>
  );
}

function MixedFractionIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <text x="3.5" y="10" textAnchor="middle" fontSize="6" fill="currentColor" fontFamily="serif" fontWeight="700">2</text>
      <line x1="7" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <text x="10" y="5.2" textAnchor="middle" fontSize="4" fill="currentColor" fontFamily="serif">a</text>
      <text x="10" y="12.8" textAnchor="middle" fontSize="4" fill="currentColor" fontFamily="serif">b</text>
    </svg>
  );
}

function NestedFractionIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <line x1="4" y1="5.5" x2="12" y2="5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="4" y1="10.5" x2="12" y2="10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <text x="8" y="4.3" textAnchor="middle" fontSize="3.5" fill="currentColor" fontFamily="serif">a</text>
      <text x="8" y="7.2" textAnchor="middle" fontSize="3.5" fill="currentColor" fontFamily="serif">b</text>
      <text x="8" y="9.8" textAnchor="middle" fontSize="3.5" fill="currentColor" fontFamily="serif">c</text>
      <text x="8" y="12.7" textAnchor="middle" fontSize="3.5" fill="currentColor" fontFamily="serif">d</text>
    </svg>
  );
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight?: number;
  compact?: boolean;
  maxImageHeight?: number;
}

const FONT_SIZE_OPTIONS = [
  { label: '12', value: '12px' },
  { label: '14', value: '14px' },
  { label: '16', value: '16px' },
  { label: '18', value: '18px' },
  { label: '20', value: '20px' },
  { label: '24', value: '24px' },
  { label: '28', value: '28px' },
  { label: '32', value: '32px' },
] as const;

const DEFAULT_FONT_SIZE = '14px';
const COMPACT_DEFAULT_FONT_SIZE = '12px';
const DEFAULT_LINE_HEIGHT = '1.625';

const LINE_HEIGHT_OPTIONS = [
  { label: '1.0', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '1.6', value: '1.625' },
  { label: '1.75', value: '1.75' },
  { label: '2.0', value: '2' },
  { label: '2.5', value: '2.5' },
  { label: '3.0', value: '3' },
] as const;

const BLOCK_TAGS = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);

type FormatState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  superscript: boolean;
  subscript: boolean;
  unorderedList: boolean;
  alignLeft: boolean;
  alignCenter: boolean;
  alignRight: boolean;
  alignFull: boolean;
};

const DEFAULT_FORMAT_STATE: FormatState = {
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  superscript: false,
  subscript: false,
  unorderedList: false,
  alignLeft: true,
  alignCenter: false,
  alignRight: false,
  alignFull: false,
};

function readFormatState(): FormatState {
  try {
    const alignCenter = document.queryCommandState('justifyCenter');
    const alignRight = document.queryCommandState('justifyRight');
    const alignFull = document.queryCommandState('justifyFull');
    const alignLeft = document.queryCommandState('justifyLeft');

    return {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strikeThrough: document.queryCommandState('strikeThrough'),
      superscript: document.queryCommandState('superscript'),
      subscript: document.queryCommandState('subscript'),
      unorderedList: document.queryCommandState('insertUnorderedList'),
      alignLeft: alignLeft || (!alignCenter && !alignRight && !alignFull),
      alignCenter,
      alignRight,
      alignFull,
    };
  } catch {
    return DEFAULT_FORMAT_STATE;
  }
}

const PASTE_ALLOWED_TAGS = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'DEL', 'SUB', 'SUP',
  'UL', 'OL', 'LI', 'P', 'BR', 'DIV', 'SPAN',
]);

/** ลบ font/color/class จาก Word, Google Docs ฯลฯ — ให้ใช้ฟอนต์ของ editor */
function sanitizePastedHtml(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;

  container.querySelectorAll('style, meta, link, script, title, xml').forEach((node) => node.remove());

  const stripTypography = (el: HTMLElement) => {
    el.removeAttribute('class');
    el.removeAttribute('face');
    el.removeAttribute('size');
    el.removeAttribute('color');
    el.removeAttribute('bgcolor');
    el.removeAttribute('lang');
    el.removeAttribute('dir');

    if (!el.getAttribute('style')) return;

    const kept = el
      .getAttribute('style')!
      .split(';')
      .map((rule) => rule.trim())
      .filter((rule) => {
        if (!rule) return false;
        const key = rule.split(':')[0]?.trim().toLowerCase() ?? '';
        return !key.startsWith('font')
          && !key.startsWith('mso-')
          && key !== 'color'
          && key !== 'background'
          && key !== 'background-color'
          && key !== 'line-height'
          && key !== 'letter-spacing'
          && key !== 'text-indent'
          && key !== 'margin'
          && key !== 'margin-top'
          && key !== 'margin-bottom'
          && key !== 'margin-left'
          && key !== 'margin-right'
          && key !== 'padding'
          && key !== 'text-align'
          && key !== 'vertical-align';
      });

    if (kept.length > 0) el.setAttribute('style', kept.join('; '));
    else el.removeAttribute('style');
  };

  const unwrapElement = (el: Element) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  };

  const nodes = Array.from(container.querySelectorAll('*'));
  for (const el of nodes) {
    if (!(el instanceof HTMLElement)) continue;

    const tag = el.tagName;
    if (tag === 'IMG') {
      el.remove();
      continue;
    }

    stripTypography(el);

    if (!PASTE_ALLOWED_TAGS.has(tag)) {
      if (/^H[1-6]$/.test(tag)) {
        const p = document.createElement('p');
        p.innerHTML = el.innerHTML;
        el.replaceWith(p);
        stripTypography(p);
        continue;
      }
      unwrapElement(el);
    }
  }

  container.querySelectorAll('span').forEach((span) => {
    if (span.attributes.length === 0) unwrapElement(span);
  });

  container.querySelectorAll('div, p').forEach((block) => {
    if (block instanceof HTMLElement) stripTypography(block);
  });

  return container.innerHTML.replace(/<!--[\s\S]*?-->/g, '').trim();
}

function normalizeFontSize(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const match = FONT_SIZE_OPTIONS.find((opt) => opt.value === raw);
  if (match) return match.value;
  const px = Number.parseInt(raw, 10);
  if (Number.isNaN(px)) return fallback;
  const nearest = FONT_SIZE_OPTIONS.reduce((best, opt) => {
    const bestPx = Number.parseInt(best.value, 10);
    const optPx = Number.parseInt(opt.value, 10);
    return Math.abs(optPx - px) < Math.abs(bestPx - px) ? opt : best;
  });
  return nearest.value;
}

function normalizeLineHeight(raw: string | undefined, fallback: string, fontSizePx?: number): string {
  if (!raw) return fallback;

  let num = Number.parseFloat(raw);
  if (raw.endsWith('px') && fontSizePx && fontSizePx > 0) {
    num = Number.parseFloat(raw) / fontSizePx;
  }
  if (Number.isNaN(num)) return fallback;

  const nearest = LINE_HEIGHT_OPTIONS.reduce((best, opt) => {
    const bestVal = Number.parseFloat(best.value);
    const optVal = Number.parseFloat(opt.value);
    return Math.abs(optVal - num) < Math.abs(bestVal - num) ? opt : best;
  });
  return nearest.value;
}

function findBlockElement(node: Node | null, root: HTMLElement): HTMLElement | null {
  let el: Node | null = node;
  while (el && el !== root) {
    if (el instanceof HTMLElement && BLOCK_TAGS.has(el.tagName)) return el;
    el = el.parentNode;
  }
  return null;
}

function collectBlocksInRange(range: Range, root: HTMLElement): HTMLElement[] {
  const blocks = new Set<HTMLElement>();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (!(node instanceof HTMLElement) || !BLOCK_TAGS.has(node.tagName)) {
        return NodeFilter.FILTER_SKIP;
      }
      try {
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      } catch {
        return NodeFilter.FILTER_SKIP;
      }
    },
  });

  let current = walker.nextNode();
  while (current) {
    blocks.add(current as HTMLElement);
    current = walker.nextNode();
  }

  if (blocks.size === 0) {
    const block = findBlockElement(range.startContainer, root);
    if (block) blocks.add(block);
  }

  return [...blocks];
}

function FontSizeSelect({
  value,
  onChange,
  onSaveSelection,
  disabled,
  compact,
}: {
  value: string;
  onChange: (size: string) => void;
  onSaveSelection: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onPointerDown={() => onSaveSelection()}
      onChange={(e) => onChange(e.target.value)}
      title="ขนาดตัวอักษร"
      aria-label="ขนาดตัวอักษร"
      className={cn(
        'cursor-pointer rounded-lg border border-slate-200 bg-white font-sukhumvit font-black text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-200/60 disabled:cursor-not-allowed disabled:opacity-40',
        compact ? 'h-7 min-w-[3rem] px-1 text-[10px]' : 'h-8 min-w-[3.5rem] px-1.5 text-[11px]',
      )}
    >
      {FONT_SIZE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function LineHeightSelect({
  value,
  onChange,
  onSaveSelection,
  disabled,
  compact,
}: {
  value: string;
  onChange: (lineHeight: string) => void;
  onSaveSelection: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onPointerDown={() => onSaveSelection()}
      onChange={(e) => onChange(e.target.value)}
      title="ระยะห่างบรรทัด"
      aria-label="ระยะห่างบรรทัด"
      className={cn(
        'cursor-pointer rounded-lg border border-slate-200 bg-white font-sukhumvit font-black text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-200/60 disabled:cursor-not-allowed disabled:opacity-40',
        compact ? 'h-7 min-w-[3.25rem] px-1 text-[10px]' : 'h-8 min-w-[3.75rem] px-1.5 text-[11px]',
      )}
    >
      {LINE_HEIGHT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/**
 * WYSIWYG editor (contentEditable) — รู้สึกคล้ายพิมพ์ใน Word
 * รองรับ ตัวหนา/เอียง/ขีดเส้น/ขีดฆ่า/ตัวยก/ตัวห้อย/รายการ/สมการ/แนบรูป (อัปโหลดหรือวางจากคลิปบอร์ด)
 */
export default function RichTextEditor({
  value, onChange, disabled, placeholder = 'พิมพ์โจทย์ที่นี่...', minHeight = 140, compact = false, maxImageHeight,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastValueRef = useRef(value);
  const savedRangeRef = useRef<Range | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const defaultFontSize = compact ? COMPACT_DEFAULT_FONT_SIZE : DEFAULT_FONT_SIZE;
  const [fontSize, setFontSize] = useState(defaultFontSize);
  const [lineHeight, setLineHeight] = useState(DEFAULT_LINE_HEIGHT);
  const [format, setFormat] = useState<FormatState>(DEFAULT_FORMAT_STATE);
  const [specialCharsOpen, setSpecialCharsOpen] = useState(false);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !ref.current) return false;
    if (!savedRangeRef.current) {
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      savedRangeRef.current = range;
    }
    ref.current.focus();
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
    return true;
  }, []);

  const handleInput = useCallback(() => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    lastValueRef.current = html;
    onChange(html);
  }, [onChange]);

  const detectFontSize = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) return;

    let node: Node | null = sel.anchorNode;
    while (node && node !== ref.current) {
      if (node instanceof HTMLElement) {
        const inlineSize = node.style.fontSize;
        if (inlineSize) {
          setFontSize(normalizeFontSize(inlineSize, defaultFontSize));
          return;
        }
        const computed = window.getComputedStyle(node).fontSize;
        if (computed) {
          setFontSize(normalizeFontSize(computed, defaultFontSize));
          return;
        }
      }
      node = node.parentNode;
    }
    setFontSize(defaultFontSize);
  }, [defaultFontSize]);

  const applyFontSize = useCallback((sizePx: string) => {
    if (disabled || !ref.current) return;
    setFontSize(sizePx);
    restoreSelection();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !ref.current.contains(selection.anchorNode)) return;

    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      const span = document.createElement('span');
      span.style.fontSize = sizePx;
      span.appendChild(document.createTextNode('\u200B'));
      range.insertNode(span);
      const textNode = span.firstChild;
      if (textNode) {
        range.setStart(textNode, 1);
        range.collapse(true);
      }
    } else {
      const span = document.createElement('span');
      span.style.fontSize = sizePx;
      try {
        range.surroundContents(span);
      } catch {
        const fragment = range.extractContents();
        span.appendChild(fragment);
        range.insertNode(span);
      }
      range.selectNodeContents(span);
      range.collapse(false);
    }

    selection.removeAllRanges();
    selection.addRange(range);
    savedRangeRef.current = range.cloneRange();
    ref.current.focus();
    handleInput();
  }, [disabled, handleInput, restoreSelection]);

  const detectLineHeight = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current) return;

    let node: Node | null = sel.anchorNode;
    while (node && node !== ref.current) {
      if (node instanceof HTMLElement) {
        const inlineHeight = node.style.lineHeight;
        if (inlineHeight) {
          setLineHeight(normalizeLineHeight(inlineHeight, DEFAULT_LINE_HEIGHT));
          return;
        }
      }
      node = node.parentNode;
    }

    const block = findBlockElement(sel.anchorNode, ref.current);
    if (block) {
      const computed = window.getComputedStyle(block);
      setLineHeight(normalizeLineHeight(
        computed.lineHeight,
        DEFAULT_LINE_HEIGHT,
        Number.parseFloat(computed.fontSize),
      ));
      return;
    }

    setLineHeight(DEFAULT_LINE_HEIGHT);
  }, []);

  const applyLineHeight = useCallback((nextLineHeight: string) => {
    if (disabled || !ref.current) return;
    setLineHeight(nextLineHeight);
    restoreSelection();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !ref.current.contains(selection.anchorNode)) return;

    const range = selection.getRangeAt(0);
    const blocks = collectBlocksInRange(range, ref.current);
    if (blocks.length === 0) {
      ref.current.style.lineHeight = nextLineHeight;
    } else {
      blocks.forEach((block) => {
        block.style.lineHeight = nextLineHeight;
      });
    }

    ref.current.focus();
    handleInput();
  }, [disabled, handleInput, restoreSelection]);

  const detectFormatState = useCallback(() => {
    if (!ref.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !ref.current.contains(sel.anchorNode)) {
      setFormat(DEFAULT_FORMAT_STATE);
      return;
    }
    setFormat(readFormatState());
  }, []);

  const syncSelectionState = useCallback(() => {
    saveSelection();
    detectFontSize();
    detectLineHeight();
    detectFormatState();
  }, [saveSelection, detectFontSize, detectLineHeight, detectFormatState]);

  const insertImageHtml = useCallback((url: string) => {
    if (!ref.current) return;
    restoreSelection();
    ref.current.focus();
    const imgHeight = maxImageHeight ?? (compact ? 120 : 300);
    document.execCommand(
      'insertHTML',
      false,
      `<div class="my-2 flex justify-center">
        <img src="${url}" alt="uploaded image" class="max-w-full rounded-xl border border-slate-200 shadow-sm" style="max-height: ${imgHeight}px;" />
      </div><p><br></p>`,
    );
  }, [compact, maxImageHeight, restoreSelection]);

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
    restoreSelection();
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    handleInput();
    detectFormatState();
  };

  const uploadImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    try {
      setIsUploading(true);
      const filename = safeStorageFilename(file.name);
      const storageRef = sRef(storage, `questions/images/${filename}`);
      const snapshot = await uploadBytes(storageRef, file, {
        contentType: imageUploadContentType(file),
      });
      const url = await getDownloadURL(snapshot.ref);
      insertImageHtml(url);
      handleInput();
    } catch (error) {
      console.error('Image upload failed:', error);
      const code = typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: string }).code)
        : '';
      alert(
        code === 'storage/unauthorized'
          ? 'ไม่มีสิทธิ์อัปโหลดรูป — กรุณา login ใหม่ หรือติดต่อผู้ดูแลระบบ'
          : 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const insertCharacter = useCallback((char: string) => {
    if (disabled) return;
    restoreSelection();
    ref.current?.focus();
    document.execCommand('insertText', false, char);
    handleInput();
  }, [disabled, handleInput, restoreSelection]);

  const insertFractionTemplate = useCallback((mode: FractionMode) => {
    if (disabled || !ref.current) return;
    restoreSelection();

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !ref.current.contains(selection.anchorNode)) return;

    const range = selection.getRangeAt(0);
    const inSup = isInsideSuperscript(selection.anchorNode, ref.current);
    const superscriptActive = document.queryCommandState('superscript');
    const useSuperscript = inSup || superscriptActive;

    const temp = document.createElement('div');
    temp.innerHTML = buildFractionTemplateHtml(mode, { superscript: useSuperscript });
    const wrapper = temp.firstElementChild as HTMLElement | null;
    if (!wrapper) return;

    let nodeToInsert: Node = wrapper;
    if (useSuperscript && !inSup) {
      const sup = document.createElement('sup');
      sup.className = 'rte-sup-fraction';
      sup.appendChild(wrapper);
      nodeToInsert = sup;
    } else if (useSuperscript && inSup) {
      const supEl = selection.anchorNode instanceof HTMLElement
        ? selection.anchorNode.closest('sup')
        : selection.anchorNode?.parentElement?.closest('sup');
      supEl?.classList.add('rte-sup-fraction');
    }

    const firstSlot = wrapper.querySelector('[data-rte-fraction-part]') as HTMLElement | null;
    range.deleteContents();
    range.insertNode(nodeToInsert);

    const space = document.createTextNode('\u00A0');
    range.setStartAfter(nodeToInsert);
    range.collapse(true);
    range.insertNode(space);

    if (superscriptActive) {
      document.execCommand('superscript', false);
    }

    selection.removeAllRanges();
    selection.addRange(range);
    savedRangeRef.current = range.cloneRange();

    if (firstSlot) focusFractionSlot(firstSlot);
    else ref.current.focus();

    handleInput();
    detectFormatState();
  }, [disabled, detectFormatState, handleInput, restoreSelection]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCaptureInput = () => handleInput();
    el.addEventListener('input', onCaptureInput, true);
    return () => el.removeEventListener('input', onCaptureInput, true);
  }, [handleInput]);

  const insertEquation = () => {
    if (disabled) return;
    const eq = window.prompt('ใส่สมการ (LaTeX) เช่น  v = u + at  หรือ  E = mc^2');
    if (!eq) return;
    restoreSelection();
    ref.current?.focus();
    document.execCommand('insertHTML', false,
      `<span class="px-1.5 py-0.5 mx-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono text-[12px]">$${eq}$</span>&nbsp;`
    );
    handleInput();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || disabled) return;
    await uploadImageFile(file);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const clipboard = e.clipboardData;
    if (!clipboard) return;

    for (const item of clipboard.items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await uploadImageFile(file);
        return;
      }
    }

    e.preventDefault();
    saveSelection();
    restoreSelection();
    ref.current?.focus();

    const html = clipboard.getData('text/html');
    const plain = clipboard.getData('text/plain');

    if (html.trim()) {
      const cleaned = sanitizePastedHtml(html);
      if (cleaned) {
        document.execCommand('insertHTML', false, cleaned);
        handleInput();
        return;
      }
    }

    if (plain) {
      document.execCommand('insertText', false, plain);
      handleInput();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (e.key === 'Tab') {
      const target = e.target as HTMLElement;
      const part = target.getAttribute('data-rte-fraction-part');
      if (part) {
        e.preventDefault();
        const wrap = target.closest('[data-rte-fraction]');
        if (!wrap) return;
        const slots = Array.from(wrap.querySelectorAll('[data-rte-fraction-part]')) as HTMLElement[];
        const idx = slots.indexOf(target);
        const next = e.shiftKey ? slots[idx - 1] : slots[idx + 1];
        if (next) focusFractionSlot(next);
        return;
      }
    }

    if (!e.ctrlKey && !e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === 'b') { e.preventDefault(); exec('bold'); }
    else if (key === 'i') { e.preventDefault(); exec('italic'); }
    else if (key === 'u') { e.preventDefault(); exec('underline'); }
  };

  return (
    <div
      className={`overflow-hidden transition-all ${compact ? 'rounded-2xl border border-slate-200' : 'rounded-2xl border border-slate-200 shadow-sm'}`}
      style={{
        background: compact ? 'white' : 'rgba(255,255,255,0.95)',
      }}
    >
      {/* Toolbar — แบบ Word */}
      <div className={`flex flex-wrap items-center gap-0.5 border-b border-slate-200/80 bg-slate-50/90 ${compact ? 'px-2 py-1' : 'px-3 py-2'}`}>
        <ToolBtn onClick={() => exec('bold')}        disabled={disabled} active={format.bold} icon={<Bold size={compact ? 11 : 13} />}      title="ตัวหนา (Ctrl+B)" />
        <ToolBtn onClick={() => exec('italic')}      disabled={disabled} active={format.italic} icon={<Italic size={compact ? 11 : 13} />}    title="ตัวเอียง (Ctrl+I)" />
        <ToolBtn onClick={() => exec('underline')}   disabled={disabled} active={format.underline} icon={<Underline size={compact ? 11 : 13} />} title="ขีดเส้นใต้ (Ctrl+U)" />
        {!compact && (
          <ToolBtn onClick={() => exec('strikeThrough')} disabled={disabled} active={format.strikeThrough} icon={<Strikethrough size={13} />} title="ขีดฆ่า" />
        )}
        <div className="mx-0.5 h-4 w-px bg-slate-300/70" />
        <FontSizeSelect
          value={fontSize}
          onChange={applyFontSize}
          onSaveSelection={saveSelection}
          disabled={disabled}
          compact={compact}
        />
        <LineHeightSelect
          value={lineHeight}
          onChange={applyLineHeight}
          onSaveSelection={saveSelection}
          disabled={disabled}
          compact={compact}
        />
        <div className="mx-0.5 h-4 w-px bg-slate-300/70" />
        <ToolBtn onClick={() => exec('superscript')} disabled={disabled} active={format.superscript} icon={<Superscript size={compact ? 11 : 13} />} title="ตัวยก (ใช้ร่วมกับเศษส่วนได้)" />
        <ToolBtn onClick={() => exec('subscript')}   disabled={disabled} active={format.subscript} icon={<Subscript size={compact ? 11 : 13} />} title="ตัวห้อย" />
        {!compact && (
          <>
            <div className="mx-0.5 h-4 w-px bg-slate-300/70" />
            <ToolBtn onClick={() => exec('insertUnorderedList')} disabled={disabled} active={format.unorderedList} icon={<List size={13} />} title="รายการ" />
          </>
        )}
        <div className="mx-0.5 h-4 w-px bg-slate-300/70" />
        <ToolBtn onClick={() => exec('justifyLeft')} disabled={disabled} active={format.alignLeft} icon={<AlignLeft size={compact ? 11 : 13} />} title="ชิดซ้าย" />
        <ToolBtn onClick={() => exec('justifyCenter')} disabled={disabled} active={format.alignCenter} icon={<AlignCenter size={compact ? 11 : 13} />} title="กึ่งกลาง" />
        <ToolBtn onClick={() => exec('justifyRight')} disabled={disabled} active={format.alignRight} icon={<AlignRight size={compact ? 11 : 13} />} title="ชิดขวา" />
        <ToolBtn onClick={() => exec('justifyFull')} disabled={disabled} active={format.alignFull} icon={<AlignJustify size={compact ? 11 : 13} />} title="เต็มบรรทัด" />
        <div className="mx-0.5 h-4 w-px bg-slate-300/70" />
        <ToolBtn onClick={insertEquation} disabled={disabled} icon={<Sigma size={compact ? 11 : 13} />} title="แทรกสมการ" />
        <ToolBtn
          onClick={() => insertFractionTemplate('simple')}
          disabled={disabled}
          icon={<FractionIcon size={compact ? 11 : 13} />}
          title="เศษส่วน"
        />
        <ToolBtn
          onClick={() => insertFractionTemplate('mixed')}
          disabled={disabled}
          icon={<MixedFractionIcon size={compact ? 11 : 13} />}
          title="เศษคละ"
        />
        <ToolBtn
          onClick={() => insertFractionTemplate('nested')}
          disabled={disabled}
          icon={<NestedFractionIcon size={compact ? 11 : 13} />}
          title="เศษซ้อน"
        />
        <ToolBtn
          onClick={() => {
            saveSelection();
            setSpecialCharsOpen(true);
          }}
          disabled={disabled}
          icon={<Omega size={compact ? 11 : 13} />}
          title="อักขระพิเศษ"
        />
        <ToolBtn 
          onClick={() => fileInputRef.current?.click()} 
          disabled={disabled || isUploading} 
          icon={isUploading ? <Loader2 size={compact ? 11 : 13} className="animate-spin" /> : <ImageIcon size={compact ? 11 : 13} />} 
          title="แนบรูปภาพ (หรือวาง Ctrl+V)" 
        />
        <input 
          ref={fileInputRef}
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleImageUpload}
        />
      </div>

      {/* พื้นที่พิมพ์ — พื้นหลังขาวคล้าย Word */}
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={syncSelectionState}
        onMouseUp={syncSelectionState}
        onKeyUp={syncSelectionState}
        onBlur={saveSelection}
        className={`px-4 font-sarabun text-slate-800 outline-none leading-relaxed ${
          compact
            ? 'bg-white py-2 text-[12px]'
            : 'bg-white py-4 text-[14px] shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] focus:ring-2 focus:ring-blue-200/60'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        style={{ minHeight: compact ? 36 : minHeight }}
        data-placeholder={placeholder}
      />

      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
        [contenteditable] ul {
          list-style: disc;
          padding-left: 1.25rem;
          margin: 0.25rem 0;
        }
        [contenteditable] img {
          max-width: 100%;
          height: auto;
        }
        [contenteditable] *:not(.font-mono) {
          font-family: inherit !important;
        }
      `}</style>

      <SpecialCharactersDialog
        open={specialCharsOpen}
        onClose={() => setSpecialCharsOpen(false)}
        onInsert={insertCharacter}
      />
    </div>
  );
}

function ToolBtn({
  onClick, icon, title, disabled, label, active = false,
}: { onClick: () => void; icon: React.ReactNode; title: string; disabled?: boolean; label?: string; active?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1 rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-40',
        label ? 'h-8 px-2 text-[10px] font-bold font-sukhumvit' : 'h-7 w-7 justify-center',
        active
          ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-200'
          : 'text-slate-600 hover:bg-white hover:text-slate-900',
      )}
    >
      {icon}
      {label ? <span>{label}</span> : null}
    </button>
  );
}
