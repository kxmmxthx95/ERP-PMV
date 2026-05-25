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
  lineToken?: string;
  deviceId?: string;
  studentCode?: string;
}