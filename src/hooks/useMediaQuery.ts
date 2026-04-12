import { useState, useEffect } from "react";

/**
 * Hook สำหรับตรวจสอบ Media Query ในระดับ JavaScript
 * @param query - Media query string เช่น '(max-width: 768px)'
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    
    // ตั้งค่าเริ่มต้น
    if (media.matches !== matches) {
      setMatches(media.matches);
    }

    // Listener สำหรับตรวจจับการเปลี่ยนขนาดหน้าจอ
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);

    return () => media.removeEventListener("change", listener);
  }, [matches, query]);

  return matches;
}

/**
 * Preset Hooks สำหรับขนาดหน้าจอมาตรฐานตาม Tailwind Breakpoints
 */
export const useIsMobile = () => useMediaQuery("(max-width: 767px)");
export const useIsTablet = () => useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");