import DefaultAvatar from '@/components/DefaultAvatar';
import AttachmentImage from '@/components/FIlesLecture/AttachementImage';
import AttachmentVideo from '@/components/FIlesLecture/AttachementVideo';
import AudioPlayer from '@/components/FIlesLecture/Audioplayer';
import { TypingIndicator } from '@/components/TypingIndicator';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocketWithAuth } from '@/hooks/useWebSocketWithAuth';
import { styles } from '@/styles/appStyles';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useChat } from '../../contexts/ChatContext';
import { useTransition } from '../../contexts/TransitionContext';
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
  const params = useLocalSearchParams();
  // Sécurisation de l'ID pour éviter les problèmes de cache (Array vs String)
  const conversationId = Array.isArray(params.conversationId) ? params.conversationId[0] : params.conversationId;
  
  const queryClient = useQueryClient();
  const { messages: serverMessages, isLoading, refresh } = useMessages(conversationId as string);
  const { user } = useAuth();
  const { transitionPosition, setTransitionPosition } = useTransition();
  const { setWebsocket, setSendMessage, setCurrentConversationId, getCachedMessages, getCachedConversationInfo } = useChat();
  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null);
  const allowedUsernamesRef = useRef<Set<string>>(new Set());
  const [expandedAgentMessages, setExpandedAgentMessages] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  // État local persistant pour les messages en cours d'envoi
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);

  // Helper pour mettre à jour le cache de manière sécurisée
  const updateMessagesCache = useCallback(
    (updater: (prev: Message[]) => Message[]) => {
      if (!conversationId) return;
      queryClient.setQueryData(['messages', conversationId], (oldData?: Message[]) => {
        const newData = updater(oldData || []);
        return newData;
      });
    },
    [queryClient, conversationId]
  );

  const screenDimensions = Dimensions.get('window');
  const zoomAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const [unreadMessageUuids, setUnreadMessageUuids] = useState<Set<string>>(new Set());

  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  const {
    isConnected: wsIsConnected,
    lastMessage,
    sendMessage: wsSend,
    connect: wsConnect,
    socket: activeSocket
  } = useWebSocketWithAuth('/ws/chat/');

  // --- FUSION ET AFFICHAGE DES MESSAGES ---
  // Cette logique assure que le message reste visible même si le cache serveur est rafraîchi sans lui
  const displayedMessages = useMemo(() => {
    const base = serverMessages || [];
    const pending = pendingMessages;

    // On fusionne : on garde les messages serveurs + les messages pending qui ne sont PAS encore dans le serveur
    // On détecte la présence par UUID ou par contenu identique (pour éviter les doublons lors de la transition pending -> real)
    const combined = [...base];
    
    pending.forEach(pm => {
      const isAlreadyInServer = base.some(m => 
        m.uuid === pm.uuid || 
        (m.content === pm.content && m.sender_username === pm.sender_username && !m.isPending)
      );
      
      if (!isAlreadyInServer) {
        combined.push(pm);
      }
    });

    return combined.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [serverMessages, pendingMessages]);

  // Nettoyage automatique des vieux messages pending (> 10s) si le serveur les a (ceinture et bretelles)
  useEffect(() => {
    if (pendingMessages.length === 0) return;
    if (serverMessages && serverMessages.length > 0) {
        setPendingMessages(prev => prev.filter(pm => {
             // Si le message existe côté serveur (par contenu et user), on peut le retirer du pending
             const exists = serverMessages.some(m => 
                 m.content === pm.content && m.sender_username === pm.sender_username && !m.isPending
             );
             return !exists;
        }));
    }
  }, [serverMessages, pendingMessages.length]);

  // --- GESTION WEBSOCKET ---
  const handleWebSocketMessage = useCallback(
    (event: any) => {
      const rawData = (event && event.data) || event;
      let data: any;
      try {
        data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      } catch (e) { return; }

      if (data.type === 'chat_message') {
        const incomingConvUuid = data.conversation_uuid || data.message?.conversation_uuid;
        if (incomingConvUuid !== conversationId) return;

        const msg = data.message || data;

        // Filtrage...
        if (allowedUsernamesRef.current.size > 0) {
            const senderOk = msg.sender_username && allowedUsernamesRef.current.has(msg.sender_username);
            if (!senderOk && !msg.content.startsWith('🎉')) return;
        }

        const newMsg: Message = {
          id: msg.id,
          uuid: msg.uuid,
          sender_username: msg.sender_username,
          content: msg.content,
          created_at: msg.created_at,
          is_read: false, 
          conversation_uuid: conversationId as string,
          is_ai_generated: msg.is_ai_generated || false,
          attachments: msg.attachments || [],
        };

        if (msg.sender_username !== user?.username) {
          setUnreadMessageUuids((prev) => new Set([...prev, newMsg.uuid]));
        }

        // Mise à jour du cache React Query
        updateMessagesCache((prev) => {
          // On retire les version pending/loading correspondantes
          const cleanPrev = prev.filter(m => 
             !(m.isPending && m.content === newMsg.content && m.sender_username === newMsg.sender_username) && !m.isAiLoading
          );
          // Évite doublons par UUID
          if (cleanPrev.some(m => m.uuid === newMsg.uuid)) return cleanPrev;
          
          return [...cleanPrev, newMsg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });

        if (msg.sender_username !== user?.username && wsIsConnected) {
          wsSend(JSON.stringify({ type: 'mark_as_seen', conversation_uuid: conversationId }));
        }

        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      } else if (data.type === 'typing_status') {
         const { username, is_typing } = data;
         if (username !== user?.username) {
             setTypingUsers(prev => {
                 const newSet = new Set(prev);
                 is_typing ? newSet.add(username) : newSet.delete(username);
                 return newSet;
             });
         }
      } else if (data.type === 'conversation_seen' && data.conversation_uuid === conversationId) {
          updateMessagesCache(prev => prev.map(m => m.sender_username === user?.username ? { ...m, is_read: true } : m));
      }
    },
    [conversationId, user?.username, wsIsConnected, wsSend, updateMessagesCache]
  );

  useEffect(() => {
    if (!lastMessage) return;
    handleWebSocketMessage(lastMessage);
  }, [lastMessage, handleWebSocketMessage]);

  useEffect(() => {
    if (wsIsConnected && conversationId && activeSocket) {
      setCurrentConversationId(conversationId as string);
      setWebsocket(activeSocket);
      if (activeSocket.readyState === WebSocket.OPEN) {
        activeSocket.send(JSON.stringify({ type: 'mark_as_seen', conversation_uuid: conversationId }));
      }
    } else {
      setWebsocket(null);
      setCurrentConversationId(null);
    }
  }, [wsIsConnected, conversationId, activeSocket, setCurrentConversationId, setWebsocket]);


  // --- ENVOI DE MESSAGE (Cœur du correctif) ---
  const sendMessageHandler = useCallback((messageText: string) => {
    if (!messageText.trim()) return;

    const tempUuid = `temp-${Date.now()}-${Math.random()}`; // UUID unique
    const optimisticMessage: Message = {
      id: Date.now(),
      uuid: tempUuid,
      sender_username: user?.username || '',
      content: messageText.trim(),
      created_at: new Date().toISOString(),
      is_read: false,
      conversation_uuid: conversationId as string,
      isPending: true,
      attachments: [],
      is_ai_generated: false
    };

    // 1. Mise à jour immédiate de l'état local (Priorité UI)
    setPendingMessages(prev => [...prev, optimisticMessage]);

    // 2. Mise à jour immédiate du cache (Pour que l'UI réagisse tout de suite via displayedMessages)
    updateMessagesCache((prev) => [...prev, optimisticMessage]);

    // 3. Scroll immédiat
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 50);

    // 4. Envoi réseau (Non bloquant pour l'UI)
    if (wsIsConnected) {
        try {
            wsSend(JSON.stringify({
                type: "chat_message",
                conversation_uuid: conversationId,
                message: messageText.trim()
            }));
        } catch (e) {
            console.error("Erreur envoi WS", e);
            // On pourrait marquer le message comme "erreur" ici si besoin
        }
    } else {
        console.warn("WebSocket non connecté, message en attente locale uniquement");
    }

  }, [wsIsConnected, conversationId, user?.username, wsSend, updateMessagesCache]);

  // On attache le handler dès que l'ID de conversation est là, pas besoin d'attendre le WS
  // Cela permet à l'UI de réagir (vider l'input) même si le réseau lag
  useEffect(() => {
      if (conversationId) {
          setSendMessage(() => sendMessageHandler);
      }
      return () => setSendMessage(null);
  }, [conversationId, setSendMessage, sendMessageHandler]);

  // --- LIFECYCLE & EFFETS ---
  useEffect(() => {
    if (conversationId) wsConnect();
  }, [conversationId, wsConnect]);

  useEffect(() => {
    if (!conversationId) return;
    const cachedInfo = getCachedConversationInfo(String(conversationId));
    if (cachedInfo) setConversationInfo(cachedInfo);
    // On ne charge les messages du cache global que si nécessaire, React Query gère le reste
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      if (conversationId) refresh();
    }, [conversationId, refresh])
  );

  // Scroll automatique intelligent
  useEffect(() => {
    if (displayedMessages.length > 0 && scrollViewRef.current) {
        // Au chargement initial ou nouveau message, on scroll
        const shouldAnimate = !isLoading; 
        setTimeout(() => {
             scrollViewRef.current?.scrollToEnd({ animated: shouldAnimate });
        }, 100);
    }
  }, [displayedMessages.length, isLoading]);

  useEffect(() => {
      if (transitionPosition) {
        Animated.spring(zoomAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 10 }).start(() => setTransitionPosition(null));
      } else {
        zoomAnim.setValue(1);
      }
  }, []);


  // --- RENDER ---
  // Si on charge MAIS qu'on a des messages affichables (cache ou pending), on affiche la liste, pas le loader
  if (isLoading && displayedMessages.length === 0) {
    return (
      <View style={styles.chatContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="rgba(55, 116, 69, 1)" />
          <Text style={{ marginTop: 10, color: '#666' }}>Chargement...</Text>
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

  const otherParticipant = conversationInfo?.participants_detail?.find(p => p.user_uuid !== user?.uuid) || conversationInfo?.other_participant;
  const headerName = otherParticipant ? (otherParticipant.surnom || otherParticipant.username) : 'Conversation';

  const toggleAgentMessage = (messageUuid: string) => {
    setExpandedAgentMessages(prev => {
      const newSet = new Set(prev);
      newSet.has(messageUuid) ? newSet.delete(messageUuid) : newSet.add(messageUuid);
      return newSet;
    });
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
          {displayedMessages.map((msg, index) => {
            const isMe = msg.sender_username === user?.username;
            const prevMsg = index > 0 ? displayedMessages[index - 1] : null;
            const nextMsg = index < displayedMessages.length - 1 ? displayedMessages[index + 1] : null;
            const isSystemMessage = msg.content.startsWith('🎉') || msg.content.startsWith('👋') || msg.content.includes('a rejoint') || msg.content.includes('Bienvenue');
            const currentDate = new Date(msg.created_at).toLocaleDateString('fr-FR');
            const prevDate = prevMsg ? new Date(prevMsg.created_at).toLocaleDateString('fr-FR') : null;
            const showDateSeparator = currentDate !== prevDate;
            
            // Logique de groupement visuel (inchangée)
            let prevNonSystemMsg = prevMsg;
            let prevNonSystemIndex = index - 1;
            while (prevNonSystemMsg && (prevNonSystemMsg.content.startsWith('🎉') || prevNonSystemMsg.content.startsWith('👋') || prevNonSystemMsg.content.includes('a rejoint') || prevNonSystemMsg.content.includes('Bienvenue'))) {
              prevNonSystemIndex--; prevNonSystemMsg = prevNonSystemIndex >= 0 ? displayedMessages[prevNonSystemIndex] : null;
            }
            let nextNonSystemMsg = nextMsg;
            let nextNonSystemIndex = index + 1;
            while (nextNonSystemMsg && (nextNonSystemMsg.content.startsWith('🎉') || nextNonSystemMsg.content.startsWith('👋') || nextNonSystemMsg.content.includes('a rejoint') || nextNonSystemMsg.content.includes('Bienvenue'))) {
              nextNonSystemIndex++; nextNonSystemMsg = nextNonSystemIndex < displayedMessages.length ? displayedMessages[nextNonSystemIndex] : null;
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
                  <View style={{ alignItems: 'center', marginVertical: 8 }}>
                    <View style={{ backgroundColor: 'rgba(10, 145, 104, 0.1)', borderRadius: 12, padding: 12, marginHorizontal: 20, maxWidth: '80%', borderWidth: 1, borderColor: 'rgba(10, 145, 104, 0.3)' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 12, color: 'rgba(10, 145, 104, 0.8)', fontWeight: '600' }}>🤖 IA Assistant</Text>
                        <ActivityIndicator size="small" color="rgba(10, 145, 104, 0.8)" />
                      </View>
                      <Text style={{ fontSize: 10, color: 'rgba(10, 145, 104, 0.6)', marginTop: 4 }}>Génération...</Text>
                    </View>
                  </View>
                ) : msg.is_ai_generated ? (
                  <View style={{ alignItems: 'center', marginVertical: 8 }}>
                    <TouchableOpacity
                      onPress={() => toggleAgentMessage(msg.uuid)}
                      style={{ backgroundColor: 'rgba(10, 145, 104, 0.1)', borderRadius: 12, padding: 12, marginHorizontal: 20, maxWidth: '80%', borderWidth: 1, borderColor: 'rgba(10, 145, 104, 0.3)' }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: expandedAgentMessages.has(msg.uuid) ? 8 : 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={{ fontSize: 12, color: 'rgba(10, 145, 104, 0.8)', fontWeight: '600' }}>🤖 {msg.sender_username}</Text>
                          <Text style={{ fontSize: 10, color: 'rgba(10, 145, 104, 0.6)' }}>IA Assistant</Text>
                        </View>
                        <Ionicons name={expandedAgentMessages.has(msg.uuid) ? "chevron-up" : "chevron-down"} size={16} color="rgba(10, 145, 104, 0.6)" />
                      </View>
                      {expandedAgentMessages.has(msg.uuid) && (
                        <View>
                          <Text style={{ fontSize: 14, color: '#333', lineHeight: 20, marginBottom: 8 }}>{msg.content}</Text>
                          <Text style={{ fontSize: 10, color: 'rgba(10, 145, 104, 0.6)', textAlign: 'right' }}>{new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.messageWrapper}>
                    {!isMe && isFirstInGroup && <Text style={styles.senderName}>{msg.sender_username}</Text>}
                    <View style={[
                      styles.messageBubble,
                      isMe ? styles.myMessage : styles.theirMessage,
                      !isFirstInGroup && styles.messageGrouped,
                      !isFirstInGroup && !isLastInGroup && (isMe ? styles.myMessageMiddle : styles.theirMessageMiddle),
                      isFirstInGroup && isSameSenderAsNext && (isMe ? styles.myMessageFirst : styles.theirMessageFirst),
                      isLastInGroup && isSameSenderAsPrev && (isMe ? styles.myMessageLast : styles.theirMessageLast),
                      // Style temporaire pour message en cours d'envoi
                      msg.isPending && { opacity: 0.7 },
                      unreadMessageUuids.has(msg.uuid) && { backgroundColor: '#e6b106ff', borderColor: '#806009ff', borderWidth: 2 }
                    ]}>
                      {msg.attachments && msg.attachments.length > 0 ? (
                        <View style={{ gap: 6 }}>
                          {msg.attachments.map((att) => (
                            <View key={att.uuid} style={{ borderRadius: 8, overflow: 'hidden' }}>
                              {att.file_type === 'image' ? <AttachmentImage thumbnailUrl={att.thumbnail_url || att.file_url} fullUrl={att.file_url} isMyMessage={isMe} /> :
                               att.file_type === 'audio' ? <AudioPlayer audioUrl={att.file_url} isMyMessage={isMe} /> :
                               att.file_type === 'video' ? <AttachmentVideo thumbnailUrl={att.thumbnail_url as any} videoUrl={att.file_url} /> :
                               <Text style={{ color: isMe ? '#fff' : '#111' }}>{att.original_filename || 'Fichier'}</Text>}
                            </View>
                          ))}
                          {!!msg.content && <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>{msg.content}</Text>}
                        </View>
                      ) : (
                        <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>{msg.content}</Text>
                      )}
                      {isLastInGroup && (
                        <View style={styles.messageMeta}>
                          <Text style={styles.timestampText}>{new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
                          {isMe && <Text style={styles.readStatus}>{msg.isPending ? "..." : msg.is_read ? "Lu" : "Envoyé"}</Text>}
                        </View>
                      )}
                    </View>
                  </View>
                )}
              </React.Fragment>
            );
          })}
          {Array.from(typingUsers).map(username => <TypingIndicator key={username} username={username} />)}
        </ScrollView>
      </KeyboardAvoidingView>
      {showSummary && (
        <View style={styles.summaryBubble}>
          <TouchableOpacity onPress={() => { setShowSummary(false); setLoadingSummary(false); }} style={styles.summaryCloseButton}>
            <Ionicons name="close" size={20} color="rgba(10, 145, 104, 0.8)" />
          </TouchableOpacity>
          <ScrollView showsVerticalScrollIndicator={false} style={{zIndex:1}}><Text style={styles.summaryContent}>{summary}</Text></ScrollView>
        </View>
      )}
    </Animated.View>
  );
}