import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { ChatConversationList } from "@/components/ChatConversationList";
import { ChatPanel } from "@/components/ChatPanel";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { MessageSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCustomersData } from "@/hooks/useCustomersData";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const customerId = searchParams.get('customer');
  
  // Fetch customers data to enable URL-based customer selection
  const { data: customersData } = useCustomersData(1, 100);
  const customers = (customersData?.customers || []) as Customer[];

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
          />
        ) : (
          <ChatConversationList 
            selectedId={null}
            onSelect={setSelectedCustomer}
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
          />
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        <ResizablePanel defaultSize={70}>
          {selectedCustomer ? (
            <ChatPanel customer={selectedCustomer} />
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
