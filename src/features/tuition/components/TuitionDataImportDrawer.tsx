import { useRef, useState } from 'react';
import {
  HiArrowDownTray,
  HiCheckCircle,
  HiLink,
  HiOutlineArrowUpTray,
  HiOutlineExclamationTriangle,
  HiOutlineTableCells,
  HiXMark,
} from 'react-icons/hi2';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { formatTHB } from '../tuitionCalc';
import {
  downloadTuitionDataTemplate,
  parseTuitionDataFile,
  parseTuitionDataGoogleSheet,
  type TuitionDataImportRow,
} from '../utils/tuitionDataImport';
import type { StudentFee, TuitionCampaign } from '@/types/tuition';
import { tuitionTermLabel } from '@/types/tuition';

const DRAWER_CONTENT_CLASS = cn(
  'h-dvh flex flex-col p-0 rounded-none bg-white/95 backdrop-blur-xl',
  'data-[vaul-drawer-direction=right]:w-screen data-[vaul-drawer-direction=right]:max-w-none',
  'data-[vaul-drawer-direction=right]:before:inset-0 data-[vaul-drawer-direction=right]:before:rounded-none',
  'sm:h-full sm:rounded-l-3xl',
  'sm:data-[vaul-drawer-direction=right]:w-full sm:data-[vaul-drawer-direction=right]:max-w-3xl',
  'sm:data-[vaul-drawer-direction=right]:before:inset-2 sm:data-[vaul-drawer-direction=right]:before:rounded-4xl',
);

type ImportTab = 'file' | 'sheet';

interface TuitionDataImportDrawerProps {
  open: boolean;
  onClose: () => void;
  campaign: TuitionCampaign | null;
  studentFees: StudentFee[];
  onImport: (rows: TuitionDataImportRow[]) => Promise<{ succeeded: number; failed: number }>;
  isImporting?: boolean;
}

export default function TuitionDataImportDrawer({
  open,
  onClose,
  campaign,
  studentFees,
  onImport,
  isImporting,
}: TuitionDataImportDrawerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<ImportTab>('file');
  const [rows, setRows] = useState<TuitionDataImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<{ succeeded: number; failed: number } | null>(null);

  const readyRows = rows.filter((row) => row.status !== 'error');
  const errorRows = rows.filter((row) => row.status === 'error');
  const warningRows = rows.filter((row) => row.status === 'warning');
  const totalPayment = readyRows.reduce((sum, row) => sum + row.paymentAmount, 0);
  const scholarshipCount = readyRows.filter((row) => row.scholarship).length;

  function resetState() {
    setTab('file');
    setRows([]);
    setFileName('');
    setSheetUrl('');
    setError('');
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setError('');
    setImportResult(null);
    setFileName(file.name);

    try {
      const parsed = await parseTuitionDataFile(file, studentFees);
      setRows(parsed);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'อ่านไฟล์ไม่สำเร็จ');
    } finally {
      setIsParsing(false);
    }
  }

  async function handleFetchSheet() {
    if (!sheetUrl.trim()) {
      setError('กรุณาวางลิงก์ Google Sheet');
      return;
    }

    setIsParsing(true);
    setError('');
    setImportResult(null);
    setFileName('Google Sheet');

    try {
      const parsed = await parseTuitionDataGoogleSheet(sheetUrl.trim(), studentFees);
      setRows(parsed);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'ดึงข้อมูลไม่สำเร็จ');
    } finally {
      setIsParsing(false);
    }
  }

  async function handleImport() {
    if (readyRows.length === 0) return;
    setError('');
    try {
      const result = await onImport(readyRows);
      setImportResult(result);
      if (result.failed === 0) {
        setRows([]);
        setFileName('');
        setSheetUrl('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'นำเข้าข้อมูลไม่สำเร็จ');
    }
  }

  return (
    <Drawer open={open} onOpenChange={(next) => !next && handleClose()} direction="right">
      <DrawerContent className={DRAWER_CONTENT_CLASS}>
        <div className="flex h-full min-h-0 flex-col">
          <DrawerHeader className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
                  <HiOutlineTableCells size={18} />
                </div>
                <div className="min-w-0 text-left">
                  <DrawerTitle className="text-base font-black text-slate-900">
                    นำเข้าข้อมูลค่าเทอม
                  </DrawerTitle>
                  <DrawerDescription className="text-xs font-semibold text-slate-500">
                    {campaign
                      ? `${tuitionTermLabel(campaign.term)}/${campaign.academicYearId} · อัปเดตทุนและการชำระเงิน`
                      : 'อัปเดตทุนและการชำระเงิน'}
                  </DrawerDescription>
                </div>
              </div>
              <DrawerClose asChild>
                <button
                  type="button"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50"
                  aria-label="ปิด"
                >
                  <HiXMark className="h-4 w-4" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs font-semibold leading-relaxed text-blue-900">
              คอลัมน์ที่รองรับ: รหัสนักเรียน, คำนำหน้า, ชื่อ, นามสกุล, แผนก, ระดับชั้น, ยอดเงิน, วันที่จ่าย, ประเภททุน, ส่วนลด
              (ใส่เปอร์เซ็นต์เช่น 50% หรือยอดเงินเช่น 1000)
            </div>

            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTab('file')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition-colors',
                  tab === 'file' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                <HiOutlineArrowUpTray size={14} />
                ไฟล์ CSV / Excel
              </button>
              <button
                type="button"
                onClick={() => setTab('sheet')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition-colors',
                  tab === 'sheet' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700',
                )}
              >
                <HiLink size={14} />
                Google Sheet
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void downloadTuitionDataTemplate()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                <HiArrowDownTray size={14} />
                ดาวน์โหลดเทมเพลต
              </button>
            </div>

            {tab === 'file' ? (
              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsing || isImporting}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 transition-colors hover:bg-slate-100/80 disabled:opacity-50"
                >
                  <HiOutlineArrowUpTray size={24} className="text-slate-400" />
                  <span className="text-xs font-bold text-slate-600">
                    {isParsing ? 'กำลังอ่านไฟล์...' : 'คลิกเพื่อเลือกไฟล์ .xlsx, .xls หรือ .csv'}
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => void handleFileChange(e)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => void handleFetchSheet()}
                  disabled={isParsing || isImporting || !sheetUrl.trim()}
                  className="h-9 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {isParsing ? 'กำลังดึงข้อมูล...' : 'ดึงข้อมูลจาก Google Sheet'}
                </button>
                <p className="text-[10px] font-semibold text-slate-400">
                  ตั้งค่าแชร์ Google Sheet เป็น &quot;ทุกคนที่มีลิงก์&quot; ก่อนดึงข้อมูล
                </p>
              </div>
            )}

            {fileName && rows.length > 0 && (
              <p className="text-[11px] font-semibold text-slate-500">
                แหล่งข้อมูล: <span className="text-slate-700">{fileName}</span>
              </p>
            )}

            {rows.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">พร้อมนำเข้า</p>
                  <p className="text-sm font-black text-emerald-600">{readyRows.length}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ผิดพลาด</p>
                  <p className="text-sm font-black text-rose-600">{errorRows.length}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">มีทุน</p>
                  <p className="text-sm font-black text-blue-600">{scholarshipCount}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ยอดชำระรวม</p>
                  <p className="text-sm font-black text-slate-800">{formatTHB(totalPayment)}</p>
                </div>
              </div>
            )}

            {warningRows.length > 0 && (
              <p className="text-[11px] font-semibold text-amber-600">
                มี {warningRows.length} รายการที่มีคำเตือน (เช่น ชื่อไม่ตรง / ชำระบางส่วน) แต่ยังนำเข้าได้
              </p>
            )}

            {rows.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="px-3 py-2">แถว</th>
                        <th className="px-3 py-2">รหัส</th>
                        <th className="px-3 py-2">นักเรียน</th>
                        <th className="px-3 py-2">ทุน</th>
                        <th className="px-3 py-2 text-right">ยอด</th>
                        <th className="px-3 py-2">วันที่</th>
                        <th className="px-3 py-2">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={`${row.rowIndex}-${row.studentCode}`} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-400">{row.rowIndex}</td>
                          <td className="px-3 py-2 font-semibold text-slate-700">{row.studentCode || '—'}</td>
                          <td className="px-3 py-2 text-slate-600">{row.studentName || '—'}</td>
                          <td className="px-3 py-2 text-blue-600">
                            {row.scholarship
                              ? `${row.scholarship.label} (${row.scholarship.type === 'percentage' ? `${row.scholarship.value}%` : formatTHB(row.scholarship.value)})`
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                            {row.paymentAmount > 0 ? formatTHB(row.paymentAmount) : '—'}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-slate-500">{row.paymentDate}</td>
                          <td className="px-3 py-2">
                            {row.status === 'ready' && (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">พร้อม</span>
                            )}
                            {row.status === 'warning' && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600" title={row.message}>
                                เตือน
                              </span>
                            )}
                            {row.status === 'error' && (
                              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600" title={row.message}>
                                ผิดพลาด
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {errorRows.length > 0 && (
              <div className="space-y-1 rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2">
                <p className="flex items-center gap-1 text-[11px] font-bold text-rose-600">
                  <HiOutlineExclamationTriangle size={13} />
                  รายการที่นำเข้าไม่ได้ ({errorRows.length})
                </p>
                {errorRows.slice(0, 5).map((row) => (
                  <p key={`err-${row.rowIndex}`} className="text-[10px] font-semibold text-rose-500">
                    แถว {row.rowIndex}: {row.message}
                  </p>
                ))}
              </div>
            )}

            {importResult && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
                <HiCheckCircle size={16} className="mt-0.5 shrink-0 text-emerald-600" />
                <p className="text-xs font-bold text-emerald-700">
                  นำเข้าสำเร็จ {importResult.succeeded} รายการ
                  {importResult.failed > 0 ? ` · ล้มเหลว ${importResult.failed} รายการ` : ''}
                </p>
              </div>
            )}

            {error && (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{error}</p>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={isImporting || readyRows.length === 0}
              className="h-10 w-full rounded-xl bg-blue-600 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isImporting
                ? 'กำลังนำเข้าข้อมูล...'
                : `นำเข้า ${readyRows.length > 0 ? `${readyRows.length} รายการ` : ''}`}
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
