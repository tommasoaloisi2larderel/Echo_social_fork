import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
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
}

export default function ConversationDetail() {
  const { conversationId } = useLocalSearchParams();
  const { accessToken, user, logout } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [newMessage, setNewMessage] = useState<string>('');

  const API_BASE_URL = 'https://reseausocial-production.up.railway.app';

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

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_username === user?.username;

    return (
      <View
        style={[
          styles.message,
          isMe ? styles.myMessage : styles.otherMessage,
        ]}
      >
        {!isMe && <Text style={styles.sender}>{item.sender_username}</Text>}
        <Text style={styles.content}>{item.content}</Text>
        <Text style={styles.time}>
          {new Date(item.created_at).toLocaleTimeString()}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <Stack.Screen options={{ title: 'Chargement...' }} />
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ title: 'Conversation' }} />

      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.uuid}
        style={styles.list}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Tapez votre message..."
          multiline
          maxLength={1000}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            !newMessage.trim() && styles.sendButtonDisabled,
          ]}
          onPress={sendMessage}
          disabled={!newMessage.trim()}
        >
          <Text style={styles.sendButtonText}>Envoyer</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.connectionStatus}>
        <Text style={styles.connectionText}>
          {websocket ? '🟢 Connecté' : '🔴 Déconnecté'}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    flex: 1,
    padding: 10,
  },
  message: {
    padding: 10,
    marginVertical: 5,
    borderRadius: 10,
    maxWidth: '80%',
  },
  myMessage: {
    backgroundColor: '#da913eff',
    alignSelf: 'flex-end',
  },
  otherMessage: {
    backgroundColor: 'white',
    alignSelf: 'flex-start',
  },
  sender: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  content: {
    fontSize: 16,
  },
  time: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: 'white',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: '#da913eff',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  connectionStatus: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 5,
    borderRadius: 10,
  },
  connectionText: {
    color: 'white',
    fontSize: 12,
  },
});
