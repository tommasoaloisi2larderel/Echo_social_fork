import { useChat } from "../../contexts/ChatContext";
import BottomBarV2 from "./BottomBarV2";
import { BottomBarProps } from "./types";

export default function BottomBar({
  currentRoute,
  chatText,
  setChatText,
  conversationId,
}: BottomBarProps) {
  const { sendMessage } = useChat();
  // Déterminer si on est dans un contexte de chat
  const isChat = currentRoute?.includes('conversation-direct') || currentRoute?.includes('conversation-group');
  
  // Debug: voir ce qui est passé
  console.log('🔍 BottomBar index - currentRoute:', currentRoute, 'isChat:', isChat, 'conversationId:', conversationId);

  return (
    <BottomBarV2
      onSendMessage={(message) => {
        if (isChat) {

            if (sendMessage) {
            console.log('📤 Envoi message via ChatContext:', message);
            sendMessage(message);
            setChatText(''); // vide le champ après envoi
          } else {
            console.error('❌ sendMessage non disponible dans ChatContext');
          }
          // En mode conversation, le message est géré par le composant parent
          console.log('Message envoyé dans la conversation:', message);
        } else {
          // En mode Jarvis
          console.log('Message envoyé à Jarvis:', message);
        }
      }}
      onAgentSelect={(agent) => {
        // Logique pour sélectionner un agent
        console.log('Agent sélectionné:', agent);
      }}
      conversationId={conversationId}
      isChat={isChat}
      chatText={chatText}
      setChatText={setChatText}
    />
  );
}