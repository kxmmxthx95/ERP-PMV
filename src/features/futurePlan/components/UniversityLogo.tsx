import { useState, useEffect, useMemo } from 'react';
import { HiOutlineAcademicCap } from 'react-icons/hi2';
import { cn } from '@/lib/utils';
import { fp } from '@/features/futurePlan/futurePlanTheme';
import type { ThaiUniversity } from '@/data/thaiUniversities';
import {
  findUniversityByLabel,
  normalizeUniversityDomain,
  shouldUseGoogleFavicon,
  universityLogoUrls,
} from '@/data/thaiUniversities';
import type { MytcasUniversity } from '@/data/mytcasUniversities';
import {
  findMytcasByDomain,
  findMytcasUniversity,
  getMytcasCatalogSync,
  mytcasLogoUrl,
} from '@/data/mytcasUniversities';
import { useMytcasCatalog } from '@/hooks/useMytcasCatalog';
import { useUniversityLogoMap } from '@/hooks/useUniversityLogos';

interface UniversityLogoProps {
  university?: ThaiUniversity | null;
  mytcas?: MytcasUniversity | null;
  label?: string;
  domain?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function resolveDomain(
  university?: ThaiUniversity | null,
  mytcas?: MytcasUniversity | null,
  label?: string,
  domain?: string | null,
): string | undefined {
  if (domain != null && domain !== '') return domain;
  if (university?.domain) return university.domain;
  if (mytcas?.domain) return mytcas.domain ?? undefined;
  if (label) {
    const fromLabel =
      findUniversityByLabel(label)?.domain ??
      findMytcasUniversity(label)?.domain;
    return fromLabel ?? undefined;
  }
  return undefined;
}

function resolveMytcasUniversityId(
  university: ThaiUniversity | null | undefined,
  mytcas: MytcasUniversity | null | undefined,
  label: string | undefined,
  resolvedDomain: string | undefined,
  catalog: MytcasUniversity[],
): string | undefined {
  if (mytcas?.universityId) return mytcas.universityId;
  if (university?.id && /^\d+$/.test(university.id)) return university.id;

  if (label) {
    const byLabel = findMytcasUniversity(label, catalog);
    if (byLabel) return byLabel.universityId;
  }
  if (university?.nameTh) {
    const byTh = findMytcasUniversity(university.nameTh, catalog);
    if (byTh) return byTh.universityId;
  }
  if (resolvedDomain) {
    const byDomain = findMytcasByDomain(resolvedDomain, catalog);
    if (byDomain) return byDomain.universityId;
  }
  return undefined;
}

export function UniversityLogo({
  university,
  mytcas,
  label,
  domain,
  size = 'sm',
  className,
}: UniversityLogoProps) {
  const { universities: mytcasCatalog } = useMytcasCatalog();
  const catalog = mytcasCatalog.length > 0 ? mytcasCatalog : getMytcasCatalogSync();
  const resolvedDomain = resolveDomain(university, mytcas, label, domain);
  const mytcasId = resolveMytcasUniversityId(
    university,
    mytcas,
    label,
    resolvedDomain,
    catalog,
  );
  const { data: logoMap } = useUniversityLogoMap();
  const normalized = resolvedDomain ? normalizeUniversityDomain(resolvedDomain) : undefined;
  const customUrl = normalized ? logoMap?.get(normalized)?.logoURL : undefined;
  const mytcasUrl = mytcasId ? mytcasLogoUrl(mytcasId) : undefined;
  const googleUrl =
    resolvedDomain && !mytcasUrl && shouldUseGoogleFavicon(resolvedDomain)
      ? universityLogoUrls(resolvedDomain, size)[0]
      : undefined;

  const urls = useMemo(() => {
    const list: string[] = [];
    if (customUrl) list.push(customUrl);
    if (mytcasUrl) list.push(mytcasUrl);
    if (googleUrl) list.push(googleUrl);
    return list;
  }, [customUrl, mytcasUrl, googleUrl]);

  const [urlIndex, setUrlIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setUrlIndex(0);
    setExhausted(false);
  }, [normalized, customUrl, mytcasUrl, googleUrl]);

  const logoUrl = urls[urlIndex];
  const showFallback = exhausted || !logoUrl;

  const dim =
    size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-7 h-7' : 'w-14 h-14';
  const iconSize = size === 'sm' ? 14 : size === 'md' ? 18 : 28;
  const radius = size === 'lg' ? 'rounded-xl' : 'rounded-md';

  if (showFallback) {
    return (
      <span
        className={cn(
          dim,
          radius,
          fp.logoFallback,
          className,
        )}
      >
        <HiOutlineAcademicCap size={iconSize} className={fp.logoFallbackIcon} />
      </span>
    );
  }

  return (
    <img
      key={logoUrl}
      src={logoUrl}
      alt=""
      className={cn(dim, radius, 'object-contain bg-white border border-[#E3E7FC] flex-shrink-0', className)}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => {
        if (urlIndex + 1 < urls.length) setUrlIndex((i) => i + 1);
        else setExhausted(true);
      }}
    />
  );
}
