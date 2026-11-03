import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ChatConversationList } from "@/components/ChatConversationList";
import { ChatPanel } from "@/components/ChatPanel";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { MessageSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCustomersData, invalidateFilteredCustomerCaches, type ConversationFilter } from "@/hooks/useCustomersData";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMessengerIntegration } from "@/hooks/useMessengerIntegration";

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

const Chat = () => {
  const isMobile = useIsMobile();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [chatListPage, setChatListPage] = useState(1);
  // Filter state lives here (not in ChatConversationList) because on mobile
  // the list unmounts when a conversation opens — local state would reset.
  const [chatFilter, setChatFilter] = useState<ConversationFilter>("all");
  const [searchParams, setSearchParams] = useSearchParams();
  const customerId = searchParams.get('customer');
  
  // Fetch customers data to enable URL-based customer selection
  const { isEnabled: messengerEnabled } = useMessengerIntegration();
  const { data: customersData } = useCustomersData(1, 100, "", "all", messengerEnabled);
  const customers = (customersData?.customers || []) as Customer[];

  // Page-level listener (stays mounted while the mobile list is hidden):
  // when a customer message flips from unread to read anywhere, refresh
  // the Unread tab. Ignores every other kind of message update.
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`chat-read-status-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        (payload) => {
          const next = payload.new as { sender_type?: string; is_read?: boolean };
          const prev = payload.old as { is_read?: boolean };
          if (next?.sender_type === "customer" && prev?.is_read === false && next?.is_read === true) {
            void invalidateFilteredCustomerCaches(queryClient, "unread");
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Auto-select customer from URL parameter
  useEffect(() => {
    if (customerId && customers.length > 0) {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setSelectedCustomer(customer);
        // Clear the URL parameter after selecting
        setSearchParams({}, { replace: true });
      }
    }
  }, [customerId, customers, setSearchParams]);

  // Mobile: Full-screen switching between list and chat
  if (isMobile) {
    return (
      <div className="h-[calc(100dvh-3.5rem)]">
        {selectedCustomer ? (
          <ChatPanel 
            customer={selectedCustomer} 
            onBack={() => setSelectedCustomer(null)}
            onSwitchCustomer={setSelectedCustomer}
          />
        ) : (
          <ChatConversationList 
            selectedId={null}
            onSelect={setSelectedCustomer}
            page={chatListPage}
            onPageChange={setChatListPage}
            filter={chatFilter}
            onFilterChange={setChatFilter}
          />
        )}
      </div>
    );
  }

  // Desktop: Keep resizable side-by-side layout
  return (
    <div className="h-[calc(100dvh-3.5rem)]">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
          <ChatConversationList 
            selectedId={selectedCustomer?.id || null}
            onSelect={setSelectedCustomer}
            page={chatListPage}
            onPageChange={setChatListPage}
            filter={chatFilter}
            onFilterChange={setChatFilter}
          />
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        <ResizablePanel defaultSize={70}>
          {selectedCustomer ? (
            <ChatPanel customer={selectedCustomer} onSwitchCustomer={setSelectedCustomer} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/20">
              <MessageSquare className="h-16 w-16 mb-4 opacity-30" />
              <h3 className="text-lg font-medium">Select a conversation</h3>
              <p className="text-sm mt-1">Choose a customer from the list to start chatting</p>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Chat;
