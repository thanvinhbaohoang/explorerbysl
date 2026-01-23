import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useChatMessages, Customer, Message } from "@/hooks/useChatMessages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatSummaryDialog } from "@/components/ChatSummaryDialog";
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
} from "lucide-react";
import { toast } from "sonner";

interface ChatPanelProps {
  customer: Customer;
}

export const ChatPanel = ({ customer }: ChatPanelProps) => {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyText, setReplyText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

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
    startRecording,
    stopRecording,
    cancelRecording,
    discardRecording,
    sendVoiceClip,
    togglePreviewPlayback,
    formatDuration,
  } = useChatMessages(customer);

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

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File is too large. Maximum size is 25MB.");
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  const handleSend = () => {
    if (isMessengerOutsideWindow) {
      toast.error("Cannot send message: The 24-hour messaging window has expired.");
      return;
    }
    if (selectedFile) {
      sendMedia(selectedFile, replyText.trim() || undefined);
      clearSelectedFile();
      setReplyText("");
    } else if (replyText.trim()) {
      sendReply(replyText);
      setReplyText("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={customer.messenger_profile_pic || undefined} />
              <AvatarFallback>
                <Users className="h-5 w-5" />
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
            
            {filteredMessages.map((message) => (
              <MessageBubble 
                key={message.id} 
                message={message} 
                customer={customer}
                formatDateGMT7={formatDateGMT7}
                formatDuration={formatDuration}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t p-4">
        {/* Hidden file inputs */}
        <input type="file" id="chat-image-upload" className="hidden" accept="image/*" onChange={handleFileSelect} />
        <input type="file" id="chat-video-upload" className="hidden" accept="video/*" onChange={handleFileSelect} />
        <input type="file" id="chat-file-upload" className="hidden" onChange={handleFileSelect} />

        {/* File preview */}
        {selectedFile && (
          <div className="mb-3 p-3 bg-muted rounded-lg flex items-center gap-3">
            {filePreview && selectedFile.type.startsWith('image/') && (
              <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={clearSelectedFile}>
              <X className="h-4 w-4" />
            </Button>
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
                disabled={isMessengerOutsideWindow || isUploadingFile || !!selectedFile}
              >
                <Mic className="h-4 w-4" />
              </Button>
              
              <Input
                placeholder={isMessengerOutsideWindow ? "24h window expired" : selectedFile ? "Add caption..." : "Type a message..."}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isMessengerOutsideWindow}
                className="flex-1"
                autoFocus
              />
              
              <Button 
                onClick={handleSend} 
                disabled={(!replyText.trim() && !selectedFile) || isSending || isUploadingFile || isMessengerOutsideWindow}
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
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <Users className="h-3 w-3" />
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

      {/* Text */}
      {message.message_text && message.message_type !== 'voice' && (
        <p className="text-sm whitespace-pre-wrap">{message.message_text}</p>
      )}
    </div>
  );
};
