import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { styles } from '@/styles/appStyles';
import DefaultAvatar from '@/components/DefaultAvatar';

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

  const API_BASE_URL = 'https://reseausocial-production.up.railway.app';
  
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ title: 'Conversation', headerShown: true }} />
      
      <View style={styles.chatContainer}>
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

        {/* Zone de saisie - on la laisse simple pour l'instant */}
        <View style={{ padding: 10, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#e0e0e0' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={{ flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, marginRight: 10 }}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Message..."
              placeholderTextColor="rgba(105, 105, 105, 0.8)"
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={{ backgroundColor: newMessage.trim() ? 'rgba(55, 116, 69, 1)' : '#ccc', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 }}
              onPress={sendMessage}
              disabled={!newMessage.trim()}
            >
              <Text style={{ color: 'white', fontWeight: 'bold' }}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
