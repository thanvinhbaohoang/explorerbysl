import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Activity, Database, MessageSquare, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: string;
  telegram_id: number | null;
  messenger_id: string | null;
  first_name: string | null;
  last_name: string | null;
  messenger_name: string | null;
  created_at: string;
}

interface Message {
  id: string;
  customer_id: string;
  platform: string;
  message_text: string | null;
  message_type: string | null;
  sender_type: string | null;
  timestamp: string;
}

const WebhookDebug = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'unknown' | 'success' | 'error'>('unknown');
  
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/messenger-webhook`;

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch customers
    const { data: customersData, error: customersError } = await supabase
      .from('customer')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (customersError) {
      console.error('Error fetching customers:', customersError);
      toast.error('Failed to fetch customers');
    } else {
      setCustomers(customersData || []);
    }
    
    // Fetch messages
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(20);
    
    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      toast.error('Failed to fetch messages');
    } else {
      setMessages(messagesData || []);
    }
    
    setLoading(false);
  };

  const testWebhook = async () => {
    setTesting(true);
    try {
      const response = await fetch(`${webhookUrl}/health`, {
        method: 'GET',
      });
      
      if (response.ok) {
        setWebhookStatus('success');
        toast.success('Webhook is responding!');
      } else {
        setWebhookStatus('error');
        toast.error(`Webhook error: ${response.status}`);
      }
    } catch (error) {
      setWebhookStatus('error');
      toast.error('Failed to reach webhook');
      console.error('Webhook test error:', error);
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchData, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const messengerCustomers = customers.filter(c => c.messenger_id);
  const telegramCustomers = customers.filter(c => c.telegram_id);
  const messengerMessages = messages.filter(m => m.platform === 'messenger');

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Webhook Debug</h1>
            <p className="text-muted-foreground mt-2">Monitor and test your Messenger webhook integration</p>
          </div>
          <Button onClick={fetchData} disabled={loading} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Webhook Status */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Webhook Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                {webhookStatus === 'success' && (
                  <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Active
                  </Badge>
                )}
                {webhookStatus === 'error' && (
                  <Badge className="bg-red-500/10 text-red-500 hover:bg-red-500/20">
                    <XCircle className="mr-1 h-3 w-3" />
                    Error
                  </Badge>
                )}
                {webhookStatus === 'unknown' && (
                  <Badge variant="secondary">Unknown</Badge>
                )}
              </div>
              <Button onClick={testWebhook} disabled={testing} className="w-full">
                {testing ? 'Testing...' : 'Test Connection'}
              </Button>
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Webhook URL:</p>
                <p className="text-xs font-mono break-all">{webhookUrl}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Messenger Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Customers</span>
                <span className="text-2xl font-bold">{messengerCustomers.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Messages</span>
                <span className="text-2xl font-bold">{messengerMessages.length}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Telegram Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Customers</span>
                <span className="text-2xl font-bold">{telegramCustomers.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Messages</span>
                <span className="text-2xl font-bold">{messages.filter(m => m.platform === 'telegram').length}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Customers</CardTitle>
            <CardDescription>Latest 10 customers across all platforms</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        {customer.messenger_name || 
                         `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 
                         'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={customer.messenger_id ? 'default' : 'secondary'}>
                          {customer.messenger_id ? 'Messenger' : 'Telegram'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {customer.messenger_id || customer.telegram_id}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(customer.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Messages</CardTitle>
            <CardDescription>Latest 20 messages across all platforms</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No messages found
                    </TableCell>
                  </TableRow>
                ) : (
                  messages.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell>
                        <Badge variant={message.platform === 'messenger' ? 'default' : 'secondary'}>
                          {message.platform}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{message.message_type}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={message.sender_type === 'customer' ? 'default' : 'secondary'}>
                          {message.sender_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {message.message_text || `[${message.message_type}]`}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(message.timestamp).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WebhookDebug;
