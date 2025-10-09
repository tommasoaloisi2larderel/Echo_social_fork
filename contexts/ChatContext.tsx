import React, { createContext, useContext, useState } from 'react';

interface ChatContextType {
  websocket: WebSocket | null;
  setWebsocket: (ws: WebSocket | null) => void;
  sendMessage: ((message: string) => void) | null;
  setSendMessage: (fn: ((message: string) => void) | null) => void;
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [sendMessage, setSendMessage] = useState<((message: string) => void) | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  return (
    <ChatContext.Provider
      value={{
        websocket,
        setWebsocket,
        sendMessage,
        setSendMessage,
        currentConversationId,
        setCurrentConversationId,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

