import { useState } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserRolesData, useAddRole, useUpdateRole, useUpdateDisplayName, useDeleteRole } from "@/hooks/useUserRolesData";
import { useRolesData } from "@/hooks/useRolesData";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trash2, Shield, Download, Clock, UserCheck, Users, Settings, Pencil, Check, X } from "lucide-react";
import { exportToCSV } from "@/lib/csv-export";
import { RoleManagementTab } from "@/components/RoleManagementTab";

const UserRoles = () => {
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const { data, isLoading: loading } = useUserRolesData(isAdmin);
  const { data: roles = [] } = useRolesData();
  const addRoleMutation = useAddRole();
  const updateRoleMutation = useUpdateRole();
  const updateDisplayNameMutation = useUpdateDisplayName();
  const deleteRoleMutation = useDeleteRole();
  
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState("");

  const userRoles = data?.roles || [];
  const usersInfo = data?.usersInfo || {};

  // Create a map of user_id -> role for quick lookup
  const userRolesMap = userRoles.reduce((acc, role) => {
    acc[role.user_id] = role;
    return acc;
  }, {} as Record<string, typeof userRoles[0]>);

  // Get all users (from usersInfo) and merge with their roles
  const allUsers = Object.entries(usersInfo).map(([userId, info]) => ({
    userId,
    ...info,
    userRole: userRolesMap[userId] || null,
  }));

  // Separate pending users (no role) from approved users (have role)
  const pendingUsers = allUsers.filter(u => !u.userRole);
  const approvedUsers = allUsers.filter(u => u.userRole);

  const assignRole = async (userId: string, roleId: string) => {
    const selectedRole = roles.find(r => r.id === roleId);
    if (!selectedRole) return;
    
    // Map role name to app_role enum
    const appRole = selectedRole.name === 'Admin' ? 'admin' : 'user';
    addRoleMutation.mutate({ userId, role: appRole, roleId });
  };

  const changeUserRole = async (userRoleId: string, newRoleId: string) => {
    const selectedRole = roles.find(r => r.id === newRoleId);
    if (!selectedRole) return;
    
    const appRole = selectedRole.name === 'Admin' ? 'admin' : 'user';
    updateRoleMutation.mutate({ id: userRoleId, role: appRole, roleId: newRoleId });
  };

  const deleteRole = async (id: string) => {
    deleteRoleMutation.mutate(id);
  };

  const startEditingDisplayName = (userId: string, currentName: string | null) => {
    setEditingUserId(userId);
    setEditingDisplayName(currentName || "");
  };

  const saveDisplayName = (userRoleId: string) => {
    updateDisplayNameMutation.mutate({ 
      id: userRoleId, 
      displayName: editingDisplayName.trim() 
    });
    setEditingUserId(null);
    setEditingDisplayName("");
  };

  const cancelEditingDisplayName = () => {
    setEditingUserId(null);
    setEditingDisplayName("");
  };

  const getRoleBadge = (roleId: string | null) => {
    if (!roleId) return <Badge variant="outline">No Role</Badge>;
    const role = roles.find(r => r.id === roleId);
    if (!role) return <Badge variant="outline">Unknown</Badge>;
    
    return (
      <Badge 
        style={{ 
          backgroundColor: role.color + '20', 
          color: role.color,
          borderColor: role.color 
        }}
        className="border"
      >
        {role.name}
      </Badge>
    );
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
          <h1 className="text-3xl font-bold">User & Role Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage users, roles, and permissions
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
                { key: 'displayName', header: 'Display Name', getValue: (u) => u.userRole?.display_name || '' },
                { key: 'role', header: 'Role', getValue: (u) => {
                  if (!u.userRole?.role_id) return 'Pending';
                  const role = roles.find(r => r.id === u.userRole?.role_id);
                  return role?.name || 'Unknown';
                }},
                { key: 'user_id', header: 'User ID', getValue: (u) => u.userId },
                { key: 'created_at', header: 'Joined', getValue: (u) => u.userRole?.created_at ? new Date(u.userRole.created_at).toLocaleString() : '' },
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

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Settings className="h-4 w-4" />
            Roles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-6">
          {/* Pending Users Section */}
          {pendingUsers.length > 0 && (
            <div>
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
                            value=""
                            onValueChange={(roleId) => assignRole(user.userId, roleId)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Select role..." />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-2 h-2 rounded-full" 
                                      style={{ backgroundColor: role.color }}
                                    />
                                    {role.name}
                                  </div>
                                </SelectItem>
                              ))}
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
                    <TableHead>Display Name</TableHead>
                    <TableHead>Role</TableHead>
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
                  ) : approvedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
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
                          {editingUserId === user.userId ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editingDisplayName}
                                onChange={(e) => setEditingDisplayName(e.target.value)}
                                className="h-8 w-40"
                                placeholder="Display name..."
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && user.userRole) {
                                    saveDisplayName(user.userRole.id);
                                  }
                                  if (e.key === "Escape") {
                                    cancelEditingDisplayName();
                                  }
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => user.userRole && saveDisplayName(user.userRole.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={cancelEditingDisplayName}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground">
                                {user.userRole?.display_name || (
                                  <span className="italic">Not set</span>
                                )}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => startEditingDisplayName(user.userId, user.userRole?.display_name || null)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.userRole?.role_id || ""}
                            onValueChange={(roleId) => {
                              if (user.userRole) {
                                changeUserRole(user.userRole.id, roleId);
                              }
                            }}
                          >
                            <SelectTrigger className="w-36">
                              {getRoleBadge(user.userRole?.role_id || null)}
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((role) => (
                                <SelectItem key={role.id} value={role.id}>
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-2 h-2 rounded-full" 
                                      style={{ backgroundColor: role.color }}
                                    />
                                    {role.name}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {user.userRole && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteRole(user.userRole!.id)}
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
        </TabsContent>

        <TabsContent value="roles">
          <RoleManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UserRoles;