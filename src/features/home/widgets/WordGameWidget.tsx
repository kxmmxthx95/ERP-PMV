import { useNavigate } from 'react-router-dom';
import { HiPuzzlePiece } from 'react-icons/hi2';
import { WIDGET_CARD, WIDGET_GLASS } from '../widgetStyles';

export default function WordGameWidget() {
  const navigate = useNavigate();

  return (
    <div style={WIDGET_GLASS} className={`${WIDGET_CARD} relative overflow-hidden`}>
      <div className="flex items-center justify-between shrink-0">
        <span className="font-bold text-sm text-slate-700 truncate">เกมทายคำ</span>
        <HiPuzzlePiece className="w-5 h-5 text-violet-600 shrink-0" />
      </div>

      <p className="text-[11px] text-slate-500 leading-snug flex-1 min-h-0">
        Multiplayer สลับตา · คำอังกฤษ 5 ตัวอักษร · Realtime (RTDB)
      </p>

      <button
        type="button"
        onClick={() => navigate('/portal/word-game')}
        className="mt-auto w-full py-2 rounded-full bg-violet-600 text-white text-xs font-black hover:bg-violet-700 transition-all active:scale-[0.98] shrink-0"
      >
        เข้าเล่น / สร้างห้อง
      </button>
    </div>
  );
}
