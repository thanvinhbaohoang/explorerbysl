import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, Facebook, CheckCircle2, AlertCircle, Database, MessageSquare, Building2, User, AppWindow, Shield, ExternalLink, Lock, Key, ChevronDown, ChevronUp, FileText, Settings, Download, Bot, Webhook, Save, Loader2, Eye, EyeOff, Info } from "lucide-react";
import { exportToCSV } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useAuth } from "@/contexts/AuthContext";
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

const DEFAULT_WELCOME_MESSAGE = `ក្រុមហ៊ុនទេសចរណ៍ អុិចផ្លរឺ

Explorer by SL

កញ្ចប់ធួរ | Tour Packages
សំបុត្រយន្តហោះ | Flight Booking
កក់សណ្ឋាគារ | Hotel Reservation
ធ្វើវីសាគ្រប់ប្រទេស | Visa Abroad
លិខិតឆ្លងដែន | Passport
ជួលខុនដូគ្រប់ប្រទេស | Condo Rental
អ្នកបកប្រែនិងនាំដើរលេង | Guide Service`;

const FacebookPages = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  // Telegram Bot state
  const [botStatus, setBotStatus] = useState<any>(null);
  const [botStatusLoading, setBotStatusLoading] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState(DEFAULT_WELCOME_MESSAGE);
  const [welcomeMessageLoading, setWelcomeMessageLoading] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);
  const [settingWebhook, setSettingWebhook] = useState(false);

  // Facebook config state
  const [fbConfig, setFbConfig] = useState({
    facebook_app_id: '',
    facebook_app_secret: '',
    facebook_system_user_token: '',
    facebook_verify_token: '',
  });
  const [fbConfigLoading, setFbConfigLoading] = useState(false);
  const [fbConfigSaving, setFbConfigSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [fbConfigDialogOpen, setFbConfigDialogOpen] = useState(false);
  
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

  // Telegram Bot functions
  const fetchBotStatus = async () => {
    setBotStatusLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-bot`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'get_status' }),
        }
      );
      const result = await response.json();
      if (result.success) {
        setBotStatus(result);
      } else {
        toast.error(result.error || 'Failed to fetch bot status');
      }
    } catch (err: any) {
      console.error('Error fetching bot status:', err);
      toast.error('Failed to fetch bot status');
    } finally {
      setBotStatusLoading(false);
    }
  };

  const fetchWelcomeMessage = async () => {
    setWelcomeMessageLoading(true);
    try {
      const { data, error } = await supabase
        .from('bot_settings')
        .select('value')
        .eq('key', 'telegram_welcome_message')
        .maybeSingle();
      
      if (error) throw error;
      if (data?.value) {
        setWelcomeMessage(data.value);
      }
    } catch (err: any) {
      console.error('Error fetching welcome message:', err);
    } finally {
      setWelcomeMessageLoading(false);
    }
  };

  const saveWelcomeMessage = async () => {
    setSavingMessage(true);
    try {
      const { data: existing } = await supabase
        .from('bot_settings')
        .select('id')
        .eq('key', 'telegram_welcome_message')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('bot_settings')
          .update({ value: welcomeMessage, updated_at: new Date().toISOString(), updated_by: user?.id })
          .eq('key', 'telegram_welcome_message');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('bot_settings')
          .insert({ key: 'telegram_welcome_message', value: welcomeMessage, updated_by: user?.id });
        if (error) throw error;
      }
      toast.success('Welcome message saved');
    } catch (err: any) {
      console.error('Error saving welcome message:', err);
      toast.error('Failed to save welcome message');
    } finally {
      setSavingMessage(false);
    }
  };

  const reRegisterWebhook = async () => {
    setSettingWebhook(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-bot`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_webhook' }),
        }
      );
      const result = await response.json();
      if (result.success) {
        toast.success('Webhook re-registered successfully');
        fetchBotStatus();
      } else {
        toast.error(result.error || 'Failed to set webhook');
      }
    } catch (err: any) {
      console.error('Error setting webhook:', err);
      toast.error('Failed to set webhook');
    } finally {
      setSettingWebhook(false);
    }
  };

  // Facebook config functions
  const fetchFbConfig = async () => {
    setFbConfigLoading(true);
    try {
      const keys = ['facebook_app_id', 'facebook_app_secret', 'facebook_system_user_token', 'facebook_verify_token'];
      const { data, error } = await supabase
        .from('bot_settings')
        .select('key, value')
        .in('key', keys);
      
      if (error) throw error;
      if (data) {
        const config = { ...fbConfig };
        data.forEach(row => {
          if (row.key in config) {
            (config as any)[row.key] = row.value;
          }
        });
        setFbConfig(config);
      }
    } catch (err: any) {
      console.error('Error fetching FB config:', err);
    } finally {
      setFbConfigLoading(false);
    }
  };

  const saveFbConfig = async () => {
    setFbConfigSaving(true);
    try {
      const entries = Object.entries(fbConfig).filter(([_, v]) => v.trim() !== '');
      
      for (const [key, value] of entries) {
        const { data: existing } = await supabase
          .from('bot_settings')
          .select('id')
          .eq('key', key)
          .maybeSingle();
        
        if (existing) {
          const { error } = await supabase
            .from('bot_settings')
            .update({ value, updated_at: new Date().toISOString(), updated_by: user?.id })
            .eq('key', key);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('bot_settings')
            .insert({ key, value, updated_by: user?.id });
          if (error) throw error;
        }
      }
      
      toast.success('Facebook configuration saved successfully');
    } catch (err: any) {
      console.error('Error saving FB config:', err);
      toast.error('Failed to save configuration');
    } finally {
      setFbConfigSaving(false);
    }
  };

  useEffect(() => {
    fetchPages();
    fetchAppInfo();
    fetchDbPages();
    fetchFbConfig();
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
              <h1 className="text-4xl font-bold text-foreground">System</h1>
              <p className="text-muted-foreground mt-2">
                Manage Facebook Pages and Telegram Bot settings
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="facebook-pages" onValueChange={(val) => {
          if (val === 'telegram-bot') {
            fetchBotStatus();
            fetchWelcomeMessage();
          }
        }}>
          <TabsList>
            <TabsTrigger value="facebook-pages" className="gap-2">
              <Facebook className="h-4 w-4" />
              Facebook Pages
            </TabsTrigger>
            <TabsTrigger value="telegram-bot" className="gap-2">
              <Bot className="h-4 w-4" />
              Telegram Bot
            </TabsTrigger>
          </TabsList>

          {/* Facebook Pages Tab */}
          <TabsContent value="facebook-pages">
            <div className="space-y-6">
              {/* Action buttons */}
              <div className="flex items-center justify-end gap-4">
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
                        { key: 'id', header: 'ID' },
                        { key: 'page_id', header: 'Page ID' },
                        { key: 'name', header: 'Page Name' },
                        { key: 'category', header: 'Category' },
                        { key: 'picture_url', header: 'Picture URL' },
                        { key: 'is_active', header: 'Active', getValue: (p) => p.is_active ? 'Yes' : 'No' },
                        { key: 'access_token', header: 'Access Token' },
                        { key: 'token_expires_at', header: 'Token Expires At', getValue: (p) => p.token_expires_at ? new Date(p.token_expires_at).toLocaleString() : '' },
                        { key: 'created_at', header: 'Created At', getValue: (p) => new Date(p.created_at).toLocaleString() },
                        { key: 'updated_at', header: 'Updated At', getValue: (p) => new Date(p.updated_at).toLocaleString() },
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
                        {isAdmin && (
                          <div className="pt-2 border-t">
                            <Button variant="outline" size="sm" onClick={() => setFbConfigDialogOpen(true)} className="gap-1">
                              <Settings className="h-4 w-4" />
                              Edit Configuration
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4 space-y-3">
                        <div className="text-muted-foreground text-sm">No app info available</div>
                        {isAdmin && (
                          <Button onClick={() => setFbConfigDialogOpen(true)} className="gap-2">
                            <Settings className="h-4 w-4" />
                            Configure App
                          </Button>
                        )}
                      </div>
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

              {/* Facebook Configuration Dialog - Admin Only */}
              <Dialog open={fbConfigDialogOpen} onOpenChange={setFbConfigDialogOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Facebook Configuration
                    </DialogTitle>
                    <DialogDescription>
                      Configure your Facebook App credentials. Update these after completing Facebook App Verification.
                    </DialogDescription>
                  </DialogHeader>
                  {fbConfigLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading configuration...
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <Alert>
                        <Shield className="h-4 w-4" />
                        <AlertDescription>
                          These credentials are stored securely in the database and used by the webhook to communicate with Facebook. Only admins can view or modify them.
                        </AlertDescription>
                      </Alert>

                      {/* Facebook App ID */}
                      <div className="space-y-2">
                        <Label htmlFor="fb-app-id" className="font-medium">Facebook App ID</Label>
                        <Input
                          id="fb-app-id"
                          value={fbConfig.facebook_app_id}
                          onChange={(e) => setFbConfig(prev => ({ ...prev, facebook_app_id: e.target.value }))}
                          placeholder="123456789012345"
                        />
                        <p className="text-xs text-muted-foreground flex items-start gap-1">
                          <Info className="h-3 w-3 mt-0.5 shrink-0" />
                          Found in your <strong>Facebook App Dashboard → Settings → Basic</strong>. A numeric ID like <code className="bg-muted px-1 rounded">123456789012345</code>.
                        </p>
                      </div>

                      {/* Facebook App Secret */}
                      <div className="space-y-2">
                        <Label htmlFor="fb-app-secret" className="font-medium">Facebook App Secret</Label>
                        <div className="relative">
                          <Input
                            id="fb-app-secret"
                            type={showSecret ? 'text' : 'password'}
                            value={fbConfig.facebook_app_secret}
                            onChange={(e) => setFbConfig(prev => ({ ...prev, facebook_app_secret: e.target.value }))}
                            placeholder="••••••••••••••••"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecret(!showSecret)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-start gap-1">
                          <Info className="h-3 w-3 mt-0.5 shrink-0" />
                          Found in <strong>App Dashboard → Settings → Basic → App Secret</strong>. Click "Show" to reveal it. Never share this publicly.
                        </p>
                      </div>

                      {/* System User Token */}
                      <div className="space-y-2">
                        <Label htmlFor="fb-sys-token" className="font-medium">System User Token</Label>
                        <div className="relative">
                          <Input
                            id="fb-sys-token"
                            type={showToken ? 'text' : 'password'}
                            value={fbConfig.facebook_system_user_token}
                            onChange={(e) => setFbConfig(prev => ({ ...prev, facebook_system_user_token: e.target.value }))}
                            placeholder="••••••••••••••••"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowToken(!showToken)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-start gap-1">
                          <Info className="h-3 w-3 mt-0.5 shrink-0" />
                          Generated in <strong>Business Settings → System Users → select user → Generate Token</strong>. Must have: <code className="bg-muted px-1 rounded">pages_messaging</code>, <code className="bg-muted px-1 rounded">pages_read_engagement</code>, <code className="bg-muted px-1 rounded">pages_manage_metadata</code>.
                        </p>
                      </div>

                      {/* Webhook Verify Token */}
                      <div className="space-y-2">
                        <Label htmlFor="fb-verify-token" className="font-medium">Webhook Verify Token</Label>
                        <Input
                          id="fb-verify-token"
                          value={fbConfig.facebook_verify_token}
                          onChange={(e) => setFbConfig(prev => ({ ...prev, facebook_verify_token: e.target.value }))}
                          placeholder="my-custom-verify-token"
                        />
                        <p className="text-xs text-muted-foreground flex items-start gap-1">
                          <Info className="h-3 w-3 mt-0.5 shrink-0" />
                          A custom string you create. Must match <strong>exactly</strong> what you entered in <strong>Facebook App Dashboard → Webhooks → Verify Token</strong> field.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Button onClick={saveFbConfig} disabled={fbConfigSaving}>
                          {fbConfigSaving ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-2" />
                          )}
                          {fbConfigSaving ? 'Saving...' : 'Save Configuration'}
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
              )}
            </div>
          </TabsContent>

          {/* Telegram Bot Tab */}
          <TabsContent value="telegram-bot">
            <div className="space-y-6">
              {/* Bot Status Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Bot Status
                  </CardTitle>
                  <CardDescription>
                    Current Telegram bot information and webhook status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {botStatusLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading bot status...
                    </div>
                  ) : botStatus ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">Bot Username</div>
                          <div className="font-medium">@{botStatus.bot?.username || 'Unknown'}</div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">Bot Name</div>
                          <div className="font-medium">{botStatus.bot?.first_name || 'Unknown'}</div>
                        </div>
                      </div>
                      
                      <div className="border-t pt-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Webhook className="h-4 w-4" />
                          Webhook Info
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">URL:</span>
                            <code className="text-xs bg-muted px-2 py-1 rounded break-all">
                              {botStatus.webhook?.url || 'Not set'}
                            </code>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Pending Updates:</span>
                            <Badge variant={botStatus.webhook?.pending_update_count > 0 ? "destructive" : "secondary"}>
                              {botStatus.webhook?.pending_update_count ?? 0}
                            </Badge>
                          </div>
                          {botStatus.webhook?.last_error_message && (
                            <div className="flex items-start gap-2">
                              <span className="text-sm text-muted-foreground">Last Error:</span>
                              <span className="text-sm text-destructive">{botStatus.webhook.last_error_message}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={fetchBotStatus} disabled={botStatusLoading}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Refresh
                        </Button>
                        <Button variant="outline" size="sm" onClick={reRegisterWebhook} disabled={settingWebhook}>
                          <Webhook className="h-4 w-4 mr-2" />
                          {settingWebhook ? 'Setting...' : 'Re-register Webhook'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      Click the Telegram Bot tab to load status.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Welcome Message Editor */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Welcome Message
                    {isAdmin && <Badge variant="secondary" className="ml-2">Admin Only</Badge>}
                  </CardTitle>
                  <CardDescription>
                    The message customers see when they start a conversation with the bot
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {welcomeMessageLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading...
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Textarea
                        value={welcomeMessage}
                        onChange={(e) => setWelcomeMessage(e.target.value)}
                        rows={10}
                        className="font-mono text-sm"
                        disabled={!isAdmin}
                        placeholder="Enter the welcome message..."
                      />
                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <Button onClick={saveWelcomeMessage} disabled={savingMessage}>
                            {savingMessage ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            {savingMessage ? 'Saving...' : 'Save Message'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setWelcomeMessage(DEFAULT_WELCOME_MESSAGE)}
                          >
                            Reset to Default
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
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
