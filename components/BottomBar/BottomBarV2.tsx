import { fetchWithAuth } from "@/services/apiClient";
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAgents } from '../../contexts/AgentsContext';
import { useChat } from '../../contexts/ChatContext';
import JarvisResponseModal from '../FIlesLecture/JarvisResponseModal';
import JarvisSplitButton from '../JarvisInteraction/Jarvissplitbutton';
import JarvisTextInput from '../JarvisInteraction/Jarvistextinput';
import VoiceJarvisHandler from '../JarvisInteraction/Voicejarvishandler';
import AgentPanel from './AgentPanel';
import AttachmentButtonInline from './AttachmentButtonInline';
import ComposingMessageBubble from './ComposingMessageBubble';
import JarvisChatBar from './JarvisChatBar';
import StagedContentPreview from './StagedContentPreview';
import SummaryButton from './SummaryButton';
import VoiceRecorder from './VoiceRecorder';

interface Agent {
  uuid: string;
  name: string;
  description?: string;
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
const MIN_HEIGHT = 60;
const MAX_HEIGHT = SCREEN_HEIGHT * 0.95;

interface BottomBarV2Props {
  onSendMessage?: (message: string) => void;
  onAgentSelect?: (agent: any) => void;
  conversationId?: string;
  isChat?: boolean;
  chatText?: string;
  setChatText?: (text: string) => void;
  onSummaryPress?: () => void;
  loadingSummary?: boolean; 
}

const BottomBarV2: React.FC<BottomBarV2Props> = ({
  onSendMessage,
  onAgentSelect,
  conversationId,
  isChat = false,
  chatText = '',
  setChatText,
  onSummaryPress,
  loadingSummary,  
}) => {
  const insets = useSafeAreaInsets();
  const { createAgent, updateAgent, addAgentToConversation, myAgents, conversationAgents, fetchConversationAgents, removeAgentFromConversation } = useAgents();
  const { websocket } = useChat();
  
  const [isJarvisActive, setIsJarvisActive] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);

  const [stagedFile, setStagedFile] = useState<{ uri: string; type: 'image' | 'video' | 'file'; name: string; mime: string } | null>(null);
  const [stagedVoiceUri, setStagedVoiceUri] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [voiceTranscription, setVoiceTranscription] = useState<string | null>(null);
  const [voiceResponse, setVoiceResponse] = useState<string | null>(null);
  const [isTextInputActive, setIsTextInputActive] = useState(false);
  const [lastJarvisMessage, setLastJarvisMessage] = useState<string | null>(null);
  const [lastJarvisResponse, setLastJarvisResponse] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalIcon, setModalIcon] = useState<keyof typeof Ionicons.glyphMap>('chatbubble-ellipses');

  const barHeight = useRef(new Animated.Value(MIN_HEIGHT)).current;
  const panelGestureRef = useRef(null);
  const glowOpacity = useRef(new Animated.Value(1)).current;
  const glowScale = useRef(new Animated.Value(1)).current;

  const uploadFileToBackend = async (uri: string, name: string, type: string) => {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name,
        type,
      } as any);

      const response = await fetchWithAuth(
        'https://reseausocial-production.up.railway.app/messaging/attachments/upload/',
        { method: 'POST', body: formData }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Upload failed:', response.status, errorText);
        Alert.alert('Erreur', `Upload échoué: ${response.status}`);
        return null;
      }

      const data = await response.json();
      if (data?.uuid) {
        console.log('✅ File uploaded:', data.uuid);
        return data.uuid;
      }
      return null;
    } catch (e) {
      console.error('uploadFileToBackend error', e);
      Alert.alert('Erreur', "Impossible d'uploader le fichier");
      return null;
    }
  };

  const {
    isRecording: isChatRecording,
    startRecording: startChatRecording,
    stopRecording: stopChatRecording,
    RecordingDisplay,
  } = VoiceRecorder({ 
    onRecordingStop: (uri: string) => {
      setStagedVoiceUri(uri);
    }
  });

  const handleJarvisActivation = () => setIsJarvisActive(true);
  const handleJarvisDeactivation = () => setIsJarvisActive(false);
  const handleTextInputActivate = () => setIsTextInputActive(true);
  
  const handleTextInputComplete = (message: string, response: string) => {
    setLastJarvisMessage(message);
    setLastJarvisResponse(response);
    setModalTitle('💬 Jarvis répond');
    setModalMessage(response);
    setModalIcon('chatbubble-ellipses');
    setModalVisible(true);
  };

  const handleTextInputQuit = () => {
    setIsTextInputActive(false);
    setLastJarvisMessage(null);
    setLastJarvisResponse(null);
  };

  const handleVoiceStart = () => setIsVoiceRecording(true);
  
  const handleVoiceComplete = (transcription: string, response: string) => {
    setVoiceTranscription(transcription);
    setVoiceResponse(response);
    setIsVoiceRecording(false);
    setModalTitle('🎤 Message vocal traité');
    setModalMessage(`Vous avez dit : "${transcription}"\n\nJarvis répond : "${response}"`);
    setModalIcon('mic');
    setModalVisible(true);
  };

  const handleVoiceCancel = () => {
    setIsVoiceRecording(false);
    setVoiceTranscription(null);
    setVoiceResponse(null);
  };

  const handleSendMessage = (message: string) => {
    onSendMessage?.(message);
  };

  // Combined Send Handler (Text, File, or Voice)
  const handleMasterSend = async () => {
    if (!conversationId || isSending) return;
    
    setIsSending(true);
    let attachmentUuid: string | null = null;

    try {
      // 1. Upload content if needed
      if (stagedFile) {
        attachmentUuid = await uploadFileToBackend(stagedFile.uri, stagedFile.name, stagedFile.mime);
      } else if (stagedVoiceUri) {
        attachmentUuid = await uploadFileToBackend(stagedVoiceUri, `voice_${Date.now()}.m4a`, 'audio/m4a');
      }

      // 2. Prepare Message Content
      let messageContent = chatText.trim();
      if (!messageContent) {
         if (stagedFile) messageContent = `📎 ${stagedFile.name}`;
         else if (stagedVoiceUri) messageContent = "🎤 Message vocal";
      }

      // 3. UI Update (Optimistic)
      // This calls the handler in ConversationDirect, which ONLY updates the cache.
      if (!attachmentUuid && onSendMessage) {
        console.log('🚀 UI Update (Optimistic) - Triggered via Context');
        onSendMessage(messageContent);
      }

      // 4. Network Transmission
      // Since the handler in ConversationDirect is now UI-only, BottomBarV2 MUST send the data.
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        console.log('📡 Sending via WebSocket');
        const payload = {
          type: 'chat_message',
          conversation_uuid: conversationId,
          message: messageContent,
          attachment_uuids: attachmentUuid ? [attachmentUuid] : [],
        };
        websocket.send(JSON.stringify(payload));
      } else {
        console.log('🌐 Sending via REST API (Fallback)');
        await fetchWithAuth(
          `https://reseausocial-production.up.railway.app/messaging/conversations/${conversationId}/messages/create-with-attachments/`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: messageContent,
              attachment_uuids: attachmentUuid ? [attachmentUuid] : [],
            }),
          }
        );
      }
      
      console.log('✅ Chat message transmitted to server');

      // 5. Cleanup
      setChatText?.('');
      setStagedFile(null);
      setStagedVoiceUri(null);
      setIsWriting(false);

    } catch (e) {
      console.error('handleMasterSend error', e);
      Alert.alert('Erreur', "Impossible d'envoyer le message");
    } finally {
      setIsSending(false);
    }
  };

  const hasStagedContent = !!chatText.trim() || !!stagedFile || !!stagedVoiceUri;

  const handleRemoveAgent = async (agentUuid: string) => {
    if (!conversationId) return;
    try {
      await removeAgentFromConversation(conversationId, agentUuid, fetchWithAuth);
      Alert.alert('Succès', 'Agent retiré de la conversation');
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Une erreur est survenue');
    }
  };

  const handleAddAgent = async (agentUuid: string) => {
    if (!conversationId) return;
    try {
      await addAgentToConversation(conversationId, agentUuid, fetchWithAuth);
      Alert.alert('Succès', 'Agent ajouté à la conversation');
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Une erreur est survenue');
    }
  };

  const cancelStagedContent = () => {
    setChatText?.('');
    setStagedFile(null);
    setStagedVoiceUri(null);
    setIsWriting(false);
  };

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationY, velocityY } = event.nativeEvent;
      if (translationY < -50 || velocityY < -500) {
        setIsExpanded(true);
        Animated.spring(barHeight, { toValue: MAX_HEIGHT, useNativeDriver: false, tension: 40, friction: 9 }).start();
      }
    }
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: new Animated.Value(0) } }],
    { 
      useNativeDriver: false,
      listener: (event: any) => {
        const { translationY } = event.nativeEvent;
        const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, MIN_HEIGHT - translationY));
        barHeight.setValue(newHeight);
      }
    }
  );

  const onPanelGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: new Animated.Value(0) } }],
    { 
      useNativeDriver: false,
      listener: (event: any) => {
        const { translationY } = event.nativeEvent;
        const newHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, MAX_HEIGHT - translationY));
        barHeight.setValue(newHeight);
      }
    }
  );

  const onPanelHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationY, velocityY } = event.nativeEvent;
      if (translationY > 100 || velocityY > 500) {
        setIsExpanded(false);
        Animated.spring(barHeight, { toValue: MIN_HEIGHT, useNativeDriver: false, tension: 40, friction: 9 }).start();
      } else {
        Animated.spring(barHeight, { toValue: MAX_HEIGHT, useNativeDriver: false, tension: 40, friction: 9 }).start();
      }
    }
  };

  const leftMargin = barHeight.interpolate({
    inputRange: [MIN_HEIGHT, MAX_HEIGHT],
    outputRange: [30, 0],
    extrapolate: 'clamp',
  });

  const rightMargin = barHeight.interpolate({
    inputRange: [MIN_HEIGHT, MAX_HEIGHT],
    outputRange: [30, 0],
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

  const isReadyToSend = isWriting || hasStagedContent;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={-10}
      style={styles.keyboardAvoidingView}
    >
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        enabled={!isJarvisActive && !isExpanded && !isChatRecording && !isVoiceRecording && !isTextInputActive}
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
              backgroundColor: "rgba(10, 145, 104, 0.7)",
            },
          ]}
        >
        <View style={styles.bottomBarSection}>
          {(() => {
            if (isChat) {
              return (
                <View style={styles.alignedButtonsContainer}>
                  {isChatRecording ? (
                    <>
                      <RecordingDisplay />
                      <View style={styles.actionButtonWrapper}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => { stopChatRecording(); setStagedVoiceUri(null); }}
                          activeOpacity={0.7}
                        >
                          <LinearGradient colors={['rgba(220, 38, 38, 0.9)', 'rgba(185, 28, 28, 0.9)']} style={styles.gradient}>
                            {Platform.OS === 'ios' ? <SymbolView name="xmark" size={20} tintColor="white" type="hierarchical" /> : <Ionicons name="close" size={20} color="white" />}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.actionButtonWrapper}>
                        <TouchableOpacity style={styles.actionButton} onPress={stopChatRecording} activeOpacity={0.7}>
                          <LinearGradient colors={['rgba(10, 145, 104, 1)', 'rgba(10, 145, 104, 0.8)']} style={styles.gradient}>
                            {Platform.OS === 'ios' ? <SymbolView name="checkmark" size={20} tintColor="white" type="hierarchical" /> : <Ionicons name="checkmark" size={20} color="white" />}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : stagedVoiceUri ? (
                    <>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 16 }}>
                        <Ionicons name="mic" size={20} color="white" />
                        <Text style={{ marginLeft: 8, color: 'white', fontWeight: '600', fontSize: 15 }}>Vocal prêt</Text>
                      </View>
                      <View style={styles.actionButtonWrapper}>
                        <TouchableOpacity style={styles.actionButton} onPress={cancelStagedContent} activeOpacity={0.7}>
                          <LinearGradient colors={['rgba(220, 38, 38, 0.9)', 'rgba(185, 28, 28, 0.9)']} style={styles.gradient}>
                            {Platform.OS === 'ios' ? <SymbolView name="xmark" size={20} tintColor="white" type="hierarchical" /> : <Ionicons name="close" size={20} color="white" />}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.actionButtonWrapper}>
                        <TouchableOpacity style={styles.actionButton} onPress={handleMasterSend} disabled={isSending} activeOpacity={0.7}>
                          <LinearGradient colors={['rgba(10, 145, 104, 1)', 'rgba(10, 145, 104, 0.8)']} style={styles.gradient}>
                            {isSending ? <ActivityIndicator size="small" color="white" /> : Platform.OS === 'ios' ? <SymbolView name="paperplane.fill" size={20} tintColor="white" type="hierarchical" /> : <Ionicons name="send" size={20} color="white" />}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : (
                    <>
                      {conversationId && (
                        <View style={styles.actionButtonWrapper}>
                          <AttachmentButtonInline
                            conversationId={conversationId || ''}
                            onFileSelected={(file: any) => { setStagedFile(file); setIsWriting(true); }}
                            disabled={!conversationId}
                          />
                        </View>
                      )}
                      <View style={styles.actionButtonWrapper}>
                        <SummaryButton onPress={onSummaryPress ?? (() => {})} loading={!!loadingSummary} disabled={!conversationId || !!loadingSummary} />
                      </View>
                      <View style={styles.actionButtonWrapper}>
                        <TouchableOpacity
                          style={[styles.actionButton, isReadyToSend && styles.actionButtonActive]}
                          onPress={isReadyToSend ? handleMasterSend : () => setIsWriting(true)}
                          activeOpacity={0.7}
                          disabled={!conversationId || (isReadyToSend && (isSending || !hasStagedContent))}
                        >
                          <LinearGradient
                            colors={isReadyToSend ? ['rgba(34, 197, 94, 1)', 'rgba(34, 197, 94, 0.8)'] : ['rgba(10, 145, 104, 1)', 'rgba(10, 145, 104, 0.8)']}
                            style={styles.gradient}
                          >
                            {isReadyToSend ? (
                              isSending ? <ActivityIndicator size="small" color="white" /> : Platform.OS === 'ios' ? <SymbolView name="paperplane.fill" size={20} tintColor="white" type="hierarchical" /> : <Ionicons name="send" size={20} color="white" />
                            ) : (
                              Platform.OS === 'ios' ? <SymbolView name="pencil" size={20} tintColor="white" type="hierarchical" /> : <Ionicons name="create-outline" size={20} color="white" />
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.actionButtonWrapper}>
                        <TouchableOpacity style={styles.voiceButton} onPress={startChatRecording} disabled={!conversationId}>
                          <Ionicons name="mic" size={24} color={conversationId ? '#ffffff' : 'rgba(255,255,255,0.5)'} />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              );
            } else if (isJarvisActive) {
              return <JarvisChatBar onSendMessage={handleSendMessage} onQuit={handleJarvisDeactivation} />;
            } else if (isVoiceRecording) {
              return <VoiceJarvisHandler onComplete={handleVoiceComplete} onCancel={handleVoiceCancel} />;
            } else if (isTextInputActive) {
              return <JarvisTextInput onComplete={handleTextInputComplete} onQuit={handleTextInputQuit} />;
            } else {
              return <JarvisSplitButton onTextActivate={handleTextInputActivate} onVoiceActivate={handleVoiceStart} />;
            }
          })()}
        </View>

        <View style={styles.expandableArea}>
          {isExpanded && (
            <PanGestureHandler ref={panelGestureRef} onGestureEvent={onPanelGestureEvent} onHandlerStateChange={onPanelHandlerStateChange} enabled={isExpanded}>
              <Animated.View style={styles.panelGestureArea}>
                <View style={styles.dragHandle} />
              </Animated.View>
            </PanGestureHandler>
          )}
          <ScrollView style={styles.scrollableContent} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} scrollEnabled={isExpanded}>
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
          </ScrollView>
        </View>
        </Animated.View>
      </PanGestureHandler>
      
      <JarvisResponseModal visible={modalVisible} onClose={() => setModalVisible(false)} title={modalTitle} message={modalMessage} icon={modalIcon} />
      {isChat && isWriting && !stagedFile && !stagedVoiceUri && <ComposingMessageBubble chatText={chatText} onChangeText={(text) => setChatText?.(text)} onCancel={cancelStagedContent} />}
      {isChat && (stagedFile || stagedVoiceUri) && <StagedContentPreview stagedFile={stagedFile} stagedVoiceUri={stagedVoiceUri} onCancel={cancelStagedContent} />}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  keyboardAvoidingView: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 9999 },
  alignedButtonsContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 12, paddingVertical: 8, width: '100%' },
  actionButtonWrapper: { alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  voiceButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.25)', alignItems: 'center', justifyContent: 'center' },
  voiceButtonRecording: { backgroundColor: 'rgba(220, 38, 38, 0.9)' },
  voiceButtonDisabled: { opacity: 0.6 },
  container: { position: 'absolute', bottom: 0, zIndex: 9998, flexDirection: 'column-reverse', justifyContent: 'flex-start', shadowColor: "rgba(10, 145, 104, 0.7)", shadowOpacity: 0.8, shadowRadius: 5, elevation: 5 },
  bottomBarSection: { width: '100%', zIndex: 10 },
  panelGestureArea: { width: '100%', paddingTop: 16, paddingBottom: 12, alignItems: 'center', backgroundColor: 'transparent', marginBottom: 8 },
  dragHandle: { width: 50, height: 5, borderRadius: 3, backgroundColor: 'rgba(10, 145, 104, 0.4)' },
  expandableArea: { flex: 1, width: '100%', flexDirection: 'column' },
  scrollableContent: { flex: 1, width: '100%' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },
  actionButton: { shadowColor: 'rgba(10, 145, 104, 0.4)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.6, shadowRadius: 4, elevation: 4 },
  actionButtonActive: { shadowColor: 'rgba(34, 197, 94, 0.6)', shadowOpacity: 0.8 },
  gradient: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
});

export default BottomBarV2;