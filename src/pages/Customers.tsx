import { useEffect, useState, useMemo } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Users, Bell, MessageSquare, Send, Facebook, AlertCircle } from "lucide-react";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  messenger_id: string | null;
  messenger_name: string | null;
  messenger_profile_pic: string | null;
  locale: string | null;
  timezone_offset: number | null;
  lead_source?: {
    messenger_ref?: string;
    campaign_name?: string;
    ad_name?: string;
    adset_name?: string;
    referrer?: string;
  };
}

interface Message {
  id: string;
  customer_id: string;
  telegram_id: number | null;
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
  platform: string;
  messenger_mid: string | null;
  isPending?: boolean; // For optimistic UI
}

const Customers = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastMessageSender, setLastMessageSender] = useState<Record<string, string>>({});
  const [customersPage, setCustomersPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [hasNewCustomers, setHasNewCustomers] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [messagesCache, setMessagesCache] = useState<Record<string, Message[]>>({});
  const [messageMetaCache, setMessageMetaCache] = useState<Record<string, { offset: number; hasMore: boolean }>>({});
  const itemsPerPage = 10;
  const messagesPerPage = 10;

  // Calculate if Messenger customer is outside 24-hour messaging window
  const isOutsideMessagingWindow = useMemo(() => {
    if (!selectedCustomer?.messenger_id || messages.length === 0) return false;
    
    // Find last customer message
    const lastCustomerMessage = [...messages]
      .reverse()
      .find(msg => msg.sender_type === 'customer');
    
    if (!lastCustomerMessage) return false;
    
    const hoursSinceLastMessage = (Date.now() - new Date(lastCustomerMessage.timestamp).getTime()) / (1000 * 60 * 60);
    return hoursSinceLastMessage > 24;
  }, [selectedCustomer, messages]);

  // Fetch last message sender for all customers
  const fetchLastMessageSenders = async () => {
    try {
      const { data: customers } = await supabase
        .from("customer")
        .select("id");

      if (!customers) return;

      const senderMap: Record<string, string> = {};
      
      for (const customer of customers) {
        const { data } = await supabase
          .from("messages")
          .select("sender_type")
          .eq("customer_id", customer.id)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          senderMap[customer.id] = data.sender_type;
        }
      }
      
      setLastMessageSender(senderMap);
    } catch (err) {
      console.error("Error fetching last message senders:", err);
    }
  };

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

      // Fetch paginated data with lead source
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data: customersData, error } = await supabase
        .from("customer")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      // Fetch lead sources for these customers
      if (customersData && customersData.length > 0) {
        const customerIds = customersData.map(c => c.id);
        const { data: leadsData } = await supabase
          .from("telegram_leads")
          .select("user_id, messenger_ref, campaign_name, ad_name, adset_name, referrer")
          .in("user_id", customerIds);
        
        // Merge lead source data with customers
        const customersWithLeads = customersData.map(customer => ({
          ...customer,
          lead_source: leadsData?.find(lead => lead.user_id === customer.id)
        }));
        
        setCustomers(customersWithLeads);
      } else {
        setCustomers(customersData || []);
      }
      
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
    fetchLastMessageSenders();
  }, []);

  // Send reply to customer
  const sendReply = async () => {
    if (!replyText.trim() || !selectedCustomer || isSending) return;

    const messageToSend = replyText;
    const tempId = `temp-${Date.now()}`;
    const platform = selectedCustomer.messenger_id ? 'messenger' : 'telegram';
    
    // Optimistically add message to UI
    const optimisticMessage: Message = {
      id: tempId,
      customer_id: selectedCustomer.id,
      telegram_id: selectedCustomer.telegram_id,
      message_text: messageToSend,
      message_type: "text",
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      photo_file_id: null,
      photo_url: null,
      voice_file_id: null,
      voice_duration: null,
      voice_transcription: null,
      voice_url: null,
      video_file_id: null,
      video_url: null,
      video_duration: null,
      video_mime_type: null,
      sender_type: "employee",
      is_read: true,
      platform,
      messenger_mid: null,
      isPending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setReplyText("");
    setIsSending(true);
    
    // Scroll to bottom immediately
    setTimeout(() => {
      const messagesContainer = document.getElementById('messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 50);

    try {
      let response;
      
      if (platform === 'messenger') {
        // Send via Messenger webhook
        response = await supabase.functions.invoke("messenger-webhook", {
          body: {
            psid: selectedCustomer.messenger_id,
            text: messageToSend,
          },
        });
      } else {
        // Send via Telegram bot
        response = await supabase.functions.invoke("telegram-bot", {
          body: {
            action: "send_message",
            telegram_id: selectedCustomer.telegram_id,
            customer_id: selectedCustomer.id,
            message_text: messageToSend,
          },
        });
      }

      if (response.error) throw response.error;
      
      // Check for specific error codes in response data
      if (response.data?.error && response.data?.code === 'MESSAGING_WINDOW_EXPIRED') {
        throw new Error(response.data.error);
      }

      // Update last message sender to employee
      setLastMessageSender((prev) => ({
        ...prev,
        [selectedCustomer.id]: "employee",
      }));

      // Real-time subscription will replace the optimistic message with the real one
    } catch (error: any) {
      console.error("Error sending message:", error);
      
      // Handle 24-hour window error specifically
      if (error.message?.includes('24-hour messaging window')) {
        toast.error("Cannot send message: The 24-hour messaging window has expired. Wait for the customer to message you first.", {
          duration: 5000,
        });
      } else {
        toast.error("Failed to send message");
      }
      
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    } finally {
      setIsSending(false);
      // Refocus the input after sending
      setTimeout(() => {
        const input = document.querySelector('input[placeholder="Type your reply..."]') as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }, 100);
    }
  };

  // Load messages for selected customer
  const loadMessages = async (customer: Customer, offset = 0, forceRefresh = false) => {
    setSelectedCustomer(customer);
    setDialogOpen(true);
    
    // Check cache first (only if not forcing refresh and offset is 0)
    if (offset === 0 && !forceRefresh && messagesCache[customer.id]) {
      setMessages(messagesCache[customer.id]);
      const meta = messageMetaCache[customer.id];
      if (meta) {
        setMessageOffset(meta.offset);
        setHasMoreMessages(meta.hasMore);
      }
      
      // Scroll to bottom
      setTimeout(() => {
        const messagesContainer = document.getElementById('messages-container');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      }, 100);
      
      return;
    }
    
    if (offset === 0) {
      setIsLoadingMessages(true);
      setMessages([]);
      setMessageOffset(0);
    } else {
      setIsLoadingMoreMessages(true);
    }

    try {
      // Mark all unread messages as read for this customer (only on initial load)
      if (offset === 0) {
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
      }

      // Get total count
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("customer_id", customer.id);

      const totalMessages = count || 0;
      const newOffset = offset + messagesPerPage;
      const hasMore = newOffset < totalMessages;
      setHasMoreMessages(hasMore);
      setMessageOffset(newOffset);

      // Fetch paginated messages (newest first, then reverse)
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("customer_id", customer.id)
        .order("timestamp", { ascending: false })
        .range(offset, offset + messagesPerPage - 1);

      if (error) throw error;
      
      const messagesData = (data || []).reverse();
      
      if (offset === 0) {
        setMessages(messagesData);
        
        // Cache the messages and metadata
        setMessagesCache((prev) => ({
          ...prev,
          [customer.id]: messagesData,
        }));
        setMessageMetaCache((prev) => ({
          ...prev,
          [customer.id]: { offset: newOffset, hasMore },
        }));
        
        // Scroll to bottom after loading
        setTimeout(() => {
          const messagesContainer = document.getElementById('messages-container');
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }, 100);
      } else {
        // Prepend older messages and maintain scroll position
        const container = document.getElementById('messages-container');
        const oldScrollHeight = container?.scrollHeight || 0;
        
        const newMessages = [...messagesData, ...messages];
        setMessages(newMessages);
        
        // Update cache
        setMessagesCache((prev) => ({
          ...prev,
          [customer.id]: newMessages,
        }));
        setMessageMetaCache((prev) => ({
          ...prev,
          [customer.id]: { offset: newOffset, hasMore },
        }));
        
        // Restore scroll position
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - oldScrollHeight;
          }
        }, 50);
      }
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setIsLoadingMessages(false);
      setIsLoadingMoreMessages(false);
    }
  };

  // Handle scroll to load more messages
  const handleMessagesScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    
    // Check if scrolled to top
    if (container.scrollTop === 0 && hasMoreMessages && !isLoadingMoreMessages && selectedCustomer) {
      loadMessages(selectedCustomer, messageOffset);
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
          
          setHasNewCustomers(true);
          
          // Show notification with refresh option
          toast.success(
            `New customer: ${newCustomer.first_name || "Unknown"} ${newCustomer.last_name || ""}`,
            {
              description: "Click to refresh the customer list",
              icon: <Bell className="h-4 w-4" />,
              action: {
                label: "Refresh",
                onClick: () => fetchCustomers(customersPage),
              },
            }
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customersPage]);

  // Real-time subscription for ALL new messages (both customer and employee)
  useEffect(() => {
    const channel = supabase
      .channel("all-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as Message;
          console.log("New message received:", newMessage);
          
          // Update last message sender
          setLastMessageSender((prev) => ({
            ...prev,
            [newMessage.customer_id]: newMessage.sender_type,
          }));
          
          // Update unread count only for customer messages
          if (newMessage.sender_type === "customer") {
            setUnreadCounts((prev) => ({
              ...prev,
              [newMessage.customer_id]: (prev[newMessage.customer_id] || 0) + 1,
            }));
          }

          // If this message is for the currently open dialog
          if (selectedCustomer?.id === newMessage.customer_id && dialogOpen) {
            // Replace pending message or add new message
            setMessages((prev) => {
              const hasPending = prev.some((msg) => msg.isPending && msg.sender_type === "employee");
              
              let newMessages;
              if (hasPending && newMessage.sender_type === "employee") {
                // Replace the first pending employee message
                newMessages = [...prev];
                const pendingIndex = newMessages.findIndex((msg) => msg.isPending && msg.sender_type === "employee");
                if (pendingIndex !== -1) {
                  newMessages[pendingIndex] = newMessage;
                }
              } else {
                // Otherwise just add the message (for customer messages or if no pending)
                newMessages = [...prev, newMessage];
              }
              
              // Update cache
              setMessagesCache((cache) => ({
                ...cache,
                [newMessage.customer_id]: newMessages,
              }));
              
              return newMessages;
            });
            
            setHasNewMessages(false);
            
            // Mark as read if it's from customer
            if (newMessage.sender_type === "customer") {
              supabase
                .from("messages")
                .update({ is_read: true })
                .eq("id", newMessage.id)
                .then(() => {
                  // Reset unread count for this customer
                  setUnreadCounts((prev) => ({
                    ...prev,
                    [newMessage.customer_id]: Math.max(0, (prev[newMessage.customer_id] || 1) - 1),
                  }));
                });
            }
            
            // Scroll to bottom
            setTimeout(() => {
              const messagesContainer = document.getElementById('messages-container');
              if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
              }
            }, 100);
          } else if (newMessage.sender_type === "customer") {
            // Show toast notification for customer messages from other customers
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
  }, [selectedCustomer, customers, dialogOpen]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Pagination calculations (data is already paginated from DB)
  const totalCustomerPages = Math.ceil(totalCustomers / itemsPerPage);

  if (isLoading && customersPage === 1) {
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
            <h1 className="text-4xl font-bold text-foreground">Customers</h1>
            <p className="text-muted-foreground mt-2">
              Manage and chat with your Telegram and Messenger customers
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

        <Card>
          <CardHeader>
            <CardTitle>Customer List</CardTitle>
            <CardDescription>
              All customers who have interacted with your bot
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton rows={10} columns={8} />
            ) : customers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No customers yet. Share your bot to get started!
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Username / ID</TableHead>
                      <TableHead>Language</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Premium</TableHead>
                      <TableHead>First Message</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => {
                      const platform = customer.messenger_id ? 'messenger' : 'telegram';
                      const displayName = customer.messenger_id 
                        ? customer.messenger_name 
                        : `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
                      
                      return (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <Badge variant={platform === 'messenger' ? 'default' : 'secondary'}>
                              {platform === 'messenger' ? (
                                <><Facebook className="h-3 w-3 mr-1" /> Messenger</>
                              ) : (
                                <>Telegram</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {displayName || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            {platform === 'messenger' ? (
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {customer.messenger_id}
                              </code>
                            ) : customer.username ? (
                              <span className="text-muted-foreground">
                                @{customer.username}
                              </span>
                            ) : (
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {customer.telegram_id}
                              </code>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {platform === 'messenger' 
                                ? (customer.locale || "Unknown")
                                : (customer.language_code || "Unknown")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {customer.lead_source ? (
                              <div className="space-y-1">
                                {customer.lead_source.campaign_name && (
                                  <Badge variant="outline" className="text-xs">
                                    {customer.lead_source.campaign_name}
                                  </Badge>
                                )}
                                {customer.lead_source.ad_name && (
                                  <div className="text-xs text-muted-foreground">
                                    {customer.lead_source.ad_name}
                                  </div>
                                )}
                                {customer.lead_source.messenger_ref && (
                                  <div className="text-xs text-muted-foreground">
                                    Post: {customer.lead_source.messenger_ref}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Direct</span>
                            )}
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
                              Chat
                              {lastMessageSender[customer.id] === "customer" && (
                                <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full animate-pulse" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
      </div>

      {/* Messages Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Badge variant={selectedCustomer?.messenger_id ? 'default' : 'secondary'}>
                {selectedCustomer?.messenger_id ? (
                  <><Facebook className="h-3 w-3 mr-1" /> Messenger</>
                ) : (
                  <>Telegram</>
                )}
              </Badge>
              Messages from {selectedCustomer?.messenger_id 
                ? selectedCustomer.messenger_name 
                : `${selectedCustomer?.first_name || ''} ${selectedCustomer?.last_name || ''}`.trim()}
            </DialogTitle>
            <DialogDescription>
              {selectedCustomer?.messenger_id ? (
                <div className="space-y-1">
                  <div>PSID: {selectedCustomer.messenger_id}</div>
                  {selectedCustomer.locale && (
                    <div className="text-xs">Locale: {selectedCustomer.locale}</div>
                  )}
                  {selectedCustomer.timezone_offset !== null && (
                    <div className="text-xs">
                      Timezone: UTC{selectedCustomer.timezone_offset >= 0 ? '+' : ''}{selectedCustomer.timezone_offset}
                    </div>
                  )}
                  {selectedCustomer.lead_source && (
                    <div className="mt-2 pt-2 border-t space-y-1">
                      <div className="text-xs font-semibold">Lead Source:</div>
                      {selectedCustomer.lead_source.campaign_name && (
                        <div className="text-xs">Campaign: {selectedCustomer.lead_source.campaign_name}</div>
                      )}
                      {selectedCustomer.lead_source.ad_name && (
                        <div className="text-xs">Ad: {selectedCustomer.lead_source.ad_name}</div>
                      )}
                      {selectedCustomer.lead_source.messenger_ref && (
                        <div className="text-xs">Post Ref: {selectedCustomer.lead_source.messenger_ref}</div>
                      )}
                      {selectedCustomer.lead_source.referrer && (
                        <div className="text-xs">Source: {selectedCustomer.lead_source.referrer}</div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  @{selectedCustomer?.username || "No username"} • Telegram ID:{" "}
                  {selectedCustomer?.telegram_id}
                </>
              )}
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
                onScroll={handleMessagesScroll}
              >
                {isLoadingMoreMessages && (
                  <div className="text-center py-2 text-sm text-muted-foreground">
                    Loading older messages...
                  </div>
                )}
                {hasMoreMessages && !isLoadingMoreMessages && (
                  <div className="text-center py-2">
                    <button
                      onClick={() => selectedCustomer && loadMessages(selectedCustomer, messageOffset)}
                      className="text-xs text-primary hover:underline"
                    >
                      Scroll to top to load older messages
                    </button>
                  </div>
                )}
                {messages.map((message) => (
                <div
                  key={message.id}
                  className={`border rounded-lg p-4 space-y-3 transition-opacity ${
                    message.sender_type === 'employee' 
                      ? 'bg-primary/5 ml-8' 
                      : 'mr-8'
                  } ${message.isPending ? 'opacity-50' : 'opacity-100'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={message.sender_type === 'employee' ? 'default' : 'outline'}>
                        {message.sender_type === 'employee' ? 'You' : message.message_type}
                      </Badge>
                      {message.sender_type === 'employee' && (
                        <span className="text-xs text-muted-foreground">
                          {message.isPending ? 'Sending...' : 'Employee Reply'}
                        </span>
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
              {/* 24-hour window warning for Messenger */}
              {selectedCustomer.messenger_id && isOutsideMessagingWindow && (
                <Alert className="mb-3 border-amber-500/50 bg-amber-500/10">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-sm text-amber-600 dark:text-amber-500">
                    This customer hasn't messaged in over 24 hours. Facebook's messaging policy prevents sending messages outside this window. Wait for them to message first.
                  </AlertDescription>
                </Alert>
              )}
              
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
                  autoFocus
                  disabled={selectedCustomer.messenger_id && isOutsideMessagingWindow}
                />
                <Button 
                  onClick={sendReply} 
                  disabled={!replyText.trim() || isSending || (selectedCustomer.messenger_id && isOutsideMessagingWindow)}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to send • This will be sent via {selectedCustomer.messenger_id ? 'Messenger' : 'Telegram'}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
