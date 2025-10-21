import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
    Alert,
    Animated,
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import AgentModal from "../AgentModal";

interface Agent {
  uuid: string;
  name: string;
  description?: string;
  agent_type: 'simple' | 'conditional' | 'action';
  is_active: boolean;
  conversation_count?: number;
  created_at: string;
  created_by_username: string;
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
}: AgentPanelProps) {
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showAgentsDropdown, setShowAgentsDropdown] = useState(false);

  const handleCreateAgent = () => {
    setSelectedAgent(null);
    setShowAgentModal(true);
  };

  const handleEditAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowAgentModal(true);
  };

  return (
    <ScrollView 
      style={{ flex: 1 }} 
      contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >

      {/* Agents in conversation section */}
      {isChat && conversationId && (
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#333' }}>
              Agents dans cette conversation
            </Text>
            <TouchableOpacity
              onPress={handleCreateAgent}
              style={{
                backgroundColor: 'rgba(10, 145, 104, 0.1)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Ionicons name="add-circle" size={18} color="rgba(10, 145, 104, 1)" />
              <Text style={{ color: 'rgba(10, 145, 104, 1)', fontWeight: '600', fontSize: 13 }}>
                Nouveau
              </Text>
            </TouchableOpacity>
          </View>

          {conversationAgents.length === 0 ? (
            <View style={{
              padding: 20,
              backgroundColor: '#f5f5f5',
              borderRadius: 12,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(10, 145, 104, 0.1)',
              borderStyle: 'dashed',
            }}>
              <Ionicons name="cube-outline" size={32} color="#ccc" />
              <Text style={{ fontSize: 14, color: '#999', marginTop: 8, textAlign: 'center' }}>
                Aucun agent dans cette conversation
              </Text>
              <Text style={{ fontSize: 12, color: '#bbb', marginTop: 4, textAlign: 'center' }}>
                Créez-en un avec le bouton + ci-dessus
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
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
                      width: 140,
                      backgroundColor: 'white',
                      borderRadius: 14,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: 'rgba(10, 145, 104, 0.2)',
                      shadowColor: 'rgba(10, 145, 104, 0.2)',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 3,
                    }}
                  >
                    <View style={{
                      width: 50,
                      height: 50,
                      borderRadius: 25,
                      backgroundColor: 'rgba(10, 145, 104, 0.1)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                      alignSelf: 'center',
                    }}>
                      <Ionicons
                        name={agent.agent_type === 'simple' ? 'flash' : agent.agent_type === 'conditional' ? 'git-branch' : 'settings'}
                        size={24}
                        color="rgba(10, 145, 104, 1)"
                      />
                    </View>
                    <Text style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#333',
                      textAlign: 'center',
                      marginBottom: 4,
                    }} numberOfLines={1}>
                      {agent.name}
                    </Text>
                    <Text style={{
                      fontSize: 11,
                      color: '#999',
                      textAlign: 'center',
                    }} numberOfLines={2}>
                      {agent.description || 'Aucune description'}
                    </Text>
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
            padding: 14,
            backgroundColor: 'rgba(10, 145, 104, 0.08)',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(10, 145, 104, 0.15)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(10, 145, 104, 0.15)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}>
              <Ionicons name="cube" size={20} color="rgba(10, 145, 104, 1)" />
            </View>
            <View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#2c3e50' }}>
                Mes Agents
              </Text>
              <Text style={{ fontSize: 12, color: '#7f8c8d', marginTop: 2 }}>
                {myAgents.length} agent{myAgents.length !== 1 ? 's' : ''} créé{myAgents.length !== 1 ? 's' : ''}
                {isChat && conversationId && ' • Tap pour ajouter/retirer'}
              </Text>
            </View>
          </View>
          <View style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: 'rgba(10, 145, 104, 0.1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Ionicons
              name={showAgentsDropdown ? "chevron-up" : "chevron-down"}
              size={18}
              color="rgba(10, 145, 104, 1)"
            />
          </View>
        </TouchableOpacity>

        {showAgentsDropdown && (
          <Animated.View style={{
            opacity: showAgentsDropdown ? 1 : 0,
            transform: [{ translateY: showAgentsDropdown ? 0 : -10 }],
          }}>
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

                  return (
                    <TouchableOpacity
                      key={uniqueKey}
                      onPress={() => {
                        // If in a conversation, allow adding/removing agent
                        if (isChat && conversationId) {
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
                        } else {
                          // If not in conversation, just edit
                          handleEditAgent(agent);
                        }
                      }}
                      onLongPress={() => handleEditAgent(agent)}
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: 'white',
                        borderRadius: 16,
                        padding: 16,
                        borderWidth: isInConversation ? 2 : 1,
                        borderColor: isInConversation 
                          ? 'rgba(10, 145, 104, 0.5)' 
                          : agent.is_active ? 'rgba(10, 145, 104, 0.2)' : 'rgba(150, 150, 150, 0.2)',
                        shadowColor: agent.is_active ? 'rgba(10, 145, 104, 0.15)' : '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 3,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          backgroundColor: agent.is_active
                            ? 'rgba(10, 145, 104, 0.1)'
                            : 'rgba(150, 150, 150, 0.1)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 14,
                        }}>
                          <Ionicons
                            name={
                              agent.agent_type === 'simple' ? 'flash' :
                              agent.agent_type === 'conditional' ? 'git-branch' :
                              'settings'
                            }
                            size={26}
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
                            {agent.is_active && (
                              <View style={{
                                backgroundColor: 'rgba(10, 145, 104, 0.1)',
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 10,
                                marginLeft: 8,
                              }}>
                                <Text style={{
                                  fontSize: 10,
                                  fontWeight: '600',
                                  color: 'rgba(10, 145, 104, 1)',
                                }}>
                                  ACTIF
                                </Text>
                              </View>
                            )}
                            {isInConversation && isChat && (
                              <View style={{
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 10,
                                marginLeft: 8,
                              }}>
                                <Text style={{
                                  fontSize: 10,
                                  fontWeight: '600',
                                  color: 'rgba(59, 130, 246, 1)',
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

                        <View style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: 'rgba(10, 145, 104, 0.05)',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: 12,
                        }}>
                          <Ionicons name="chevron-forward" size={18} color="rgba(10, 145, 104, 0.6)" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {myAgents.length > 0 && (
              <TouchableOpacity
                onPress={handleCreateAgent}
                style={{
                  marginTop: 12,
                  padding: 14,
                  backgroundColor: 'rgba(10, 145, 104, 0.05)',
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(10, 145, 104, 0.15)',
                }}
              >
                <Ionicons name="add-circle" size={20} color="rgba(10, 145, 104, 1)" />
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: 'rgba(10, 145, 104, 1)',
                  marginLeft: 8,
                }}>
                  Créer un nouvel agent
                </Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
      </View>

      {/* Mysterious message */}
      <Animated.View
        style={{
          opacity: glowOpacity,
          marginTop: 10,
        }}
      >
        <Text style={{
          fontSize: 13,
          color: 'rgba(10, 145, 104, 0.7)',
          textAlign: 'center',
          fontStyle: 'italic',
        }}>
          ✨ Swipez pour découvrir d&apos;autres agents IA ✨
        </Text>
      </Animated.View>

      {/* Agent Modal */}
      <AgentModal
        visible={showAgentModal}
        onClose={() => {
          setShowAgentModal(false);
          setSelectedAgent(null);
        }}
        agent={selectedAgent}
        conversationId={conversationId}
      />
    </ScrollView>
  );
}