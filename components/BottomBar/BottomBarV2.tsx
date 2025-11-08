import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAgents } from '../../contexts/AgentsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import JarvisResponseModal from '../FIlesLecture/JarvisResponseModal';
import JarvisSplitButton from '../JarvisInteraction/Jarvissplitbutton';
import JarvisTextInput from '../JarvisInteraction/Jarvistextinput';
import VoiceJarvisHandler from '../JarvisInteraction/Voicejarvishandler';
import AgentPanel from './AgentPanel';
import AttachmentButton from './Attachmentbutton';
import ChatInputBar from './ChatInputBar';
import JarvisChatBar from './JarvisChatBar';
import VoiceButtonFloating from './VoiceButtonFloating';
import VoiceRecorder from './VoiceRecorder';

interface Agent {
  uuid: string;
  name: string;
  description?: string;
  agent_type: 'simple' | 'conditional' | 'action';
  is_active: boolean;
  conversation_count?: number;
  created_at: string;
  created_by_username: string;
  instructions?: {
    system_prompt?: string;
    language?: string;
    formality_level?: string;
    max_response_length?: number;
  };
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_HEIGHT = 60; // Hauteur minimale de la barre (plus fine)
const MAX_HEIGHT = SCREEN_HEIGHT * 0.95; // Hauteur maximale (85% de l'écran)

interface BottomBarV2Props {
  onSendMessage?: (message: string) => void;
  onAgentSelect?: (agent: any) => void;
  conversationId?: string;
  isChat?: boolean;
  chatText?: string;
  setChatText?: (text: string) => void;
}

const BottomBarV2: React.FC<BottomBarV2Props> = ({
  onSendMessage,
  onAgentSelect,
  conversationId,
  isChat = false,
  chatText = '',
  setChatText,
}) => {
  const insets = useSafeAreaInsets();
  const { makeAuthenticatedRequest } = useAuth();
  const { createAgent, updateAgent, addAgentToConversation, myAgents, conversationAgents, fetchConversationAgents, removeAgentFromConversation } = useAgents();
  
  // Debug: afficher les props reçues
  console.log('BottomBarV2 - isChat:', isChat, 'conversationId:', conversationId);
  
  const [isJarvisActive, setIsJarvisActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // Suivre si la barre est étendue

  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceTranscription, setVoiceTranscription] = useState<string | null>(null);
  const [voiceResponse, setVoiceResponse] = useState<string | null>(null);
  const [isTextInputActive, setIsTextInputActive] = useState(false);
  const [lastJarvisMessage, setLastJarvisMessage] = useState<string | null>(null);
  const [lastJarvisResponse, setLastJarvisResponse] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalIcon, setModalIcon] = useState<keyof typeof Ionicons.glyphMap>('chatbubble-ellipses');


  // Hauteur de la barre (animée)
  const barHeight = useRef(new Animated.Value(MIN_HEIGHT)).current;
  
  // Ref pour le PanGestureHandler du panneau d'agents
  const panelGestureRef = useRef(null);
  const glowOpacity = useRef(new Animated.Value(1)).current;
  const glowScale = useRef(new Animated.Value(1)).current;

  // ========== GESTION DU VOCAL ==========


  const {
    isRecording,
    recordedUri,
    recordingSeconds,
    isPaused,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecorded,
    sendRecorded,
  } = VoiceRecorder({ 
    onSendRecorded: async (uri: string) => {
      // Upload et envoi
      const uuid = await uploadVoiceAttachment(uri);
      if (uuid) {
        await handleSendVoice(uuid);
      }
    }
  });
  
  const { websocket } = useChat();

    
  const uploadVoiceAttachment = async (uri: string) => {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: `voice_${Date.now()}.mp3`,
        type: 'audio/mpeg',
      } as any);

      // ✅ Utiliser makeAuthenticatedRequest
      // Il ajoute automatiquement Authorization: Bearer {token}
      const response = await makeAuthenticatedRequest(
        'https://reseausocial-production.up.railway.app/messaging/attachments/upload/',
        {
          method: 'POST',
          body: formData,
          // ❌ NE PAS mettre de header Content-Type
          // FormData gère automatiquement le multipart/form-data avec boundary
        }
      );

      // Vérifier si la réponse est OK
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', response.status, errorText);
        Alert.alert('Erreur', `Upload échoué: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (data?.uuid) {
        console.log('✅ Voice file uploaded:', data.uuid);
        return data.uuid;
      }
      return null;
    } catch (e) {
      console.error('uploadVoiceAttachment error', e);
      Alert.alert('Erreur', "Impossible d'uploader le fichier vocal");
      return null;
    }
  };
  const handleSendVoice = async (attachementUuid: string) => {
    if (!conversationId) {
      console.warn('No conversationId for voice message');
      return;
    }
    
    try {

      // Envoyer via WebSocket
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        const payload = {
          type: 'chat_message',
          conversation_uuid: conversationId,
          message: '🎤 Message vocal',
          attachment_uuids: [attachementUuid],
        };
        websocket.send(JSON.stringify(payload));
      } else {
        // Fallback : envoyer via API REST
        await makeAuthenticatedRequest(
          `https://reseausocial-production.up.railway.app/messaging/conversations/${conversationId}/messages/create-with-attachments/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: '🎤 Message vocal',
              attachment_uuids: [attachementUuid],
            }),
          }
        );
      }
      
      console.log('✅ Voice message sent');
    } catch (e) {
      console.error('handleSendVoice error', e);
      Alert.alert('Erreur', "Impossible d'envoyer le message vocal");
    }
  };



  const handleJarvisActivation = () => {
    setIsJarvisActive(true);
  };

  const handleJarvisDeactivation = () => {
    setIsJarvisActive(false);
  };

  const handleTextInputActivate = () => {
    console.log('📝 Activation de l\'input texte Jarvis');
    setIsTextInputActive(true);
  };


  const handleTextInputComplete = (message: string, response: string) => {
    console.log('✅ Message texte envoyé:', message);
    console.log('✅ Réponse Jarvis:', response);
    
    setLastJarvisMessage(message);
    setLastJarvisResponse(response);
      // Afficher le modal personnalisé
    setModalTitle('💬 Jarvis répond');
    setModalMessage(response);
    setModalIcon('chatbubble-ellipses');
    setModalVisible(true);

  };

  const handleTextInputQuit = () => {
    console.log('❌ Fermeture de l\'input texte');
    setIsTextInputActive(false);
    setLastJarvisMessage(null);
    setLastJarvisResponse(null);
  };


  const handleVoiceStart = () => {
  console.log('🎤 Démarrage de l\'enregistrement vocal');
  setIsVoiceRecording(true);
};

const handleVoiceComplete = (transcription: string, response: string) => {
  console.log('✅ Vocal terminé - Transcription:', transcription);
  console.log('✅ Réponse Jarvis:', response);
  
  setVoiceTranscription(transcription);
  setVoiceResponse(response);
  setIsVoiceRecording(false);
  
  // Afficher le modal personnalisé
  setModalTitle('🎤 Message vocal traité');
  setModalMessage(`Vous avez dit : "${transcription}"\n\nJarvis répond : "${response}"`);
  setModalIcon('mic');
  setModalVisible(true);

};

const handleVoiceCancel = () => {
  console.log('❌ Enregistrement vocal annulé');
  setIsVoiceRecording(false);
  setVoiceTranscription(null);
  setVoiceResponse(null);
};

  const handleSendMessage = (message: string) => {
    onSendMessage?.(message);
  };

  const handleChatSend = () => {
    if (chatText.trim() && onSendMessage) {
      onSendMessage(chatText);
      setChatText?.('');
    }
  };

  const handleRemoveAgent = async (agentUuid: string) => {
    if (!conversationId) return;
    try {
      await removeAgentFromConversation(conversationId, agentUuid, makeAuthenticatedRequest);
      Alert.alert('Succès', 'Agent retiré de la conversation');
    } catch (error) {
      console.error('Error removing agent:', error);
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Une erreur est survenue');
    }
  };

  const handleAddAgent = async (agentUuid: string) => {
    if (!conversationId) return;
    try {
      await addAgentToConversation(conversationId, agentUuid, makeAuthenticatedRequest);
      Alert.alert('Succès', 'Agent ajouté à la conversation');
    } catch (error) {
      console.error('Error adding agent:', error);
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Une erreur est survenue');
    }
  };

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationY, velocityY } = event.nativeEvent;

      // Si on swipe vers le haut (translationY négatif)
      if (translationY < -50 || velocityY < -500) {
        // Ouvrir la barre
        setIsExpanded(true);
        Animated.spring(barHeight, {
          toValue: MAX_HEIGHT,
          useNativeDriver: false,
          tension: 40,
          friction: 9,
        }).start();
      }
      // On ne ferme plus automatiquement en swipant vers le bas
      // La fermeture se fait uniquement via le PanGestureHandler du panneau d'agents
    }
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: new Animated.Value(0) } }],
    { 
      useNativeDriver: false,
      listener: (event: any) => {
        const { translationY } = event.nativeEvent;
        // Calculer la nouvelle hauteur basée sur le geste
        const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, MIN_HEIGHT - translationY));
        barHeight.setValue(newHeight);
      }
    }
  );

  // Gestionnaire pour fermer le panneau en tirant vers le bas depuis le haut
  const onPanelGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: new Animated.Value(0) } }],
    { 
      useNativeDriver: false,
      listener: (event: any) => {
        const { translationY } = event.nativeEvent;
        // Calculer la nouvelle hauteur basée sur le geste (descendre = translationY positif)
        // On part de MAX_HEIGHT et on soustrait le translationY
        const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, MAX_HEIGHT - translationY));
        barHeight.setValue(newHeight);
      }
    }
  );

  const onPanelHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationY, velocityY } = event.nativeEvent;

      // Si on tire vers le bas (translationY positif) depuis le haut du panneau
      if (translationY > 100 || velocityY > 500) {
        // Fermer la barre
        setIsExpanded(false);
        Animated.spring(barHeight, {
          toValue: MIN_HEIGHT,
          useNativeDriver: false,
          tension: 40,
          friction: 9,
        }).start();
      } else {
        // Revenir à la hauteur maximale si le geste n'est pas suffisant
        Animated.spring(barHeight, {
          toValue: MAX_HEIGHT,
          useNativeDriver: false,
          tension: 40,
          friction: 9,
        }).start();
      }
    }
  };

  // Interpolations pour des transitions fluides
  const leftMargin = barHeight.interpolate({
    inputRange: [MIN_HEIGHT, MAX_HEIGHT],
    outputRange: [30, 0], // Plus de distance aux bords quand repliée (30px au lieu de 10px)
    extrapolate: 'clamp',
  });

  const rightMargin = barHeight.interpolate({
    inputRange: [MIN_HEIGHT, MAX_HEIGHT],
    outputRange: [30, 0], // Plus de distance aux bords quand repliée (30px au lieu de 10px)
    extrapolate: 'clamp',
  });

  const bottomMarginValue = barHeight.interpolate({
    inputRange: [MIN_HEIGHT, MAX_HEIGHT],
    outputRange: [2 + insets.bottom, 0],
    extrapolate: 'clamp',
  });

  const borderRadiusValue = barHeight.interpolate({
    inputRange: [MIN_HEIGHT, MAX_HEIGHT],
    outputRange: [40, 0],
    extrapolate: 'clamp',
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={-10}
      style={styles.keyboardAvoidingView}
    >
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        enabled={!isJarvisActive && !isExpanded && !isRecording && !isVoiceRecording && !isTextInputActive} // Désactiver le swipe quand Jarvis est actif OU quand la barre est étendue
      >
        <Animated.View
          style={[
            styles.container,
            {
              height: barHeight,
              left: leftMargin,
              right: rightMargin,
              marginBottom: bottomMarginValue,
              borderRadius: borderRadiusValue,
              backgroundColor: "rgba(10, 145, 104, 0.7)", // Couleur de fond du panneau
              opacity: isRecording ? 0 : 1,

            },
          ]}
        >
        {/* Bottom bar section - toujours visible en bas */}
        <View style={styles.bottomBarSection}>
          {(() => {
            console.log('🎯 Rendering bottom bar - isChat:', isChat, 'isJarvisActive:', isJarvisActive);
            
            if (isChat) {
              console.log('  ✅ Rendering ChatInputBar');
              return (
                <ChatInputBar
                  chatText={chatText}
                  onChangeText={(text) => setChatText?.(text)}
                  onSendMessage={handleChatSend}
                />
              );
            } else if (isJarvisActive) {
              console.log('  ✅ Rendering JarvisChatBar');
              return (
                <JarvisChatBar
                  onSendMessage={handleSendMessage}
                  onQuit={handleJarvisDeactivation}
                />
              );
              } else if (isVoiceRecording) {
                console.log('  ✅ Rendering VoiceJarvisHandler');
                return (
                  <VoiceJarvisHandler 
                    onComplete={handleVoiceComplete}
                    onCancel={handleVoiceCancel}
                  />
                );
              } else if (isTextInputActive) {
                console.log('  ✅ Rendering JarvisTextInput');
                return (
                  <JarvisTextInput 
                    onComplete={handleTextInputComplete}
                    onQuit={handleTextInputQuit}
                  />
                );
              } else {
                console.log('  ✅ Rendering JarvisSplitButton');
                return (
                  <JarvisSplitButton 
                    onTextActivate={handleTextInputActivate}
                    onVoiceActivate={handleVoiceStart}
                  />
                );
              }
          })()}
        </View>

        {/* Zone extensible - Panneau des agents */}
        <View style={styles.expandableArea}>
          {/* Poignée de fermeture - uniquement visible quand la barre est dépliée - FIXE en haut */}
          {isExpanded && (
            <PanGestureHandler
              ref={panelGestureRef}
              onGestureEvent={onPanelGestureEvent}
              onHandlerStateChange={onPanelHandlerStateChange}
              enabled={isExpanded}
            >
              <Animated.View style={styles.panelGestureArea}>
                <View style={styles.dragHandle} />
              </Animated.View>
            </PanGestureHandler>
          )}
          
          {/* Contenu scrollable du panneau */}
          <ScrollView 
            style={styles.scrollableContent}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={isExpanded}
          >
            {/* Agent Panel Component - replaces all the agent UI */}
            { (
              <AgentPanel
                conversationAgents={conversationAgents}
                loadingConversationAgents={false}
                myAgents={myAgents}
                conversationId={conversationId}
                isChat={isChat}
                handleRemoveAgent={handleRemoveAgent}
                handleAddAgent={handleAddAgent}
                glowOpacity={glowOpacity}
                glowScale={glowScale}
                backgroundColor="rgba(249, 250, 251, 1)" 
              />
              
            )}
          </ScrollView>
        </View>

        {/* Bouton vocal flottant */}
        {isChat && conversationId && !isJarvisActive && (
          <VoiceButtonFloating 
            isRecording={isRecording}
            recordedUri={recordedUri}
            recordingSeconds={recordingSeconds}
            isPaused={isPaused}
            startRecording={startRecording}
            stopRecording={stopRecording}
            pauseRecording={pauseRecording}
            resumeRecording={resumeRecording}
            cancelRecorded={cancelRecorded}
            sendRecorded={sendRecorded}
            disabled={isExpanded}
          />        
        )}
        
        {isChat && conversationId && !isJarvisActive && (
          <AttachmentButton 
            conversationId={conversationId as string}
            onAttachmentSent={() => {
              console.log('Pièce jointe envoyée !');
              // Optionnel : rafraîchir la liste des messages
            }}
          />
        )}
        </Animated.View>
      </PanGestureHandler>
      
      <JarvisResponseModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={modalTitle}
        message={modalMessage}
        icon={modalIcon}
      />
    </KeyboardAvoidingView>
  );
};
const styles = StyleSheet.create({
  keyboardAvoidingView: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    // Le KeyboardAvoidingView ne gère que le positionnement vertical (clavier)
    // Le positionnement horizontal est géré par l'Animated.View enfant
  },
  container: {
    position: 'absolute',
    bottom: 0,
    zIndex: 9998,
    // left et right sont gérés dynamiquement par leftMargin et rightMargin
    flexDirection: 'column-reverse', // Inverser l'ordre : bottom bar en bas visuellement mais en haut dans le DOM
    justifyContent: 'flex-start',
    shadowColor: "rgba(10, 145, 104, 0.7)",
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
  },
  bottomBarSection: {
    width: '100%',
    zIndex: 10, // Au-dessus du panneau d'agents
  },
  panelGestureArea: {
    width: '100%',
    paddingTop: 16,
    paddingBottom: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
    marginBottom: 8,
  },
  dragHandle: {
    width: 50,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(10, 145, 104, 0.4)',
  },
  expandableArea: {
    flex: 1,
    width: '100%',
    flexDirection: 'column',
  },
  scrollableContent: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    // Pas de paddingTop car la poignée gère son propre padding
  },
  
  // Active agents section
  activeAgentsSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a202c',
  },
  createButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: 'rgba(10, 145, 104, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(10, 145, 104, 0.1)',
  },
  createButtonText: {
    color: 'rgba(10, 145, 104, 1)',
    fontWeight: '600',
    fontSize: 14,
  },
  
  // Empty state
  emptyState: {
    padding: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 4,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(10, 145, 104, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: 'rgba(10, 145, 104, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 16,
    color: '#4a5568',
    marginBottom: 8,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Agent cards (horizontal scroll)
  horizontalScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  agentCardsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  agentCard: {
    width: 160,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 20,
    shadowColor: 'rgba(10, 145, 104, 0.2)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  agentCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(10, 145, 104, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    alignSelf: 'center',
    shadowColor: 'rgba(10, 145, 104, 0.3)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  agentCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a202c',
    textAlign: 'center',
    marginBottom: 6,
  },
  agentCardDesc: {
    fontSize: 12,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 16,
  },
  agentCardBadge: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(10, 145, 104, 0.08)',
    borderRadius: 12,
    alignSelf: 'center',
    shadowColor: 'rgba(10, 145, 104, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  agentCardBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(10, 145, 104, 1)',
    textAlign: 'center',
  },
  
  // My agents section
  myAgentsSection: {
    marginTop: 20,
  },
  myAgentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    shadowColor: 'rgba(10, 145, 104, 0.2)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  agentCount: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
  },
  chevronCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(10, 145, 104, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  
  // Create agent button
  createAgentButton: {
    marginBottom: 16,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(10, 145, 104, 0.2)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  createAgentIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: 'rgba(10, 145, 104, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  createAgentText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(10, 145, 104, 1)',
  },
  
  // Empty agents list
  emptyAgentsList: {
    padding: 32,
    backgroundColor: 'rgba(10, 145, 104, 0.03)',
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(10, 145, 104, 0.1)',
    borderStyle: 'dashed',
  },
  emptyAgentsIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(10, 145, 104, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyAgentsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  emptyAgentsSubtitle: {
    fontSize: 13,
    color: '#95a5a6',
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Agent item
  agentItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    shadowColor: 'rgba(10, 145, 104, 0.3)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
    marginBottom: 16,
  },
  agentItemHeader: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  agentItemHeaderExpanded: {
    backgroundColor: 'rgba(10, 145, 104, 0.03)',
  },
  agentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  agentItemIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  agentItemInfo: {
    flex: 1,
  },
  agentItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  agentItemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2c3e50',
    flex: 1,
  },
  inConversationBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
    shadowColor: 'rgba(59, 130, 246, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  inConversationText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(59, 130, 246, 1)',
    letterSpacing: 0.5,
  },
  agentItemDesc: {
    fontSize: 13,
    color: '#7f8c8d',
    marginBottom: 6,
    lineHeight: 18,
  },
  agentItemStats: {
    flexDirection: 'row',
    gap: 16,
  },
  agentStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agentStatText: {
    fontSize: 11,
    color: '#95a5a6',
    marginLeft: 4,
  },
  agentItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addRemoveButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(10, 145, 104, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  
  // Agent form
  agentForm: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(10, 145, 104, 0.1)',
  },
  formContent: {
    padding: 16,
  },
  formField: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: 'rgba(10, 145, 104, 0.2)',
  },
  textInputMultiline: {
    minHeight: 60,
  },
  textInputLarge: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formHelper: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    borderColor: 'rgba(10, 145, 104, 0.5)',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#666',
  },
  typeButtonTextActive: {
    fontWeight: '600',
    color: 'rgba(10, 145, 104, 1)',
  },
  formalitySelector: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  formalityButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  formalityButtonActive: {
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    borderColor: 'rgba(10, 145, 104, 0.5)',
  },
  formalityButtonText: {
    fontSize: 13,
    fontWeight: '400',
    color: '#666',
  },
  formalityButtonTextActive: {
    fontWeight: '600',
    color: 'rgba(10, 145, 104, 1)',
  },
  formFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(10, 145, 104, 0.1)',
    backgroundColor: 'white',
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  
  // New agent card
  newAgentCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    shadowColor: 'rgba(10, 145, 104, 0.3)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'hidden',
    marginTop: 16,
  },
  newAgentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'rgba(10, 145, 104, 0.03)',
  },
  newAgentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(10, 145, 104, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  newAgentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  newAgentSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(255, 59, 48, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
});

export default BottomBarV2;
