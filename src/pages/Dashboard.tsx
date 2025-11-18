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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Bell, MessageSquare, Send } from "lucide-react";

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
  sender_type: string;
}

const Dashboard = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);

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
  }, []);

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
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("customer_id", customer.id)
        .order("timestamp", { ascending: true }); // Changed to ascending

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

  // Real-time subscription for new messages
  useEffect(() => {
    if (!selectedCustomer) return;

    const channel = supabase
      .channel("message-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `customer_id=eq.${selectedCustomer.id}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          console.log("New message received:", newMessage);
          setMessages((prev) => [...prev, newMessage]); // Changed to append at end
          
          // Scroll to bottom when new message arrives
          setTimeout(() => {
            const messagesContainer = document.getElementById('messages-container');
            if (messagesContainer) {
              messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCustomer]);

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
              Monitor your Telegram bot customers in real-time
            </p>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-5 w-5" />
            <span className="text-2xl font-semibold">{customers.length}</span>
            <span>Total Customers</span>
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
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            View Messages
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
