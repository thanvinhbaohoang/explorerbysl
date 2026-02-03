import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomersData } from "@/hooks/useCustomersData";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { toast } from "sonner";
import { playMessageNotification, playNewCustomerNotification } from "@/lib/notification-sound";
import { processFileForUpload } from "@/lib/image-conversion";
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
import { Textarea } from "@/components/ui/textarea";
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
import { Users, Bell, MessageSquare, Send, Facebook, AlertCircle, Link, Paperclip, Image, Video, X, Loader2, Mic, Square, Play, Pause, Trash2, Clock, Download, FileText } from "lucide-react";
import { exportToCSV } from "@/lib/csv-export";
import { ChatSummaryDialog } from "@/components/ChatSummaryDialog";
import { TableSkeleton } from "@/components/TableSkeleton";
import { detectLanguage, getLanguageLabel } from "@/lib/language-detection";
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
  detected_language: string | null;
  is_premium: boolean;
  first_message_at: string;
  last_message_at: string | null;
  created_at: string;
  messenger_id: string | null;
  messenger_name: string | null;
  messenger_profile_pic: string | null;
  locale: string | null;
  timezone_offset: number | null;
  linked_customer_id: string | null;
  page_id: string | null;
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
  document_url: string | null;
  document_name: string | null;
  document_mime_type: string | null;
  sender_type: string;
  is_read: boolean;
  platform: string;
  messenger_mid: string | null;
  sent_by_name: string | null;
  media_group_id: string | null;
  isPending?: boolean; // For optimistic UI
}

const Customers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { permissions } = useUserPermissions();
  const queryClient = useQueryClient();
  const [customersPage, setCustomersPage] = useState(1);
  const itemsPerPage = 10;
  
  // Use cached customers data
  const { data: customersData, isLoading, refetch: refetchCustomers } = useCustomersData(customersPage, itemsPerPage);
  const customers = customersData?.customers || [];
  const totalCustomers = customersData?.total || 0;
  const linkedPlatformsMap = customersData?.linkedPlatformsMap || {};
  
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastMessageSender, setLastMessageSender] = useState<Record<string, string>>({});
  const [hasNewCustomers, setHasNewCustomers] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [messagesCache, setMessagesCache] = useState<Record<string, Message[]>>({});
  const [messageMetaCache, setMessageMetaCache] = useState<Record<string, { offset: number; hasMore: boolean }>>({});
  const [linkedCustomerIds, setLinkedCustomerIds] = useState<string[]>([]);
  const [linkedCustomersMap, setLinkedCustomersMap] = useState<Record<string, { name: string; platform: string; telegram_id: number | null; messenger_id: string | null; page_id: string | null }>>({});
  const [platformFilter, setPlatformFilter] = useState<'telegram' | 'messenger' | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<{ file: File; url: string } | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>([0, 0, 0, 0, 0]);
  const animationFrameRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Track customers where messaging window has expired (from API error)
  const [expiredWindowCustomers, setExpiredWindowCustomers] = useState<Set<string>>(new Set());
  const messagesPerPage = 50; // Fetch more messages to ensure enough per platform when filtering

  // Scroll to bottom of messages
  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // Auto-scroll to bottom when messages change, dialog opens, or platform filter changes
  useEffect(() => {
    if (dialogOpen && messages.length > 0 && !isLoadingMessages) {
      // Use setTimeout to ensure DOM is fully rendered
      const timeoutId = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [dialogOpen, messages.length, isLoadingMessages, platformFilter]);

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
      page_id: info.page_id,
    } as Customer;
  }, [platformFilter, linkedCustomersMap, selectedCustomer, linkedCustomerIds]);

  // Check if the current customer is Messenger and outside 24-hour window
  const isMessengerOutsideWindow = useMemo(() => {
    const currentCustomer = replyCustomer || selectedCustomer;
    
    // Determine if we're dealing with a Messenger customer
    const isMessenger = platformFilter === 'messenger' || 
      (!platformFilter && currentCustomer?.messenger_id && !currentCustomer?.telegram_id);
    
    if (!isMessenger) return false;
    if (!currentCustomer?.messenger_id) return false;
    
    // Check if this customer has been flagged as expired from API error
    if (expiredWindowCustomers.has(currentCustomer.id)) return true;
    
    if (messages.length === 0) return false;
    
    // Get messages for the current platform only
    const platformMessages = platformFilter 
      ? messages.filter(msg => {
          const info = linkedCustomersMap[msg.customer_id];
          return info?.platform === platformFilter;
        })
      : messages.filter(msg => msg.platform === 'messenger');
    
    // Find last customer message for current platform
    const lastCustomerMessage = [...platformMessages]
      .reverse()
      .find(msg => msg.sender_type === 'customer');
    
    if (!lastCustomerMessage) return false;
    
    const hoursSinceLastMessage = (Date.now() - new Date(lastCustomerMessage.timestamp).getTime()) / (1000 * 60 * 60);
    return hoursSinceLastMessage > 24;
  }, [replyCustomer, selectedCustomer, messages, platformFilter, linkedCustomersMap, expiredWindowCustomers]);

  // Calculate remaining time in 24-hour window for display
  const messengerWindowInfo = useMemo(() => {
    const currentCustomer = replyCustomer || selectedCustomer;
    if (!currentCustomer?.messenger_id) return null;
    
    // Determine if we're dealing with a Messenger customer
    const isMessenger = platformFilter === 'messenger' || 
      (!platformFilter && currentCustomer?.messenger_id && !currentCustomer?.telegram_id);
    
    if (!isMessenger) return null;
    
    const platformMessages = platformFilter 
      ? messages.filter(msg => {
          const info = linkedCustomersMap[msg.customer_id];
          return info?.platform === platformFilter;
        })
      : messages.filter(msg => msg.platform === 'messenger');
    
    const lastCustomerMessage = [...platformMessages]
      .reverse()
      .find(msg => msg.sender_type === 'customer');
    
    if (!lastCustomerMessage) return null;
    
    const msSinceLastMessage = Date.now() - new Date(lastCustomerMessage.timestamp).getTime();
    const hoursSince = msSinceLastMessage / (1000 * 60 * 60);
    const hoursRemaining = 24 - hoursSince;
    
    if (hoursRemaining <= 0) {
      return { expired: true, hoursSince: Math.floor(hoursSince), hoursRemaining: 0, minutesRemaining: 0 };
    }
    
    const fullHoursRemaining = Math.floor(hoursRemaining);
    const minutesRemaining = Math.floor((hoursRemaining - fullHoursRemaining) * 60);
    
    return { 
      expired: false, 
      hoursSince: Math.floor(hoursSince), 
      hoursRemaining: fullHoursRemaining, 
      minutesRemaining 
    };
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

  // Fetch when hasNewCustomers flag is set (from realtime updates)
  useEffect(() => {
    if (hasNewCustomers) {
      refetchCustomers();
      setHasNewCustomers(false);
    }
  }, [hasNewCustomers, refetchCustomers]);

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
    
    // Get employee display name from user email
    const employeeName = user?.email?.split('@')[0] || 'Employee';
    
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
      document_url: null,
      document_name: null,
      document_mime_type: null,
      sender_type: "employee",
      is_read: true,
      platform,
      messenger_mid: null,
      sent_by_name: employeeName,
      media_group_id: null,
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
      const employeeName = user?.email?.split('@')[0] || 'Employee';
      
      if (platform === 'messenger') {
        // Send via Messenger webhook
        console.log("Sending Messenger message with:", {
          psid: customerToReply.messenger_id,
          text: messageToSend,
          sent_by_name: employeeName,
          page_id: customerToReply.page_id,
        });
        response = await supabase.functions.invoke("messenger-webhook", {
          body: {
            psid: customerToReply.messenger_id,
            text: messageToSend,
            sent_by_name: employeeName,
            page_id: customerToReply.page_id,
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
            sent_by_name: employeeName,
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
      const isWindowExpired = error.message?.includes('24-hour messaging window') || 
                              error.message?.includes('MESSAGING_WINDOW_EXPIRED') ||
                              error.code === 'MESSAGING_WINDOW_EXPIRED';
      
      if (isWindowExpired && customerToReply) {
        // Add to expired customers set to disable input
        setExpiredWindowCustomers(prev => new Set(prev).add(customerToReply.id));
        toast.error("Cannot send message: The 24-hour messaging window has expired. Wait for the customer to message you first.", {
          duration: 8000,
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

  // Shared file processing function
  const processFiles = (files: File[]) => {
    const maxSize = 25 * 1024 * 1024;
    const validFiles: File[] = [];

    files.forEach((file) => {
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large. Maximum size is 25MB.`);
        return;
      }
      validFiles.push(file);
    });

    if (validFiles.length === 0) return;

    // Add to existing files
    setSelectedFiles(prev => [...prev, ...validFiles]);

    // Generate previews for images/videos
    validFiles.forEach((file) => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreviews(prev => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreviews(prev => [...prev, '']);
      }
    });
  };

  // Handle file selection (multiple files)
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    processFiles(Array.from(files));
    // Reset input to allow selecting the same file again
    event.target.value = '';
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isMessengerOutsideWindow) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only hide if leaving the container (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (isMessengerOutsideWindow) {
      toast.error("Cannot attach files: The 24-hour messaging window has expired.");
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  // Handle paste from clipboard
  const handlePaste = (e: React.ClipboardEvent) => {
    if (isMessengerOutsideWindow) return;
    
    const items = e.clipboardData.items;
    const files: File[] = [];
    
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    
    if (files.length > 0) {
      processFiles(files);
    }
  };

  // Remove a single file from selection
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Clear all selected files
  const clearAllFiles = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
  };

  // Determine media type from file
  const getMediaType = (file: File): 'photo' | 'video' | 'document' => {
    if (file.type.startsWith('image/')) return 'photo';
    if (file.type.startsWith('video/')) return 'video';
    return 'document';
  };

  // Upload file to Supabase Storage and get public URL
  // Upload file to Supabase Storage (converts unsupported image formats to JPEG)
  const uploadFileToStorage = async (file: File): Promise<string> => {
    // Convert unsupported image formats (AVIF, HEIC, etc.) to JPEG
    const processedFile = await processFileForUpload(file);
    
    const fileExt = processedFile.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `chat-media/${fileName}`;

    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, processedFile, {
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

  // Send a single media file
  const sendSingleMedia = async (file: File, caption?: string): Promise<boolean> => {
    const customerToReply = replyCustomer || selectedCustomer;
    if (!file || !customerToReply) return false;

    const mediaType = getMediaType(file);
    const platform = customerToReply.messenger_id ? 'messenger' : 'telegram';
    const tempId = `temp-media-${Date.now()}-${Math.random()}`;
    const employeeName = user?.email?.split('@')[0] || 'Employee';

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
      photo_url: null,
      voice_file_id: null,
      voice_duration: null,
      voice_transcription: null,
      voice_url: null,
      video_file_id: null,
      video_url: null,
      video_duration: null,
      video_mime_type: file.type,
      document_url: null,
      document_name: null,
      document_mime_type: null,
      sender_type: "employee",
      is_read: true,
      platform,
      messenger_mid: null,
      sent_by_name: employeeName,
      media_group_id: null,
      isPending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    // Scroll to bottom
    setTimeout(() => {
      const messagesContainer = document.getElementById('messages-container');
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 50);

    try {
      // Upload to storage first
      const mediaUrl = await uploadFileToStorage(file);

      let response;
      const employeeName = user?.email?.split('@')[0] || 'Employee';
      
      if (platform === 'messenger') {
        response = await supabase.functions.invoke("messenger-webhook", {
          body: {
            psid: customerToReply.messenger_id,
            media_url: mediaUrl,
            media_type: mediaType,
            caption,
            sent_by_name: employeeName,
            page_id: customerToReply.page_id,
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
            sent_by_name: employeeName,
          },
        });
      }

      if (response.error) throw response.error;

      if (response.data?.error && response.data?.code === 'MESSAGING_WINDOW_EXPIRED') {
        throw new Error(response.data.error);
      }

      // Remove optimistic message - real-time subscription will add the real one
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));

      toast.success("Media sent");
      return true;
    } catch (error: any) {
      console.error("Error sending media:", error);
      
      const isWindowExpired = error.message?.includes('24-hour messaging window') || 
                              error.message?.includes('MESSAGING_WINDOW_EXPIRED') ||
                              error.code === 'MESSAGING_WINDOW_EXPIRED';
      
      if (isWindowExpired && customerToReply) {
        setExpiredWindowCustomers(prev => new Set(prev).add(customerToReply.id));
        toast.error("Cannot send media: The 24-hour messaging window has expired.", { duration: 8000 });
      } else {
        toast.error("Failed to send media: " + error.message);
      }
      
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      return false;
    }
  };

  // Send all selected media files (uses batch for multiple photos/videos)
  const sendMedia = async () => {
    if (selectedFiles.length === 0 || isUploadingFile) return;

    const customerToReply = replyCustomer || selectedCustomer;
    if (!customerToReply) return;
    
    // Filter to only photos and videos for album (documents sent individually)
    const albumFiles = selectedFiles.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const documentFiles = selectedFiles.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/'));
    
    // If only documents or single media, use individual sends
    if (albumFiles.length <= 1) {
      setIsUploadingFile(true);
      const caption = replyText.trim() || undefined;
      try {
        for (let i = 0; i < selectedFiles.length; i++) {
          const fileCaption = i === 0 ? caption : undefined;
          await sendSingleMedia(selectedFiles[i], fileCaption);
        }
        setLastMessageSender((prev) => ({
          ...prev,
          [customerToReply.id]: "employee",
        }));
      } finally {
        clearAllFiles();
        setReplyText("");
        setIsUploadingFile(false);
      }
      return;
    }

    // Batch send for multiple photos/videos
    const platform = customerToReply.messenger_id ? 'messenger' : 'telegram';
    const employeeName = user?.email?.split('@')[0] || 'Employee';
    const mediaGroupId = `mg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const caption = replyText.trim() || undefined;
    const tempIds: string[] = [];

    // Create optimistic messages for all album items
    const optimisticMessages: Message[] = albumFiles.map((file, index) => {
      const tempId = `temp-album-${Date.now()}-${index}`;
      tempIds.push(tempId);
      const mediaType = file.type.startsWith('image/') ? 'photo' : 'video';
      
      return {
        id: tempId,
        customer_id: customerToReply.id,
        telegram_id: customerToReply.telegram_id,
        message_text: index === 0 && caption ? caption : `[${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}]`,
        message_type: mediaType,
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
        video_mime_type: mediaType === 'video' ? file.type : null,
        document_url: null,
        document_name: null,
        document_mime_type: null,
        sender_type: "employee",
        is_read: true,
        platform,
        messenger_mid: null,
        sent_by_name: employeeName,
        media_group_id: mediaGroupId,
        isPending: true,
      } as Message;
    });

    setMessages((prev) => [...prev, ...optimisticMessages]);
    setIsUploadingFile(true);

    try {
      // Upload all files to storage first
      const uploadedMedia: Array<{ type: 'photo' | 'video'; url: string }> = [];
      for (const file of albumFiles) {
        const url = await uploadFileToStorage(file);
        const type = file.type.startsWith('image/') ? 'photo' : 'video';
        uploadedMedia.push({ type, url });
      }

      let response;
      if (platform === 'messenger') {
        response = await supabase.functions.invoke("messenger-webhook", {
          body: {
            action: 'send_media_batch',
            psid: customerToReply.messenger_id,
            media_items: uploadedMedia,
            caption,
            sent_by_name: employeeName,
            page_id: customerToReply.page_id,
            media_group_id: mediaGroupId,
          },
        });
      } else {
        response = await supabase.functions.invoke("telegram-bot", {
          body: {
            action: "send_media_group",
            telegram_id: customerToReply.telegram_id,
            customer_id: customerToReply.id,
            media_items: uploadedMedia,
            caption,
            sent_by_name: employeeName,
            media_group_id: mediaGroupId,
          },
        });
      }

      if (response.error) throw response.error;
      if (response.data?.error && response.data?.code === 'MESSAGING_WINDOW_EXPIRED') {
        throw new Error(response.data.error);
      }

      // Remove optimistic messages
      setMessages((prev) => prev.filter((msg) => !tempIds.includes(msg.id)));
      setLastMessageSender((prev) => ({
        ...prev,
        [customerToReply.id]: "employee",
      }));
      toast.success(`Album sent (${albumFiles.length} items)`);
    } catch (error: any) {
      console.error("Error sending media batch:", error);
      
      const isWindowExpired = error.message?.includes('24-hour messaging window');
      if (isWindowExpired && customerToReply) {
        setExpiredWindowCustomers((prev) => new Set(prev).add(customerToReply.id));
        toast.error("Cannot send album: The 24-hour messaging window has expired.", { duration: 8000 });
      } else {
        toast.error("Failed to send album: " + error.message);
      }
      
      setMessages((prev) => prev.filter((msg) => !tempIds.includes(msg.id)));
    } finally {
      clearAllFiles();
      setReplyText("");
      setIsUploadingFile(false);
    }

    // Send documents individually (not part of album)
    for (const doc of documentFiles) {
      await sendSingleMedia(doc);
    }
  };

  // Start voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Try OGG format first (preferred for Telegram), fall back to webm
      let mimeType = 'audio/webm';
      let fileExt = 'webm';
      if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
        fileExt = 'ogg';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
        fileExt = 'ogg';
      }
      
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      // Set up audio analysis for waveform
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 32;
      source.connect(analyserNode);
      setAnalyser(analyserNode);

      // Start animation loop for audio levels
      const updateLevels = () => {
        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(dataArray);
        const levels = Array.from(dataArray.slice(0, 5)).map(v => v / 255);
        setAudioLevels(levels);
        animationFrameRef.current = requestAnimationFrame(updateLevels);
      };
      updateLevels();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        setAnalyser(null);
        setAudioLevels([0, 0, 0, 0, 0]);
        
        const audioBlob = new Blob(chunks, { type: mimeType });
        const audioFile = new File([audioBlob], `voice_${Date.now()}.${fileExt}`, { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudio({ file: audioFile, url: audioUrl });
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

  // Stop voice recording (shows preview)
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
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setAnalyser(null);
    setAudioLevels([0, 0, 0, 0, 0]);
    setRecordingDuration(0);
  };

  // Discard recorded audio
  const discardRecording = () => {
    if (recordedAudio) {
      URL.revokeObjectURL(recordedAudio.url);
    }
    setRecordedAudio(null);
    setRecordingDuration(0);
    setIsPlayingPreview(false);
    setPlaybackProgress(0);
  };

  // Send recorded audio
  const sendRecordedAudio = async () => {
    if (!recordedAudio) return;
    const duration = recordingDuration;
    await sendVoiceClip(recordedAudio.file, duration);
    URL.revokeObjectURL(recordedAudio.url);
    setRecordedAudio(null);
    setRecordingDuration(0);
    setIsPlayingPreview(false);
    setPlaybackProgress(0);
  };

  // Toggle preview playback
  const togglePreviewPlayback = () => {
    if (!audioPreviewRef.current) return;
    if (isPlayingPreview) {
      // Capture current progress when pausing
      const audio = audioPreviewRef.current;
      if (audio.duration) {
        setPlaybackProgress((audio.currentTime / audio.duration) * 100);
      }
      audio.pause();
    } else {
      audioPreviewRef.current.play();
    }
    setIsPlayingPreview(!isPlayingPreview);
  };

  // Send voice clip
  const sendVoiceClip = async (audioFile: File, duration?: number) => {
    const customerToReply = replyCustomer || selectedCustomer;
    if (!customerToReply) return;

    const platform = customerToReply.messenger_id ? 'messenger' : 'telegram';
    const tempId = `temp-voice-${Date.now()}`;
    const employeeName = user?.email?.split('@')[0] || 'Employee';

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
      voice_duration: duration || recordingDuration,
      voice_transcription: null,
      voice_url: null,
      video_file_id: null,
      video_url: null,
      video_duration: null,
      video_mime_type: null,
      document_url: null,
      document_name: null,
      document_mime_type: null,
      sender_type: "employee",
      is_read: true,
      platform,
      messenger_mid: null,
      sent_by_name: employeeName,
      media_group_id: null,
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
      const employeeName = user?.email?.split('@')[0] || 'Employee';
      
      if (platform === 'messenger') {
        // For Messenger, send as audio attachment
        response = await supabase.functions.invoke("messenger-webhook", {
          body: {
            psid: customerToReply.messenger_id,
            media_url: mediaUrl,
            media_type: 'audio',
            sent_by_name: employeeName,
            page_id: customerToReply.page_id,
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
            sent_by_name: employeeName,
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
      
      const isWindowExpired = error.message?.includes('24-hour messaging window') || 
                              error.message?.includes('MESSAGING_WINDOW_EXPIRED') ||
                              error.code === 'MESSAGING_WINDOW_EXPIRED';
      
      if (isWindowExpired && customerToReply) {
        setExpiredWindowCustomers(prev => new Set(prev).add(customerToReply.id));
        toast.error("Cannot send voice: The 24-hour messaging window has expired.", { duration: 8000 });
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
    const linkedMap: Record<string, { name: string; platform: string; telegram_id: number | null; messenger_id: string | null; page_id: string | null }> = {};
    
    // Add current customer to map
    linkedMap[customer.id] = {
      name: customer.messenger_name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Unknown",
      platform: customer.messenger_id ? "messenger" : "telegram",
      telegram_id: customer.telegram_id,
      messenger_id: customer.messenger_id,
      page_id: customer.page_id
    };
    
    try {
      // If this customer links to another (primary)
      if (customer.linked_customer_id) {
        allCustomerIds.push(customer.linked_customer_id);
        const { data: primary } = await supabase
          .from("customer")
          .select("id, first_name, last_name, messenger_name, messenger_id, telegram_id, page_id")
          .eq("id", customer.linked_customer_id)
          .maybeSingle();
        
        if (primary) {
          linkedMap[primary.id] = {
            name: primary.messenger_name || `${primary.first_name || ""} ${primary.last_name || ""}`.trim() || "Unknown",
            platform: primary.messenger_id ? "messenger" : "telegram",
            telegram_id: primary.telegram_id,
            messenger_id: primary.messenger_id,
            page_id: primary.page_id
          };
        }
      }
      
      // Find customers that link to this one
      const { data: linkedToThis } = await supabase
        .from("customer")
        .select("id, first_name, last_name, messenger_name, messenger_id, telegram_id, page_id")
        .eq("linked_customer_id", customer.id);
      
      if (linkedToThis) {
        linkedToThis.forEach(linked => {
          allCustomerIds.push(linked.id);
          linkedMap[linked.id] = {
            name: linked.messenger_name || `${linked.first_name || ""} ${linked.last_name || ""}`.trim() || "Unknown",
            platform: linked.messenger_id ? "messenger" : "telegram",
            telegram_id: linked.telegram_id,
            messenger_id: linked.messenger_id,
            page_id: linked.page_id
          };
        });
      }
    } catch (err) {
      console.error("Error fetching linked customers:", err);
    }
    
    setLinkedCustomerIds(allCustomerIds);
    setLinkedCustomersMap(linkedMap);
    
    const cacheKey = allCustomerIds.sort().join("-");
    
    // NOTE: Messages are NOT marked as read here - they are marked when the dialog opens (in openChatDialog)
    
    // Check cache (only if not forcing refresh, offset is 0, and cache has actual messages)
    if (offset === 0 && !forceRefresh && messagesCache[cacheKey] && messagesCache[cacheKey].length > 0) {
      setMessages(messagesCache[cacheKey]);
      const meta = messageMetaCache[cacheKey];
      if (meta) {
        setMessageOffset(meta.offset);
        setHasMoreMessages(meta.hasMore);
      }
      
      // useEffect will handle scroll to bottom
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
        
        // Detect language from customer messages and update if needed
        const customerMessages = messagesData
          .filter((msg: Message) => msg.sender_type === 'customer' && msg.message_text)
          .map((msg: Message) => msg.message_text as string);
        
        if (customerMessages.length > 0) {
          const detectedLang = detectLanguage(customerMessages);
          
          // Update customer record if language differs
          if (detectedLang !== customer.detected_language) {
            supabase
              .from('customer')
              .update({ detected_language: detectedLang })
              .eq('id', customer.id)
              .then(() => {
                // Invalidate the customers query to refresh the list
                queryClient.invalidateQueries({ queryKey: ['customers'] });
              });
          }
        }
        
        // Cache the messages and metadata
        setMessagesCache((prev) => ({
          ...prev,
          [cacheKey]: messagesData,
        }));
        setMessageMetaCache((prev) => ({
          ...prev,
          [cacheKey]: { offset: newOffset, hasMore },
        }));
        // useEffect will handle scroll to bottom
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
          
          // Play new customer notification sound
          playNewCustomerNotification();
          
          setHasNewCustomers(true);
          
          const customerName = newCustomer.messenger_name || newCustomer.first_name || "Unknown";
          
          // Show notification with navigate-to-chat action
          toast.success(
            `New customer: ${customerName} ${newCustomer.last_name || ""}`.trim(),
            {
              description: "Click to start chatting",
              icon: <Bell className="h-4 w-4" />,
              duration: 8000,
              action: {
                label: "Chat Now",
                onClick: () => navigate(`/chat?customer=${newCustomer.id}`),
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
  }, [navigate]);

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
            // Play notification sound for customer messages
            playMessageNotification();
            
            setUnreadCounts((prev) => ({
              ...prev,
              [newMessage.customer_id]: (prev[newMessage.customer_id] || 0) + 1,
            }));
            
            // Clear expired window flag when customer sends a new message
            setExpiredWindowCustomers(prev => {
              const newSet = new Set(prev);
              newSet.delete(newMessage.customer_id);
              return newSet;
            });
          }

          // If this message is for the currently open dialog (including linked accounts)
          const isForCurrentDialog = linkedCustomerIds.includes(newMessage.customer_id) && dialogOpen;
          if (isForCurrentDialog) {
            // Replace pending message or add new message
            setMessages((prev) => {
              // Prevent duplicates - skip if message already exists
              if (prev.some((msg) => msg.id === newMessage.id)) {
                return prev;
              }
              
              let newMessages;
              // Replace pending message for sender's UI
              if (newMessage.sender_type === "employee") {
                const pendingIndex = prev.findIndex((msg) => msg.isPending);
                if (pendingIndex !== -1) {
                  newMessages = [...prev];
                  newMessages[pendingIndex] = newMessage;
                } else {
                  newMessages = [...prev, newMessage];
                }
              } else {
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
            
            // NOTE: Do NOT auto-mark as read - only mark when user explicitly views the dialog
            // The unread count will be properly reflected in the UI
            
            // Scroll to bottom
            setTimeout(() => {
              const messagesContainer = document.getElementById('messages-container');
              if (messagesContainer) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
              }
            }, 100);
          } else {
            // Invalidate ALL caches to ensure fresh data on next open
            // This is simpler and more reliable than trying to match customer IDs in cache keys
            setMessagesCache({});
            setMessageMetaCache({});
            
            // Show toast notification for customer messages
            if (newMessage.sender_type === "customer") {
              const customer = customers.find((c) => c.id === newMessage.customer_id);
              const customerName = customer?.first_name || customer?.messenger_name || "Customer";
              
              toast.success("New message received", {
                description: `${customerName} sent a message`,
                icon: <Bell className="h-4 w-4" />,
                action: {
                  label: "Open Chat",
                  onClick: () => navigate(`/chat?customer=${newMessage.customer_id}`),
                },
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCustomer, customers, dialogOpen, linkedCustomerIds, navigate]);

  // Format date in GMT+7 (Indochina Time)
  const formatDateGMT7 = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
            {permissions.canExportCustomers && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  exportToCSV(
                    customers,
                    [
                      { key: 'first_name', header: 'First Name', getValue: (c) => c.first_name || c.messenger_name || '' },
                      { key: 'last_name', header: 'Last Name', getValue: (c) => c.last_name || '' },
                      { key: 'username', header: 'Username', getValue: (c) => c.username || '' },
                      { key: 'platform', header: 'Platform', getValue: (c) => c.messenger_id ? 'Messenger' : 'Telegram' },
                      { key: 'first_message_at', header: 'First Message', getValue: (c) => formatDateGMT7(c.first_message_at) },
                      { key: 'last_message_at', header: 'Last Message', getValue: (c) => formatDateGMT7(c.last_message_at) },
                      { key: 'detected_language', header: 'Language', getValue: (c) => getLanguageLabel(c.detected_language) },
                    ],
                    'customers'
                  );
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/media-gallery")}
            >
              <Image className="h-4 w-4 mr-2" />
              Media Gallery
            </Button>
            {hasNewCustomers && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchCustomers()}
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
                      <TableHead>First Message</TableHead>
                      <TableHead>Last Message</TableHead>
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
                            <Badge 
                              variant="outline"
                              className={customer.detected_language === 'km' ? 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700' : ''}
                            >
                              {getLanguageLabel(customer.detected_language)}
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
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDateGMT7(customer.first_message_at)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDateGMT7(customer.last_message_at)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadMessages(customer)}
                              className="relative"
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Chat
                              {(() => {
                                // Get all linked IDs from the linkedPlatformsMap
                                const linkedIds = linkedPlatformsMap[customer.id]?.linkedIds || [];
                                const allIds = [customer.id, ...linkedIds];
                                const count = allIds.reduce((sum, id) => sum + (unreadCounts[id] || 0), 0);
                                return count > 0 ? (
                                  <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-destructive text-destructive-foreground text-xs font-medium rounded-full flex items-center justify-center animate-pulse">
                                    {count > 99 ? '99+' : count}
                                  </span>
                                ) : null;
                              })()}
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
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) setIsDragging(false);
      }}>
        <DialogContent 
          className="w-[95vw] max-w-3xl h-[85vh] sm:h-[80vh] flex flex-col overflow-hidden relative"
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drop zone overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg z-50 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <Paperclip className="h-12 w-12 mx-auto text-primary mb-2" />
                <p className="text-lg font-medium text-primary">Drop files here</p>
                <p className="text-sm text-muted-foreground">Images, videos, or documents</p>
              </div>
            </div>
          )}
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-3">
              {selectedCustomer?.messenger_profile_pic ? (
                <img 
                  src={selectedCustomer.messenger_profile_pic} 
                  alt="Profile"
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <span 
                className="hover:underline cursor-pointer"
                onClick={() => {
                  setDialogOpen(false);
                  navigate(`/customers/${selectedCustomer?.id}`);
                }}
              >
                {selectedCustomer?.messenger_id 
                  ? selectedCustomer.messenger_name 
                  : `${selectedCustomer?.first_name || ''} ${selectedCustomer?.last_name || ''}`.trim() || 'Customer'}
              </span>
              {/* Platform Selector in Header (for linked accounts) or Badge */}
              {linkedCustomerIds.length > 1 ? (
                <div className="ml-auto flex items-center gap-1">
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
                      {info.platform === 'messenger' ? 'Messenger' : 'Telegram'}
                    </Button>
                  ))}
                </div>
              ) : (
                <Badge variant={selectedCustomer?.messenger_id ? 'default' : 'secondary'} className="ml-auto">
                  {selectedCustomer?.messenger_id ? (
                    <><Facebook className="h-3 w-3 mr-1" /> Messenger</>
                  ) : (
                    <>Telegram</>
                  )}
                </Badge>
              )}
            </DialogTitle>
            {/* AI Summary Button */}
            {selectedCustomer && (
              <div className="flex items-center gap-2 pt-2">
                <ChatSummaryDialog 
                  customerId={selectedCustomer.id}
                  linkedCustomerIds={linkedCustomerIds}
                  customerName={
                    selectedCustomer.messenger_id 
                      ? selectedCustomer.messenger_name || 'Customer'
                      : `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim() || 'Customer'
                  }
                />
              </div>
            )}
          </DialogHeader>

          {/* Scrollable Messages Area */}
          <div 
            id="messages-container"
            className="flex-1 overflow-y-auto min-h-0"
            onScroll={handleMessagesScroll}
          >
            {isLoadingMessages ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                <span>Loading messages...</span>
              </div>
            ) : filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mb-3 opacity-50" />
                <span>{platformFilter ? `No messages on ${platformFilter === 'messenger' ? 'Messenger' : 'Telegram'}` : 'No messages yet'}</span>
                <button
                  onClick={() => selectedCustomer && loadMessages(selectedCustomer, 0, true)}
                  className="mt-3 text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Loader2 className="h-3 w-3" />
                  Tap to refresh
                </button>
              </div>
            ) : (
              <div className="space-y-4 p-1">
                {/* Pull to refresh indicator */}
                {isLoadingMoreMessages && (
                  <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading older messages...
                  </div>
                )}
                {hasMoreMessages && !isLoadingMoreMessages && (
                  <div className="text-center py-2">
                    <button
                      onClick={() => selectedCustomer && loadMessages(selectedCustomer, messageOffset)}
                      className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto"
                    >
                      <Loader2 className="h-3 w-3" />
                      Load older messages
                    </button>
                  </div>
                )}
                {filteredMessages.map((message) => {
                  const msgPlatformInfo = linkedCustomersMap[message.customer_id];
                  
                  // Get customer info for display
                  const customerName = selectedCustomer?.messenger_id 
                    ? selectedCustomer.messenger_name 
                    : `${selectedCustomer?.first_name || ''} ${selectedCustomer?.last_name || ''}`.trim() || 'Customer';
                  const customerProfilePic = selectedCustomer?.messenger_profile_pic;
                  
                  return (
                <div
                  key={message.id}
                  className={`border rounded-lg p-3 sm:p-4 space-y-3 transition-opacity ${
                    message.sender_type === 'employee' 
                      ? 'bg-primary/5 ml-4 sm:ml-8' 
                      : 'mr-4 sm:mr-8'
                  } ${message.isPending ? 'opacity-50' : 'opacity-100'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {message.sender_type === 'employee' ? (
                        <>
                          <Badge variant="default">
                            {message.sent_by_name || 'Employee'}
                          </Badge>
                          {message.isPending && (
                            <span className="text-xs text-muted-foreground">Sending...</span>
                          )}
                        </>
                      ) : (
                        <>
                          {customerProfilePic ? (
                            <img 
                              src={customerProfilePic} 
                              alt={customerName}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                              <Users className="h-3 w-3 text-muted-foreground" />
                            </div>
                          )}
                          <span className="text-sm font-medium">{customerName}</span>
                        </>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateGMT7(message.timestamp)}
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
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                          <Mic className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">Voice Message</div>
                          {message.voice_duration && (
                            <div className="text-xs text-muted-foreground">
                              {formatDuration(message.voice_duration)}
                            </div>
                          )}
                        </div>
                      </div>
                      {message.voice_url && (
                        <audio 
                          controls 
                          className="w-full h-10"
                          preload="metadata"
                        >
                          <source src={message.voice_url} type="audio/webm" />
                          <source src={message.voice_url} type="audio/ogg" />
                          <source src={message.voice_url} type="audio/mpeg" />
                          Your browser does not support the audio element.
                        </audio>
                      )}
                      {message.voice_transcription && (
                        <div className="text-sm p-2 bg-muted/50 rounded italic border-l-2 border-primary/30">
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
                {/* Scroll anchor for auto-scroll to bottom */}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Reply Input */}
          {selectedCustomer && (
            <div className="flex-shrink-0 pt-4 border-t">
              {/* 24-hour window info for Messenger */}
              {messengerWindowInfo && (
                isMessengerOutsideWindow ? (
                  <Alert className="mb-3 border-destructive/50 bg-destructive/10">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <AlertDescription className="text-sm text-destructive">
                      <strong>Chat disabled:</strong> This customer hasn't messaged in {messengerWindowInfo.hoursSince}+ hours. 
                      Facebook's 24-hour messaging policy prevents replying here. 
                      <span className="font-medium"> Reply directly via Facebook Messenger</span> or wait for the customer to message you first.
                    </AlertDescription>
                  </Alert>
                ) : null
              )}
              
              {/* File Previews */}
              {selectedFiles.length > 0 && (
                <div className="mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{selectedFiles.length} file(s) selected</span>
                    <Button variant="ghost" size="sm" onClick={clearAllFiles} className="h-7 text-xs">
                      Clear all
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        {filePreviews[index] && file.type.startsWith('image/') ? (
                          <img src={filePreviews[index]} alt="Preview" className="w-16 h-16 object-cover rounded border" />
                        ) : (
                          <div className="w-16 h-16 bg-muted rounded border flex flex-col items-center justify-center p-1">
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                            <span className="text-[8px] text-muted-foreground truncate w-full text-center mt-1">
                              {file.name.split('.').pop()?.toUpperCase()}
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => removeFile(index)}
                          className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Hidden file inputs */}
              <input
                type="file"
                id="image-upload"
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
              />
              <input
                type="file"
                id="video-upload"
                className="hidden"
                accept="video/*"
                multiple
                onChange={handleFileSelect}
              />
              <input
                type="file"
                id="file-upload"
                className="hidden"
                multiple
                onChange={handleFileSelect}
              />
              
              <div className="flex gap-2">
                {/* Recording UI with waveform */}
                {isRecording ? (
                  <>
                    <div className="flex-1 flex items-center gap-3 px-3 py-2 bg-destructive/10 rounded-md border border-destructive/20">
                      <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                      {/* Waveform animation */}
                      <div className="flex-1 flex items-center gap-1 h-6">
                        {audioLevels.map((level, i) => (
                          <div
                            key={i}
                            className="w-1 bg-destructive rounded-full transition-all duration-75"
                            style={{ height: `${Math.max(4, level * 24)}px` }}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-destructive tabular-nums">{formatDuration(recordingDuration)}</span>
                      <button
                        className="flex-shrink-0 w-8 h-8 rounded-full bg-destructive flex items-center justify-center hover:bg-destructive/90 transition-colors"
                        onClick={stopRecording}
                        title="Stop recording"
                      >
                        <Square className="h-4 w-4 text-destructive-foreground" />
                      </button>
                    </div>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={cancelRecording}
                      title="Cancel"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : recordedAudio ? (
                  /* Audio preview UI */
                  <>
                    <audio 
                      ref={audioPreviewRef} 
                      src={recordedAudio.url} 
                      onEnded={() => {
                        setIsPlayingPreview(false);
                        setPlaybackProgress(0);
                      }}
                      className="hidden"
                    />
                    <div className="flex-1 flex items-center gap-3 px-3 py-2 bg-primary/10 rounded-md border border-primary/20">
                      <button
                        className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
                        onClick={togglePreviewPlayback}
                      >
                        {isPlayingPreview ? <Pause className="h-4 w-4 text-primary-foreground" /> : <Play className="h-4 w-4 text-primary-foreground ml-0.5" />}
                      </button>
                      <div className="flex-1 h-1.5 bg-primary/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full"
                          style={{ 
                            width: isPlayingPreview ? '100%' : `${playbackProgress}%`,
                            transition: isPlayingPreview 
                              ? `width ${(audioPreviewRef.current?.duration || recordingDuration) * (1 - playbackProgress / 100)}s linear` 
                              : 'none'
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium tabular-nums">{formatDuration(recordingDuration)}</span>
                    </div>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={discardRecording}
                      title="Discard"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="default" 
                      size="icon"
                      onClick={sendRecordedAudio}
                      disabled={isUploadingFile}
                      title="Send voice message"
                    >
                      {isUploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
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
                          disabled={isMessengerOutsideWindow || isUploadingFile}
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
                      disabled={isMessengerOutsideWindow || isUploadingFile || selectedFiles.length > 0}
                      title="Record voice message"
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                    
                    <Textarea
                      placeholder={isMessengerOutsideWindow ? "Chat disabled - 24h window expired" : selectedFiles.length > 0 ? "Add a caption (optional)..." : "Type your reply..."}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (isMessengerOutsideWindow) {
                            toast.error("Cannot send message: The 24-hour messaging window has expired. Please reply directly via Facebook Messenger or wait for the customer to message you first.", {
                              duration: 6000,
                            });
                            return;
                          }
                          if (selectedFiles.length > 0) {
                            sendMedia();
                          } else {
                            sendReply();
                          }
                        }
                        // Shift+Enter naturally creates a new line
                      }}
                      onPaste={handlePaste}
                      autoFocus
                      disabled={isMessengerOutsideWindow}
                      className="flex-1 min-h-[40px] max-h-[120px] resize-none py-2"
                      rows={1}
                    />
                    <Button 
                      onClick={selectedFiles.length > 0 ? sendMedia : sendReply} 
                      disabled={((!replyText.trim() && selectedFiles.length === 0) || isSending || isUploadingFile || isMessengerOutsideWindow)}
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
              {isMessengerOutsideWindow && (
                <p className="text-xs text-muted-foreground mt-2">
                  Messaging disabled — Reply directly via Facebook Messenger app or wait for customer to message first.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
