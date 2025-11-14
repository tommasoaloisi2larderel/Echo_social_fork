import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DefaultAvatar from '../../components/DefaultAvatar';
import { useAuth } from '../../contexts/AuthContext';
import { useUserProfile } from '../../contexts/UserProfileContext';

const API_BASE_URL = "https://reseausocial-production.up.railway.app";

interface UserProfile {
  id: number;
  uuid: string;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  date_naissance?: string;
  date_inscription?: string;
  surnom?: string;
  nationalite?: string;
  photo_profil?: string;
  photo_profil_url?: string;
  nb_connexions?: number;
  derniere_reponse?: {
    question: string;
    reponse: string;
    date: string;
  } | null;
  prochains_evenements?: Array<{
    id: number;
    titre: string;
    date_debut: string;
    type: string;
  }>;
}

interface UserProfileStats {
  total_connexions: number;
  total_evenements: number;
  evenements_ce_mois: number;
  total_reponses: number;
  date_inscription: string;
  derniere_activite: string;
}

interface Post {
  id: number;
  uuid: string;
  contenu: string;
  auteur: {
    uuid: string;
    username: string;
    photo_profil_url?: string | null;
  };
  created_at: string;
  updated_at: string;
}

export default function UserProfileScreen() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { makeAuthenticatedRequest } = useAuth();
  const { getUserProfile, getUserStats } = useUserProfile();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserProfileStats | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [checkingFriendStatus, setCheckingFriendStatus] = useState(true);
  const [startingConversation, setStartingConversation] = useState(false);

  useEffect(() => {
    loadProfile();
    loadPosts();
    checkFriendStatus();
  }, [uuid]);

  const loadProfile = async () => {
    if (!uuid) return;
    
    setLoading(true);
    try {
      const profileData = await getUserProfile(uuid, makeAuthenticatedRequest);
      if (profileData) {
        setProfile(profileData);
      }

      const statsData = await getUserStats(uuid, makeAuthenticatedRequest);
      if (statsData) {
        setStats(statsData);
      }
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      Alert.alert('Erreur', 'Impossible de charger le profil');
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    if (!uuid) return;
    
    setLoadingPosts(true);
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/posts/?auteur_uuid=${uuid}`
      );
      if (response.ok) {
        const data = await response.json();
        const postsList = Array.isArray(data) ? data : (data.results || data.posts || []);
        setPosts(postsList);
      } else {
        console.warn('Posts request failed with status', response.status);
      }
    } catch (error) {
      console.warn('Error fetching posts:', error);
    } finally {
      setLoadingPosts(false);
    }
  };

  const checkFriendStatus = async () => {
    if (!uuid) return;

    setCheckingFriendStatus(true);
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/relations/connections/?statut=acceptee`
      );

      if (response.ok) {
        const data = await response.json();
        const connections = Array.isArray(data) ? data : (data.results || []);

        // Check if the viewed user is in the list of accepted connections
        const isFriendConnection = connections.some((conn: any) => {
          const demandeurUuid = conn.demandeur_info?.uuid;
          const destinataireUuid = conn.destinataire_info?.uuid;
          return demandeurUuid === uuid || destinataireUuid === uuid;
        });

        setIsFriend(isFriendConnection);
      }
    } catch (error) {
      console.error('Erreur vérification statut ami:', error);
    } finally {
      setCheckingFriendStatus(false);
    }
  };

  const handleStartConversation = async () => {
    if (!profile) return;

    setStartingConversation(true);
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/conversations/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient_uuid: profile.uuid,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = 'Impossible de créer la conversation.';

        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }

        throw new Error(errorMessage);
      }

      const conversationData = await response.json();

      // Navigate to the conversation
      router.push({
        pathname: '/(tabs)/conversation-direct',
        params: { conversationId: conversationData.uuid }
      } as any);

    } catch (error) {
      console.error('Erreur création conversation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      Alert.alert('Erreur', errorMessage);
    } finally {
      setStartingConversation(false);
    }
  };

  const handleSendConnectionRequest = async () => {
    if (!profile || !connectionMessage.trim()) {
      Alert.alert('Message requis', 'Veuillez écrire un message de présentation');
      return;
    }

    setSendingRequest(true);
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/relations/connections/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            destinataire_uuid: profile.uuid,
            message: connectionMessage,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = 'Impossible d\'envoyer la demande de connexion.';
        
        if (errorData.detail) {
          errorMessage = errorData.detail;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        }
        
        throw new Error(errorMessage);
      }

      setShowMessageModal(false);
      setConnectionMessage('');
      Alert.alert(
        'Demande envoyée',
        `Votre demande de connexion a été envoyée à ${profile.surnom || profile.username}.`
      );
    } catch (error) {
      console.error('Erreur envoi demande:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      Alert.alert('Erreur', errorMessage);
    } finally {
      setSendingRequest(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Non renseigné';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatPostDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="rgba(10, 145, 104, 1)" />
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Profil introuvable</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Photo de profil et infos principales */}
        <View style={styles.profileHeader}>
          {profile.photo_profil_url ? (
            <Image source={{ uri: profile.photo_profil_url }} style={styles.profileImage} />
          ) : (
            <DefaultAvatar
              name={profile.surnom || profile.username}
              size={120}
            />
          )}
          
          <Text style={styles.displayName}>
            {profile.surnom || profile.username}
          </Text>
          
          {profile.first_name && profile.last_name && (
            <Text style={styles.fullName}>
              {profile.first_name} {profile.last_name}
            </Text>
          )}

          {profile.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}
        </View>

        {/* Statistiques */}
        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={24} color="rgba(10, 145, 104, 1)" />
              <Text style={styles.statNumber}>{stats.total_connexions}</Text>
              <Text style={styles.statLabel}>Connexions</Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="calendar" size={24} color="rgba(10, 145, 104, 1)" />
              <Text style={styles.statNumber}>{stats.total_evenements}</Text>
              <Text style={styles.statLabel}>Événements</Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="chatbubble" size={24} color="rgba(10, 145, 104, 1)" />
              <Text style={styles.statNumber}>{stats.total_reponses}</Text>
              <Text style={styles.statLabel}>Réponses</Text>
            </View>
          </View>
        )}

        {/* Informations détaillées */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Informations</Text>
          
          {profile.nationalite && (
            <View style={styles.infoRow}>
              <Ionicons name="flag" size={20} color="#666" />
              <Text style={styles.infoLabel}>Nationalité</Text>
              <Text style={styles.infoValue}>{profile.nationalite}</Text>
            </View>
          )}

          {profile.date_naissance && (
            <View style={styles.infoRow}>
              <Ionicons name="gift" size={20} color="#666" />
              <Text style={styles.infoLabel}>Date de naissance</Text>
              <Text style={styles.infoValue}>{formatDate(profile.date_naissance)}</Text>
            </View>
          )}

          {stats?.date_inscription && (
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color="#666" />
              <Text style={styles.infoLabel}>Membre depuis</Text>
              <Text style={styles.infoValue}>{formatDate(stats.date_inscription)}</Text>
            </View>
          )}
        </View>

        {/* Dernière réponse */}
        {profile.derniere_reponse && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Dernière réponse</Text>
            <View style={styles.responseCard}>
              <Text style={styles.responseQuestion}>
                {profile.derniere_reponse.question}
              </Text>
              <Text style={styles.responseAnswer}>
                {profile.derniere_reponse.reponse}
              </Text>
              <Text style={styles.responseDate}>
                {formatDate(profile.derniere_reponse.date)}
              </Text>
            </View>
          </View>
        )}

        {/* Prochains événements */}
        {profile.prochains_evenements && profile.prochains_evenements.length > 0 && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Prochains événements</Text>
            {profile.prochains_evenements.map((event) => (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventIcon}>
                  <Ionicons name="calendar-outline" size={20} color="rgba(10, 145, 104, 1)" />
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{event.titre}</Text>
                  <Text style={styles.eventDate}>{formatDate(event.date_debut)}</Text>
                  <Text style={styles.eventType}>{event.type}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Posts */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Posts</Text>
          
          {loadingPosts ? (
            <View style={styles.postsLoading}>
              <ActivityIndicator size="small" color="rgba(10, 145, 104, 1)" />
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.emptyPostsState}>
              <Ionicons name="document-text-outline" size={32} color="#ccc" />
              <Text style={styles.emptyPostsText}>Aucun post pour le moment</Text>
            </View>
          ) : (
            <View style={styles.postsList}>
              {posts.map((post) => (
                <View key={post.id || post.uuid} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <View style={styles.postAuthor}>
                      {post.auteur?.photo_profil_url ? (
                        <Image 
                          source={{ uri: post.auteur.photo_profil_url }} 
                          style={styles.postAvatar}
                        />
                      ) : (
                        <DefaultAvatar 
                          name={post.auteur?.username || profile?.username || 'User'} 
                          size={32}
                        />
                      )}
                      <View style={styles.postAuthorInfo}>
                        <Text style={styles.postAuthorName}>
                          {post.auteur?.username || profile?.username}
                        </Text>
                        <Text style={styles.postDate}>
                          {formatPostDate(post.created_at)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.postContent}>{post.contenu}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Bouton action (demande d'ami ou commencer conversation) */}
        <View style={styles.actionSection}>
          {checkingFriendStatus ? (
            <View style={styles.checkingStatusContainer}>
              <ActivityIndicator size="small" color="rgba(10, 145, 104, 1)" />
            </View>
          ) : isFriend ? (
            <TouchableOpacity
              style={styles.startChatButton}
              onPress={handleStartConversation}
              disabled={startingConversation}
            >
              {startingConversation ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                  <Text style={styles.startChatText}>Commencer une conversation</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.addFriendButton}
              onPress={() => setShowMessageModal(true)}
            >
              <Ionicons name="person-add" size={20} color="#fff" />
              <Text style={styles.addFriendText}>Envoyer une demande d'ami</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal pour le message personnalisé */}
      <Modal
        visible={showMessageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMessageModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Message de présentation</Text>
                  <Text style={styles.modalSubtitle}>
                    Présentez-vous à {profile.surnom || profile.username}
                  </Text>

                  <TextInput
                    style={styles.messageInput}
                    multiline
                    placeholder="Écrivez votre message..."
                    value={connectionMessage}
                    onChangeText={setConnectionMessage}
                    maxLength={300}
                  />

                  <Text style={styles.characterCount}>
                    {connectionMessage.length}/300
                  </Text>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity
                      style={styles.modalButtonCancel}
                      onPress={() => {
                        setShowMessageModal(false);
                        setConnectionMessage('');
                      }}
                    >
                      <Text style={styles.modalButtonCancelText}>Annuler</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.modalButtonSend,
                        (!connectionMessage.trim() || sendingRequest) && styles.modalButtonDisabled
                      ]}
                      onPress={handleSendConnectionRequest}
                      disabled={!connectionMessage.trim() || sendingRequest}
                    >
                      {sendingRequest ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.modalButtonSendText}>Envoyer</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 16,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  fullName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  bio: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 24,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: '#fff',
    marginTop: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  responseCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(10, 145, 104, 1)',
  },
  responseQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  responseAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  responseDate: {
    fontSize: 12,
    color: '#999',
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  eventType: {
    fontSize: 12,
    color: 'rgba(10, 145, 104, 1)',
    fontWeight: '600',
  },
  actionSection: {
    padding: 16,
    marginTop: 8,
  },
  addFriendButton: {
    backgroundColor: 'rgba(10, 145, 104, 1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  addFriendText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  startChatButton: {
    backgroundColor: 'rgba(10, 145, 104, 1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: 'rgba(10, 145, 104, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  startChatText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  checkingStatusContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButtonCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalButtonSend: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(10, 145, 104, 1)',
    alignItems: 'center',
  },
  modalButtonSendText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  postsLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyPostsState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyPostsText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  postsList: {
    marginTop: 8,
  },
  postCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  postHeader: {
    marginBottom: 8,
  },
  postAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  postAuthorInfo: {
    flex: 1,
  },
  postAuthorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  postDate: {
    fontSize: 12,
    color: '#999',
  },
  postContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
});