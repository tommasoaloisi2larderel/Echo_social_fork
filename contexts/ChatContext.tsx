import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Image as RNImage, AppState, AppStateStatus } from 'react-native';
import { storage } from '../utils/storage';
import { cacheManager } from '../utils/CacheManager';
import { CacheKeys, CacheTTL } from '../utils/cache-config';

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
  prefetchAvatars: (urls: string[], priority?: 'high' | 'low') => Promise<void>;
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
  // 🆕 Phase 2: Enhanced prefetching & background refresh
  setVisibleConversations: (conversationIds: string[]) => void;
  backgroundRefresh: (
    request: (url: string, options?: RequestInit) => Promise<Response>
  ) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [sendMessage, setSendMessage] = useState<((message: string) => void) | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // 🆕 Track in-flight prefetch operations (for deduplication)
  const inFlightPrefetchRef = useRef<Set<string>>(new Set());

  // 🆕 Track app state for background refresh
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 🆕 Track visible conversations for smart avatar prefetching
  const visibleConversationsRef = useRef<string[]>([]);

  const API_BASE_URL = typeof window !== 'undefined' && (window as any).location?.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://reseausocial-production.up.railway.app';

  // 🆕 Keep memory cache for synchronous access (mirrors CacheManager)
  const messagesCacheRef = useRef<Map<string, CachedMessage[]>>(new Map());
  const infoCacheRef = useRef<Map<string, any>>(new Map());

  /**
   * 🆕 Get cached messages for a conversation
   * Returns from memory cache immediately (sync)
   * Also hydrates from CacheManager in background
   */
  const getCachedMessages = (conversationId: string): CachedMessage[] | undefined => {
    // Return from memory cache immediately (synchronous)
    const memoryCache = messagesCacheRef.current.get(conversationId);

    // Also try to hydrate from CacheManager in background
    if (!memoryCache) {
      cacheManager
        .get<CachedMessage[]>(CacheKeys.conversationMessages(conversationId))
        .then((data) => {
          if (data) {
            messagesCacheRef.current.set(conversationId, data);
            console.log(`✅ Hydrated ${data.length} messages from cache for ${conversationId}`);
          }
        })
        .catch(() => {});
    }

    return memoryCache;
  };

  /**
   * 🆕 Get cached conversation info
   * Returns from memory cache immediately (sync)
   */
  const getCachedConversationInfo = (conversationId: string): any | undefined => {
    // Return from memory cache immediately (synchronous)
    const memoryCache = infoCacheRef.current.get(conversationId);

    // Also try to hydrate from CacheManager in background
    if (!memoryCache) {
      cacheManager
        .get<any>(CacheKeys.conversationInfo(conversationId))
        .then((data) => {
          if (data) {
            infoCacheRef.current.set(conversationId, data);
            console.log(`✅ Hydrated conversation info from cache for ${conversationId}`);
          }
        })
        .catch(() => {});
    }

    return memoryCache;
  };

  /**
   * 🆕 Prime cache with conversation data
   * Updates both memory cache (sync) and CacheManager (async)
   */
  const primeCache = (
    conversationId: string,
    info: any | null,
    messages: CachedMessage[]
  ): void => {
    try {
      // Update memory cache immediately (synchronous)
      if (info) {
        infoCacheRef.current.set(conversationId, info);
      }
      if (messages && messages.length >= 0) {
        messagesCacheRef.current.set(conversationId, messages);
      }

      // Update CacheManager in background (asynchronous)
      (async () => {
        try {
          if (info) {
            await cacheManager.set(
              CacheKeys.conversationInfo(conversationId),
              info,
              CacheTTL.CONVERSATION_INFO
            );
          }
          if (messages && messages.length >= 0) {
            await cacheManager.set(
              CacheKeys.conversationMessages(conversationId),
              messages,
              CacheTTL.MESSAGES // Infinity
            );
            console.log(`💾 Cached ${messages.length} messages for ${conversationId}`);
          }
        } catch (error) {
          console.error(`❌ Failed to persist cache for ${conversationId}:`, error);
        }
      })();
    } catch (error) {
      console.error(`❌ Failed to prime memory cache for ${conversationId}:`, error);
    }
  };

  /**
   * 🆕 Prefetch conversation data (info + messages)
   * Uses CacheManager for persistence
   */
  const prefetchConversation = async (
    conversationId: string,
    request: (url: string, options?: RequestInit) => Promise<Response>
  ): Promise<void> => {
    if (!conversationId) return;

    // Check if already cached in memory
    if (messagesCacheRef.current.has(conversationId)) {
      console.log(`⚡ Conversation ${conversationId} already in memory cache`);
      return;
    }

    // Check if already prefetching
    if (inFlightPrefetchRef.current.has(conversationId)) {
      console.log(`🔄 Already prefetching conversation ${conversationId}`);
      return;
    }

    // Check if in CacheManager (persistent cache)
    const cachedMessages = await cacheManager.get<CachedMessage[]>(
      CacheKeys.conversationMessages(conversationId)
    );
    if (cachedMessages) {
      console.log(`✅ Found ${cachedMessages.length} cached messages for ${conversationId}`);
      messagesCacheRef.current.set(conversationId, cachedMessages);

      // Also get conversation info from cache
      const cachedInfo = await cacheManager.get<any>(
        CacheKeys.conversationInfo(conversationId)
      );
      if (cachedInfo) {
        infoCacheRef.current.set(conversationId, cachedInfo);
      }
      return;
    }

    // Not cached - fetch from API
    inFlightPrefetchRef.current.add(conversationId);
    try {
      console.log(`🌐 Prefetching conversation ${conversationId} from API...`);

      const [infoResp, msgsResp] = await Promise.all([
        request(`${API_BASE_URL}/messaging/conversations/${conversationId}/`),
        request(`${API_BASE_URL}/messaging/conversations/${conversationId}/messages/`),
      ]);

      if (!infoResp.ok || !msgsResp.ok) {
        throw new Error(`Prefetch HTTP error: ${infoResp.status} ${msgsResp.status}`);
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
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      // Cache in both memory and CacheManager
      primeCache(conversationId, infoData, messages);

      console.log(`✅ Prefetched ${messages.length} messages for ${conversationId}`);
    } catch (error) {
      console.error(`❌ Failed to prefetch conversation ${conversationId}:`, error);
    } finally {
      inFlightPrefetchRef.current.delete(conversationId);
    }
  };

  /**
   * 🆕 Smart avatar prefetching with prioritization
   * Prioritizes avatars from visible conversations
   *
   * @param urls Array of avatar URLs
   * @param priority 'high' for visible conversations, 'low' for background
   */
  const prefetchAvatars = async (
    urls: string[],
    priority: 'high' | 'low' = 'low'
  ): Promise<void> => {
    const unique = Array.from(new Set((urls || []).filter(Boolean)));
    if (unique.length === 0) return;

    console.log(`🖼️ Prefetching ${unique.length} avatars (priority: ${priority})...`);

    try {
      if (priority === 'high') {
        // High priority: prefetch immediately in parallel
        await Promise.all(unique.map((url) => RNImage.prefetch(url)));
        console.log(`✅ Prefetched ${unique.length} high-priority avatars`);
      } else {
        // Low priority: prefetch in batches with delays to avoid blocking
        const batchSize = 5;
        for (let i = 0; i < unique.length; i += batchSize) {
          const batch = unique.slice(i, i + batchSize);
          await Promise.allSettled(batch.map((url) => RNImage.prefetch(url)));

          // Small delay between batches to avoid overwhelming the system
          if (i + batchSize < unique.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
        console.log(`✅ Prefetched ${unique.length} low-priority avatars`);
      }
    } catch (error) {
      console.error(`❌ Failed to prefetch avatars:`, error);
    }
  };

  /**
   * 🆕 Set visible conversations for smart prefetching
   * Call this when a conversation list is rendered
   */
  const setVisibleConversations = (conversationIds: string[]): void => {
    visibleConversationsRef.current = conversationIds;
  };

  // 🆕 Memory cache refs for conversation lists (for synchronous access)
  const privateConversationsListRef = useRef<any[] | undefined>(undefined);
  const groupConversationsListRef = useRef<any[] | undefined>(undefined);
  const connectionsListRef = useRef<any[] | undefined>(undefined);
  const groupsListRef = useRef<any[] | undefined>(undefined);
  const invitationsListRef = useRef<any[] | undefined>(undefined);

  /**
   * 🆕 Get cached private conversations (sync)
   * Auto-hydrates from CacheManager if not in memory
   */
  const getCachedPrivateConversations = (): any[] | undefined => {
    const memoryCache = privateConversationsListRef.current;

    // Hydrate from CacheManager in background
    if (!memoryCache) {
      cacheManager
        .get<any[]>(CacheKeys.privateConversations())
        .then((data) => {
          if (data) {
            privateConversationsListRef.current = data;
            console.log(`✅ Hydrated ${data.length} private conversations from cache`);
          }
        })
        .catch(() => {});
    }

    return memoryCache;
  };

  /**
   * 🆕 Set cached private conversations
   * Updates both memory and CacheManager
   */
  const setCachedPrivateConversations = (list: any[]): void => {
    const safeList = Array.isArray(list) ? list : [];
    privateConversationsListRef.current = safeList;

    // Persist to CacheManager
    cacheManager
      .set(CacheKeys.privateConversations(), safeList, CacheTTL.CONVERSATIONS_LIST)
      .catch((error) =>
        console.error('Failed to cache private conversations:', error)
      );
  };

  /**
   * 🆕 Remove conversation from private cache
   */
  const removeFromPrivateConversationsCache = (conversationUuid: string): void => {
    if (!privateConversationsListRef.current) return;

    privateConversationsListRef.current = privateConversationsListRef.current.filter(
      (conv: any) => conv.uuid !== conversationUuid
    );

    // Update CacheManager
    cacheManager
      .set(
        CacheKeys.privateConversations(),
        privateConversationsListRef.current,
        CacheTTL.CONVERSATIONS_LIST
      )
      .catch((error) => console.error('Failed to update private conversations cache:', error));

    console.log(`🗑️ Removed private conversation ${conversationUuid} from cache`);
  };

  /**
   * 🆕 Get cached group conversations (sync)
   */
  const getCachedGroupConversations = (): any[] | undefined => {
    const memoryCache = groupConversationsListRef.current;

    if (!memoryCache) {
      cacheManager
        .get<any[]>(CacheKeys.groupConversations())
        .then((data) => {
          if (data) {
            groupConversationsListRef.current = data;
            console.log(`✅ Hydrated ${data.length} group conversations from cache`);
          }
        })
        .catch(() => {});
    }

    return memoryCache;
  };

  /**
   * 🆕 Set cached group conversations
   */
  const setCachedGroupConversations = (list: any[]): void => {
    const safeList = Array.isArray(list) ? list : [];
    groupConversationsListRef.current = safeList;

    cacheManager
      .set(CacheKeys.groupConversations(), safeList, CacheTTL.CONVERSATIONS_LIST)
      .catch((error) => console.error('Failed to cache group conversations:', error));
  };

  /**
   * 🆕 Remove conversation from group cache
   */
  const removeFromGroupConversationsCache = (conversationUuid: string): void => {
    if (!groupConversationsListRef.current) return;

    groupConversationsListRef.current = groupConversationsListRef.current.filter(
      (conv: any) => conv.uuid !== conversationUuid
    );

    cacheManager
      .set(
        CacheKeys.groupConversations(),
        groupConversationsListRef.current,
        CacheTTL.CONVERSATIONS_LIST
      )
      .catch((error) => console.error('Failed to update group conversations cache:', error));

    console.log(`🗑️ Removed group conversation ${conversationUuid} from cache`);
  };

  /**
   * 🆕 Get cached connections
   */
  const getCachedConnections = (): any[] | undefined => {
    const memoryCache = connectionsListRef.current;

    if (!memoryCache) {
      cacheManager
        .get<any[]>(CacheKeys.connections())
        .then((data) => {
          if (data) {
            connectionsListRef.current = data;
            console.log(`✅ Hydrated ${data.length} connections from cache`);
          }
        })
        .catch(() => {});
    }

    return memoryCache;
  };

  /**
   * 🆕 Set cached connections
   */
  const setCachedConnections = (list: any[]): void => {
    const safeList = Array.isArray(list) ? list : [];
    connectionsListRef.current = safeList;

    cacheManager
      .set(CacheKeys.connections(), safeList, CacheTTL.CONNECTIONS)
      .catch((error) => console.error('Failed to cache connections:', error));
  };

  /**
   * 🆕 Get cached groups
   */
  const getCachedGroups = (): any[] | undefined => {
    const memoryCache = groupsListRef.current;

    if (!memoryCache) {
      cacheManager
        .get<any[]>(CacheKeys.groups())
        .then((data) => {
          if (data) {
            groupsListRef.current = data;
            console.log(`✅ Hydrated ${data.length} groups from cache`);
          }
        })
        .catch(() => {});
    }

    return memoryCache;
  };

  /**
   * 🆕 Set cached groups
   */
  const setCachedGroups = (list: any[]): void => {
    const safeList = Array.isArray(list) ? list : [];
    groupsListRef.current = safeList;

    cacheManager
      .set(CacheKeys.groups(), safeList, CacheTTL.GROUPS)
      .catch((error) => console.error('Failed to cache groups:', error));
  };

  /**
   * 🆕 Get cached group invitations
   */
  const getCachedGroupInvitations = (): any[] | undefined => {
    const memoryCache = invitationsListRef.current;

    if (!memoryCache) {
      cacheManager
        .get<any[]>(CacheKeys.groupInvitations())
        .then((data) => {
          if (data) {
            invitationsListRef.current = data;
            console.log(`✅ Hydrated ${data.length} invitations from cache`);
          }
        })
        .catch(() => {});
    }

    return memoryCache;
  };

  /**
   * 🆕 Set cached group invitations
   */
  const setCachedGroupInvitations = (list: any[]): void => {
    const safeList = Array.isArray(list) ? list : [];
    invitationsListRef.current = safeList;

    cacheManager
      .set(CacheKeys.groupInvitations(), safeList, CacheTTL.INVITATIONS)
      .catch((error) => console.error('Failed to cache invitations:', error));
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

  /**
   * 🆕 Background refresh for stale data
   * Refreshes cached data that has become stale
   */
  const backgroundRefresh = async (
    request: (url: string, options?: RequestInit) => Promise<Response>
  ): Promise<void> => {
    try {
      console.log('🔄 Background refresh: checking stale caches...');

      // Refresh conversations overview if they exist (they may be stale)
      if (privateConversationsListRef.current || groupConversationsListRef.current) {
        console.log('🔄 Refreshing conversations overview in background...');
        await prefetchConversationsOverview(request);
      }

      console.log('✅ Background refresh completed');
    } catch (error) {
      console.error('❌ Background refresh failed:', error);
    }
  };

  /**
   * 🆕 Hydrate caches from CacheManager on mount
   */
  useEffect(() => {
    (async () => {
      try {
        console.log('📦 Hydrating caches from CacheManager...');

        const [priv, grp, co, g, inv] = await Promise.all([
          cacheManager.get<any[]>(CacheKeys.privateConversations()),
          cacheManager.get<any[]>(CacheKeys.groupConversations()),
          cacheManager.get<any[]>(CacheKeys.connections()),
          cacheManager.get<any[]>(CacheKeys.groups()),
          cacheManager.get<any[]>(CacheKeys.groupInvitations()),
        ]);

        if (priv) privateConversationsListRef.current = priv;
        if (grp) groupConversationsListRef.current = grp;
        if (co) connectionsListRef.current = co;
        if (g) groupsListRef.current = g;
        if (inv) invitationsListRef.current = inv;

        console.log('✅ Cache hydrated:', {
          private: priv?.length || 0,
          group: grp?.length || 0,
          connections: co?.length || 0,
          groups: g?.length || 0,
          invitations: inv?.length || 0,
        });
      } catch (error) {
        console.error('❌ Failed to hydrate cache:', error);
      }
    })();
  }, []);

  /**
   * 🆕 App lifecycle listeners for background refresh
   */
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - trigger background refresh
        console.log('📱 App resumed, triggering background refresh...');

        // Note: We need access to makeAuthenticatedRequest, which isn't available here
        // This will be handled by the component that uses ChatContext
        // For now, we'll just log that we detected the state change
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      if (backgroundRefreshTimerRef.current) {
        clearTimeout(backgroundRefreshTimerRef.current);
      }
    };
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
        // 🆕 Phase 2: Enhanced features
        setVisibleConversations,
        backgroundRefresh,
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