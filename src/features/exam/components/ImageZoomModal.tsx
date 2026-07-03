import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, RotateCcw, X } from 'lucide-react';

type Props = {
  src: string | null;
  onClose: () => void;
};

const getEventCoords = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
  if ('touches' in e) {
    const touch = e.touches[0] || e.changedTouches[0];
    return touch ? { x: touch.clientX, y: touch.clientY } : null;
  }
  return { x: e.clientX, y: e.clientY };
};

export default function ImageZoomModal({ src, onClose }: Props) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPinching, setIsPinching] = useState(false);

  const dragStart = useRef({ x: 0, y: 0 });
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartScale = useRef<number>(1);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const positionRef = useRef(position);
  const scaleRef = useRef(scale);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Lock body scroll when open
  useEffect(() => {
    if (src) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [src]);

  // Reset scale and position when src changes
  useEffect(() => {
    if (src) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
      setIsPinching(false);
    }
  }, [src]);

  // Handle Close on Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.25, 4));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = 0.1;
    if (e.deltaY < 0) {
      setScale((s) => Math.min(s + zoomFactor, 4));
    } else {
      setScale((s) => Math.max(s - zoomFactor, 0.5));
    }
  };

  // Unified Drag Start for Mouse & Touch
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if ('touches' in e && e.touches.length === 2) {
      // 2-finger pinch gesture start
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
      pinchStartDistance.current = dist;
      pinchStartScale.current = scale;
      setIsDragging(false);
      setIsPinching(true);
    } else {
      // Single-finger touch or mouse click start drag
      const coords = getEventCoords(e);
      if (!coords) return;
      setIsDragging(true);
      setIsPinching(false);
      dragStart.current = {
        x: coords.x - position.x,
        y: coords.y - position.y,
      };
    }
  };

  // Drag Move handler (globally registered when active)
  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if ('touches' in e) {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);

        if (!isPinching) {
          pinchStartDistance.current = dist;
          pinchStartScale.current = scaleRef.current;
          setIsPinching(true);
          setIsDragging(false);
        } else if (pinchStartDistance.current !== null) {
          if (e.cancelable) e.preventDefault();
          const ratio = dist / pinchStartDistance.current;
          setScale(Math.min(Math.max(pinchStartScale.current * ratio, 0.5), 4));
        }
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        if (isPinching) {
          dragStart.current = {
            x: touch.clientX - positionRef.current.x,
            y: touch.clientY - positionRef.current.y,
          };
          pinchStartDistance.current = null;
          setIsPinching(false);
          setIsDragging(true);
        } else if (isDragging) {
          if (e.cancelable) e.preventDefault();
          setPosition({
            x: touch.clientX - dragStart.current.x,
            y: touch.clientY - dragStart.current.y,
          });
        }
      }
    } else if (isDragging) {
      // Free drag panning for mouse
      if (e.cancelable) e.preventDefault();
      const coords = getEventCoords(e);
      if (!coords) return;
      setPosition({
        x: coords.x - dragStart.current.x,
        y: coords.y - dragStart.current.y,
      });
    }
  }, [isDragging, isPinching]);

  // Drag End handler
  const handleDragEnd = useCallback((e: MouseEvent | TouchEvent) => {
    if ('touches' in e) {
      if (e.touches.length === 0) {
        setIsDragging(false);
        setIsPinching(false);
        pinchStartDistance.current = null;
      } else if (e.touches.length === 1) {
        // Switch back to dragging with the remaining single finger
        const touch = e.touches[0];
        dragStart.current = {
          x: touch.clientX - positionRef.current.x,
          y: touch.clientY - positionRef.current.y,
        };
        pinchStartDistance.current = null;
        setIsPinching(false);
        setIsDragging(true);
      }
    } else {
      setIsDragging(false);
    }
  }, []);

  // Listen to drag move & end globally to prevent clipping/losing focus
  useEffect(() => {
    if (isDragging || isPinching) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
      window.addEventListener('touchcancel', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
      window.removeEventListener('touchcancel', handleDragEnd);
    };
  }, [isDragging, isPinching, handleDragMove, handleDragEnd]);

  if (!src) return null;

  return (
    <AnimatePresence>
      <div
        data-vaul-no-drag
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-[110] flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          title="ปิด"
        >
          <X size={20} />
        </button>

        {/* Zoom Controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 px-3 py-2 shadow-2xl">
          <button
            type="button"
            onClick={handleZoomOut}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white hover:bg-white/10 transition-colors"
            title="ซูมออก"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-white text-[12px] font-black font-sukhumvit min-w-[50px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white hover:bg-white/10 transition-colors"
            title="ซูมเข้า"
          >
            <ZoomIn size={18} />
          </button>
          <div className="h-4 w-[1px] bg-white/20 mx-1" />
          <button
            type="button"
            onClick={handleReset}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white hover:bg-white/10 transition-colors"
            title="รีเซ็ต"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        {/* Image Container */}
        <div
          data-vaul-no-drag
          className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none"
          style={{ touchAction: 'none' }}
          onWheel={handleWheel}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <motion.img
            ref={imageRef}
            src={src}
            alt="Zoomed"
            draggable={false}
            data-vaul-no-drag
            animate={{
              scale,
              x: position.x,
              y: position.y,
            }}
            transition={
              isDragging || isPinching
                ? { type: 'tween', duration: 0 }
                : {
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                    mass: 0.8,
                  }
            }
            className="max-w-[90%] max-h-[90%] object-contain rounded-lg shadow-2xl origin-center touch-none"
            style={{
              cursor: isDragging ? 'grabbing' : 'grab',
              touchAction: 'none',
            }}
          />
        </div>
      </div>
    </AnimatePresence>
  );
}
