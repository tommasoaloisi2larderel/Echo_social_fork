import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Image as RNImage } from 'react-native';
import { storage } from '../utils/storage';

interface CachedMessage {
  id: number;
  uuid: string;
  sender_username: string;
  content: string;
  created_at: string;
  is_read?: boolean;
  conversation_uuid?: string;
}

interface ChatContextType {
  websocket: WebSocket | null;
  setWebsocket: (ws: WebSocket | null) => void;
  sendMessage: ((message: string) => void) | null;
  setSendMessage: (fn: ((message: string) => void) | null) => void;
  currentConversationId: string | null;
  setCurrentConversationId: (id: string | null) => void;
  // Cache lecture
  getCachedMessages: (conversationId: string) => CachedMessage[] | undefined;
  getCachedConversationInfo: (conversationId: string) => any | undefined;
  // Prime/cache & prefetch
  primeCache: (conversationId: string, info: any | null, messages: CachedMessage[]) => void;
  prefetchConversation: (
    conversationId: string,
    request: (url: string, options?: RequestInit) => Promise<Response>
  ) => Promise<void>;
  prefetchAvatars: (urls: string[]) => Promise<void>;
  prefetchAllMessages: (
    request: (url: string, options?: RequestInit) => Promise<Response>
  ) => Promise<void>;
  // Caches liste (pour retour instantané à Conversations)
  getCachedConversations: () => any[] | undefined;
  setCachedConversations: (list: any[]) => void;
  getCachedConnections: () => any[] | undefined;
  setCachedConnections: (list: any[]) => void;
  getCachedGroups: () => any[] | undefined;
  setCachedGroups: (list: any[]) => void;
  getCachedGroupInvitations: () => any[] | undefined;
  setCachedGroupInvitations: (list: any[]) => void;
  prefetchConversationsOverview: (
    request: (url: string, options?: RequestInit) => Promise<Response>
  ) => Promise<void>;
  removeFromConversationsCache: (conversationUuid: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [sendMessage, setSendMessage] = useState<((message: string) => void) | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  // Caches en mémoire pour accélérer l'ouverture des écrans
  const messagesCacheRef = useRef<Map<string, CachedMessage[]>>(new Map());
  const infoCacheRef = useRef<Map<string, any>>(new Map());
  const inFlightPrefetchRef = useRef<Set<string>>(new Set());
  const messagesIndexRef = useRef<Set<string>>(new Set());
  // Caches d'overview
  const conversationsListRef = useRef<any[] | undefined>(undefined);
  const connectionsListRef = useRef<any[] | undefined>(undefined);
  const groupsListRef = useRef<any[] | undefined>(undefined);
  const invitationsListRef = useRef<any[] | undefined>(undefined);

  const API_BASE_URL = typeof window !== 'undefined' && (window as any).location?.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://reseausocial-production.up.railway.app';

  const getCachedMessages = (conversationId: string) => {
    return messagesCacheRef.current.get(conversationId);
  };

  const getCachedConversationInfo = (conversationId: string) => {
    return infoCacheRef.current.get(conversationId);
  };

  const primeCache = (conversationId: string, info: any | null, messages: CachedMessage[]) => {
    if (info) infoCacheRef.current.set(conversationId, info);
    if (messages && messages.length >= 0) messagesCacheRef.current.set(conversationId, messages);
    try {
      messagesIndexRef.current.add(conversationId);
      storage.setItemAsync('cache_messages_index', JSON.stringify(Array.from(messagesIndexRef.current)));
      storage.setItemAsync(`cache_messages_${conversationId}`, JSON.stringify(messages));
    } catch {}
  };

  const prefetchConversation = async (
    conversationId: string,
    request: (url: string, options?: RequestInit) => Promise<Response>
  ) => {
    if (!conversationId) return;
    if (messagesCacheRef.current.has(conversationId)) return; // déjà en cache
    if (inFlightPrefetchRef.current.has(conversationId)) return; // déjà en cours
    inFlightPrefetchRef.current.add(conversationId);
    try {
      const [infoResp, msgsResp] = await Promise.all([
        request(`${API_BASE_URL}/messaging/conversations/${conversationId}/`),
        request(`${API_BASE_URL}/messaging/conversations/${conversationId}/messages/`),
      ]);

      if (!infoResp.ok || !msgsResp.ok) {
        throw new Error('Prefetch HTTP error');
      }

      const infoData = await infoResp.json();
      const msgsData = await msgsResp.json();
      let messages: CachedMessage[] = Array.isArray(msgsData) ? msgsData : (msgsData.results || []);
      messages = messages
        .filter((m: any) => !m.conversation_uuid || m.conversation_uuid === conversationId)
        .map((m: any) => ({
          id: m.id,
          uuid: m.uuid,
          sender_username: m.sender_username,
          content: m.content,
          created_at: m.created_at,
          is_read: m.is_read,
          conversation_uuid: m.conversation_uuid,
        }))
        .sort((a: CachedMessage, b: CachedMessage) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      infoCacheRef.current.set(conversationId, infoData);
      messagesCacheRef.current.set(conversationId, messages);
      try {
        messagesIndexRef.current.add(conversationId);
        storage.setItemAsync('cache_messages_index', JSON.stringify(Array.from(messagesIndexRef.current)));
        storage.setItemAsync(`cache_messages_${conversationId}`, JSON.stringify(messages));
      } catch {}
    } catch (e) {
      // silencieux pour ne pas bloquer l'UI
    } finally {
      inFlightPrefetchRef.current.delete(conversationId);
    }
  };

  const prefetchAvatars = async (urls: string[]) => {
    const unique = Array.from(new Set((urls || []).filter(Boolean)));
    if (unique.length === 0) return;
    try {
      await Promise.allSettled(unique.map((u) => RNImage.prefetch(u)));
    } catch {}
  };

  const getCachedConversations = () => conversationsListRef.current;
  const setCachedConversations = (list: any[]) => {
    conversationsListRef.current = Array.isArray(list) ? list : [];
    try { storage.setItemAsync('cache_conversations', JSON.stringify(conversationsListRef.current)); } catch {}
  };


  const removeFromConversationsCache = (conversationUuid: string) => {
    if (!conversationsListRef.current) return;
    
    // Retirer du cache en mémoire
    conversationsListRef.current = conversationsListRef.current.filter(
      (conv: any) => conv.uuid !== conversationUuid
    );
    
    // Mettre à jour le storage
    try {
      storage.setItemAsync('cache_conversations', JSON.stringify(conversationsListRef.current));
    } catch (error) {
      console.error('Erreur mise à jour cache:', error);
    }
    
    console.log(`🗑️ Conversation ${conversationUuid} retirée du cache`);
  };
  const getCachedConnections = () => connectionsListRef.current;
  const setCachedConnections = (list: any[]) => {
    connectionsListRef.current = Array.isArray(list) ? list : [];
    try { storage.setItemAsync('cache_connections', JSON.stringify(connectionsListRef.current)); } catch {}
  };
  const getCachedGroups = () => groupsListRef.current;
  const setCachedGroups = (list: any[]) => {
    groupsListRef.current = Array.isArray(list) ? list : [];
    try { storage.setItemAsync('cache_groups', JSON.stringify(groupsListRef.current)); } catch {}
  };
  const getCachedGroupInvitations = () => invitationsListRef.current;
  const setCachedGroupInvitations = (list: any[]) => {
    invitationsListRef.current = Array.isArray(list) ? list : [];
    try { storage.setItemAsync('cache_group_invitations', JSON.stringify(invitationsListRef.current)); } catch {}
  };

  const prefetchConversationsOverview = async (
    request: (url: string, options?: RequestInit) => Promise<Response>
  ) => {
    try {
      // Conversations privées + conversations de groupe + connexions + groupes (+ détails) + invitations
      const [privateConvResp, groupConvResp, connResp, groupsResp, invResp] = await Promise.all([
        request(`${API_BASE_URL}/messaging/conversations/private/`),
        request(`${API_BASE_URL}/messaging/conversations/groups/`),
        request(`${API_BASE_URL}/relations/connections/my-connections/`),
        request(`${API_BASE_URL}/groups/my-groups/`),
        request(`${API_BASE_URL}/groups/invitations/received/`),
      ]);

      // Combiner conversations privées et de groupe
      const allConversations: any[] = [];
      
      if (privateConvResp.ok) {
        const privateData = await privateConvResp.json();
        const privateList = Array.isArray(privateData) ? privateData : (privateData.results || []);
        allConversations.push(...privateList);
      }
      
      if (groupConvResp.ok) {
        const groupData = await groupConvResp.json();
        const groupList = Array.isArray(groupData) ? groupData : (groupData.results || []);
        allConversations.push(...groupList);
      }
      
      if (allConversations.length > 0) {
        setCachedConversations(allConversations);
        // Préfetch avatars visibles
        const avatarUrls: string[] = [];
        allConversations.forEach((c: any) => {
          const url = c.other_participant?.photo_profil_url || c.group_info?.avatar;
          if (url) avatarUrls.push(url);
        });
        await prefetchAvatars(avatarUrls);
      }

      if (connResp.ok) {
        const connData = await connResp.json();
        setCachedConnections(connData?.connexions || []);
      }

      if (groupsResp.ok) {
        const groups = await groupsResp.json();
        const groupsWithDetails: any[] = [];
        for (const g of groups) {
          try {
            const det = await request(`${API_BASE_URL}/groups/${g.uuid}/`);
            if (det.ok) {
              const d = await det.json();
              groupsWithDetails.push({ ...g, ...d, conversation_uuid: d.conversation_uuid });
            } else {
              groupsWithDetails.push(g);
            }
          } catch {
            groupsWithDetails.push(g);
          }
        }
        setCachedGroups(groupsWithDetails);
        try {
          const groupAvatarUrls = groupsWithDetails.map((gg: any) => gg.avatar).filter(Boolean);
          await prefetchAvatars(groupAvatarUrls);
        } catch {}
      }

      if (invResp.ok) {
        setCachedGroupInvitations(await invResp.json());
      }
    } catch {}
  };

  const prefetchAllMessages = async (
    request: (url: string, options?: RequestInit) => Promise<Response>
  ) => {
    try {
      // S'assurer que la liste des conversations existe
      if (!conversationsListRef.current || conversationsListRef.current.length === 0) {
        await prefetchConversationsOverview(request);
      }
      const convs = conversationsListRef.current || [];
      
      // Précharger les 50 derniers messages pour chaque conversation
      const concurrency = 4;
      let i = 0;
      const worker = async () => {
        while (i < convs.length) {
          const idx = i++;
          const c = convs[idx];
          const convId = c?.uuid;
          if (!convId) continue;
          // Éviter de refetch si déjà en cache
          if (messagesCacheRef.current.has(convId)) continue;
          
          // Précharger avec limite de 50 messages
          try {
            const [infoResp, msgsResp] = await Promise.all([
              request(`${API_BASE_URL}/messaging/conversations/${convId}/`),
              request(`${API_BASE_URL}/messaging/conversations/${convId}/messages/?limit=50`),
            ]);

            if (infoResp.ok && msgsResp.ok) {
              const infoData = await infoResp.json();
              const msgsData = await msgsResp.json();
              let messages: CachedMessage[] = Array.isArray(msgsData) ? msgsData : (msgsData.results || []);
              messages = messages
                .filter((m: any) => !m.conversation_uuid || m.conversation_uuid === convId)
                .map((m: any) => ({
                  id: m.id,
                  uuid: m.uuid,
                  sender_username: m.sender_username,
                  content: m.content,
                  created_at: m.created_at,
                  is_read: m.is_read,
                  conversation_uuid: m.conversation_uuid,
                }))
                .sort((a: CachedMessage, b: CachedMessage) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

              infoCacheRef.current.set(convId, infoData);
              messagesCacheRef.current.set(convId, messages);
              try {
                messagesIndexRef.current.add(convId);
                storage.setItemAsync('cache_messages_index', JSON.stringify(Array.from(messagesIndexRef.current)));
                storage.setItemAsync(`cache_messages_${convId}`, JSON.stringify(messages));
              } catch {}
            }
          } catch (e) {
            // Silencieux pour ne pas bloquer l'UI
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, convs.length) }).map(() => worker()));
    } catch {}
  };

  // Hydrate les caches depuis le stockage au démarrage du provider
  useEffect(() => {
    (async () => {
      try {
        const [c, co, g, inv] = await Promise.all([
          storage.getItemAsync('cache_conversations'),
          storage.getItemAsync('cache_connections'),
          storage.getItemAsync('cache_groups'),
          storage.getItemAsync('cache_group_invitations'),
        ]);
        if (c) conversationsListRef.current = JSON.parse(c);
        if (co) connectionsListRef.current = JSON.parse(co);
        if (g) groupsListRef.current = JSON.parse(g);
        if (inv) invitationsListRef.current = JSON.parse(inv);
      } catch {}
    })();
  }, []);

  return (
    <ChatContext.Provider
      value={{
        websocket,
        setWebsocket,
        sendMessage,
        setSendMessage,
        currentConversationId,
        setCurrentConversationId,
        getCachedMessages,
        getCachedConversationInfo,
        primeCache,
        prefetchConversation,
        prefetchAvatars,
        prefetchAllMessages,
        getCachedConversations,
        setCachedConversations,
        removeFromConversationsCache,
        getCachedConnections,
        setCachedConnections,
        getCachedGroups,
        setCachedGroups,
        getCachedGroupInvitations,
        setCachedGroupInvitations,
        prefetchConversationsOverview,
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

