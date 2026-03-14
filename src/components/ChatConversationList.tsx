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
import { Facebook, Send, Bell, Loader2, Search, X, Wifi, WifiOff, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
  const [lastMessages, setLastMessages] = useState<Record<string, { text: string; timestamp: string; senderType?: string; sentByName?: string }>>({});
  
  // Awaiting reply filter
  const [filterMode, setFilterMode] = useState<'all' | 'awaiting'>('all');
  const [unansweredIds, setUnansweredIds] = useState<Set<string>>(new Set());
  
  // Realtime status tracking
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Refs for stable subscription callbacks
  const allCustomersRef = useRef<Customer[]>([]);
  const allLinkedPlatformsMapRef = useRef<Record<string, { telegram: boolean; messenger: boolean; linkedIds: string[] }>>({});
  
  useEffect(() => {
    allCustomersRef.current = allCustomers;
  }, [allCustomers]);
  
  useEffect(() => {
    allLinkedPlatformsMapRef.current = allLinkedPlatformsMap;
  }, [allLinkedPlatformsMap]);

  // Ensure a conversation is loaded even when the message comes from a customer not in current pages
  const ensureConversationLoaded = useCallback(async (messageCustomerId: string, messageTimestamp: string) => {
    const currentCustomers = allCustomersRef.current;
    const currentLinkedMap = allLinkedPlatformsMapRef.current;

    const existsDirectly = currentCustomers.some(c => c.id === messageCustomerId);
    const existsAsLinked = Object.values(currentLinkedMap).some(linked => linked.linkedIds.includes(messageCustomerId));
    if (existsDirectly || existsAsLinked) return;

    const { data: sourceCustomer, error: sourceError } = await supabase
      .from("customer")
      .select("*")
      .eq("id", messageCustomerId)
      .maybeSingle();

    if (sourceError || !sourceCustomer) return;

    const parentCustomerId = sourceCustomer.linked_customer_id ?? sourceCustomer.id;

    let parentCustomer = sourceCustomer as Customer;
    if (sourceCustomer.linked_customer_id) {
      const { data: fetchedParent, error: parentError } = await supabase
        .from("customer")
        .select("*")
        .eq("id", parentCustomerId)
        .maybeSingle();

      if (parentError || !fetchedParent) return;
      parentCustomer = fetchedParent as Customer;
    }

    const { data: linkedCustomers } = await supabase
      .from("customer")
      .select("id, telegram_id, messenger_id")
      .eq("linked_customer_id", parentCustomerId);

    const linkedIds = linkedCustomers?.map(c => c.id) || [];
    const hasTelegram = parentCustomer.telegram_id !== null || (linkedCustomers?.some(c => c.telegram_id !== null) ?? false);
    const hasMessenger = parentCustomer.messenger_id !== null || (linkedCustomers?.some(c => c.messenger_id !== null) ?? false);

    setAllLinkedPlatformsMap(prev => ({
      ...prev,
      [parentCustomerId]: {
        telegram: hasTelegram,
        messenger: hasMessenger,
        linkedIds,
      },
    }));

    setAllCustomers(prev => {
      const existing = prev.find(c => c.id === parentCustomerId);
      const merged: Customer = {
        ...(existing || parentCustomer),
        ...parentCustomer,
        last_message_at: messageTimestamp,
      };

      return [merged, ...prev.filter(c => c.id !== parentCustomerId)];
    });
  }, []);

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

  // Fetch last messages for preview using RPC (avoids 1000-row limit)
  const fetchLastMessages = async () => {
    if (allCustomers.length === 0) return;
    
    const customerIds = allCustomers.map(c => c.id);
    const linkedIds = allCustomers.flatMap(c => allLinkedPlatformsMap[c.id]?.linkedIds || []);
    const allIds = [...new Set([...customerIds, ...linkedIds])];
    
    const { data, error } = await supabase.rpc('get_latest_messages', {
      p_customer_ids: allIds,
    });
    
    if (error) {
      console.error('Failed to fetch latest messages:', error);
      return;
    }
    
    if (data) {
      const msgMap: Record<string, { text: string; timestamp: string; senderType?: string; sentByName?: string }> = {};
      (data as any[]).forEach((msg: any) => {
        let text = msg.message_text || '';
        if (msg.message_type === 'photo') text = '📷 Photo';
        else if (msg.message_type === 'video') text = '🎥 Video';
        else if (msg.message_type === 'voice') text = '🎤 Voice message';
        else if (msg.message_type === 'document') text = '📎 Document';
        
        msgMap[msg.customer_id] = { text, timestamp: msg.timestamp, senderType: msg.sender_type, sentByName: msg.sent_by_name };
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

  // Real-time subscription for new messages - stable, no allCustomers dependency
  useEffect(() => {
    const channel = supabase
      .channel("chat-list-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          setLastSyncTime(new Date());
          const newMessage = payload.new as any;
          const currentCustomers = allCustomersRef.current;
          const currentLinkedMap = allLinkedPlatformsMapRef.current;
          
          // Update unread count and play sound for customer messages
          if (newMessage.sender_type === "customer") {
            playMessageNotification();
            
            setUnreadCounts(prev => ({
              ...prev,
              [newMessage.customer_id]: (prev[newMessage.customer_id] || 0) + 1,
            }));
            
            // Find customer - check direct match or linked customers
            let customer = currentCustomers.find(c => c.id === newMessage.customer_id);
            let parentCustomerId = newMessage.customer_id;
            
            if (!customer) {
              for (const [parentId, linkedInfo] of Object.entries(currentLinkedMap)) {
                if (linkedInfo.linkedIds.includes(newMessage.customer_id)) {
                  customer = currentCustomers.find(c => c.id === parentId);
                  parentCustomerId = parentId;
                  break;
                }
              }
            }

            const customerName = customer?.messenger_name || 
              `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || 
              'New Customer';
            
            let messagePreview = newMessage.message_text || '';
            if (newMessage.message_type === 'photo') messagePreview = '📷 Photo';
            else if (newMessage.message_type === 'video') messagePreview = '🎥 Video';
            else if (newMessage.message_type === 'voice') messagePreview = '🎤 Voice message';
            else if (newMessage.message_type === 'document') messagePreview = '📎 Document';
            else if (messagePreview.length > 50) {
              messagePreview = messagePreview.substring(0, 50) + '...';
            }
            
            toast.success(customerName, {
              description: messagePreview || 'New message',
              icon: <Bell className="h-4 w-4" />,
              action: {
                label: "View",
                onClick: () => {
                  const latestCustomers = allCustomersRef.current;
                  const latestCustomer = latestCustomers.find(c => c.id === parentCustomerId);
                  if (latestCustomer) {
                    onSelect(latestCustomer);
                  } else {
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
            [newMessage.customer_id]: { text, timestamp: newMessage.timestamp, senderType: newMessage.sender_type, sentByName: newMessage.sent_by_name },
          }));
          
          // Update allCustomers locally to set last_message_at for sorting
          const messageCustomerId = newMessage.customer_id;
          const messageTimestamp = newMessage.timestamp;
          const isKnownConversation =
            currentCustomers.some(c => c.id === messageCustomerId) ||
            Object.values(currentLinkedMap).some(linkedInfo => linkedInfo.linkedIds.includes(messageCustomerId));

          if (!isKnownConversation) {
            void ensureConversationLoaded(messageCustomerId, messageTimestamp);
          }
          
          setAllCustomers(prev => {
            // Find if this is a direct customer or linked
            let parentId = messageCustomerId;
            for (const [pId, linkedInfo] of Object.entries(allLinkedPlatformsMapRef.current)) {
              if (linkedInfo.linkedIds.includes(messageCustomerId)) {
                parentId = pId;
                break;
              }
            }
            
            return prev.map(c => {
              if (c.id === parentId) {
                return { ...c, last_message_at: messageTimestamp };
              }
              return c;
            });
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
          setLastSyncTime(new Date());
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected');
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [ensureConversationLoaded, navigate, onSelect]);

  // Fetch unanswered customer IDs
  useEffect(() => {
    const fetchUnanswered = async () => {
      const { data, error } = await supabase.rpc('get_unanswered_customer_ids');
      if (!error && data) {
        setUnansweredIds(new Set(data.map((r: { customer_id: string }) => r.customer_id)));
      }
    };
    fetchUnanswered();
  }, [allCustomers.length]);

  // Polling fallback: refetch page 1 every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

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

  // Apply awaiting reply filter
  const filteredByMode = useMemo(() => {
    if (filterMode === 'all') return filteredBySearch;
    return filteredBySearch.filter(customer => {
      const linkedIds = allLinkedPlatformsMap[customer.id]?.linkedIds || [];
      const allIds = [customer.id, ...linkedIds];
      return allIds.some(id => unansweredIds.has(id));
    });
  }, [filteredBySearch, filterMode, unansweredIds, allLinkedPlatformsMap]);

  // Sort customers by last message time (newest first) — Instagram/Messenger style
  const sortedCustomers = useMemo(() => {
    // Helper to get latest timestamp from real-time lastMessages state
    const getLatestTime = (customerId: string, linkedIds: string[]): number => {
      const allIds = [customerId, ...linkedIds];
      let latest = 0;
      allIds.forEach(id => {
        const msg = lastMessages[id];
        if (msg) {
          const time = new Date(msg.timestamp).getTime();
          if (time > latest) latest = time;
        }
      });
      return latest;
    };

    return [...filteredByMode].sort((a, b) => {
      const linkedIdsA = allLinkedPlatformsMap[a.id]?.linkedIds || [];
      const linkedIdsB = allLinkedPlatformsMap[b.id]?.linkedIds || [];
      
      // Pure timestamp sorting — no unread priority
      const aTime = getLatestTime(a.id, linkedIdsA) || 
                    (a.last_message_at ? new Date(a.last_message_at).getTime() : 0);
      const bTime = getLatestTime(b.id, linkedIdsB) || 
                    (b.last_message_at ? new Date(b.last_message_at).getTime() : 0);
      return bTime - aTime;
    });
  }, [filteredByMode, allLinkedPlatformsMap, lastMessages]);

  // Compute waiting time badge for a conversation
  const getWaitingBadge = (customer: Customer) => {
    const lastMsg = getLastMessage(customer);
    if (!lastMsg || lastMsg.senderType === 'employee') return null;
    
    const waitMs = Date.now() - new Date(lastMsg.timestamp).getTime();
    const waitMins = waitMs / 60000;
    const waitHours = waitMins / 60;
    const waitDays = waitHours / 24;
    
    let label: string;
    let colorClass: string;
    
    if (waitMins < 60) {
      label = `${Math.max(1, Math.floor(waitMins))}m`;
      colorClass = "bg-emerald-500/15 text-emerald-600";
    } else if (waitHours < 24) {
      label = `${Math.floor(waitHours)}h`;
      colorClass = "bg-amber-500/15 text-amber-600";
    } else {
      label = `${Math.floor(waitDays)}d`;
      colorClass = "bg-destructive/15 text-destructive";
    }
    
    return { label, colorClass };
  };

  // Format time for conversation list - show actual time so staff can tell when last message was
  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    
    // Convert to GMT+7 for display
    const gmt7Offset = 7 * 60; // minutes
    const localOffset = date.getTimezoneOffset();
    const gmt7Date = new Date(date.getTime() + (localOffset + gmt7Offset) * 60000);
    const gmt7Now = new Date(now.getTime() + (now.getTimezoneOffset() + gmt7Offset) * 60000);
    
    const timeStr = gmt7Date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    
    // Same day: show time only
    if (gmt7Date.toDateString() === gmt7Now.toDateString()) {
      return timeStr;
    }
    
    // Yesterday
    const yesterday = new Date(gmt7Now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (gmt7Date.toDateString() === yesterday.toDateString()) {
      return `Yest ${timeStr}`;
    }
    
    // Within 7 days: show day name + time
    const diffDays = Math.floor((gmt7Now.getTime() - gmt7Date.getTime()) / 86400000);
    if (diffDays < 7) {
      const dayName = gmt7Date.toLocaleDateString('en-US', { weekday: 'short' });
      return `${dayName} ${timeStr}`;
    }
    
    // Older: show date
    return gmt7Date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
  };

  // Get last message for customer (including linked)
  const getLastMessage = (customer: Customer) => {
    const linkedIds = allLinkedPlatformsMap[customer.id]?.linkedIds || [];
    const allIds = [customer.id, ...linkedIds];
    
    let latest: { text: string; timestamp: string; senderType?: string; sentByName?: string } | null = null;
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
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Conversations</h2>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                  realtimeStatus === 'connected' 
                    ? "bg-emerald-500/10 text-emerald-600" 
                    : realtimeStatus === 'connecting'
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-destructive/10 text-destructive"
                )}>
                  <span className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    realtimeStatus === 'connected' 
                      ? "bg-emerald-500 animate-pulse" 
                      : realtimeStatus === 'connecting'
                      ? "bg-amber-500 animate-pulse"
                      : "bg-destructive"
                  )} />
                  {realtimeStatus === 'connected' ? 'Live' : realtimeStatus === 'connecting' ? '...' : 'Offline'}
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p>{realtimeStatus === 'connected' ? 'Realtime connected' : realtimeStatus === 'connecting' ? 'Connecting...' : 'Disconnected — using polling fallback'}</p>
                {lastSyncTime && (
                  <p className="text-muted-foreground">Last synced: {lastSyncTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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
      
      {/* Filter tabs */}
      <div className="px-3 py-1.5 border-b flex-shrink-0 flex gap-1">
        <Button
          variant={filterMode === 'all' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs px-3 rounded-full"
          onClick={() => setFilterMode('all')}
        >
          All
        </Button>
        <Button
          variant={filterMode === 'awaiting' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs px-3 rounded-full gap-1"
          onClick={() => setFilterMode('awaiting')}
        >
          <Clock className="h-3 w-3" />
          Awaiting Reply
          {unansweredIds.size > 0 && (
            <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px] ml-0.5">
              {unansweredIds.size}
            </Badge>
          )}
        </Button>
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
            const waitingBadge = getWaitingBadge(customer);
            
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
                    {unreadCount > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs animate-pulse flex-shrink-0">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <p className={cn(
                      "text-xs truncate",
                      unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                      {lastMessage ? (
                        <>
                          {lastMessage.senderType === 'employee' && (
                            <span className="text-muted-foreground">{lastMessage.sentByName || 'You'}: </span>
                          )}
                          {lastMessage.text.length > 25 ? lastMessage.text.substring(0, 25) + '…' : lastMessage.text}
                        </>
                      ) : 'No messages yet'}
                    </p>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 whitespace-nowrap">
                      · {formatRelativeTime(lastMessage?.timestamp || customer.last_message_at) || '—'}
                    </span>
                    {waitingBadge && (
                      <span className={cn("text-[9px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0", waitingBadge.colorClass)}>
                        {waitingBadge.label}
                      </span>
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
