import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FingerprintStaffUser } from '../types';

type Props = {
  users: FingerprintStaffUser[];
  isLoading: boolean;
  onSaveTemplate: (uid: string, templateId: number | null) => Promise<void>;
  isUpdating: boolean;
};

export default function FingerprintTemplatePanel({
  users,
  isLoading,
  onSaveTemplate,
  isUpdating,
}: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');

  const filtered = users.filter((u) =>
    u.displayName.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">
            ผูกลายนิ้วกับผู้ใช้
          </h3>
          <p className="text-[11px] text-slate-500">fingerprintTemplateId ใน users — slot AS608 (1–127)</p>
        </div>
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="ค้นหาชื่อ..."
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">กำลังโหลด...</p>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2 font-semibold">ชื่อ</th>
                <th className="px-3 py-2 font-semibold">บทบาท</th>
                <th className="px-3 py-2 font-semibold">Template ID</th>
                <th className="px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const value = draft[u.uid] ?? (u.fingerprintTemplateId?.toString() ?? '');
                return (
                  <tr key={u.uid} className="border-t border-slate-50">
                    <td className="px-3 py-2 font-medium text-slate-800">{u.displayName}</td>
                    <td className="px-3 py-2 text-slate-500">{u.role}</td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={1}
                        max={127}
                        value={value}
                        onChange={(e) => setDraft((d) => ({ ...d, [u.uid]: e.target.value }))}
                        className="h-8 w-20 font-mono text-xs"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => {
                          const trimmed = value.trim();
                          void onSaveTemplate(
                            u.uid,
                            trimmed ? Number(trimmed) : null,
                          ).then(() =>
                            setDraft((d) => {
                              const next = { ...d };
                              delete next[u.uid];
                              return next;
                            }),
                          );
                        }}
                        className={cn(
                          'rounded-lg px-2.5 py-1 text-xs font-semibold',
                          value !== (u.fingerprintTemplateId?.toString() ?? '')
                            ? 'bg-sky-600 text-white'
                            : 'text-slate-400',
                        )}
                      >
                        บันทึก
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
