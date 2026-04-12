export interface AcademicYear {
  id: string;
  year: string;              // เช่น "2567"
  label: string;             // เช่น "ปีการศึกษา 2567"
  startDate: string;         // YYYY-MM-DD
  endDate: string;           // YYYY-MM-DD
  isActive: boolean;
  termCount: 2 | 3;
  activeSemester: 1 | 2 | 3; // ภาคเรียนที่ใช้งาน (1, 2, หรือ 3)
}

export interface SettingsTab {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
}
