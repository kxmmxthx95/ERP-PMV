import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Clock, Save, LocateFixed, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAttendanceConfig, type AttendanceConfig } from '@/hooks/useAttendanceConfig';
import { WIDGET_GLASS } from '@/features/home/widgetStyles';

// ── Helpers ───────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0'); }

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
    <div
      className="h-[calc(100vh-180px)] grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden"
    >
      {/* ── Left Column: Map Area ── */}
      <div className="relative rounded-3xl overflow-hidden border border-slate-200 bg-slate-50 h-full group">
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
        <div className="absolute bottom-6 left-6 flex flex-col gap-1.5 z-[400]">
          {(Object.entries(MAP_LAYERS) as [MapLayerKey, typeof MAP_LAYERS[MapLayerKey]][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setActiveLayer(key)}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-lg border transition-all"
              style={{
                background: activeLayer === key ? '#2563eb' : 'rgba(255,255,255,0.92)',
                color: activeLayer === key ? '#fff' : '#475569',
                borderColor: activeLayer === key ? '#2563eb' : 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(8px)',
              }}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Re-center button */}
        <button
          onClick={() => { if ((window as any).L) {} }}
          className="absolute bottom-6 right-6 p-3 rounded-2xl bg-white shadow-2xl border border-slate-100 text-blue-600 hover:bg-blue-50 transition-all z-[400] opacity-0 group-hover:opacity-100"
          title="จัดกึ่งกลางหมุด"
        >
          <LocateFixed size={20} />
        </button>
      </div>

      {/* ── Right Column: Settings Area ── */}
      <div style={WIDGET_GLASS} className="rounded-3xl p-6 flex flex-col justify-between h-full overflow-y-auto no-scrollbar">
        <div className="space-y-6">
          {/* Section: Coordinates */}
          <div className="space-y-3">
            <div className="flex justify-between items-end">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">พิกัดโรงเรียน</p>
              <button
                onClick={locateMe}
                disabled={locating}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-[11px] font-black hover:bg-blue-100 transition-all disabled:opacity-50"
              >
                {locating ? <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : <LocateFixed size={12} />}
                ดึงตำแหน่งปัจจุบัน
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">ละติจูด</label>
                <input
                  type="number"
                  step="0.000001"
                  value={draft.lat}
                  onChange={e => set('lat', parseFloat(e.target.value) || draft.lat)}
                  className="w-full h-10 rounded-xl bg-slate-50 border-none px-4 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">ลองติจูด</label>
                <input
                  type="number"
                  step="0.000001"
                  value={draft.lng}
                  onChange={e => set('lng', parseFloat(e.target.value) || draft.lng)}
                  className="w-full h-10 rounded-xl bg-slate-50 border-none px-4 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
            </div>
            {locErr && <p className="text-[10px] text-rose-500 font-bold ml-1 flex items-center gap-1"><AlertCircle size={10}/> {locErr}</p>}
          </div>

          {/* Section: Geofence */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">รัศมีพื้นที่ (เมตร)</p>
              <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">{draft.radiusMeters} ม.</span>
            </div>
            <input
              type="range"
              min={50} max={500} step={25}
              value={draft.radiusMeters}
              onChange={e => set('radiusMeters', parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[10px] font-bold text-slate-300">
              <span>50 ม.</span><span>500 ม.</span>
            </div>
          </div>

          {/* Section: Shift Time */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {/* Start Time */}
              <div className="space-y-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={12} /> เวลาเริ่มงาน (สายหลังเวลานี้)
                </p>

                <div className="flex items-center justify-center gap-4 py-2">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => set('shiftStartHour', Math.max(0, draft.shiftStartHour - 1))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">−</button>
                      <div className="w-14 h-11 flex items-center justify-center bg-slate-50 rounded-2xl font-mono text-xl font-black text-slate-800 border border-slate-100">
                        {pad(draft.shiftStartHour)}
                      </div>
                      <button onClick={() => set('shiftStartHour', Math.min(23, draft.shiftStartHour + 1))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">+</button>
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 uppercase">ชั่วโมง</span>
                  </div>
                  <span className="text-2xl font-black text-slate-200 mt-[-18px]">:</span>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => set('shiftStartMinute', Math.max(0, draft.shiftStartMinute - 5))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">−</button>
                      <div className="w-14 h-11 flex items-center justify-center bg-slate-50 rounded-2xl font-mono text-xl font-black text-slate-800 border border-slate-100">
                        {pad(draft.shiftStartMinute)}
                      </div>
                      <button onClick={() => set('shiftStartMinute', Math.min(55, draft.shiftStartMinute + 5))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">+</button>
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 uppercase">นาที</span>
                  </div>
                </div>
              </div>

              {/* End Time */}
              <div className="space-y-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={12} /> เวลาออกงาน (เช็คเอาต์ปกติ)
                </p>

                <div className="flex items-center justify-center gap-4 py-2">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => set('shiftEndHour', Math.max(0, draft.shiftEndHour - 1))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">−</button>
                      <div className="w-14 h-11 flex items-center justify-center bg-slate-50 rounded-2xl font-mono text-xl font-black text-slate-800 border border-slate-100">
                        {pad(draft.shiftEndHour)}
                      </div>
                      <button onClick={() => set('shiftEndHour', Math.min(23, draft.shiftEndHour + 1))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">+</button>
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 uppercase">ชั่วโมง</span>
                  </div>
                  <span className="text-2xl font-black text-slate-200 mt-[-18px]">:</span>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => set('shiftEndMinute', Math.max(0, draft.shiftEndMinute - 5))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">−</button>
                      <div className="w-14 h-11 flex items-center justify-center bg-slate-50 rounded-2xl font-mono text-xl font-black text-slate-800 border border-slate-100">
                        {pad(draft.shiftEndMinute)}
                      </div>
                      <button onClick={() => set('shiftEndMinute', Math.min(55, draft.shiftEndMinute + 5))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">+</button>
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 uppercase">นาที</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Duty Time (ครูเวร) */}
          <div className="space-y-6 pt-6 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {/* Duty Start Time */}
              <div className="space-y-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={12} /> เวลาเริ่มเวรครู
                </p>

                <div className="flex items-center justify-center gap-4 py-2">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => set('dutyStartHour', Math.max(0, draft.dutyStartHour - 1))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">−</button>
                      <div className="w-14 h-11 flex items-center justify-center bg-slate-50 rounded-2xl font-mono text-xl font-black text-slate-800 border border-slate-100">
                        {pad(draft.dutyStartHour)}
                      </div>
                      <button onClick={() => set('dutyStartHour', Math.min(23, draft.dutyStartHour + 1))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">+</button>
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 uppercase">ชั่วโมง</span>
                  </div>
                  <span className="text-2xl font-black text-slate-200 mt-[-18px]">:</span>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => set('dutyStartMinute', Math.max(0, draft.dutyStartMinute - 5))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">−</button>
                      <div className="w-14 h-11 flex items-center justify-center bg-slate-50 rounded-2xl font-mono text-xl font-black text-slate-800 border border-slate-100">
                        {pad(draft.dutyStartMinute)}
                      </div>
                      <button onClick={() => set('dutyStartMinute', Math.min(55, draft.dutyStartMinute + 5))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">+</button>
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 uppercase">นาที</span>
                  </div>
                </div>
              </div>

              {/* Duty End Time */}
              <div className="space-y-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={12} /> เวลาสิ้นสุดเวรครู
                </p>

                <div className="flex items-center justify-center gap-4 py-2">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => set('dutyEndHour', Math.max(0, draft.dutyEndHour - 1))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">−</button>
                      <div className="w-14 h-11 flex items-center justify-center bg-slate-50 rounded-2xl font-mono text-xl font-black text-slate-800 border border-slate-100">
                        {pad(draft.dutyEndHour)}
                      </div>
                      <button onClick={() => set('dutyEndHour', Math.min(23, draft.dutyEndHour + 1))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">+</button>
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 uppercase">ชั่วโมง</span>
                  </div>
                  <span className="text-2xl font-black text-slate-200 mt-[-18px]">:</span>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => set('dutyEndMinute', Math.max(0, draft.dutyEndMinute - 5))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">−</button>
                      <div className="w-14 h-11 flex items-center justify-center bg-slate-50 rounded-2xl font-mono text-xl font-black text-slate-800 border border-slate-100">
                        {pad(draft.dutyEndMinute)}
                      </div>
                      <button onClick={() => set('dutyEndMinute', Math.min(55, draft.dutyEndMinute + 5))} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center font-bold">+</button>
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 uppercase">นาที</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer: Summary & Save */}
        <div className="space-y-4 mt-6">

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all ${
              saved
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                : 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-200'
            } disabled:opacity-60`}
          >
            {saving ? (
              <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            ) : saved ? (
              <><CheckCircle2 size={18} /> บันทึกเรียบร้อย</>
            ) : (
              <><Save size={18} /> บันทึกการตั้งค่าทั้งหมด</>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
