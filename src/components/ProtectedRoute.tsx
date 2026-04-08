import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserApprovalStatus } from "@/hooks/useUserApprovalStatus";
import { useUserPermissions, RolePermissions } from "@/hooks/useUserPermissions";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: keyof RolePermissions;
}

const ProtectedRoute = ({ children, requiredPermission }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const { hasRole, isLoading: roleLoading } = useUserApprovalStatus();
  const { permissions, isAdmin, isLoading: permLoading } = useUserPermissions();

  if (loading || roleLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!hasRole) {
    return <Navigate to="/pending-approval" replace />;
  }

  if (requiredPermission && !isAdmin && !permissions[requiredPermission]) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
