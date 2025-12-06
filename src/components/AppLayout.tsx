import { ReactNode } from "react";
import UserNav from "@/components/UserNav";
import { useAuth } from "@/contexts/AuthContext";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {user && (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center justify-end px-4 md:px-8">
            <UserNav />
          </div>
        </header>
      )}
      <main>{children}</main>
    </div>
  );
};

export default AppLayout;
