export type UserStatus = 'active' | 'inactive';

export interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  status: UserStatus;
  lastLogin: string;
  department?: string;
}