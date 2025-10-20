import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Agent, useAgents } from '../contexts/AgentsContext';
import { useAuth } from '../contexts/AuthContext';

interface AgentModalProps {
  visible: boolean;
  onClose: () => void;
  agent?: Agent | null; // If editing
  conversationId?: string; // If creating from conversation
}

export default function AgentModal({ visible, onClose, agent, conversationId }: AgentModalProps) {
  const { makeAuthenticatedRequest } = useAuth();
  const { createAgent, updateAgent, addAgentToConversation } = useAgents();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [agentType, setAgentType] = useState<'simple' | 'conditional' | 'action'>('simple');
  const [language, setLanguage] = useState('fr');
  const [formalityLevel, setFormalityLevel] = useState('casual');
  const [maxResponseLength, setMaxResponseLength] = useState('500');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (agent) {
      // Editing mode
      setName(agent.name);
      setDescription(agent.description || '');
      setSystemPrompt(agent.instructions?.system_prompt || '');
      setAgentType(agent.agent_type);
      setLanguage(agent.instructions?.language || 'fr');
      setFormalityLevel(agent.instructions?.formality_level || 'casual');
      setMaxResponseLength(String(agent.instructions?.max_response_length || 500));
    } else {
      // Creating mode
      resetForm();
    }
  }, [agent, visible]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setSystemPrompt('');
    setAgentType('simple');
    setLanguage('fr');
    setFormalityLevel('casual');
    setMaxResponseLength('500');
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

      if (agent) {
        // Update existing agent
        await updateAgent(agent.uuid, agentData, makeAuthenticatedRequest);
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

      onClose();
      resetForm();
    } catch (error) {
      console.error('Error submitting agent:', error);
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Une erreur est survenue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}>
          <View style={{ 
            backgroundColor: 'white', 
            borderTopLeftRadius: 24, 
            borderTopRightRadius: 24,
            maxHeight: '90%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 10,
          }}>
            {/* Header */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(10, 145, 104, 0.1)',
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: 'rgba(10, 145, 104, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}>
                  <Ionicons name="flash" size={24} color="rgba(10, 145, 104, 1)" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>
                  {agent ? 'Modifier l\'agent' : 'Nouvel agent IA'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                <Ionicons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Form */}
            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <View style={{ padding: 20, paddingBottom: 40 }}>
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
                    numberOfLines={4}
                    style={{
                      backgroundColor: '#f5f5f5',
                      borderRadius: 12,
                      padding: 14,
                      fontSize: 16,
                      color: '#333',
                      borderWidth: 1,
                      borderColor: 'rgba(10, 145, 104, 0.2)',
                      minHeight: 100,
                      textAlignVertical: 'top',
                    }}
                  />
                </View>

                {/* Agent Type */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                    Type d&apos;agent
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {(['simple', 'conditional', 'action'] as const).map((type) => (
                      <TouchableOpacity
                        key={type}
                        onPress={() => setAgentType(type)}
                        style={{
                          flex: 1,
                          padding: 12,
                          borderRadius: 10,
                          backgroundColor: agentType === type ? 'rgba(10, 145, 104, 0.1)' : '#f5f5f5',
                          borderWidth: 2,
                          borderColor: agentType === type ? 'rgba(10, 145, 104, 0.5)' : 'transparent',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ 
                          fontSize: 14, 
                          fontWeight: agentType === type ? '600' : '400',
                          color: agentType === type ? 'rgba(10, 145, 104, 1)' : '#666',
                        }}>
                          {type === 'simple' ? 'Simple' : type === 'conditional' ? 'Conditionnel' : 'Action'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Formality Level */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 }}>
                    Niveau de formalité
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {['casual', 'friendly', 'professional', 'formal'].map((level) => (
                      <TouchableOpacity
                        key={level}
                        onPress={() => setFormalityLevel(level)}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderRadius: 20,
                          backgroundColor: formalityLevel === level ? 'rgba(10, 145, 104, 0.1)' : '#f5f5f5',
                          borderWidth: 1.5,
                          borderColor: formalityLevel === level ? 'rgba(10, 145, 104, 0.5)' : 'transparent',
                        }}
                      >
                        <Text style={{ 
                          fontSize: 13, 
                          fontWeight: formalityLevel === level ? '600' : '400',
                          color: formalityLevel === level ? 'rgba(10, 145, 104, 1)' : '#666',
                        }}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
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
            </ScrollView>

            {/* Footer */}
            <View style={{ 
              padding: 20, 
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
                      {agent ? 'Mettre à jour' : 'Créer l\'agent'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}