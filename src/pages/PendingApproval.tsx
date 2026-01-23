import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, LogOut, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const PendingApproval = () => {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["user-approval-status"] });
    // Small delay for UX feedback
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning/20">
            <Clock className="h-8 w-8 text-warning" />
          </div>
          <CardTitle className="text-2xl">Pending Approval</CardTitle>
          <CardDescription className="text-base">
            Your account is awaiting administrator approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <p className="text-sm text-muted-foreground">Signed in as:</p>
            <p className="font-medium">{user?.user_metadata?.full_name || user?.email}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            An administrator will review your request and grant access. 
            Please check back later or contact your administrator.
          </p>

          <div className="flex flex-col gap-3">
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Check Status
            </Button>
            <Button 
              variant="ghost" 
              onClick={handleSignOut}
              className="w-full text-muted-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
