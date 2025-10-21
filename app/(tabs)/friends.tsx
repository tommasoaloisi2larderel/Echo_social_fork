import DefaultAvatar from '@/components/DefaultAvatar';
import { BACKGROUND_GRAY, ECHO_COLOR } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? "http://localhost:3001"
  : "https://reseausocial-production.up.railway.app";

// Types
interface UserInfo {
  id: number;
  uuid: string;
  username: string;
  surnom: string;
  first_name: string;
  last_name: string;
  photo_profil_url?: string;
}

interface Connection {
  id: number;
  uuid: string;
  username: string;
  surnom: string;
  first_name: string;
  last_name: string;
  photo_profil_url?: string;
  statut_relation: string;
}

interface Invitation {
  id: number;
  uuid: string;
  demandeur_info: UserInfo;
  destinataire_info: UserInfo;
  statut: string;
  message: string;
  date_demande: string;
  date_reponse?: string;
}

interface GroupInvitation {
  id: number;
  uuid: string;
  group: {
    uuid: string;
    name: string;
    description?: string;
    member_count?: number;
  };
  created_by: {
    uuid: string;
    username: string;
    surnom?: string;
  };
  status: string;
  message?: string;
  created_at: string;
  is_expired?: boolean;
}

export default function FriendsScreen() {
  const { makeAuthenticatedRequest } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [connections, setConnections] = useState<Connection[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [groupInvitations, setGroupInvitations] = useState<GroupInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'invitations' | 'groupInvitations'>('friends');
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  const fetchConnections = useCallback(async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/relations/connections/my-connections/`
      );
      if (response.ok) {
        const data = await response.json();
        setConnections(data.connexions || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des connexions:', error);
    }
  }, [makeAuthenticatedRequest]);

  const fetchInvitations = useCallback(async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/relations/connections/pending/`
      );
      if (response.ok) {
        const data = await response.json();
        setInvitations(data.demandes || []);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des invitations:', error);
    }
  }, [makeAuthenticatedRequest]);

  const fetchGroupInvitations = useCallback(async () => {
    try {
      console.log('📨 Chargement invitations de groupe...');
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/groups/invitations/received/`
      );
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Invitations de groupe reçues:', data.length);
        console.log('📋 Invitations détails:', data);
        // Filtrer les invitations expirées
        const activeInvitations = data.filter((inv: GroupInvitation) => !inv.is_expired);
        console.log('✅ Invitations actives:', activeInvitations.length);
        setGroupInvitations(activeInvitations || []);
      } else {
        console.error('❌ Erreur chargement invitations groupe:', response.status);
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des invitations de groupe:', error);
    }
  }, [makeAuthenticatedRequest]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([fetchConnections(), fetchInvitations(), fetchGroupInvitations()]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchConnections, fetchInvitations, fetchGroupInvitations]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleInvitationResponse = async (invitationId: number, action: 'acceptee' | 'refusee', senderName: string) => {
    setProcessingIds(prev => new Set(prev).add(invitationId));
    
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/relations/connections/${invitationId}/`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            statut: action,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      // Retirer l'invitation de la liste
      setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      
      // Si acceptée, recharger les connexions
      if (action === 'acceptee') {
        await fetchConnections();
        Alert.alert(
          'Demande acceptée',
          `Vous êtes maintenant connecté avec ${senderName} !`
        );
      } else {
        Alert.alert(
          'Demande refusée',
          `La demande de ${senderName} a été refusée.`
        );
      }
    } catch (error) {
      console.error('Erreur lors de la réponse à l\'invitation:', error);
      Alert.alert(
        'Erreur',
        'Impossible de traiter la demande. Veuillez réessayer.'
      );
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(invitationId);
        return newSet;
      });
    }
  };

  const handleGroupInvitationResponse = async (invitationUuid: string, action: 'accept' | 'decline', groupName: string) => {
    setProcessingIds(prev => new Set(prev).add(invitationUuid as any));
    
    try {
      console.log(`📨 ${action === 'accept' ? 'Acceptation' : 'Refus'} invitation groupe:`, invitationUuid);
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/groups/invitations/${invitationUuid}/respond/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: action
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Erreur réponse invitation:', errorData);
        throw new Error(`Erreur ${response.status}`);
      }

      // Retirer l'invitation de la liste
      setGroupInvitations(prev => prev.filter(inv => inv.uuid !== invitationUuid));
      
      if (action === 'accept') {
        Alert.alert(
          'Invitation acceptée',
          `Vous avez rejoint le groupe "${groupName}" !`,
          [{ 
            text: 'OK', 
            onPress: () => {
              // Retourner à la page conversations pour voir le nouveau groupe
              console.log('🔄 Navigation vers conversations pour recharger les groupes');
              router.push('/(tabs)/conversations');
            }
          }]
        );
      } else {
        Alert.alert(
          'Invitation refusée',
          `L'invitation au groupe "${groupName}" a été refusée.`
        );
      }
      
      console.log('✅ Invitation traitée avec succès');
    } catch (error) {
      console.error('❌ Erreur lors de la réponse à l\'invitation de groupe:', error);
      Alert.alert(
        'Erreur',
        'Impossible de traiter l\'invitation. Veuillez réessayer.'
      );
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(invitationUuid as any);
        return newSet;
      });
    }
  };

  const handleRemoveFriend = (connectionId: number, userName: string) => {
    Alert.alert(
      'Supprimer un ami',
      `Voulez-vous vraiment supprimer ${userName} de vos amis ?`,
      [
        {
          text: 'Annuler',
          style: 'cancel'
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              // Supprimer la connexion via l'API
              const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/relations/connections/${connectionId}/`,
                {
                  method: 'DELETE',
                }
              );

              if (!response.ok) {
                throw new Error(`Erreur ${response.status}`);
              }

              // Retirer de la liste locale
              setConnections(prev => prev.filter(c => c.id !== connectionId));
              
              Alert.alert(
                'Ami supprimé',
                `${userName} a été retiré de vos amis.`
              );
            } catch (error) {
              console.error('Erreur lors de la suppression:', error);
              Alert.alert(
                'Erreur',
                'Impossible de supprimer cet ami. Veuillez réessayer.'
              );
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ECHO_COLOR} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header harmonisé */}
      <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>
      
      <View style={styles.header}>
        <Ionicons name="people" size={20} color="#fff" />
        <Text style={styles.headerTitle}>Mes Connexions</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
          onPress={() => setActiveTab('friends')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="people"
            size={18}
            color={activeTab === 'friends' ? '#fff' : ECHO_COLOR}
          />
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            Amis ({connections.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'invitations' && styles.tabActive]}
          onPress={() => setActiveTab('invitations')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="mail"
            size={18}
            color={activeTab === 'invitations' ? '#fff' : ECHO_COLOR}
          />
          <Text style={[styles.tabText, activeTab === 'invitations' && styles.tabTextActive]}>
            Invitations ({invitations.length})
          </Text>
          {invitations.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{invitations.length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'groupInvitations' && styles.tabActive]}
          onPress={() => setActiveTab('groupInvitations')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="people-circle"
            size={18}
            color={activeTab === 'groupInvitations' ? '#fff' : ECHO_COLOR}
          />
          <Text style={[styles.tabText, activeTab === 'groupInvitations' && styles.tabTextActive]}>
            Groupes ({groupInvitations.length})
          </Text>
          {groupInvitations.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{groupInvitations.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'friends' ? (
          // Liste des amis
          connections.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>Aucun ami</Text>
              <Text style={styles.emptyText}>
                Recherchez des personnes dans l'onglet Conversations pour envoyer des demandes de connexion
              </Text>
            </View>
          ) : (
            connections.map((connection) => (
                <TouchableOpacity 
                  key={connection.uuid} 
                  style={styles.card}
                  onPress={() => {
                    console.log('🔍 Navigation vers profil:', connection.uuid);
                    router.replace(`/user-profile?uuid=${connection.uuid}`);
                  }}
                  activeOpacity={0.7}
                >
                <View style={styles.cardContent}>
                  {connection.photo_profil_url ? (
                    <Image
                      source={{ uri: connection.photo_profil_url }}
                      style={styles.avatar}
                    />
                  ) : (
                    <DefaultAvatar
                      name={connection.surnom || connection.username}
                      size={56}
                    />
                  )}
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardName}>
                      {connection.surnom || connection.username}
                    </Text>
                    {connection.surnom && connection.username !== connection.surnom && (
                      <Text style={styles.cardUsername}>@{connection.username}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleRemoveFriend(connection.id, connection.surnom || connection.username)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ff4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )
        ) : activeTab === 'invitations' ? (
          // Liste des invitations
          invitations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="mail-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>Aucune invitation</Text>
              <Text style={styles.emptyText}>
                Vous n'avez pas de demandes de connexion en attente
              </Text>
            </View>
          ) : (
            invitations.map((invitation) => {
              const isProcessing = processingIds.has(invitation.id);
              const sender = invitation.demandeur_info;
              
              return (
                <View key={invitation.id} style={styles.invitationCard}>
                  <View style={styles.cardContent}>
                    {sender.photo_profil_url ? (
                      <Image
                        source={{ uri: sender.photo_profil_url }}
                        style={styles.avatar}
                      />
                    ) : (
                      <DefaultAvatar
                        name={sender.surnom || sender.username}
                        size={56}
                      />
                    )}
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>
                        {sender.surnom || sender.username}
                      </Text>
                      {sender.surnom && sender.username !== sender.surnom && (
                        <Text style={styles.cardUsername}>@{sender.username}</Text>
                      )}
                      {invitation.message && (
                        <Text style={styles.invitationMessage} numberOfLines={2}>
                          {invitation.message}
                        </Text>
                      )}
                    </View>
                  </View>
                  
                  {isProcessing ? (
                    <View style={styles.actionsContainer}>
                      <ActivityIndicator size="small" color={ECHO_COLOR} />
                    </View>
                  ) : (
                    <View style={styles.actionsContainer}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() =>
                          handleInvitationResponse(
                            invitation.id,
                            'acceptee',
                            sender.surnom || sender.username
                          )
                        }
                      >
                        <Ionicons name="checkmark" size={20} color="#fff" />
                        <Text style={styles.acceptButtonText}>Accepter</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() =>
                          handleInvitationResponse(
                            invitation.id,
                            'refusee',
                            sender.surnom || sender.username
                          )
                        }
                      >
                        <Ionicons name="close" size={20} color="#666" />
                        <Text style={styles.rejectButtonText}>Refuser</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )
        ) : activeTab === 'groupInvitations' ? (
          // Liste des invitations de groupe
          groupInvitations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-circle-outline" size={64} color="#ccc" />
              <Text style={styles.emptyTitle}>Aucune invitation de groupe</Text>
              <Text style={styles.emptyText}>
                Vous n'avez pas d'invitations de groupe en attente
              </Text>
            </View>
          ) : (
            groupInvitations.map((invitation) => {
              const isProcessing = processingIds.has(invitation.uuid as any);
              
              return (
                <View key={invitation.uuid} style={styles.invitationCard}>
                  <View style={styles.cardContent}>
                    <View style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: 'rgba(10, 145, 104, 0.15)',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}>
                      <Ionicons name="people" size={28} color="rgba(10, 145, 104, 1)" />
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>
                        {invitation.group.name}
                      </Text>
                      <Text style={styles.cardUsername}>
                        Invité par {invitation.created_by?.surnom || invitation.created_by?.username || 'Inconnu'}
                      </Text>
                      {invitation.message && (
                        <Text style={styles.invitationMessage} numberOfLines={2}>
                          {invitation.message}
                        </Text>
                      )}
                      {invitation.is_expired && (
                        <Text style={{ fontSize: 12, color: '#ff6b6b', marginTop: 4 }}>
                          ⚠️ Invitation expirée
                        </Text>
                      )}
                      {invitation.group.member_count !== undefined && (
                        <Text style={styles.cardUsername}>
                          {invitation.group.member_count} membre{invitation.group.member_count > 1 ? 's' : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                  
                  {isProcessing ? (
                    <View style={styles.actionsContainer}>
                      <ActivityIndicator size="small" color={ECHO_COLOR} />
                    </View>
                  ) : (
                    <View style={styles.actionsContainer}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() =>
                          handleGroupInvitationResponse(
                            invitation.uuid,
                            'accept',
                            invitation.group.name
                          )
                        }
                      >
                        <Ionicons name="checkmark" size={20} color="#fff" />
                        <Text style={styles.acceptButtonText}>Accepter</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() =>
                          handleGroupInvitationResponse(
                            invitation.uuid,
                            'decline',
                            invitation.group.name
                          )
                        }
                      >
                        <Ionicons name="close" size={20} color="#666" />
                        <Text style={styles.rejectButtonText}>Refuser</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BACKGROUND_GRAY,
  },
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_GRAY,
  },
  backButton: {
    position: 'absolute',
    top: 65,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 145, 104, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    position: 'absolute',
    top: 65,
    left: 75,
    right: 20,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 145, 104, 0.9)',
    zIndex: 10,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 105,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  tabActive: {
    backgroundColor: ECHO_COLOR,
    shadowColor: ECHO_COLOR,
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: ECHO_COLOR,
  },
  tabTextActive: {
    color: '#fff',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  invitationCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1b5e20',
    marginBottom: 2,
  },
  cardUsername: {
    fontSize: 13,
    color: '#6c8a6e',
  },
  invitationMessage: {
    fontSize: 13,
    color: '#6c8a6e',
    marginTop: 4,
    fontStyle: 'italic',
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
    justifyContent: 'center',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: ECHO_COLOR,
  },
  acceptButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  rejectButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6c8a6e',
    textAlign: 'center',
    lineHeight: 20,
  },
});

