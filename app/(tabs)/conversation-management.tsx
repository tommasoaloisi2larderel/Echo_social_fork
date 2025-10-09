import DefaultAvatar from '@/components/DefaultAvatar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

// Utilise le proxy local pour éviter CORS en développement web
const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? "http://localhost:3001"
  : "https://reseausocial-production.up.railway.app";

interface ConversationMember {
  uuid: string;
  username: string;
  surnom?: string;
  photo_profil_url?: string;
  is_ai?: boolean;
}

interface AIAgent {
  uuid: string;
  name: string;
  description: string;
  photo_url?: string;
}

interface ConversationDetails {
  uuid: string;
  is_group: boolean;
  name?: string;
  members: ConversationMember[];
  other_participant?: ConversationMember;
}

export default function ConversationManagement() {
  const { conversationId } = useLocalSearchParams();
  const { makeAuthenticatedRequest } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [aiAgents, setAiAgents] = useState<AIAgent[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addMode, setAddMode] = useState<'person' | 'ai'>('person');

  useEffect(() => {
    loadConversationDetails();
    loadAvailableAIAgents();
  }, [conversationId]);

  const loadConversationDetails = async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/conversations/${conversationId}/`
      );
      
      if (response.ok) {
        const data = await response.json();
        setConversation(data);
      }
    } catch (error) {
      console.error('Erreur chargement détails:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails de la conversation');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableAIAgents = async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/api/ai-agents/available/`
      );
      
      if (response.ok) {
        const data = await response.json();
        setAiAgents(data.results || data);
      }
    } catch (error) {
      console.error('Erreur chargement agents IA:', error);
    }
  };

  const handleAddMember = async (memberUuid: string, isAI: boolean) => {
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/conversations/${conversationId}/add-member/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            member_uuid: memberUuid,
            is_ai: isAI
          })
        }
      );

      if (response.ok) {
        Alert.alert('Succès', 'Membre ajouté avec succès');
        setShowAddModal(false);
        loadConversationDetails();
      } else {
        Alert.alert('Erreur', 'Impossible d\'ajouter ce membre');
      }
    } catch (error) {
      console.error('Erreur ajout membre:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
  };

  const handleRemoveMember = async (memberUuid: string) => {
    Alert.alert(
      'Retirer le membre',
      'Voulez-vous vraiment retirer ce membre de la conversation ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/messaging/conversations/${conversationId}/remove-member/`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ member_uuid: memberUuid })
                }
              );

              if (response.ok) {
                Alert.alert('Succès', 'Membre retiré');
                loadConversationDetails();
              }
            } catch (error) {
              console.error('Erreur retrait membre:', error);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="rgba(10, 145, 104, 1)" />
      </View>
    );
  }

  const isGroup = conversation?.is_group || false;
  const members = isGroup ? conversation?.members || [] : conversation?.other_participant ? [conversation.other_participant] : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      {/* Bouton retour flottant */}
      <TouchableOpacity onPress={() => router.back()} style={styles.floatingBackButton}>
        <LinearGradient
          colors={['rgba(10, 145, 104, 0.95)', 'rgba(10, 145, 104, 0.85)']}
          style={styles.backButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Header flottant */}
      <LinearGradient
        colors={['rgba(10, 145, 104, 0.95)', 'rgba(10, 145, 104, 0.85)']}
        style={styles.floatingHeader}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name={isGroup ? "people" : "person"} size={20} color="#fff" />
        <Text style={styles.headerTitle}>
          {isGroup ? 'Gestion du groupe' : 'Détails du contact'}
        </Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section membres/contact */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={22} color="rgba(10, 145, 104, 1)" />
            <Text style={styles.sectionTitle}>
              {isGroup ? `Membres (${members.length})` : 'Contact'}
            </Text>
          </View>

          <View style={styles.membersList}>
            {members.map((member) => (
              <View key={member.uuid} style={styles.memberCard}>
                <View style={styles.memberInfo}>
                  {member.photo_profil_url ? (
                    <View style={styles.avatar} />
                  ) : (
                    <DefaultAvatar name={member.surnom || member.username} size={50} />
                  )}
                  
                  <View style={styles.memberDetails}>
                    <Text style={styles.memberName}>
                      {member.surnom || member.username}
                    </Text>
                    {member.is_ai && (
                      <View style={styles.aiBadge}>
                        <Ionicons name="flash" size={12} color="#fff" />
                        <Text style={styles.aiBadgeText}>Agent IA</Text>
                      </View>
                    )}
                  </View>
                </View>

                {isGroup && (
                  <TouchableOpacity
                    onPress={() => handleRemoveMember(member.uuid)}
                    style={styles.removeButton}
                  >
                    <Ionicons name="close-circle" size={24} color="#ff6b6b" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Section agents IA */}
        {isGroup && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flash-outline" size={22} color="rgba(10, 145, 104, 1)" />
              <Text style={styles.sectionTitle}>Agents IA disponibles</Text>
            </View>

            <View style={styles.aiGrid}>
              {aiAgents.slice(0, 4).map((agent) => (
                <TouchableOpacity
                  key={agent.uuid}
                  style={styles.aiCard}
                  onPress={() => handleAddMember(agent.uuid, true)}
                >
                  <LinearGradient
                    colors={['rgba(10, 145, 104, 0.1)', 'rgba(10, 145, 104, 0.05)']}
                    style={styles.aiCardGradient}
                  >
                    <Ionicons name="flash" size={32} color="rgba(10, 145, 104, 1)" />
                    <Text style={styles.aiCardName} numberOfLines={1}>{agent.name}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Bouton ajouter */}
        {isGroup && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <LinearGradient
              colors={['rgba(10, 145, 104, 1)', 'rgba(10, 145, 104, 0.9)']}
              style={styles.addButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="add-circle" size={24} color="#fff" />
              <Text style={styles.addButtonText}>Ajouter un membre</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Modal d'ajout */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ajouter un membre</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={28} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalTabs}>
              <TouchableOpacity
                style={[styles.modalTab, addMode === 'person' && styles.modalTabActive]}
                onPress={() => setAddMode('person')}
              >
                <Ionicons
                  name="person"
                  size={20}
                  color={addMode === 'person' ? '#fff' : 'rgba(10, 145, 104, 1)'}
                />
                <Text style={[styles.modalTabText, addMode === 'person' && styles.modalTabTextActive]}>
                  Personne
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalTab, addMode === 'ai' && styles.modalTabActive]}
                onPress={() => setAddMode('ai')}
              >
                <Ionicons
                  name="flash"
                  size={20}
                  color={addMode === 'ai' ? '#fff' : 'rgba(10, 145, 104, 1)'}
                />
                <Text style={[styles.modalTabText, addMode === 'ai' && styles.modalTabTextActive]}>
                  Agent IA
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color="#999" />
              <TextInput
                style={styles.searchInput}
                placeholder={addMode === 'person' ? 'Rechercher un contact...' : 'Rechercher un agent IA...'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#999"
              />
            </View>

            <FlatList
              data={addMode === 'ai' ? aiAgents : []}
              keyExtractor={(item) => item.uuid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => handleAddMember(item.uuid, addMode === 'ai')}
                >
                  <Ionicons
                    name={addMode === 'ai' ? 'flash' : 'person'}
                    size={24}
                    color="rgba(10, 145, 104, 1)"
                  />
                  <View style={styles.modalItemInfo}>
                    <Text style={styles.modalItemName}>{item.name}</Text>
                    {item.description && (
                      <Text style={styles.modalItemDesc} numberOfLines={1}>
                        {item.description}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="add-circle-outline" size={24} color="rgba(10, 145, 104, 1)" />
                </TouchableOpacity>
              )}
              style={styles.modalList}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(245, 245, 245, 0.9)',
  },
  floatingBackButton: {
    position: 'absolute',
    top: 70,
    left: 20,
    zIndex: 20,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  backButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingHeader: {
    position: 'absolute',
    top: 70,
    left: 80,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22,
    zIndex: 10,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingTop: 80,
  },
  section: {
    marginTop: 20,
    marginHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  membersList: {
    gap: 12,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: 'rgba(10, 145, 104, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0e0e0',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 145, 104, 1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  aiBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  removeButton: {
    padding: 4,
  },
  aiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  aiCard: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  aiCardGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(10, 145, 104, 0.2)',
    borderRadius: 16,
  },
  aiCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(10, 145, 104, 1)',
    textAlign: 'center',
  },
  addButton: {
    margin: 16,
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalTabs: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(235, 248, 245, 1)',
    borderWidth: 1,
    borderColor: 'rgba(200, 235, 225, 1)',
  },
  modalTabActive: {
    backgroundColor: 'rgba(10, 145, 104, 1)',
    borderColor: 'rgba(10, 145, 104, 1)',
  },
  modalTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(10, 145, 104, 1)',
  },
  modalTabTextActive: {
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(245, 245, 245, 1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalItemInfo: {
    flex: 1,
  },
  modalItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  modalItemDesc: {
    fontSize: 13,
    color: '#666',
  },
});

