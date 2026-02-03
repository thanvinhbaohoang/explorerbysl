-- 1. Create roles table for custom role definitions
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

CREATE POLICY "Admins can insert roles"
  ON public.roles FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update roles"
  ON public.roles FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
  ON public.roles FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 4. Insert system roles with all permissions
INSERT INTO public.roles (name, color, permissions, priority, is_system) VALUES
('Admin', '#ef4444', '{"canExportCustomers":true,"canExportTraffic":true,"canExportAds":true,"canViewFacebookPages":true,"canViewMondayImport":true,"canViewUserRoles":true,"canManageRoles":true}', 100, true),
('Staff', '#6b7280', '{"canExportCustomers":false,"canExportTraffic":false,"canExportAds":false,"canViewFacebookPages":false,"canViewMondayImport":false,"canViewUserRoles":false,"canManageRoles":false}', 10, true);

-- 5. Add columns to user_roles for display name and role reference
ALTER TABLE public.user_roles 
ADD COLUMN display_name TEXT,
ADD COLUMN role_id UUID REFERENCES public.roles(id);

-- 6. Migrate existing admin roles to new system
UPDATE public.user_roles 
SET role_id = (SELECT id FROM public.roles WHERE name = 'Admin')
WHERE role = 'admin';

-- 7. Migrate non-admin roles to Staff
UPDATE public.user_roles 
SET role_id = (SELECT id FROM public.roles WHERE name = 'Staff')
WHERE role != 'admin' AND role_id IS NULL;