import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Facebook, ArrowLeft, RefreshCw, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ConnectedPage {
  id: string;
  page_id: string;
  page_name: string;
  page_access_token: string;
  token_expires_at: string | null;
  created_at: string;
}

const FacebookConnect = () => {
  const navigate = useNavigate();
  const [pages, setPages] = useState<ConnectedPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [revealedTokens, setRevealedTokens] = useState<Set<string>>(new Set());

  const fetchPages = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("connected_pages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch connected pages:", error);
      toast.error("Failed to load connected pages");
    } else {
      setPages(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPages();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fb-exchange-token/auth-url`
      );
      const { authUrl, error: urlError } = await res.json();
      if (urlError) {
        toast.error(urlError);
        setConnecting(false);
        return;
      }

      const popup = window.open(authUrl, "fb-oauth", "width=600,height=700,scrollbars=yes");

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "fb-oauth-success") {
          toast.success(`Connected ${event.data.pages} page(s) successfully!`);
          fetchPages();
          window.removeEventListener("message", handleMessage);
          setConnecting(false);
        } else if (event.data?.type === "fb-oauth-error") {
          toast.error(event.data.error || "Authorization failed");
          window.removeEventListener("message", handleMessage);
          setConnecting(false);
        }
      };
      window.addEventListener("message", handleMessage);

      const pollTimer = setInterval(() => {
        if (popup?.closed) {
          clearInterval(pollTimer);
          setTimeout(() => {
            window.removeEventListener("message", handleMessage);
            fetchPages();
            setConnecting(false);
          }, 1000);
        }
      }, 1000);
    } catch (err: any) {
      toast.error(err.message || "Failed to start authorization");
      setConnecting(false);
    }
  };

  const toggleToken = (pageId: string) => {
    setRevealedTokens((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const maskToken = (token: string) => {
    if (token.length <= 12) return "••••••••";
    return `${token.slice(0, 6)}••••••${token.slice(-6)}`;
  };

  const getTokenStatus = (expiresAt: string | null) => {
    if (!expiresAt) return { label: "No expiry info", variant: "secondary" as const };
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) return { label: "Expired", variant: "destructive" as const };
    if (daysLeft <= 7) return { label: `Expires in ${daysLeft}d`, variant: "destructive" as const };
    if (daysLeft <= 30) return { label: `Expires in ${daysLeft}d`, variant: "outline" as const };
    return { label: `Expires in ${daysLeft}d`, variant: "secondary" as const };
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Facebook Page Connect</h1>
            <p className="text-muted-foreground text-sm">
              Connect your Facebook Pages via Login for Business
            </p>
          </div>
        </div>

        {/* Connect Card */}
        <Card className="border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Facebook className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-semibold text-lg">Connect a Facebook Page</h3>
              <p className="text-muted-foreground text-sm max-w-md">
                Sign in with Facebook to authorize your Pages. We'll securely store long-lived Page Access Tokens for messaging.
              </p>
            </div>
            <Button
              size="lg"
              onClick={handleConnect}
              disabled={connecting}
              className="gap-2 mt-2"
            >
              {connecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Facebook className="h-4 w-4" />
              )}
              {connecting ? "Connecting..." : "Connect Facebook Page"}
            </Button>
          </CardContent>
        </Card>

        {/* Connected Pages List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Connected Pages</h2>
            <Button variant="ghost" size="sm" onClick={fetchPages} disabled={loading} className="gap-1">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading pages...
            </div>
          ) : pages.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                <p>No pages connected yet.</p>
                <p className="text-xs">Click "Connect Facebook Page" above to get started.</p>
              </CardContent>
            </Card>
          ) : (
            pages.map((page) => {
              const tokenStatus = getTokenStatus(page.token_expires_at);
              const isRevealed = revealedTokens.has(page.page_id);

              return (
                <Card key={page.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-2">
                          <Facebook className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{page.page_name}</CardTitle>
                          <CardDescription className="text-xs font-mono">
                            Page ID: {page.page_id}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={tokenStatus.variant}>{tokenStatus.label}</Badge>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {/* Token display */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Page Access Token</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 text-xs"
                          onClick={() => toggleToken(page.page_id)}
                        >
                          {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {isRevealed ? "Hide" : "Reveal"}
                        </Button>
                      </div>
                      <div className="bg-muted rounded-md px-3 py-2 font-mono text-xs break-all">
                        {isRevealed ? page.page_access_token : maskToken(page.page_access_token)}
                      </div>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Connected: {new Date(page.created_at).toLocaleDateString()}</span>
                      {page.token_expires_at && (
                        <span>Expires: {new Date(page.token_expires_at).toLocaleDateString()}</span>
                      )}
                    </div>

                    {/* Facebook link */}
                    <a
                      href={`https://www.facebook.com/${page.page_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View on Facebook <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default FacebookConnect;
