import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const KEY = ['classroom-behavior-config'];
const ref = () => doc(db, 'system_config', 'classroomBehavior');

/** One-shot read (no realtime listener). Excluded subjects are matched by trimmed name. */
export function useClassroomBehaviorConfig() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: async () => ((await getDoc(ref())).data()?.excludedSubjects ?? []) as string[],
    staleTime: 5 * 60_000,
  });
  const excluded = useMemo(() => new Set(data ?? []), [data]);

  const save = useCallback(async (excludedSubjects: string[]) => {
    await setDoc(ref(), { excludedSubjects, updatedAt: new Date().toISOString() });
    qc.setQueryData(KEY, excludedSubjects);
  }, [qc]);

  return { excluded, save };
}
