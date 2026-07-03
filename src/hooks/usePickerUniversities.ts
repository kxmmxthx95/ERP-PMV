import { useMemo } from 'react';
import { buildPickerUniversities } from '@/data/universityBridge';
import { useMytcasCatalog } from '@/hooks/useMytcasCatalog';

/** University list for pickers: MyTCAS TCAS69 (82) + Hipo-only extras */
export function usePickerUniversities() {
  const { universities, meta, isLoading, error } = useMytcasCatalog();
  const pickerUniversities = useMemo(
    () => buildPickerUniversities(universities),
    [universities],
  );

  return { pickerUniversities, meta, isLoading, error, mytcasUniversities: universities };
}
