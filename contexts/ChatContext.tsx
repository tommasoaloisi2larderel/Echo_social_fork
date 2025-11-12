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
  // 🆕 Caches SÉPARÉS : privé vs groupe
  getCachedPrivateConversations: () => any[] | undefined;
  setCachedPrivateConversations: (list: any[]) => void;
  getCachedGroupConversations: () => any[] | undefined;
  setCachedGroupConversations: (list: any[]) => void;
  getCachedConnections: () => any[] | undefined;
  setCachedConnections: (list: any[]) => void;
  getCachedGroups: () => any[] | undefined;
  setCachedGroups: (list: any[]) => void;
  getCachedGroupInvitations: () => any[] | undefined;
  setCachedGroupInvitations: (list: any[]) => void;
  prefetchConversationsOverview: (
    request: (url: string, options?: RequestInit) => Promise<Response>
  ) => Promise<void>;
  removeFromPrivateConversationsCache: (conversationUuid: string) => void;
  removeFromGroupConversationsCache: (conversationUuid: string) => void;
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
  
  // 🆕 Caches d'overview SÉPARÉS
  const privateConversationsListRef = useRef<any[] | undefined>(undefined);
  const groupConversationsListRef = useRef<any[] | undefined>(undefined);
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
    if (messagesCacheRef.current.has(conversationId)) return;
    if (inFlightPrefetchRef.current.has(conversationId)) return;
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
      // silencieux
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

  // 🆕 Getters/Setters pour conversations PRIVÉES
  const getCachedPrivateConversations = () => privateConversationsListRef.current;
  const setCachedPrivateConversations = (list: any[]) => {
    privateConversationsListRef.current = Array.isArray(list) ? list : [];
    try { 
      storage.setItemAsync('cache_private_conversations', JSON.stringify(privateConversationsListRef.current)); 
    } catch {}
  };

  const removeFromPrivateConversationsCache = (conversationUuid: string) => {
    if (!privateConversationsListRef.current) return;
    privateConversationsListRef.current = privateConversationsListRef.current.filter(
      (conv: any) => conv.uuid !== conversationUuid
    );
    try {
      storage.setItemAsync('cache_private_conversations', JSON.stringify(privateConversationsListRef.current));
    } catch (error) {
      console.error('Erreur mise à jour cache privé:', error);
    }
    console.log(`🗑️ Conversation privée ${conversationUuid} retirée du cache`);
  };

  // 🆕 Getters/Setters pour conversations de GROUPE
  const getCachedGroupConversations = () => groupConversationsListRef.current;
  const setCachedGroupConversations = (list: any[]) => {
    groupConversationsListRef.current = Array.isArray(list) ? list : [];
    try { 
      storage.setItemAsync('cache_group_conversations', JSON.stringify(groupConversationsListRef.current)); 
    } catch {}
  };

  const removeFromGroupConversationsCache = (conversationUuid: string) => {
    if (!groupConversationsListRef.current) return;
    groupConversationsListRef.current = groupConversationsListRef.current.filter(
      (conv: any) => conv.uuid !== conversationUuid
    );
    try {
      storage.setItemAsync('cache_group_conversations', JSON.stringify(groupConversationsListRef.current));
    } catch (error) {
      console.error('Erreur mise à jour cache groupe:', error);
    }
    console.log(`🗑️ Conversation groupe ${conversationUuid} retirée du cache`);
  };

  // Connections
  const getCachedConnections = () => connectionsListRef.current;
  const setCachedConnections = (list: any[]) => {
    connectionsListRef.current = Array.isArray(list) ? list : [];
    try { storage.setItemAsync('cache_connections', JSON.stringify(connectionsListRef.current)); } catch {}
  };

  // Groups
  const getCachedGroups = () => groupsListRef.current;
  const setCachedGroups = (list: any[]) => {
    groupsListRef.current = Array.isArray(list) ? list : [];
    try { storage.setItemAsync('cache_groups', JSON.stringify(groupsListRef.current)); } catch {}
  };

  // Invitations
  const getCachedGroupInvitations = () => invitationsListRef.current;
  const setCachedGroupInvitations = (list: any[]) => {
    invitationsListRef.current = Array.isArray(list) ? list : [];
    try { storage.setItemAsync('cache_group_invitations', JSON.stringify(invitationsListRef.current)); } catch {}
  };

  // 🆕 Fonction de prefetch modifiée pour SÉPARER privé et groupe
  const prefetchConversationsOverview = async (
    request: (url: string, options?: RequestInit) => Promise<Response>
  ) => {
    try {
      console.log('🔄 Début prefetch conversations overview...');
      
      // Appels aux endpoints SÉPARÉS
      const [privateConvResp, groupConvResp, connResp, groupsResp, invResp] = await Promise.all([
        request(`${API_BASE_URL}/messaging/conversations/private/`),
        request(`${API_BASE_URL}/messaging/conversations/groups/`),
        request(`${API_BASE_URL}/relations/connections/my-connections/`),
        request(`${API_BASE_URL}/groups/my-groups/`),
        request(`${API_BASE_URL}/groups/invitations/received/`),
      ]);

      // 🆕 Traiter les conversations PRIVÉES
      if (privateConvResp.ok) {
        const privateData = await privateConvResp.json();
        const privateList = Array.isArray(privateData) ? privateData : (privateData.results || []);
        console.log('✅ Conversations privées chargées:', privateList.length);
        setCachedPrivateConversations(privateList);
        
        // Prefetch avatars des conversations privées
        const privateAvatars = privateList
          .map((c: any) => c.other_participant?.photo_profil_url)
          .filter(Boolean);
        await prefetchAvatars(privateAvatars);
      }
      
      // 🆕 Traiter les conversations de GROUPE
      if (groupConvResp.ok) {
        const groupData = await groupConvResp.json();
        const groupList = Array.isArray(groupData) ? groupData : (groupData.results || []);
        console.log('✅ Conversations de groupe chargées:', groupList.length);
        setCachedGroupConversations(groupList);
        
        // Prefetch avatars des groupes
        const groupAvatars = groupList
          .map((c: any) => c.group_info?.avatar)
          .filter(Boolean);
        await prefetchAvatars(groupAvatars);
      }

      // Connexions
      if (connResp.ok) {
        const connData = await connResp.json();
        const connections = connData?.connexions || [];
        console.log('✅ Connexions chargées:', connections.length);
        setCachedConnections(connections);
      }

      // Groupes avec détails
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
        console.log('✅ Groupes chargés:', groupsWithDetails.length);
        setCachedGroups(groupsWithDetails);
        
        try {
          const groupAvatarUrls = groupsWithDetails.map((gg: any) => gg.avatar).filter(Boolean);
          await prefetchAvatars(groupAvatarUrls);
        } catch {}
      }

      // Invitations
      if (invResp.ok) {
        const invitations = await invResp.json();
        console.log('✅ Invitations chargées');
        setCachedGroupInvitations(invitations);
      }
      
      console.log('✅ Prefetch conversations overview terminé');
    } catch (error) {
      console.error('❌ Erreur prefetch conversations overview:', error);
    }
  };

  const prefetchAllMessages = async (
    request: (url: string, options?: RequestInit) => Promise<Response>
  ) => {
    try {
      // S'assurer que les listes existent
      if (!privateConversationsListRef.current && !groupConversationsListRef.current) {
        await prefetchConversationsOverview(request);
      }
      
      const privateConvs = privateConversationsListRef.current || [];
      const groupConvs = groupConversationsListRef.current || [];
      const allConvs = [...privateConvs, ...groupConvs];
      
      const concurrency = 4;
      let i = 0;
      const worker = async () => {
        while (i < allConvs.length) {
          const idx = i++;
          const c = allConvs[idx];
          const convId = c?.uuid;
          if (!convId) continue;
          if (messagesCacheRef.current.has(convId)) continue;
          
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
            // Silencieux
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, allConvs.length) }).map(() => worker()));
    } catch {}
  };

  // 🆕 Hydrate les caches depuis le stockage au démarrage du provider
  useEffect(() => {
    (async () => {
      try {
        const [priv, grp, co, g, inv] = await Promise.all([
          storage.getItemAsync('cache_private_conversations'),
          storage.getItemAsync('cache_group_conversations'),
          storage.getItemAsync('cache_connections'),
          storage.getItemAsync('cache_groups'),
          storage.getItemAsync('cache_group_invitations'),
        ]);
        if (priv) privateConversationsListRef.current = JSON.parse(priv);
        if (grp) groupConversationsListRef.current = JSON.parse(grp);
        if (co) connectionsListRef.current = JSON.parse(co);
        if (g) groupsListRef.current = JSON.parse(g);
        if (inv) invitationsListRef.current = JSON.parse(inv);
        
        console.log('📦 Cache chargé depuis storage:', {
          private: privateConversationsListRef.current?.length || 0,
          group: groupConversationsListRef.current?.length || 0,
          connections: connectionsListRef.current?.length || 0,
        });
      } catch (error) {
        console.error('❌ Erreur chargement cache:', error);
      }
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
        getCachedPrivateConversations,
        setCachedPrivateConversations,
        removeFromPrivateConversationsCache,
        getCachedGroupConversations,
        setCachedGroupConversations,
        removeFromGroupConversationsCache,
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