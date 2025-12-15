import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import UserNav from "@/components/UserNav";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
}

interface NavLink {
  href: string;
  label: string;
  adminOnly?: boolean;
}

const navLinks: NavLink[] = [
  { href: "/customers", label: "Customers" },
  { href: "/traffic", label: "Traffic" },
  { href: "/ads-insight", label: "Ads Insight" },
  { href: "/facebook-pages", label: "Pages", adminOnly: true },
  { href: "/monday-import", label: "Import", adminOnly: true },
  { href: "/user-roles", label: "Roles", adminOnly: true },
];

const AppLayout = ({ children }: AppLayoutProps) => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const location = useLocation();

  const filteredNavLinks = navLinks.filter(
    (link) => !link.adminOnly || isAdmin
  );

  return (
    <div className="min-h-screen bg-background">
      {user && (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center px-4 md:px-8">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg text-foreground">
              ExplorerBySL
            </Link>
            <nav className="flex-1 flex items-center justify-center gap-6">
              {filteredNavLinks.map((link) => (
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
