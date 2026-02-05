import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Facebook, CheckCircle2, AlertCircle, Database, MessageSquare, Building2, User, AppWindow, Shield, ExternalLink, Lock, Key, ChevronDown, ChevronUp, FileText, Settings, Download } from "lucide-react";
import { exportToCSV } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { UpdateTokenDialog } from "@/components/UpdateTokenDialog";

interface FacebookPage {
  id: string;
  name: string;
  category: string;
  picture?: string;
  synced?: boolean;
  lastUpdated?: string;
}

interface DbPage {
  id: string;
  page_id: string;
  name: string;
  picture_url?: string;
}

interface AppInfo {
  id: string;
  name: string;
  category?: string;
  link?: string;
  privacyPolicyUrl?: string;
}

interface SystemUserInfo {
  id: string;
  name: string;
}

interface BusinessInfo {
  id: string;
  name: string;
  profilePicture?: string;
  verificationStatus?: string;
  link?: string;
}

interface GranularScope {
  scope: string;
  target_ids?: string[];
}

interface TokenInfo {
  appId: string;
  userId: string;
  type: string;
  isValid: boolean;
  expiresAt: string;
  scopes: string[];
  granularScopes?: GranularScope[];
}

const FacebookPages = () => {
  const navigate = useNavigate();
  const { permissions, isAdmin, isLoading: permissionsLoading } = useUserPermissions();
  const [pages, setPages] = useState<FacebookPage[]>([]);
  const [dbPages, setDbPages] = useState<DbPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>('');
  
  // App info state
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [systemUser, setSystemUser] = useState<SystemUserInfo | null>(null);
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [appInfoLoading, setAppInfoLoading] = useState(true);
  const [scopesExpanded, setScopesExpanded] = useState(false);
  
  // Token update dialog
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<DbPage | null>(null);
  
  // Fetch database pages for token management
  const fetchDbPages = async () => {
    try {
      const { data, error } = await supabase
        .from("facebook_pages")
        .select("id, page_id, name, picture_url")
        .order("name");
      
      if (error) throw error;
      setDbPages(data || []);
    } catch (err: any) {
      console.error("Error fetching db pages:", err);
    }
  };
  
  const handleUpdateToken = (page: DbPage) => {
    setSelectedPage(page);
    setTokenDialogOpen(true);
  };

  const fetchPages = async () => {
    setIsLoading(true);
    setError(null);
    try {
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
      setSource(result.source || 'facebook');
      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error('Error fetching pages:', err);
      setError(err.message || 'Failed to fetch pages');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAppInfo = async () => {
    setAppInfoLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/messenger-webhook/app-info`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) return;

      const result = await response.json();
      
      if (result.success) {
        setAppInfo(result.app);
        setSystemUser(result.systemUser);
        setBusiness(result.business);
        setTokenInfo(result.token);
      }
    } catch (err: any) {
      console.error('Error fetching app info:', err);
    } finally {
      setAppInfoLoading(false);
    }
  };

  const syncPages = async () => {
    setSyncing(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/messenger-webhook/pages/sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();
      
      if (result.success) {
        toast.success(`Synced ${result.pages.length} pages to database`);
        await fetchPages();
      } else {
        toast.error(result.error || 'Failed to sync pages');
      }
    } catch (err: any) {
      console.error('Error syncing pages:', err);
      toast.error(err.message || 'Failed to sync pages');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchPages();
    fetchAppInfo();
    fetchDbPages();
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
              variant="outline"
              onClick={async () => {
                toast.info("Exporting all Facebook pages...");
                const { data: dbPages, error } = await supabase
                  .from('facebook_pages')
                  .select('*')
                  .order('name');
                
                if (error) {
                  toast.error("Failed to export pages");
                  return;
                }
                
                exportToCSV(
                  dbPages || [],
                  [
                    { key: 'name', header: 'Page Name' },
                    { key: 'page_id', header: 'Page ID' },
                    { key: 'category', header: 'Category' },
                    { key: 'is_active', header: 'Active', getValue: (p) => p.is_active ? 'Yes' : 'No' },
                    { key: 'created_at', header: 'Added', getValue: (p) => new Date(p.created_at).toLocaleString() },
                    { key: 'updated_at', header: 'Last Updated', getValue: (p) => new Date(p.updated_at).toLocaleString() },
                  ],
                  'facebook_pages'
                );
                toast.success(`Exported ${dbPages?.length || 0} pages`);
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button
              onClick={syncPages}
              disabled={syncing}
              variant="outline"
            >
              <Database className={`h-4 w-4 mr-2 ${syncing ? 'animate-pulse' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync to DB'}
            </Button>
            <Button
              onClick={() => { fetchPages(); fetchAppInfo(); }}
              disabled={isLoading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* App & Business Info Card */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Connected App */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AppWindow className="h-5 w-5" />
                Connected App
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appInfoLoading ? (
                <div className="text-muted-foreground text-sm">Loading...</div>
              ) : appInfo ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Facebook className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold">{appInfo.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">ID: {appInfo.id}</div>
                    </div>
                  </div>
                  
                  {appInfo.category && (
                    <Badge variant="secondary">{appInfo.category}</Badge>
                  )}

                  {/* App Links */}
                  {appInfo.privacyPolicyUrl && (
                    <a 
                      href={appInfo.privacyPolicyUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      Privacy Policy
                    </a>
                  )}


                  {/* Token Info */}
                  {tokenInfo && (
                    <div className="pt-2 border-t space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <Key className="h-4 w-4" />
                        Token Details
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={tokenInfo.isValid ? "default" : "destructive"} className="text-xs">
                          {tokenInfo.isValid ? "Valid" : "Invalid"}
                        </Badge>
                        {tokenInfo.type && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {tokenInfo.type}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Expires: {tokenInfo.expiresAt === 'Never' ? 'Never' : new Date(tokenInfo.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {/* Scopes */}
                      {tokenInfo.scopes && tokenInfo.scopes.length > 0 && (
                        <div className="pt-1">
                          <button 
                            onClick={() => setScopesExpanded(!scopesExpanded)}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Lock className="h-3 w-3" />
                            {tokenInfo.scopes.length} Permissions
                            {scopesExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                          {scopesExpanded && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {tokenInfo.scopes.map((scope: string) => (
                                <Badge key={scope} variant="outline" className="text-xs">
                                  {scope}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">No app info available</div>
              )}
            </CardContent>
          </Card>

          {/* System User & Business */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5" />
                System User
              </CardTitle>
            </CardHeader>
            <CardContent>
              {appInfoLoading ? (
                <div className="text-muted-foreground text-sm">Loading...</div>
              ) : systemUser ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center">
                      <User className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-semibold">{systemUser.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">ID: {systemUser.id}</div>
                    </div>
                  </div>
                  
                  {business && (
                    <div className="pt-3 border-t">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Building2 className="h-4 w-4" />
                        Business
                      </div>
                      <div className="flex items-center gap-3">
                        {business.profilePicture ? (
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={business.profilePicture} />
                            <AvatarFallback>{business.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-sm">{business.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">ID: {business.id}</div>
                        </div>
                      </div>
                      {business.verificationStatus && (
                        <Badge variant={business.verificationStatus === 'verified' ? 'default' : 'secondary'} className="mt-2 text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          {business.verificationStatus}
                        </Badge>
                      )}
                      {business.link && (
                        <a 
                          href={business.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View on Facebook
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm">No system user info available</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Connection Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Facebook className="h-5 w-5" />
              Connected Pages
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
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>{pages.length} page{pages.length !== 1 ? 's' : ''} connected</span>
                  </div>
                  <Badge variant={source === 'database' ? 'default' : 'secondary'}>
                    {source === 'database' ? 'From Database' : 'From Facebook API'}
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pages Grid */}
        {!isLoading && !error && (
          <div className="grid gap-4">
            {pages.length === 0 ? (
              <Card>
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
              pages.map((page) => {
                // Find the matching db page for this page
                const dbPage = dbPages.find(dp => dp.page_id === page.id);
                
                return (
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
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg">{page.name}</h3>
                              {page.synced && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  <Database className="h-3 w-3 mr-1" />
                                  Synced
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground font-mono">
                              ID: {page.id}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {page.category && (
                              <Badge variant="secondary">{page.category}</Badge>
                            )}
                            <Badge variant="outline" className="gap-1">
                              <MessageSquare className="h-3 w-3" />
                              Messenger Active
                            </Badge>
                            {page.lastUpdated && (
                              <span className="text-xs text-muted-foreground">
                                Synced: {new Date(page.lastUpdated).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* Admin-only Update Token Button */}
                        {isAdmin && dbPage && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateToken(dbPage)}
                            className="gap-1"
                          >
                            <Key className="h-4 w-4" />
                            Update Token
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
        
        {/* Admin Token Management Section */}
        {isAdmin && dbPages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Token Management
                <Badge variant="secondary" className="ml-2">Admin Only</Badge>
              </CardTitle>
              <CardDescription>
                Update page access tokens for connected Facebook pages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dbPages.map((dbPage) => (
                  <div
                    key={dbPage.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {dbPage.picture_url ? (
                        <img
                          src={dbPage.picture_url}
                          alt={dbPage.name}
                          className="h-8 w-8 rounded-full"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary text-sm font-medium">
                            {dbPage.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-sm">{dbPage.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {dbPage.page_id}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateToken(dbPage)}
                      className="gap-1"
                    >
                      <Key className="h-3 w-3" />
                      Update Token
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Update Token Dialog */}
      <UpdateTokenDialog
        open={tokenDialogOpen}
        onOpenChange={setTokenDialogOpen}
        page={selectedPage}
        onSuccess={() => {
          fetchDbPages();
          fetchPages();
        }}
      />
    </div>
  );
};

export default FacebookPages;
