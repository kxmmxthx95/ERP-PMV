export interface UniversityLogoRecord {
  domain: string;
  name?: string;
  logoURL: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const UNIVERSITY_LOGOS_COLLECTION = 'university_logos';
