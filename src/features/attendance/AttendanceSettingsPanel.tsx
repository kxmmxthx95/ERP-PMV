import { useState, useEffect, useRef } from 'react';
import { MapPin, Clock, Save, LocateFixed, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAttendanceConfig, type AttendanceConfig } from '@/hooks/useAttendanceConfig';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0'); }

function toTimeValue(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}

function parseTimeValue(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

declare const L: any; // Leaflet global

// ── Map Layers ────────────────────────────────────────────────────────────────
type MapLayerKey = 'voyager' | 'satellite' | 'terrain';

const MAP_LAYERS: Record<MapLayerKey, { label: string; url: string; maxZoom: number }> = {
  voyager: {
    label: 'ถนน',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    maxZoom: 20,
  },
  satellite: {
    label: 'ดาวเทียม',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    maxZoom: 19,
  },
  terrain: {
    label: 'ภูมิประเทศ',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxZoom: 17,
  },
};

// ── Reverse Geocode via Nominatim ─────────────────────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=th`,
      { headers: { 'Accept-Language': 'th' } },
    );
    const json = await res.json();
    return json.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

// ── Map Logic Component ──────────────────────────────────────────────────────
function MapLogic({ lat, lng, radius, activeLayer, onChange }: {
  lat: number;
  lng: number;
  radius: number;
  activeLayer: MapLayerKey;
  onChange: (lat: number, lng: number) => void;
}) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const tileRef = useRef<any>(null);

  const openPopup = async (marker: any, plat: number, plng: number) => {
    marker.bindPopup('<span style="font-size:11px;color:#64748b">กำลังโหลด...</span>', {
      maxWidth: 280,
      className: 'leaflet-place-popup',
    }).openPopup();
    const name = await reverseGeocode(plat, plng);
    marker.setPopupContent(
      `<div style="font-size:12px;font-weight:700;color:#1e293b;line-height:1.5;max-width:260px">${name}</div>`,
    );
  };

  useEffect(() => {
    if (!(window as any).L || mapRef.current) return;

    const map = L.map('leaflet-map', {
      zoomControl: false,
      attributionControl: false,
    }).setView([lat, lng], 17);

    const layer = MAP_LAYERS[activeLayer];
    tileRef.current = L.tileLayer(layer.url, { maxZoom: layer.maxZoom }).addTo(map);

    const customIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `
        <div style="
          width: 32px; height: 32px;
          background: #2563eb; border: 3px solid white;
          border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
          display: flex; align-items: center; justify-content: center;
        ">
          <div style="width:8px;height:8px;background:white;border-radius:50%;transform:rotate(45deg);"></div>
        </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -34],
    });

    const marker = L.marker([lat, lng], { draggable: true, icon: customIcon }).addTo(map);

    // Show popup on initial load
    openPopup(marker, lat, lng);

    // Update popup after drag
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      const newLat = parseFloat(pos.lat.toFixed(6));
      const newLng = parseFloat(pos.lng.toFixed(6));
      onChange(newLat, newLng);
      openPopup(marker, newLat, newLng);
    });

    // Click marker to show popup
    marker.on('click', () => {
      const pos = marker.getLatLng();
      openPopup(marker, pos.lat, pos.lng);
    });

    const circle = L.circle([lat, lng], {
      radius,
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.15,
      weight: 2,
      dashArray: '5, 5',
    }).addTo(map);

    mapRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
    };
  }, []);

  // Swap tile layer when activeLayer changes
  useEffect(() => {
    if (!mapRef.current || !tileRef.current) return;
    const map = mapRef.current;
    map.removeLayer(tileRef.current);
    const layer = MAP_LAYERS[activeLayer];
    tileRef.current = L.tileLayer(layer.url, { maxZoom: layer.maxZoom }).addTo(map);
    tileRef.current.bringToBack();
  }, [activeLayer]);

  // Update marker & circle when lat/lng/radius change (e.g. "locate me" button)
  useEffect(() => {
    if (markerRef.current) {
      const pos = markerRef.current.getLatLng();
      if (pos.lat !== lat || pos.lng !== lng) {
        markerRef.current.setLatLng([lat, lng]);
        mapRef.current?.panTo([lat, lng]);
        openPopup(markerRef.current, lat, lng);
      }
    }
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
      circleRef.current.setRadius(radius);
    }
  }, [lat, lng, radius]);

  return null;
}

// ── Section shell ─────────────────────────────────────────────────────────────
function SettingsSection({ title, icon: Icon, children }: { title: string; icon?: typeof MapPin; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-slate-500">
        {Icon && <Icon size={14} className="text-blue-600" />}
        {title}
      </p>
      {children}
    </div>
  );
}

function TimeRangeFields({
  startLabel,
  endLabel,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
}: {
  startLabel: string;
  endLabel: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label className="text-[10px] font-black uppercase tracking-wider text-slate-600">{startLabel}</Label>
        <Input
          type="time"
          value={startValue}
          onChange={(e) => onStartChange(e.target.value)}
          className="h-11 w-full rounded-xl border-slate-200 bg-slate-50/70 text-sm font-bold text-slate-800"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] font-black uppercase tracking-wider text-slate-600">{endLabel}</Label>
        <Input
          type="time"
          value={endValue}
          onChange={(e) => onEndChange(e.target.value)}
          className="h-11 w-full rounded-xl border-slate-200 bg-slate-50/70 text-sm font-bold text-slate-800"
        />
      </div>
    </div>
  );
}

// ── Main settings panel ───────────────────────────────────────────────────────
export default function AttendanceSettingsPanel() {
  const { config, loading, saveConfig } = useAttendanceConfig();
  const [draft, setDraft] = useState<AttendanceConfig>(config);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<MapLayerKey>('voyager');

  // sync when config loads from Firestore
  useEffect(() => { if (!loading) setDraft(config); }, [config, loading]);

  const set = <K extends keyof AttendanceConfig>(key: K, val: AttendanceConfig[K]) =>
    setDraft(d => ({ ...d, [key]: val }));

  const setTime = (hourKey: keyof AttendanceConfig, minuteKey: keyof AttendanceConfig) => (value: string) => {
    const parsed = parseTimeValue(value);
    if (!parsed) return;
    setDraft(d => ({ ...d, [hourKey]: parsed.hour, [minuteKey]: parsed.minute }));
  };

  const handleSave = async () => {
    setSaving(true);
    await saveConfig(draft);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const locateMe = () => {
    setLocating(true);
    setLocErr(null);

    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 };

    const success = (pos: GeolocationPosition) => {
      setDraft(d => ({
        ...d,
        lat: parseFloat(pos.coords.latitude.toFixed(6)),
        lng: parseFloat(pos.coords.longitude.toFixed(6)),
      }));
      setLocating(false);
    };

    const fail = (err: GeolocationPositionError) => {
      // Fallback to low accuracy
      if (err.code === 2 || err.code === 3) {
        console.warn("Retrying with low accuracy in settings...");
        navigator.geolocation.getCurrentPosition(success, finalFail, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 30000
        });
      } else {
        finalFail(err);
      }
    };

    const finalFail = (err: GeolocationPositionError) => {
      let msg = 'ไม่สามารถหาตำแหน่งได้';
      if (err.code === 1) msg = 'กรุณาอนุญาตการเข้าถึงพิกัด (Location Permission)';
      else if (err.code === 2) msg = 'สัญญาณพิกัดขัดข้อง (Unknown Location)';
      else if (err.code === 3) msg = 'ค้นหาตำแหน่งนานเกินไป กรุณาลองใหม่อีกครั้ง';
      setLocErr(msg);
      setLocating(false);
    };

    navigator.geolocation.getCurrentPosition(success, fail, options);
  };

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="w-6 h-6 border-3 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Map ── */}
      <div className="relative h-72 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 group">
        <div id="leaflet-map" className="absolute inset-0 z-0" />

        <MapLogic
          lat={draft.lat}
          lng={draft.lng}
          radius={draft.radiusMeters}
          activeLayer={activeLayer}
          onChange={(lat, lng) => setDraft(d => ({ ...d, lat, lng }))}
        />

        {/* Map Header Overlay */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-[400]">
          <div className="bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-white/50 flex items-center gap-2">
            <MapPin size={16} className="text-blue-600" />
            <span className="font-bold text-xs text-slate-700">ตำแหน่งโรงเรียน (ลากหมุดเพื่อย้าย)</span>
          </div>
        </div>

        {/* Layer Switcher */}
        <div className="absolute bottom-4 left-4 flex gap-1.5 z-[400]">
          {(Object.entries(MAP_LAYERS) as [MapLayerKey, typeof MAP_LAYERS[MapLayerKey]][]).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveLayer(key)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-lg border transition-all backdrop-blur-md',
                activeLayer === key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white/90 text-slate-600 border-white/60',
              )}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Coordinates ── */}
      <SettingsSection title="พิกัดโรงเรียน" icon={MapPin}>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={locateMe}
            disabled={locating}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-[11px] font-black hover:bg-blue-100 transition-all disabled:opacity-50"
          >
            {locating ? <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : <LocateFixed size={12} />}
            ดึงตำแหน่งปัจจุบัน
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-600">ละติจูด</Label>
            <Input
              type="number"
              step="0.000001"
              value={draft.lat}
              onChange={e => set('lat', parseFloat(e.target.value) || draft.lat)}
              className="h-11 w-full rounded-xl border-slate-200 bg-slate-50/70 text-sm font-bold text-slate-700"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-wider text-slate-600">ลองติจูด</Label>
            <Input
              type="number"
              step="0.000001"
              value={draft.lng}
              onChange={e => set('lng', parseFloat(e.target.value) || draft.lng)}
              className="h-11 w-full rounded-xl border-slate-200 bg-slate-50/70 text-sm font-bold text-slate-700"
            />
          </div>
        </div>
        {locErr && (
          <p className="text-[11px] text-rose-500 font-bold flex items-center gap-1">
            <AlertCircle size={12} /> {locErr}
          </p>
        )}
      </SettingsSection>

      {/* ── Geofence ── */}
      <SettingsSection title="รัศมีพื้นที่ (เมตร)">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">รัศมีที่อนุญาตให้เช็คอิน</span>
          <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg">{draft.radiusMeters} ม.</span>
        </div>
        <Slider
          min={50}
          max={500}
          step={25}
          value={[draft.radiusMeters]}
          onValueChange={([v]) => set('radiusMeters', v)}
        />
        <div className="flex justify-between text-[10px] font-bold text-slate-400">
          <span>50 ม.</span><span>500 ม.</span>
        </div>
      </SettingsSection>

      {/* ── Shift Time ── */}
      <SettingsSection title="เวลาทำงาน" icon={Clock}>
        <TimeRangeFields
          startLabel="เวลาเริ่มงาน"
          endLabel="เวลาออกงาน"
          startValue={toTimeValue(draft.shiftStartHour, draft.shiftStartMinute)}
          endValue={toTimeValue(draft.shiftEndHour, draft.shiftEndMinute)}
          onStartChange={setTime('shiftStartHour', 'shiftStartMinute')}
          onEndChange={setTime('shiftEndHour', 'shiftEndMinute')}
        />
      </SettingsSection>

      {/* ── Duty Time (ครูเวร) ── */}
      <SettingsSection title="เวลาเวรครู" icon={Clock}>
        <TimeRangeFields
          startLabel="เวลาเริ่มเวรครู"
          endLabel="เวลาสิ้นสุดเวรครู"
          startValue={toTimeValue(draft.dutyStartHour, draft.dutyStartMinute)}
          endValue={toTimeValue(draft.dutyEndHour, draft.dutyEndMinute)}
          onStartChange={setTime('dutyStartHour', 'dutyStartMinute')}
          onEndChange={setTime('dutyEndHour', 'dutyEndMinute')}
        />
      </SettingsSection>

      {/* ── Save ── */}
      <Button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className={cn(
          'w-full py-6 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all disabled:opacity-60 border-none',
          saved
            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
            : 'bg-primary text-primary-foreground hover:bg-primary/90',
        )}
      >
        {saving ? (
          <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
        ) : saved ? (
          <><CheckCircle2 size={18} /> บันทึกเรียบร้อย</>
        ) : (
          <><Save size={18} /> บันทึก</>
        )}
      </Button>
    </div>
  );
}
