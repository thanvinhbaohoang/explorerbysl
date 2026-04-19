import { useState, useRef, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { detectLanguage } from "@/lib/language-detection";
import { useQueryClient } from "@tanstack/react-query";
import { processFileForUpload } from "@/lib/image-conversion";

export interface Message {
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
  document_size?: number | null;
  sender_type: string;
  is_read: boolean;
  platform: string;
  messenger_mid: string | null;
  sent_by_name: string | null;
  media_group_id: string | null;
  isPending?: boolean;
}

export interface Customer {
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
}

interface LinkedCustomerInfo {
  name: string;
  platform: string;
  telegram_id: number | null;
  messenger_id: string | null;
  page_id: string | null;
}

export const useChatMessages = (selectedCustomer: Customer | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const messagesPerPage = 50;

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(!!selectedCustomer);
  const [messageOffset, setMessageOffset] = useState(0);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  const [messagesCache, setMessagesCache] = useState<Record<string, Message[]>>({});
  const [messageMetaCache, setMessageMetaCache] = useState<Record<string, { offset: number; hasMore: boolean }>>({});
  const [linkedCustomerIds, setLinkedCustomerIds] = useState<string[]>([]);
  const [linkedCustomersMap, setLinkedCustomersMap] = useState<Record<string, LinkedCustomerInfo>>({});
  const [platformFilter, setPlatformFilter] = useState<'telegram' | 'messenger' | null>(null);
  const [expiredWindowCustomers, setExpiredWindowCustomers] = useState<Set<string>>(new Set());
  
  const [isSending, setIsSending] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<{ file: File; url: string } | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>([0, 0, 0, 0, 0]);
  const animationFrameRef = useRef<number | null>(null);

  // Reset loading state immediately when customer changes
  useEffect(() => {
    if (selectedCustomer?.id) {
      setIsLoadingMessages(true);
    }
  }, [selectedCustomer?.id]);

  // Filter messages by platform
  const filteredMessages = useMemo(() => {
    if (!platformFilter || linkedCustomerIds.length <= 1) {
      return messages;
    }
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
    const entry = Object.entries(linkedCustomersMap).find(([_, info]) => info.platform === platformFilter);
    if (!entry) return selectedCustomer;
    
    const [customerId, info] = entry;
    if (customerId === selectedCustomer?.id) return selectedCustomer;
    
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
    const isMessenger = platformFilter === 'messenger' || 
      (!platformFilter && currentCustomer?.messenger_id && !currentCustomer?.telegram_id);
    
    if (!isMessenger) return false;
    if (!currentCustomer?.messenger_id) return false;
    if (expiredWindowCustomers.has(currentCustomer.id)) return true;
    if (messages.length === 0) return false;
    
    const platformMessages = platformFilter 
      ? messages.filter(msg => {
          const info = linkedCustomersMap[msg.customer_id];
          return info?.platform === platformFilter;
        })
      : messages.filter(msg => msg.platform === 'messenger');
    
    const lastCustomerMessage = [...platformMessages]
      .reverse()
      .find(msg => msg.sender_type === 'customer');
    
    if (!lastCustomerMessage) return false;
    
    const hoursSinceLastMessage = (Date.now() - new Date(lastCustomerMessage.timestamp).getTime()) / (1000 * 60 * 60);
    return hoursSinceLastMessage > 24;
  }, [replyCustomer, selectedCustomer, messages, platformFilter, linkedCustomersMap, expiredWindowCustomers]);

  // Upload file to Supabase Storage (converts unsupported image formats to JPEG)
  const uploadFileToStorage = async (file: File): Promise<string> => {
    // Convert unsupported image formats (AVIF, HEIC, etc.) to JPEG
    const processedFile = await processFileForUpload(file);
    
    const fileExt = processedFile.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `chat-media/${fileName}`;

    const { error } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, processedFile, { cacheControl: '3600', upsert: false });

    if (error) throw new Error(`Failed to upload file: ${error.message}`);

    const { data: urlData } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  // Load messages for customer
  const loadMessages = async (customer: Customer, offset = 0, forceRefresh = false) => {
    if (offset === 0) {
      const initialPlatform = customer.messenger_id ? 'messenger' : 'telegram';
      setPlatformFilter(initialPlatform);
    }
    
    const allCustomerIds = [customer.id];
    const linkedMap: Record<string, LinkedCustomerInfo> = {};
    
    linkedMap[customer.id] = {
      name: customer.messenger_name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Unknown",
      platform: customer.messenger_id ? "messenger" : "telegram",
      telegram_id: customer.telegram_id,
      messenger_id: customer.messenger_id,
      page_id: customer.page_id
    };
    
    try {
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
    
    // NOTE: Messages are NOT marked as read here - they are marked when the user explicitly selects a conversation
    
    // Check cache
    if (offset === 0 && !forceRefresh && messagesCache[cacheKey]?.length > 0) {
      setMessages(messagesCache[cacheKey]);
      const meta = messageMetaCache[cacheKey];
      if (meta) {
        setMessageOffset(meta.offset);
        setHasMoreMessages(meta.hasMore);
      }
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
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("customer_id", allCustomerIds);

      const totalMessages = count || 0;
      const newOffset = offset + messagesPerPage;
      const hasMore = newOffset < totalMessages;
      setHasMoreMessages(hasMore);
      setMessageOffset(newOffset);

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
        
        // Detect language
        const customerMessages = messagesData
          .filter((msg: Message) => msg.sender_type === 'customer' && msg.message_text)
          .map((msg: Message) => msg.message_text as string);
        
        if (customerMessages.length > 0) {
          const detectedLang = detectLanguage(customerMessages);
          if (detectedLang !== customer.detected_language) {
            supabase
              .from('customer')
              .update({ detected_language: detectedLang })
              .eq('id', customer.id)
              .then(() => queryClient.invalidateQueries({ queryKey: ['customers'] }));
          }
        }
        
        setMessagesCache(prev => ({ ...prev, [cacheKey]: messagesData }));
        setMessageMetaCache(prev => ({ ...prev, [cacheKey]: { offset: newOffset, hasMore } }));
      } else {
        const newMessages = [...messagesData, ...messages];
        setMessages(newMessages);
        setMessagesCache(prev => ({ ...prev, [cacheKey]: newMessages }));
        setMessageMetaCache(prev => ({ ...prev, [cacheKey]: { offset: newOffset, hasMore } }));
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setIsLoadingMessages(false);
      setIsLoadingMoreMessages(false);
    }
  };

  // Send text reply
  const sendReply = async (replyText: string) => {
    const customerToReply = replyCustomer || selectedCustomer;
    if (!replyText.trim() || !customerToReply || isSending) return;

    const tempId = `temp-${Date.now()}`;
    const platform = customerToReply.messenger_id ? 'messenger' : 'telegram';
    const employeeName = user?.email?.split('@')[0] || 'Employee';
    
    const optimisticMessage: Message = {
      id: tempId,
      customer_id: customerToReply.id,
      telegram_id: customerToReply.telegram_id,
      message_text: replyText,
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

    setMessages(prev => [...prev, optimisticMessage]);
    setIsSending(true);

    try {
      let response;
      
      if (platform === 'messenger') {
        response = await supabase.functions.invoke("messenger-webhook", {
          body: {
            psid: customerToReply.messenger_id,
            text: replyText,
            sent_by_name: employeeName,
            page_id: customerToReply.page_id,
          },
        });
      } else {
        response = await supabase.functions.invoke("telegram-bot", {
          body: {
            action: "send_message",
            telegram_id: customerToReply.telegram_id,
            customer_id: customerToReply.id,
            message_text: replyText,
            sent_by_name: employeeName,
          },
        });
      }

      if (response.error) throw response.error;
      if (response.data?.error) {
        throw new Error(response.data.error);
      }
    } catch (error: any) {
      console.error("Error sending message:", error);
      
      const isWindowExpired = error.message?.includes('24-hour messaging window') || 
                              error.message?.includes('MESSAGING_WINDOW_EXPIRED');
      
      if (isWindowExpired && customerToReply) {
        setExpiredWindowCustomers(prev => new Set(prev).add(customerToReply.id));
        toast.error("Cannot send message: The 24-hour messaging window has expired.", { duration: 8000 });
      } else if (error.message?.includes('Missing page_id') || error.message?.includes('page_id')) {
        toast.error("Cannot send message: Customer is missing page link. Ask them to send a message first.", { duration: 8000 });
      } else {
        toast.error("Failed to send message");
      }
      
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  // Send media file
  const sendMedia = async (file: File, caption?: string) => {
    const customerToReply = replyCustomer || selectedCustomer;
    if (!file || !customerToReply || isUploadingFile) return;

    const getMediaType = (f: File): 'photo' | 'video' | 'document' => {
      if (f.type.startsWith('image/')) return 'photo';
      if (f.type.startsWith('video/')) return 'video';
      return 'document';
    };

    const mediaType = getMediaType(file);
    const platform = customerToReply.messenger_id ? 'messenger' : 'telegram';
    const tempId = `temp-media-${Date.now()}`;
    const employeeName = user?.email?.split('@')[0] || 'Employee';

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
      document_url: mediaType === 'document' ? null : null,
      document_name: mediaType === 'document' ? file.name : null,
      document_mime_type: mediaType === 'document' ? file.type : null,
      sender_type: "employee",
      is_read: true,
      platform,
      messenger_mid: null,
      sent_by_name: employeeName,
      media_group_id: null,
      isPending: true,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setIsUploadingFile(true);

    try {
      const mediaUrl = await uploadFileToStorage(file);

      let response;
      if (platform === 'messenger') {
        response = await supabase.functions.invoke("messenger-webhook", {
          body: {
            psid: customerToReply.messenger_id,
            media_url: mediaUrl,
            media_type: mediaType,
            caption,
            sent_by_name: employeeName,
            page_id: customerToReply.page_id,
            document_name: mediaType === 'document' ? file.name : undefined,
            document_mime_type: mediaType === 'document' ? file.type : undefined,
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
            document_name: mediaType === 'document' ? file.name : undefined,
            document_mime_type: mediaType === 'document' ? file.type : undefined,
          },
        });
      }

      if (response.error) throw response.error;
      if (response.data?.error && response.data?.code === 'MESSAGING_WINDOW_EXPIRED') {
        throw new Error(response.data.error);
      }

      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      toast.success("Media sent successfully");
    } catch (error: any) {
      console.error("Error sending media:", error);
      
      const isWindowExpired = error.message?.includes('24-hour messaging window');
      if (isWindowExpired && customerToReply) {
        setExpiredWindowCustomers(prev => new Set(prev).add(customerToReply.id));
        toast.error("Cannot send media: The 24-hour messaging window has expired.", { duration: 8000 });
      } else {
        toast.error("Failed to send media: " + error.message);
      }
      
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    } finally {
      setIsUploadingFile(false);
    }
  };

  // Send multiple media files as a batch (album)
  const sendMediaBatch = async (files: File[], caption?: string) => {
    const customerToReply = replyCustomer || selectedCustomer;
    if (!files.length || !customerToReply || isUploadingFile) return;

    // Filter to only photos and videos for album (documents sent individually)
    const albumFiles = files.filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const documentFiles = files.filter(f => !f.type.startsWith('image/') && !f.type.startsWith('video/'));
    
    // If only documents or single media, use individual sends
    if (albumFiles.length <= 1) {
      for (let i = 0; i < files.length; i++) {
        await sendMedia(files[i], i === 0 ? caption : undefined);
      }
      return;
    }

    const platform = customerToReply.messenger_id ? 'messenger' : 'telegram';
    const employeeName = user?.email?.split('@')[0] || 'Employee';
    const mediaGroupId = `mg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

    setMessages(prev => [...prev, ...optimisticMessages]);
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

      // Remove optimistic messages - real-time subscription will add the real ones
      setMessages(prev => prev.filter(msg => !tempIds.includes(msg.id)));
      toast.success(`Album sent (${albumFiles.length} items)`);
    } catch (error: any) {
      console.error("Error sending media batch:", error);
      
      const isWindowExpired = error.message?.includes('24-hour messaging window');
      if (isWindowExpired && customerToReply) {
        setExpiredWindowCustomers(prev => new Set(prev).add(customerToReply.id));
        toast.error("Cannot send album: The 24-hour messaging window has expired.", { duration: 8000 });
      } else {
        toast.error("Failed to send album: " + error.message);
      }
      
      setMessages(prev => prev.filter(msg => !tempIds.includes(msg.id)));
    } finally {
      setIsUploadingFile(false);
    }

    // Send documents individually (not part of album)
    for (const doc of documentFiles) {
      await sendMedia(doc);
    }
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = 'audio/webm';
      let fileExt = 'webm';
      if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
        fileExt = 'ogg';
      }
      
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 32;
      source.connect(analyserNode);
      setAnalyser(analyserNode);

      const updateLevels = () => {
        const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
        analyserNode.getByteFrequencyData(dataArray);
        const levels = Array.from(dataArray.slice(0, 5)).map(v => v / 255);
        setAudioLevels(levels);
        animationFrameRef.current = requestAnimationFrame(updateLevels);
      };
      updateLevels();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
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

      const interval = setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
      recordingIntervalRef.current = interval;
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone');
    }
  };

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
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setAnalyser(null);
    setAudioLevels([0, 0, 0, 0, 0]);
    setRecordingDuration(0);
  };

  const discardRecording = () => {
    if (recordedAudio) URL.revokeObjectURL(recordedAudio.url);
    setRecordedAudio(null);
    setRecordingDuration(0);
    setIsPlayingPreview(false);
    setPlaybackProgress(0);
  };

  const sendVoiceClip = async () => {
    if (!recordedAudio) return;
    
    const customerToReply = replyCustomer || selectedCustomer;
    if (!customerToReply) return;

    const platform = customerToReply.messenger_id ? 'messenger' : 'telegram';
    const tempId = `temp-voice-${Date.now()}`;
    const employeeName = user?.email?.split('@')[0] || 'Employee';
    const duration = recordingDuration;

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
      voice_duration: duration,
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

    setMessages(prev => [...prev, optimisticMessage]);
    setIsUploadingFile(true);

    try {
      const mediaUrl = await uploadFileToStorage(recordedAudio.file);

      let response;
      if (platform === 'messenger') {
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

      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      toast.success("Voice message sent");
    } catch (error: any) {
      console.error("Error sending voice clip:", error);
      
      const isWindowExpired = error.message?.includes('24-hour messaging window');
      if (isWindowExpired && customerToReply) {
        setExpiredWindowCustomers(prev => new Set(prev).add(customerToReply.id));
        toast.error("Cannot send voice: The 24-hour messaging window has expired.", { duration: 8000 });
      } else {
        toast.error("Failed to send voice message: " + error.message);
      }
      
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    } finally {
      setIsUploadingFile(false);
      URL.revokeObjectURL(recordedAudio.url);
      setRecordedAudio(null);
      setRecordingDuration(0);
      setIsPlayingPreview(false);
      setPlaybackProgress(0);
    }
  };

  const togglePreviewPlayback = () => {
    if (!audioPreviewRef.current) return;
    if (isPlayingPreview) {
      const audio = audioPreviewRef.current;
      if (audio.duration) setPlaybackProgress((audio.currentTime / audio.duration) * 100);
      audio.pause();
    } else {
      audioPreviewRef.current.play();
    }
    setIsPlayingPreview(!isPlayingPreview);
  };

  // Real-time subscription for new messages
  useEffect(() => {
    if (!selectedCustomer || linkedCustomerIds.length === 0) return;

    const channel = supabase
      .channel(`chat-messages-${selectedCustomer.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const newMessage = payload.new as Message;
          
          if (linkedCustomerIds.includes(newMessage.customer_id)) {
            setMessages(prev => {
              // Prevent duplicates - skip if message already exists
              if (prev.some(msg => msg.id === newMessage.id)) {
                return prev;
              }
              
              // Replace pending message for sender's UI
              if (newMessage.sender_type === "employee") {
                const pendingIndex = prev.findIndex(msg => msg.isPending);
                if (pendingIndex !== -1) {
                  const updated = [...prev];
                  updated[pendingIndex] = newMessage;
                  return updated;
                }
              }
              
              return [...prev, newMessage];
            });

            // Clear expired window flag if customer sends a message (they're back in 24-hour window)
            if (newMessage.sender_type === "customer") {
              // NOTE: Do NOT auto-mark as read - only mark when user explicitly opens conversation
              
              // Clear expired window flag
              setExpiredWindowCustomers(prev => {
                const newSet = new Set(prev);
                newSet.delete(newMessage.customer_id);
                return newSet;
              });
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedCustomer, linkedCustomerIds]);

  // Clear state when customer changes
  useEffect(() => {
    if (!selectedCustomer) {
      setMessages([]);
      setLinkedCustomerIds([]);
      setLinkedCustomersMap({});
      setPlatformFilter(null);
    }
  }, [selectedCustomer?.id]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Explicit function to mark messages as read - called when user opens a conversation
  const markMessagesAsRead = async () => {
    if (linkedCustomerIds.length === 0) return;
    
    await supabase
      .from("messages")
      .update({ is_read: true })
      .in("customer_id", linkedCustomerIds)
      .eq("sender_type", "customer")
      .eq("is_read", false);
  };

  return {
    messages,
    filteredMessages,
    isLoadingMessages,
    isLoadingMoreMessages,
    hasMoreMessages,
    messageOffset,
    linkedCustomerIds,
    linkedCustomersMap,
    platformFilter,
    setPlatformFilter,
    replyCustomer,
    isMessengerOutsideWindow,
    isSending,
    isUploadingFile,
    isRecording,
    recordingDuration,
    recordedAudio,
    isPlayingPreview,
    playbackProgress,
    audioLevels,
    audioPreviewRef,
    loadMessages,
    sendReply,
    sendMedia,
    sendMediaBatch,
    startRecording,
    stopRecording,
    cancelRecording,
    discardRecording,
    sendVoiceClip,
    togglePreviewPlayback,
    formatDuration,
    setMessages,
    uploadFileToStorage,
    markMessagesAsRead,
  };
};
