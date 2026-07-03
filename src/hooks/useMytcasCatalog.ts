import { useEffect, useState } from 'react';
import {
  getMytcasCatalogSync,
  getMytcasMetaSync,
  loadMytcasCatalog,
  type MytcasMeta,
  type MytcasUniversity,
} from '@/data/mytcasUniversities';

export function useMytcasCatalog() {
  const [universities, setUniversities] = useState<MytcasUniversity[]>(() => getMytcasCatalogSync());
  const [meta, setMeta] = useState<MytcasMeta | null>(() => getMytcasMetaSync());
  const [isLoading, setIsLoading] = useState(() => getMytcasCatalogSync().length === 0);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (getMytcasCatalogSync().length > 0) {
      setUniversities(getMytcasCatalogSync());
      setMeta(getMytcasMetaSync());
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    loadMytcasCatalog()
      .then((list) => {
        if (cancelled) return;
        setUniversities(list);
        setMeta(getMytcasMetaSync());
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { universities, meta, isLoading, error };
}
