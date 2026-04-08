import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RolePermissions {
  canExportCustomers: boolean;
  canExportTraffic: boolean;
  canExportAds: boolean;
  canViewFacebookPages: boolean;
  canViewMondayImport: boolean;
  canViewUserRoles: boolean;
  canManageRoles: boolean;
  canViewChat: boolean;
  canViewCustomers: boolean;
  canViewTraffic: boolean;
  canViewAdsInsight: boolean;
  canViewDocs: boolean;
  canViewDashboard: boolean;
}

export interface RoleData {
  id: string;
  name: string;
  color: string;
  permissions: RolePermissions;
  priority: number;
  is_system: boolean;
}

interface UserPermissionsResult {
  role: RoleData | null;
  displayName: string | null;
  permissions: RolePermissions;
  isAdmin: boolean;
  isLoading: boolean;
}

const defaultPermissions: RolePermissions = {
  canExportCustomers: false,
  canExportTraffic: false,
  canExportAds: false,
  canViewFacebookPages: false,
  canViewMondayImport: false,
  canViewUserRoles: false,
  canManageRoles: false,
};

export const useUserPermissions = (): UserPermissionsResult => {
  const { user } = useAuth();
  const [role, setRole] = useState<RoleData | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserPermissions = async () => {
      if (!user) {
        setRole(null);
        setDisplayName(null);
        setIsLoading(false);
        return;
      }

      try {
        // Fetch user_roles with role_id and display_name
        const { data: userRole, error: userRoleError } = await supabase
          .from("user_roles")
          .select("display_name, role_id, role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (userRoleError) {
          console.error("Error fetching user role:", userRoleError);
          setIsLoading(false);
          return;
        }

        if (!userRole) {
          // User has no role assigned
          setRole(null);
          setDisplayName(null);
          setIsLoading(false);
          return;
        }

        setDisplayName(userRole.display_name);

        // If role_id exists, fetch the role with permissions
        if (userRole.role_id) {
          const { data: roleData, error: roleError } = await supabase
            .from("roles")
            .select("*")
            .eq("id", userRole.role_id)
            .single();

          if (roleError) {
            console.error("Error fetching role:", roleError);
          } else if (roleData) {
            setRole({
              id: roleData.id,
              name: roleData.name,
              color: roleData.color || '#6366f1',
              permissions: (roleData.permissions as unknown as RolePermissions) || defaultPermissions,
              priority: roleData.priority,
              is_system: roleData.is_system,
            });
          }
        } else {
          // Fallback: use the old app_role enum to determine permissions
          // Admin gets full permissions, others get none
          const isAdminByOldRole = userRole.role === 'admin';
          if (isAdminByOldRole) {
            // Fetch Admin role from roles table
            const { data: adminRole } = await supabase
              .from("roles")
              .select("*")
              .eq("name", "Admin")
              .single();
            
            if (adminRole) {
              setRole({
                id: adminRole.id,
                name: adminRole.name,
                color: adminRole.color || '#ef4444',
                permissions: adminRole.permissions as unknown as RolePermissions,
                priority: adminRole.priority,
                is_system: adminRole.is_system,
              });
            }
          } else {
            // Fetch Staff role from roles table
            const { data: staffRole } = await supabase
              .from("roles")
              .select("*")
              .eq("name", "Staff")
              .single();
            
            if (staffRole) {
              setRole({
                id: staffRole.id,
                name: staffRole.name,
                color: staffRole.color || '#6b7280',
                permissions: staffRole.permissions as unknown as RolePermissions,
                priority: staffRole.priority,
                is_system: staffRole.is_system,
              });
            }
          }
        }
      } catch (err) {
        console.error("Error in useUserPermissions:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserPermissions();
  }, [user]);

  const permissions = role?.permissions || defaultPermissions;
  const isAdmin = role?.name === 'Admin' || permissions.canManageRoles;

  return {
    role,
    displayName,
    permissions,
    isAdmin,
    isLoading,
  };
};
