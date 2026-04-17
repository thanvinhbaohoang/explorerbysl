import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { playMessageNotification, playNewCustomerNotification } from "@/lib/notification-sound";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Users, Bell, MessageSquare, Send, TrendingUp, BarChart3 } from "lucide-react";
import { TableSkeleton } from "@/components/TableSkeleton";

interface Customer {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  is_premium: boolean;
  first_message_at: string;
  created_at: string;
}

interface Message {
  id: string;
  customer_id: string;
  telegram_id: number;
  message_text: string | null;
  message_type: string;
  timestamp: string;
  created_at: string;
  photo_file_id: string | null;
  photo_url: string | null;
  voice_file_id: string | null;
  voice_duration: number | null;
  voice_transcription: string | null;
  voice_url: string | null;
  video_file_id: string | null;
  video_url: string | null;
  video_duration: number | null;
  video_mime_type: string | null;
  sender_type: string;
  is_read: boolean;
}

interface TrafficData {
  id: string;
  facebook_click_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  utm_adset_id: string | null;
  utm_ad_id: string | null;
  utm_campaign_id: string | null;
  referrer: string | null;
  created_at: string;
  customer: {
    id: string;
    telegram_id: number;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [trafficData, setTrafficData] = useState<TrafficData[]>([]);
  const [isLoadingTraffic, setIsLoadingTraffic] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [customersPage, setCustomersPage] = useState(1);
  const [trafficPage, setTrafficPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalTraffic, setTotalTraffic] = useState(0);
  const [trafficDataCached, setTrafficDataCached] = useState(false);
  const [hasNewCustomers, setHasNewCustomers] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const itemsPerPage = 10;

  // Fetch unread counts for all customers
  const fetchUnreadCounts = async () => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("customer_id")
        .eq("sender_type", "customer")
        .eq("is_read", false);

      if (error) {
        console.error("Error fetching unread counts:", error);
      } else if (data) {
        const counts: Record<string, number> = {};
        data.forEach((msg) => {
          counts[msg.customer_id] = (counts[msg.customer_id] || 0) + 1;
        });
        setUnreadCounts(counts);
      }
    } catch (err) {
      console.error("Error:", err);
    }
  };

  // Fetch customers with pagination
  const fetchCustomers = async (page: number) => {
    setIsLoading(true);
    try {
      // Get total count
      const { count, error: countError } = await supabase
        .from("customer")
        .select("*", { count: "exact", head: true });

      if (countError) throw countError;
      setTotalCustomers(count || 0);

      // Fetch paginated data
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data, error } = await supabase
        .from("customer")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      setCustomers(data || []);
      setHasNewCustomers(false);
    } catch (error: any) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to load customers");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch when page changes (including initial mount)
  useEffect(() => {
    console.log("Fetching customers for page:", customersPage);
    fetchCustomers(customersPage);
  }, [customersPage]);

  // Fetch unread counts on mount
  useEffect(() => {
    fetchUnreadCounts();
  }, []);

  // Fetch traffic data with pagination
  const fetchTrafficData = async (page: number) => {
    // Don't refetch if already cached
    if (trafficDataCached && page === trafficPage) return;
    
    setIsLoadingTraffic(true);
    try {
      // Get total count
      const { count, error: countError } = await supabase
        .from("telegram_leads")
        .select("*", { count: "exact", head: true });

      if (countError) throw countError;
      setTotalTraffic(count || 0);

      // Fetch paginated data
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data: leads, error } = await supabase
        .from("telegram_leads")
        .select("id, facebook_click_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_adset_id, utm_ad_id, utm_campaign_id, referrer, created_at, user_id")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Fetch customer data for each lead that has a user_id
      const trafficWithCustomers = await Promise.all(
        (leads || []).map(async (lead) => {
          if (lead.user_id) {
            const { data: customer } = await supabase
              .from("customer")
              .select("id, telegram_id, username, first_name, last_name")
              .eq("id", lead.user_id)
              .maybeSingle();

            return {
              id: lead.id,
              facebook_click_id: lead.facebook_click_id,
              utm_source: lead.utm_source,
              utm_medium: lead.utm_medium,
              utm_campaign: lead.utm_campaign,
              utm_content: lead.utm_content,
              utm_term: lead.utm_term,
              utm_adset_id: lead.utm_adset_id,
              utm_ad_id: lead.utm_ad_id,
              utm_campaign_id: lead.utm_campaign_id,
              referrer: lead.referrer,
              created_at: lead.created_at,
              customer,
            };
          }
          return {
            id: lead.id,
            facebook_click_id: lead.facebook_click_id,
            utm_source: lead.utm_source,
            utm_medium: lead.utm_medium,
            utm_campaign: lead.utm_campaign,
            utm_content: lead.utm_content,
            utm_term: lead.utm_term,
            utm_adset_id: lead.utm_adset_id,
            utm_ad_id: lead.utm_ad_id,
            utm_campaign_id: lead.utm_campaign_id,
            referrer: lead.referrer,
            created_at: lead.created_at,
            customer: null,
          };
        })
      );

      setTrafficData(trafficWithCustomers);
      setTrafficDataCached(true);
    } catch (error: any) {
      console.error("Error fetching traffic data:", error);
      toast.error("Failed to load traffic data");
    } finally {
      setIsLoadingTraffic(false);
    }
  };

  // Fetch traffic when page changes
  useEffect(() => {
    if (!trafficDataCached) {
      console.log("Fetching traffic for page:", trafficPage);
      fetchTrafficData(trafficPage);
    }
  }, [trafficPage, trafficDataCached]);

  // Send reply to customer
  const sendReply = async () => {
    if (!replyText.trim() || !selectedCustomer || isSending) return;

    setIsSending(true);
    try {
      const response = await supabase.functions.invoke("telegram-bot", {
        body: {
          action: "send_message",
          telegram_id: selectedCustomer.telegram_id,
          customer_id: selectedCustomer.id,
          message_text: replyText,
        },
      });

      if (response.error) throw response.error;

      toast.success("Message sent successfully!");
      setReplyText("");
      
      // Scroll to bottom after sending
      setTimeout(() => {
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  // Load messages for selected customer
  const loadMessages = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setDialogOpen(true);
    setIsLoadingMessages(true);

    try {
      // NOTE: Messages are NOT marked as read here. Read-marking only happens
      // when a user explicitly clicks a conversation in the /chat conversation list.
      // Reset unread count locally for this customer (purely UI state, DB unchanged)
      setUnreadCounts((prev) => ({
        ...prev,
        [customer.id]: 0,
      }));

      // Send typing indicator for Telegram customers to show staff is viewing
      if (customer.telegram_id) {
        try {
          await supabase.functions.invoke('telegram-bot', {
            body: {
              action: 'mark_seen',
              telegram_id: customer.telegram_id
            }
          });
        } catch (error) {
          console.error('Failed to send typing indicator:', error);
        }
      }

      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("customer_id", customer.id)
        .order("timestamp", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      
      // Scroll to bottom after loading
      setTimeout(() => {
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Real-time subscription for new customers - show toast notification
  useEffect(() => {
    const channel = supabase
      .channel("customer-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "customer",
        },
        (payload) => {
          const newCustomer = payload.new as Customer;
          console.log("New customer joined:", newCustomer);
          
          // Play new customer notification sound
          playNewCustomerNotification();
          
          setHasNewCustomers(true);
          
          const customerName = `${newCustomer.first_name || "Unknown"} ${newCustomer.last_name || ""}`.trim();
          
          // Show notification with navigate-to-chat action
          toast.success(
            `New customer: ${customerName}`,
            {
              description: "Click to start chatting",
              icon: <Bell className="h-4 w-4" />,
              duration: 8000,
              action: {
                label: "Chat Now",
                onClick: () => navigate(`/chat?customer=${newCustomer.id}`),
              },
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [navigate]);

  // Real-time subscription for ALL new customer messages
  useEffect(() => {
    const channel = supabase
      .channel("all-customer-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: "sender_type=eq.customer",
        },
        (payload) => {
          const newMessage = payload.new as Message;
          console.log("New customer message received:", newMessage);
          
          // Play notification sound
          playMessageNotification();
          
          // Update unread count
          setUnreadCounts((prev) => ({
            ...prev,
            [newMessage.customer_id]: (prev[newMessage.customer_id] || 0) + 1,
          }));

          // If this message is for the currently open dialog, show toast instead of auto-adding
          if (selectedCustomer?.id === newMessage.customer_id) {
            setHasNewMessages(true);
            toast.info("New message received", {
              description: "Click to refresh the conversation",
              action: {
                label: "Refresh",
                onClick: () => loadMessages(selectedCustomer),
              },
            });
          } else {
            // Show toast notification for messages from other customers with navigate action
            const customer = customers.find((c) => c.id === newMessage.customer_id);
            const customerName = customer?.first_name || "Customer";
            
            toast.success("New message received", {
              description: `${customerName} sent a message`,
              icon: <Bell className="h-4 w-4" />,
              action: {
                label: "Open Chat",
                onClick: () => navigate(`/chat?customer=${newMessage.customer_id}`),
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCustomer, customers, navigate]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Pagination calculations (data is already paginated from DB)
  const totalCustomerPages = Math.ceil(totalCustomers / itemsPerPage);
  const totalTrafficPages = Math.ceil(totalTraffic / itemsPerPage);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading customers...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Monitor your Telegram bot customers and traffic
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-5 w-5" />
              <span className="text-2xl font-semibold">{totalCustomers}</span>
              <span>Total Customers</span>
            </div>
            {hasNewCustomers && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchCustomers(customersPage)}
                className="animate-pulse"
              >
                <Bell className="h-4 w-4 mr-2" />
                New Updates
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="customers" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="customers">
              <Users className="h-4 w-4 mr-2" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="traffic" onClick={() => !trafficDataCached && fetchTrafficData(trafficPage)}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Customer Traffic
            </TabsTrigger>
            <TabsTrigger value="ads" onClick={() => navigate('/ads-insight')}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Ad Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers">
            <Card>
              <CardHeader>
                <CardTitle>Customer List</CardTitle>
                <CardDescription>
                  All customers who have interacted with your bot
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <TableSkeleton rows={10} columns={7} />
                ) : customers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No customers yet. Share your bot to get started!
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Telegram ID</TableHead>
                          <TableHead>Language</TableHead>
                          <TableHead>Premium</TableHead>
                          <TableHead>First Message</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.map((customer) => (
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">
                              {customer.first_name} {customer.last_name}
                            </TableCell>
                            <TableCell>
                              {customer.username ? (
                                <span className="text-muted-foreground">
                                  @{customer.username}
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">
                                  No username
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {customer.telegram_id}
                              </code>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {customer.language_code || "Unknown"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {customer.is_premium ? (
                                <Badge variant="default">Premium</Badge>
                              ) : (
                                <Badge variant="secondary">Standard</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(customer.first_message_at)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => loadMessages(customer)}
                                className="relative"
                              >
                                <MessageSquare className="h-4 w-4 mr-2" />
                                Telegram
                                {unreadCounts[customer.id] > 0 && (
                                  <Badge
                                    variant="destructive"
                                    className="ml-2 px-1.5 py-0 h-5 min-w-5 flex items-center justify-center"
                                  >
                                    {unreadCounts[customer.id]}
                                  </Badge>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {totalCustomers > itemsPerPage && (
                  <div className="mt-4 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCustomersPage((prev) => Math.max(1, prev - 1))}
                            className={customersPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: totalCustomerPages }, (_, i) => i + 1).map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCustomersPage(page)}
                              isActive={page === customersPage}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCustomersPage((prev) => Math.min(totalCustomerPages, prev + 1))}
                            className={customersPage === totalCustomerPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="traffic">
            <Card>
              <CardHeader>
                <CardTitle>Customer Traffic</CardTitle>
                <CardDescription>
                  Ad source tracking and customer acquisition data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingTraffic ? (
                  <TableSkeleton rows={10} columns={6} />
                ) : trafficData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No traffic data yet.
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Token ID</TableHead>
                          <TableHead>Ad Source</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Telegram ID</TableHead>
                          <TableHead>Username</TableHead>
                          <TableHead>Created At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trafficData.map((traffic) => (
                          <TableRow key={traffic.id}>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {traffic.id.slice(0, 8)}...
                              </code>
                            </TableCell>
                            <TableCell>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-help">
                                      {traffic.facebook_click_id ? (
                                        <Badge variant="default">
                                          FB: {traffic.facebook_click_id.slice(0, 12)}...
                                        </Badge>
                                      ) : traffic.utm_source ? (
                                        <Badge variant="default" className="capitalize">
                                          {traffic.utm_source}
                                        </Badge>
                                      ) : (
                                        <Badge variant="secondary">Direct</Badge>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-md p-4" side="right">
                                    <div className="space-y-2 text-sm">
                                      <div className="font-semibold text-foreground border-b pb-2">
                                        Tracking Information
                                      </div>
                                      {traffic.facebook_click_id && (
                                        <div>
                                          <span className="font-semibold">Facebook Click ID:</span>
                                          <div className="text-xs font-mono text-muted-foreground break-all mt-1">
                                            {traffic.facebook_click_id}
                                          </div>
                                        </div>
                                      )}
                                      {traffic.utm_source && (
                                        <div>
                                          <span className="font-semibold">UTM Source:</span>
                                          <span className="ml-2 text-muted-foreground">{traffic.utm_source}</span>
                                        </div>
                                      )}
                                      {traffic.utm_medium && (
                                        <div>
                                          <span className="font-semibold">UTM Medium:</span>
                                          <span className="ml-2 text-muted-foreground">{traffic.utm_medium}</span>
                                        </div>
                                      )}
                                      {traffic.utm_campaign && (
                                        <div>
                                          <span className="font-semibold">UTM Campaign:</span>
                                          <span className="ml-2 text-muted-foreground">{traffic.utm_campaign}</span>
                                        </div>
                                      )}
                                      {traffic.utm_campaign_id && (
                                        <div>
                                          <span className="font-semibold">Campaign ID:</span>
                                          <span className="ml-2 text-muted-foreground font-mono">{traffic.utm_campaign_id}</span>
                                        </div>
                                      )}
                                      {traffic.utm_adset_id && (
                                        <div>
                                          <span className="font-semibold">Ad Set ID:</span>
                                          <span className="ml-2 text-muted-foreground font-mono">{traffic.utm_adset_id}</span>
                                        </div>
                                      )}
                                      {traffic.utm_ad_id && (
                                        <div>
                                          <span className="font-semibold">Ad ID:</span>
                                          <span className="ml-2 text-muted-foreground font-mono">{traffic.utm_ad_id}</span>
                                        </div>
                                      )}
                                      {traffic.utm_content && (
                                        <div>
                                          <span className="font-semibold">UTM Content:</span>
                                          <span className="ml-2 text-muted-foreground">{traffic.utm_content}</span>
                                        </div>
                                      )}
                                      {traffic.utm_term && (
                                        <div>
                                          <span className="font-semibold">UTM Term:</span>
                                          <span className="ml-2 text-muted-foreground">{traffic.utm_term}</span>
                                        </div>
                                      )}
                                      {traffic.referrer && (
                                        <div>
                                          <span className="font-semibold">Referrer:</span>
                                          <div className="text-xs text-muted-foreground break-all mt-1">
                                            {traffic.referrer}
                                          </div>
                                        </div>
                                      )}
                                      {!traffic.facebook_click_id && 
                                       !traffic.utm_source && 
                                       !traffic.utm_medium && 
                                       !traffic.utm_campaign && 
                                       !traffic.referrer && (
                                        <div className="text-muted-foreground italic">
                                          No tracking data available
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                            <TableCell className="font-medium">
                              {traffic.customer ? (
                                `${traffic.customer.first_name || ''} ${traffic.customer.last_name || ''}`
                              ) : (
                                <span className="text-muted-foreground italic">Not linked</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {traffic.customer ? (
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {traffic.customer.telegram_id}
                                </code>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {traffic.customer?.username ? (
                                <span className="text-muted-foreground">
                                  @{traffic.customer.username}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDate(traffic.created_at)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {totalTraffic > itemsPerPage && (
                  <div className="mt-4 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setTrafficPage((prev) => Math.max(1, prev - 1))}
                            className={trafficPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: totalTrafficPages }, (_, i) => i + 1).map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setTrafficPage(page)}
                              isActive={page === trafficPage}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setTrafficPage((prev) => Math.min(totalTrafficPages, prev + 1))}
                            className={trafficPage === totalTrafficPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Messages Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Messages from {selectedCustomer?.first_name}{" "}
              {selectedCustomer?.last_name}
            </DialogTitle>
            <DialogDescription>
              @{selectedCustomer?.username || "No username"} • Telegram ID:{" "}
              {selectedCustomer?.telegram_id}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {isLoadingMessages ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No messages yet
              </div>
            ) : (
              <div 
                id="messages-container"
                className="space-y-4 max-h-[400px] overflow-y-auto"
              >
                {messages.map((message) => (
                <div
                  key={message.id}
                  className={`border rounded-lg p-4 space-y-3 ${
                    message.sender_type === 'employee' 
                      ? 'bg-primary/5 ml-8' 
                      : 'mr-8'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={message.sender_type === 'employee' ? 'default' : 'outline'}>
                        {message.sender_type === 'employee' ? 'You' : message.message_type}
                      </Badge>
                      {message.sender_type === 'employee' && (
                        <span className="text-xs text-muted-foreground">Employee Reply</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(message.timestamp)}
                    </span>
                  </div>

                  {/* Photo display */}
                  {message.message_type === 'photo' && message.photo_url && (
                    <div className="rounded-md overflow-hidden border">
                      <img 
                        src={message.photo_url} 
                        alt="Message photo" 
                        className="w-full max-h-96 object-contain bg-muted"
                      />
                    </div>
                  )}

                  {/* Voice message display */}
                  {message.message_type === 'voice' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
                        <MessageSquare className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="text-sm font-medium">Voice Message</div>
                          <div className="text-xs text-muted-foreground">
                            Duration: {message.voice_duration}s
                          </div>
                        </div>
                      </div>
                      {message.voice_url && (
                        <audio 
                          controls 
                          className="w-full"
                          preload="metadata"
                        >
                          <source src={message.voice_url} type="audio/ogg" />
                          Your browser does not support the audio element.
                        </audio>
                      )}
                      {message.voice_transcription && (
                        <div className="text-sm mt-2 p-2 bg-muted/50 rounded italic">
                          "{message.voice_transcription}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Video message display */}
                  {message.message_type === 'video' && message.video_url && (
                    <div className="rounded-md overflow-hidden border">
                      <video 
                        controls 
                        className="w-full max-h-96 bg-muted"
                        preload="metadata"
                      >
                        <source src={message.video_url} type={message.video_mime_type || 'video/mp4'} />
                        Your browser does not support the video element.
                      </video>
                      {message.video_duration && (
                        <div className="text-xs text-muted-foreground p-2 bg-muted/50">
                          Duration: {message.video_duration}s
                        </div>
                      )}
                    </div>
                  )}

                  {/* Text content - only show for text messages or as caption */}
                  {message.message_text && message.message_type === 'text' && (
                    <div className="text-sm">
                      {message.message_text}
                    </div>
                  )}
                  
                  {/* Caption for photos */}
                  {message.message_text && message.message_type === 'photo' && message.message_text !== '[Photo]' && (
                    <div className="text-sm text-muted-foreground italic">
                      {message.message_text}
                    </div>
                  )}
                </div>
              ))}
              </div>
            )}
          </div>

          {/* Reply Input */}
          {selectedCustomer && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder="Type your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                  disabled={isSending}
                />
                <Button 
                  onClick={sendReply} 
                  disabled={!replyText.trim() || isSending}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to send • This will be sent via Telegram bot
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
