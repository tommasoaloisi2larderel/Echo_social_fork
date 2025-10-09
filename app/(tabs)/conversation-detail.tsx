import DefaultAvatar from '@/components/DefaultAvatar';
import { styles } from '@/styles/appStyles';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { useTransition } from '../../contexts/TransitionContext';

interface Message {
  id: number;
  uuid: string;
  sender_username: string;
  content: string;
  created_at: string;
  is_read?: boolean;
}


export default function ConversationDetail() {
  const { conversationId } = useLocalSearchParams();
  const { accessToken, user, logout } = useAuth();
  const { transitionPosition, setTransitionPosition } = useTransition();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [newMessage, setNewMessage] = useState<string>('');
  
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
        setWebsocket(ws);

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
        setWebsocket(null);
      };
    } catch (error) {
      console.error("❌ Erreur connexion WebSocket:", error);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !websocket) return;

    const messageData = {
      type: "chat_message",
      conversation_uuid: conversationId,
      message: newMessage.trim(),
    };

    console.log("📤 Envoi message:", messageData);
    websocket.send(JSON.stringify(messageData));
    setNewMessage("");
  };

  const fetchMessages = async () => {
    if (!accessToken) {
      console.log('❌ Pas de token pour les messages, déconnexion...');
      await logout();
      return;
    }

    try {
      console.log('📨 Récupération messages pour:', conversationId);

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

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Messages reçus:', data.length || data.results?.length || 0);

      const messagesList = data.results || data;
      const sortedMessages = messagesList.sort(
        (a: Message, b: Message) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      setMessages(sortedMessages);
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

  useEffect(() => {
    if (conversationId && accessToken) {
      fetchMessages();
      connectWebSocket();
    }

    return () => {
      if (websocket) {
        websocket.close();
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
      {/* Bouton de retour flottant */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 63,
          left: 20,
          zIndex: 20,
          backgroundColor: 'rgba(10, 145, 104, 0.7)',
          borderRadius: 20,
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
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

      {/* Header flottant avec avatar et nom */}
      <TouchableOpacity 
        style={styles.chatHeader}
        onPress={() => router.push({
          pathname: '/(tabs)/conversation-management',
          params: { conversationId }
        })}
        activeOpacity={0.8}
      >
        <DefaultAvatar name="Contact" size={30} style={styles.chatHeaderAvatar} />
        <Text style={styles.chatHeaderName}>Conversation</Text>
        <View style={styles.chatHeaderStatus}>
          <Text style={styles.statusDot}>•</Text>
        </View>
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
            
            // Vérifier si le message précédent/suivant est du même utilisateur
            const isSameSenderAsPrev = prevMsg && prevMsg.sender_username === msg.sender_username;
            const isSameSenderAsNext = nextMsg && nextMsg.sender_username === msg.sender_username;
            
            // Déterminer si c'est le premier ou dernier message d'un groupe
            const isFirstInGroup = !isSameSenderAsPrev;
            const isLastInGroup = !isSameSenderAsNext;
            const isFirstMessageOverall = index === 0;
            
            return (
              <View
                key={msg.uuid}
                style={[
                  styles.messageBubble,
                  isMe ? styles.myMessage : styles.theirMessage,
                  // Réduire l'espacement pour le premier message
                  isFirstMessageOverall && styles.firstMessageOverall,
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
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
