import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAgents } from '../../contexts/AgentsContext';
import { useAuth } from '../../contexts/AuthContext';
import ChatInputBar from './ChatInputBar';
import JarvisChatBar from './JarvisChatBar';
import JarvisInteractionButton from './JarvisInteractionButton';
import VoiceButtonFloating from './VoiceButtonFloating';
import { useChat } from '../../contexts/ChatContext';
import VoiceRecorder from './VoiceRecorder';
import AttachmentButton from './Attachmentbutton';


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
  const [showAgentsDropdown, setShowAgentsDropdown] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  
  // Form states for editing
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [agentType, setAgentType] = useState<'simple' | 'conditional' | 'action'>('simple');
  const [language, setLanguage] = useState('fr');
  const [formalityLevel, setFormalityLevel] = useState('casual');
  const [maxResponseLength, setMaxResponseLength] = useState('500');
  const [submitting, setSubmitting] = useState(false);
  
  // Hauteur de la barre (animée)
  const barHeight = useRef(new Animated.Value(MIN_HEIGHT)).current;
  
  // Ref pour le PanGestureHandler du panneau d'agents
  const panelGestureRef = useRef(null);

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
        name: `voice_${Date.now()}.m4a`,
        type: 'audio/m4a',
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

  const handleSendMessage = (message: string) => {
    onSendMessage?.(message);
  };

  const handleChatSend = () => {
    if (chatText.trim() && onSendMessage) {
      onSendMessage(chatText);
      setChatText?.('');
    }
  };

  const handleCreateAgent = () => {
    setEditingAgent(null);
    setName('');
    setDescription('');
    setSystemPrompt('');
    setAgentType('simple');
    setLanguage('fr');
    setFormalityLevel('casual');
    setMaxResponseLength('500');
    setExpandedAgent('new');
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent);
    setName(agent.name);
    setDescription(agent.description || '');
    setSystemPrompt(agent.instructions?.system_prompt || '');
    setAgentType(agent.agent_type);
    setLanguage(agent.instructions?.language || 'fr');
    setFormalityLevel(agent.instructions?.formality_level || 'casual');
    setMaxResponseLength(String(agent.instructions?.max_response_length || 500));
    setExpandedAgent(agent.uuid);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Erreur', 'Le nom de l\'agent est requis');
      return;
    }

    if (!systemPrompt.trim()) {
      Alert.alert('Erreur', 'Le prompt système est requis');
      return;
    }

    setSubmitting(true);
    try {
      const agentData = {
        name: name.trim(),
        description: description.trim(),
        agent_type: agentType,
        instructions: {
          system_prompt: systemPrompt.trim(),
          language,
          formality_level: formalityLevel,
          max_response_length: parseInt(maxResponseLength) || 500,
        },
      };

      if (editingAgent) {
        // Update existing agent
        await updateAgent(editingAgent.uuid, agentData, makeAuthenticatedRequest);
        Alert.alert('Succès', 'Agent mis à jour avec succès');
      } else {
        // Create new agent
        const newAgent = await createAgent(agentData, makeAuthenticatedRequest);
        
        // If creating from conversation, automatically add to conversation
        if (conversationId) {
          await addAgentToConversation(conversationId, newAgent.uuid, makeAuthenticatedRequest);
          Alert.alert('Succès', `Agent "${name}" créé et ajouté à la conversation`);
        } else {
          Alert.alert('Succès', `Agent "${name}" créé avec succès`);
        }
      }

      setExpandedAgent(null);
      setEditingAgent(null);
    } catch (error) {
      console.error('Error submitting agent:', error);
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Une erreur est survenue');
    } finally {
      setSubmitting(false);
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
        enabled={!isJarvisActive && !isExpanded && !isRecording} // Désactiver le swipe quand Jarvis est actif OU quand la barre est étendue
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
            } else {
              console.log('  ✅ Rendering JarvisInteractionButton');
              return (
                <JarvisInteractionButton onActivate={handleJarvisActivation} />
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
            scrollEnabled={isExpanded} // Désactiver le scroll quand la barre est repliée
          >
            {/* Agents actifs dans la conversation */}
          {isChat && conversationId && (
            <View style={styles.activeAgentsSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.headerLeft}>
                  <View style={styles.iconCircle}>
                    <Ionicons name="people" size={18} color="rgba(10, 145, 104, 1)" />
                  </View>
                  <Text style={styles.sectionTitle}>Agents actifs</Text>
                </View>
              </View>

              {conversationAgents.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="cube-outline" size={32} color="rgba(10, 145, 104, 0.4)" />
                  </View>
                  <Text style={styles.emptyTitle}>Aucun agent actif</Text>
                  <Text style={styles.emptySubtitle}>
                    Créez votre premier agent IA pour automatiser cette conversation
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                  <View style={styles.agentCardsContainer}>
                    {conversationAgents.map((agent) => (
                      <TouchableOpacity
                        key={agent.uuid}
                        onPress={() => handleEditAgent(agent)}
                        onLongPress={() => {
                          Alert.alert(
                            'Retirer l\'agent',
                            `Voulez-vous retirer "${agent.name}" de cette conversation ?`,
                            [
                              { text: 'Annuler', style: 'cancel' },
                              {
                                text: 'Retirer',
                                style: 'destructive',
                                onPress: () => handleRemoveAgent(agent.uuid)
                              },
                            ]
                          );
                        }}
                        activeOpacity={0.8}
                        style={styles.agentCard}
                      >
                        <View style={styles.agentCardIcon}>
                          <Ionicons
                            name={agent.agent_type === 'simple' ? 'flash' : agent.agent_type === 'conditional' ? 'git-branch' : 'settings'}
                            size={28}
                            color="rgba(10, 145, 104, 1)"
                          />
                        </View>
                        <Text style={styles.agentCardName} numberOfLines={1}>
                          {agent.name}
                        </Text>
                        <Text style={styles.agentCardDesc} numberOfLines={2}>
                          {agent.description || 'Agent IA personnalisé'}
                        </Text>
                        <View style={styles.agentCardBadge}>
                          <Text style={styles.agentCardBadgeText}>
                            {agent.agent_type === 'simple' ? 'Simple' : agent.agent_type === 'conditional' ? 'Conditionnel' : 'Action'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}
            </View>
          )}

          {/* Mes agents */}
          <View style={styles.myAgentsSection}>
            <TouchableOpacity
              onPress={() => setShowAgentsDropdown(!showAgentsDropdown)}
              style={styles.myAgentsHeader}
            >
              <View style={styles.headerLeft}>
                <View style={styles.iconCircle}>
                  <Ionicons name="library" size={22} color="rgba(10, 145, 104, 1)" />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Mes agents</Text>
                  <Text style={styles.agentCount}>
                    {myAgents.length} agent{myAgents.length !== 1 ? 's' : ''} créé{myAgents.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              <View style={styles.chevronCircle}>
                <Ionicons
                  name={showAgentsDropdown ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="rgba(10, 145, 104, 1)"
                />
              </View>
            </TouchableOpacity>

            {showAgentsDropdown && (
              <View>
                {/* Bouton créer un agent */}
                <TouchableOpacity onPress={handleCreateAgent} style={styles.createAgentButton}>
                  <View style={styles.createAgentIcon}>
                    <Ionicons name="add-circle" size={22} color="rgba(10, 145, 104, 1)" />
                  </View>
                  <Text style={styles.createAgentText}>Créer un nouvel agent</Text>
                </TouchableOpacity>

                {myAgents.length === 0 ? (
                  <View style={styles.emptyAgentsList}>
                    <View style={styles.emptyAgentsIcon}>
                      <Ionicons name="add-circle-outline" size={32} color="rgba(10, 145, 104, 0.5)" />
                    </View>
                    <Text style={styles.emptyAgentsTitle}>Aucun agent créé</Text>
                    <Text style={styles.emptyAgentsSubtitle}>
                      Créez votre premier agent IA{'\n'}pour automatiser vos conversations
                    </Text>
                  </View>
                ) : (
                  <View>
                    {myAgents.map((agent: Agent, index: number) => {
                      const uniqueKey = agent.uuid || `agent-${index}`;
                      const isInConversation = conversationAgents.some(ca => ca.uuid === agent.uuid);
                      const isExpanded = expandedAgent === agent.uuid;

                      return (
                        <View key={uniqueKey} style={styles.agentItem}>
                          {/* Header de l'agent */}
                          <TouchableOpacity
                            onPress={() => {
                              if (isExpanded) {
                                setExpandedAgent(null);
                                setEditingAgent(null);
                              } else {
                                handleEditAgent(agent);
                              }
                            }}
                            activeOpacity={0.7}
                            style={[
                              styles.agentItemHeader,
                              isExpanded && styles.agentItemHeaderExpanded
                            ]}
                          >
                            <View style={styles.agentItemLeft}>
                              <View style={[
                                styles.agentItemIcon,
                                { backgroundColor: agent.is_active ? 'rgba(10, 145, 104, 0.08)' : 'rgba(150, 150, 150, 0.08)' }
                              ]}>
                                <Ionicons
                                  name={
                                    agent.agent_type === 'simple' ? 'flash' :
                                    agent.agent_type === 'conditional' ? 'git-branch' :
                                    'settings'
                                  }
                                  size={30}
                                  color={agent.is_active ? 'rgba(10, 145, 104, 1)' : '#95a5a6'}
                                />
                              </View>

                              <View style={styles.agentItemInfo}>
                                <View style={styles.agentItemNameRow}>
                                  <Text style={styles.agentItemName} numberOfLines={1}>
                                    {agent.name}
                                  </Text>
                                  {isInConversation && isChat && (
                                    <View style={styles.inConversationBadge}>
                                      <Text style={styles.inConversationText}>DANS LA CONV</Text>
                                    </View>
                                  )}
                                </View>

                                <Text style={styles.agentItemDesc} numberOfLines={2}>
                                  {agent.description || 'Agent IA personnalisé'}
                                </Text>

                                <View style={styles.agentItemStats}>
                                  <View style={styles.agentStat}>
                                    <Ionicons name="chatbox-outline" size={12} color="#95a5a6" />
                                    <Text style={styles.agentStatText}>
                                      {agent.conversation_count || 0} conv.
                                    </Text>
                                  </View>
                                  <View style={styles.agentStat}>
                                    <Ionicons name="code-slash" size={12} color="#95a5a6" />
                                    <Text style={styles.agentStatText}>
                                      {agent.agent_type === 'simple' ? 'Simple' :
                                      agent.agent_type === 'conditional' ? 'Conditionnel' :
                                      'Action'}
                                    </Text>
                                  </View>
                                </View>
                              </View>
                            </View>

                            <View style={styles.agentItemRight}>
                              {isChat && conversationId && (
                                <TouchableOpacity
                                  onPress={() => {
                                    if (isInConversation) {
                                      Alert.alert(
                                        'Retirer l\'agent',
                                        `Voulez-vous retirer "${agent.name}" de cette conversation ?`,
                                        [
                                          { text: 'Annuler', style: 'cancel' },
                                          {
                                            text: 'Retirer',
                                            style: 'destructive',
                                            onPress: () => handleRemoveAgent(agent.uuid)
                                          },
                                        ]
                                      );
                                    } else {
                                      Alert.alert(
                                        'Ajouter l\'agent',
                                        `Voulez-vous ajouter "${agent.name}" à cette conversation ?`,
                                        [
                                          { text: 'Annuler', style: 'cancel' },
                                          {
                                            text: 'Ajouter',
                                            onPress: () => handleAddAgent(agent.uuid)
                                          },
                                        ]
                                      );
                                    }
                                  }}
                                  style={[
                                    styles.addRemoveButton,
                                    { backgroundColor: isInConversation ? 'rgba(255, 59, 48, 0.12)' : 'rgba(10, 145, 104, 0.12)' }
                                  ]}
                                >
                                  <Ionicons 
                                    name={isInConversation ? "remove" : "add"} 
                                    size={18} 
                                    color={isInConversation ? "rgba(255, 59, 48, 1)" : "rgba(10, 145, 104, 1)"} 
                                  />
                                </TouchableOpacity>
                              )}
                              <View style={styles.chevronCircle}>
                                <Ionicons
                                  name={isExpanded ? "chevron-up" : "chevron-down"}
                                  size={18}
                                  color="rgba(10, 145, 104, 1)"
                                />
                              </View>
                            </View>
                          </TouchableOpacity>

                          {/* Formulaire d'édition */}
                          {isExpanded && (
                            <View style={styles.agentForm}>
                              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                                <View style={styles.formContent}>
                                  {/* Nom */}
                                  <View style={styles.formField}>
                                    <Text style={styles.formLabel}>Nom de l'agent *</Text>
                                    <TextInput
                                      value={name}
                                      onChangeText={setName}
                                      placeholder="Ex: Assistant Marketing"
                                      placeholderTextColor="#999"
                                      maxLength={100}
                                      style={styles.textInput}
                                    />
                                  </View>

                                  {/* Description */}
                                  <View style={styles.formField}>
                                    <Text style={styles.formLabel}>Description</Text>
                                    <TextInput
                                      value={description}
                                      onChangeText={setDescription}
                                      placeholder="Ex: Spécialisé dans le marketing digital"
                                      placeholderTextColor="#999"
                                      maxLength={500}
                                      multiline
                                      numberOfLines={2}
                                      style={[styles.textInput, styles.textInputMultiline]}
                                    />
                                  </View>

                                  {/* Prompt système */}
                                  <View style={styles.formField}>
                                    <Text style={styles.formLabel}>Prompt système *</Text>
                                    <TextInput
                                      value={systemPrompt}
                                      onChangeText={setSystemPrompt}
                                      placeholder="Ex: Tu es un expert en marketing qui répond de manière créative..."
                                      placeholderTextColor="#999"
                                      multiline
                                      numberOfLines={3}
                                      style={[styles.textInput, styles.textInputLarge]}
                                    />
                                  </View>

                                  {/* Type d'agent */}
                                  <View style={styles.formField}>
                                    <Text style={styles.formLabel}>Type d'agent</Text>
                                    <View style={styles.typeSelector}>
                                      {(['simple', 'conditional', 'action'] as const).map((type) => (
                                        <TouchableOpacity
                                          key={type}
                                          onPress={() => setAgentType(type)}
                                          style={[
                                            styles.typeButton,
                                            agentType === type && styles.typeButtonActive
                                          ]}
                                        >
                                          <Text style={[
                                            styles.typeButtonText,
                                            agentType === type && styles.typeButtonTextActive
                                          ]}>
                                            {type === 'simple' ? 'Simple' : type === 'conditional' ? 'Conditionnel' : 'Action'}
                                          </Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  </View>

                                  {/* Niveau de formalité */}
                                  <View style={styles.formField}>
                                    <Text style={styles.formLabel}>Niveau de formalité</Text>
                                    <View style={styles.formalitySelector}>
                                      {['casual', 'friendly', 'professional', 'formal'].map((level) => (
                                        <TouchableOpacity
                                          key={level}
                                          onPress={() => setFormalityLevel(level)}
                                          style={[
                                            styles.formalityButton,
                                            formalityLevel === level && styles.formalityButtonActive
                                          ]}
                                        >
                                          <Text style={[
                                            styles.formalityButtonText,
                                            formalityLevel === level && styles.formalityButtonTextActive
                                          ]}>
                                            {level.charAt(0).toUpperCase() + level.slice(1)}
                                          </Text>
                                        </TouchableOpacity>
                                      ))}
                                    </View>
                                  </View>

                                  {/* Longueur max */}
                                  <View style={styles.formField}>
                                    <Text style={styles.formLabel}>Longueur max des réponses</Text>
                                    <TextInput
                                      value={maxResponseLength}
                                      onChangeText={setMaxResponseLength}
                                      placeholder="500"
                                      placeholderTextColor="#999"
                                      keyboardType="numeric"
                                      style={styles.textInput}
                                    />
                                    <Text style={styles.formHelper}>
                                      Nombre de caractères maximum par réponse
                                    </Text>
                                  </View>
                                </View>

                                {/* Submit button */}
                                <View style={styles.formFooter}>
                                  <TouchableOpacity
                                    onPress={handleSubmit}
                                    disabled={submitting}
                                    activeOpacity={0.8}
                                  >
                                    <LinearGradient
                                      colors={['rgba(10, 145, 104, 1)', 'rgba(10, 145, 104, 0.85)']}
                                      start={{ x: 0, y: 0 }}
                                      end={{ x: 1, y: 0 }}
                                      style={styles.submitButton}
                                    >
                                      {submitting ? (
                                        <ActivityIndicator color="white" />
                                      ) : (
                                        <Text style={styles.submitButtonText}>
                                          {editingAgent ? 'Mettre à jour' : 'Créer l\'agent'}
                                        </Text>
                                      )}
                                    </LinearGradient>
                                  </TouchableOpacity>
                                </View>
                              </KeyboardAvoidingView>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Nouveau formulaire d'agent */}
                {expandedAgent === 'new' && (
                  <View style={styles.newAgentCard}>
                    <TouchableOpacity
                      onPress={() => {
                        setExpandedAgent(null);
                        setEditingAgent(null);
                      }}
                      style={styles.newAgentHeader}
                    >
                      <View style={styles.agentItemLeft}>
                        <View style={styles.newAgentIcon}>
                          <Ionicons name="add-circle" size={28} color="rgba(10, 145, 104, 1)" />
                        </View>
                        <View>
                          <Text style={styles.newAgentTitle}>Nouvel agent IA</Text>
                          <Text style={styles.newAgentSubtitle}>Créer un nouvel agent</Text>
                        </View>
                      </View>
                      <View style={styles.closeButton}>
                        <Ionicons name="close" size={18} color="rgba(255, 59, 48, 1)" />
                      </View>
                    </TouchableOpacity>

                    {/* Même formulaire que pour l'édition */}
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                      <View style={styles.formContent}>
                        {/* Nom */}
                        <View style={styles.formField}>
                          <Text style={styles.formLabel}>Nom de l'agent *</Text>
                          <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="Ex: Assistant Marketing"
                            placeholderTextColor="#999"
                            maxLength={100}
                            style={styles.textInput}
                          />
                        </View>

                        {/* Description */}
                        <View style={styles.formField}>
                          <Text style={styles.formLabel}>Description</Text>
                          <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Ex: Spécialisé dans le marketing digital"
                            placeholderTextColor="#999"
                            maxLength={500}
                            multiline
                            numberOfLines={2}
                            style={[styles.textInput, styles.textInputMultiline]}
                          />
                        </View>

                        {/* Prompt système */}
                        <View style={styles.formField}>
                          <Text style={styles.formLabel}>Prompt système *</Text>
                          <TextInput
                            value={systemPrompt}
                            onChangeText={setSystemPrompt}
                            placeholder="Ex: Tu es un expert en marketing qui répond de manière créative..."
                            placeholderTextColor="#999"
                            multiline
                            numberOfLines={3}
                            style={[styles.textInput, styles.textInputLarge]}
                          />
                        </View>

                        {/* Type d'agent */}
                        <View style={styles.formField}>
                          <Text style={styles.formLabel}>Type d'agent</Text>
                          <View style={styles.typeSelector}>
                            {(['simple', 'conditional', 'action'] as const).map((type) => (
                              <TouchableOpacity
                                key={type}
                                onPress={() => setAgentType(type)}
                                style={[
                                  styles.typeButton,
                                  agentType === type && styles.typeButtonActive
                                ]}
                              >
                                <Text style={[
                                  styles.typeButtonText,
                                  agentType === type && styles.typeButtonTextActive
                                ]}>
                                  {type === 'simple' ? 'Simple' : type === 'conditional' ? 'Conditionnel' : 'Action'}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        {/* Niveau de formalité */}
                        <View style={styles.formField}>
                          <Text style={styles.formLabel}>Niveau de formalité</Text>
                          <View style={styles.formalitySelector}>
                            {['casual', 'friendly', 'professional', 'formal'].map((level) => (
                              <TouchableOpacity
                                key={level}
                                onPress={() => setFormalityLevel(level)}
                                style={[
                                  styles.formalityButton,
                                  formalityLevel === level && styles.formalityButtonActive
                                ]}
                              >
                                <Text style={[
                                  styles.formalityButtonText,
                                  formalityLevel === level && styles.formalityButtonTextActive
                                ]}>
                                  {level.charAt(0).toUpperCase() + level.slice(1)}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>

                        {/* Longueur max */}
                        <View style={styles.formField}>
                          <Text style={styles.formLabel}>Longueur max des réponses</Text>
                          <TextInput
                            value={maxResponseLength}
                            onChangeText={setMaxResponseLength}
                            placeholder="500"
                            placeholderTextColor="#999"
                            keyboardType="numeric"
                            style={styles.textInput}
                          />
                          <Text style={styles.formHelper}>
                            Nombre de caractères maximum par réponse
                          </Text>
                        </View>
                      </View>

                      {/* Submit button */}
                      <View style={styles.formFooter}>
                        <TouchableOpacity
                          onPress={handleSubmit}
                          disabled={submitting}
                          activeOpacity={0.8}
                        >
                          <LinearGradient
                            colors={['rgba(10, 145, 104, 1)', 'rgba(10, 145, 104, 0.85)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.submitButton}
                          >
                            {submitting ? (
                              <ActivityIndicator color="white" />
                            ) : (
                              <Text style={styles.submitButtonText}>Créer l'agent</Text>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    </KeyboardAvoidingView>
                  </View>
                )}
              </View>
            )}
          </View>
          </ScrollView>
        </View>
        </Animated.View>
      </PanGestureHandler>
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
      />)}


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
