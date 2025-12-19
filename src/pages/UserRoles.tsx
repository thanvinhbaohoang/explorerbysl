import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plus, Shield, User } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string | null;
}

interface UserInfo {
  email: string;
  name: string | null;
  avatar_url: string | null;
}

const UserRoles = () => {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [usersInfo, setUsersInfo] = useState<Record<string, UserInfo>>({});
  const [loading, setLoading] = useState(true);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("user");

  const fetchUsersInfo = async (userIds: string[]) => {
    if (userIds.length === 0) return;

    try {
      const { data, error } = await supabase.functions.invoke("get-users-info", {
        body: { user_ids: userIds },
      });

      if (error) throw error;
      setUsersInfo(data.users || {});
    } catch (error) {
      console.error("Failed to fetch users info:", error);
    }
  };

  const fetchRoles = async () => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to fetch roles");
      return;
    }
    
    setRoles(data || []);
    setLoading(false);

    const userIds = data?.map((r) => r.user_id) || [];
    if (userIds.length > 0) {
      fetchUsersInfo(userIds);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchRoles();
    }
  }, [isAdmin]);

  const addRole = async () => {
    if (!newUserId.trim()) {
      toast.error("Please enter a user ID");
      return;
    }

    const { error } = await supabase.from("user_roles").insert({
      user_id: newUserId.trim(),
      role: newRole,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Role added successfully");
    setNewUserId("");
    fetchRoles();
  };

  const updateRole = async (id: string, newRoleValue: AppRole) => {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRoleValue })
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Role updated");
    setRoles((prev) =>
      prev.map((r) => (r.id === id ? { ...r, role: newRoleValue } : r))
    );
  };

  const deleteRole = async (id: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Role deleted");
    fetchRoles();
  };

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "moderator":
        return "default";
      default:
        return "secondary";
    }
  };

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (roleLoading) {
    return (
      <div className="container py-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container py-8">
        <div className="flex flex-col items-center justify-center py-12">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            You don't have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">User Roles Management</h1>
        <p className="text-muted-foreground mt-2">
          Manage user roles and permissions
        </p>
      </div>

      <div className="bg-card border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Add New Role</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">User ID</label>
            <Input
              placeholder="Enter user UUID"
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
            />
          </div>
          <div className="w-40">
            <label className="text-sm font-medium mb-2 block">Role</label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addRole}>
            <Plus className="h-4 w-4 mr-2" />
            Add Role
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No roles found
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => {
                const userInfo = usersInfo[role.user_id];
                return (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={userInfo?.avatar_url || undefined} />
                          <AvatarFallback>
                            {userInfo ? (
                              getInitials(userInfo.name, userInfo.email)
                            ) : (
                              <User className="h-4 w-4" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {userInfo?.name || "Unknown User"}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {userInfo?.email || role.user_id}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={role.role}
                        onValueChange={(v) => updateRole(role.id, v as AppRole)}
                      >
                        <SelectTrigger className="w-32">
                          <Badge variant={getRoleBadgeVariant(role.role)}>
                            {role.role}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">
                            <Badge variant="secondary">user</Badge>
                          </SelectItem>
                          <SelectItem value="moderator">
                            <Badge variant="default">moderator</Badge>
                          </SelectItem>
                          <SelectItem value="admin">
                            <Badge variant="destructive">admin</Badge>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {role.created_at
                        ? new Date(role.created_at).toLocaleDateString()
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteRole(role.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UserRoles;
