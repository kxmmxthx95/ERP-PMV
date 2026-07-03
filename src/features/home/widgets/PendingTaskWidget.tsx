import { CheckCircle2 } from 'lucide-react';
import { WIDGET_GLASS } from '../widgetStyles';

const MOCK_TASKS = [
  { id: 1, label: 'เช็กชื่อ ม.3/1 คาบ 1', done: false },
  { id: 2, label: 'กรอกคะแนนกลางภาค ม.4/2', done: false },
  { id: 3, label: 'ส่งแผนการสอนภาค 2', done: true },
];

export default function PendingTaskWidget() {
  const pending = MOCK_TASKS.filter(t => !t.done).length;

  return (
    <div style={WIDGET_GLASS} className="rounded-2xl p-3 flex flex-col gap-2 w-full">
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm text-slate-700">งานค้างดำเนินการ</span>
        {pending > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 font-bold">
            {pending} รายการ
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {MOCK_TASKS.map(t => (
          <div key={t.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-white/40">
            {t.done
              ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              : <div className="w-3.5 h-3.5 rounded-full border-2 border-violet-300 shrink-0" />
            }
            <span className={`text-xs ${t.done ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>
              {t.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
