import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  FOLDER_CARD_COLORS,
  getFolderCardColor,
  type FolderCardColorId,
} from '@/lib/subjectFolderCardColors';

const FOLDER_CARD_SRC = '/folder-card/FD-PNG.png';
const LONG_PRESS_MS = 450;
const FOLDER_COLOR_PLATE_W = 184;
const FOLDER_COLOR_PLATE_H = 96;
const FOLDER_COLOR_PLATE_GAP = 8;

function FolderColorPlate({
  selectedId,
  onSelect,
  onClose,
  anchorRect,
}: {
  selectedId: FolderCardColorId;
  onSelect: (id: FolderCardColorId) => void;
  onClose: () => void;
  anchorRect: DOMRect;
}) {
  const placeBelow = anchorRect.top < FOLDER_COLOR_PLATE_H + FOLDER_COLOR_PLATE_GAP + 12;
  let left = anchorRect.left + anchorRect.width / 2 - FOLDER_COLOR_PLATE_W / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - FOLDER_COLOR_PLATE_W - 8));
  const top = placeBelow
    ? Math.min(
        anchorRect.bottom + FOLDER_COLOR_PLATE_GAP,
        window.innerHeight - FOLDER_COLOR_PLATE_H - 8,
      )
    : Math.max(8, anchorRect.top - FOLDER_COLOR_PLATE_H - FOLDER_COLOR_PLATE_GAP);

  return createPortal(
    <>
      <button
        type="button"
        aria-label="ปิดแผงสี"
        className="fixed inset-0 z-[80] cursor-default bg-transparent"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="เลือกสีโฟลเดอร์"
        className="fixed z-[90] w-[11.5rem] rounded-2xl border border-white/50 bg-white/55 p-2.5 shadow-lg backdrop-blur-xl"
        style={{ top, left }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <p className="mb-2 px-0.5 text-center font-sukhumvit text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          เลือกสี
        </p>
        <div className="grid grid-cols-5 gap-2">
          {FOLDER_CARD_COLORS.map((color) => {
            const selected = color.id === selectedId;
            return (
              <button
                key={color.id}
                type="button"
                title={color.label}
                aria-label={color.label}
                aria-pressed={selected}
                onClick={() => onSelect(color.id)}
                className={cn(
                  'h-7 w-7 rounded-full transition-transform hover:scale-110',
                  color.swatchClass,
                  selected
                    ? 'ring-2 ring-foreground ring-offset-2 ring-offset-white/40'
                    : 'ring-1 ring-black/10',
                )}
              />
            );
          })}
        </div>
      </div>
    </>,
    document.body,
  );
}

export function SubjectFolderCardSkeleton() {
  return (
    <div className="flex w-full flex-col items-center gap-2 px-1 py-1" aria-hidden>
      <Skeleton className="aspect-square w-full max-w-[9.5rem] rounded-2xl bg-slate-100" />
      <Skeleton className="h-4 w-[72%] rounded-lg bg-slate-100" />
      <Skeleton className="h-3 w-[44%] rounded-lg bg-slate-50" />
    </div>
  );
}

export function SubjectFolderCardsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid w-full grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <SubjectFolderCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function SubjectFolderCard({
  title,
  subtitle,
  meta,
  colorId,
  onColorChange,
  onClick,
  active = false,
  disabled = false,
  busy = false,
  showPaper = false,
  /** Override folder PNG (e.g. `/P1.png` for exam sets). Skips color tint. */
  imageSrc,
  /** Center overlay on folder art (e.g. incomplete-set warning). */
  centerBadge,
}: {
  title: string;
  subtitle: string;
  meta?: ReactNode;
  colorId: FolderCardColorId;
  onColorChange: (id: FolderCardColorId) => void;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  busy?: boolean;
  showPaper?: boolean;
  imageSrc?: string;
  centerBadge?: ReactNode;
}) {
  const folderColor = getFolderCardColor(colorId);
  const [plateOpen, setPlateOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const folderRef = useRef<HTMLDivElement | null>(null);
  const pressTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const useCustomImage = Boolean(imageSrc);
  const resolvedSrc = imageSrc ?? FOLDER_CARD_SRC;

  const clearPressTimer = () => {
    if (pressTimerRef.current != null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const syncAnchorRect = () => {
    if (folderRef.current) {
      setAnchorRect(folderRef.current.getBoundingClientRect());
    }
  };

  useEffect(() => () => clearPressTimer(), []);

  useEffect(() => {
    if (!plateOpen) return;
    syncAnchorRect();
    const onReposition = () => syncAnchorRect();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [plateOpen]);

  const closePlate = () => {
    setPlateOpen(false);
    setAnchorRect(null);
    suppressClickRef.current = true;
  };

  const openPlate = () => {
    if (disabled || useCustomImage) return;
    suppressClickRef.current = true;
    syncAnchorRect();
    setPlateOpen(true);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(12);
    }
  };

  const handleActivate = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (plateOpen) {
      closePlate();
      return;
    }
    if (disabled || busy) return;
    onClick();
  };

  return (
    <div
      className={cn(
        'group relative flex w-full flex-col items-center gap-2 rounded-2xl px-1 py-1 text-center transition-transform',
        disabled && 'cursor-not-allowed opacity-55',
        !disabled && !plateOpen && 'hover:-translate-y-0.5',
        active && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-background',
      )}
    >
      {plateOpen && anchorRect && !useCustomImage && (
        <FolderColorPlate
          selectedId={colorId}
          anchorRect={anchorRect}
          onClose={closePlate}
          onSelect={(id) => {
            onColorChange(id);
            closePlate();
          }}
        />
      )}

      <div
        ref={folderRef}
        className="relative aspect-square w-full max-w-[9.5rem] touch-manipulation select-none"
      >
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          title={
            useCustomImage
              ? `${title} · ${subtitle}`
              : `${title} · ${subtitle} — กดค้างเพื่อเปลี่ยนสี`
          }
          className="flex h-full w-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          onClick={handleActivate}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleActivate();
            }
          }}
          onPointerDown={(e) => {
            if (disabled || useCustomImage || e.button !== 0) return;
            clearPressTimer();
            pressTimerRef.current = window.setTimeout(openPlate, LONG_PRESS_MS);
          }}
          onPointerUp={clearPressTimer}
          onPointerLeave={clearPressTimer}
          onPointerCancel={clearPressTimer}
          onContextMenu={(e) => {
            if (useCustomImage) return;
            e.preventDefault();
            openPlate();
          }}
        >
          <div
            className={cn(
              'relative h-full w-full transition-transform',
              !disabled && 'group-hover:scale-[1.03]',
            )}
          >
            <img
              src={resolvedSrc}
              alt=""
              draggable={false}
              style={useCustomImage ? undefined : { filter: folderColor.filter }}
              className="h-full w-full object-contain drop-shadow-sm transition-[filter]"
            />
            {!useCustomImage && showPaper && (
              <span
                aria-hidden
                className="pointer-events-none absolute left-[13.5%] top-[18.6%] z-[1] h-[3.6%] w-[73%] overflow-hidden"
              >
                <span className="absolute inset-x-[4%] top-[18%] h-[160%] rounded-t-[3px] bg-white/80" />
                <span
                  className="absolute inset-x-0 top-[28%] h-[150%] rounded-t-[3px] bg-white"
                  style={{
                    boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
                    WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 55%, transparent 100%)',
                    maskImage: 'linear-gradient(to bottom, #000 0%, #000 55%, transparent 100%)',
                  }}
                />
              </span>
            )}
            {busy && (
              <div className="absolute inset-0 z-[2] flex items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              </div>
            )}
            {!busy && centerBadge ? (
              <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center">
                {centerBadge}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={handleActivate}
        className="min-w-0 w-full space-y-0.5 px-0.5 text-center disabled:cursor-not-allowed"
      >
        <p
          className={cn(
            'line-clamp-2 font-sukhumvit text-sm font-black leading-snug tracking-tight',
            disabled ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {title}
        </p>
        <p
          className={cn(
            'line-clamp-1 font-sarabun text-[11px] font-bold',
            disabled ? 'text-muted-foreground/70' : 'text-muted-foreground',
          )}
        >
          {subtitle}
        </p>
        {meta}
      </button>
    </div>
  );
}
