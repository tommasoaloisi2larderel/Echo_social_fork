import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
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
  // hauteur de l'espace panneau (90% de l'écran)
  const MAX_TRANSLATE = screenHeight * 0.75; // hauteur du panneau

  // translateY du panneau: 0 = ouvert, MAX_TRANSLATE = fermé (caché sous la barre)
  const sheetY = useRef(new Animated.Value(MAX_TRANSLATE)).current;
  const isPanelOpen = useRef(false);
  const dragStartY = useRef(0);

  const [barHeight, setBarHeight] = useState(96); // default, will be measured
  
  // Debug: vérifier que isChat fonctionne
  console.log("BottomBar - currentRoute:", currentRoute, "isChat:", isChat);
  
  // PanResponder pour gérer le swipe
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        // @ts-ignore
        dragStartY.current = (sheetY as any)._value ?? MAX_TRANSLATE;
      },
      onPanResponderMove: (_, g) => {
        const next = dragStartY.current + g.dy; // dy>0 vers le bas
        const clamped = Math.max(0, Math.min(MAX_TRANSLATE, next));
        sheetY.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        // @ts-ignore
        const current = (sheetY as any)._value ?? MAX_TRANSLATE;
        const shouldOpen = current < MAX_TRANSLATE / 2 || g.vy < -0.5;
        if (shouldOpen) openPanel(); else closePanel();
      },
    })
  ).current;

  // Fonctions pour ouvrir/fermer le panneau
  const openPanel = () => {
    isPanelOpen.current = true;
    Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
  };
  const closePanel = () => {
    isPanelOpen.current = false;
    Animated.spring(sheetY, { toValue: MAX_TRANSLATE, useNativeDriver: true, tension: 60, friction: 10 }).start();
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
      <View
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 999 }}
      >

        {/* Panneau coulissant pour la gestion des agents IA - en dessous de la barre */}
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: MAX_TRANSLATE,
            backgroundColor: 'white',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 10,
            transform: [{ translateY: sheetY }],
          }}
        >
          {/* BottomBar - toujours visible en haut du conteneur (fait aussi office de header) */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <View style={styles.bottomBar} onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
        {/* Indicateur de swipe (zone de saisie du geste) */}
        <View {...panResponder.panHandlers}>
          <View style={{
            width: 44,
            height: 6,
            backgroundColor: 'rgba(200, 200, 200, 0.65)',
            borderRadius: 3,
            alignSelf: 'center',
            marginBottom: 6,
            marginTop: 6,
          }} />
        </View>
        
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
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="arrow.up.circle.fill"
                  size={20}
                  tintColor="white"
                  type="hierarchical"
                />
              ) : (
                <Ionicons name="send" size={18} color="white" />
              )}
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
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="doc.fill"
                  size={24}
                  tintColor="rgba(240, 240, 240, 0.8)"
                  type="hierarchical"
                />
              ) : (
                <Ionicons name="document" size={22} color="rgba(240, 240, 240, 0.8)" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => console.log('Prendre une photo')}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="camera.fill"
                  size={24}
                  tintColor="rgba(240, 240, 240, 0.8)"
                  type="hierarchical"
                />
              ) : (
                <Ionicons name="camera" size={22} color="rgba(240, 240, 240, 0.8)" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => console.log('Message vocal')}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="mic.fill"
                  size={24}
                  tintColor="rgba(240, 240, 240, 0.8)"
                  type="hierarchical"
                />
              ) : (
                <Ionicons name="mic" size={22} color="rgba(240, 240, 240, 0.8)" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.navBar}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => router.push("/(tabs)/conversations")}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="bubble.left.and.bubble.right.fill"
                  size={24}
                  tintColor="rgba(240, 240, 240, 0.8)"
                  type="hierarchical"
                />
              ) : (
                <Ionicons name="chatbubbles" size={22} color="rgba(240, 240, 240, 0.8)" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => router.push("/(tabs)")}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="house.fill"
                  size={24}
                  tintColor="rgba(240, 240, 240, 0.8)"
                  type="hierarchical"
                />
              ) : (
                <Ionicons name="home" size={22} color="rgba(240, 240, 240, 0.8)" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={() => router.push("/(tabs)/about")}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name="person.circle.fill"
                  size={24}
                  tintColor="rgba(240, 240, 240, 0.8)"
                  type="hierarchical"
                />
              ) : (
                <Ionicons name="person-circle" size={22} color="rgba(240, 240, 240, 0.8)" />
              )}
            </TouchableOpacity>
          </View>
        )}
          </View>
        </KeyboardAvoidingView>

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
        </Animated.View>
      </View>
    </>
  );
}