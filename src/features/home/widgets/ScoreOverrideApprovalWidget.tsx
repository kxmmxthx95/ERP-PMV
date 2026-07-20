import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { HiBell } from 'react-icons/hi2';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { approveScoreOverride, rejectScoreOverride } from '@/lib/exam/scoreOverride';
import type { ExamScoreOverrideRequest } from '@/types/exam';
import { WIDGET_CARD, WIDGET_GLASS } from '../widgetStyles';

export default function ScoreOverrideApprovalWidget() {
  const { user, userData } = useAuth();
  const currentUserName = [userData?.prefix, userData?.firstName, userData?.lastName].filter(Boolean).join(' ').trim()
    || userData?.displayName || userData?.name || user?.displayName || 'ไม่ทราบชื่อ';

  const [requests, setRequests] = useState<ExamScoreOverrideRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'exam_score_overrides'), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as ExamScoreOverrideRequest));
    });
    return () => unsub();
  }, []);

  const handleApprove = async (req: ExamScoreOverrideRequest) => {
    if (!user) return;
    setBusyId(req.id);
    try {
      await approveScoreOverride(req, user.uid, currentUserName);
      toast.success(`อนุมัติคะแนนของ ${req.studentName} แล้ว`);
    } catch {
      toast.error('อนุมัติไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (req: ExamScoreOverrideRequest) => {
    if (!user) return;
    const note = window.prompt('เหตุผลที่ปฏิเสธ (ถ้ามี)') ?? '';
    setBusyId(req.id);
    try {
      await rejectScoreOverride(req, user.uid, currentUserName, note);
      toast.info(`ปฏิเสธคำขอของ ${req.studentName} แล้ว`);
    } catch {
      toast.error('ปฏิเสธไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={WIDGET_GLASS}
        className={`${WIDGET_CARD} items-start text-left`}
      >
        <div className="flex items-center justify-between w-full shrink-0">
          <span className="font-bold text-sm text-slate-700 truncate">คำขอแก้ไขคะแนน</span>
          <HiBell size={16} className={requests.length > 0 ? 'text-rose-500' : 'text-slate-300'} />
        </div>
        {requests.length > 0 ? (
          <>
            <span className="text-2xl font-black text-rose-600 tabular-nums leading-none">{requests.length}</span>
            <span className="text-[10px] text-slate-400">รายการรออนุมัติ</span>
          </>
        ) : (
          <span className="text-[12px] text-slate-400 mt-2">ไม่มีคำขอค้างอนุมัติ</span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogTitle className="font-sukhumvit">คำขอแก้ไขคะแนน ({requests.length})</DialogTitle>
          <div className="flex flex-col gap-2 overflow-y-auto pr-1">
            {requests.length === 0 && (
              <p className="text-center text-slate-400 text-[13px] font-sarabun py-8">ไม่มีคำขอค้างอนุมัติ</p>
            )}
            {requests.map((req) => (
              <div key={req.id} className="rounded-xl border border-slate-200 p-3 flex flex-col gap-1.5">
                <p className="text-[12px] font-bold text-slate-700 font-sukhumvit">
                  {req.studentName} — {req.roomTitle} (รอบ {req.round})
                </p>
                <p className="text-[15px] font-black font-sukhumvit tabular-nums">
                  <span className="text-slate-400">{req.previousScore ?? '-'}</span>
                  <span className="mx-1.5 text-slate-400">→</span>
                  <span className="text-indigo-600">{req.requestedScore}</span>
                  <span className="text-slate-400 text-[11px]"> / {req.maxPoints}</span>
                </p>
                <p className="text-[11px] text-slate-500 font-sarabun">เหตุผล: {req.reason}</p>
                <p className="text-[10px] text-slate-400 font-sarabun">ขอโดย {req.requestedByName}</p>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    disabled={busyId === req.id}
                    onClick={() => void handleApprove(req)}
                    className="h-8 flex-1 rounded-lg bg-emerald-600 text-white text-[11px] font-black font-sukhumvit hover:bg-emerald-700 disabled:opacity-60"
                  >
                    อนุมัติ
                  </button>
                  <button
                    type="button"
                    disabled={busyId === req.id}
                    onClick={() => void handleReject(req)}
                    className="h-8 flex-1 rounded-lg bg-rose-100 text-rose-700 text-[11px] font-black font-sukhumvit hover:bg-rose-200 disabled:opacity-60"
                  >
                    ปฏิเสธ
                  </button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
