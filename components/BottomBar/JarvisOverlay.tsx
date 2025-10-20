import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import { useRef } from "react";
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { styles } from "../../styles/appStyles";
import { JarvisMessage } from "./types";

interface JarvisOverlayProps {
  jarvisActive: boolean;
  setJarvisActive: (active: boolean) => void;
  jarvisMessages: JarvisMessage[];
  deleteJarvisHistory: () => Promise<void>;
  barHeight: number;
  jarvisKeyboardHeight: number;
  insets: { top: number; bottom: number; left: number; right: number };
}

export default function JarvisOverlay({
  jarvisActive,
  setJarvisActive,
  jarvisMessages,
  deleteJarvisHistory,
  barHeight,
  jarvisKeyboardHeight,
  insets
}: JarvisOverlayProps) {
  const jarvisScrollRef = useRef<ScrollView>(null);

  if (!jarvisActive) return null;

  return (
    <>
      {/* Darkened background overlay */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9000 }}
        pointerEvents="auto"
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            setJarvisActive(false);
            Keyboard.dismiss();
          }}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
        />
      </View>

      {/* Jarvis content with keyboard avoidance */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={insets.top}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: barHeight,
          zIndex: 9500
        }}
        pointerEvents="box-none"
      >
        {/* Top header bar */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 6,
            left: 0,
            right: 0,
            height: 56,
            paddingHorizontal: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Text style={{ fontWeight: '700', color: 'white', fontSize: 16 }}>Jarvis</Text>
          <TouchableOpacity
            onPress={async () => {
              Alert.alert(
                "Clear History",
                "Are you sure you want to clear your conversation with Jarvis?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Clear",
                    style: "destructive",
                    onPress: deleteJarvisHistory
                  }
                ]
              );
            }}
          >
            {Platform.OS === 'ios' ? (
              <SymbolView name="trash.fill" size={20} tintColor="#ff6b6b" type="hierarchical" />
            ) : (
              <Ionicons name="trash" size={20} color="#ff6b6b" />
            )}
          </TouchableOpacity>
        </View>

        {/* Scrollable messages */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + 70,
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 14
          }}
          pointerEvents="box-none"
        >
          <ScrollView
            ref={jarvisScrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: barHeight + jarvisKeyboardHeight + 12
            }}
          >
            {jarvisMessages.map((m) => (
              <View
                key={m.id}
                style={{
                  marginVertical: 6,
                  alignItems: m.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <View
                  style={[
                    styles.messageBubble,
                    m.role === 'user' ? styles.myMessage : styles.theirMessage,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      m.role === 'user' ? styles.myMessageText : styles.theirMessageText
                    ]}
                  >
                    {m.content}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}