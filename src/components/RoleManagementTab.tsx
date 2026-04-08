import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Lock, Pencil, Check, X } from "lucide-react";
import { useRolesData, useUpdateRolePermissions, useDeleteRole, useUpdateRole, Role } from "@/hooks/useRolesData";
import { CreateRoleDialog } from "./CreateRoleDialog";
import type { RolePermissions } from "@/hooks/useUserPermissions";

const permissionLabels: Record<keyof RolePermissions, string> = {
  canViewChat: "Chat",
  canViewCustomers: "Customers",
  canViewTraffic: "Traffic",
  canViewAdsInsight: "Ads",
  canViewDocs: "Docs",
  canViewDashboard: "Dashboard",
  canExportCustomers: "Export Customers",
  canExportTraffic: "Export Traffic",
  canExportAds: "Export Ads",
  canViewFacebookPages: "View Pages",
  canViewMondayImport: "View Import",
  canViewUserRoles: "View Roles",
  canManageRoles: "Manage Roles",
};

export const RoleManagementTab = () => {
  const { data: roles = [], isLoading } = useRolesData();
  const updatePermissions = useUpdateRolePermissions();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const handlePermissionToggle = (role: Role, permissionKey: keyof RolePermissions) => {
    const newPermissions = {
      ...role.permissions,
      [permissionKey]: !role.permissions[permissionKey],
    };
    updatePermissions.mutate({ id: role.id, permissions: newPermissions });
  };

  const startEditing = (role: Role) => {
    setEditingRoleId(role.id);
    setEditingName(role.name);
  };

  const cancelEditing = () => {
    setEditingRoleId(null);
    setEditingName("");
  };

  const saveRoleName = (roleId: string) => {
    if (editingName.trim()) {
      updateRole.mutate({ id: roleId, name: editingName.trim() });
    }
    setEditingRoleId(null);
    setEditingName("");
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading roles...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Role Management</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage roles with custom permissions
          </p>
        </div>
        <CreateRoleDialog />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Role</TableHead>
              {(Object.keys(permissionLabels) as Array<keyof RolePermissions>).map((key) => (
                <TableHead key={key} className="text-center text-xs">
                  {permissionLabels[key]}
                </TableHead>
              ))}
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    {editingRoleId === role.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-7 w-32"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRoleName(role.id);
                            if (e.key === "Escape") cancelEditing();
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => saveRoleName(role.id)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={cancelEditing}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium">{role.name}</span>
                        {role.is_system && (
                          <Badge variant="outline" className="text-xs">
                            <Lock className="h-2 w-2 mr-1" />
                            System
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
                {(Object.keys(permissionLabels) as Array<keyof RolePermissions>).map((key) => (
                  <TableCell key={key} className="text-center">
                    <Checkbox
                      checked={role.permissions[key] || false}
                      onCheckedChange={() => handlePermissionToggle(role, key)}
                      disabled={role.is_system && role.name === "Admin"}
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <div className="flex items-center gap-1">
                    {!role.is_system && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => startEditing(role)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Role</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the "{role.name}" role? 
                                Users with this role will need to be reassigned.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteRole.mutate(role.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
