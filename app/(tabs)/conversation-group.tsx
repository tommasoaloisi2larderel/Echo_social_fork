import DefaultAvatar from '@/components/DefaultAvatar';
import { TypingIndicator } from '@/components/TypingIndicator';
import { styles } from '@/styles/appStyles';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
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
  is_ai_generated?: boolean;
}

interface GroupInfo {
  uuid: string;
  name: string;
  avatar?: string;
}

export default function ConversationGroup() {
  const { conversationId } = useLocalSearchParams();
  const { accessToken, user, logout, makeAuthenticatedRequest } = useAuth();
  const { transitionPosition, setTransitionPosition } = useTransition();
  const { setWebsocket, setSendMessage, setCurrentConversationId, getCachedMessages, getCachedConversationInfo, primeCache, getCachedGroups } = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
  const [expandedAgentMessages, setExpandedAgentMessages] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [localWebsocket, setLocalWebsocket] = useState<WebSocket | null>(null);
  const screenDimensions = Dimensions.get('window');
  const zoomAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // État pour le résumé
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

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
        console.log('📡 [GROUP] WebSocket message reçu:', data.type);

          // Gérer le statut "en train d'écrire"
        if (data.type === "typing_status") {
          const { username, is_typing } = data;
          
          // Ne pas afficher notre propre statut typing
          if (username === user?.username) return;
          
          setTypingUsers(prev => {
            const newSet = new Set(prev);
            if (is_typing) {
              newSet.add(username);
            } else {
              newSet.delete(username);
            }
            return newSet;
          });
          return;
        }
        if (data.type === "chat_message") {
          const incomingConvUuid = data.conversation_uuid || data.message?.conversation_uuid;
          
          console.log('💬 [GROUP] Message WebSocket:');
          console.log('   - conversationId attendu:', conversationId);
          console.log('   - conversation_uuid reçu:', incomingConvUuid);
          
          if (incomingConvUuid !== conversationId) {
            console.log('❌ [GROUP] Message ignoré (mauvais conversation_uuid)');
            return;
          }
          const msg = data.message || data;
          const newMsg: Message = { 
            id: msg.id, 
            uuid: msg.uuid, 
            sender_username: msg.sender_username, 
            content: msg.content, 
            created_at: msg.created_at,
            is_ai_generated: msg.is_ai_generated || false
          };
          setMessages((prev) => {
            const exists = prev.some((m) => m.uuid === newMsg.uuid);
            if (exists) return prev.map((m) => (m.uuid === newMsg.uuid ? { ...m, ...newMsg } : m));
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
            return [...prev, newMsg];
          });
        }
        // Gérer la confirmation de lecture (message vu)
        if (data.type === "conversation_seen") {
          const { conversation_uuid } = data;
          
          // Vérifier que c'est bien notre conversation
          if (conversation_uuid === conversationId) {
            console.log('✓✓ Messages marqués comme lus');
            
            // Mettre à jour tous les messages de l'utilisateur comme lus
            setMessages(prev => prev.map(msg => {
              if (msg.sender_username === user?.username) {
                return { ...msg, is_read: true };
              }
              return msg;
            }));
          }
          return;
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

  const toggleAgentMessage = (messageUuid: string) => {
    setExpandedAgentMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageUuid)) {
        newSet.delete(messageUuid);
      } else {
        newSet.add(messageUuid);
      }
      return newSet;
    });
  };

  const fetchMessages = async () => {
    if (!accessToken) { await logout(); return; }
    try {
      // Identifier le groupe associé à cette conversation
      const groupsResponse = await makeAuthenticatedRequest(`${API_BASE_URL}/groups/my-groups/`);
      if (groupsResponse.ok) {
        const groups = await groupsResponse.json();
        for (const group of groups) {
          try {
            const detailsResponse = await makeAuthenticatedRequest(`${API_BASE_URL}/groups/${group.uuid}/`);
            if (detailsResponse.ok) {
              const groupData = await detailsResponse.json();
              if (groupData.conversation_uuid === conversationId) {
                setGroupInfo({ uuid: groupData.uuid, name: groupData.name, avatar: groupData.avatar });
                break;
              }
            }
          } catch {}
        }
      }

      // Messages de la conversation de groupe
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/conversations/${conversationId}/messages/`
      );
      if (response.status === 401) { await logout(); return; }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const messagesList = (Array.isArray(data) ? data : (data.results || []));
      const sortedMessages = messagesList.sort((a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setMessages(sortedMessages);
      try { primeCache(String(conversationId), (groupInfo), sortedMessages as any); } catch {}
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
    if (cachedInfo && !groupInfo) setGroupInfo(cachedInfo);
    if (cachedMsgs && cachedMsgs.length >= 0) {
      setMessages(cachedMsgs as unknown as Message[]);
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (transitionPosition) {
      Animated.spring(zoomAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 10 }).start(() => setTransitionPosition(null));
    } else {
      zoomAnim.setValue(1);
    }
  }, []);

  // Définir rapidement le nom du groupe depuis le cache si possible
  useEffect(() => {
    if (!conversationId) return;
    try {
      const cachedGroups = getCachedGroups && getCachedGroups();
      if (cachedGroups && Array.isArray(cachedGroups)) {
        const found = cachedGroups.find((g: any) => g?.conversation_uuid === conversationId);
        if (found) {
          setGroupInfo({ uuid: found.uuid, name: found.name, avatar: found.avatar });
        }
      }
    } catch {}
  }, [conversationId]);

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
  // Auto-scroll vers le bas après le chargement des messages
  useEffect(() => {
    if (messages.length > 0 && scrollViewRef.current && !loading) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages.length, loading]);

  // Auto-scroll quand quelqu'un tape (indicateur typing)
  useEffect(() => {
    if (typingUsers.size > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [typingUsers.size]);
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

  const headerName = groupInfo?.name || 'Groupe';


  const fetchSummary = async () => {
    if (!conversationId || !accessToken) return;
    
    setLoadingSummary(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/messaging/conversations/${conversationId}/summarize/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 401) {
        await logout();
        setLoadingSummary(false);
        return;
      }

      if (!response.ok) {
        setLoadingSummary(false);
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setSummary(data.summary || 'Aucun résumé disponible');
      setShowSummary(true);
      setLoadingSummary(false);
    } catch (error) {
      console.error('Erreur résumé:', error);
      Alert.alert('Erreur', 'Impossible de générer le résumé');
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <Animated.View style={[styles.chatContainer, animatedStyle]}>
      <TouchableOpacity
        style={{ position: 'absolute', top: 65, left: 20, zIndex: 20, backgroundColor: 'rgba(10, 145, 104, 0.9)', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: 'rgba(10, 145, 104, 0.4)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 8 }}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>

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
                ) : msg.is_ai_generated ? (
                  // Message d'agent IA - affichage centré et pliable
                  <View style={{ alignItems: 'center', marginVertical: 8 }}>
                    <TouchableOpacity
                      onPress={() => toggleAgentMessage(msg.uuid)}
                      style={{
                        backgroundColor: 'rgba(10, 145, 104, 0.1)',
                        borderRadius: 12,
                        padding: 12,
                        marginHorizontal: 20,
                        maxWidth: '80%',
                        borderWidth: 1,
                        borderColor: 'rgba(10, 145, 104, 0.3)',
                        shadowColor: 'rgba(10, 145, 104, 0.2)',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4,
                        elevation: 3,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: expandedAgentMessages.has(msg.uuid) ? 8 : 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 12, color: 'rgba(10, 145, 104, 0.8)', fontWeight: '600' }}>
                            🤖 {msg.sender_username}
                          </Text>
                          <Text style={{ fontSize: 10, color: 'rgba(10, 145, 104, 0.6)' }}>
                            IA Assistant
                          </Text>
                        </View>
                        <Ionicons 
                          name={expandedAgentMessages.has(msg.uuid) ? "chevron-up" : "chevron-down"} 
                          size={16} 
                          color="rgba(10, 145, 104, 0.6)" 
                        />
                      </View>
                      {expandedAgentMessages.has(msg.uuid) && (
                        <View>
                          <Text style={{ 
                            fontSize: 14, 
                            color: '#333', 
                            lineHeight: 20,
                            marginBottom: 8
                          }}>
                            {msg.content}
                          </Text>
                          <Text style={{ 
                            fontSize: 10, 
                            color: 'rgba(10, 145, 104, 0.6)', 
                            textAlign: 'right' 
                          }}>
                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
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
                      <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                        {msg.content}
                      </Text>
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

          {/* Indicateur "en train d'écrire" */}
          {Array.from(typingUsers).map(username => (
            <TypingIndicator key={username} username={username} />
          ))}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bouton Résumer - au-dessus de la bottom bar */}
      <TouchableOpacity
        style={styles.summaryButton}
        onPress={fetchSummary}
        disabled={loadingSummary}
      >
        {loadingSummary ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="sparkles" size={18} color="#fff" />
        )}
        <Text style={styles.summaryButtonText}>Résumer</Text>
      </TouchableOpacity>

      {/* Bulle de résumé */}
      {showSummary && (
        <View style={styles.summaryBubble}>
          <View style={styles.summaryHeader}>
            <TouchableOpacity onPress={() => setShowSummary(false)}>
              <Ionicons name="close-circle" size={24} color="#999" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.summaryContent}>{summary}</Text>
          </ScrollView>
        </View>
      )}
    </Animated.View>
  );
}


