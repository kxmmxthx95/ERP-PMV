import { useSyncExternalStore, useMemo } from 'react';
import { getClassesByYearStore, getHomeroomClassesStore } from '@/lib/firestoreShared/studentSummaryStore';
import { useAuth } from '@/hooks/useAuth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ClassOption {
  id: string;
  className: string;
}

export function ClassSelect({
  value,
  onChange,
  academicYearId,
}: {
  value: string | null;
  onChange: (classId: string, className: string) => void;
  academicYearId: string;
}) {
  const { role, user } = useAuth();
  const isAdmin = role === 'sysadmin' || role === 'admin';
  const uid = user?.uid ?? '';
  // ponytail: homeroom-only scope for teachers/other roles — subject-teacher scope can be
  // added when requested. Scoped at query level now instead of fetching the whole-school
  // classes collection and filtering client-side.
  const store = isAdmin
    ? getClassesByYearStore(academicYearId)
    : getHomeroomClassesStore(academicYearId, uid ? [uid] : []);
  const classes = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  const options = useMemo((): ClassOption[] => {
    return classes
      .map((c) => ({ id: c.id, className: String(c.className ?? c.id) }))
      .sort((a, b) => a.className.localeCompare(b.className, 'th', { numeric: true }));
  }, [classes]);

  return (
    <Select
      value={value ?? undefined}
      onValueChange={(id) => {
        const opt = options.find((o) => o.id === id);
        if (opt) onChange(opt.id, opt.className);
      }}
    >
      <SelectTrigger className="w-full sm:w-56">
        <SelectValue placeholder="เลือกห้องเรียน" />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.id} value={opt.id}>{opt.className}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
