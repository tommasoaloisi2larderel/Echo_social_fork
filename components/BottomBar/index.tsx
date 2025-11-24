// components/BottomBar/index.tsx
import { useEffect, useRef } from "react";
import { Animated, Easing, Keyboard, Platform, StyleSheet } from "react-native"; // ✅ Imports mis à jour
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
  // 2. Récupérez les insets
  const insets = useSafeAreaInsets();
  const isChat = currentRoute?.includes('conversation-direct') || currentRoute?.includes('conversation-group');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // ✅ Variable animée pour suivre la hauteur du clavier
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  // ✅ Gestion manuelle des événements clavier
  useEffect(() => {
    // iOS utilise 'WillShow' pour une animation fluide synchronisée
    // Android utilise 'DidShow', mais on peut essayer de lisser l'animation
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, (e) => {
      // Sur Android, on retire parfois la hauteur de la barre de navigation si nécessaire, 
      // mais généralement e.endCoordinates.height est correct.
      const height = e.endCoordinates.height;
      // 3. CALCUL DE L'AJUSTEMENT
      // On soustrait insets.bottom car votre barre a déjà un padding/margin en bas
      // On s'assure de ne pas descendre sous 0
      const adjustedHeight = Math.max(0, height - insets.bottom);
      
      Animated.timing(keyboardHeight, {
        toValue: adjustedHeight, // Utilisez la hauteur ajustée ici
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
    console.log('🔍 handleSendMessage called:', {
      isChat,
      hasWebsocket: !!websocket,
      hasSendMessage: !!sendMessage,

      websocketState: websocket?.readyState,

      conversationId,

      currentRoute

    });

 

    if (isChat && conversationId) {

      // ✅ Arrêter typing avant d'envoyer le message

      if (isTypingRef.current && websocket) {

        console.log('📤 Envoi typing_stop (avant envoi message)');

        websocket.send(JSON.stringify({

          type: 'typing_stop',

          conversation_uuid: conversationId

        }));

        isTypingRef.current = false;

      }

 

      // Use the sendMessage handler from context if available

      // This handler has optimistic UI updates built in

      if (sendMessage) {

        console.log('✅ Envoi du message via sendMessage handler');

        sendMessage(message.trim());

        return;

      }

 

      // Fallback to direct WebSocket if sendMessage handler not available

      if (websocket && websocket.readyState === WebSocket.OPEN) {

        console.log('✅ Envoi du message via WebSocket direct (fallback)');

        const payload = {

          type: 'chat_message',

          conversation_uuid: conversationId,

          message: message.trim()

        };

        websocket.send(JSON.stringify(payload));

        return;

      }

 

      // ❌ Neither method available

      console.error('❌ Cannot send message - no send method available:', {

        hasSendMessage: !!sendMessage,

        hasWebsocket: !!websocket,

        websocketState: websocket?.readyState,

      });

    } else if (!isChat) {

      console.log('Message envoyé à Jarvis:', message);

    } else {

      console.error('❌ Cannot send message - missing conversationId');
    }
  };

return (
    // ✅ On utilise Animated.View qui se soulève quand le clavier apparaît
    <Animated.View 
      style={[
        styles.container, 
        { bottom: keyboardHeight } // L'animation se fait ici
      ]}
    >
      <BottomBarV2
        onSendMessage={handleSendMessage} // Assurez-vous d'avoir gardé votre fonction handleSendMessage
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
    // bottom est géré dynamiquement par le style inline, 
    // mais commence implicitement à 0 via l'Animated.Value
    zIndex: 9999,
  },
});