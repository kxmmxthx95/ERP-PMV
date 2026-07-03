import { useAuth } from '@/hooks/useAuth';
import TaskCommandCenter from './TaskCommandCenter';
import MyTaskInbox from './MyTaskInbox';

export default function TasksPage() {
  const { role } = useAuth();

  if (role === 'admin' || role === 'sysadmin') {
    return <TaskCommandCenter />;
  }

  return <MyTaskInbox />;
}
