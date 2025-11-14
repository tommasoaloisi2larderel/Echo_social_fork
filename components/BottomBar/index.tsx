// components/BottomBar/index.tsx
import { useEffect, useRef } from "react";
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
  const isChat = currentRoute?.includes('conversation-direct') || currentRoute?.includes('conversation-group');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  console.log('🔍 BottomBar index - currentRoute:', currentRoute, 'isChat:', isChat, 'conversationId:', conversationId, 'sendMessage:', !!sendMessage);

  // ✅ Gérer l'envoi de typing_start / typing_stop
  useEffect(() => {
    console.log('⌨️ useEffect typing - chatText:', chatText, 'isChat:', isChat, 'websocket:', !!websocket, 'conversationId:', conversationId);
    
    if (!isChat || !websocket || !conversationId) return;

    if (chatText.trim()) {
      // L'utilisateur tape → envoyer typing_start
      if (!isTypingRef.current) {
        console.log('📤 Envoi typing_start');
        websocket.send(JSON.stringify({
          type: 'typing_start',
          conversation_uuid: conversationId
        }));
        isTypingRef.current = true;
      }

      // Réinitialiser le timer d'inactivité
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Envoyer typing_stop après 2 secondes d'inactivité
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          console.log('📤 Envoi typing_stop (timeout)');
          websocket.send(JSON.stringify({
            type: 'typing_stop',
            conversation_uuid: conversationId
          }));
          isTypingRef.current = false;
        }
      }, 2000);
    } else {
      // Champ vide → arrêter typing immédiatement
      if (isTypingRef.current) {
        console.log('📤 Envoi typing_stop (champ vide)');
        websocket.send(JSON.stringify({
          type: 'typing_stop',
          conversation_uuid: conversationId
        }));
        isTypingRef.current = false;
      }
    }

    // Cleanup
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [chatText, isChat, websocket, conversationId]);

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
  );
}