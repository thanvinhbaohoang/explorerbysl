import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RolePermissions } from "./useUserPermissions";
import type { Json } from "@/integrations/supabase/types";

export interface Role {
  id: string;
  name: string;
  color: string;
  permissions: RolePermissions;
  priority: number;
  is_system: boolean;
  created_at: string;
}

export const useRolesData = () => {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async (): Promise<Role[]> => {
      const { data, error } = await supabase
        .from("roles")
        .select("*")
        .order("priority", { ascending: false });

      if (error) throw error;
      
      return (data || []).map(role => ({
        ...role,
        permissions: role.permissions as unknown as RolePermissions,
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useCreateRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      name, 
      color, 
      permissions, 
      priority 
    }: { 
      name: string; 
      color: string; 
      permissions: RolePermissions; 
      priority: number;
    }) => {
      const { error } = await supabase.from("roles").insert([{
        name,
        color,
        permissions: permissions as unknown as Json,
        priority,
        is_system: false,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role created successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};

export const useUpdateRolePermissions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      permissions 
    }: { 
      id: string; 
      permissions: RolePermissions;
    }) => {
      const { error } = await supabase
        .from("roles")
        .update({ permissions: permissions as unknown as Json })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role permissions updated");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
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
    mutationFn: async ({ 
      id, 
      name,
      color,
      permissions,
      priority,
    }: { 
      id: string; 
      name?: string;
      color?: string;
      permissions?: RolePermissions;
      priority?: number;
    }) => {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (color !== undefined) updates.color = color;
      if (permissions !== undefined) updates.permissions = permissions;
      if (priority !== undefined) updates.priority = priority;

      const { error } = await supabase
        .from("roles")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
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
      const { error } = await supabase.from("roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role deleted");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};
