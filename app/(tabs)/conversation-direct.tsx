import DefaultAvatar from '@/components/DefaultAvatar';
import AttachmentImage from '@/components/FIlesLecture/AttachementImage';
import AttachmentVideo from '@/components/FIlesLecture/AttachementVideo';
import AudioPlayer from '@/components/FIlesLecture/Audioplayer';
import { TypingIndicator } from '@/components/TypingIndicator';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/services/apiClient';
import { styles } from '@/styles/appStyles';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  View
} from 'react-native';
import { useChat } from '../../contexts/ChatContext';
import { useTransition } from '../../contexts/TransitionContext';
// 🆕 Import Message type correctly
import { useWebSocketWithAuth } from '@/hooks/useWebSocketWithAuth';
import { Message, useMessages } from '../../hooks/useMessages';

interface ConversationInfo {
  other_participant?: {
    username: string;
    surnom?: string;
    photo_profil_url?: string;
    user_uuid?: string;
  };
  participants_detail?: {
    username: string;
    surnom?: string;
    user_uuid: string;
    user?: number;
    photo_profil_url?: string;
  }[];
  is_group?: boolean;
}

export default function ConversationDirect() {
  const { conversationId } = useLocalSearchParams();
  const queryClient = useQueryClient();
  const { messages: dataMessages, isLoading, refresh } = useMessages(conversationId as string);
  const messages = dataMessages || [];
  const { user } = useAuth();
  const { transitionPosition, setTransitionPosition } = useTransition();
  const { setWebsocket, setSendMessage, setCurrentConversationId, getCachedMessages, getCachedConversationInfo, primeCache, addMessageToCache } = useChat();
  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null);
  const allowedUsernamesRef = useRef<Set<string>>(new Set());
  const [expandedAgentMessages, setExpandedAgentMessages] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // updateMessagesCache: helper to update the messages cache for this conversation
  const updateMessagesCache = useCallback(
    (updater: (prev: Message[]) => Message[]) => {
      if (!conversationId) return;
      queryClient.setQueryData(['messages', conversationId], (oldData?: Message[]) => {
        return updater(oldData || []);
      });
    },
    [queryClient, conversationId]
  );

  const screenDimensions = Dimensions.get('window');
  const zoomAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const [unreadMessageUuids, setUnreadMessageUuids] = useState<Set<string>>(new Set());

  // État pour le résumé
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  // 🆕 Use the new WebSocket hook with automatic token management
  const {
    isConnected: wsIsConnected,
    lastMessage,
    sendMessage: wsSend,
    connect: wsConnect,
  } = useWebSocketWithAuth('/ws/chat/');

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback(
    (event: any) => {
      const rawData = (event && event.data) || event;
      let data: any;
      try {
        data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      } catch (e) {
        console.error('❌ Erreur de parsing WebSocket:', e);
        return;
      }

      console.log('📡 WebSocket message reçu:', data.type);
      console.log('📦 Données complètes:', JSON.stringify(data, null, 2));

      if (data.type === 'chat_message') {
        const incomingConvUuid = data.conversation_uuid || data.message?.conversation_uuid;

        if (incomingConvUuid !== conversationId) {
          return;
        }

        const msg = data.message || data;
        console.log('🎤 Message vocal reçu via WebSocket:');
        console.log('   - content:', msg.content);
        console.log('   - attachments:', JSON.stringify(msg.attachments, null, 2));
        console.log('   - file_type:', msg.attachments?.[0]?.file_type);
        console.log('   - file_url:', msg.attachments?.[0]?.file_url);

        // Filtrage par participants
        if (allowedUsernamesRef.current.size > 0) {
          const senderOk = msg.sender_username && allowedUsernamesRef.current.has(msg.sender_username);
          const isGroupSystem =
            typeof msg.content === 'string' &&
            (msg.content.startsWith('🎉') ||
              msg.content.startsWith('👋') ||
              msg.content.includes('a rejoint') ||
              msg.content.includes('Bienvenue'));
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
          is_read: false, // Default for incoming
          conversation_uuid: conversationId as string,
          is_ai_generated: msg.is_ai_generated || false,
          attachments: msg.attachments || [],
        };

        // 🔴 SI le message vient de l'autre personne, le marquer comme non lu temporairement
        if (msg.sender_username !== user?.username) {
          setUnreadMessageUuids((prev) => new Set([...prev, newMsg.uuid]));
          console.log(`📩 Nouveau message non lu reçu: ${newMsg.uuid}`);
        }

        updateMessagesCache((prev) => {
          // Remove any pending messages with the same content and sender
          // Also remove AI loading indicators when any new message arrives
          const withoutPendingAndLoading = prev.filter(
            (m) =>
              !(
                m.isPending &&
                m.sender_username === newMsg.sender_username &&
                m.content === newMsg.content
              ) && !m.isAiLoading
          );

          // Check if message already exists (by real UUID)
          const exists = withoutPendingAndLoading.some((m) => m.uuid === newMsg.uuid);
          if (exists) {
            return withoutPendingAndLoading.map((m) => (m.uuid === newMsg.uuid ? newMsg : m));
          }

          // Add new message and sort
          return [...withoutPendingAndLoading, newMsg].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
        });

        // 🔴 MARQUER COMME VU après réception
        if (msg.sender_username !== user?.username && wsIsConnected) {
          wsSend(
            JSON.stringify({
              type: 'mark_as_seen',
              conversation_uuid: conversationId,
            })
          );

          // Retirer la couleur après 2 secondes
          setTimeout(() => {
            setUnreadMessageUuids((prev) => {
              const updated = new Set(prev);
              updated.delete(newMsg.uuid);
              return updated;
            });
          }, 2000);
        }

        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
        return;
      }

      if (data.type === 'typing_status') {
        const { username, is_typing } = data;

        // Ne pas afficher notre propre statut typing
        if (username === user?.username) return;

        setTypingUsers((prev) => {
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

      // Gérer la confirmation de lecture (message vu)
      if (data.type === 'conversation_seen') {
        const { conversation_uuid } = data;
        console.log('👁️ Event conversation_seen reçu !');
        console.log('   - conversation_uuid:', data.conversation_uuid);
        console.log('   - username:', data.username);
        console.log('   - marked_count:', data.marked_count);

        // Vérifier que c'est bien notre conversation
        if (conversation_uuid === conversationId) {
          console.log('✓✓ Messages marqués comme lus');

          // Mettre à jour tous les messages de l'utilisateur comme lus
          updateMessagesCache((prev) =>
            prev.map((msg) => {
              if (msg.sender_username === user?.username) {
                return { ...msg, is_read: true };
              }
              return msg;
            })
          );
        }
      }
    },
    [conversationId, user?.username, wsIsConnected, wsSend, updateMessagesCache]
  );

  // React to new WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;
    handleWebSocketMessage(lastMessage);
  }, [lastMessage, handleWebSocketMessage]);

  // Track connection state and mark conversation as seen on connect
  useEffect(() => {
    if (wsIsConnected && conversationId) {
      console.log('✅ WebSocket connected');
      setCurrentConversationId(conversationId as string);

      wsSend(
        JSON.stringify({
          type: 'mark_as_seen',
          conversation_uuid: conversationId,
        })
      );
    }

    if (!wsIsConnected) {
      // Consider this as closed
      console.log('🔌 WebSocket disconnected');
      setWebsocket(null);
      setCurrentConversationId(null);
    }
  }, [wsIsConnected, conversationId, wsSend, setCurrentConversationId, setWebsocket]);

  const sendMessageHandler = (messageText: string) => {
    if (!messageText.trim() || !wsIsConnected) return;

    // Create optimistic message immediately
    const optimisticMessage: Message = {
      id: Date.now(), // Temporary ID
      uuid: `temp-${Date.now()}`, // Temporary UUID
      sender_username: user?.username || '',
      content: messageText.trim(),
      created_at: new Date().toISOString(),
      is_read: false,
      conversation_uuid: conversationId as string,
      isPending: true, // Mark as pending
      attachments: [],
      is_ai_generated: false
    };

    // Check if there's an AI agent in this conversation (by checking if any previous messages are AI-generated)
    const hasAiAgent = messages.some(m => m.is_ai_generated);

    // Add optimistic message to UI immediately
    updateMessagesCache((prev) => {
      const newMessages = [...prev, optimisticMessage];

      // If there's an AI agent, also add a loading indicator
      if (hasAiAgent) {
        const aiLoadingMessage: Message = {
          id: Date.now() + 1,
          uuid: `temp-ai-loading-${Date.now()}`,
          sender_username: 'AI Assistant',
          content: '',
          created_at: new Date().toISOString(),
          is_read: false,
          conversation_uuid: conversationId as string,
          is_ai_generated: false,
          isAiLoading: true,
          attachments: []
        };
        newMessages.push(aiLoadingMessage);
      }

      return newMessages;
    });
    addMessageToCache(String(conversationId), {
      id: optimisticMessage.id,
      uuid: optimisticMessage.uuid,
      sender_username: optimisticMessage.sender_username,
      content: optimisticMessage.content,
      created_at: optimisticMessage.created_at,
      is_read: optimisticMessage.is_read,
      conversation_uuid: String(conversationId)
    });

    // Send message via WebSocket
    wsSend(JSON.stringify({ type: "chat_message", conversation_uuid: conversationId, message: messageText.trim() }));

    // Scroll to bottom
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

  // Charger instantanément depuis le cache si disponible
  useEffect(() => {
    if (!conversationId) return;
    const cachedInfo = getCachedConversationInfo(String(conversationId));
    const cachedMsgs = getCachedMessages(String(conversationId));
    if (cachedInfo) setConversationInfo(cachedInfo);
    if (cachedMsgs && cachedMsgs.length >= 0) {
      // Force type cast for compatibility with old cache format
      const onlyThisConv = cachedMsgs as unknown as Message[];
      queryClient.setQueryData(['messages', conversationId], onlyThisConv);
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

  // Set up sendMessage handler when websocket is available
  useEffect(() => {
      if (wsIsConnected && conversationId) {
          const handler = (messageText: string) => {
              if (!messageText.trim() || !wsIsConnected) return;
              console.log('📤 Envoi du message via WebSocket:', messageText);

              // Create optimistic message immediately
              const optimisticMessage: Message = {
                id: Date.now(),
                uuid: `temp-${Date.now()}`,
                sender_username: user?.username || '',
                content: messageText.trim(),
                created_at: new Date().toISOString(),
                is_read: false,
                conversation_uuid: conversationId as string,
                isPending: true,
                attachments: [],
                is_ai_generated: false
              };

              // Add optimistic message to UI immediately
              updateMessagesCache((prev) => {
                // Check if there's an AI agent in this conversation
                const hasAiAgentInner = prev.some(m => m.is_ai_generated);
                const newMessages = [...prev, optimisticMessage];

                // If there's an AI agent, also add a loading indicator
                if (hasAiAgentInner) {
                  const aiLoadingMessage: Message = {
                    id: Date.now() + 1,
                    uuid: `temp-ai-loading-${Date.now()}`,
                    sender_username: 'AI Assistant',
                    content: '',
                    created_at: new Date().toISOString(),
                    is_read: false,
                    conversation_uuid: conversationId as string,
                    is_ai_generated: false,
                    isAiLoading: true,
                    attachments: []
                  };
                  newMessages.push(aiLoadingMessage);
                }

                return newMessages;
              });
              addMessageToCache(String(conversationId), {
                id: optimisticMessage.id,
                uuid: optimisticMessage.uuid,
                sender_username: optimisticMessage.sender_username,
                content: optimisticMessage.content,
                created_at: optimisticMessage.created_at,
                is_read: optimisticMessage.is_read,
                conversation_uuid: String(conversationId)
              });

              // Send message via WebSocket
              wsSend(JSON.stringify({
                  type: "chat_message",
                  conversation_uuid: conversationId,
                  message: messageText.trim()
              }));
              setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
          };
          setSendMessage(() => handler);
      } else {
          setSendMessage(null);
      }
  }, [wsIsConnected, conversationId, setSendMessage, user?.username, wsSend, updateMessagesCache]);

  useEffect(() => {
    if (conversationId) {
      // Connect WebSocket with automatic token management
      wsConnect();
    }
  }, [conversationId, wsConnect]);

  // Rafraîchir les messages à chaque fois qu'on revient sur cet écran
  useFocusEffect(
    useCallback(() => {
      if (conversationId) {
        refresh();
      }
    }, [conversationId, refresh])
  );

  // Auto-scroll vers le bas après le chargement des messages
  useEffect(() => {
    if (messages.length > 0 && scrollViewRef.current && !isLoading) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages.length, isLoading]);
  // Auto-scroll quand quelqu'un tape (indicateur typing)
  useEffect(() => {
    if (typingUsers.size > 0 && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [typingUsers.size]);

  if (isLoading) {
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

  const fetchSummary = async () => {
    if (!conversationId) {
      console.log('❌ Résumé impossible - conversationId manquant');
      return;
    }

    console.log('🔍 Début du résumé pour conversation:', conversationId);
    setLoadingSummary(true);

    try {
      const response = await fetchWithAuth(`/messaging/conversations/${conversationId}/summarize/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Statut de la réponse:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Erreur HTTP:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Données reçues:', JSON.stringify(data, null, 2));
      console.log('📝 Résumé:', data.summary);
      console.log('📊 Nombre de messages non lus:', data.unread_count);
      console.log('📊 Messages de contexte:', data.context_messages_count);

      setSummary(data.summary || 'Aucun résumé disponible');
      setShowSummary(true);
    } catch (error) {
      console.error('❌ Erreur lors du résumé:', error);
      console.error('❌ Détails de l\'erreur:', JSON.stringify(error, null, 2));

      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Erreur', `Impossible de générer le résumé: ${errorMessage}`);
    } finally {
      setLoadingSummary(false);
    }
  };


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
                ) : msg.isAiLoading ? (
                  // AI Loading indicator - shown while waiting for AI response
                  <View style={{ alignItems: 'center', marginVertical: 8 }}>
                    <View
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 12, color: 'rgba(10, 145, 104, 0.8)', fontWeight: '600' }}>
                          🤖 IA Assistant
                        </Text>
                        <ActivityIndicator size="small" color="rgba(10, 145, 104, 0.8)" />
                      </View>
                      <Text style={{ fontSize: 10, color: 'rgba(10, 145, 104, 0.6)', marginTop: 4 }}>
                        Génération de la réponse...
                      </Text>
                    </View>
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
                      //  AJOUT : Style spécial pour les messages non lus
                      unreadMessageUuids.has(msg.uuid) && {
                        backgroundColor: '#e6b106ff',
                        borderColor: '#806009ff',
                        borderWidth: 2,
                      }
                    ]}>
                      {msg.attachments && msg.attachments.length > 0 ? (
                        <View style={{ gap: 6 }}>
                          {msg.attachments.map((att) => (
                            <View key={att.uuid} style={{ borderRadius: 8, overflow: 'hidden' }}>
                              {att.file_type === 'image' ? (
                                <AttachmentImage
                                  thumbnailUrl={att.thumbnail_url || att.file_url}
                                  fullUrl={att.file_url}
                                  isMyMessage={isMe}
                                />
                              ) :att.file_type === 'audio' ? (
                                // Audio player
                                <AudioPlayer 
                                  audioUrl={att.file_url}
                                  isMyMessage={isMe} 
                                />
                              ) : att.file_type == 'video' ? (

                              <AttachmentVideo
                                thumbnailUrl={att.thumbnail_url as any}
                                videoUrl={att.file_url}
                              />  
                              ) :  (
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
                              {msg.isPending ? "Envoi..." : msg.is_read ? "Lu" : "Envoyé"}
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
      {/* Bulle de résumé */}
      {showSummary && (
        <View style={styles.summaryBubble}>
          <TouchableOpacity 
            onPress={() => {
              setShowSummary(false);
              setLoadingSummary(false);
            }}
            style={styles.summaryCloseButton}
          >
            <Ionicons name="close" size={20} color="rgba(10, 145, 104, 0.8)" />
          </TouchableOpacity>
          
          <ScrollView showsVerticalScrollIndicator={false} style ={{zIndex :1}}>
            <Text style={styles.summaryContent}>{summary}</Text>
          </ScrollView>
        </View>
      )}
    </Animated.View>
  );
}