import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ALL_SPECIAL_CHARS, SPECIAL_CHAR_CATEGORIES } from './specialCharacters';

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (char: string) => void;
}

export default function SpecialCharactersDialog({ open, onClose, onInsert }: Props) {
  const [categoryId, setCategoryId] = useState('all');
  const [search, setSearch] = useState('');

  const chars = useMemo(() => {
    const base = categoryId === 'all'
      ? ALL_SPECIAL_CHARS
      : SPECIAL_CHAR_CATEGORIES.find((cat) => cat.id === categoryId)?.chars ?? ALL_SPECIAL_CHARS;
    const q = search.trim();
    if (!q) return base;
    return base.filter((char) => char.includes(q));
  }, [categoryId, search]);

  const handleInsert = (char: string) => {
    onInsert(char);
    onClose();
    setSearch('');
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
          setSearch('');
        }
      }}
    >
      <DialogContent className="flex max-h-[min(520px,85vh)] max-w-md flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-100 px-4 py-3 text-left">
          <DialogTitle className="font-sukhumvit text-base font-black text-slate-800">
            อักขระพิเศษ
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-36 shrink-0 overflow-y-auto border-r border-slate-100 bg-slate-50/80 p-2 sm:block">
            <button
              type="button"
              onClick={() => setCategoryId('all')}
              className={cn(
                'mb-0.5 w-full rounded-lg px-2.5 py-2 text-left font-sukhumvit text-[11px] font-bold transition-colors',
                categoryId === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-white',
              )}
            >
              ทั้งหมด
            </button>
            {SPECIAL_CHAR_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(cat.id)}
                className={cn(
                  'mb-0.5 w-full rounded-lg px-2.5 py-2 text-left font-sukhumvit text-[11px] font-bold transition-colors',
                  categoryId === cat.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-white',
                )}
              >
                {cat.label}
              </button>
            ))}
          </aside>

          <div className="flex min-w-0 flex-1 flex-col p-3">
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide sm:hidden">
              {[{ id: 'all', label: 'ทั้งหมด' }, ...SPECIAL_CHAR_CATEGORIES].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1 font-sukhumvit text-[10px] font-bold',
                    categoryId === cat.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา"
              className="mb-3 h-9 rounded-xl border-slate-200 font-sarabun text-sm"
            />

            {chars.length === 0 ? (
              <p className="py-8 text-center font-sarabun text-sm text-slate-400">ไม่พบอักขระ</p>
            ) : (
              <div className="grid min-h-0 flex-1 grid-cols-8 gap-1 overflow-y-auto sm:grid-cols-9">
                {chars.map((char, index) => (
                  <button
                    key={`${char}-${index}`}
                    type="button"
                    onClick={() => handleInsert(char)}
                    className="flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white font-sarabun text-lg text-slate-800 transition-colors hover:border-blue-400 hover:bg-blue-50"
                    title={char}
                  >
                    {char}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
