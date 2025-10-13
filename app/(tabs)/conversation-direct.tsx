import DefaultAvatar from '@/components/DefaultAvatar';
import { styles } from '@/styles/appStyles';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useTransition } from '../../contexts/TransitionContext';

interface Message {
  id: number;
  uuid: string;
  sender_username: string;
  content: string;
  created_at: string;
  is_read?: boolean;
  attachments?: Array<{ uuid: string; file_type: string; file_url: string; thumbnail_url?: string; original_filename?: string }>;
}

interface ConversationInfo {
  other_participant?: {
    username: string;
    surnom?: string;
    photo_profil_url?: string;
    user_uuid?: string;
  };
  participants_detail?: Array<{
    username: string;
    surnom?: string;
    user_uuid: string;
    user?: number;
    photo_profil_url?: string;
  }>;
  is_group?: boolean;
}

export default function ConversationDirect() {
  const { conversationId } = useLocalSearchParams();
  const { accessToken, user, logout, makeAuthenticatedRequest } = useAuth();
  const { transitionPosition, setTransitionPosition } = useTransition();
  const { setWebsocket, setSendMessage, setCurrentConversationId, getCachedMessages, getCachedConversationInfo, primeCache } = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null);
  const allowedUsernamesRef = useRef<Set<string>>(new Set());

  const [localWebsocket, setLocalWebsocket] = useState<WebSocket | null>(null);
  const screenDimensions = Dimensions.get('window');
  const zoomAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Utilise le proxy local pour éviter CORS en développement web
  const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? "http://localhost:3001"
    : "https://reseausocial-production.up.railway.app";

  const connectWebSocket = () => {
    if (!conversationId || !accessToken) return;
    try {
      const ws = new WebSocket(
        "wss://reseausocial-production.up.railway.app/ws/chat/",
        ["access_token", accessToken]
      );
      ws.onopen = () => {
        setLocalWebsocket(ws);
        setWebsocket(ws);
        setCurrentConversationId(conversationId as string);
        ws.send(JSON.stringify({ type: "mark_as_seen", conversation_uuid: conversationId }));
      };
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "chat_message") {
          // Filtrer par conversation_uuid pour éviter d'afficher des messages d'autres conversations (groupes)
          const incomingConvUuid = data.conversation_uuid || data.message?.conversation_uuid;
          if (!incomingConvUuid || incomingConvUuid !== conversationId) {
            return; // ignorer les messages d'autres conversations
          }
          const msg = data.message || data; // fallback si le backend n'imbrique pas sous message
          // Optionnel: filtrer si on connaît les deux participants
          if (allowedUsernamesRef.current.size > 0) {
            const senderOk = msg.sender_username && allowedUsernamesRef.current.has(msg.sender_username);
            const isGroupSystem = typeof msg.content === 'string' && (
              msg.content.startsWith('🎉') ||
              msg.content.startsWith('👋') ||
              msg.content.includes('a rejoint') ||
              msg.content.includes('Bienvenue')
            );
            if (!senderOk || isGroupSystem) {
              return;
            }
          }
          const newMsg: Message = {
            id: msg.id,
            uuid: msg.uuid,
            sender_username: msg.sender_username,
            content: msg.content,
            created_at: msg.created_at,
            attachments: msg.attachments || [],
          };
          setMessages((prev) => {
            const exists = prev.some((m) => m.uuid === newMsg.uuid);
            if (exists) return prev.map((m) => (m.uuid === newMsg.uuid ? { ...m, ...newMsg } : m));
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
            return [...prev, newMsg];
          });
        }
      };
      ws.onerror = (error) => console.error("WS error:", error);
      ws.onclose = () => {
        setLocalWebsocket(null);
        setWebsocket(null);
        setCurrentConversationId(null);
      };
    } catch (error) {
      console.error("WS connect error:", error);
    }
  };

  const sendMessageHandler = (messageText: string) => {
    if (!messageText.trim() || !localWebsocket) return;
    localWebsocket.send(JSON.stringify({ type: "chat_message", conversation_uuid: conversationId, message: messageText.trim() }));
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const fetchMessages = async () => {
    if (!accessToken) {
      await logout();
      return;
    }
    try {
      let convDataLocal: any = null;
      // Détails de la conversation (doit représenter une conversation privée)
      const convResponse = await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/conversations/${conversationId}/`
      );
      if (convResponse.ok) {
        const convData = await convResponse.json();
        convDataLocal = convData;
        setConversationInfo(convData);
        // Déterminer les deux participants autorisés (moi + autre) si possible
        const me = user?.username;
        const other = convData?.participants_detail?.find((p: any) => p.user_uuid !== user?.uuid);
        const otherUsername = other?.username || convData?.other_participant?.username;
        const setVals = new Set<string>();
        if (me) setVals.add(me);
        if (otherUsername) setVals.add(otherUsername);
        allowedUsernamesRef.current = setVals;

        // Si on n'a pas pu déterminer l'autre participant ici, tenter via la liste des conversations
        if (allowedUsernamesRef.current.size < 2) {
          try {
            const listResp = await makeAuthenticatedRequest(`${API_BASE_URL}/messaging/conversations/`);
            if (listResp.ok) {
              const listData = await listResp.json();
              const convFromList = (Array.isArray(listData) ? listData : (listData.results || [])).find((c: any) => c.uuid === conversationId);
              const otherFromList = convFromList?.other_participant?.username;
              if (otherFromList) {
                const s = new Set<string>(allowedUsernamesRef.current);
                s.add(otherFromList);
                allowedUsernamesRef.current = s;
              }
            }
          } catch {}
        }
      }

      // Messages
      const response = await fetch(
        `${API_BASE_URL}/messaging/conversations/${conversationId}/messages/`,
        { headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' } }
      );
      if (response.status === 401) { await logout(); return; }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      let messagesList = Array.isArray(data) ? data : (data.results || []);
      // Le endpoint REST ne renvoie pas toujours conversation_uuid → garder si absent
      messagesList = messagesList.filter((m: any) => !m.conversation_uuid || m.conversation_uuid === conversationId);
      // Optionnel: filtrer par participants seulement si on les connaît
      if (allowedUsernamesRef.current.size > 0) {
        messagesList = messagesList.filter((m: any) => allowedUsernamesRef.current.has(m.sender_username));
      }
      const sortedMessages = messagesList.sort((a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setMessages(sortedMessages);
      // Prime le cache pour ouverture instantanée ultérieure
      try { primeCache(String(conversationId), (conversationInfo || convDataLocal), sortedMessages as any); } catch {}
    } catch (error) {
      console.error('Erreur messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Charger instantanément depuis le cache si disponible
  useEffect(() => {
    if (!conversationId) return;
    const cachedInfo = getCachedConversationInfo(String(conversationId));
    const cachedMsgs = getCachedMessages(String(conversationId));
    if (cachedInfo) setConversationInfo(cachedInfo);
    if (cachedMsgs && cachedMsgs.length >= 0) {
      const onlyThisConv = (cachedMsgs as any[]).filter((m) => !m.conversation_uuid || m.conversation_uuid === conversationId);
      setMessages(onlyThisConv as unknown as Message[]);
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (transitionPosition) {
      Animated.spring(zoomAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 10 }).start(() => {
        setTransitionPosition(null);
      });
    } else {
      zoomAnim.setValue(1);
    }
  }, []);

  useEffect(() => {
    setSendMessage(() => sendMessageHandler);
    return () => setSendMessage(null);
  }, [localWebsocket, conversationId]);

  useEffect(() => {
    if (conversationId && accessToken) {
      fetchMessages();
      connectWebSocket();
    }
    return () => { if (localWebsocket) localWebsocket.close(); };
  }, [conversationId, accessToken]);

  if (loading) {
    return (
      <View style={styles.chatContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="rgba(55, 116, 69, 1)" />
          <Text style={{ marginTop: 10, color: '#666' }}>Chargement des messages...</Text>
        </View>
      </View>
    );
  }

  const animatedStyle = transitionPosition ? {
    transform: [
      { translateX: zoomAnim.interpolate({ inputRange: [0, 1], outputRange: [transitionPosition.x + transitionPosition.width / 2 - screenDimensions.width / 2, 0] }) },
      { translateY: zoomAnim.interpolate({ inputRange: [0, 1], outputRange: [transitionPosition.y + transitionPosition.height / 2 - screenDimensions.height / 2, 0] }) },
      { scale: zoomAnim.interpolate({ inputRange: [0, 1], outputRange: [transitionPosition.width / screenDimensions.width, 1] }) },
    ],
    opacity: zoomAnim,
  } : {};

  // Trouver l'autre participant
  // D’après la doc, le détail peut exposer participants[] ou other_participant
  const otherParticipant = conversationInfo?.participants_detail?.find(p => p.user_uuid !== user?.uuid) || conversationInfo?.other_participant;
  const headerName = otherParticipant ? (otherParticipant.surnom || otherParticipant.username) : 'Conversation';

  return (
    <Animated.View style={[styles.chatContainer, animatedStyle]}>
      {/* Bouton retour */}
      <TouchableOpacity
        style={{ position: 'absolute', top: 65, left: 20, zIndex: 20, backgroundColor: 'rgba(10, 145, 104, 0.9)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: 'rgba(10, 145, 104, 0.4)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 }}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Header avec avatar et nom */}
      <TouchableOpacity 
        onPress={() => router.push({ pathname: '/(tabs)/conversation-management', params: { conversationId } })}
        activeOpacity={0.8}
        style={{ position: 'absolute', top: 65, left: 75, right: 20, height: 40, backgroundColor: 'rgba(10, 145, 104, 0.9)', borderRadius: 20, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 10, zIndex: 10, shadowColor: 'rgba(10, 145, 104, 0.4)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 }}
      >
        <DefaultAvatar name={headerName} size={26} />
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff', flex: 1 }}>{headerName}</Text>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' }} />
      </TouchableOpacity>
      
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView ref={scrollViewRef} contentContainerStyle={styles.messagesContainer} showsVerticalScrollIndicator={false}>
          {messages.map((msg, index) => {
            const isMe = msg.sender_username === user?.username;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
            const isSystemMessage = msg.content.startsWith('🎉') || msg.content.startsWith('👋') || msg.content.includes('a rejoint') || msg.content.includes('Bienvenue');
            const currentDate = new Date(msg.created_at).toLocaleDateString('fr-FR');
            const prevDate = prevMsg ? new Date(prevMsg.created_at).toLocaleDateString('fr-FR') : null;
            const showDateSeparator = currentDate !== prevDate;
            let prevNonSystemMsg = prevMsg;
            let prevNonSystemIndex = index - 1;
            while (prevNonSystemMsg && (prevNonSystemMsg.content.startsWith('🎉') || prevNonSystemMsg.content.startsWith('👋') || prevNonSystemMsg.content.includes('a rejoint') || prevNonSystemMsg.content.includes('Bienvenue'))) {
              prevNonSystemIndex--; prevNonSystemMsg = prevNonSystemIndex >= 0 ? messages[prevNonSystemIndex] : null;
            }
            let nextNonSystemMsg = nextMsg;
            let nextNonSystemIndex = index + 1;
            while (nextNonSystemMsg && (nextNonSystemMsg.content.startsWith('🎉') || nextNonSystemMsg.content.startsWith('👋') || nextNonSystemMsg.content.includes('a rejoint') || nextNonSystemMsg.content.includes('Bienvenue'))) {
              nextNonSystemIndex++; nextNonSystemMsg = nextNonSystemIndex < messages.length ? messages[nextNonSystemIndex] : null;
            }
            const isSameSenderAsPrev = prevNonSystemMsg && prevNonSystemMsg.sender_username === msg.sender_username;
            const isSameSenderAsNext = nextNonSystemMsg && nextNonSystemMsg.sender_username === msg.sender_username;
            const isFirstInGroup = !isSameSenderAsPrev;
            const isLastInGroup = !isSameSenderAsNext;
            return (
              <React.Fragment key={msg.uuid}>
                {showDateSeparator && (
                  <View style={styles.dateSeparator}>
                    <View style={styles.dateLine} />
                    <Text style={styles.dateText}>{currentDate}</Text>
                    <View style={styles.dateLine} />
                  </View>
                )}
                {isSystemMessage ? (
                  <View style={styles.systemMessageContainer}>
                    <Text style={styles.systemMessageText}>{msg.content}</Text>
                  </View>
                ) : (
                  <View style={styles.messageWrapper}>
                    {!isMe && isFirstInGroup && (
                      <Text style={styles.senderName}>{msg.sender_username}</Text>
                    )}
                    <View style={[
                      styles.messageBubble,
                      isMe ? styles.myMessage : styles.theirMessage,
                      !isFirstInGroup && styles.messageGrouped,
                      !isFirstInGroup && !isLastInGroup && (isMe ? styles.myMessageMiddle : styles.theirMessageMiddle),
                      isFirstInGroup && isSameSenderAsNext && (isMe ? styles.myMessageFirst : styles.theirMessageFirst),
                      isLastInGroup && isSameSenderAsPrev && (isMe ? styles.myMessageLast : styles.theirMessageLast),
                    ]}>
                      {msg.attachments && msg.attachments.length > 0 ? (
                        <View style={{ gap: 6 }}>
                          {msg.attachments.map((att) => (
                            <View key={att.uuid} style={{ borderRadius: 8, overflow: 'hidden' }}>
                              {att.file_type === 'image' ? (
                                // Image preview
                                <View>
                                  {/* On peut remplacer par expo-image si besoin */}
                                  <img src={att.thumbnail_url || att.file_url} style={{ width: 220, height: 160, objectFit: 'cover' }} />
                                </View>
                              ) : (
                                // Fichier générique
                                <Text style={{ color: isMe ? '#fff' : '#111' }}>{att.original_filename || 'Fichier'}</Text>
                              )}
                            </View>
                          ))}
                          {!!msg.content && (
                            <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                              {msg.content}
                            </Text>
                          )}
                        </View>
                      ) : (
                        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                          {msg.content}
                        </Text>
                      )}
                      {isLastInGroup && (
                        <View style={styles.messageMeta}>
                          <Text style={styles.timestampText}>
                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                          {isMe && (
                            <Text style={styles.readStatus}>
                              {msg.is_read ? "Lu" : "Envoyé"}
                            </Text>
                          )}
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </React.Fragment>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}


