
export interface AcademicYear {
  id: string;
  year: string;
  activeSemester: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  status: 'active' | 'inactive';
}
