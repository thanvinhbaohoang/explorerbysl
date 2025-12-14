import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, Facebook, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FacebookPage {
  id: string;
  name: string;
  category: string;
  picture?: string;
}

const FacebookPages = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPages = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('messenger-webhook', {
        body: {},
        method: 'GET',
      });

      // The invoke method doesn't support GET with body well, so we need to make a direct fetch
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/messenger-webhook/pages`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch pages');
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      setPages(result.pages || []);
      setLastRefreshed(new Date());
      toast.success(`Found ${result.pages?.length || 0} connected pages`);
    } catch (err: any) {
      console.error('Error fetching pages:', err);
      setError(err.message || 'Failed to fetch Facebook pages');
      toast.error('Failed to fetch Facebook pages');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPages();
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/dashboard')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-4xl font-bold text-foreground">Facebook Pages</h1>
              <p className="text-muted-foreground mt-2">
                Manage your connected Facebook pages for Messenger
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {lastRefreshed && (
              <span className="text-sm text-muted-foreground">
                Last updated: {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            <Button
              onClick={fetchPages}
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Facebook className="h-5 w-5" />
              Connection Status
            </CardTitle>
            <CardDescription>
              Pages connected via your Facebook System User Token
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {error ? (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span>{error}</span>
                </div>
              ) : isLoading ? (
                <div className="text-muted-foreground">Loading...</div>
              ) : (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>{pages.length} page{pages.length !== 1 ? 's' : ''} connected</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pages Grid */}
        {!isLoading && !error && (
          <div className="grid gap-4 md:grid-cols-2">
            {pages.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground">
                    <Facebook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No pages connected</p>
                    <p className="text-sm mt-2">
                      Make sure your Facebook System User Token has access to pages with Messenger enabled.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              pages.map((page) => (
                <Card key={page.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={page.picture} alt={page.name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-lg">
                          {page.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <div>
                          <h3 className="font-semibold text-lg">{page.name}</h3>
                          <p className="text-sm text-muted-foreground font-mono">
                            ID: {page.id}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {page.category && (
                            <Badge variant="secondary">{page.category}</Badge>
                          )}
                          <Badge variant="outline" className="gap-1">
                            <MessageSquare className="h-3 w-3" />
                            Messenger Active
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Instructions Card */}
        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    1
                  </div>
                  <span className="font-medium">Connect Pages</span>
                </div>
                <p className="text-sm text-muted-foreground pl-10">
                  Your System User Token provides access to all pages it manages.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    2
                  </div>
                  <span className="font-medium">Receive Messages</span>
                </div>
                <p className="text-sm text-muted-foreground pl-10">
                  Messages from any connected page are automatically captured.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    3
                  </div>
                  <span className="font-medium">Reply to Customers</span>
                </div>
                <p className="text-sm text-muted-foreground pl-10">
                  Responses are sent using the correct page's access token.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FacebookPages;