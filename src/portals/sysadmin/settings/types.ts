export interface TermDates {
  startDate: string;  // วันเปิดภาคเรียน
  endDate: string;    // วันปิดภาคเรียน
}

// แผนที่เก็บข้อมูล: [departmentId] -> [termNumber] -> TermDates
export type DepartmentTermMap = Record<string, Record<number, TermDates>>;

export interface AcademicYear {
  id: string;
  year: string;              // เช่น "2567"
  label: string;             // เช่น "ปีการศึกษา 2567"
  startDate: string;         // วันเริ่มปีการศึกษา (ภาพรวม)
  endDate: string;           // วันสิ้นสุดปีการศึกษา (ภาพรวม)
  isActive: boolean;
  termCount: 2 | 3;
  activeSemester: 1 | 2 | 3;
  departmentDates?: DepartmentTermMap; // วันปิด-เปิด แยกตามแผนก
}

export interface SettingsTab {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
}
