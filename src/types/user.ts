export type UserStatus = 'active' | 'inactive';

export interface UserData {
  id: string;
  name: string;
  displayName?: string;
  prefix?: string;
  firstName?: string;
  lastName?: string;
  firstNameEn?: string;
  lastNameEn?: string;
  email: string;
  role: string;
  status: UserStatus;
  phone?: string;
  lastLogin?: string;
  department?: string;
  isActive?: boolean;
  createdAt?: any;
  photoURL?: string;
  lineUid?: string;
  lineToken?: string;
  lineLinkedAt?: unknown;
  deviceId?: string;
  /** AS608 template slot (1–127) — ใช้จับคู่กับลายนิ้วมือบนบอร์ด ESP32 */
  fingerprintTemplateId?: number;
  studentCode?: string;
}