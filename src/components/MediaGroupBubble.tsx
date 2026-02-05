import { Message, Customer } from "@/hooks/useChatMessages";
import { Badge } from "@/components/ui/badge";
import { MediaThumbnail } from "@/components/MediaViewer";
import { Users } from "lucide-react";

interface MediaGroupBubbleProps {
  messages: Message[];
  customer: Customer;
  formatDateGMT7: (date: string | null) => string;
  formatDuration: (seconds: number) => string;
}

export const MediaGroupBubble = ({ 
  messages, 
  customer,
  formatDateGMT7,
  formatDuration 
}: MediaGroupBubbleProps) => {
  if (messages.length === 0) return null;
  
  const firstMessage = messages[0];
  const isEmployee = firstMessage.sender_type === 'employee';
  const customerName = customer.messenger_name || 
    `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer';
  
  // Extract caption from first message
  const caption = firstMessage.message_text && 
    !firstMessage.message_text.startsWith('[') ? firstMessage.message_text : null;
  
  // Determine grid layout based on count
  const getGridClass = (count: number) => {
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-2';
    if (count === 4) return 'grid-cols-2';
    if (count >= 5) return 'grid-cols-3';
    return 'grid-cols-1';
  };

  return (
    <div className={`border rounded-lg p-4 space-y-3 ${isEmployee ? 'bg-primary/5 ml-12' : 'mr-12'} ${firstMessage.isPending ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isEmployee ? (
            <>
              <Badge variant="default">{firstMessage.sent_by_name || 'Employee'}</Badge>
              {firstMessage.isPending && <span className="text-xs text-muted-foreground">Sending...</span>}
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
        <span className="text-xs text-muted-foreground">{formatDateGMT7(firstMessage.timestamp)}</span>
      </div>

      {/* Media Grid */}
      <div className={`grid ${getGridClass(messages.length)} gap-1 rounded-md overflow-hidden border`}>
        {messages.map((message, index) => (
          <div 
            key={message.id} 
            className={`relative ${messages.length === 3 && index === 0 ? 'row-span-2' : ''}`}
          >
            {message.message_type === 'photo' && message.photo_url && (
              <MediaThumbnail
                src={message.photo_url}
                alt="Photo"
                type="photo"
                className="w-full h-full aspect-square"
              />
            )}
            {message.message_type === 'video' && message.video_url && (
              <MediaThumbnail
                src={message.video_url}
                alt="Video"
                type="video"
                mimeType={message.video_mime_type || 'video/mp4'}
                className="w-full h-full aspect-square"
              />
            )}
          </div>
        ))}
      </div>

      {/* Caption */}
      {caption && (
        <p className="text-sm whitespace-pre-wrap">{caption}</p>
      )}
    </div>
  );
};
