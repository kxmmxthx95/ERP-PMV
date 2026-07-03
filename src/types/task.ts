export type TaskPriority = 'normal' | 'urgent' | 'critical';
export type TaskStatus = 'pending' | 'in-progress' | 'done';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId: string;
  assigneeName: string;
  createdBy: string;
  createdByName: string;
  dueDate: string; // "YYYY-MM-DD"
  completedAt?: string | null;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  assigneeId: string;
  assigneeName: string;
  dueDate: string;
}
