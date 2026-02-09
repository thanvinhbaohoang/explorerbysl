import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import UserNav from "@/components/UserNav";
import { useAuth } from "@/contexts/AuthContext";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

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
  { href: "/system", label: "System", permission: 'canViewFacebookPages' },
  { href: "/monday-import", label: "Import", permission: 'canViewMondayImport' },
  { href: "/user-roles", label: "Roles", permission: 'canViewUserRoles' },
];

const AppLayout = ({ children }: AppLayoutProps) => {
  const { user } = useAuth();
  const { permissions, isAdmin, isLoading } = useUserPermissions();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            {/* Mobile hamburger menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" className="mr-2">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <SheetHeader>
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-2 mt-6">
                  {!isLoading && filteredNavLinks.map((link) => (
                    <SheetClose asChild key={link.href}>
                      <Link
                        to={link.href}
                        className={cn(
                          "px-4 py-3 text-sm font-medium rounded-md transition-colors hover:bg-muted",
                          location.pathname === link.href
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            <Link to="/" className="flex items-center gap-2 font-bold text-lg text-foreground">
              ExplorerBySL
            </Link>

            {/* Desktop navigation */}
            <nav className="flex-1 hidden md:flex items-center justify-center gap-6">
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

            {/* Spacer for mobile to push UserNav to the right */}
            <div className="flex-1 md:hidden" />

            <UserNav />
          </div>
        </header>
      )}
      <main>{children}</main>
    </div>
  );
};

export default AppLayout;
