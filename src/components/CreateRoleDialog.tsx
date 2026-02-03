import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useCreateRole } from "@/hooks/useRolesData";
import type { RolePermissions } from "@/hooks/useUserPermissions";

const defaultPermissions: RolePermissions = {
  canExportCustomers: false,
  canExportTraffic: false,
  canExportAds: false,
  canViewFacebookPages: false,
  canViewMondayImport: false,
  canViewUserRoles: false,
  canManageRoles: false,
};

const permissionLabels: Record<keyof RolePermissions, string> = {
  canExportCustomers: "Export Customer Data (CSV)",
  canExportTraffic: "Export Traffic Data (CSV)",
  canExportAds: "Export Ads Data (CSV)",
  canViewFacebookPages: "View Facebook Pages",
  canViewMondayImport: "View Monday Import",
  canViewUserRoles: "View User Roles",
  canManageRoles: "Manage Roles",
};

const colorPresets = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
];

export const CreateRoleDialog = () => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [permissions, setPermissions] = useState<RolePermissions>(defaultPermissions);
  
  const createRole = useCreateRole();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await createRole.mutateAsync({
      name: name.trim(),
      color,
      permissions,
      priority: 50, // Default priority between Admin (100) and Staff (10)
    });

    // Reset form
    setName("");
    setColor("#3b82f6");
    setPermissions(defaultPermissions);
    setOpen(false);
  };

  const togglePermission = (key: keyof RolePermissions) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Role
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Create a custom role with specific permissions for your team members.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Role Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sales Manager"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Role Color</Label>
              <div className="flex gap-2 flex-wrap">
                {colorPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === preset ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: preset }}
                  />
                ))}
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 p-0 border-0 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid gap-3">
              <Label>Permissions</Label>
              <div className="space-y-3">
                {(Object.keys(permissionLabels) as Array<keyof RolePermissions>).map((key) => (
                  <div key={key} className="flex items-center gap-3">
                    <Checkbox
                      id={key}
                      checked={permissions[key]}
                      onCheckedChange={() => togglePermission(key)}
                    />
                    <Label htmlFor={key} className="font-normal cursor-pointer">
                      {permissionLabels[key]}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createRole.isPending}>
              {createRole.isPending ? "Creating..." : "Create Role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
