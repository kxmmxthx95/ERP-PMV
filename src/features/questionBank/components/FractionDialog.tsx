import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  buildFractionHtml,
  buildMixedFractionHtml,
  buildNestedFractionHtml,
  FRACTION_EDITOR_CSS,
  getFractionDialogTitle,
  isValidFractionInput,
  isValidMixedFractionInput,
  isValidNestedFractionInput,
  type FractionMode,
} from './fractionHtml';

interface Props {
  open: boolean;
  mode: FractionMode;
  onClose: () => void;
  onInsert: (html: string) => void;
}

function StackedPreview({ numerator, denominator, small = false }: { numerator: string; denominator: string; small?: boolean }) {
  if (!isValidFractionInput(numerator, denominator)) return null;
  return (
    <span className={cn('rte-fraction', small && 'rte-fraction-sm')}>
      <span className="rte-fraction-num">{numerator.trim()}</span>
      <span className="rte-fraction-den">{denominator.trim()}</span>
    </span>
  );
}

function FractionPreview({
  mode,
  whole,
  numerator,
  denominator,
  numNumerator,
  numDenominator,
  denNumerator,
  denDenominator,
}: {
  mode: FractionMode;
  whole: string;
  numerator: string;
  denominator: string;
  numNumerator: string;
  numDenominator: string;
  denNumerator: string;
  denDenominator: string;
}) {
  const preview = useMemo(() => {
    if (mode === 'mixed' && isValidMixedFractionInput(whole, numerator, denominator)) {
      return (
        <span className="rte-fraction-mixed">
          <span className="rte-fraction-whole">{whole.trim()}</span>
          <StackedPreview numerator={numerator} denominator={denominator} />
        </span>
      );
    }
    if (mode === 'nested' && isValidNestedFractionInput(numNumerator, numDenominator, denNumerator, denDenominator)) {
      return (
        <span className="rte-fraction-nested">
          <StackedPreview numerator={numNumerator} denominator={numDenominator} small />
          <span className="rte-fraction-nested-bar" />
          <StackedPreview numerator={denNumerator} denominator={denDenominator} small />
        </span>
      );
    }
    if (mode === 'simple' && isValidFractionInput(numerator, denominator)) {
      return <StackedPreview numerator={numerator} denominator={denominator} />;
    }
    return null;
  }, [mode, whole, numerator, denominator, numNumerator, numDenominator, denNumerator, denDenominator]);

  return (
    <div className="flex min-h-[4.5rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-3">
      {preview ?? (
        <span className="font-sarabun text-sm text-slate-400">ตัวอย่างเศษส่วน</span>
      )}
    </div>
  );
}

export default function FractionDialog({ open, mode, onClose, onInsert }: Props) {
  const [whole, setWhole] = useState('');
  const [numerator, setNumerator] = useState('');
  const [denominator, setDenominator] = useState('');
  const [numNumerator, setNumNumerator] = useState('');
  const [numDenominator, setNumDenominator] = useState('');
  const [denNumerator, setDenNumerator] = useState('');
  const [denDenominator, setDenDenominator] = useState('');

  useEffect(() => {
    if (!open) return;
    setWhole('');
    setNumerator('');
    setDenominator('');
    setNumNumerator('');
    setNumDenominator('');
    setDenNumerator('');
    setDenDenominator('');
  }, [open, mode]);

  const canInsert = useMemo(() => {
    if (mode === 'mixed') return isValidMixedFractionInput(whole, numerator, denominator);
    if (mode === 'nested') {
      return isValidNestedFractionInput(numNumerator, numDenominator, denNumerator, denDenominator);
    }
    return isValidFractionInput(numerator, denominator);
  }, [mode, whole, numerator, denominator, numNumerator, numDenominator, denNumerator, denDenominator]);

  const handleInsert = () => {
    if (!canInsert) return;
    const html = mode === 'mixed'
      ? buildMixedFractionHtml(whole, numerator, denominator)
      : mode === 'nested'
        ? buildNestedFractionHtml(numNumerator, numDenominator, denNumerator, denDenominator)
        : buildFractionHtml(numerator, denominator);
    if (!html) return;
    onInsert(html);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-100 px-4 py-3 text-left">
          <DialogTitle className="font-sukhumvit text-base font-black text-slate-800">
            {getFractionDialogTitle(mode)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 px-4 py-4">
          {mode === 'mixed' && (
            <label className="block space-y-1">
              <span className="font-sukhumvit text-[10px] font-black uppercase tracking-wider text-slate-400">
                จำนวนเต็ม
              </span>
              <Input
                value={whole}
                onChange={(e) => setWhole(e.target.value)}
                placeholder="เช่น 2"
                className="h-10 rounded-xl font-sarabun"
                autoFocus
              />
            </label>
          )}

          {mode === 'nested' ? (
            <div className="space-y-3">
              <p className="font-sukhumvit text-[10px] font-black uppercase tracking-wider text-slate-400">
                ตัวเศษ (ด้านบน)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={numNumerator}
                  onChange={(e) => setNumNumerator(e.target.value)}
                  placeholder="ตัวเศษบน"
                  className="h-10 rounded-xl font-sarabun"
                  autoFocus
                />
                <Input
                  value={numDenominator}
                  onChange={(e) => setNumDenominator(e.target.value)}
                  placeholder="ตัวส่วนบน"
                  className="h-10 rounded-xl font-sarabun"
                />
              </div>
              <p className="font-sukhumvit text-[10px] font-black uppercase tracking-wider text-slate-400">
                ตัวส่วน (ด้านล่าง)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  value={denNumerator}
                  onChange={(e) => setDenNumerator(e.target.value)}
                  placeholder="ตัวเศษล่าง"
                  className="h-10 rounded-xl font-sarabun"
                />
                <Input
                  value={denDenominator}
                  onChange={(e) => setDenDenominator(e.target.value)}
                  placeholder="ตัวส่วนล่าง"
                  className="h-10 rounded-xl font-sarabun"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canInsert) {
                      e.preventDefault();
                      handleInsert();
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="font-sukhumvit text-[10px] font-black uppercase tracking-wider text-slate-400">
                  ตัวเศษ
                </span>
                <Input
                  value={numerator}
                  onChange={(e) => setNumerator(e.target.value)}
                  placeholder="เช่น 1 หรือ x+1"
                  className="h-10 rounded-xl font-sarabun"
                  autoFocus={mode !== 'mixed'}
                />
              </label>
              <label className="space-y-1">
                <span className="font-sukhumvit text-[10px] font-black uppercase tracking-wider text-slate-400">
                  ตัวส่วน
                </span>
                <Input
                  value={denominator}
                  onChange={(e) => setDenominator(e.target.value)}
                  placeholder="เช่น 2 หรือ 3y"
                  className="h-10 rounded-xl font-sarabun"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canInsert) {
                      e.preventDefault();
                      handleInsert();
                    }
                  }}
                />
              </label>
            </div>
          )}

          <FractionPreview
            mode={mode}
            whole={whole}
            numerator={numerator}
            denominator={denominator}
            numNumerator={numNumerator}
            numDenominator={numDenominator}
            denNumerator={denNumerator}
            denDenominator={denDenominator}
          />
        </div>

        <DialogFooter className="border-t border-slate-100 px-4 py-3">
          <Button type="button" variant="ghost" onClick={onClose} className="rounded-xl font-sukhumvit font-bold">
            ยกเลิก
          </Button>
          <Button
            type="button"
            disabled={!canInsert}
            onClick={handleInsert}
            className="rounded-xl bg-slate-900 font-sukhumvit font-bold text-white hover:bg-slate-800"
          >
            แทรก
          </Button>
        </DialogFooter>
        <style>{FRACTION_EDITOR_CSS}</style>
      </DialogContent>
    </Dialog>
  );
}
