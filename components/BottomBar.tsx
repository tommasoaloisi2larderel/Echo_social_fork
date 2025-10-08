import { router } from "expo-router";
import { useRef } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  PanResponder,
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
  
  // Dimensions de l'écran
  const screenHeight = Dimensions.get('window').height;
  
  // Animation pour le panneau coulissant
  const panelHeight = useRef(new Animated.Value(0)).current;
  const isPanelOpen = useRef(false);
  
  // Debug: vérifier que isChat fonctionne
  console.log("BottomBar - currentRoute:", currentRoute, "isChat:", isChat);
  
  // PanResponder pour gérer le swipe
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Activer seulement pour les mouvements verticaux significatifs
        return Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (isPanelOpen.current) {
          // Si le panneau est ouvert, permettre de le fermer en swipant vers le bas
          if (gestureState.dy > 0) {
            const currentHeight = screenHeight * 0.7;
            const newHeight = Math.max(0, currentHeight - gestureState.dy);
            panelHeight.setValue(newHeight);
          }
        } else {
          // Si le panneau est fermé, permettre de l'ouvrir en swipant vers le haut
          if (gestureState.dy < 0) {
            const newHeight = Math.min(Math.abs(gestureState.dy), screenHeight * 0.7);
            panelHeight.setValue(newHeight);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isPanelOpen.current) {
          // Si le panneau est ouvert et qu'on swipe vers le bas assez loin, fermer
          if (gestureState.dy > 100) {
            closePanel();
          } else {
            openPanel(); // Retourner à la position ouverte
          }
        } else {
          // Si le panneau est fermé et qu'on swipe vers le haut assez loin, ouvrir
          if (Math.abs(gestureState.dy) > 100 && gestureState.dy < 0) {
            openPanel();
          } else {
            closePanel(); // Retourner à la position fermée
          }
        }
      },
    })
  ).current;

  // Fonctions pour ouvrir/fermer le panneau
  const openPanel = () => {
    isPanelOpen.current = true;
    Animated.spring(panelHeight, {
      toValue: screenHeight * 0.7,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  };

  const closePanel = () => {
    isPanelOpen.current = false;
    Animated.spring(panelHeight, {
      toValue: 0,
      useNativeDriver: false,
      tension: 50,
      friction: 8,
    }).start();
  };

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
    <>
      {/* Conteneur animé qui contient à la fois le panneau et la BottomBar */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: panelHeight.interpolate({
            inputRange: [0, screenHeight * 0.7],
            outputRange: [0, screenHeight * 0.7],
          }),
          left: 0,
          right: 0,
          zIndex: 999,
        }}
      >
        {/* Panneau coulissant pour la gestion des agents IA - au dessus de la barre */}
        <View
          style={{
            height: screenHeight * 0.7,
            backgroundColor: 'white',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 10,
          }}
        >
          {/* Header du panneau avec poignée */}
          <View style={{ padding: 20, borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
            <View style={{
              width: 40,
              height: 4,
              backgroundColor: '#ccc',
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 15,
            }} />
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333', textAlign: 'center' }}>
              Gestion des Agents IA
            </Text>
          </View>
          
          {/* Contenu du panneau */}
          <View style={{ flex: 1, padding: 20 }}>
            <Text style={{ fontSize: 16, color: '#666', marginBottom: 20 }}>
              Configurez vos agents IA pour personnaliser leurs comportements et interactions.
            </Text>
            
            {/* Liste des agents IA (à implémenter) */}
            <View style={{ 
              backgroundColor: '#f5f5f5', 
              padding: 15, 
              borderRadius: 10,
              marginBottom: 15,
            }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>Agent Jarvis</Text>
              <Text style={{ fontSize: 14, color: '#666', marginTop: 5 }}>
                Assistant personnel intelligent
              </Text>
            </View>
          </View>
        </View>

        {/* BottomBar - toujours visible en bas du conteneur */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View style={styles.bottomBar} {...panResponder.panHandlers}>
        {/* Indicateur de swipe */}
        <View style={{
          width: 40,
          height: 4,
          backgroundColor: 'rgba(200, 200, 200, 0.6)',
          borderRadius: 2,
          alignSelf: 'center',
          marginBottom: 8,
          marginTop: 5,
        }} />
        
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
      </Animated.View>
    </>
  );
}