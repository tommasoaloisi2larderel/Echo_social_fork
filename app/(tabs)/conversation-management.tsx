import DefaultAvatar from '@/components/DefaultAvatar';
import { FloatingHeader } from '@/components/FloatingHeader';
import { fetchWithAuth } from '@/services/apiClient';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useUserProfile } from '../../contexts/UserProfileContext';

const API_BASE_URL = "https://reseausocial-production.up.railway.app";

interface ConversationMember {
  id?: number;
  uuid?: string;
  user_uuid?: string;
  username?: string;
  surnom?: string;
  photo_profil_url?: string;
  is_ai?: boolean;
  role?: 'owner' | 'moderator' | 'member';
  is_muted?: boolean;
  is_banned?: boolean;
  user?: number | {
    id: number;
    uuid: string;
    username: string;
    surnom?: string;
    photo_profil_url?: string;
  };
  joined_at?: string;
  last_seen?: string;
}

interface GroupDetails {
  uuid: string;
  name: string;
  description?: string;
  avatar?: string;
  invite_code?: string;
  member_count: number;
  members: ConversationMember[];
  my_membership?: {
    role: 'owner' | 'moderator' | 'member';
    is_muted: boolean;
    is_banned: boolean;
  };
  created_at: string;
}

interface ConversationDetails {
  uuid: string;
  is_group?: boolean;
  conversation_type?: 'direct' | 'group_chat';
  name?: string;
  description?: string;
  created_at?: string;
  members?: ConversationMember[];
  participants_detail?: ConversationMember[];
  other_participant?: ConversationMember;
  group_info?: {
    id: number;
    uuid: string;
    name: string;
    description?: string;
    avatar?: string;
    member_count: number;
    my_role?: 'owner' | 'moderator' | 'member';
  };
  media_count?: number;
  link_count?: number;
  document_count?: number;
}

export default function ConversationManagement() {
  const { conversationId } = useLocalSearchParams();
  const { user } = useAuth();
  
  const { getUserProfile, getUserStats } = useUserProfile();
  const insets = useSafeAreaInsets();
  const { 
    prefetchAvatars, 
    getCachedPrivateConversations,  // 🆕
    getCachedGroupConversations,    // 🆕
    getCachedGroups, 
    removeFromPrivateConversationsCache,   // 🆕
    removeFromGroupConversationsCache      // 🆕
  } = useChat();

  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ephemeralMessages, setEphemeralMessages] = useState(false);
  
  // Pour les conversations privées
  const [userProfile, setUserProfile] = useState<any>(null);

  const [loadingProfile, setLoadingProfile] = useState(false);

  // Pour afficher le profil d'un membre du groupe
  const [selectedMemberProfile, setSelectedMemberProfile] = useState<any>(null);
  const [selectedMemberStats, setSelectedMemberStats] = useState<any>(null);
  const [showMemberProfile, setShowMemberProfile] = useState(false);

  useEffect(() => {
    loadConversationDetails();
  }, [conversationId]);

  const loadConversationDetails = async () => {
    try {
      
      // Chercher dans les deux types de conversations
      const privateConvs = getCachedPrivateConversations() || [];
      const groupConvs = getCachedGroupConversations() || [];
      const allConversations = [...privateConvs, ...groupConvs];
      const cachedConv = allConversations.find((c: any) => c.uuid === conversationId);
      if (cachedConv) {
        
        setConversation(cachedConv);
        
        const cachedGroups = getCachedGroups();
        const isGroupConv = cachedGroups?.some((g: any) => g.conversation_uuid === conversationId);
        
        if (isGroupConv) {
          
          await loadGroupDetails();
        } else {
          const otherUserUuid = cachedConv.other_participant?.uuid || cachedConv.other_participant?.user_uuid;
          
          
          if (otherUserUuid) {
            await loadUserProfile(otherUserUuid);
          }
        }
        
        setLoading(false);
        return;
      }
      
      
      const response = await fetchWithAuth(
        `${API_BASE_URL}/messaging/conversations/${conversationId}/`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      setConversation(data);
      
      if (data.other_participant) {
        const otherUserUuid = data.other_participant.uuid || data.other_participant.user_uuid;
        if (otherUserUuid) {
          await loadUserProfile(otherUserUuid);
        }
      }
      
      if (data.is_group || !data.other_participant) {
        await loadGroupDetails();
      }
      
    } catch (error) {
      console.error('❌ Erreur chargement conversation:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails de la conversation');
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async (uuid: string) => {
    setLoadingProfile(true);
    try {
      const profile = await getUserProfile(uuid, fetchWithAuth);
      
      if (!profile) {
        console.error('❌ Profil non reçu');
        setLoadingProfile(false);
        return;
      }
      
      setUserProfile(profile);
      // ⚠️ Ne pas charger les stats (endpoint /api/users/{uuid}/stats/ n'existe pas)
      
    } catch (error) {
      console.error('❌ Erreur chargement profil:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadMemberProfile = async (uuid: string) => {
    setLoadingProfile(true);
    
    try {
      const profile = await getUserProfile(uuid, fetchWithAuth);

      if (!profile) {
        console.log('❌ Pas de profil reçu');
        setLoadingProfile(false);
        return;
      }

      setSelectedMemberProfile(profile);
      // ⚠️ Ne pas charger les stats (endpoint n'existe pas)

      setShowMemberProfile(true);
      
    } catch (error) {
      console.error('❌ Erreur chargement profil membre:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadGroupDetails = async () => {
    const cachedGroups = getCachedGroups();
    const foundGroup = cachedGroups?.find((g: any) => g.conversation_uuid === conversationId);
    
    if (foundGroup) {
      setGroupDetails(foundGroup);
      if (foundGroup.avatar) {
        try { await prefetchAvatars([foundGroup.avatar]); } catch {}
      }
      return;
    }

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/groups/my-groups/`);
      if (response.ok) {
        const groups = await response.json();
        const group = groups.find((g: any) => g.conversation_uuid === conversationId);
        
        if (group) {
          const detailResponse = await fetchWithAuth(`${API_BASE_URL}/groups/${group.uuid}/`);
          if (detailResponse.ok) {
            const details = await detailResponse.json();
            setGroupDetails(details);
            if (details.avatar) {
              try { await prefetchAvatars([details.avatar]); } catch {}
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Erreur chargement groupe:', error);
    }
  };

const handleBlockUser = async () => {
  if (!otherParticipant?.uuid) {
    Alert.alert('Erreur', 'Impossible de bloquer cet utilisateur');
    return;
  }
  
  if (otherParticipant.uuid === user?.uuid) {
    Alert.alert('Erreur', 'Vous ne pouvez pas vous bloquer vous-même');
    return;
  }
  
  Alert.alert(
    'Bloquer cet utilisateur',
    'Voulez-vous vraiment bloquer cet utilisateur ? Il ne pourra plus vous envoyer de messages.',
    [
      { text: 'Annuler', style: 'cancel' },
      { 
        text: 'Bloquer', 
        style: 'destructive', 
        onPress: async () => {
          try {
            const response = await fetchWithAuth(
              `${API_BASE_URL}/messaging/block-user/`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  user_uuid: otherParticipant.uuid,
                  action: 'block'
                })
              }
            );
            
            // Ne pas essayer de parser si ce n'est pas du JSON
            if (response.ok) {
              // L'action a réussi, pas besoin de parser
              Alert.alert('Succès', 'Utilisateur bloqué avec succès');
              router.back();
            } else {
              // Essayer de lire l'erreur
              const contentType = response.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const errorData = await response.json();
                Alert.alert('Erreur', errorData.message || errorData.error || 'Impossible de bloquer');
              } else {
                Alert.alert('Erreur', 'Une erreur est survenue');
              }
            }
          } catch (error) {
            console.error('❌ Erreur blocage:', error);
            // Si on arrive ici mais que l'action a marché, c'est juste un problème de parsing
            Alert.alert('Erreur', 'Une erreur est survenue lors du blocage');
          }
        }
      }
    ]
  );
};


  const handleLeaveGroup = () => {
    if (!groupDetails) return;
    
    Alert.alert(
      'Quitter le groupe',
      'Voulez-vous quitter ce groupe ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetchWithAuth(
                `${API_BASE_URL}/groups/${groupDetails.uuid}/leave/`,
                { method: 'POST' }
              );
              if (response.ok) {
                router.back();
              }
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de quitter le groupe');
            }
          }
        }
      ]
    );
  };

  const handleArchive = async () => {
    Alert.alert(
      'Archiver',
      'Voulez-vous archiver cette conversation ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Archiver',
          onPress: async () => {
            try {
              const response = await fetchWithAuth(
                `${API_BASE_URL}/messaging/conversations/${conversationId}/archive/`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'archive' }),
                }
                
              );

              if (response.ok) {
                // Essayer de retirer des deux caches
                removeFromPrivateConversationsCache(conversationId as string);
                removeFromGroupConversationsCache(conversationId as string);

                Alert.alert('Succès', 'Conversation archivée', [
                  {
                    text: 'OK',
                    onPress: () => router.replace('/(tabs)/conversations'),
                  },
                ]);
              } else {
                Alert.alert('Erreur', 'Impossible d\'archiver cette conversation');
              }
            } catch (error) {
              console.error('Erreur:', error);
              Alert.alert('Erreur', 'Une erreur est survenue');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="rgba(10, 145, 104, 1)" />
      </View>
    );
  }

  const cachedGroups = getCachedGroups();
  const isGroup = cachedGroups?.some((g: any) => g.conversation_uuid === conversationId);
  const otherParticipant = conversation?.other_participant;
  
  const displayName = isGroup 
    ? (groupDetails?.name || conversation?.name || 'Groupe')
    : (userProfile?.surnom || userProfile?.username || otherParticipant?.surnom || otherParticipant?.username || 'Utilisateur');
  
  const avatarUrl = isGroup
    ? groupDetails?.avatar
    : (userProfile?.photo_profil_url || otherParticipant?.photo_profil_url);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {showMemberProfile ? (
        <FloatingHeader 
          title="Profil" 
          icon="person-outline"
          onBack={() => {
            console.log('🔙 Retour à la vue groupe');
            setShowMemberProfile(false);
          }}
        />
      ) : (
        <FloatingHeader title="Gestion" icon="settings-outline" />
      )}
      
      {showMemberProfile && selectedMemberProfile ? (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.profileSection}>
            <LinearGradient
              colors={['rgba(240, 250, 248, 1)', 'rgba(200, 235, 225, 1)']}
              style={styles.profileGradient}
            >
              <View style={styles.avatarWrapper}>
                {selectedMemberProfile.photo_profil_url ? (
                  <Image source={{ uri: selectedMemberProfile.photo_profil_url }} style={styles.largeAvatar} />
                ) : (
                  <DefaultAvatar name={selectedMemberProfile.surnom || selectedMemberProfile.username} size={120} />
                )}
              </View>
              
              <Text style={styles.profileName}>
                {selectedMemberProfile.surnom || selectedMemberProfile.username}
              </Text>
              
              {selectedMemberProfile.username && (
                <Text style={styles.username}>@{selectedMemberProfile.username}</Text>
              )}

              {selectedMemberProfile.bio && (
                <Text style={styles.bioText}>{selectedMemberProfile.bio}</Text>
              )}
              
              {selectedMemberStats && (
                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <Ionicons name="people-outline" size={18} color="rgba(10, 145, 104, 1)" />
                    <Text style={styles.statNumber}>{selectedMemberStats.total_connexions || 0}</Text>
                    <Text style={styles.statLabel}>Amis</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="calendar-outline" size={18} color="rgba(10, 145, 104, 1)" />
                    <Text style={styles.statNumber}>{selectedMemberStats.total_evenements || 0}</Text>
                    <Text style={styles.statLabel}>Événements</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="chatbubbles-outline" size={18} color="rgba(10, 145, 104, 1)" />
                    <Text style={styles.statNumber}>{selectedMemberStats.total_reponses || 0}</Text>
                    <Text style={styles.statLabel}>Réponses</Text>
                  </View>
                </View>
              )}
            </LinearGradient>
          </View>

          {/* Informations supplémentaires */}
          {(selectedMemberProfile.nationalite || selectedMemberProfile.date_naissance) && (
            <View style={styles.settingsSection}>
              <Text style={styles.sectionTitle}>Informations</Text>
              
              {selectedMemberProfile.nationalite && (
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="flag-outline" size={22} color="rgba(10, 145, 104, 1)" />
                    <Text style={styles.settingLabel}>Nationalité</Text>
                  </View>
                  <Text style={styles.settingValue}>{selectedMemberProfile.nationalite}</Text>
                </View>
              )}
              
              {selectedMemberProfile.date_naissance && (
                <View style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Ionicons name="calendar-outline" size={22} color="rgba(10, 145, 104, 1)" />
                    <Text style={styles.settingLabel}>Date de naissance</Text>
                  </View>
                  <Text style={styles.settingValue}>
                    {new Date(selectedMemberProfile.date_naissance).toLocaleDateString('fr-FR')}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>Actions</Text>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                console.log('Envoyer message à:', selectedMemberProfile.uuid);
              }}
            >
              <Ionicons name="chatbubble-outline" size={22} color="rgba(10, 145, 104, 1)" />
              <Text style={styles.actionButtonText}>Envoyer un message</Text>
              <Ionicons name="chevron-forward" size={20} color="#ccc" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.dangerButton]}
              onPress={() => Alert.alert('Bloquer', 'Fonctionnalité à venir')}
            >
              <Ionicons name="ban-outline" size={22} color="#dc2626" />
              <Text style={[styles.actionButtonText, styles.dangerText]}>Bloquer cet utilisateur</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.profileSection}>
            <LinearGradient
              colors={['rgba(240, 250, 248, 1)', 'rgba(200, 235, 225, 1)']}
              style={styles.profileGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.avatarWrapper}>
                {isGroup ? (
                  <View style={styles.groupAvatarContainer}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.largeAvatar} />
                    ) : (
                      <View style={[styles.largeAvatar, { backgroundColor: 'rgba(10, 145, 104, 0.2)' }]}>
                        <Ionicons name="people" size={50} color="rgba(10, 145, 104, 1)" />
                      </View>
                    )}
                  </View>
                ) : (
                  avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} style={styles.largeAvatar} />
                  ) : (
                    <DefaultAvatar name={displayName} size={120} />
                  )
                )}
              </View>

              <Text style={styles.profileName}>{displayName}</Text>
              
              {!isGroup && userProfile && (
                <>
                  {userProfile.username && (
                    <Text style={styles.username}>@{userProfile.username}</Text>
                  )}
                  {userProfile.bio && (
                    <Text style={styles.bioText}>{userProfile.bio}</Text>
                  )}
                  

                </>
              )}

              {isGroup && groupDetails && (
                <>
                  {groupDetails.description && (
                    <Text style={styles.bioText}>{groupDetails.description}</Text>
                  )}
                  <View style={styles.groupInfo}>
                    <Ionicons name="people" size={16} color="#666" />
                    <Text style={styles.groupInfoText}>
                      {groupDetails.member_count} membre{groupDetails.member_count > 1 ? 's' : ''}
                    </Text>
                  </View>
                </>
              )}
            </LinearGradient>
          </View>

          {isGroup && groupDetails && groupDetails.members && groupDetails.members.length > 0 && (
            <View style={styles.settingsSection}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.sectionTitle}>Membres ({groupDetails.member_count})</Text>
                {groupDetails.member_count > 10 && (
                  <TouchableOpacity onPress={() => console.log('Voir tous les membres')}>
                    <Text style={styles.seeAllText}>Voir tout</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              {groupDetails.members.slice(0, 10).map((member, index) => {
                const memberUser = typeof member.user === 'object' ? member.user : null;
                const displayName = member.surnom || memberUser?.surnom || member.username || memberUser?.username || 'Membre';
                const photoUrl = member.photo_profil_url || memberUser?.photo_profil_url;
                const memberUuid = member.user_uuid || memberUser?.uuid;
                
                return (
                  <TouchableOpacity 
                    key={memberUuid || index}
                    style={styles.memberRow}
                    onPress={async () => {
                      console.log('🔍 Clic sur membre, UUID:', memberUuid);
                      if (memberUuid) {
                        console.log('📞 Appel loadMemberProfile...');
                        await loadMemberProfile(memberUuid);
                        console.log('✅ loadMemberProfile terminé');
                      } else {
                        console.log('❌ Pas d\'UUID');
                      }
                    }}
                  >
                    <View style={styles.memberLeft}>
                      {photoUrl ? (
                        <Image source={{ uri: photoUrl }} style={styles.memberAvatar} />
                      ) : (
                        <DefaultAvatar name={displayName} size={40} />
                      )}
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{displayName}</Text>
                        <Text style={styles.memberRole}>
                          {member.role === 'owner' ? '👑 Propriétaire' : 
                           member.role === 'moderator' ? '⭐ Modérateur' : 
                           'Membre'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {/* Section Médias et Liens */}
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Médias, liens et documents</Text>
            <TouchableOpacity 
              style={styles.settingRow}
              onPress={() => {
                console.log('🎬 Clic sur Médias');
                console.log('📍 conversationId:', conversationId);
                console.log('📍 Type:', typeof conversationId);
                try {
                  router.push({
                    pathname: '/(screens)/conversation-media',
                    params: { 
                      conversationId: conversationId as string,
                      initialTab: 'photos'
                    }
                  });
                  console.log('✅ Navigation lancée');
                } catch (error) {
                  console.error('❌ Erreur navigation:', error);
                }
              }}
            >
            
              <View style={styles.settingLeft}>
                <Ionicons name="image-outline" size={22} color="rgba(10, 145, 104, 1)" />
                <Text style={styles.settingLabel}>Médias</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.settingValue}>{conversation?.media_count || 0}</Text>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.settingRow}
              onPress={() => {
                console.log('📄 Clic sur Documents');
                console.log('📍 conversationId:', conversationId);
                try {
                  router.push({
                    pathname: '/(screens)/conversation-media',
                    params: { 
                      conversationId: conversationId as string,
                      initialTab: 'documents'
                    }
                  });
                  console.log('✅ Navigation lancée');
                } catch (error) {
                  console.error('❌ Erreur navigation:', error);
                }
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="link-outline" size={22} color="rgba(10, 145, 104, 1)" />
                <Text style={styles.settingLabel}>Liens</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.settingValue}>{conversation?.link_count || 0}</Text>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.settingRow}
              onPress={() => router.push({
                pathname: '/(screens)/conversation-media',
                params: { 
                  conversationId: conversationId as string,
                  initialTab: 'documents'
                }
              })}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="document-outline" size={22} color="rgba(10, 145, 104, 1)" />
                <Text style={styles.settingLabel}>Documents</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.settingValue}>{conversation?.document_count || 0}</Text>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </View>
            </TouchableOpacity>
          </View>

          {isGroup && groupDetails && (
            <View style={styles.actionsSection}>
              <Text style={styles.sectionTitle}>Actions du groupe</Text>
              
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => router.push({
                  pathname: '/(tabs)/add-group-members',
                  params: {
                    groupUuid: groupDetails.uuid,
                    groupName: groupDetails.name,
                  }
                })}
              >
                <Ionicons name="person-add-outline" size={22} color="rgba(10, 145, 104, 1)" />
                <Text style={styles.actionButtonText}>Ajouter des membres</Text>
                <Ionicons name="chevron-forward" size={20} color="#ccc" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => console.log('Voir les membres')}
              >
                <Ionicons name="people-outline" size={22} color="rgba(10, 145, 104, 1)" />
                <Text style={styles.actionButtonText}>Voir les membres ({groupDetails.member_count})</Text>
                <Ionicons name="chevron-forward" size={20} color="#ccc" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={handleLeaveGroup}>
                <Ionicons name="exit-outline" size={22} color="#dc2626" />
                <Text style={[styles.actionButtonText, styles.dangerText]}>Quitter le groupe</Text>
              </TouchableOpacity>
            </View>
          )}

          {!isGroup && (
            <View style={styles.actionsSection}>
              <Text style={styles.sectionTitle}>Actions</Text>
              
              <TouchableOpacity style={styles.actionButton} onPress={handleArchive}>
                <Ionicons name="archive-outline" size={22} color="rgba(10, 145, 104, 1)" />
                <Text style={styles.actionButtonText}>Archiver la conversation</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={handleBlockUser}>
                <Ionicons name="ban-outline" size={22} color="#dc2626" />
                <Text style={[styles.actionButtonText, styles.dangerText]}>Bloquer l'utilisateur</Text>
              </TouchableOpacity>

            </View>
          )}



          <View style={styles.infoSection}>
            <Ionicons name="lock-closed" size={16} color="#888" />
            <Text style={styles.infoText}>
              {isGroup
                ? `Groupe créé le ${groupDetails?.created_at ? new Date(groupDetails.created_at).toLocaleDateString('fr-FR') : (conversation?.created_at ? new Date(conversation.created_at).toLocaleDateString('fr-FR') : 'N/A')}`
                : 'Les messages sont cryptés de bout en bout.'
              }
            </Text>
            {isGroup && groupDetails?.invite_code && (
              <Text style={[styles.infoText, { marginTop: 8, fontWeight: '600' }]}>
                Code d&apos;invitation : {groupDetails.invite_code}
              </Text>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  content: {
    flex: 1,
    paddingTop: 105,
  },
  
  profileSection: {
    marginBottom: 16,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: 'rgba(10, 145, 104, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    backgroundColor: '#fff',
  },
  profileGradient: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  avatarWrapper: {
    marginBottom: 15,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  groupAvatarContainer: {
    borderRadius: 60,
  },
  largeAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
    textAlign: 'center',
  },
  username: {
    fontSize: 15,
    color: '#666',
    marginTop: 4,
  },
  bioText: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(10, 145, 104, 0.1)',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgba(10, 145, 104, 1)',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    borderRadius: 20,
  },
  groupInfoText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

  settingsSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  settingValue: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  seeAllText: {
    fontSize: 14,
    color: 'rgba(10, 145, 104, 1)',
    fontWeight: '600',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  memberRole: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },

  actionsSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 15,
    color: 'rgba(10, 145, 104, 1)',
    fontWeight: '500',
  },
  dangerButton: {
    backgroundColor: '#fee',
  },
  dangerText: {
    color: '#dc2626',
  },

  infoSection: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 18,
  },
}); 