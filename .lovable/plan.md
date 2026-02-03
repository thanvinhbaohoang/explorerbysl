
# Discord-Style Role Management System

## Overview

This plan implements a flexible, Discord-like role system where admins can:
1. **Create custom roles** with unique names and colors
2. **Define granular permissions** for each role (CSV export, page access, etc.)
3. **Assign roles to users** and edit their display names
4. **Control feature visibility** based on role permissions

---

## Database Design

### New Tables

**1. `roles` table** - Custom role definitions (like Discord roles)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Role name (e.g., "Sales Team", "Manager") |
| color | text | Hex color for badge display |
| permissions | jsonb | Permission flags object |
| priority | integer | Role hierarchy (higher = more authority) |
| is_system | boolean | True for built-in roles (Admin, Staff) |
| created_at | timestamp | When created |

**2. Modify `user_roles` table** - Add display name and link to new roles

| Column | Type | Description |
|--------|------|-------------|
| display_name | text | Custom display name for the user |
| role_id | uuid | Foreign key to `roles` table |

### Permission Structure

```text
{
  "canExportCustomers": true,
  "canExportTraffic": true,
  "canExportAds": true,
  "canViewFacebookPages": true,
  "canViewMondayImport": true,
  "canViewUserRoles": false,
  "canManageRoles": false
}
```

### Built-in Roles (System Roles)

| Role | Permissions |
|------|-------------|
| **Admin** | All permissions enabled (full access) |
| **Staff** | Default staff role - no exports, no admin pages |

Admins can create additional custom roles with any combination of permissions.

---

## Frontend Changes

### 1. New Role Management Page (`/user-roles`)

**Tab 1: Users**
- List all users with their assigned role and display name
- Inline editing for display name
- Dropdown to change role assignment
- Pending users section (no role yet)

**Tab 2: Roles**
- List all roles with permission toggles
- Create new role button (opens dialog)
- Edit role permissions inline with checkboxes
- Delete custom roles (system roles protected)
- Color picker for role badges

### 2. Role Creation Dialog

Fields:
- Role name (text input)
- Role color (color picker)
- Permission toggles (checkboxes):
  - Export customer data (CSV)
  - Export traffic data (CSV)
  - Export ads data (CSV)
  - View Facebook Pages
  - View Monday Import
  - Manage User Roles

### 3. Permission-Gated Features

Update these pages to check permissions:

| Page | Permission Check |
|------|-----------------|
| `/customers` | Export button: `canExportCustomers` |
| `/traffic` | Export button: `canExportTraffic` |
| `/ads-insight` | Export button: `canExportAds` |
| `/facebook-pages` | Page access: `canViewFacebookPages` |
| `/monday-import` | Page access: `canViewMondayImport` |
| `/user-roles` | Page access: `canViewUserRoles` |

### 4. Navigation Updates

Update `AppLayout.tsx` to dynamically show/hide nav links based on user's role permissions (not just `isAdmin`).

### 5. Display Name in Messages

Update all places that use `user?.email?.split('@')[0]` to instead use the display name from `user_roles`:

- `src/hooks/useChatMessages.ts`
- `src/pages/Customers.tsx`
- `src/components/CustomerNotesSection.tsx`
- `src/components/QuickActionsPanel.tsx`

---

## Implementation Files

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/useUserPermissions.ts` | Fetch user's role + permissions + display name |
| `src/hooks/useRolesData.ts` | CRUD operations for roles table |
| `src/components/RoleManagementTab.tsx` | Roles management UI with permission toggles |
| `src/components/CreateRoleDialog.tsx` | Dialog for creating new roles |

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/UserRoles.tsx` | Add tabs for Users/Roles, integrate new components |
| `src/components/AppLayout.tsx` | Use permissions for nav link visibility |
| `src/pages/Customers.tsx` | Gate export button with permissions |
| `src/pages/Traffic.tsx` | Gate export button with permissions |
| `src/pages/AdsInsight.tsx` | Gate export button with permissions |
| `src/pages/FacebookPages.tsx` | Gate page access with permissions |
| `src/pages/MondayImport.tsx` | Gate page access with permissions |
| `src/hooks/useChatMessages.ts` | Use display name for sent_by_name |
| `src/components/CustomerNotesSection.tsx` | Use display name |
| `src/components/QuickActionsPanel.tsx` | Use display name |

---

## Database Migration

```sql
-- 1. Create roles table
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6366f1',
  permissions JSONB NOT NULL DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS on roles
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies for roles table
CREATE POLICY "Authenticated users can read roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage roles"
  ON public.roles FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 4. Insert system roles
INSERT INTO public.roles (name, color, permissions, priority, is_system) VALUES
('Admin', '#ef4444', '{"canExportCustomers":true,"canExportTraffic":true,"canExportAds":true,"canViewFacebookPages":true,"canViewMondayImport":true,"canViewUserRoles":true,"canManageRoles":true}', 100, true),
('Staff', '#6b7280', '{"canExportCustomers":false,"canExportTraffic":false,"canExportAds":false,"canViewFacebookPages":false,"canViewMondayImport":false,"canViewUserRoles":false,"canManageRoles":false}', 10, true);

-- 5. Add columns to user_roles
ALTER TABLE public.user_roles 
ADD COLUMN display_name TEXT,
ADD COLUMN role_id UUID REFERENCES public.roles(id);

-- 6. Migrate existing roles to new system
UPDATE public.user_roles SET role_id = (
  SELECT id FROM public.roles WHERE name = 
    CASE 
      WHEN role = 'admin' THEN 'Admin'
      ELSE 'Staff'
    END
);
```

---

## User Interface Mockup

### Roles Tab

```text
┌─────────────────────────────────────────────────────────┐
│ Roles Management                          [+ Create Role] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ● Admin (System)                                       │
│    ✓ Export Customers  ✓ Export Traffic  ✓ Export Ads  │
│    ✓ View Pages  ✓ View Import  ✓ Manage Roles         │
│                                                         │
│  ● Staff (System)                                       │
│    ✗ Export Customers  ✗ Export Traffic  ✗ Export Ads  │
│    ✗ View Pages  ✗ View Import  ✗ Manage Roles         │
│                                                         │
│  ● Sales Manager                              [Edit] [🗑]│
│    ✓ Export Customers  ✓ Export Traffic  ✗ Export Ads  │
│    ✗ View Pages  ✗ View Import  ✗ Manage Roles         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Users Tab

```text
┌─────────────────────────────────────────────────────────┐
│ User                     │ Display Name   │ Role        │
├─────────────────────────────────────────────────────────┤
│ harold@gmail.com         │ [Harold ✏️]    │ Admin ▼     │
│ staff1@explorerbysl.com  │ [Sarah ✏️]     │ Staff ▼     │
│ manager@company.com      │ [Mike ✏️]      │ Sales Mgr ▼ │
└─────────────────────────────────────────────────────────┘
```

---

## Permission Flow

```text
User opens app
       ↓
useUserPermissions() hook
       ↓
Fetch user_roles.role_id + display_name
       ↓
Fetch roles.permissions for that role_id
       ↓
Return { role, displayName, permissions }
       ↓
┌─────────────────────────────────────────┐
│                                         │
│  Navigation: Show/hide links based on   │
│  permissions.canView*                   │
│                                         │
│  Export buttons: Show/hide based on     │
│  permissions.canExport*                 │
│                                         │
│  Messages: Use displayName for          │
│  sent_by_name field                     │
│                                         │
└─────────────────────────────────────────┘
```

---

## Security Considerations

1. **RLS on roles table**: Only admins can create/edit/delete roles
2. **System roles protected**: `is_system = true` roles cannot be deleted
3. **Priority hierarchy**: Higher priority roles can manage lower priority ones
4. **Permissions stored server-side**: Never trust client-side permission checks for sensitive operations
5. **Backward compatible**: Existing `app_role` enum kept for RLS policies; new system layers on top

---

## Future Extensibility

The JSONB permissions field allows adding new permissions without database migrations:

```text
{
  "canExportCustomers": true,
  "canDeleteMessages": false,     // Future
  "canViewAnalytics": true,       // Future
  "canBulkImport": false,         // Future
  "maxDailyExports": 100          // Future numeric limits
}
```
