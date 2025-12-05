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

interface LinkedCustomer {
  id: string;
  telegram_id: number | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  messenger_id: string | null;
  messenger_name: string | null;
  messenger_profile_pic: string | null;
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
}

interface MessageStats {
  total: number;
  fromCustomer: number;
  fromEmployee: number;
  lastMessageAt: string | null;
}

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [linkedCustomers, setLinkedCustomers] = useState<LinkedCustomer[]>([]);
  const [leadSource, setLeadSource] = useState<LeadSource | null>(null);
  const [messageStats, setMessageStats] = useState<MessageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCustomerData(id);
    }
  }, [id]);

  const fetchCustomerData = async (customerId: string) => {
    setIsLoading(true);
    try {
      // Fetch customer
      const { data: customerData, error: customerError } = await supabase
        .from("customer")
        .select("*")
        .eq("id", customerId)
        .maybeSingle();

      if (customerError) throw customerError;
      if (!customerData) {
        toast.error("Customer not found");
        navigate("/customers");
        return;
      }

      setCustomer(customerData);

      // Fetch linked customers (both directions)
      await fetchLinkedCustomers(customerData);

      // Fetch lead source
      const { data: leadData } = await supabase
        .from("telegram_leads")
        .select("*")
        .eq("user_id", customerId)
        .maybeSingle();

      setLeadSource(leadData);

      // Fetch message stats (including linked customers)
      await fetchMessageStats(customerId, customerData.linked_customer_id);
    } catch (error) {
      console.error("Error fetching customer:", error);
      toast.error("Failed to load customer data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLinkedCustomers = async (customerData: Customer) => {
    const linked: LinkedCustomer[] = [];
    
    // If this customer links to another (primary)
    if (customerData.linked_customer_id) {
      const { data: primary } = await supabase
        .from("customer")
        .select("id, telegram_id, first_name, last_name, username, messenger_id, messenger_name, messenger_profile_pic")
        .eq("id", customerData.linked_customer_id)
        .maybeSingle();
      
      if (primary) linked.push(primary);
    }
    
    // Find customers that link to this one
    const { data: linkedToThis } = await supabase
      .from("customer")
      .select("id, telegram_id, first_name, last_name, username, messenger_id, messenger_name, messenger_profile_pic")
      .eq("linked_customer_id", customerData.id);
    
    if (linkedToThis) linked.push(...linkedToThis);
    
    setLinkedCustomers(linked);
  };

  const fetchMessageStats = async (customerId: string, linkedCustomerId: string | null) => {
    // Get all customer IDs to include in stats (this + linked)
    const customerIds = [customerId];
    
    if (linkedCustomerId) {
      customerIds.push(linkedCustomerId);
    }
    
    // Also check for customers that link to this one
    const { data: linkedToThis } = await supabase
      .from("customer")
      .select("id")
      .eq("linked_customer_id", customerId);
    
    if (linkedToThis) {
      customerIds.push(...linkedToThis.map(c => c.id));
    }

    const { data: messages } = await supabase
      .from("messages")
      .select("sender_type, timestamp")
      .in("customer_id", customerIds);

    if (messages) {
      const stats: MessageStats = {
        total: messages.length,
        fromCustomer: messages.filter(m => m.sender_type === "customer").length,
        fromEmployee: messages.filter(m => m.sender_type === "employee").length,
        lastMessageAt: messages.length > 0 
          ? messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp
          : null,
      };
      setMessageStats(stats);
    }
  };

  const unlinkCustomer = async (linkedId: string) => {
    try {
      // Remove the link
      const { error } = await supabase
        .from("customer")
        .update({ linked_customer_id: null })
        .eq("id", linkedId);

      if (error) throw error;

      toast.success("Customer unlinked successfully");
      if (id) fetchCustomerData(id);
    } catch (error) {
      console.error("Error unlinking customer:", error);
      toast.error("Failed to unlink customer");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const platform = customer?.messenger_id ? "messenger" : "telegram";

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

  if (!customer) return null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/customers")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            {customer.messenger_profile_pic ? (
              <img 
                src={customer.messenger_profile_pic} 
                alt="Profile" 
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">
                {customer.messenger_name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Unknown"}
              </h1>
              <Badge variant={platform === "messenger" ? "default" : "secondary"} className="mt-1">
                {platform === "messenger" ? (
                  <><Facebook className="h-3 w-3 mr-1" /> Messenger</>
                ) : (
                  <><Send className="h-3 w-3 mr-1" /> Telegram</>
                )}
              </Badge>
            </div>
          </div>
          {customer.is_premium && (
            <Badge variant="default" className="ml-auto">
              <Crown className="h-3 w-3 mr-1" /> Premium
            </Badge>
          )}
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem label="Customer ID" value={customer.id} icon={<Hash className="h-4 w-4" />} />
            {platform === "messenger" ? (
              <>
                <InfoItem label="Messenger PSID" value={customer.messenger_id} icon={<Facebook className="h-4 w-4" />} />
                <InfoItem label="Name" value={customer.messenger_name} icon={<User className="h-4 w-4" />} />
              </>
            ) : (
              <>
                <InfoItem label="Telegram ID" value={customer.telegram_id?.toString()} icon={<Send className="h-4 w-4" />} />
                <InfoItem label="Username" value={customer.username ? `@${customer.username}` : null} icon={<User className="h-4 w-4" />} />
                <InfoItem label="First Name" value={customer.first_name} icon={<User className="h-4 w-4" />} />
                <InfoItem label="Last Name" value={customer.last_name} icon={<User className="h-4 w-4" />} />
              </>
            )}
            <InfoItem 
              label="Language" 
              value={platform === "messenger" ? customer.locale : customer.language_code} 
              icon={<Globe className="h-4 w-4" />} 
            />
            {customer.timezone_offset !== null && (
              <InfoItem 
                label="Timezone" 
                value={`UTC${customer.timezone_offset >= 0 ? "+" : ""}${customer.timezone_offset}`} 
                icon={<MapPin className="h-4 w-4" />} 
              />
            )}
          </CardContent>
        </Card>

        {/* Timestamps */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoItem label="First Message" value={formatDate(customer.first_message_at)} icon={<Clock className="h-4 w-4" />} />
            <InfoItem label="Created At" value={formatDate(customer.created_at)} icon={<Calendar className="h-4 w-4" />} />
            <InfoItem label="Last Updated" value={formatDate(customer.updated_at)} icon={<Clock className="h-4 w-4" />} />
            {messageStats?.lastMessageAt && (
              <InfoItem label="Last Message" value={formatDate(messageStats.lastMessageAt)} icon={<MessageSquare className="h-4 w-4" />} />
            )}
          </CardContent>
        </Card>

        {/* Message Stats */}
        {messageStats && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Message Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-3xl font-bold">{messageStats.total}</div>
                <div className="text-sm text-muted-foreground">Total Messages</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-3xl font-bold">{messageStats.fromCustomer}</div>
                <div className="text-sm text-muted-foreground">From Customer</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="text-3xl font-bold">{messageStats.fromEmployee}</div>
                <div className="text-sm text-muted-foreground">From Employee</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lead Source */}
        {leadSource && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Lead Source & Attribution
              </CardTitle>
              <CardDescription>How this customer found you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  <Separator />
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
            </CardContent>
          </Card>
        )}

        {/* Linked Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Linked Accounts
            </CardTitle>
            <CardDescription>
              Cross-platform accounts for the same customer
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkedCustomers.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">No linked accounts</p>
                <Button onClick={() => setLinkDialogOpen(true)}>
                  <Link className="h-4 w-4 mr-2" />
                  Link Customer Account
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {linkedCustomers.map((linked) => {
                  const linkedPlatform = linked.messenger_id ? "messenger" : "telegram";
                  const linkedName = linked.messenger_name || 
                    `${linked.first_name || ""} ${linked.last_name || ""}`.trim() || 
                    linked.username || "Unknown";
                  
                  return (
                    <div key={linked.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-3">
                        {linked.messenger_profile_pic ? (
                          <img
                            src={linked.messenger_profile_pic}
                            alt="Profile"
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <button 
                            onClick={() => navigate(`/customers/${linked.id}`)}
                            className="font-medium hover:underline hover:text-primary"
                          >
                            {linkedName}
                          </button>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={linkedPlatform === "messenger" ? "default" : "secondary"}>
                              {linkedPlatform === "messenger" ? (
                                <><Facebook className="h-3 w-3 mr-1" /> Messenger</>
                              ) : (
                                <><Send className="h-3 w-3 mr-1" /> Telegram</>
                              )}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unlinkCustomer(linked.id)}
                      >
                        <Unlink className="h-4 w-4 mr-1" />
                        Unlink
                      </Button>
                    </div>
                  );
                })}
                <Button variant="outline" onClick={() => setLinkDialogOpen(true)} className="w-full">
                  <Link className="h-4 w-4 mr-2" />
                  Link Another Account
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={() => navigate("/customers")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
        </div>
      </div>

      {/* Link Customer Dialog */}
      {customer && (
        <LinkCustomerDialog
          open={linkDialogOpen}
          onOpenChange={setLinkDialogOpen}
          currentCustomer={customer}
          onLinked={() => id && fetchCustomerData(id)}
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
