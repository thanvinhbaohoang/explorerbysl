# Discord-Style Role Management System

## Status: ✅ Implemented

## Overview

This system implements a flexible, Discord-like role system where admins can:
1. ✅ **Create custom roles** with unique names and colors
2. ✅ **Define granular permissions** for each role (CSV export, page access, etc.)
3. ✅ **Assign roles to users** and edit their display names
4. ✅ **Control feature visibility** based on role permissions

---

## Database Design

### Tables Created

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

**2. `user_roles` table updates** - Added display name and link to new roles

| Column | Type | Description |
|--------|------|-------------|
| display_name | text | Custom display name for the user |
| role_id | uuid | Foreign key to `roles` table |

### Permission Structure

```json
{
  "canExportCustomers": true,
  "canExportTraffic": true,
  "canExportAds": true,
  "canViewFacebookPages": true,
  "canViewMondayImport": true,
  "canViewUserRoles": true,
  "canManageRoles": true
}
```

### Built-in Roles (System Roles)

| Role | Permissions |
|------|-------------|
| **Admin** | All permissions enabled (full access) |
| **Staff** | Default staff role - no exports, no admin pages |

---

## Files Created/Modified

### New Files
- `src/hooks/useUserPermissions.ts` - Fetch user's role + permissions + display name
- `src/hooks/useRolesData.ts` - CRUD operations for roles table
- `src/components/RoleManagementTab.tsx` - Roles management UI with permission toggles
- `src/components/CreateRoleDialog.tsx` - Dialog for creating new roles

### Modified Files
- `src/pages/UserRoles.tsx` - Added tabs for Users/Roles, display name editing
- `src/components/AppLayout.tsx` - Uses permissions for nav link visibility
- `src/pages/Customers.tsx` - Export button gated with permissions
- `src/pages/Traffic.tsx` - Export button gated with permissions
- `src/pages/AdsInsight.tsx` - Export button gated with permissions
- `src/pages/FacebookPages.tsx` - Page access gated with permissions
- `src/pages/MondayImport.tsx` - Page access gated with permissions
- `src/hooks/useUserRolesData.ts` - Added display_name support and role_id

---

## Future Extensibility

The JSONB permissions field allows adding new permissions without database migrations:

```json
{
  "canExportCustomers": true,
  "canDeleteMessages": false,
  "canViewAnalytics": true,
  "canBulkImport": false,
  "maxDailyExports": 100
}
```
