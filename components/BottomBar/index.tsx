// components/BottomBar/index.tsx
import { useEffect, useRef } from "react";
import { Animated, Easing, Keyboard, Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChat } from "../../contexts/ChatContext";
import BottomBarV2 from "./BottomBarV2";
import { BottomBarProps } from "./types";

export default function BottomBar({
  currentRoute,
  chatText,
  setChatText,
  conversationId,
  onSummaryPress,
  loadingSummary,
}: BottomBarProps) {
  const { websocket, sendMessage } = useChat();
  const insets = useSafeAreaInsets();
  const isChat = currentRoute?.includes('conversation-direct') || currentRoute?.includes('conversation-group');
  const isTypingRef = useRef(false);

  // Variable animée pour suivre la hauteur du clavier
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  // Gestion manuelle des événements clavier
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (e) => {
      const height = e.endCoordinates.height;
      const adjustedHeight = Math.max(0, height - insets.bottom);
      
      Animated.timing(keyboardHeight, {
        toValue: adjustedHeight,
        duration: Platform.OS === 'ios' ? e.duration : 200,
        easing: Platform.OS === 'ios' ? Easing.out(Easing.ease) : undefined,
        useNativeDriver: false,
      }).start();
    });

    const onHide = Keyboard.addListener(hideEvent, (e) => {
      Animated.timing(keyboardHeight, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e.duration : 200,
        useNativeDriver: false,
      }).start();
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  const handleSendMessage = (message: string) => {
    if (isChat && conversationId) {
      // Arrêter typing avant d'envoyer le message
      if (isTypingRef.current && websocket) {
        websocket.send(JSON.stringify({
          type: 'typing_stop',
          conversation_uuid: conversationId
        }));
        isTypingRef.current = false;
      }

      // 1. Optimistic UI Update (if available)
      if (sendMessage) {
        sendMessage(message.trim());
      }
      
      // 2. Network Send
      // We do NOT send the message here anymore.
      // BottomBarV2 handles the network transmission (WebSocket or REST).
      // We only call sendMessage above to update the local cache instantly.
      
    } else if (!isChat) {
      console.log('Message envoyé à Jarvis:', message);
    }
  };

return (
    <Animated.View 
      style={[
        styles.container, 
        { bottom: keyboardHeight }
      ]}
    >
      <BottomBarV2
        onSendMessage={handleSendMessage}
        onAgentSelect={(agent) => {
          console.log('Agent sélectionné:', agent);
        }}
        conversationId={conversationId}
        isChat={isChat}
        chatText={chatText}
        setChatText={setChatText}
        onSummaryPress={onSummaryPress}
        loadingSummary={loadingSummary}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
  },
});