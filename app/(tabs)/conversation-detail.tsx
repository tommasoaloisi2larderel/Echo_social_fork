import DefaultAvatar from '@/components/DefaultAvatar';
import { styles } from '@/styles/appStyles';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [newMessage, setNewMessage] = useState<string>('');
  
  // Synchroniser avec l'état global du layout
  const [isLayoutSynced, setIsLayoutSynced] = useState(false);

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
        <Stack.Screen options={{ title: 'Chargement...', headerShown: true }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="rgba(55, 116, 69, 1)" />
          <Text style={{ marginTop: 10, color: '#666' }}>Chargement des messages...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.chatContainer}>
      {/* Bouton de retour flottant */}
      <TouchableOpacity
        style={{
          position: 'absolute',
          top: 10,
          left: 15,
          zIndex: 1000,
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          borderRadius: 20,
          padding: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
        onPress={() => router.push('/(tabs)/conversations')}
      >
        <Text style={{ fontSize: 18, color: 'rgba(55, 116, 69, 1)' }}>←</Text>
      </TouchableOpacity>

      {/* Header flottant avec avatar et nom */}
      <View style={styles.chatHeader}>
        <DefaultAvatar name="Contact" size={30} style={styles.chatHeaderAvatar} />
        <Text style={styles.chatHeaderName}>Conversation</Text>
        <View style={styles.chatHeaderStatus}>
          <Text style={styles.statusDot}>•</Text>
        </View>
      </View>

      {/* Liste des messages */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => {
          const isMe = msg.sender_username === user?.username;
          return (
            <View
              key={msg.uuid}
              style={[
                styles.messageBubble,
                isMe ? styles.myMessage : styles.theirMessage
              ]}
            >
              <Text style={[
                styles.messageText,
                isMe ? styles.myMessageText : styles.theirMessageText
              ]}>
                {msg.content}
              </Text>
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
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
