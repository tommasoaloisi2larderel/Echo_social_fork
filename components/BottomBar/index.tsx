import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    Keyboard,
    PanResponder,
} from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAgents } from '../../contexts/AgentsContext';
import { useAuth } from "../../contexts/AuthContext";
import { useChat } from "../../contexts/ChatContext";
import { useJarvis } from "../../contexts/JarvisContext";
import { useNavigation } from "../../contexts/NavigationContext";
import AgentPanel from "./AgentPanel";
import AttachmentManager from "./AttachmentManager";
import BottomBarMain from "./BottomBarMain";
import JarvisOverlay from "./JarvisOverlay";
import { BottomBarProps, StagedAttachment } from "./types";
import VisualEffects from "./VisualEffects";
import VoiceRecorder from "./VoiceRecorder";

export default function BottomBar({
  currentRoute,
  chatText,
  setChatText,
  conversationId
}: BottomBarProps) {
  const insets = useSafeAreaInsets();
  const isChat = currentRoute.includes("conversation-direct") ||
                 currentRoute.includes("conversation-group") ||
                 currentRoute.includes("conversation-detail");

  const { accessToken, makeAuthenticatedRequest } = useAuth();
  const { navigateToScreen } = useNavigation();
  const { sendMessage: sendChatMessage, websocket, currentConversationId } = useChat();
  const { messages: jarvisMessages, sendMessage: sendJarvisMessage, clearHistory, loadHistory } = useJarvis();

  // Screen dimensions
  const screenHeight = Dimensions.get('window').height;
  const MAX_TRANSLATE = screenHeight * 0.75;

  // Panel animation
  const sheetY = useRef(new Animated.Value(MAX_TRANSLATE)).current;
  const dragStartY = useRef(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const [barHeight, setBarHeight] = useState(96);
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const [jarvisKeyboardHeight, setJarvisKeyboardHeight] = useState(0);
  const [jarvisActive, setJarvisActive] = useState(false);
  const [sendTarget, setSendTarget] = useState<'chat' | 'jarvis'>(isChat ? 'chat' : 'jarvis');

  // Agents context
  const {
    conversationAgents,
    loadingConversationAgents,
    fetchConversationAgents,
    removeAgentFromConversation,
    addAgentToConversation,
    myAgents,
    fetchMyAgents,
  } = useAgents();

  // Staged attachments
  const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);

  // API base URL
  const API_BASE_URL = typeof window !== 'undefined' && (window as any).location?.hostname === 'localhost'
    ? "http://localhost:3001"
    : "https://reseausocial-production.up.railway.app";

  // Keyboard handling
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      'keyboardWillShow',
      (e) => {
        Animated.timing(keyboardOffset, {
          toValue: -e.endCoordinates.height,
          duration: 250,
          useNativeDriver: true,
        }).start();
        setJarvisKeyboardHeight(e.endCoordinates.height || 0);
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      'keyboardWillHide',
      () => {
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
        setJarvisKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [keyboardOffset]);

  // Auto-scroll Jarvis messages
  useEffect(() => {
    if (jarvisMessages.length > 0) {
      setTimeout(() => {}, 100);
    }
  }, [jarvisMessages]);

  // Load Jarvis history
  useEffect(() => {
    if (jarvisActive && jarvisMessages.length === 0) {
      loadHistory();
    }
  }, [jarvisActive, jarvisMessages.length, loadHistory]);

  // Fetch conversation agents
  useEffect(() => {
    if (currentConversationId && isChat) {
        console.log('🤖 Fetching agents for conversation:', currentConversationId);
        fetchConversationAgents(currentConversationId, makeAuthenticatedRequest);
    }
    }, [currentConversationId, isChat]);

  // Fetch user's agents
  useEffect(() => {
    fetchMyAgents(makeAuthenticatedRequest);
}, []);

  // Set send target based on route
  useEffect(() => {
    if (isChat) {
      setSendTarget('chat');
      setJarvisActive(false);
    } else {
      setSendTarget('jarvis');
      setJarvisActive(false);
    }
  }, [isChat]);

  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 3,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderGrant: () => {
        // @ts-ignore
        dragStartY.current = (sheetY as any)._value ?? MAX_TRANSLATE;
      },
      onPanResponderMove: (_, g) => {
        const next = dragStartY.current + g.dy;
        const clamped = Math.max(0, Math.min(MAX_TRANSLATE, next));
        sheetY.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        // @ts-ignore
        const current = (sheetY as any)._value ?? MAX_TRANSLATE;
        const shouldOpen = current < MAX_TRANSLATE / 2 || g.vy < -0.5;
        if (shouldOpen) openPanel();
        else closePanel();
      },
    })
  ).current;

  const openPanel = () => {
    // Animation instantanée sans effet de montée
    sheetY.setValue(0);
    scaleAnim.setValue(1);
  };

  const closePanel = () => {
    // Animation instantanée sans effet de montée
    sheetY.setValue(MAX_TRANSLATE);
    scaleAnim.setValue(1);
  };

  // Delete Jarvis history
  const deleteJarvisHistory = async () => {
    await clearHistory();
  };

  // Upload attachment
  const uploadAttachment = async (file: { uri: string; name: string; type: string }): Promise<string | null> => {
    try {
      const form = new FormData();
      // @ts-ignore
      form.append('file', { uri: file.uri, name: file.name, type: file.type });
      const resp = await fetch(`${API_BASE_URL}/messaging/attachments/upload/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
        body: form,
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data?.uuid || null;
    } catch {
      return null;
    }
  };

  // Send attachment message
  const sendAttachmentMessage = async (attachmentUuids: string[], caption?: string) => {
    if (!currentConversationId) return;
    const payload: any = {
      type: 'chat_message',
      conversation_uuid: currentConversationId,
      message: (caption || '').trim(),
      attachment_uuids: attachmentUuids
    };
    try {
      if (websocket) {
        websocket.send(JSON.stringify(payload));
      } else {
        await fetch(`${API_BASE_URL}/messaging/conversations/${currentConversationId}/messages/create-with-attachments/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: payload.message, attachment_uuids: attachmentUuids }),
        });
      }
    } catch (error) {
      console.error('Error sending attachment:', error);
    }
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!chatText.trim()) return;

    try {
      if (sendTarget === 'chat' && isChat && sendChatMessage) {
        sendChatMessage(chatText);
        setChatText("");
      } else if (sendTarget === 'jarvis') {
        if (!jarvisActive) setJarvisActive(true);
        const userText = chatText.trim();
        setChatText("");
        await sendJarvisMessage(userText);
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  // Handle remove agent
  const handleRemoveAgent = async (agentUuid: string) => {
    if (!currentConversationId) return;

    try {
      await removeAgentFromConversation(currentConversationId as string, agentUuid, makeAuthenticatedRequest);
      Alert.alert('Succès', 'Agent retiré de la conversation');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de retirer l\'agent');
    }
  };

  // Handle add agent
  const handleAddAgent = async (agentUuid: string) => {
    if (!currentConversationId) return;

    try {
      await addAgentToConversation(currentConversationId as string, agentUuid, makeAuthenticatedRequest);
      Alert.alert('Succès', 'Agent ajouté à la conversation');
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible d\'ajouter l\'agent');
    }
  };

  // Use attachment manager
  const attachmentManager = AttachmentManager({
    stagedAttachments,
    setStagedAttachments,
    onSendAttachments: sendAttachmentMessage,
    uploadAttachment,
    chatText,
    setChatText,
  });

  // Use voice recorder
  const voiceRecorder = VoiceRecorder({
    onSendRecorded: async (uri: string) => {
      const uuid = await uploadAttachment({ uri, name: `voice_${Date.now()}.m4a`, type: 'audio/m4a' });
      if (uuid) await sendAttachmentMessage([uuid]);
    }
  });

  // Handle send (combines all sending logic)
  const handleSend = async () => {
    if (voiceRecorder.recordedUri) {
      await voiceRecorder.sendRecorded();
      return;
    }
    if (stagedAttachments.length > 0) {
      await attachmentManager.handleSendAttachments();
      return;
    }
    await handleSendMessage();
  };

  // Calculate opacity and interpolations
  const blurOpacity = sheetY.interpolate({
    inputRange: [0, MAX_TRANSLATE],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // Visual effects
  const visualEffects = VisualEffects({ blurOpacity, MAX_TRANSLATE, sheetY });

  return (
    <>
      {/* Jarvis Overlay */}
      <JarvisOverlay
        jarvisActive={jarvisActive}
        setJarvisActive={setJarvisActive}
        jarvisMessages={jarvisMessages}
        deleteJarvisHistory={deleteJarvisHistory}
        barHeight={barHeight}
        jarvisKeyboardHeight={jarvisKeyboardHeight}
        insets={insets}
      />

      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          transform: [{ translateY: keyboardOffset }],
        }}
      >
        {/* Visual Effects */}
        <visualEffects.ParticlesAndGradients />

        {/* Sliding panel for AI agents */}
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: MAX_TRANSLATE,
            backgroundColor: 'white',
            shadowColor: 'rgba(10, 145, 104, 0.6)',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.5,
            shadowRadius: 20,
            elevation: 15,
            transform: [
              { translateY: sheetY },
              { scale: scaleAnim },
            ],
          }}
        >
          {/* Top border with light effect */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              opacity: blurOpacity,
              zIndex: 1,
            }}
          >
            <LinearGradient
              colors={[
                'rgba(10, 145, 104, 1)',
                'rgba(10, 145, 104, 0.6)',
                'rgba(10, 145, 104, 1)',
              ]}
              style={{ flex: 1 }}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>

          {/* Background gradient */}
          <LinearGradient
            colors={[
              'rgba(240, 250, 248, 0.95)',
              'rgba(255, 255, 255, 1)',
            ]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />

          {/* Bottom Bar Main - always visible at top of panel */}
          <BottomBarMain
            barHeight={barHeight}
            setBarHeight={setBarHeight}
            panResponderHandlers={panResponder.panHandlers}
            glowOpacity={visualEffects.glowOpacity}
            glowScale={visualEffects.glowScale}
            isRecording={voiceRecorder.isRecording}
            RecordingDisplay={voiceRecorder.RecordingDisplay}
            recordedUri={voiceRecorder.recordedUri}
            StagedAttachmentsDisplay={attachmentManager.StagedAttachmentsDisplay}
            chatText={chatText}
            setChatText={setChatText}
            sendTarget={sendTarget}
            websocket={websocket}
            handleSend={handleSend}
            isChat={isChat}
            handlePlus={attachmentManager.handlePlus}
            setSendTarget={setSendTarget}
            setJarvisActive={setJarvisActive}
            startRecording={voiceRecorder.startRecording}
            stopRecording={voiceRecorder.stopRecording}
            navigateToScreen={navigateToScreen}
            stagedAttachments={stagedAttachments}
          />

          {/* Agent Panel Content */}
          <AgentPanel
            conversationAgents={conversationAgents}
            loadingConversationAgents={loadingConversationAgents}
            myAgents={myAgents}
            conversationId={currentConversationId ?? undefined}
            isChat={isChat}
            handleRemoveAgent={handleRemoveAgent}
            handleAddAgent={handleAddAgent}
            glowOpacity={visualEffects.glowOpacity}
            glowScale={visualEffects.glowScale}
          />
        </Animated.View>
      </Animated.View>
    </>
  );
}