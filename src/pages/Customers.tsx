import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
import { Users, Bell, MessageSquare, Send, Facebook, AlertCircle, Link, Paperclip, Image, Video, X, Loader2, Mic, Square } from "lucide-react";
import { TableSkeleton } from "@/components/TableSkeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  linked_customer_id: string | null;
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
  const navigate = useNavigate();
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
  const [linkedCustomerIds, setLinkedCustomerIds] = useState<string[]>([]);
  const [linkedCustomersMap, setLinkedCustomersMap] = useState<Record<string, { name: string; platform: string; telegram_id: number | null; messenger_id: string | null }>>({});
  const [platformFilter, setPlatformFilter] = useState<'telegram' | 'messenger' | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const fileInputRef = useState<HTMLInputElement | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const itemsPerPage = 10;
  const messagesPerPage = 10;

  // Filter messages by platform
  const filteredMessages = useMemo(() => {
    if (!platformFilter || linkedCustomerIds.length <= 1) {
      return messages;
    }
    
    // Get customer IDs for the selected platform
    const filteredCustomerIds = Object.entries(linkedCustomersMap)
      .filter(([_, info]) => info.platform === platformFilter)
      .map(([customerId]) => customerId);
    
    return messages.filter(msg => filteredCustomerIds.includes(msg.customer_id));
  }, [messages, platformFilter, linkedCustomersMap, linkedCustomerIds]);

  // Get the customer to reply to based on filter
  const replyCustomer = useMemo(() => {
    if (!platformFilter || linkedCustomerIds.length <= 1) {
      return selectedCustomer;
    }
    // Find the customer ID for the selected platform
    const entry = Object.entries(linkedCustomersMap).find(([_, info]) => info.platform === platformFilter);
    if (!entry) return selectedCustomer;
    
    // Return a modified customer object for the selected platform
    const [customerId, info] = entry;
    if (customerId === selectedCustomer?.id) return selectedCustomer;
    
    // Create a customer object with the actual platform IDs
    return {
      ...selectedCustomer,
      id: customerId,
      messenger_id: info.messenger_id,
      telegram_id: info.telegram_id,
    } as Customer;
  }, [platformFilter, linkedCustomersMap, selectedCustomer, linkedCustomerIds]);

  // Check if the current platform filter is Messenger and outside 24-hour window
  const isCurrentPlatformMessengerOutsideWindow = useMemo(() => {
    const currentCustomer = replyCustomer || selectedCustomer;
    if (!currentCustomer?.messenger_id || messages.length === 0) return false;
    
    // Get messages for the current platform only
    const platformMessages = platformFilter 
      ? messages.filter(msg => {
          const info = linkedCustomersMap[msg.customer_id];
          return info?.platform === platformFilter;
        })
      : messages;
    
    // Find last customer message for current platform
    const lastCustomerMessage = [...platformMessages]
      .reverse()
      .find(msg => msg.sender_type === 'customer');
    
    if (!lastCustomerMessage) return false;
    
    const hoursSinceLastMessage = (Date.now() - new Date(lastCustomerMessage.timestamp).getTime()) / (1000 * 60 * 60);
    return hoursSinceLastMessage > 24;
  }, [replyCustomer, selectedCustomer, messages, platformFilter, linkedCustomersMap]);


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

  // Build map of linked platforms for unified customer display
  const [linkedPlatformsMap, setLinkedPlatformsMap] = useState<Record<string, { telegram: boolean; messenger: boolean; linkedIds: string[] }>>({});

  // Fetch customers with pagination (unified view - hide secondary linked accounts)
  const fetchCustomers = async (page: number) => {
    setIsLoading(true);
    try {
      // Get total count of PRIMARY customers only (those without linked_customer_id)
      const { count, error: countError } = await supabase
        .from("customer")
        .select("*", { count: "exact", head: true })
        .is("linked_customer_id", null);

      if (countError) throw countError;
      setTotalCustomers(count || 0);

      // Fetch paginated data - only PRIMARY customers
      const from = (page - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      const { data: customersData, error } = await supabase
        .from("customer")
        .select("*")
        .is("linked_customer_id", null)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      // Build linked platforms map
      if (customersData && customersData.length > 0) {
        const customerIds = customersData.map(c => c.id);
        
        // Fetch customers that link to these primary customers
        const { data: linkedCustomers } = await supabase
          .from("customer")
          .select("id, linked_customer_id, telegram_id, messenger_id")
          .in("linked_customer_id", customerIds);
        
        // Build the map
        const platformsMap: Record<string, { telegram: boolean; messenger: boolean; linkedIds: string[] }> = {};
        customersData.forEach(customer => {
          const linkedToThis = linkedCustomers?.filter(lc => lc.linked_customer_id === customer.id) || [];
          const allIds = [customer.id, ...linkedToThis.map(lc => lc.id)];
          const hasTelegram = customer.telegram_id !== null || linkedToThis.some(lc => lc.telegram_id !== null);
          const hasMessenger = customer.messenger_id !== null || linkedToThis.some(lc => lc.messenger_id !== null);
          
          platformsMap[customer.id] = {
            telegram: hasTelegram,
            messenger: hasMessenger,
            linkedIds: allIds,
          };
        });
        setLinkedPlatformsMap(platformsMap);
        
        // Fetch lead sources
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
        setLinkedPlatformsMap({});
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
    const customerToReply = replyCustomer || selectedCustomer;
    if (!replyText.trim() || !customerToReply || isSending) return;

    const messageToSend = replyText;
    const tempId = `temp-${Date.now()}`;
    const platform = customerToReply.messenger_id ? 'messenger' : 'telegram';
    
    // Optimistically add message to UI
    const optimisticMessage: Message = {
      id: tempId,
      customer_id: customerToReply.id,
      telegram_id: customerToReply.telegram_id,
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
            psid: customerToReply.messenger_id,
            text: messageToSend,
          },
        });
      } else {
        // Send via Telegram bot
        response = await supabase.functions.invoke("telegram-bot", {
          body: {
            action: "send_message",
            telegram_id: customerToReply.telegram_id,
            customer_id: customerToReply.id,
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
        [customerToReply.id]: "employee",
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

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 25MB for Telegram, 25MB for Messenger)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File is too large. Maximum size is 25MB.");
      return;
    }

    setSelectedFile(file);

    // Create preview for images and videos
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  // Clear selected file
  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  // Determine media type from file
  const getMediaType = (file: File): 'photo' | 'video' | 'document' => {
    if (file.type.startsWith('image/')) return 'photo';
    if (file.type.startsWith('video/')) return 'video';
    return 'document';
  };

  // Upload file to Supabase Storage and get public URL
  const uploadFileToStorage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `chat-media/${fileName}`;

    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error("Storage upload error:", error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  // Send media file
  const sendMedia = async () => {
    const customerToReply = replyCustomer || selectedCustomer;
    if (!selectedFile || !customerToReply || isUploadingFile) return;

    const mediaType = getMediaType(selectedFile);
    const platform = customerToReply.messenger_id ? 'messenger' : 'telegram';
    const tempId = `temp-media-${Date.now()}`;
    const caption = replyText.trim() || undefined;

    // Optimistically add message to UI
    const optimisticMessage: Message = {
      id: tempId,
      customer_id: customerToReply.id,
      telegram_id: customerToReply.telegram_id,
      message_text: caption || `[${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}]`,
      message_type: mediaType,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      photo_file_id: null,
      photo_url: mediaType === 'photo' ? filePreview : null,
      voice_file_id: null,
      voice_duration: null,
      voice_transcription: null,
      voice_url: null,
      video_file_id: null,
      video_url: mediaType === 'video' ? filePreview : null,
      video_duration: null,
      video_mime_type: selectedFile.type,
      sender_type: "employee",
      is_read: true,
      platform,
      messenger_mid: null,
      isPending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setIsUploadingFile(true);
    clearSelectedFile();
    setReplyText("");

    // Scroll to bottom
    setTimeout(() => {
      const messagesContainer = document.getElementById('messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 50);

    try {
      // Upload to storage first
      const mediaUrl = await uploadFileToStorage(selectedFile);
      console.log("File uploaded to storage:", mediaUrl);

      let response;
      if (platform === 'messenger') {
        response = await supabase.functions.invoke("messenger-webhook", {
          body: {
            psid: customerToReply.messenger_id,
            media_url: mediaUrl,
            media_type: mediaType,
            caption,
          },
        });
      } else {
        response = await supabase.functions.invoke("telegram-bot", {
          body: {
            action: "send_media",
            telegram_id: customerToReply.telegram_id,
            customer_id: customerToReply.id,
            media_url: mediaUrl,
            media_type: mediaType,
            caption,
          },
        });
      }

      if (response.error) throw response.error;

      if (response.data?.error && response.data?.code === 'MESSAGING_WINDOW_EXPIRED') {
        throw new Error(response.data.error);
      }

      // Remove optimistic message - real-time subscription will add the real one
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));

      setLastMessageSender((prev) => ({
        ...prev,
        [customerToReply.id]: "employee",
      }));

      toast.success("Media sent successfully");
    } catch (error: any) {
      console.error("Error sending media:", error);
      
      if (error.message?.includes('24-hour messaging window')) {
        toast.error("Cannot send media: The 24-hour messaging window has expired.", { duration: 5000 });
      } else {
        toast.error("Failed to send media: " + error.message);
      }
      
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        await sendVoiceClip(audioFile);
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);

      // Start duration counter
      const interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      recordingIntervalRef.current = interval;
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone');
    }
  };

  // Stop voice recording
  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    setMediaRecorder(null);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setRecordingDuration(0);
  };

  // Cancel voice recording
  const cancelRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setMediaRecorder(null);
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setRecordingDuration(0);
  };

  // Send voice clip
  const sendVoiceClip = async (audioFile: File) => {
    const customerToReply = replyCustomer || selectedCustomer;
    if (!customerToReply) return;

    const platform = customerToReply.messenger_id ? 'messenger' : 'telegram';
    const tempId = `temp-voice-${Date.now()}`;

    // Optimistically add message to UI
    const optimisticMessage: Message = {
      id: tempId,
      customer_id: customerToReply.id,
      telegram_id: customerToReply.telegram_id,
      message_text: '[Voice message]',
      message_type: 'voice',
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      photo_file_id: null,
      photo_url: null,
      voice_file_id: null,
      voice_duration: recordingDuration,
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
    setIsUploadingFile(true);

    // Scroll to bottom
    setTimeout(() => {
      const messagesContainer = document.getElementById('messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 50);

    try {
      // Upload to storage first
      const mediaUrl = await uploadFileToStorage(audioFile);
      console.log("Voice clip uploaded to storage:", mediaUrl);

      let response;
      if (platform === 'messenger') {
        // For Messenger, send as audio attachment
        response = await supabase.functions.invoke("messenger-webhook", {
          body: {
            psid: customerToReply.messenger_id,
            media_url: mediaUrl,
            media_type: 'audio',
          },
        });
      } else {
        // For Telegram, send as voice
        response = await supabase.functions.invoke("telegram-bot", {
          body: {
            action: "send_media",
            telegram_id: customerToReply.telegram_id,
            customer_id: customerToReply.id,
            media_url: mediaUrl,
            media_type: 'voice',
          },
        });
      }

      if (response.error) throw response.error;

      if (response.data?.error && response.data?.code === 'MESSAGING_WINDOW_EXPIRED') {
        throw new Error(response.data.error);
      }

      // Remove optimistic message - real-time subscription will add the real one
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));

      setLastMessageSender((prev) => ({
        ...prev,
        [customerToReply.id]: "employee",
      }));

      toast.success("Voice message sent");
    } catch (error: any) {
      console.error("Error sending voice clip:", error);
      
      if (error.message?.includes('24-hour messaging window')) {
        toast.error("Cannot send voice: The 24-hour messaging window has expired.", { duration: 5000 });
      } else {
        toast.error("Failed to send voice message: " + error.message);
      }
      
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Format recording duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Load messages for selected customer (including linked accounts)
  const loadMessages = async (customer: Customer, offset = 0, forceRefresh = false) => {
    setSelectedCustomer(customer);
    setDialogOpen(true);
    
    // Only set initial platform filter on first load
    if (offset === 0) {
      const initialPlatform = customer.messenger_id ? 'messenger' : 'telegram';
      setPlatformFilter(initialPlatform);
    }
    
    // Fetch linked customer IDs first
    const allCustomerIds = [customer.id];
    const linkedMap: Record<string, { name: string; platform: string; telegram_id: number | null; messenger_id: string | null }> = {};
    
    // Add current customer to map
    linkedMap[customer.id] = {
      name: customer.messenger_name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Unknown",
      platform: customer.messenger_id ? "messenger" : "telegram",
      telegram_id: customer.telegram_id,
      messenger_id: customer.messenger_id
    };
    
    try {
      // If this customer links to another (primary)
      if (customer.linked_customer_id) {
        allCustomerIds.push(customer.linked_customer_id);
        const { data: primary } = await supabase
          .from("customer")
          .select("id, first_name, last_name, messenger_name, messenger_id, telegram_id")
          .eq("id", customer.linked_customer_id)
          .maybeSingle();
        
        if (primary) {
          linkedMap[primary.id] = {
            name: primary.messenger_name || `${primary.first_name || ""} ${primary.last_name || ""}`.trim() || "Unknown",
            platform: primary.messenger_id ? "messenger" : "telegram",
            telegram_id: primary.telegram_id,
            messenger_id: primary.messenger_id
          };
        }
      }
      
      // Find customers that link to this one
      const { data: linkedToThis } = await supabase
        .from("customer")
        .select("id, first_name, last_name, messenger_name, messenger_id, telegram_id")
        .eq("linked_customer_id", customer.id);
      
      if (linkedToThis) {
        linkedToThis.forEach(linked => {
          allCustomerIds.push(linked.id);
          linkedMap[linked.id] = {
            name: linked.messenger_name || `${linked.first_name || ""} ${linked.last_name || ""}`.trim() || "Unknown",
            platform: linked.messenger_id ? "messenger" : "telegram",
            telegram_id: linked.telegram_id,
            messenger_id: linked.messenger_id
          };
        });
      }
    } catch (err) {
      console.error("Error fetching linked customers:", err);
    }
    
    setLinkedCustomerIds(allCustomerIds);
    setLinkedCustomersMap(linkedMap);
    
    // Check cache first (only if not forcing refresh and offset is 0)
    const cacheKey = allCustomerIds.sort().join("-");
    if (offset === 0 && !forceRefresh && messagesCache[cacheKey]) {
      setMessages(messagesCache[cacheKey]);
      const meta = messageMetaCache[cacheKey];
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
      // Mark all unread messages as read for all linked customers (only on initial load)
      if (offset === 0) {
        await supabase
          .from("messages")
          .update({ is_read: true })
          .in("customer_id", allCustomerIds)
          .eq("sender_type", "customer")
          .eq("is_read", false);

        // Reset unread count for all linked customers
        setUnreadCounts((prev) => {
          const updated = { ...prev };
          allCustomerIds.forEach(id => { updated[id] = 0; });
          return updated;
        });
      }

      // Get total count for all linked customers
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("customer_id", allCustomerIds);

      const totalMessages = count || 0;
      const newOffset = offset + messagesPerPage;
      const hasMore = newOffset < totalMessages;
      setHasMoreMessages(hasMore);
      setMessageOffset(newOffset);

      // Fetch paginated messages from all linked customers (newest first, then reverse)
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .in("customer_id", allCustomerIds)
        .order("timestamp", { ascending: false })
        .range(offset, offset + messagesPerPage - 1);

      if (error) throw error;
      
      const messagesData = (data || []).reverse();
      
      if (offset === 0) {
        setMessages(messagesData);
        
        // Cache the messages and metadata
        setMessagesCache((prev) => ({
          ...prev,
          [cacheKey]: messagesData,
        }));
        setMessageMetaCache((prev) => ({
          ...prev,
          [cacheKey]: { offset: newOffset, hasMore },
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
          [cacheKey]: newMessages,
        }));
        setMessageMetaCache((prev) => ({
          ...prev,
          [cacheKey]: { offset: newOffset, hasMore },
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

  // Check for potential matching customers across platforms
  const checkForLinkingSuggestion = async (newCustomer: Customer) => {
    const newName = newCustomer.messenger_name || 
      `${newCustomer.first_name || ""} ${newCustomer.last_name || ""}`.trim();
    
    if (!newName || newName === "Unknown") return;
    
    const newPlatform = newCustomer.messenger_id ? "messenger" : "telegram";
    
    try {
      // Search for customers with similar names on the opposite platform
      let query = supabase
        .from("customer")
        .select("id, first_name, last_name, messenger_name, messenger_id, telegram_id, linked_customer_id")
        .neq("id", newCustomer.id)
        .is("linked_customer_id", null);
      
      // Filter by opposite platform
      if (newPlatform === "messenger") {
        query = query.not("telegram_id", "is", null);
      } else {
        query = query.not("messenger_id", "is", null);
      }
      
      const { data: potentialMatches } = await query;
      
      if (!potentialMatches) return;
      
      // Find matches with similar names (case-insensitive)
      const normalizedNewName = newName.toLowerCase().trim();
      const matches = potentialMatches.filter(customer => {
        const existingName = customer.messenger_name || 
          `${customer.first_name || ""} ${customer.last_name || ""}`.trim();
        const normalizedExistingName = existingName.toLowerCase().trim();
        
        // Check for exact match or high similarity
        return normalizedNewName === normalizedExistingName ||
          (normalizedNewName.length > 3 && normalizedExistingName.includes(normalizedNewName)) ||
          (normalizedExistingName.length > 3 && normalizedNewName.includes(normalizedExistingName));
      });
      
      if (matches.length > 0) {
        const match = matches[0];
        const matchName = match.messenger_name || 
          `${match.first_name || ""} ${match.last_name || ""}`.trim();
        const matchPlatform = match.messenger_id ? "Messenger" : "Telegram";
        
        toast.info(
          `Possible duplicate: "${newName}" might be the same as "${matchName}" on ${matchPlatform}`,
          {
            description: "Click to view and link these accounts",
            icon: <Link className="h-4 w-4" />,
            duration: 10000,
            action: {
              label: "View & Link",
              onClick: () => navigate(`/customers/${newCustomer.id}`),
            },
          }
        );
      }
    } catch (error) {
      console.error("Error checking for linking suggestions:", error);
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
        async (payload) => {
          const newCustomer = payload.new as Customer;
          console.log("New customer joined:", newCustomer);
          
          setHasNewCustomers(true);
          
          // Show notification with refresh option
          toast.success(
            `New customer: ${newCustomer.messenger_name || newCustomer.first_name || "Unknown"} ${newCustomer.last_name || ""}`,
            {
              description: "Click to refresh the customer list",
              icon: <Bell className="h-4 w-4" />,
              action: {
                label: "Refresh",
                onClick: () => fetchCustomers(customersPage),
              },
            }
          );
          
          // Check for potential linking matches
          await checkForLinkingSuggestion(newCustomer);
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

          // If this message is for the currently open dialog (including linked accounts)
          const isForCurrentDialog = linkedCustomerIds.includes(newMessage.customer_id) && dialogOpen;
          if (isForCurrentDialog) {
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
              
              // Update cache with correct key (sorted linked customer IDs)
              const cacheKey = [...linkedCustomerIds].sort().join("-");
              setMessagesCache((cache) => ({
                ...cache,
                [cacheKey]: newMessages,
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
  }, [selectedCustomer, customers, dialogOpen, linkedCustomerIds]);

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
                      const platforms = linkedPlatformsMap[customer.id];
                      const hasBothPlatforms = platforms?.telegram && platforms?.messenger;
                      const primaryPlatform = customer.messenger_id ? 'messenger' : 'telegram';
                      const displayName = customer.messenger_id 
                        ? customer.messenger_name 
                        : `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
                      
                      return (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {hasBothPlatforms ? (
                                <>
                                  <Badge variant="secondary" className="w-fit">
                                    <Send className="h-3 w-3 mr-1" /> Telegram
                                  </Badge>
                                  <Badge variant="default" className="w-fit">
                                    <Facebook className="h-3 w-3 mr-1" /> Messenger
                                  </Badge>
                                </>
                              ) : (
                                <Badge variant={primaryPlatform === 'messenger' ? 'default' : 'secondary'}>
                                  {primaryPlatform === 'messenger' ? (
                                    <><Facebook className="h-3 w-3 mr-1" /> Messenger</>
                                  ) : (
                                    <><Send className="h-3 w-3 mr-1" /> Telegram</>
                                  )}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => navigate(`/customers/${customer.id}`)}
                                className="hover:underline hover:text-primary text-left"
                              >
                                {displayName || 'Unknown'}
                              </button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {primaryPlatform === 'messenger' ? (
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
                              {primaryPlatform === 'messenger' 
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
                              {primaryPlatform === 'messenger' ? (
                                <Facebook className="h-4 w-4 mr-2" />
                              ) : (
                                <Send className="h-4 w-4 mr-2" />
                              )}
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
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
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
            <DialogDescription asChild>
              <div>
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
                  <span>
                    @{selectedCustomer?.username || "No username"} • Telegram ID:{" "}
                    {selectedCustomer?.telegram_id}
                  </span>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>

          {/* Platform Toggle for Linked Accounts */}
          {linkedCustomerIds.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 py-2 border-b flex-shrink-0">
              <span className="text-xs text-muted-foreground">Platform:</span>
              {Object.entries(linkedCustomersMap).map(([customerId, info]) => (
                <Button
                  key={customerId}
                  variant={platformFilter === info.platform ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setPlatformFilter(info.platform as 'telegram' | 'messenger')}
                >
                  {info.platform === 'messenger' ? (
                    <Facebook className="h-3 w-3 mr-1" />
                  ) : (
                    <Send className="h-3 w-3 mr-1" />
                  )}
                  {info.name}
                </Button>
              ))}
            </div>
          )}

          {/* Scrollable Messages Area */}
          <div 
            id="messages-container"
            className="flex-1 overflow-y-auto min-h-0"
            onScroll={handleMessagesScroll}
          >
            {isLoadingMessages ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading messages...
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {platformFilter ? `No messages on ${platformFilter === 'messenger' ? 'Messenger' : 'Telegram'}` : 'No messages yet'}
              </div>
            ) : (
              <div className="space-y-4 p-1">
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
                {filteredMessages.map((message) => {
                  const msgPlatformInfo = linkedCustomersMap[message.customer_id];
                  
                  return (
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
                  );
                })}
              </div>
            )}
          </div>

          {/* Reply Input */}
          {selectedCustomer && (
            <div className="flex-shrink-0 pt-4 border-t">
              {/* 24-hour window warning for Messenger */}
              {platformFilter === 'messenger' && isCurrentPlatformMessengerOutsideWindow && (
                <Alert className="mb-3 border-amber-500/50 bg-amber-500/10">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-sm text-amber-600 dark:text-amber-500">
                    This customer hasn't messaged in over 24 hours. Facebook's messaging policy prevents sending messages outside this window. Please reply directly on your Facebook Page inbox.
                  </AlertDescription>
                </Alert>
              )}
              
              {/* File Preview */}
              {selectedFile && (
                <div className="mb-3 p-3 border rounded-lg bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getMediaType(selectedFile) === 'photo' && <Image className="h-4 w-4 text-muted-foreground" />}
                      {getMediaType(selectedFile) === 'video' && <Video className="h-4 w-4 text-muted-foreground" />}
                      {getMediaType(selectedFile) === 'document' && <Paperclip className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-sm truncate max-w-[200px]">{selectedFile.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearSelectedFile}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {filePreview && getMediaType(selectedFile) === 'photo' && (
                    <img src={filePreview} alt="Preview" className="mt-2 max-h-32 rounded object-contain" />
                  )}
                  {filePreview && getMediaType(selectedFile) === 'video' && (
                    <video src={filePreview} className="mt-2 max-h-32 rounded" controls />
                  )}
                </div>
              )}
              
              {/* Hidden file inputs */}
              <input
                type="file"
                id="image-upload"
                className="hidden"
                accept="image/*"
                onChange={handleFileSelect}
              />
              <input
                type="file"
                id="video-upload"
                className="hidden"
                accept="video/*"
                onChange={handleFileSelect}
              />
              <input
                type="file"
                id="file-upload"
                className="hidden"
                onChange={handleFileSelect}
              />
              
              <div className="flex gap-2">
                {/* Recording UI */}
                {isRecording ? (
                  <>
                    <div className="flex-1 flex items-center gap-3 px-3 py-2 bg-destructive/10 rounded-md border border-destructive/20">
                      <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                      <span className="text-sm font-medium text-destructive">Recording {formatDuration(recordingDuration)}</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={cancelRecording}
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="default" 
                      size="icon"
                      onClick={stopRecording}
                      title="Send voice"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Attachment dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon"
                          disabled={platformFilter === 'messenger' && isCurrentPlatformMessengerOutsideWindow || isUploadingFile}
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => document.getElementById('image-upload')?.click()}>
                          <Image className="h-4 w-4 mr-2" />
                          Photo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => document.getElementById('video-upload')?.click()}>
                          <Video className="h-4 w-4 mr-2" />
                          Video
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => document.getElementById('file-upload')?.click()}>
                          <Paperclip className="h-4 w-4 mr-2" />
                          File
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    {/* Voice recording button */}
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={startRecording}
                      disabled={platformFilter === 'messenger' && isCurrentPlatformMessengerOutsideWindow || isUploadingFile || !!selectedFile}
                      title="Record voice message"
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                    
                    <Input
                      placeholder={platformFilter === 'messenger' && isCurrentPlatformMessengerOutsideWindow ? "Chat disabled - reply on Facebook Page" : selectedFile ? "Add a caption (optional)..." : "Type your reply..."}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (selectedFile) {
                            sendMedia();
                          } else {
                            sendReply();
                          }
                        }
                      }}
                      autoFocus
                      disabled={platformFilter === 'messenger' && isCurrentPlatformMessengerOutsideWindow}
                      className="flex-1"
                    />
                    <Button 
                      onClick={selectedFile ? sendMedia : sendReply} 
                      disabled={((!replyText.trim() && !selectedFile) || isSending || isUploadingFile || (platformFilter === 'messenger' && isCurrentPlatformMessengerOutsideWindow))}
                      size="icon"
                    >
                      {isUploadingFile ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {platformFilter === 'messenger' && isCurrentPlatformMessengerOutsideWindow 
                  ? 'Messaging disabled due to 24-hour policy' 
                  : selectedFile 
                    ? `Press Enter to send ${getMediaType(selectedFile)} via ${platformFilter === 'messenger' ? 'Messenger' : 'Telegram'}`
                    : `Press Enter to send • This will be sent via ${platformFilter === 'messenger' ? 'Messenger' : 'Telegram'}`}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
