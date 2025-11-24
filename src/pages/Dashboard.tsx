import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import { Users, Bell, MessageSquare, Send, TrendingUp, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";

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

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { data, error } = await supabase
          .from("customer")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setCustomers(data || []);
      } catch (error: any) {
        console.error("Error fetching customers:", error);
        toast.error("Failed to load customers");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
    fetchUnreadCounts();
  }, []);

  // Fetch traffic data
  const fetchTrafficData = async () => {
    setIsLoadingTraffic(true);
    try {
      const { data: leads, error } = await supabase
        .from("telegram_leads")
        .select("id, facebook_click_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_adset_id, utm_ad_id, utm_campaign_id, referrer, created_at, user_id")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch customer data for each lead that has a user_id
      const trafficWithCustomers = await Promise.all(
        (leads || []).map(async (lead) => {
          if (lead.user_id) {
            const { data: customer } = await supabase
              .from("customer")
              .select("id, telegram_id, username, first_name, last_name")
              .eq("id", lead.user_id)
              .single();

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
    } catch (error: any) {
      console.error("Error fetching traffic data:", error);
      toast.error("Failed to load traffic data");
    } finally {
      setIsLoadingTraffic(false);
    }
  };

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
      // Mark all unread messages as read for this customer
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("customer_id", customer.id)
        .eq("sender_type", "customer")
        .eq("is_read", false);

      // Reset unread count for this customer
      setUnreadCounts((prev) => ({
        ...prev,
        [customer.id]: 0,
      }));

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

  // Real-time subscription for new customers
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
          
          // Add to the beginning of the list
          setCustomers((prev) => [newCustomer, ...prev]);
          
          // Show notification
          toast.success(
            `New customer: ${newCustomer.first_name || "Unknown"} ${newCustomer.last_name || ""}`,
            {
              description: `@${newCustomer.username || "No username"} just started the bot!`,
              icon: <Bell className="h-4 w-4" />,
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
          
          // Update unread count
          setUnreadCounts((prev) => ({
            ...prev,
            [newMessage.customer_id]: (prev[newMessage.customer_id] || 0) + 1,
          }));

          // If this message is for the currently open dialog, add it to messages
          if (selectedCustomer?.id === newMessage.customer_id) {
            setMessages((prev) => [...prev, newMessage]);
            
            // Scroll to bottom when new message arrives
            setTimeout(() => {
              const messagesContainer = document.getElementById('messages-container');
              if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
              }
            }, 100);
          } else {
            // Show toast notification for messages from other customers
            const customer = customers.find((c) => c.id === newMessage.customer_id);
            if (customer) {
              toast.success("New message received", {
                description: `${customer.first_name || "Customer"} sent a message`,
                icon: <Bell className="h-4 w-4" />,
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCustomer, customers]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

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
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-5 w-5" />
            <span className="text-2xl font-semibold">{customers.length}</span>
            <span>Total Customers</span>
          </div>
        </div>

        <Tabs defaultValue="customers" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="customers">
              <Users className="h-4 w-4 mr-2" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="traffic" onClick={() => fetchTrafficData()}>
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
                {customers.length === 0 ? (
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
                  <div className="text-center py-8 text-muted-foreground">
                    Loading traffic data...
                  </div>
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
