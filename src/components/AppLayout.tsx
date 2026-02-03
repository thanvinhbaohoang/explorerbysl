import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import UserNav from "@/components/UserNav";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

interface NavLink {
  href: string;
  label: string;
  permission?: 'canViewFacebookPages' | 'canViewMondayImport' | 'canViewUserRoles';
}

const navLinks: NavLink[] = [
  { href: "/chat", label: "Chat" },
  { href: "/customers", label: "Customers" },
  { href: "/traffic", label: "Traffic" },
  { href: "/ads-insight", label: "Ads Insight" },
  { href: "/docs", label: "Docs" },
  { href: "/facebook-pages", label: "Pages", permission: 'canViewFacebookPages' },
  { href: "/monday-import", label: "Import", permission: 'canViewMondayImport' },
  { href: "/user-roles", label: "Roles", permission: 'canViewUserRoles' },
];

const AppLayout = ({ children }: AppLayoutProps) => {
  const { user } = useAuth();
  const { permissions, isAdmin, isLoading } = useUserPermissions();
  const location = useLocation();

  const filteredNavLinks = navLinks.filter((link) => {
    // No permission required - always show
    if (!link.permission) return true;
    // Admin always sees everything
    if (isAdmin) return true;
    // Check specific permission
    return permissions[link.permission];
  });

  return (
    <div className="min-h-screen bg-background">
      {user && (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center px-4 md:px-8">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg text-foreground">
              ExplorerBySL
            </Link>
            <nav className="flex-1 flex items-center justify-center gap-6">
              {!isLoading && filteredNavLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "text-sm font-medium transition-colors hover:text-primary",
                    location.pathname === link.href
                      ? "text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <UserNav />
          </div>
        </header>
      )}
      <main>{children}</main>
    </div>
  );
};

export default AppLayout;
