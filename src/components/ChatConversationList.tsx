import { useMemo, useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCustomersData } from "@/hooks/useCustomersData";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Facebook, Send, Bell, Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { playMessageNotification, playNewCustomerNotification } from "@/lib/notification-sound";

interface Customer {
  id: string;
  telegram_id: number | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  messenger_id: string | null;
  messenger_name: string | null;
  messenger_profile_pic: string | null;
  last_message_at: string | null;
  page_id: string | null;
  detected_language: string | null;
  language_code: string | null;
  is_premium: boolean;
  first_message_at: string;
  created_at: string;
  locale: string | null;
  timezone_offset: number | null;
  linked_customer_id: string | null;
}

interface ChatConversationListProps {
  selectedId: string | null;
  onSelect: (customer: Customer) => void;
}

// Helper function to get initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() || '')
    .join('') || '?';
};

export const ChatConversationList = ({ selectedId, onSelect }: ChatConversationListProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnChatPage = location.pathname === '/chat';
  
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;
  const { data: customersData, isLoading, refetch } = useCustomersData(page, itemsPerPage);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  
  // Infinite scroll state
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allLinkedPlatformsMap, setAllLinkedPlatformsMap] = useState<Record<string, { telegram: boolean; messenger: boolean; linkedIds: string[] }>>({});
  const [hasMore, setHasMore] = useState(true);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastMessages, setLastMessages] = useState<Record<string, { text: string; timestamp: string }>>({});

  // Accumulate customers across pages
  useEffect(() => {
    if (customersData?.customers) {
      if (page === 1) {
        setAllCustomers(customersData.customers as Customer[]);
        setAllLinkedPlatformsMap(customersData.linkedPlatformsMap || {});
      } else {
        setAllCustomers(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newCustomers = (customersData.customers as Customer[]).filter(c => !existingIds.has(c.id));
          return [...prev, ...newCustomers];
        });
        setAllLinkedPlatformsMap(prev => ({ ...prev, ...(customersData.linkedPlatformsMap || {}) }));
      }
      setHasMore(customersData.customers.length === itemsPerPage);
    }
  }, [customersData, page]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          setPage(prev => prev + 1);
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  // Fetch unread counts
  const fetchUnreadCounts = async () => {
    const { data } = await supabase
      .from("messages")
      .select("customer_id")
      .eq("sender_type", "customer")
      .eq("is_read", false);

    if (data) {
      const counts: Record<string, number> = {};
      data.forEach(msg => {
        counts[msg.customer_id] = (counts[msg.customer_id] || 0) + 1;
      });
      setUnreadCounts(counts);
    }
  };

  // Fetch last messages for preview
  const fetchLastMessages = async () => {
    if (allCustomers.length === 0) return;
    
    const customerIds = allCustomers.map(c => c.id);
    const linkedIds = allCustomers.flatMap(c => allLinkedPlatformsMap[c.id]?.linkedIds || []);
    const allIds = [...new Set([...customerIds, ...linkedIds])];
    
    // Get last message for each customer
    const { data } = await supabase
      .from("messages")
      .select("customer_id, message_text, message_type, timestamp")
      .in("customer_id", allIds)
      .order("timestamp", { ascending: false });
    
    if (data) {
      const msgMap: Record<string, { text: string; timestamp: string }> = {};
      data.forEach(msg => {
        if (!msgMap[msg.customer_id]) {
          let text = msg.message_text || '';
          if (msg.message_type === 'photo') text = '📷 Photo';
          else if (msg.message_type === 'video') text = '🎥 Video';
          else if (msg.message_type === 'voice') text = '🎤 Voice message';
          else if (msg.message_type === 'document') text = '📎 Document';
          
          msgMap[msg.customer_id] = { text, timestamp: msg.timestamp };
        }
      });
      setLastMessages(msgMap);
    }
  };

  useEffect(() => {
    fetchUnreadCounts();
  }, []);

  useEffect(() => {
    fetchLastMessages();
  }, [allCustomers]);

  // Real-time subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel("chat-list-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMessage = payload.new as any;
          
          // Update unread count and play sound for customer messages
          if (newMessage.sender_type === "customer") {
            // Play notification sound
            playMessageNotification();
            
            setUnreadCounts(prev => ({
              ...prev,
              [newMessage.customer_id]: (prev[newMessage.customer_id] || 0) + 1,
            }));
            
            // Find customer - check direct match or linked customers
            let customer = allCustomers.find(c => c.id === newMessage.customer_id);
            let parentCustomerId = newMessage.customer_id;
            
            // If not found directly, check if it's a linked customer
            if (!customer) {
              for (const [parentId, linkedInfo] of Object.entries(allLinkedPlatformsMap)) {
                if (linkedInfo.linkedIds.includes(newMessage.customer_id)) {
                  customer = allCustomers.find(c => c.id === parentId);
                  parentCustomerId = parentId;
                  break;
                }
              }
            }
            
            // Get customer name
            const customerName = customer?.messenger_name || 
              `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 
              'New Customer';
            
            // Format message preview (truncate if too long)
            let messagePreview = newMessage.message_text || '';
            if (newMessage.message_type === 'photo') messagePreview = '📷 Photo';
            else if (newMessage.message_type === 'video') messagePreview = '🎥 Video';
            else if (newMessage.message_type === 'voice') messagePreview = '🎤 Voice message';
            else if (newMessage.message_type === 'document') messagePreview = '📎 Document';
            else if (messagePreview.length > 50) {
              messagePreview = messagePreview.substring(0, 50) + '...';
            }
            
            // Show improved toast with name and message preview
            toast.success(customerName, {
              description: messagePreview || 'New message',
              icon: <Bell className="h-4 w-4" />,
              action: {
                label: isOnChatPage ? "View" : "Open Chat",
                onClick: () => {
                  if (isOnChatPage && customer) {
                    // Already on chat page with customer loaded - select directly
                    onSelect(customer);
                  } else {
                    // Navigate with URL parameter - works even if customer not loaded
                    navigate(`/chat?customer=${parentCustomerId}`);
                  }
                },
              },
            });
          }
          
          // Update last message preview
          let text = newMessage.message_text || '';
          if (newMessage.message_type === 'photo') text = '📷 Photo';
          else if (newMessage.message_type === 'video') text = '🎥 Video';
          else if (newMessage.message_type === 'voice') text = '🎤 Voice message';
          else if (newMessage.message_type === 'document') text = '📎 Document';
          
          setLastMessages(prev => ({
            ...prev,
            [newMessage.customer_id]: { text, timestamp: newMessage.timestamp },
          }));
          
          refetch();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refetch, allCustomers, isOnChatPage, navigate, onSelect]);

  // Real-time subscription for new customers
  useEffect(() => {
    const channel = supabase
      .channel("chat-list-customers")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "customer" },
        (payload) => {
          const newCustomer = payload.new as Customer;
          
          // Play new customer notification sound
          playNewCustomerNotification();
          
          const customerName = newCustomer.messenger_name || newCustomer.first_name || "Unknown";
          
          toast.success(`New customer: ${customerName}`, {
            icon: <Bell className="h-4 w-4" />,
            duration: 8000, // Longer duration for new customers
            action: {
              label: "Chat Now",
              onClick: () => {
                refetch().then(() => {
                  if (isOnChatPage) {
                    onSelect(newCustomer);
                  } else {
                    navigate(`/chat?customer=${newCustomer.id}`);
                  }
                });
              },
            },
          });
          refetch();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refetch, isOnChatPage, navigate, onSelect]);

  // Filter customers by search query
  const filteredBySearch = useMemo(() => {
    if (!searchQuery.trim()) return allCustomers;
    const query = searchQuery.toLowerCase();
    return allCustomers.filter(customer => {
      const name = customer.messenger_name || 
        `${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
        customer.username || '';
      return name.toLowerCase().includes(query);
    });
  }, [allCustomers, searchQuery]);

  // Sort customers: unread first, then by last activity
  const sortedCustomers = useMemo(() => {
    return [...filteredBySearch].sort((a, b) => {
      const linkedIdsA = allLinkedPlatformsMap[a.id]?.linkedIds || [];
      const linkedIdsB = allLinkedPlatformsMap[b.id]?.linkedIds || [];
      const aUnread = [a.id, ...linkedIdsA].reduce((sum, id) => sum + (unreadCounts[id] || 0), 0);
      const bUnread = [b.id, ...linkedIdsB].reduce((sum, id) => sum + (unreadCounts[id] || 0), 0);
      
      // Unread first
      if (aUnread > 0 && bUnread === 0) return -1;
      if (bUnread > 0 && aUnread === 0) return 1;
      
      // Then by most recent activity
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [filteredBySearch, unreadCounts, allLinkedPlatformsMap]);

  // Format relative time
  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  };

  // Get last message for customer (including linked)
  const getLastMessage = (customer: Customer) => {
    const linkedIds = allLinkedPlatformsMap[customer.id]?.linkedIds || [];
    const allIds = [customer.id, ...linkedIds];
    
    let latest: { text: string; timestamp: string } | null = null;
    allIds.forEach(id => {
      const msg = lastMessages[id];
      if (msg && (!latest || new Date(msg.timestamp) > new Date(latest.timestamp))) {
        latest = msg;
      }
    });
    return latest;
  };

  // Get unread count for customer (including linked)
  const getUnreadCount = (customer: Customer) => {
    const linkedIds = allLinkedPlatformsMap[customer.id]?.linkedIds || [];
    return [customer.id, ...linkedIds].reduce((sum, id) => sum + (unreadCounts[id] || 0), 0);
  };

  // Mark messages as read when selecting a conversation
  const handleSelect = async (customer: Customer) => {
    const linkedIds = allLinkedPlatformsMap[customer.id]?.linkedIds || [];
    const allIds = [customer.id, ...linkedIds];
    
    // Update local state immediately for responsive UI
    setUnreadCounts(prev => {
      const updated = { ...prev };
      allIds.forEach(id => { updated[id] = 0; });
      return updated;
    });
    
    // Mark messages as read in database - this is the ONLY place messages get marked as read
    await supabase
      .from("messages")
      .update({ is_read: true })
      .in("customer_id", allIds)
      .eq("sender_type", "customer")
      .eq("is_read", false);
    
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
    
    onSelect(customer);
  };

  if (isLoading) {
    return (
      <div className="h-full border-r bg-background">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Conversations</h2>
        </div>
        <div className="p-2 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col md:border-r bg-background">
      <div className="p-4 border-b flex-shrink-0">
        <h2 className="font-semibold">Conversations</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {searchQuery ? `${sortedCustomers.length} of ${allCustomers.length}` : `${allCustomers.length} customers${hasMore ? '+' : ''}`}
        </p>
      </div>
      
      {/* Search input */}
      <div className="px-3 py-2 border-b flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8 h-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-1">
          {sortedCustomers.length === 0 && searchQuery ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Search className="h-8 w-8 mb-3 opacity-50" />
              <p className="text-sm">No customers found</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          ) : null}
          {sortedCustomers.map(customer => {
            const displayName = customer.messenger_name || 
              `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 
              'Unknown';
              const hasBothPlatforms = allLinkedPlatformsMap[customer.id]?.telegram && 
                                     allLinkedPlatformsMap[customer.id]?.messenger;
            const primaryPlatform = customer.messenger_id ? 'messenger' : 'telegram';
            const unreadCount = getUnreadCount(customer);
            const lastMessage = getLastMessage(customer);
            
            return (
              <button
                key={customer.id}
                onClick={() => handleSelect(customer)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left",
                  selectedId === customer.id && "bg-muted",
                  unreadCount > 0 && "bg-primary/5"
                )}
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={customer.messenger_profile_pic || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium text-sm">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  {/* Platform indicator */}
                  <div className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center",
                    primaryPlatform === 'messenger' ? "bg-primary" : "bg-secondary"
                  )}>
                    {primaryPlatform === 'messenger' ? (
                      <Facebook className="h-2.5 w-2.5 text-primary-foreground" />
                    ) : (
                      <Send className="h-2.5 w-2.5 text-secondary-foreground" />
                    )}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      "font-medium truncate text-sm",
                      unreadCount > 0 && "font-semibold"
                    )}>
                      {displayName}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatRelativeTime(lastMessage?.timestamp || customer.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className={cn(
                      "text-xs truncate",
                      unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                      {lastMessage?.text || 'No messages yet'}
                    </p>
                    {unreadCount > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Badge>
                    )}
                  </div>
                  {hasBothPlatforms && (
                    <div className="flex gap-1 mt-1">
                      <Badge variant="outline" className="h-4 text-[10px] px-1">
                        <Send className="h-2 w-2 mr-0.5" /> TG
                      </Badge>
                      <Badge variant="outline" className="h-4 text-[10px] px-1">
                        <Facebook className="h-2 w-2 mr-0.5" /> FB
                      </Badge>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
          {/* Infinite scroll trigger */}
          <div ref={loadMoreRef} className="py-2">
            {isLoading && page > 1 && (
              <div className="flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
