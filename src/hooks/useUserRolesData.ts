import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  role_id: string | null;
  display_name: string | null;
  created_at: string | null;
}

interface UserInfo {
  email: string;
  name: string | null;
  avatar_url: string | null;
}

interface RolesWithUsers {
  roles: UserRole[];
  usersInfo: Record<string, UserInfo>;
}

export const useUserRolesData = (isAdmin: boolean) => {
  return useQuery({
    queryKey: ["user-roles"],
    queryFn: async (): Promise<RolesWithUsers> => {
      // Fetch roles first
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("*")
        .order("created_at", { ascending: false });

      if (rolesError) throw rolesError;
      
      let usersInfo: Record<string, UserInfo> = {};
      
      // Fetch ALL users from auth
      try {
        const { data, error } = await supabase.functions.invoke("get-users-info", {
          body: { fetch_all: true },
        });

        if (!error && data?.users) {
          usersInfo = data.users;
        }
      } catch (error) {
        console.error("Failed to fetch users info:", error);
      }
      
      return { roles: rolesData || [], usersInfo };
    },
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useAddRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role, roleId }: { userId: string; role: AppRole; roleId?: string }) => {
      const { error } = await supabase.from("user_roles").insert([{
        user_id: userId,
        role,
        role_id: roleId || null,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role added successfully");
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};

export const useUpdateRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, role, roleId }: { id: string; role?: AppRole; roleId?: string }) => {
      const updates: Record<string, unknown> = {};
      if (role !== undefined) updates.role = role;
      if (roleId !== undefined) updates.role_id = roleId;
      
      const { error } = await supabase
        .from("user_roles")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};

export const useUpdateDisplayName = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, displayName }: { id: string; displayName: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ display_name: displayName })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Display name updated");
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};

export const useDeleteRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role deleted");
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};
