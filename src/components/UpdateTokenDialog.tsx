import { useState } from "react";
import { Key, Save, Eye, EyeOff, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PageInfo {
  id: string;
  page_id: string;
  name: string;
  picture_url?: string;
}

interface UpdateTokenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: PageInfo | null;
  onSuccess: () => void;
}

export function UpdateTokenDialog({
  open,
  onOpenChange,
  page,
  onSuccess,
}: UpdateTokenDialogProps) {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    if (!page) return;

    // Validate token
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      toast.error("Please enter a valid access token");
      return;
    }

    if (trimmedToken.length < 50) {
      toast.error("Token appears to be too short. Please verify it's correct.");
      return;
    }

    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from("facebook_pages")
        .update({
          access_token: trimmedToken,
          updated_at: new Date().toISOString(),
        })
        .eq("id", page.id);

      if (error) {
        throw error;
      }

      toast.success(`Token updated for ${page.name}`);
      setToken("");
      setShowToken(false);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error updating token:", error);
      toast.error(error.message || "Failed to update token");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    setToken("");
    setShowToken(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Update Page Access Token
          </DialogTitle>
          <DialogDescription>
            Update the access token for this Facebook page to enable Messenger
            features.
          </DialogDescription>
        </DialogHeader>

        {page && (
          <div className="space-y-4">
            {/* Page Info */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              {page.picture_url ? (
                <img
                  src={page.picture_url}
                  alt={page.name}
                  className="h-10 w-10 rounded-full"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold">
                    {page.name.charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <div className="font-medium">{page.name}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  Page ID: {page.page_id}
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Shield className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-600 dark:text-amber-400">
                <strong>Admin Only:</strong> Token updates are restricted to
                administrators. The token will be securely stored in the
                database.
              </div>
            </div>

            {/* Token Input */}
            <div className="space-y-2">
              <Label htmlFor="token">Page Access Token</Label>
              <div className="relative">
                <Input
                  id="token"
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste the new access token here..."
                  className="pr-10 font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Ensure the token has the required permissions:
                pages_messaging, pages_read_engagement, pages_manage_metadata
              </p>
            </div>

            {/* Token Length Indicator */}
            {token && (
              <div className="flex items-center gap-2">
                <Badge
                  variant={token.length >= 50 ? "default" : "destructive"}
                  className="text-xs"
                >
                  {token.length} characters
                </Badge>
                {token.length < 50 && (
                  <span className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Token seems too short
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            disabled={isUpdating || !token.trim() || token.length < 50}
          >
            {isUpdating ? (
              <>
                <Save className="h-4 w-4 mr-2 animate-pulse" />
                Updating...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Update Token
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
