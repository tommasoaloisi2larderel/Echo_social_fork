import React from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { styles } from "../styles/appStyles";

interface BottomBarProps {
  currentRoute: string;
  chatText: string;
  setChatText: (text: string) => void;
  chatRecipient?: string;
  onSendMessage?: () => void;
}

export default function BottomBar({ 
  currentRoute, 
  chatText, 
  setChatText, 
  chatRecipient = "",
  onSendMessage
}: BottomBarProps) {
  
  const isChat = currentRoute === "conversation-detail";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <View style={styles.bottomBar}>
        {/* Champ de saisie */}
        <View style={styles.chatSection}>
          <TextInput
            style={styles.chatInput}
            placeholder={
              isChat ? `Message to ${chatRecipient}` : "Ask Jarvis anything"
            }
            placeholderTextColor="rgba(105, 105, 105, 0.8)"
            value={chatText}
            onChangeText={setChatText}
            onSubmitEditing={onSendMessage}
          />
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