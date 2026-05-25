import { useAuth } from "@/contexts/AuthContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";

/**
 * Returns the best available display name for the current user.
 * Fallback chain:
 *   user_roles.display_name → user_metadata.full_name/name → email prefix → 'Employee'
 */
export const useCurrentUserName = (fallback: string = "Employee"): string => {
  const { user } = useAuth();
  const { displayName } = useUserPermissions();

  if (displayName && displayName.trim()) return displayName.trim();

  const metaName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined);
  if (metaName && metaName.trim()) return metaName.trim();

  const emailPrefix = user?.email?.split("@")[0];
  if (emailPrefix) return emailPrefix;

  return fallback;
};
