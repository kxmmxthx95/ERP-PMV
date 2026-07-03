import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

export const EDUCATION_OPTIONS = [
  'ไม่ได้รับการศึกษา',
  'ประถมศึกษา',
  'มัธยมศึกษาตอนต้น',
  'มัธยมศึกษาตอนปลาย / ปวช.',
  'อนุปริญญา / ปวส.',
  'ปริญญาตรี',
  'ปริญญาโท / เอก',
  'อื่นๆ',
] as const;

export const DETAIL_INPUT_CLS =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none focus:border-blue-500 transition-all';

export const MAP_ADDRESS_INPUT_CLS =
  'w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 transition-all';

export function calcStudentAge(birthDate?: string) {
  if (!birthDate) return undefined;
  const birth = new Date(birthDate);
  const today = new Date();
  return today.getFullYear() - birth.getFullYear();
}

export function normalizeNationalId(value: string): string {
  return value.replace(/\D/g, '').slice(0, 13);
}

export function formatNationalId(value?: string): string | undefined {
  const digits = normalizeNationalId(value ?? '');
  if (!digits) return undefined;
  if (digits.length !== 13) return digits;
  return `${digits.slice(0, 1)}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits.slice(12)}`;
}

export function isNationalIdComplete(value?: string): boolean {
  return normalizeNationalId(value ?? '').length === 13;
}

export function DetailViewField({
  value,
  className = '',
  isWhiteBg = false,
}: {
  value?: unknown;
  className?: string;
  isWhiteBg?: boolean;
}) {
  const isEmpty =
    value === undefined ||
    value === null ||
    value === '' ||
    value === '-' ||
    value === 'ยังไม่ได้ระบุ' ||
    String(value).trim() === '-' ||
    String(value).trim() === '' ||
    String(value).trim() === 'ยังไม่ได้ระบุ';

  if (isEmpty) {
    return (
      <div
        className={`px-3 py-2 bg-red-50 border border-red-500 rounded-lg text-[13px] font-bold text-red-600 flex items-center justify-between ${className}`}
        style={{ borderColor: '#ef4444', color: '#dc2626' }}
      >
        <span>กรอกข้อมูลให้ครบถ้วน</span>
      </div>
    );
  }

  if (isWhiteBg) {
    return (
      <div className={`px-4 py-2 bg-white border border-transparent rounded-xl text-sm font-bold text-slate-700 ${className}`}>
        {String(value)}
      </div>
    );
  }

  return (
    <div className={`px-3 py-2 bg-slate-50 border border-transparent rounded-lg text-[13px] font-bold text-slate-600 ${className}`}>
      {String(value)}
    </div>
  );
}

export const compressImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }

        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Canvas to Blob failed'))),
          'image/jpeg',
          quality,
        );
      };
    };
    reader.onerror = (error) => reject(error);
  });

let googleMapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if ((window as any).google?.maps) return Promise.resolve();
  if (googleMapsScriptPromise) return googleMapsScriptPromise;

  googleMapsScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps-api]');
    if (existing) {
      if ((window as any).google?.maps) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google Maps failed to load')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsApi = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
}

export function GoogleMapPicker({
  lat,
  lng,
  onChange,
  isEditMode,
}: {
  lat?: number;
  lng?: number;
  onChange: (lat: number, lng: number) => void;
  isEditMode: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
    if (!apiKey) return;

    const initMap = () => {
      if (!mapRef.current || !(window as any).google?.maps) return;

      const g = (window as any).google;
      const center = { lat: lat || 13.7563, lng: lng || 100.5018 };

      if (!googleMapRef.current) {
        const map = new g.maps.Map(mapRef.current, {
          center,
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        googleMapRef.current = map;

        const marker = new g.maps.Marker({
          position: center,
          map,
          draggable: isEditMode,
        });
        markerRef.current = marker;

        marker.addListener('dragend', () => {
          const pos = marker.getPosition();
          if (pos) onChange(pos.lat(), pos.lng());
        });

        map.addListener('click', (e: any) => {
          if (!isEditMode || !e.latLng) return;
          marker.setPosition(e.latLng);
          onChange(e.latLng.lat(), e.latLng.lng());
        });
      } else {
        markerRef.current?.setDraggable(isEditMode);
      }
    };

    let cancelled = false;
    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (!cancelled) initMap();
      })
      .catch(() => {
        /* map unavailable — silent fail */
      });

    return () => {
      cancelled = true;
    };
  }, [isEditMode, lat, lng, onChange]);

  useEffect(() => {
    if (markerRef.current && lat && lng) {
      const currentPos = markerRef.current.getPosition();
      if (currentPos && (Math.abs(currentPos.lat() - lat) > 0.0001 || Math.abs(currentPos.lng() - lng) > 0.0001)) {
        const newPos = { lat, lng };
        markerRef.current.setPosition(newPos);
        googleMapRef.current?.panTo(newPos);
      }
    }
  }, [lat, lng]);

  return (
    <div className="relative">
      <div ref={mapRef} className="w-full h-[400px] rounded-3xl overflow-hidden border border-slate-200 shadow-inner bg-slate-100" />
      {!isEditMode && <div className="absolute inset-0 bg-transparent" />}
    </div>
  );
}

export function useCurrentLocation(
  isEditMode: boolean,
  onCoords: (lat: number, lng: number) => void,
) {
  return () => {
    if (!isEditMode) {
      toast.error('กรุณาเปิดโหมดแก้ไขก่อน');
      return;
    }
    if (!navigator.geolocation) {
      toast.error('อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง');
      return;
    }

    const loadingToast = toast.loading('กำลังดึงตำแหน่งปัจจุบัน...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(7));
        const lng = Number(position.coords.longitude.toFixed(7));
        onCoords(lat, lng);
        toast.success('อัปเดตพิกัดจากตำแหน่งปัจจุบันแล้ว', { id: loadingToast });
      },
      () => {
        toast.error('ไม่สามารถดึงตำแหน่งได้ กรุณาอนุญาตสิทธิ์ตำแหน่ง', { id: loadingToast });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };
}
