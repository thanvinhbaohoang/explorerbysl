import { useUserRole } from "@/hooks/useUserRole";
import { useUserRolesData, useAddRole, useUpdateRole, useDeleteRole } from "@/hooks/useUserRolesData";
import { Button } from "@/components/ui/button";
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
import { Trash2, Shield, Download, Clock, UserCheck } from "lucide-react";
import { exportToCSV } from "@/lib/csv-export";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const UserRoles = () => {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { data, isLoading: loading } = useUserRolesData(isAdmin);
  const addRoleMutation = useAddRole();
  const updateRoleMutation = useUpdateRole();
  const deleteRoleMutation = useDeleteRole();

  const roles = data?.roles || [];
  const usersInfo = data?.usersInfo || {};

  // Create a map of user_id -> role for quick lookup
  const userRolesMap = roles.reduce((acc, role) => {
    acc[role.user_id] = role;
    return acc;
  }, {} as Record<string, typeof roles[0]>);

  // Get all users (from usersInfo) and merge with their roles
  const allUsers = Object.entries(usersInfo).map(([userId, info]) => ({
    userId,
    ...info,
    role: userRolesMap[userId] || null,
  }));

  // Separate pending users (no role) from approved users (have role)
  const pendingUsers = allUsers.filter(u => !u.role);
  const approvedUsers = allUsers.filter(u => u.role);

  const updateRole = async (userId: string, existingRoleId: string | null, newRoleValue: AppRole) => {
    if (existingRoleId) {
      updateRoleMutation.mutate({ id: existingRoleId, role: newRoleValue });
    } else {
      // Create new role for user
      addRoleMutation.mutate({ userId, role: newRoleValue });
    }
  };

  const deleteRole = async (id: string) => {
    deleteRoleMutation.mutate(id);
  };

  const getRoleBadgeVariant = (role: AppRole | null) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "moderator":
        return "default";
      case "user":
        return "secondary";
      default:
        return "outline";
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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Roles Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage user roles and permissions
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            exportToCSV(
              allUsers,
              [
                { key: 'name', header: 'Name', getValue: (u) => u.name || 'Unknown User' },
                { key: 'email', header: 'Email' },
                { key: 'role', header: 'Role', getValue: (u) => u.role?.role || 'Pending' },
              ],
              'user_roles'
            );
          }}
          disabled={allUsers.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Pending Users Section */}
      {pendingUsers.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold">Pending Approval ({pendingUsers.length})</h2>
          </div>
          <div className="bg-warning/10 border border-warning/30 rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Assign Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>
                            {getInitials(user.name, user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {user.name || "Unknown User"}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value="none"
                        onValueChange={(v) => {
                          if (v !== "none") {
                            updateRole(user.userId, null, v as AppRole);
                          }
                        }}
                      >
                        <SelectTrigger className="w-36">
                          <Badge variant="outline" className="border-warning text-warning">
                            Pending
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" disabled>
                            Select role...
                          </SelectItem>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Approved Users Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <UserCheck className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Approved Users ({approvedUsers.length})</h2>
        </div>
        <div className="bg-card border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : approvedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    No approved users yet
                  </TableCell>
                </TableRow>
              ) : (
                approvedUsers.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>
                            {getInitials(user.name, user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {user.name || "Unknown User"}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.role?.role || "none"}
                        onValueChange={(v) => {
                          if (v === "none") {
                            if (user.role?.id) {
                              deleteRole(user.role.id);
                            }
                          } else {
                            updateRole(user.userId, user.role?.id || null, v as AppRole);
                          }
                        }}
                      >
                        <SelectTrigger className="w-36">
                          <Badge variant={getRoleBadgeVariant(user.role?.role || null)}>
                            {user.role?.role || "No Role"}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <Badge variant="outline">No Role</Badge>
                          </SelectItem>
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
                    <TableCell>
                      {user.role && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteRole(user.role!.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default UserRoles;
