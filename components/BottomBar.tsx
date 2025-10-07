import { router } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { styles } from "../styles/appStyles";

interface BottomBarProps {
  currentRoute: string;
  chatText: string;
  setChatText: (text: string) => void;
  chatRecipient?: string;
  onSendMessage?: () => void;
  conversationId?: string;
}

export default function BottomBar({ 
  currentRoute, 
  chatText, 
  setChatText, 
  chatRecipient = "",
  onSendMessage,
  conversationId
}: BottomBarProps) {
  
  const isChat = currentRoute.includes("conversation-detail");
  const { accessToken, makeAuthenticatedRequest } = useAuth();
  
  // Debug: vérifier que isChat fonctionne
  console.log("BottomBar - currentRoute:", currentRoute, "isChat:", isChat);

  // Fonction pour envoyer un message
  const handleSendMessage = async () => {
    if (!chatText.trim()) return;

    try {
      if (isChat && conversationId) {
        // Envoi de message dans une conversation existante
        console.log("Envoi message à conversation:", conversationId);
        // Ici vous pouvez ajouter la logique WebSocket ou API pour envoyer le message
        // Pour l'instant, on utilise la fonction onSendMessage si elle existe
        if (onSendMessage) {
          onSendMessage();
        }
      } else {
        // Envoi de message à l'IA Jarvis
        console.log("Envoi message à Jarvis:", chatText);
        const response = await makeAuthenticatedRequest(
          'https://reseausocial-production.up.railway.app/ai/chat/',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: chatText.trim(),
            }),
          }
        );
        
        if (response.ok) {
          console.log("Message envoyé à Jarvis avec succès");
        } else {
          console.error("Erreur envoi message à Jarvis:", response.status);
        }
      }
      
      // Vider le champ après envoi
      setChatText("");
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={styles.bottomBar}>
        {/* Champ de saisie avec bouton d'envoi */}
        <View style={styles.chatSection}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <TextInput
              style={[styles.chatInput, { flex: 1, marginRight: 8 }]}
              placeholder={
                isChat ? `Message to ${chatRecipient}` : "Ask Jarvis anything"
              }
              placeholderTextColor="rgba(105, 105, 105, 0.8)"
              value={chatText}
              onChangeText={setChatText}
              onSubmitEditing={handleSendMessage}
              multiline
            />
            <TouchableOpacity
              style={{
                backgroundColor: chatText.trim() ? 'rgba(55, 116, 69, 1)' : 'rgba(200, 200, 200, 0.5)',
                borderRadius: 15,
                paddingHorizontal: 12,
                paddingVertical: 8,
                opacity: chatText.trim() ? 1 : 0.6,
              }}
              onPress={handleSendMessage}
              disabled={!chatText.trim()}
            >
              <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Boutons conditionnels */}
        {isChat ? (
          <View style={styles.navBar}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => console.log('Ajouter un fichier')}
            >
              <Text style={styles.navText}>file</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => console.log('Prendre une photo')}
            >
              <Text style={styles.navText}>pic</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => console.log('Message vocal')}
            >
              <Text style={styles.navText}>voc</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.navBar}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => router.push("/(tabs)/conversations")}
            >
              <Text style={styles.navText}>Chats</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => router.push("/(tabs)")}
            >
              <Text style={styles.navText}>Home</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => router.push("/(tabs)/about")}
            >
              <Text style={styles.navText}>Profile</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}