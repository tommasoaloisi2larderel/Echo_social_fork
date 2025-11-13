import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useAgents } from "../../contexts/AgentsContext";
import { useAuth } from "../../contexts/AuthContext";

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

interface AgentPanelProps {
  conversationAgents: Agent[];
  loadingConversationAgents: boolean;
  myAgents: Agent[];
  conversationId?: string;
  isChat: boolean;
  handleRemoveAgent: (agentUuid: string) => Promise<void>;
  handleAddAgent: (agentUuid: string) => Promise<void>;
  glowOpacity: Animated.AnimatedInterpolation<number>;
  glowScale: Animated.AnimatedInterpolation<number>;
  backgroundColor?: string;
}

export default function AgentPanel({
  conversationAgents,
  loadingConversationAgents,
  myAgents,
  conversationId,
  isChat,
  handleRemoveAgent,
  handleAddAgent,
  glowOpacity,
  glowScale,
  backgroundColor = 'rgba(249, 250, 251, 1)',
}: AgentPanelProps) {
  const { makeAuthenticatedRequest } = useAuth();
  const { createAgent, updateAgent, addAgentToConversation } = useAgents();
  
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
  const [interactionRules, setInteractionRules] = useState<{
    interaction_type: 'respond_to' | 'ignore' | 'mention_only' | 'always_respond';
    target_user_uuid?: string;
    target_agent_uuid?: string;
  }[]>([]);
  const [availableUsers, setAvailableUsers] = useState<{uuid: string; username: string; surnom: string}[]>([]);
  const [selectedTargetType, setSelectedTargetType] = useState<'user' | 'agent'>('user');
  const [showInteractionRuleForm, setShowInteractionRuleForm] = useState(false);
  const [newRuleType, setNewRuleType] = useState<'respond_to' | 'ignore' | 'mention_only' | 'always_respond'>('respond_to');
  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [agentStats, setAgentStats] = useState<any>(null);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState<{response: string; success: boolean; processing_time: number} | null>(null);
  const [testingAgent, setTestingAgent] = useState(false);

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

  const handleEditAgent = async (agent: Agent) => {
    setEditingAgent(agent);
    setName(agent.name);
    setDescription(agent.description || '');
    setSystemPrompt(agent.instructions?.system_prompt || '');
    setAgentType(agent.agent_type);
    setLanguage(agent.instructions?.language || 'fr');
    setFormalityLevel(agent.instructions?.formality_level || 'casual');
    setMaxResponseLength(String(agent.instructions?.max_response_length || 500));
    setExpandedAgent(agent.uuid);
    // Charger les données complètes
    await loadAvailableUsers();
    await loadAgentDetails(agent.uuid);
    await loadAgentStats(agent.uuid);
  };

  const loadAvailableUsers = async () => {
    try {
      const response = await makeAuthenticatedRequest(
        'https://reseausocial-production.up.railway.app/api/connections/',
        { method: 'GET' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setAvailableUsers(data.results || data);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };
  
  const loadAgentDetails = async (agentUuid: string) => {
    try {
      const response = await makeAuthenticatedRequest(
        `https://reseausocial-production.up.railway.app/agents/agents/${agentUuid}/`,
        { method: 'GET' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setInteractionRules(data.interaction_rules || []);
        return data;
      }
    } catch (error) {
      console.error('Error loading agent details:', error);
    }
  };
  
  const loadAgentStats = async (agentUuid: string) => {
    try {
      const response = await makeAuthenticatedRequest(
        `https://reseausocial-production.up.railway.app/agents/agents/${agentUuid}/stats/`,
        { method: 'GET' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setAgentStats(data);
      }
    } catch (error) {
      console.error('Error loading agent stats:', error);
    }
  };

  const handleAddInteractionRule = async () => {
    if (!selectedTarget || !editingAgent) {
      Alert.alert('Erreur', 'Veuillez sélectionner une cible');
      return;
    }

    try {
      const ruleData = {
        interaction_type: newRuleType,
        ...(selectedTargetType === 'user' 
          ? { target_user_uuid: selectedTarget }
          : { target_agent_uuid: selectedTarget }
        )
      };

      const response = await makeAuthenticatedRequest(
        `https://reseausocial-production.up.railway.app/agents/agents/${editingAgent.uuid}/interactions/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ruleData)
        }
      );

      if (response.ok) {
        Alert.alert('Succès', 'Règle d\'interaction ajoutée');
        await loadAgentDetails(editingAgent.uuid);
        setShowInteractionRuleForm(false);
        setSelectedTarget('');
      } else {
        const error = await response.json();
        Alert.alert('Erreur', error.message || 'Impossible d\'ajouter la règle');
      }
    } catch (error) {
      console.error('Error adding interaction rule:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
  };

  const handleDeleteInteractionRule = async (ruleId: number) => {
    if (!editingAgent) return;

    try {
      const response = await makeAuthenticatedRequest(
        `https://reseausocial-production.up.railway.app/agents/agents/${editingAgent.uuid}/interactions/${ruleId}/`,
        { method: 'DELETE' }
      );

      if (response.ok || response.status === 204) {
        Alert.alert('Succès', 'Règle supprimée');
        await loadAgentDetails(editingAgent.uuid);
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
    }
  };

  const handleTestAgent = async () => {
    if (!testMessage.trim() || !editingAgent) {
      Alert.alert('Erreur', 'Veuillez entrer un message de test');
      return;
    }

    setTestingAgent(true);
    try {
      const response = await makeAuthenticatedRequest(
        `https://reseausocial-production.up.railway.app/agents/agents/${editingAgent.uuid}/test/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: testMessage })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTestResponse(data);
      } else {
        Alert.alert('Erreur', 'Impossible de tester l\'agent');
      }
    } catch (error) {
      console.error('Error testing agent:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setTestingAgent(false);
    }
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

  return (
    <ScrollView 
      style={{ flex: 1, backgroundColor: 'rgba(248, 250, 252, 1)' }} 
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >

      {/* Agents in conversation section */}
      {isChat && conversationId && (
        <View style={{ marginBottom: 24 }}>
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: 16,
            paddingHorizontal: 4,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: 'rgba(10, 145, 104, 0.1)',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 12,
              }}>
                <Ionicons name="people" size={18} color="rgba(10, 145, 104, 1)" />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a202c' }}>
                Agents actifs
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleCreateAgent}
              style={{
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
              }}
            >
              <Ionicons name="add-circle" size={20} color="rgba(10, 145, 104, 1)" />
              <Text style={{ color: 'rgba(10, 145, 104, 1)', fontWeight: '600', fontSize: 14 }}>
                Nouveau
              </Text>
            </TouchableOpacity>
          </View>

          {conversationAgents.length === 0 ? (
            <View style={{
              padding: 32,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              borderRadius: 20,
              alignItems: 'center',
              shadowColor: 'rgba(0, 0, 0, 0.1)',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 4,
            }}>
              <View style={{
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
              }}>
                <Ionicons name="cube-outline" size={32} color="rgba(10, 145, 104, 0.4)" />
              </View>
              <Text style={{ fontSize: 16, color: '#4a5568', marginBottom: 8, fontWeight: '600' }}>
                Aucun agent actif
              </Text>
              <Text style={{ fontSize: 14, color: '#718096', textAlign: 'center', lineHeight: 20 }}>
                Créez votre premier agent IA pour automatiser cette conversation
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: 'row', gap: 16 }}>
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
                    style={{
                      width: 160,
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      borderRadius: 20,
                      padding: 20,
                      shadowColor: 'rgba(10, 145, 104, 0.2)',
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.3,
                      shadowRadius: 16,
                      elevation: 6,
                    }}
                  >
                    <View style={{
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
                    }}>
                      <Ionicons
                        name={agent.agent_type === 'simple' ? 'flash' : agent.agent_type === 'conditional' ? 'git-branch' : 'settings'}
                        size={28}
                        color="rgba(10, 145, 104, 1)"
                      />
                    </View>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: '700',
                      color: '#1a202c',
                      textAlign: 'center',
                      marginBottom: 6,
                    }} numberOfLines={1}>
                      {agent.name}
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      color: '#718096',
                      textAlign: 'center',
                      lineHeight: 16,
                    }} numberOfLines={2}>
                      {agent.description || 'Agent IA personnalisé'}
                    </Text>
                    <View style={{
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
                    }}>
                      <Text style={{
                        fontSize: 10,
                        fontWeight: '600',
                        color: 'rgba(10, 145, 104, 1)',
                        textAlign: 'center',
                      }}>
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

      {/* My Agents Section */}
      <View style={{ marginTop: 20 }}>
        <TouchableOpacity
          onPress={() => setShowAgentsDropdown(!showAgentsDropdown)}
          style={{
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
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(10, 145, 104, 0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16,
              shadowColor: 'rgba(10, 145, 104, 0.3)',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.4,
              shadowRadius: 8,
              elevation: 3,
            }}>
              <Ionicons name="library" size={22} color="rgba(10, 145, 104, 1)" />
            </View>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a202c' }}>
                Mes agents
              </Text>
              <Text style={{ fontSize: 13, color: '#718096', marginTop: 2 }}>
                {myAgents.length} agent{myAgents.length !== 1 ? 's' : ''} créé{myAgents.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          <View style={{
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
          }}>
            <Ionicons
              name={showAgentsDropdown ? "chevron-up" : "chevron-down"}
              size={20}
              color="rgba(10, 145, 104, 1)"
            />
          </View>
        </TouchableOpacity>

        {showAgentsDropdown && (
          
          <ScrollView
              style={{ maxHeight: 500 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
            >
            {/* Create Agent Button - Top */}
            <TouchableOpacity
              onPress={handleCreateAgent}
              style={{
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
              }}
            >
              <View style={{
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
              }}>
                <Ionicons name="add-circle" size={22} color="rgba(10, 145, 104, 1)" />
              </View>
              <Text style={{
                fontSize: 16,
                fontWeight: '700',
                color: 'rgba(10, 145, 104, 1)',
              }}>
                Créer un nouvel agent
              </Text>
            </TouchableOpacity>
            {myAgents.length === 0 ? (
              <View style={{
                padding: 32,
                backgroundColor: 'rgba(10, 145, 104, 0.03)',
                borderRadius: 16,
                alignItems: 'center',
                borderWidth: 2,
                borderColor: 'rgba(10, 145, 104, 0.1)',
                borderStyle: 'dashed',
              }}>
                <View style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: 'rgba(10, 145, 104, 0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}>
                  <Ionicons name="add-circle-outline" size={32} color="rgba(10, 145, 104, 0.5)" />
                </View>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#2c3e50',
                  marginBottom: 8,
                }}>
                  Aucun agent créé
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: '#95a5a6',
                  textAlign: 'center',
                  lineHeight: 20,
                }}>
                  Créez votre premier agent IA{'\n'}pour automatiser vos conversations
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {myAgents.map((agent, index) => {
                  const uniqueKey = agent.uuid || `agent-${index}`;
                  const isInConversation = conversationAgents.some(ca => ca.uuid === agent.uuid);
                  const isExpanded = expandedAgent === agent.uuid;

                  return (
                    <View
                      key={uniqueKey}
                      style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: 24,
                        shadowColor: agent.is_active 
                          ? 'rgba(10, 145, 104, 0.3)' 
                          : isInConversation 
                            ? 'rgba(59, 130, 246, 0.3)' 
                            : 'rgba(0, 0, 0, 0.1)',
                        shadowOffset: { width: 0, height: 12 },
                        shadowOpacity: 0.5,
                        shadowRadius: 24,
                        elevation: 10,
                        overflow: 'hidden',
                        marginBottom: 16,
                      }}
                    >
                      {/* Header - Always visible */}
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
                        style={{
                          padding: 20,
                          backgroundColor: isExpanded ? 'rgba(10, 145, 104, 0.03)' : 'transparent',
                        }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                          width: 64,
                          height: 64,
                          borderRadius: 32,
                          backgroundColor: agent.is_active
                            ? 'rgba(10, 145, 104, 0.08)'
                            : 'rgba(150, 150, 150, 0.08)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 16,
                          shadowColor: agent.is_active ? 'rgba(10, 145, 104, 0.4)' : 'rgba(0, 0, 0, 0.15)',
                          shadowOffset: { width: 0, height: 6 },
                          shadowOpacity: 0.4,
                          shadowRadius: 12,
                          elevation: 5,
                        }}>
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

                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <Text style={{
                              fontSize: 16,
                              fontWeight: '700',
                              color: '#2c3e50',
                              flex: 1,
                            }} numberOfLines={1}>
                              {agent.name}
                            </Text>
                              {isInConversation && isChat && (
                                <View style={{
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
                                }}>
                                  <Text style={{
                                    fontSize: 10,
                                    fontWeight: '700',
                                    color: 'rgba(59, 130, 246, 1)',
                                    letterSpacing: 0.5,
                                  }}>
                                    DANS LA CONV
                                  </Text>
                                </View>
                              )}
                          </View>

                          <Text style={{
                            fontSize: 13,
                            color: '#7f8c8d',
                            marginBottom: 6,
                            lineHeight: 18,
                          }} numberOfLines={2}>
                            {agent.description || 'Agent IA personnalisé'}
                          </Text>

                          <View style={{ flexDirection: 'row', gap: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="chatbox-outline" size={12} color="#95a5a6" />
                              <Text style={{
                                fontSize: 11,
                                color: '#95a5a6',
                                marginLeft: 4,
                              }}>
                                {agent.conversation_count || 0} conv.
                              </Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Ionicons name="code-slash" size={12} color="#95a5a6" />
                              <Text style={{
                                fontSize: 11,
                                color: '#95a5a6',
                                marginLeft: 4,
                              }}>
                                {agent.agent_type === 'simple' ? 'Simple' :
                                agent.agent_type === 'conditional' ? 'Conditionnel' :
                                'Action'}
                              </Text>
                            </View>
                          </View>
                        </View>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 16,
                                  backgroundColor: isInConversation 
                                    ? 'rgba(255, 59, 48, 0.12)' 
                                    : 'rgba(10, 145, 104, 0.12)',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  shadowColor: isInConversation ? 'rgba(255, 59, 48, 0.3)' : 'rgba(10, 145, 104, 0.3)',
                                  shadowOffset: { width: 0, height: 4 },
                                  shadowOpacity: 0.4,
                                  shadowRadius: 8,
                                  elevation: 3,
                                }}
                              >
                                <Ionicons 
                                  name={isInConversation ? "remove" : "add"} 
                                  size={18} 
                                  color={isInConversation ? "rgba(255, 59, 48, 1)" : "rgba(10, 145, 104, 1)"} 
                                />
                              </TouchableOpacity>
                            )}
                            <View style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: 'rgba(10, 145, 104, 0.12)',
                              alignItems: 'center',
                              justifyContent: 'center',
                              shadowColor: 'rgba(10, 145, 104, 0.3)',
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.4,
                              shadowRadius: 8,
                              elevation: 3,
                            }}>
                              <Ionicons
                                name={isExpanded ? "chevron-up" : "chevron-down"}
                                size={18}
                                color="rgba(10, 145, 104, 1)"
                              />
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>

                      {/* Expandable Form */}
                      {isExpanded && (
                        <Animated.View style={{
                          borderTopWidth: 1,
                          borderTopColor: 'rgba(10, 145, 104, 0.1)',
                        }}>
                          <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                          >
                            <View style={{ padding: 16 }}>
                              {/* Name */}
                              <View style={{ marginBottom: 16 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                                  Nom de l&apos;agent *
                                </Text>
                                <TextInput
                                  value={name}
                                  onChangeText={setName}
                                  placeholder="Ex: Assistant Marketing"
                                  placeholderTextColor="#999"
                                  maxLength={100}
                                  style={{
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: 12,
                                    padding: 14,
                                    fontSize: 16,
                                    color: '#333',
                                    borderWidth: 1,
                                    borderColor: 'rgba(10, 145, 104, 0.2)',
                                  }}
                                />
                              </View>

                              {/* Description */}
                              <View style={{ marginBottom: 16 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                                  Description
                                </Text>
                                <TextInput
                                  value={description}
                                  onChangeText={setDescription}
                                  placeholder="Ex: Spécialisé dans le marketing digital"
                                  placeholderTextColor="#999"
                                  maxLength={500}
                                  multiline
                                  numberOfLines={2}
                                  style={{
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: 12,
                                    padding: 14,
                                    fontSize: 16,
                                    color: '#333',
                                    borderWidth: 1,
                                    borderColor: 'rgba(10, 145, 104, 0.2)',
                                    minHeight: 60,
                                  }}
                                />
                              </View>

                              {/* System Prompt */}
                              <View style={{ marginBottom: 16 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                                  Prompt système *
                                </Text>
                                <TextInput
                                  value={systemPrompt}
                                  onChangeText={setSystemPrompt}
                                  placeholder="Ex: Tu es un expert en marketing qui répond de manière créative..."
                                  placeholderTextColor="#999"
                                  multiline
                                  numberOfLines={3}
                                  style={{
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: 12,
                                    padding: 14,
                                    fontSize: 16,
                                    color: '#333',
                                    borderWidth: 1,
                                    borderColor: 'rgba(10, 145, 104, 0.2)',
                                    minHeight: 80,
                                    textAlignVertical: 'top',
                                  }}
                                />
                              </View>
                              {/* Section Règles d'interaction */}
                              {editingAgent && (
                                <View style={{ marginTop: 20 }}>
                                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#2c3e50' }}>
                                      Règles d&apos;interaction
                                    </Text>
                                    <TouchableOpacity
                                      onPress={() => setShowInteractionRuleForm(!showInteractionRuleForm)}
                                      style={{
                                        backgroundColor: 'rgba(10, 145, 104, 0.1)',
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 8,
                                      }}
                                    >
                                      <Text style={{ color: 'rgba(10, 145, 104, 1)', fontWeight: '600' }}>
                                        + Ajouter
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                
                                  {/* Liste des règles existantes */}
                                  {interactionRules.map((rule: any) => (
                                    <View
                                      key={rule.id}
                                      style={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                        padding: 12,
                                        borderRadius: 12,
                                        marginBottom: 8,
                                        flexDirection: 'row',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                      }}
                                    >
                                      <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#2c3e50', marginBottom: 4 }}>
                                          {rule.interaction_type === 'respond_to' && '💬 Répond à'}
                                          {rule.interaction_type === 'ignore' && '🚫 Ignore'}
                                          {rule.interaction_type === 'mention_only' && '@ Mention uniquement'}
                                          {rule.interaction_type === 'always_respond' && '✅ Répond toujours'}
                                        </Text>
                                        <Text style={{ fontSize: 12, color: '#7f8c8d' }}>
                                          {rule.target_user_username || rule.target_agent_name || 'Cible'}
                                        </Text>
                                      </View>
                                      <TouchableOpacity
                                        onPress={() => {
                                          Alert.alert(
                                            'Supprimer la règle',
                                            'Voulez-vous supprimer cette règle d\'interaction ?',
                                            [
                                              { text: 'Annuler', style: 'cancel' },
                                              { text: 'Supprimer', style: 'destructive', onPress: () => handleDeleteInteractionRule(rule.id) }
                                            ]
                                          );
                                        }}
                                      >
                                        <Ionicons name="trash-outline" size={20} color="#e74c3c" />
                                      </TouchableOpacity>
                                    </View>
                                  ))}
                                
                                  {/* Formulaire d'ajout de règle */}
                                  {showInteractionRuleForm && (
                                    <View style={{
                                      backgroundColor: 'rgba(240, 248, 255, 0.8)',
                                      padding: 16,
                                      borderRadius: 12,
                                      marginTop: 8,
                                    }}>
                                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#2c3e50', marginBottom: 12 }}>
                                        Nouvelle règle d&apos;interaction
                                      </Text>
                                
                                      {/* Type de règle */}
                                      <Text style={{ fontSize: 12, color: '#7f8c8d', marginBottom: 8 }}>Type de règle</Text>
                                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                        {[
                                          { value: 'respond_to', label: '💬 Répond à', icon: 'chatbubble' },
                                          { value: 'ignore', label: '🚫 Ignore', icon: 'close-circle' },
                                          { value: 'mention_only', label: '@ Mention', icon: 'at' },
                                          { value: 'always_respond', label: '✅ Toujours', icon: 'checkmark-circle' },
                                        ].map((type) => (
                                          <TouchableOpacity
                                            key={type.value}
                                            onPress={() => setNewRuleType(type.value as any)}
                                            style={{
                                              paddingHorizontal: 12,
                                              paddingVertical: 8,
                                              borderRadius: 8,
                                              backgroundColor: newRuleType === type.value
                                                ? 'rgba(10, 145, 104, 0.15)'
                                                : 'rgba(255, 255, 255, 0.8)',
                                              borderWidth: 1,
                                              borderColor: newRuleType === type.value
                                                ? 'rgba(10, 145, 104, 0.5)'
                                                : 'rgba(0, 0, 0, 0.1)',
                                            }}
                                          >
                                            <Text style={{
                                              fontSize: 12,
                                              color: newRuleType === type.value ? 'rgba(10, 145, 104, 1)' : '#7f8c8d',
                                              fontWeight: '600',
                                            }}>
                                              {type.label}
                                            </Text>
                                          </TouchableOpacity>
                                        ))}
                                      </View>
                                
                                      {/* Type de cible */}
                                      <Text style={{ fontSize: 12, color: '#7f8c8d', marginBottom: 8 }}>Cible</Text>
                                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                        <TouchableOpacity
                                          onPress={() => setSelectedTargetType('user')}
                                          style={{
                                            flex: 1,
                                            paddingVertical: 10,
                                            borderRadius: 8,
                                            backgroundColor: selectedTargetType === 'user'
                                              ? 'rgba(10, 145, 104, 0.15)'
                                              : 'rgba(255, 255, 255, 0.8)',
                                            borderWidth: 1,
                                            borderColor: selectedTargetType === 'user'
                                              ? 'rgba(10, 145, 104, 0.5)'
                                              : 'rgba(0, 0, 0, 0.1)',
                                            alignItems: 'center',
                                          }}
                                        >
                                          <Text style={{
                                            color: selectedTargetType === 'user' ? 'rgba(10, 145, 104, 1)' : '#7f8c8d',
                                            fontWeight: '600',
                                          }}>
                                            Utilisateur
                                          </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          onPress={() => setSelectedTargetType('agent')}
                                          style={{
                                            flex: 1,
                                            paddingVertical: 10,
                                            borderRadius: 8,
                                            backgroundColor: selectedTargetType === 'agent'
                                              ? 'rgba(10, 145, 104, 0.15)'
                                              : 'rgba(255, 255, 255, 0.8)',
                                            borderWidth: 1,
                                            borderColor: selectedTargetType === 'agent'
                                              ? 'rgba(10, 145, 104, 0.5)'
                                              : 'rgba(0, 0, 0, 0.1)',
                                            alignItems: 'center',
                                          }}
                                        >
                                          <Text style={{
                                            color: selectedTargetType === 'agent' ? 'rgba(10, 145, 104, 1)' : '#7f8c8d',
                                            fontWeight: '600',
                                          }}>
                                            Agent
                                          </Text>
                                        </TouchableOpacity>
                                      </View>
                                
                                      {/* Sélection de la cible */}
                                      <ScrollView style={{ maxHeight: 150, marginBottom: 12 }}>
                                        {selectedTargetType === 'user' ? (
                                          availableUsers.map((user) => (
                                            <TouchableOpacity
                                              key={user.uuid}
                                              onPress={() => setSelectedTarget(user.uuid)}
                                              style={{
                                                padding: 12,
                                                borderRadius: 8,
                                                backgroundColor: selectedTarget === user.uuid
                                                  ? 'rgba(10, 145, 104, 0.1)'
                                                  : 'rgba(255, 255, 255, 0.8)',
                                                marginBottom: 6,
                                                borderWidth: 1,
                                                borderColor: selectedTarget === user.uuid
                                                  ? 'rgba(10, 145, 104, 0.3)'
                                                  : 'rgba(0, 0, 0, 0.05)',
                                              }}
                                            >
                                              <Text style={{
                                                color: selectedTarget === user.uuid ? 'rgba(10, 145, 104, 1)' : '#2c3e50',
                                                fontWeight: selectedTarget === user.uuid ? '600' : '400',
                                              }}>
                                                {user.surnom || user.username}
                                              </Text>
                                            </TouchableOpacity>
                                          ))
                                        ) : (
                                          myAgents
                                            .filter(a => a.uuid !== editingAgent?.uuid)
                                            .map((agent) => (
                                              <TouchableOpacity
                                                key={agent.uuid}
                                                onPress={() => setSelectedTarget(agent.uuid)}
                                                style={{
                                                  padding: 12,
                                                  borderRadius: 8,
                                                  backgroundColor: selectedTarget === agent.uuid
                                                    ? 'rgba(10, 145, 104, 0.1)'
                                                    : 'rgba(255, 255, 255, 0.8)',
                                                  marginBottom: 6,
                                                  borderWidth: 1,
                                                  borderColor: selectedTarget === agent.uuid
                                                    ? 'rgba(10, 145, 104, 0.3)'
                                                    : 'rgba(0, 0, 0, 0.05)',
                                                }}
                                              >
                                                <Text style={{
                                                  color: selectedTarget === agent.uuid ? 'rgba(10, 145, 104, 1)' : '#2c3e50',
                                                  fontWeight: selectedTarget === agent.uuid ? '600' : '400',
                                                }}>
                                                  {agent.name}
                                                </Text>
                                              </TouchableOpacity>
                                            ))
                                        )}
                                      </ScrollView>
                                
                                      <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity
                                          onPress={() => setShowInteractionRuleForm(false)}
                                          style={{
                                            flex: 1,
                                            paddingVertical: 10,
                                            borderRadius: 8,
                                            backgroundColor: 'rgba(231, 76, 60, 0.1)',
                                            alignItems: 'center',
                                          }}
                                        >
                                          <Text style={{ color: '#e74c3c', fontWeight: '600' }}>Annuler</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                          onPress={handleAddInteractionRule}
                                          disabled={!selectedTarget}
                                          style={{
                                            flex: 1,
                                            paddingVertical: 10,
                                            borderRadius: 8,
                                            backgroundColor: selectedTarget
                                              ? 'rgba(10, 145, 104, 1)'
                                              : 'rgba(149, 165, 166, 0.3)',
                                            alignItems: 'center',
                                          }}
                                        >
                                          <Text style={{ color: '#fff', fontWeight: '600' }}>Ajouter</Text>
                                        </TouchableOpacity>
                                      </View>
                                    </View>
                                  )}
                                </View>
                              )}
                              {/* Section Test de l'agent */}
                              {editingAgent && (
                                <View style={{ marginTop: 20 }}>
                                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#2c3e50', marginBottom: 12 }}>
                                    Tester l&apos;agent
                                  </Text>
                                  
                                  <TextInput
                                    style={{
                                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                      borderRadius: 12,
                                      padding: 12,
                                      fontSize: 14,
                                      color: '#2c3e50',
                                      borderWidth: 1,
                                      borderColor: 'rgba(0, 0, 0, 0.1)',
                                      marginBottom: 12,
                                      minHeight: 60,
                                    }}
                                    placeholder="Message de test..."
                                    placeholderTextColor="#95a5a6"
                                    multiline
                                    value={testMessage}
                                    onChangeText={setTestMessage}
                                  />
                                
                                  <TouchableOpacity
                                    onPress={handleTestAgent}
                                    disabled={testingAgent || !testMessage.trim()}
                                    style={{
                                      backgroundColor: testingAgent || !testMessage.trim()
                                        ? 'rgba(149, 165, 166, 0.3)'
                                        : 'rgba(59, 130, 246, 1)',
                                      paddingVertical: 12,
                                      borderRadius: 12,
                                      alignItems: 'center',
                                      marginBottom: 12,
                                    }}
                                  >
                                    {testingAgent ? (
                                      <ActivityIndicator color="#fff" />
                                    ) : (
                                      <Text style={{ color: '#fff', fontWeight: '600' }}>Tester</Text>
                                    )}
                                  </TouchableOpacity>
                                
                                  {/* Affichage de la réponse de test */}
                                  {testResponse && (
                                    <View style={{
                                      backgroundColor: testResponse.success
                                        ? 'rgba(46, 204, 113, 0.1)'
                                        : 'rgba(231, 76, 60, 0.1)',
                                      padding: 16,
                                      borderRadius: 12,
                                      borderLeftWidth: 4,
                                      borderLeftColor: testResponse.success
                                        ? 'rgba(46, 204, 113, 1)'
                                        : 'rgba(231, 76, 60, 1)',
                                    }}>
                                      <Text style={{
                                        fontSize: 14,
                                        color: '#2c3e50',
                                        marginBottom: 8,
                                        lineHeight: 20,
                                      }}>
                                        {testResponse.response}
                                      </Text>
                                      <Text style={{ fontSize: 11, color: '#95a5a6' }}>
                                        ⏱️ {testResponse.processing_time.toFixed(2)}s
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              )}
                              {/* Section Statistiques */}
                              {editingAgent && agentStats && (
                                <View style={{ marginTop: 20 }}>
                                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#2c3e50', marginBottom: 12 }}>
                                    Statistiques
                                  </Text>
                                  
                                  <View style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                    padding: 16,
                                    borderRadius: 12,
                                    gap: 12,
                                  }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                      <Text style={{ fontSize: 13, color: '#7f8c8d' }}>Messages envoyés</Text>
                                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#2c3e50' }}>
                                        {agentStats.total_responses || 0}
                                      </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                      <Text style={{ fontSize: 13, color: '#7f8c8d' }}>Temps moyen de réponse</Text>
                                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#2c3e50' }}>
                                        {agentStats.avg_processing_time?.toFixed(2) || 0}s
                                      </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                      <Text style={{ fontSize: 13, color: '#7f8c8d' }}>Conversations actives</Text>
                                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#2c3e50' }}>
                                        {agentStats.active_conversations || 0}
                                      </Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                      <Text style={{ fontSize: 13, color: '#7f8c8d' }}>Taux de succès</Text>
                                      <Text style={{ fontSize: 14, fontWeight: '700', color: agentStats.success_rate > 90 ? '#27ae60' : '#e67e22' }}>
                                        {agentStats.success_rate?.toFixed(1) || 100}%
                                      </Text>
                                    </View>
                                  </View>
                                </View>
                              )}

                              {/* Max Response Length */}
                              <View style={{ marginBottom: 16 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                                  Longueur max des réponses
                                </Text>
                                <TextInput
                                  value={maxResponseLength}
                                  onChangeText={setMaxResponseLength}
                                  placeholder="500"
                                  placeholderTextColor="#999"
                                  keyboardType="numeric"
                                  style={{
                                    backgroundColor: '#f5f5f5',
                                    borderRadius: 12,
                                    padding: 14,
                                    fontSize: 16,
                                    color: '#333',
                                    borderWidth: 1,
                                    borderColor: 'rgba(10, 145, 104, 0.2)',
                                  }}
                                />
                                <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                                  Nombre de caractères maximum par réponse
                                </Text>
                              </View>
                            </View>

                            {/* Footer */}
                            <View style={{ 
                              padding: 16, 
                              borderTopWidth: 1, 
                              borderTopColor: 'rgba(10, 145, 104, 0.1)',
                              backgroundColor: 'white',
                            }}>
                              <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={submitting}
                                activeOpacity={0.8}
                              >
                                <LinearGradient
                                  colors={['rgba(10, 145, 104, 1)', 'rgba(10, 145, 104, 0.85)']}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 0 }}
                                  style={{
                                    paddingVertical: 16,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                    shadowColor: 'rgba(10, 145, 104, 0.4)',
                                    shadowOffset: { width: 0, height: 4 },
                                    shadowOpacity: 0.5,
                                    shadowRadius: 8,
                                    elevation: 5,
                                  }}
                                >
                                  {submitting ? (
                                    <ActivityIndicator color="white" />
                                  ) : (
                                    <Text style={{ color: 'white', fontSize: 17, fontWeight: 'bold' }}>
                                      {editingAgent ? 'Mettre à jour' : 'Créer l\'agent'}
                                    </Text>
                                  )}
                                </LinearGradient>
                              </TouchableOpacity>
                            </View>
                          </KeyboardAvoidingView>
                        </Animated.View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* New Agent Card */}
            {expandedAgent === 'new' && (
              <View style={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: 24,
                shadowColor: 'rgba(10, 145, 104, 0.3)',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.5,
                shadowRadius: 24,
                elevation: 10,
                overflow: 'hidden',
                marginTop: 16,
              }}>
                {/* Header */}
                <TouchableOpacity
                  onPress={() => {
                    setExpandedAgent(null);
                    setEditingAgent(null);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 20,
                    backgroundColor: 'rgba(10, 145, 104, 0.03)',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={{
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
                    }}>
                      <Ionicons name="add-circle" size={28} color="rgba(10, 145, 104, 1)" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>
                        Nouvel agent IA
                      </Text>
                      <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                        Créer un nouvel agent
                      </Text>
                    </View>
                  </View>
                  <View style={{
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
                  }}>
                    <Ionicons name="close" size={18} color="rgba(255, 59, 48, 1)" />
                  </View>
                </TouchableOpacity>

                {/* Form */}
                <KeyboardAvoidingView
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 20 }}
                  >
                    <View style={{ padding: 16 }}>
                      {/* Name */}
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                          Nom de l&apos;agent *
                        </Text>
                        <TextInput
                          value={name}
                          onChangeText={setName}
                          placeholder="Ex: Assistant Marketing"
                          placeholderTextColor="#999"
                          maxLength={100}
                          style={{
                            backgroundColor: '#f5f5f5',
                            borderRadius: 12,
                            padding: 14,
                            fontSize: 16,
                            color: '#333',
                            borderWidth: 1,
                            borderColor: 'rgba(10, 145, 104, 0.2)',
                          }}
                        />
                      </View>

                      {/* Description */}
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                          Description
                        </Text>
                        <TextInput
                          value={description}
                          onChangeText={setDescription}
                          placeholder="Ex: Spécialisé dans le marketing digital"
                          placeholderTextColor="#999"
                          maxLength={500}
                          multiline
                          numberOfLines={2}
                          style={{
                            backgroundColor: '#f5f5f5',
                            borderRadius: 12,
                            padding: 14,
                            fontSize: 16,
                            color: '#333',
                            borderWidth: 1,
                            borderColor: 'rgba(10, 145, 104, 0.2)',
                            minHeight: 60,
                          }}
                        />
                      </View>

                      {/* System Prompt */}
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                          Prompt système *
                        </Text>
                        <TextInput
                          value={systemPrompt}
                          onChangeText={setSystemPrompt}
                          placeholder="Ex: Tu es un expert en marketing qui répond de manière créative..."
                          placeholderTextColor="#999"
                          multiline
                          numberOfLines={3}
                          style={{
                            backgroundColor: '#f5f5f5',
                            borderRadius: 12,
                            padding: 14,
                            fontSize: 16,
                            color: '#333',
                            borderWidth: 1,
                            borderColor: 'rgba(10, 145, 104, 0.2)',
                            minHeight: 80,
                            textAlignVertical: 'top',
                          }}
                        />
                      </View>

                      {/* Max Response Length */}
                      <View style={{ marginBottom: 16 }}>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                          Longueur max des réponses
                        </Text>
                        <TextInput
                          value={maxResponseLength}
                          onChangeText={setMaxResponseLength}
                          placeholder="500"
                          placeholderTextColor="#999"
                          keyboardType="numeric"
                          style={{
                            backgroundColor: '#f5f5f5',
                            borderRadius: 12,
                            padding: 14,
                            fontSize: 16,
                            color: '#333',
                            borderWidth: 1,
                            borderColor: 'rgba(10, 145, 104, 0.2)',
                          }}
                        />
                        <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                          Nombre de caractères maximum par réponse
                        </Text>
                      </View>
                    </View>

                    {/* Footer */}
                    <View style={{ 
                      padding: 16, 
                      borderTopWidth: 1, 
                      borderTopColor: 'rgba(10, 145, 104, 0.1)',
                      backgroundColor: 'white',
                    }}>
                      <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={submitting}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={['rgba(10, 145, 104, 1)', 'rgba(10, 145, 104, 0.85)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{
                            paddingVertical: 16,
                            borderRadius: 12,
                            alignItems: 'center',
                            shadowColor: 'rgba(10, 145, 104, 0.4)',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.5,
                            shadowRadius: 8,
                            elevation: 5,
                          }}
                        >
                          {submitting ? (
                            <ActivityIndicator color="white" />
                          ) : (
                            <Text style={{ color: 'white', fontSize: 17, fontWeight: 'bold' }}>
                              Créer l&apos;agent
                            </Text>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </KeyboardAvoidingView>
                     

              </View>
            )}

          </ScrollView>
        )}
      </View>

      {/* Mysterious message */}
      <Animated.View
        style={{
          opacity: glowOpacity,
          marginTop: 20,
          padding: 16,
          backgroundColor: 'rgba(255, 255, 255, 0.6)',
          borderRadius: 16,
          alignItems: 'center',
          shadowColor: 'rgba(10, 145, 104, 0.2)',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 4,
        }}
      >
        <Text style={{
          fontSize: 14,
          color: 'rgba(10, 145, 104, 0.8)',
          textAlign: 'center',
          fontStyle: 'italic',
          fontWeight: '500',
        }}>
          ✨ Swipez pour découvrir d&apos;autres agents IA ✨
        </Text>
      </Animated.View>
    </ScrollView>
  );
}