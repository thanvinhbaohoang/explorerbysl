import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { LinkCustomerDialog } from "@/components/LinkCustomerDialog";
import { 
  ArrowLeft, 
  Facebook, 
  Send, 
  User, 
  Globe, 
  Clock, 
  Calendar,
  MessageSquare,
  Crown,
  Hash,
  MapPin,
  Image as ImageIcon,
  Link,
  Unlink
} from "lucide-react";

interface Customer {
  id: string;
  telegram_id: number | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  is_premium: boolean;
  first_message_at: string;
  created_at: string;
  updated_at: string;
  messenger_id: string | null;
  messenger_name: string | null;
  messenger_profile_pic: string | null;
  locale: string | null;
  timezone_offset: number | null;
  linked_customer_id: string | null;
}

interface LeadSource {
  id: string;
  platform: string;
  messenger_ref: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  ad_id: string | null;
  ad_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  facebook_click_id: string | null;
  created_at: string;
  user_id: string;
}

interface MessageStats {
  total: number;
  fromCustomer: number;
  fromEmployee: number;
  lastMessageAt: string | null;
}

// Unified customer data combining all linked accounts
interface UnifiedCustomerData {
  primaryCustomer: Customer;
  allCustomers: Customer[];
  telegramAccounts: Customer[];
  messengerAccounts: Customer[];
  allLeadSources: LeadSource[];
  combinedStats: MessageStats | null;
}

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [unifiedData, setUnifiedData] = useState<UnifiedCustomerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchUnifiedCustomerData(id);
    }
  }, [id]);

  const fetchUnifiedCustomerData = async (customerId: string) => {
    setIsLoading(true);
    try {
      // Fetch the requested customer
      const { data: primaryCustomer, error: customerError } = await supabase
        .from("customer")
        .select("*")
        .eq("id", customerId)
        .maybeSingle();

      if (customerError) throw customerError;
      if (!primaryCustomer) {
        toast.error("Customer not found");
        navigate("/customers");
        return;
      }

      // Collect all linked customer IDs
      const allCustomerIds = new Set<string>([customerId]);
      
      // If this customer links to another, add that
      if (primaryCustomer.linked_customer_id) {
        allCustomerIds.add(primaryCustomer.linked_customer_id);
      }
      
      // Find customers that link to this one
      const { data: linkedToThis } = await supabase
        .from("customer")
        .select("id")
        .eq("linked_customer_id", customerId);
      
      linkedToThis?.forEach(c => allCustomerIds.add(c.id));
      
      // Also check if we linked to another customer, find others that link to the same
      if (primaryCustomer.linked_customer_id) {
        const { data: siblingLinks } = await supabase
          .from("customer")
          .select("id")
          .eq("linked_customer_id", primaryCustomer.linked_customer_id);
        siblingLinks?.forEach(c => allCustomerIds.add(c.id));
      }

      // Fetch all related customers
      const { data: allCustomers } = await supabase
        .from("customer")
        .select("*")
        .in("id", Array.from(allCustomerIds));

      if (!allCustomers) {
        setUnifiedData({
          primaryCustomer,
          allCustomers: [primaryCustomer],
          telegramAccounts: primaryCustomer.telegram_id ? [primaryCustomer] : [],
          messengerAccounts: primaryCustomer.messenger_id ? [primaryCustomer] : [],
          allLeadSources: [],
          combinedStats: null,
        });
        setIsLoading(false);
        return;
      }

      // Separate by platform
      const telegramAccounts = allCustomers.filter(c => c.telegram_id !== null);
      const messengerAccounts = allCustomers.filter(c => c.messenger_id !== null);

      // Fetch all lead sources for all related customers
      const { data: allLeadSources } = await supabase
        .from("telegram_leads")
        .select("*")
        .in("user_id", Array.from(allCustomerIds));

      // Fetch combined message stats
      const { data: messages } = await supabase
        .from("messages")
        .select("sender_type, timestamp")
        .in("customer_id", Array.from(allCustomerIds));

      let combinedStats: MessageStats | null = null;
      if (messages && messages.length > 0) {
        combinedStats = {
          total: messages.length,
          fromCustomer: messages.filter(m => m.sender_type === "customer").length,
          fromEmployee: messages.filter(m => m.sender_type === "employee").length,
          lastMessageAt: messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp,
        };
      }

      setUnifiedData({
        primaryCustomer,
        allCustomers,
        telegramAccounts,
        messengerAccounts,
        allLeadSources: allLeadSources || [],
        combinedStats,
      });
    } catch (error) {
      console.error("Error fetching customer:", error);
      toast.error("Failed to load customer data");
    } finally {
      setIsLoading(false);
    }
  };

  const unlinkCustomer = async (linkedId: string) => {
    try {
      const { error } = await supabase
        .from("customer")
        .update({ linked_customer_id: null })
        .eq("id", linkedId);

      if (error) throw error;

      toast.success("Customer unlinked successfully");
      if (id) fetchUnifiedCustomerData(id);
    } catch (error) {
      console.error("Error unlinking customer:", error);
      toast.error("Failed to unlink customer");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Determine primary display name from all accounts
  const getDisplayName = () => {
    if (!unifiedData) return "Unknown";
    const { telegramAccounts, messengerAccounts } = unifiedData;
    
    // Prefer Messenger name as it's usually fuller
    if (messengerAccounts.length > 0 && messengerAccounts[0].messenger_name) {
      return messengerAccounts[0].messenger_name;
    }
    if (telegramAccounts.length > 0) {
      const tg = telegramAccounts[0];
      return `${tg.first_name || ""} ${tg.last_name || ""}`.trim() || tg.username || "Unknown";
    }
    return "Unknown";
  };

  // Get profile picture (prefer Messenger)
  const getProfilePic = () => {
    if (!unifiedData) return null;
    const messenger = unifiedData.messengerAccounts.find(c => c.messenger_profile_pic);
    return messenger?.messenger_profile_pic || null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!unifiedData) return null;

  const { telegramAccounts, messengerAccounts, combinedStats, allLeadSources } = unifiedData;
  const hasBothPlatforms = telegramAccounts.length > 0 && messengerAccounts.length > 0;
  const profilePic = getProfilePic();
  const displayName = getDisplayName();

  // Get earliest first message
  const earliestFirstMessage = unifiedData.allCustomers
    .map(c => new Date(c.first_message_at))
    .sort((a, b) => a.getTime() - b.getTime())[0];
  
  // Check if any account is premium
  const isPremium = unifiedData.allCustomers.some(c => c.is_premium);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/customers")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            {profilePic ? (
              <img 
                src={profilePic} 
                alt="Profile" 
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{displayName}</h1>
              <div className="flex items-center gap-2 mt-1">
                {telegramAccounts.length > 0 && (
                  <Badge variant="secondary">
                    <Send className="h-3 w-3 mr-1" /> Telegram
                  </Badge>
                )}
                {messengerAccounts.length > 0 && (
                  <Badge variant="default">
                    <Facebook className="h-3 w-3 mr-1" /> Messenger
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {isPremium && (
            <Badge variant="default" className="ml-auto">
              <Crown className="h-3 w-3 mr-1" /> Premium
            </Badge>
          )}
        </div>

        {/* Telegram Account(s) */}
        {telegramAccounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Telegram Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              {telegramAccounts.map((account, idx) => (
                <div key={account.id} className={idx > 0 ? "mt-4 pt-4 border-t" : ""}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoItem label="Telegram ID" value={account.telegram_id?.toString()} icon={<Hash className="h-4 w-4" />} />
                    <InfoItem label="Username" value={account.username ? `@${account.username}` : null} icon={<User className="h-4 w-4" />} />
                    <InfoItem label="First Name" value={account.first_name} icon={<User className="h-4 w-4" />} />
                    <InfoItem label="Last Name" value={account.last_name} icon={<User className="h-4 w-4" />} />
                    <InfoItem label="Language" value={account.language_code} icon={<Globe className="h-4 w-4" />} />
                    {account.is_premium && (
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-yellow-500" />
                        <span className="font-medium">Premium Account</span>
                      </div>
                    )}
                  </div>
                  {hasBothPlatforms && account.linked_customer_id && (
                    <div className="mt-3 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => unlinkCustomer(account.id)}>
                        <Unlink className="h-4 w-4 mr-1" /> Unlink
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Messenger Account(s) */}
        {messengerAccounts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Facebook className="h-5 w-5" />
                Messenger Account
              </CardTitle>
            </CardHeader>
            <CardContent>
              {messengerAccounts.map((account, idx) => (
                <div key={account.id} className={idx > 0 ? "mt-4 pt-4 border-t" : ""}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoItem label="Messenger PSID" value={account.messenger_id} icon={<Hash className="h-4 w-4" />} />
                    <InfoItem label="Name" value={account.messenger_name} icon={<User className="h-4 w-4" />} />
                    <InfoItem label="Locale" value={account.locale} icon={<Globe className="h-4 w-4" />} />
                    {account.timezone_offset !== null && (
                      <InfoItem 
                        label="Timezone" 
                        value={`UTC${account.timezone_offset >= 0 ? "+" : ""}${account.timezone_offset}`} 
                        icon={<MapPin className="h-4 w-4" />} 
                      />
                    )}
                    {account.messenger_profile_pic && (
                      <div className="col-span-2">
                        <img 
                          src={account.messenger_profile_pic} 
                          alt="Messenger Profile" 
                          className="h-16 w-16 rounded-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                  {hasBothPlatforms && account.linked_customer_id && (
                    <div className="mt-3 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => unlinkCustomer(account.id)}>
                        <Unlink className="h-4 w-4 mr-1" /> Unlink
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem label="First Message" value={formatDate(earliestFirstMessage.toISOString())} icon={<Clock className="h-4 w-4" />} />
            {combinedStats?.lastMessageAt && (
              <InfoItem label="Last Message" value={formatDate(combinedStats.lastMessageAt)} icon={<MessageSquare className="h-4 w-4" />} />
            )}
          </CardContent>
        </Card>

        {/* Message Stats (Combined) */}
        {combinedStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Message Statistics
                {hasBothPlatforms && (
                  <Badge variant="outline" className="ml-2 text-xs">Combined</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-3xl font-bold">{combinedStats.total}</div>
                <div className="text-sm text-muted-foreground">Total Messages</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-3xl font-bold">{combinedStats.fromCustomer}</div>
                <div className="text-sm text-muted-foreground">From Customer</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-3xl font-bold">{combinedStats.fromEmployee}</div>
                <div className="text-sm text-muted-foreground">From Employee</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lead Sources (All Platforms) */}
        {allLeadSources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Lead Sources & Attribution
              </CardTitle>
              <CardDescription>How this customer found you across all platforms</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {allLeadSources.map((leadSource, idx) => {
                const sourceCustomer = unifiedData.allCustomers.find(c => c.id === leadSource.user_id);
                const sourcePlatform = sourceCustomer?.messenger_id ? 'Messenger' : 'Telegram';
                
                return (
                  <div key={leadSource.id} className={idx > 0 ? "pt-4 border-t" : ""}>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant={sourcePlatform === 'Messenger' ? 'default' : 'secondary'}>
                        {sourcePlatform === 'Messenger' ? <Facebook className="h-3 w-3 mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                        {sourcePlatform}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoItem label="Platform" value={leadSource.platform} />
                      {leadSource.campaign_name && <InfoItem label="Campaign" value={leadSource.campaign_name} />}
                      {leadSource.campaign_id && <InfoItem label="Campaign ID" value={leadSource.campaign_id} />}
                      {leadSource.adset_name && <InfoItem label="Ad Set" value={leadSource.adset_name} />}
                      {leadSource.adset_id && <InfoItem label="Ad Set ID" value={leadSource.adset_id} />}
                      {leadSource.ad_name && <InfoItem label="Ad" value={leadSource.ad_name} />}
                      {leadSource.ad_id && <InfoItem label="Ad ID" value={leadSource.ad_id} />}
                      {leadSource.messenger_ref && <InfoItem label="Messenger Ref" value={leadSource.messenger_ref} />}
                      {leadSource.referrer && <InfoItem label="Referrer" value={leadSource.referrer} />}
                      {leadSource.facebook_click_id && <InfoItem label="Facebook Click ID" value={leadSource.facebook_click_id} />}
                    </div>

                    {(leadSource.utm_source || leadSource.utm_medium || leadSource.utm_campaign) && (
                      <>
                        <Separator className="my-4" />
                        <div>
                          <h4 className="font-semibold mb-3">UTM Parameters</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {leadSource.utm_source && <InfoItem label="Source" value={leadSource.utm_source} />}
                            {leadSource.utm_medium && <InfoItem label="Medium" value={leadSource.utm_medium} />}
                            {leadSource.utm_campaign && <InfoItem label="Campaign" value={leadSource.utm_campaign} />}
                            {leadSource.utm_content && <InfoItem label="Content" value={leadSource.utm_content} />}
                            {leadSource.utm_term && <InfoItem label="Term" value={leadSource.utm_term} />}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Link Account Action */}
        {!hasBothPlatforms && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link className="h-5 w-5" />
                Link Another Platform
              </CardTitle>
              <CardDescription>
                Connect this customer's account from another platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setLinkDialogOpen(true)}>
                <Link className="h-4 w-4 mr-2" />
                Link {messengerAccounts.length > 0 ? 'Telegram' : 'Messenger'} Account
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={() => navigate("/customers")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
      </div>

      {/* Link Customer Dialog */}
      {unifiedData.primaryCustomer && (
        <LinkCustomerDialog
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
          currentCustomer={unifiedData.primaryCustomer}
          onLinked={() => id && fetchUnifiedCustomerData(id)}
        />
      )}
    </div>
  );
};

const InfoItem = ({ 
  label, 
  value, 
  icon 
}: { 
  label: string; 
  value: string | null | undefined; 
  icon?: React.ReactNode;
}) => {
  if (!value) return null;
  
  return (
    <div className="space-y-1">
      <div className="text-sm text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="font-medium break-all">{value}</div>
    </div>
  );
};

export default CustomerDetail;
