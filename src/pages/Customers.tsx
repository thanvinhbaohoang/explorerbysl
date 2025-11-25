import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bell, ChevronLeft, ChevronRight, Send, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TableSkeleton } from "@/components/TableSkeleton";

interface Customer {
  id: string;
  telegram_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  first_message_at: string;
  is_premium: boolean | null;
  language_code: string | null;
  unread_count?: number;
}

interface Message {
  id: string;
  telegram_id: number;
  message_text: string | null;
  message_type: string | null;
  sender_type: string | null;
  timestamp: string;
  is_read: boolean | null;
  photo_url: string | null;
  voice_url: string | null;
  voice_duration: number | null;
  voice_transcription: string | null;
  video_url: string | null;
  video_duration: number | null;
}

const Customers = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customersPage, setCustomersPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [hasNewCustomers, setHasNewCustomers] = useState(false);

  const ITEMS_PER_PAGE = 10;
  const totalCustomerPages = Math.ceil(totalCustomers / ITEMS_PER_PAGE);

  const fetchCustomers = async (page: number) => {
    try {
      setIsLoading(true);
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { count } = await supabase
        .from("customer")
        .select("*", { count: "exact", head: true });

      setTotalCustomers(count || 0);

      const { data: customersData, error } = await supabase
        .from("customer")
        .select("*")
        .order("first_message_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const customersWithUnread = await Promise.all(
        (customersData || []).map(async (customer) => {
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .eq("customer_id", customer.id)
            .eq("is_read", false)
            .eq("sender_type", "customer");

          return {
            ...customer,
            unread_count: count || 0,
          };
        })
      );

      setCustomers(customersWithUnread);
      setHasNewCustomers(false);
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Failed to load customers");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnreadCounts = async () => {
    const customersWithUnread = await Promise.all(
      customers.map(async (customer) => {
        const { count } = await supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("customer_id", customer.id)
          .eq("is_read", false)
          .eq("sender_type", "customer");

        return {
          ...customer,
          unread_count: count || 0,
        };
      })
    );

    setCustomers(customersWithUnread);
  };

  const loadMessages = async (customer: Customer) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("customer_id", customer.id)
        .order("timestamp", { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("customer_id", customer.id)
        .eq("sender_type", "customer")
        .eq("is_read", false);

      await fetchUnreadCounts();
    } catch (error) {
      console.error("Error loading messages:", error);
      toast.error("Failed to load messages");
    }
  };

  const handleCustomerSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    loadMessages(customer);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedCustomer) return;

    try {
      const { error } = await supabase.from("messages").insert({
        customer_id: selectedCustomer.id,
        telegram_id: selectedCustomer.telegram_id,
        message_text: newMessage,
        message_type: "text",
        sender_type: "admin",
        timestamp: new Date().toISOString(),
      });

      if (error) throw error;

      setNewMessage("");
      await loadMessages(selectedCustomer);
      toast.success("Message sent");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message");
    }
  };

  useEffect(() => {
    fetchCustomers(customersPage);
  }, [customersPage]);

  useEffect(() => {
    const customerChannel = supabase
      .channel("customer-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "customer",
        },
        () => {
          setHasNewCustomers(true);
          toast.success("New customer detected!", {
            description: "Click to refresh the list",
            action: {
              label: "Refresh",
              onClick: () => fetchCustomers(customersPage),
            },
          });
        }
      )
      .subscribe();

    const messagesChannel = supabase
      .channel("all-customer-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          if (
            selectedCustomer &&
            payload.new.customer_id === selectedCustomer.id
          ) {
            toast.info("New message received", {
              description: "Click to refresh the conversation",
              action: {
                label: "Refresh",
                onClick: () => loadMessages(selectedCustomer),
              },
            });
          }
          fetchUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(customerChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [selectedCustomer, customersPage, customers]);

  const getCustomerName = (customer: Customer) => {
    if (customer.first_name || customer.last_name) {
      return `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
    }
    return customer.username || `User ${customer.telegram_id}`;
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold text-foreground">Customers</h1>
            <p className="text-muted-foreground mt-2">Manage your customer conversations</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Customer List</CardTitle>
                  <CardDescription>Total: {totalCustomers}</CardDescription>
                </div>
                {hasNewCustomers && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchCustomers(customersPage)}
                    className="animate-pulse"
                  >
                    <Bell className="h-4 w-4 mr-2" />
                    New Updates
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <TableSkeleton rows={5} columns={2} />
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Unread</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.map((customer) => (
                          <TableRow
                            key={customer.id}
                            className={`cursor-pointer ${
                              selectedCustomer?.id === customer.id
                                ? "bg-muted"
                                : ""
                            }`}
                            onClick={() => handleCustomerSelect(customer)}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback>
                                    {getCustomerName(customer)
                                      .substring(0, 2)
                                      .toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">
                                    {getCustomerName(customer)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    @{customer.username || customer.telegram_id}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {customer.unread_count! > 0 && (
                                <Badge variant="destructive">
                                  {customer.unread_count}
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomersPage((p) => Math.max(1, p - 1))}
                      disabled={customersPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {customersPage} of {totalCustomerPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCustomersPage((p) =>
                          Math.min(totalCustomerPages, p + 1)
                        )
                      }
                      disabled={customersPage === totalCustomerPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                {selectedCustomer
                  ? `Chat with ${getCustomerName(selectedCustomer)}`
                  : "Select a customer"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCustomer ? (
                <div className="space-y-4">
                  <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.sender_type === "admin"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              message.sender_type === "admin"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            {message.message_text && (
                              <p className="text-sm">{message.message_text}</p>
                            )}
                            {message.photo_url && (
                              <img
                                src={message.photo_url}
                                alt="Shared"
                                className="rounded mt-2 max-w-full"
                              />
                            )}
                            {message.voice_url && (
                              <div className="mt-2">
                                <audio controls src={message.voice_url} className="max-w-full" />
                                {message.voice_transcription && (
                                  <p className="text-xs mt-1 italic">
                                    {message.voice_transcription}
                                  </p>
                                )}
                              </div>
                            )}
                            {message.video_url && (
                              <video
                                controls
                                src={message.video_url}
                                className="rounded mt-2 max-w-full"
                              />
                            )}
                            <p className="text-xs opacity-70 mt-1">
                              {new Date(message.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    />
                    <Button onClick={handleSendMessage} size="icon">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Select a customer to view their conversation
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Customers;
