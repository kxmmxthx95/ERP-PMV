import { useEffect, type RefObject } from 'react';

const LONG_PRESS_MS = 450;

/** กดค้างที่รูปใน container แล้วเรียก onPreview(url) */
export function useImageLongPressPreview(
  containerRef: RefObject<HTMLElement | null>,
  onPreview: ((url: string) => void) | undefined,
  enabled = true,
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !onPreview || !enabled) return;

    const timers = new WeakMap<EventTarget, ReturnType<typeof setTimeout>>();

    const clearTimer = (target: EventTarget) => {
      const timer = timers.get(target);
      if (timer !== undefined) {
        clearTimeout(timer);
        timers.delete(target);
      }
    };

    let activeImg: HTMLElement | null = null;

    const onPointerMove = () => {
      if (activeImg) clearTimer(activeImg);
    };

    const onPointerDown = (e: PointerEvent) => {
      const img = (e.target as HTMLElement).closest('img');
      if (!img || !container.contains(img)) return;

      const src = img.currentSrc || img.getAttribute('src') || '';
      if (!src) return;

      activeImg = img;
      clearTimer(img);
      const timer = setTimeout(() => {
        onPreview(src);
        navigator.vibrate?.(25);
      }, LONG_PRESS_MS);
      timers.set(img, timer);
    };

    const onPointerEnd = (e: PointerEvent) => {
      const img = (e.target as HTMLElement).closest('img');
      if (img) clearTimer(img);
      activeImg = null;
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerEnd);
    container.addEventListener('pointercancel', onPointerEnd);
    container.addEventListener('pointerleave', onPointerEnd);

    container.querySelectorAll('img').forEach((img) => {
      img.classList.add('cursor-zoom-in', 'select-none');
    });

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerEnd);
      container.removeEventListener('pointercancel', onPointerEnd);
      container.removeEventListener('pointerleave', onPointerEnd);
      container.querySelectorAll('img').forEach((img) => clearTimer(img));
    };
  }, [containerRef, onPreview, enabled]);
}
