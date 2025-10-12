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

interface GroupInfo {
  uuid: string;
  name: string;
  avatar?: string;
}

export default function ConversationDetail() {
  const { conversationId } = useLocalSearchParams();
  const { accessToken, user, logout, makeAuthenticatedRequest } = useAuth();
  const { transitionPosition, setTransitionPosition } = useTransition();
  const { setWebsocket, setSendMessage, setCurrentConversationId } = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null);
  const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);

  const [localWebsocket, setLocalWebsocket] = useState<WebSocket | null>(null);
  
  // Synchroniser avec l'état global du layout
  const [isLayoutSynced, setIsLayoutSynced] = useState(false);
  
  // Animation de zoom
  const screenDimensions = Dimensions.get('window');
  const zoomAnim = useRef(new Animated.Value(0)).current;

  // Utilise le proxy local pour éviter CORS en développement web
  const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? "http://localhost:3001"
    : "https://reseausocial-production.up.railway.app";
  
  const scrollViewRef = useRef<ScrollView>(null);

  const connectWebSocket = () => {
    if (!conversationId || !accessToken) return;

    try {
      console.log("🔌 Connexion WebSocket pour conversation:", conversationId);

      // ✅ Auth via subprotocols
      const ws = new WebSocket(
        "wss://reseausocial-production.up.railway.app/ws/chat/",
        ["access_token", accessToken]
      );

      ws.onopen = () => {
        console.log("✅ WebSocket connecté");
        setLocalWebsocket(ws);
        setWebsocket(ws); // Exposer au contexte global
        setCurrentConversationId(conversationId as string);

        // Marquer la conversation comme vue dès la connexion
        ws.send(
          JSON.stringify({
            type: "mark_as_seen",
            conversation_uuid: conversationId,
          })
        );
      };

      ws.onmessage = (event) => {
        console.log("📨 Message WebSocket reçu:", event.data);
        const data = JSON.parse(event.data);

        if (data.type === "chat_message") {
          const msg = data.message;
          const newMsg: Message = {
            id: msg.id,
            uuid: msg.uuid,
            sender_username: msg.sender_username,
            content: msg.content,
            created_at: msg.created_at,
          };

          // ✅ Anti-doublon
          setMessages((prev) => {
            const exists = prev.some((m) => m.uuid === newMsg.uuid);
            if (exists) {
              return prev.map((m) =>
                m.uuid === newMsg.uuid ? { ...m, ...newMsg } : m
              );
            }
            
            // Scroll vers le bas pour les nouveaux messages
            setTimeout(() => {
              scrollViewRef.current?.scrollToEnd({ animated: true });
            }, 100);
            
            return [...prev, newMsg];
          });
        } else if (data.type === "error") {
          console.error("❌ Erreur WS:", data.message);
        }
      };

      ws.onerror = (error) => {
        console.error("❌ Erreur WebSocket:", error);
      };

      ws.onclose = () => {
        console.log("🔌 WebSocket fermé");
        setLocalWebsocket(null);
        setWebsocket(null); // Nettoyer le contexte global
        setCurrentConversationId(null);
      };
    } catch (error) {
      console.error("❌ Erreur connexion WebSocket:", error);
    }
  };

  const sendMessageHandler = (messageText: string) => {
    if (!messageText.trim() || !localWebsocket) {
      console.warn("⚠️ Impossible d'envoyer: message vide ou pas de websocket");
      return;
    }

    const messageData = {
      type: "chat_message",
      conversation_uuid: conversationId,
      message: messageText.trim(),
    };

    console.log("📤 Envoi message:", messageData);
    localWebsocket.send(JSON.stringify(messageData));
    
    // Scroll vers le bas après envoi
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const fetchMessages = async () => {
    if (!accessToken) {
      console.log('❌ Pas de token pour les messages, déconnexion...');
      await logout();
      return;
    }

    try {
      console.log('📨 Récupération messages pour:', conversationId);

      // Récupérer les détails de la conversation d'abord
      const convResponse = await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/conversations/${conversationId}/`
      );

      if (convResponse.ok) {
        const convData = await convResponse.json();
        setConversationInfo(convData);
        
        // D'abord vérifier dans la liste des conversations si c'est un groupe
        const conversationsResponse = await makeAuthenticatedRequest(
          `${API_BASE_URL}/messaging/conversations/`
        );
        
        let conversationFromList = null;
        if (conversationsResponse.ok) {
          const convList = await conversationsResponse.json();
          conversationFromList = convList.find((c: any) => c.uuid === conversationId);
          console.log('📋 Conv from list - other_participant:', conversationFromList?.other_participant);
        }
        
        // Toujours vérifier dans les groupes d'abord
        console.log('👥 Recherche dans les groupes...');
        const groupsResponse = await makeAuthenticatedRequest(
          `${API_BASE_URL}/groups/my-groups/`
        );
        
        let isGroupConversation = false;
        if (groupsResponse.ok) {
          const groups = await groupsResponse.json();
          console.log('📋 Vérification groupes pour conversation:', conversationId);
          
          // Itérer sur chaque groupe pour trouver celui avec ce conversation_uuid
          for (const group of groups) {
            try {
              const detailsResponse = await makeAuthenticatedRequest(
                `${API_BASE_URL}/groups/${group.uuid}/`
              );
              
              if (detailsResponse.ok) {
                const groupData = await detailsResponse.json();
                
                // Vérifier si c'est le bon groupe
                if (groupData.conversation_uuid === conversationId) {
                  console.log('✅ Groupe trouvé pour header:', groupData.name);
                  isGroupConversation = true;
                  setGroupInfo({
                    uuid: groupData.uuid,
                    name: groupData.name,
                    avatar: groupData.avatar
                  });
                  break; // Trouvé, on arrête
                }
              }
            } catch (error) {
              console.error('❌ Erreur chargement détails groupe:', group.uuid, error);
            }
          }
        }
        
        if (!isGroupConversation && conversationFromList?.other_participant) {
          console.log('✅ Conversation privée détectée (pas un groupe)');
        }
      }

      const response = await fetch(
        `${API_BASE_URL}/messaging/conversations/${conversationId}/messages/`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('📨 Réponse statut messages:', response.status);

      if (response.status === 401) {
        console.log('❌ Token expiré pour messages, déconnexion...');
        await logout();
        return;
      }

      if (response.status === 404) {
        console.error('❌ Conversation 404 - n\'existe pas ou pas de messages');
        setMessages([]);
        setLoading(false);
        Alert.alert(
          'Conversation introuvable',
          'Cette conversation n\'existe pas ou vous n\'y avez pas accès.'
        );
        return;
      }

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Messages reçus:', data.length || data.results?.length || 0);
      console.log('📋 Structure données:', Array.isArray(data) ? 'array' : 'object', 'hasResults:', !!data.results);

      const messagesList = Array.isArray(data) ? data : (data.results || []);
      console.log('📋 Messages à afficher:', messagesList.length);
      
      const sortedMessages = messagesList.sort(
        (a: Message, b: Message) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      setMessages(sortedMessages);
      console.log('✅ Messages chargés dans l\'état:', sortedMessages.length);
    } catch (error) {
      console.error('❌ Erreur messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Animation de zoom au montage
  useEffect(() => {
    if (transitionPosition) {
      Animated.spring(zoomAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start(() => {
        // Nettoyer la position de transition après l'animation
        setTransitionPosition(null);
      });
    } else {
      // Si pas de transition, afficher directement
      zoomAnim.setValue(1);
    }
  }, []);

  // Exposer la fonction sendMessage au contexte
  useEffect(() => {
    setSendMessage(() => sendMessageHandler);
    
    return () => {
      setSendMessage(null);
    };
  }, [localWebsocket, conversationId]);

  useEffect(() => {
    if (conversationId && accessToken) {
      fetchMessages();
      connectWebSocket();
    }

    return () => {
      if (localWebsocket) {
        localWebsocket.close();
      }
    };
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

  // Calcul des styles d'animation
  const animatedStyle = transitionPosition ? {
    transform: [
      {
        translateX: zoomAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [
            transitionPosition.x + transitionPosition.width / 2 - screenDimensions.width / 2,
            0
          ],
        }),
      },
      {
        translateY: zoomAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [
            transitionPosition.y + transitionPosition.height / 2 - screenDimensions.height / 2,
            0
          ],
        }),
      },
      {
        scale: zoomAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [transitionPosition.width / screenDimensions.width, 1],
        }),
      },
    ],
    opacity: zoomAnim,
  } : {};

  return (
    <Animated.View style={[styles.chatContainer, animatedStyle]}>
      {/* Bouton retour */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 65,
          left: 20,
          zIndex: 20,
          backgroundColor: 'rgba(10, 145, 104, 0.9)',
          width: 40,
          height: 40,
          borderRadius: 20,
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: 'rgba(10, 145, 104, 0.4)',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 8,
          elevation: 8,
        }}
        onPress={() => router.back()}
      >
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Header avec avatar et nom */}
      <TouchableOpacity 
        onPress={() => router.push({
          pathname: '/(tabs)/conversation-management',
          params: { conversationId }
        })}
        activeOpacity={0.8}
        style={{
          position: 'absolute',
          top: 65,
          left: 75,
          right: 20,
          height: 40,
          backgroundColor: 'rgba(10, 145, 104, 0.9)',
          borderRadius: 20,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          gap: 10,
          zIndex: 10,
          shadowColor: 'rgba(10, 145, 104, 0.4)',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.5,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        {(() => {
          // Si c'est un groupe, afficher le nom du groupe
          if (groupInfo) {
            return (
              <>
                <DefaultAvatar name={groupInfo.name} size={26} />
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff', flex: 1 }}>{groupInfo.name}</Text>
              </>
            );
          }
          
          // Sinon, trouver l'autre participant (celui qui n'est pas moi)
          if (conversationInfo?.participants_detail) {
            const otherParticipant = conversationInfo.participants_detail.find(
              p => p.user_uuid !== user?.uuid
            );
            if (otherParticipant) {
              const name = otherParticipant.surnom || otherParticipant.username;
              return (
                <>
                  <DefaultAvatar name={name} size={26} />
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff', flex: 1 }}>{name}</Text>
                </>
              );
            }
          }
          
          // Par défaut
          return (
            <>
              <DefaultAvatar name="Conversation" size={26} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff', flex: 1 }}>Conversation</Text>
            </>
          );
        })()}
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ade80' }} />
      </TouchableOpacity>
      
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        {/* Liste des messages */}
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg, index) => {
            const isMe = msg.sender_username === user?.username;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
            
            // Détecter les messages système
            const isSystemMessage = msg.content.startsWith('🎉') || 
                                    msg.content.startsWith('👋') || 
                                    msg.content.includes('a rejoint') ||
                                    msg.content.includes('Bienvenue');
            
            // Vérifier si on doit afficher un séparateur de date
            const currentDate = new Date(msg.created_at).toLocaleDateString('fr-FR');
            const prevDate = prevMsg ? new Date(prevMsg.created_at).toLocaleDateString('fr-FR') : null;
            const showDateSeparator = currentDate !== prevDate;
            
            // Trouver le message précédent non-système pour le groupement
            let prevNonSystemMsg = prevMsg;
            let prevNonSystemIndex = index - 1;
            while (prevNonSystemMsg && (
              prevNonSystemMsg.content.startsWith('🎉') || 
              prevNonSystemMsg.content.startsWith('👋') || 
              prevNonSystemMsg.content.includes('a rejoint') ||
              prevNonSystemMsg.content.includes('Bienvenue')
            )) {
              prevNonSystemIndex--;
              prevNonSystemMsg = prevNonSystemIndex >= 0 ? messages[prevNonSystemIndex] : null;
            }
            
            // Trouver le message suivant non-système pour le groupement
            let nextNonSystemMsg = nextMsg;
            let nextNonSystemIndex = index + 1;
            while (nextNonSystemMsg && (
              nextNonSystemMsg.content.startsWith('🎉') || 
              nextNonSystemMsg.content.startsWith('👋') || 
              nextNonSystemMsg.content.includes('a rejoint') ||
              nextNonSystemMsg.content.includes('Bienvenue')
            )) {
              nextNonSystemIndex++;
              nextNonSystemMsg = nextNonSystemIndex < messages.length ? messages[nextNonSystemIndex] : null;
            }
            
            // Vérifier si le message précédent/suivant (non-système) est du même utilisateur
            const isSameSenderAsPrev = prevNonSystemMsg && prevNonSystemMsg.sender_username === msg.sender_username;
            const isSameSenderAsNext = nextNonSystemMsg && nextNonSystemMsg.sender_username === msg.sender_username;
            
            // Déterminer si c'est le premier ou dernier message d'un groupe
            const isFirstInGroup = !isSameSenderAsPrev;
            const isLastInGroup = !isSameSenderAsNext;
            const isFirstMessageOverall = index === 0;
            
            return (
              <React.Fragment key={msg.uuid}>
                {/* Séparateur de date */}
                {showDateSeparator && (
                  <View style={styles.dateSeparator}>
                    <View style={styles.dateLine} />
                    <Text style={styles.dateText}>{currentDate}</Text>
                    <View style={styles.dateLine} />
                  </View>
                )}
                
                {/* Message système */}
                {isSystemMessage ? (
                  <View style={styles.systemMessageContainer}>
                    <Text style={styles.systemMessageText}>{msg.content}</Text>
                  </View>
                ) : (
                  <View style={styles.messageWrapper}>
                    {/* Afficher le nom sur le premier message du groupe (seulement pour les autres) */}
                    {!isMe && isFirstInGroup && (
                      <Text style={styles.senderName}>{msg.sender_username}</Text>
                    )}
                    
                    <View
                      style={[
                        styles.messageBubble,
                        isMe ? styles.myMessage : styles.theirMessage,
                        // Réduire l'espacement pour les messages groupés
                        !isFirstInGroup && styles.messageGrouped,
                        // Modifier les bordures pour les messages du milieu
                        !isFirstInGroup && !isLastInGroup && (isMe ? styles.myMessageMiddle : styles.theirMessageMiddle),
                        isFirstInGroup && isSameSenderAsNext && (isMe ? styles.myMessageFirst : styles.theirMessageFirst),
                        isLastInGroup && isSameSenderAsPrev && (isMe ? styles.myMessageLast : styles.theirMessageLast),
                      ]}
                    >
                      <Text style={[
                        styles.messageText,
                        isMe ? styles.myMessageText : styles.theirMessageText
                      ]}>
                        {msg.content}
                      </Text>
                      {/* Afficher l'heure seulement sur le dernier message du groupe */}
                      {isLastInGroup && (
                        <View style={styles.messageMeta}>
                          <Text style={styles.timestampText}>
                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
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
