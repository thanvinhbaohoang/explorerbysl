import { createContext, useContext, ReactNode } from "react";

export interface ChatMediaItem {
  id: string;
  src: string;
  type: "photo" | "video";
  mimeType?: string;
  alt?: string;
  timestamp?: string | null;
}

interface ChatMediaContextValue {
  items: ChatMediaItem[];
}

const ChatMediaContext = createContext<ChatMediaContextValue | null>(null);

export const ChatMediaProvider = ({
  items,
  children,
}: {
  items: ChatMediaItem[];
  children: ReactNode;
}) => (
  <ChatMediaContext.Provider value={{ items }}>
    {children}
  </ChatMediaContext.Provider>
);

export const useChatMedia = () => useContext(ChatMediaContext);
