import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Bell, Send, TrendingUp, BarChart3, FileAudio, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CustomersTable } from "@/components/CustomersTable";
import { TrafficTable } from "@/components/TrafficTable";
import { ScrollArea } from "@/components/ui/scroll-area";

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

const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [totalCustomers, setTotalCustomers] = useState(0);

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

  // Fetch total customers count
  const fetchTotalCustomers = async () => {
    const { count, error } = await supabase
      .from("customer")
      .select("*", { count: "exact", head: true });

    if (!error && count !== null) {
      setTotalCustomers(count);
    }
  };

  useEffect(() => {
    fetchUnreadCounts();
    fetchTotalCustomers();
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

      setTimeout(() => {
        const messagesContainer = document.getElementById("messages-container");
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

      setTimeout(() => {
        const messagesContainer = document.getElementById("messages-container");
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

  // Real-time subscription for new customer messages
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
          
          // Update unread count
          setUnreadCounts((prev) => ({
            ...prev,
            [newMessage.customer_id]: (prev[newMessage.customer_id] || 0) + 1,
          }));

          // Show toast notification
          toast.success("New message received", {
            description: "A customer sent a message",
            icon: <Bell className="h-4 w-4" />,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
            <span className="text-2xl font-semibold">{totalCustomers}</span>
            <span>Total Customers</span>
          </div>
        </div>

        <Tabs defaultValue="customers" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="customers">
              <Users className="h-4 w-4 mr-2" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="traffic">
              <TrendingUp className="h-4 w-4 mr-2" />
              Customer Traffic
            </TabsTrigger>
            <TabsTrigger value="ads" onClick={() => navigate("/ads-insight")}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Ad Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="customers">
            <Card>
              <CardHeader>
                <CardTitle>Customer List</CardTitle>
                <CardDescription>
                  All customers who have interacted with your bot (with server-side pagination, filtering, and search)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CustomersTable
                  onViewMessages={loadMessages}
                  unreadCounts={unreadCounts}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="traffic">
            <Card>
              <CardHeader>
                <CardTitle>Customer Traffic</CardTitle>
                <CardDescription>
                  Ad source tracking and customer acquisition data (with server-side pagination, filtering, and search)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrafficTable />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Messages Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                Messages with {selectedCustomer?.first_name}{" "}
                {selectedCustomer?.last_name}
              </DialogTitle>
              <DialogDescription>
                @{selectedCustomer?.username || "No username"} (Telegram ID:{" "}
                {selectedCustomer?.telegram_id})
              </DialogDescription>
            </DialogHeader>

            <ScrollArea
              id="messages-container"
              className="flex-1 pr-4 max-h-[50vh]"
            >
              {isLoadingMessages ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No messages yet
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender_type === "employee"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.sender_type === "employee"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {message.message_type === "text" && (
                          <p className="whitespace-pre-wrap">
                            {message.message_text}
                          </p>
                        )}
                        {message.message_type === "photo" && message.photo_url && (
                          <div>
                            <img
                              src={message.photo_url}
                              alt="Photo message"
                              className="max-w-full rounded mb-2"
                            />
                            {message.message_text && (
                              <p className="text-sm">{message.message_text}</p>
                            )}
                          </div>
                        )}
                        {message.message_type === "voice" && message.voice_url && (
                          <div className="flex items-center gap-2">
                            <FileAudio className="h-5 w-5" />
                            <audio controls src={message.voice_url} className="max-w-full" />
                          </div>
                        )}
                        {message.message_type === "video" && message.video_url && (
                          <div className="flex items-center gap-2">
                            <Video className="h-5 w-5" />
                            <video controls src={message.video_url} className="max-w-full rounded" />
                          </div>
                        )}
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(message.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="flex gap-2 pt-4 border-t">
              <Input
                placeholder="Type your reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendReply()}
              />
              <Button onClick={sendReply} disabled={isSending || !replyText.trim()}>
                {isSending ? (
                  "Sending..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Dashboard;
