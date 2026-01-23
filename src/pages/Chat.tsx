import { useState } from "react";
import { ChatConversationList } from "@/components/ChatConversationList";
import { ChatPanel } from "@/components/ChatPanel";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { MessageSquare } from "lucide-react";

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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  return (
    <div className="h-[calc(100vh-3.5rem)]">
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
