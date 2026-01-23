import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useUserApprovalStatus = () => {
  const { user } = useAuth();

  const { data: hasRole, isLoading } = useQuery({
    queryKey: ["user-approval-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;

      const { data, error } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error checking user role:", error);
        return false;
      }

      return !!data;
    },
    enabled: !!user?.id,
  });

  return {
    hasRole: hasRole ?? false,
    isLoading,
  };
};
