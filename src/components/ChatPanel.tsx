import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useChatMessages, Customer, Message } from "@/hooks/useChatMessages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatSummaryDialog } from "@/components/ChatSummaryDialog";
import { MediaGroupBubble } from "@/components/MediaGroupBubble";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  MessageSquare,
  Send,
  Facebook,
  Paperclip,
  Image,
  Video,
  X,
  Loader2,
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Download,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";

interface ChatPanelProps {
  customer: Customer;
  onBack?: () => void;
}

// Helper function to get initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase() || '')
    .join('');
};

export const ChatPanel = ({ customer, onBack }: ChatPanelProps) => {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyText, setReplyText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const {
    filteredMessages,
    isLoadingMessages,
    isLoadingMoreMessages,
    hasMoreMessages,
    messageOffset,
    linkedCustomerIds,
    linkedCustomersMap,
    platformFilter,
    setPlatformFilter,
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
  } = useChatMessages(customer);

  // Group messages by media_group_id
  type GroupedMessage = { type: 'single'; message: Message } | { type: 'group'; messages: Message[]; id: string };
  
  const groupedMessages = useMemo((): GroupedMessage[] => {
    const result: GroupedMessage[] = [];
    const groupMap = new Map<string, Message[]>();
    
    for (const msg of filteredMessages) {
      if (msg.media_group_id) {
        const existing = groupMap.get(msg.media_group_id);
        if (existing) {
          existing.push(msg);
        } else {
          groupMap.set(msg.media_group_id, [msg]);
        }
      } else {
        // Flush any pending group before this message
        result.push({ type: 'single', message: msg });
      }
    }
    
    // Now rebuild with proper order
    const finalResult: GroupedMessage[] = [];
    const processedGroups = new Set<string>();
    
    for (const msg of filteredMessages) {
      if (msg.media_group_id) {
        if (!processedGroups.has(msg.media_group_id)) {
          processedGroups.add(msg.media_group_id);
          const group = groupMap.get(msg.media_group_id)!;
          finalResult.push({ type: 'group', messages: group, id: msg.media_group_id });
        }
      } else {
        finalResult.push({ type: 'single', message: msg });
      }
    }
    
    return finalResult;
  }, [filteredMessages]);

  // Load messages when customer changes
  useEffect(() => {
    if (customer) {
      loadMessages(customer);
    }
  }, [customer.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (filteredMessages.length > 0 && !isLoadingMessages) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    }
  }, [filteredMessages.length, isLoadingMessages, platformFilter]);

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

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
  };

  const handleSend = async () => {
    if (isMessengerOutsideWindow) {
      toast.error("Cannot send message: The 24-hour messaging window has expired.");
      return;
    }
    if (selectedFiles.length > 0) {
      // Use batch send for multiple media files
      await sendMediaBatch(selectedFiles, replyText.trim() || undefined);
      clearAllFiles();
      setReplyText("");
    } else if (replyText.trim()) {
      sendReply(replyText);
      setReplyText("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Shift+Enter naturally creates a new line
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    if (container.scrollTop === 0 && hasMoreMessages && !isLoadingMoreMessages) {
      loadMessages(customer, messageOffset);
    }
  };

  // Format date in GMT+7
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

  const displayName = customer.messenger_name || 
    `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer';

  return (
    <div 
      className="h-full flex flex-col bg-background relative"
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
      {/* Header */}
      <div className="flex-shrink-0 border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} className="mr-1 -ml-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <Avatar className="h-10 w-10">
              <AvatarImage src={customer.messenger_profile_pic || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <button
                onClick={() => navigate(`/customers/${customer.id}`)}
                className="font-semibold hover:underline"
              >
                {displayName}
              </button>
              <div className="flex items-center gap-2 mt-0.5">
                <ChatSummaryDialog 
                  customerId={customer.id}
                  linkedCustomerIds={linkedCustomerIds}
                  customerName={displayName}
                />
              </div>
            </div>
          </div>
          
          {/* Platform switcher */}
          {linkedCustomerIds.length > 1 ? (
            <div className="flex items-center gap-1">
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
            <Badge variant={customer.messenger_id ? 'default' : 'secondary'}>
              {customer.messenger_id ? (
                <><Facebook className="h-3 w-3 mr-1" /> Messenger</>
              ) : (
                <><Send className="h-3 w-3 mr-1" /> Telegram</>
              )}
            </Badge>
          )}
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto min-h-0 p-4"
        onScroll={handleScroll}
      >
        {isLoadingMessages ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-3" />
            <span>Loading messages...</span>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-3 opacity-50" />
            <span>No messages yet</span>
          </div>
        ) : (
          <div className="space-y-4">
            {isLoadingMoreMessages && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading older messages...
              </div>
            )}
            {hasMoreMessages && !isLoadingMoreMessages && (
              <div className="text-center py-2">
                <button
                  onClick={() => loadMessages(customer, messageOffset)}
                  className="text-xs text-primary hover:underline"
                >
                  Load older messages
                </button>
              </div>
            )}
            
            {groupedMessages.map((item) => (
              item.type === 'group' ? (
                <MediaGroupBubble
                  key={item.id}
                  messages={item.messages}
                  customer={customer}
                  formatDateGMT7={formatDateGMT7}
                  formatDuration={formatDuration}
                />
              ) : (
                <MessageBubble 
                  key={item.message.id} 
                  message={item.message} 
                  customer={customer}
                  formatDateGMT7={formatDateGMT7}
                  formatDuration={formatDuration}
                />
              )
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t p-4 pb-safe">
        {/* Hidden file inputs - now with multiple */}
        <input type="file" id="chat-image-upload" className="hidden" accept="image/*" multiple onChange={handleFileSelect} />
        <input type="file" id="chat-video-upload" className="hidden" accept="video/*" multiple onChange={handleFileSelect} />
        <input type="file" id="chat-file-upload" className="hidden" multiple onChange={handleFileSelect} />

        {/* File previews */}
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

        <div className="flex items-center gap-2">
          {isRecording ? (
            /* Recording UI */
            <>
              <div className="flex-1 flex items-center gap-3 px-3 py-2 bg-destructive/10 rounded-md border border-destructive/20">
                <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                <div className="flex gap-1">
                  {audioLevels.map((level, i) => (
                    <div
                      key={i}
                      className="w-1 bg-destructive rounded-full transition-all"
                      style={{ height: `${8 + level * 16}px` }}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium tabular-nums">{formatDuration(recordingDuration)}</span>
              </div>
              <Button variant="outline" size="icon" onClick={cancelRecording}>
                <X className="h-4 w-4" />
              </Button>
              <Button variant="destructive" size="icon" onClick={stopRecording}>
                <Square className="h-4 w-4" />
              </Button>
            </>
          ) : recordedAudio ? (
            /* Audio preview UI */
            <>
              <audio 
                ref={audioPreviewRef} 
                src={recordedAudio.url} 
                onEnded={() => {}}
                className="hidden"
              />
              <div className="flex-1 flex items-center gap-3 px-3 py-2 bg-primary/10 rounded-md border border-primary/20">
                <button
                  className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center"
                  onClick={togglePreviewPlayback}
                >
                  {isPlayingPreview ? (
                    <Pause className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <Play className="h-4 w-4 text-primary-foreground ml-0.5" />
                  )}
                </button>
                <div className="flex-1 h-1.5 bg-primary/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${playbackProgress}%` }}
                  />
                </div>
                <span className="text-sm font-medium tabular-nums">{formatDuration(recordingDuration)}</span>
              </div>
              <Button variant="outline" size="icon" onClick={discardRecording}>
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button size="icon" onClick={sendVoiceClip} disabled={isUploadingFile}>
                {isUploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </>
          ) : (
            /* Normal input UI */
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" disabled={isMessengerOutsideWindow || isUploadingFile}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => document.getElementById('chat-image-upload')?.click()}>
                    <Image className="h-4 w-4 mr-2" /> Photo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => document.getElementById('chat-video-upload')?.click()}>
                    <Video className="h-4 w-4 mr-2" /> Video
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => document.getElementById('chat-file-upload')?.click()}>
                    <Paperclip className="h-4 w-4 mr-2" /> File
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={startRecording}
                  disabled={isMessengerOutsideWindow || isUploadingFile || selectedFiles.length > 0}
                >
                <Mic className="h-4 w-4" />
              </Button>
              
              <Textarea
                placeholder={isMessengerOutsideWindow ? "24h window expired" : selectedFiles.length > 0 ? "Add caption..." : "Type a message..."}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                disabled={isMessengerOutsideWindow}
                className="flex-1 min-h-[40px] max-h-[120px] resize-none py-2"
                rows={1}
                autoFocus
              />
              
              <Button 
                onClick={handleSend} 
                disabled={(!replyText.trim() && selectedFiles.length === 0) || isSending || isUploadingFile || isMessengerOutsideWindow}
                size="icon"
              >
                {isUploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </>
          )}
        </div>
        
        {isMessengerOutsideWindow && (
          <p className="text-xs text-muted-foreground mt-2">
            Messaging disabled — Reply via Facebook Messenger or wait for customer to message first.
          </p>
        )}
      </div>
    </div>
  );
};

// Message bubble component
const MessageBubble = ({ 
  message, 
  customer,
  formatDateGMT7,
  formatDuration
}: { 
  message: Message; 
  customer: Customer;
  formatDateGMT7: (date: string | null) => string;
  formatDuration: (seconds: number) => string;
}) => {
  const isEmployee = message.sender_type === 'employee';
  const customerName = customer.messenger_name || 
    `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer';

  return (
    <div className={`border rounded-lg p-4 space-y-3 ${isEmployee ? 'bg-primary/5 ml-12' : 'mr-12'} ${message.isPending ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEmployee ? (
            <>
              <Badge variant="default">{message.sent_by_name || 'Employee'}</Badge>
              {message.isPending && <span className="text-xs text-muted-foreground">Sending...</span>}
            </>
          ) : (
            <>
              {customer.messenger_profile_pic ? (
                <img src={customer.messenger_profile_pic} alt="" className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary">
                  {getInitials(customerName)}
                </div>
              )}
              <span className="text-sm font-medium">{customerName}</span>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{formatDateGMT7(message.timestamp)}</span>
      </div>

      {/* Photo */}
      {message.message_type === 'photo' && message.photo_url && (
        <div className="rounded-md overflow-hidden border">
          <img src={message.photo_url} alt="Message photo" className="w-full max-h-96 object-contain bg-muted" />
        </div>
      )}

      {/* Voice message */}
      {message.message_type === 'voice' && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">Voice Message</div>
              {message.voice_duration && (
                <div className="text-xs text-muted-foreground">{formatDuration(message.voice_duration)}</div>
              )}
            </div>
          </div>
          {message.voice_url && (
            <audio controls className="w-full h-10" preload="metadata">
              <source src={message.voice_url} type="audio/webm" />
              <source src={message.voice_url} type="audio/ogg" />
              Your browser does not support audio.
            </audio>
          )}
          {message.voice_transcription && (
            <p className="text-sm italic text-muted-foreground bg-muted/50 p-2 rounded">
              "{message.voice_transcription}"
            </p>
          )}
        </div>
      )}

      {/* Video */}
      {message.message_type === 'video' && message.video_url && (
        <div className="rounded-md overflow-hidden border">
          <video controls className="w-full max-h-96" preload="metadata">
            <source src={message.video_url} type={message.video_mime_type || 'video/mp4'} />
          </video>
        </div>
      )}

      {/* Document/File */}
      {message.message_type === 'document' && message.document_url && (
        <a
          href={message.document_url}
          target="_blank"
          rel="noopener noreferrer"
          download={message.document_name || 'file'}
          className="flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{message.document_name || 'Document'}</div>
            <div className="text-xs text-muted-foreground">{message.document_mime_type || 'File'}</div>
          </div>
          <Download className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </a>
      )}

      {/* Text */}
      {message.message_text && message.message_type !== 'voice' && (
        <p className="text-sm whitespace-pre-wrap">{message.message_text}</p>
      )}
    </div>
  );
};
