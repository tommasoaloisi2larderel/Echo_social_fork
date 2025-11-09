export interface BottomBarProps {
  currentRoute: string;
  chatText: string;
  setChatText: (text: string) => void;
  chatRecipient?: string;
  onSendMessage?: () => void;
  conversationId?: string;
  onSummaryPress?: () => void;
  loadingSummary?: boolean; 
}

export interface StagedAttachment {
  uri: string;
  name: string;
  type: string;
  kind: 'image' | 'file';
}

export interface JarvisMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}