import { useAuth } from '@/hooks/useAuth';

interface ProtectedWidgetProps {
  allowedRoles: string[];
  children: React.ReactNode;
}

export default function ProtectedWidget({ allowedRoles, children }: ProtectedWidgetProps) {
  const { role } = useAuth();
  if (!role) return null;
  if (role !== 'sysadmin' && !allowedRoles.includes(role)) return null;
  return <>{children}</>;
}
