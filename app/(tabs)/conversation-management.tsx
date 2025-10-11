import DefaultAvatar from '@/components/DefaultAvatar';
import { FONTS } from '@/constants/fonts';
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
    Switch,
    Text,
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
  name?: string;
  description?: string;
  created_at?: string;
  members?: ConversationMember[];
  participants_detail?: ConversationMember[];
  other_participant?: ConversationMember;
  media_count?: number;
  link_count?: number;
  document_count?: number;
}

export default function ConversationManagement() {
  const { conversationId } = useLocalSearchParams();
  const { makeAuthenticatedRequest, user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [groupDetails, setGroupDetails] = useState<GroupDetails | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ephemeralMessages, setEphemeralMessages] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  useEffect(() => {
    loadConversationDetails();
  }, [conversationId]);

  const loadConversationDetails = async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/conversations/${conversationId}/`
      );
      
      if (response.ok) {
        const data = await response.json();
        setConversation(data);
        console.log('📋 Conversation chargée ID:', conversationId);
        console.log('📋 Participants count:', data.participants_detail?.length);
        
        // D'abord vérifier dans la liste des conversations si c'est un groupe
        const conversationsResponse = await makeAuthenticatedRequest(
          `${API_BASE_URL}/messaging/conversations/`
        );
        
        let conversationFromList = null;
        if (conversationsResponse.ok) {
          const convList = await conversationsResponse.json();
          conversationFromList = convList.find((c: any) => c.uuid === conversationId);
          console.log('📋 Conversation from list - other_participant:', conversationFromList?.other_participant);
        }
        
        // Si la conversation a un other_participant dans la liste, c'est une conversation privée
        if (conversationFromList?.other_participant) {
          console.log('✅ C\'est une conversation privée (other_participant présent)');
          return; // Ne pas charger les détails de groupe
        }
        
        // Sinon, vérifier si c'est un groupe
        const groupsResponse = await makeAuthenticatedRequest(
          `${API_BASE_URL}/groups/my-groups/`
        );
        
        let isGroupConv = false;
        if (groupsResponse.ok) {
          const groups = await groupsResponse.json();
          console.log('📋 Vérification si conversation fait partie des groupes...');
          
          // Charger les détails de chaque groupe pour obtenir leur conversation_uuid
          for (const group of groups) {
            try {
              const detailsResponse = await makeAuthenticatedRequest(
                `${API_BASE_URL}/groups/${group.uuid}/`
              );
              
              if (detailsResponse.ok) {
                const groupData = await detailsResponse.json();
                console.log('🔍 Vérif groupe:', groupData.name, 'conv_uuid:', groupData.conversation_uuid);
                
                // Vérifier si c'est le bon groupe
                if (groupData.conversation_uuid === conversationId) {
                  console.log('✅ C\'est un groupe:', groupData.name);
                  isGroupConv = true;
                  setGroupDetails(groupData);
                  console.log('✅ Détails groupe chargés:', {
                    name: groupData.name,
                    memberCount: groupData.member_count,
                    myRole: groupData.my_membership?.role,
                    membersLength: groupData.members?.length,
                    membersPreview: groupData.members?.slice(0, 2)
                  });
                  break;
                }
              }
            } catch (error) {
              console.error('❌ Erreur vérification groupe:', group.uuid, error);
            }
          }
        }
        
        if (!isGroupConv) {
          console.log('✅ C\'est une conversation privée (pas de groupe trouvé)');
        }
      }
    } catch (error) {
      console.error('Erreur chargement détails:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupDetails = async (conversationData: ConversationDetails) => {
    // Cette fonction est maintenant appelée depuis loadConversationDetails
    // avec le groupData déjà trouvé, donc on peut la simplifier
    // Mais gardons-la pour compatibilité
    console.log('🔎 loadGroupDetails appelé');
  };

  const handleDeleteConversation = () => {
    Alert.alert(
      'Supprimer la conversation',
      'Êtes-vous sûr de vouloir supprimer cette conversation ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/messaging/conversations/${conversationId}/`,
                { method: 'DELETE' }
              );
              if (response.ok) {
                router.back();
              }
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer');
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
              const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/groups/${groupDetails.uuid}/leave/`,
                { method: 'POST' }
              );
              if (response.ok) {
                router.back();
                router.back(); // Retour à la liste des conversations
              } else {
                Alert.alert('Erreur', 'Impossible de quitter le groupe');
              }
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de quitter le groupe');
            }
          }
        }
      ]
    );
  };

  const handleRemoveMember = (member: ConversationMember) => {
    if (!groupDetails) return;
    
    Alert.alert(
      'Retirer du groupe',
      `Voulez-vous retirer ${member.surnom || member.username} du groupe ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: async () => {
            try {
              const memberUuid = member.user_uuid || member.uuid;
              const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/groups/${groupDetails.uuid}/members/${memberUuid}/`,
                { method: 'DELETE' }
              );
              
              if (response.ok) {
                // Recharger les détails du groupe
                await loadConversationDetails();
                Alert.alert('Succès', 'Membre retiré du groupe');
              } else {
                Alert.alert('Erreur', 'Impossible de retirer ce membre');
              }
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de retirer ce membre');
            }
          }
        }
      ]
    );
  };

  const handleInviteMember = () => {
    if (!groupDetails) return;
    
    console.log('➕ Ouverture page ajout membres pour:', groupDetails.name);
    router.push({
      pathname: '/(screens)/add-group-members',
      params: {
        groupUuid: groupDetails.uuid,
        groupName: groupDetails.name
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="rgba(10, 145, 104, 1)" />
      </View>
    );
  }

  // Détecter si c'est un groupe : se baser sur groupDetails ou is_group
  const isGroup = !!groupDetails || conversation?.is_group === true;
  
  console.log('🎯 Détection groupe:', {
    hasGroupDetails: !!groupDetails,
    groupDetailsValue: groupDetails ? {
      name: groupDetails.name,
      uuid: groupDetails.uuid,
      membersCount: groupDetails.members?.length
    } : null,
    isGroup
  });
  
  // Normaliser les membres : parfois user est un objet, parfois juste un ID
  const rawMembers = groupDetails?.members || [];
  console.log('🔄 Normalisation membres:', {
    rawMembersCount: rawMembers.length,
    firstMember: rawMembers[0]
  });
  
  const members = rawMembers.map(member => {
    // Si user est un objet, extraire les infos
    if (member.user && typeof member.user === 'object') {
      const normalized = {
        ...member,
        user_uuid: member.user.uuid,
        username: member.user.username || member.username,
        surnom: member.user.surnom || member.surnom,
        photo_profil_url: member.user.photo_profil_url || member.photo_profil_url,
      };
      return normalized;
    }
    return member;
  });
  
  console.log('✅ Membres normalisés:', {
    count: members.length,
    preview: members.slice(0, 2).map(m => ({
      username: m.username,
      surnom: m.surnom,
      role: m.role
    }))
  });
  
  // Pour les conversations privées, trouver l'autre participant
  const contact = conversation?.participants_detail?.find(
    p => p.user_uuid !== user?.uuid
  );
  
  const isAdmin = groupDetails?.my_membership?.role === 'owner' || groupDetails?.my_membership?.role === 'moderator';
  const currentUserRole = groupDetails?.my_membership?.role;
  
  const participantsCount = conversation?.participants_detail?.length || 0;
  
  console.log('📊 État affichage:', {
    isGroup,
    participantsCount,
    hasContact: !!contact,
    contact: contact ? {
      username: contact.username,
      surnom: contact.surnom,
      user_uuid: contact.user_uuid
    } : null,
    hasGroupDetails: !!groupDetails,
    groupDetailsName: groupDetails?.name,
    memberCount: members.length,
    membersPreview: members.slice(0, 2).map(m => ({
      username: m.username,
      user_uuid: m.user_uuid,
      role: m.role
    })),
    isAdmin,
    currentUserRole,
    currentUserUuid: user?.uuid
  });

  // Composant pour une ligne de paramètre
  const SettingRow = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    showArrow = true, 
    rightElement,
    danger = false,
    first = false,
    last = false,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    showArrow?: boolean;
    rightElement?: React.ReactNode;
    danger?: boolean;
    first?: boolean;
    last?: boolean;
  }) => (
    <TouchableOpacity
      style={[
        styles.settingRow,
        first && styles.settingRowFirst,
        last && styles.settingRowLast,
      ]}
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, danger && styles.iconDanger]}>
        <Ionicons name={icon as any} size={22} color={danger ? '#ff6b6b' : 'rgba(10, 145, 104, 1)'} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && styles.settingTitleDanger]}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (showArrow && (
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      ))}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Bouton retour flottant */}
      <TouchableOpacity onPress={() => router.back()} style={styles.floatingBackButton}>
        <LinearGradient
          colors={['rgba(10, 145, 104, 0.95)', 'rgba(10, 145, 104, 0.85)']}
          style={styles.backButtonGradient}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Header flottant */}
      <LinearGradient
        colors={['rgba(10, 145, 104, 0.95)', 'rgba(10, 145, 104, 0.85)']}
        style={styles.floatingHeader}
      >
        <Ionicons name="settings-outline" size={20} color="#fff" />
        <Text style={styles.headerTitle}>
          {isGroup ? 'Paramètres du groupe' : 'Infos du contact'}
        </Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section Photo/Avatar */}
        <View style={styles.profileSection}>
          <LinearGradient
            colors={['rgba(10, 145, 104, 0.03)', 'rgba(10, 145, 104, 0.01)']}
            style={styles.profileGradient}
          >
            <View style={styles.avatarWrapper}>
              {isGroup ? (
                <View style={styles.groupAvatarContainer}>
                  <LinearGradient
                    colors={['rgba(10, 145, 104, 0.9)', 'rgba(10, 145, 104, 0.7)']}
                    style={styles.largeAvatar}
                  >
                    <Ionicons name="people" size={50} color="#fff" />
                  </LinearGradient>
                </View>
              ) : (!isGroup && contact) ? (
                contact.photo_profil_url ? (
                  <Image
                    source={{ uri: contact.photo_profil_url }}
                    style={styles.largeAvatar}
                    contentFit="cover"
                  />
                ) : (
                  <DefaultAvatar 
                    name={contact.surnom || contact.username || 'Contact'} 
                    size={120} 
                  />
                )
              ) : (
                <DefaultAvatar 
                  name="Contact" 
                  size={120} 
                />
              )}
            </View>
            <Text style={styles.profileName}>
              {isGroup 
                ? groupDetails?.name || conversation?.name || 'Groupe' 
                : contact?.surnom || contact?.username || 'Contact'
              }
            </Text>
            {contact?.is_ai && !isGroup && (
              <View style={styles.aiBadgeLarge}>
                <Ionicons name="flash" size={16} color="#fff" />
                <Text style={styles.aiBadgeTextLarge}>Agent IA</Text>
              </View>
            )}
            {isGroup && (groupDetails?.description || conversation?.description) && (
              <Text style={styles.groupDesc}>
                {groupDetails?.description || conversation?.description}
              </Text>
            )}
            {!isGroup && contact?.username && (
              <Text style={styles.username}>@{contact.username}</Text>
            )}
          </LinearGradient>
        </View>

        {/* Section Actions rapides - seulement pour conversations privées */}
        {!isGroup && (
          <View style={styles.quickActionsContainer}>
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={['rgba(10, 145, 104, 0.15)', 'rgba(10, 145, 104, 0.08)']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="search-outline" size={24} color="rgba(10, 145, 104, 1)" />
                  <Text style={styles.quickActionText}>Rechercher</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={['rgba(10, 145, 104, 0.15)', 'rgba(10, 145, 104, 0.08)']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="call-outline" size={24} color="rgba(10, 145, 104, 1)" />
                  <Text style={styles.quickActionText}>Appeler</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={['rgba(10, 145, 104, 0.15)', 'rgba(10, 145, 104, 0.08)']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="videocam-outline" size={24} color="rgba(10, 145, 104, 1)" />
                  <Text style={styles.quickActionText}>Vidéo</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Section Membres (si groupe) */}
        {isGroup && (
          <View style={styles.floatingCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="people" size={16} color="rgba(10, 145, 104, 1)" /> {groupDetails?.member_count || members.length} membre{((groupDetails?.member_count || members.length) > 1) ? 's' : ''}
              </Text>
              {isAdmin && (
                <TouchableOpacity style={styles.addButton} onPress={handleInviteMember}>
                  <LinearGradient
                    colors={['rgba(10, 145, 104, 0.2)', 'rgba(10, 145, 104, 0.1)']}
                    style={styles.addButtonGradient}
                  >
                    <Ionicons name="person-add" size={18} color="rgba(10, 145, 104, 1)" />
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
            
            <View style={styles.membersList}>
              {members.length === 0 && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#888', fontSize: 14 }}>
                    {groupDetails ? 'Aucun membre' : 'Chargement des membres...'}
                  </Text>
                </View>
              )}
              {members.map((member, index) => {
                const memberRole = member.role;
                const isOwner = memberRole === 'owner';
                const isModerator = memberRole === 'moderator';
                const canRemove = isAdmin && !isOwner && member.user_uuid !== user?.uuid;
                const memberName = member.surnom || member.username || 'Membre';
                const memberUsername = member.username || 'inconnu';
                
                return (
                  <View 
                    key={member.user_uuid || member.uuid || member.id} 
                    style={[
                      styles.memberRow,
                      index === members.length - 1 && styles.memberRowLast
                    ]}
                  >
                    <DefaultAvatar name={memberName} size={44} />
                    <View style={styles.memberInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.memberName}>{memberName}</Text>
                        {isOwner && (
                          <View style={styles.roleBadge}>
                            <Ionicons name="star" size={12} color="#FFD700" />
                            <Text style={styles.roleBadgeText}>Propriétaire</Text>
                          </View>
                        )}
                        {isModerator && (
                          <View style={[styles.roleBadge, { backgroundColor: 'rgba(10, 145, 104, 0.15)' }]}>
                            <Ionicons name="shield" size={12} color="rgba(10, 145, 104, 1)" />
                            <Text style={[styles.roleBadgeText, { color: 'rgba(10, 145, 104, 1)' }]}>Modérateur</Text>
                          </View>
                        )}
                        {member.is_ai && (
                          <View style={styles.aiBadgeSmall}>
                            <Ionicons name="flash" size={10} color="#fff" />
                            <Text style={styles.aiBadgeTextSmall}>IA</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.memberUsername}>@{memberUsername}</Text>
                    </View>
                    {canRemove && (
                      <TouchableOpacity 
                        style={styles.removeMemberButton}
                        onPress={() => handleRemoveMember(member)}
                      >
                        <Ionicons name="remove-circle" size={24} color="#ff6b6b" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
        
        {/* Actions pour groupes */}
        {isGroup && (
          <View style={styles.quickActionsContainer}>
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={['rgba(10, 145, 104, 0.15)', 'rgba(10, 145, 104, 0.08)']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="search-outline" size={24} color="rgba(10, 145, 104, 1)" />
                  <Text style={styles.quickActionText}>Rechercher</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={['rgba(10, 145, 104, 0.15)', 'rgba(10, 145, 104, 0.08)']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="create-outline" size={24} color="rgba(10, 145, 104, 1)" />
                  <Text style={styles.quickActionText}>Modifier</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={['rgba(10, 145, 104, 0.15)', 'rgba(10, 145, 104, 0.08)']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="image-outline" size={24} color="rgba(10, 145, 104, 1)" />
                  <Text style={styles.quickActionText}>Photo</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Section Médias, liens et documents */}
        <View style={styles.floatingCard}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="folder-outline" size={16} color="rgba(10, 145, 104, 1)" /> Médias, liens et documents
          </Text>
          
          <View style={styles.mediaGrid}>
            <TouchableOpacity style={styles.mediaItem}>
              <LinearGradient
                colors={['rgba(10, 145, 104, 0.12)', 'rgba(10, 145, 104, 0.06)']}
                style={styles.mediaItemGradient}
              >
                <Ionicons name="image-outline" size={32} color="rgba(10, 145, 104, 1)" />
                <Text style={styles.mediaCount}>{conversation?.media_count || 0}</Text>
                <Text style={styles.mediaLabel}>Médias</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaItem}>
              <LinearGradient
                colors={['rgba(10, 145, 104, 0.12)', 'rgba(10, 145, 104, 0.06)']}
                style={styles.mediaItemGradient}
              >
                <Ionicons name="link-outline" size={32} color="rgba(10, 145, 104, 1)" />
                <Text style={styles.mediaCount}>{conversation?.link_count || 0}</Text>
                <Text style={styles.mediaLabel}>Liens</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaItem}>
              <LinearGradient
                colors={['rgba(10, 145, 104, 0.12)', 'rgba(10, 145, 104, 0.06)']}
                style={styles.mediaItemGradient}
              >
                <Ionicons name="document-outline" size={32} color="rgba(10, 145, 104, 1)" />
                <Text style={styles.mediaCount}>{conversation?.document_count || 0}</Text>
                <Text style={styles.mediaLabel}>Fichiers</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Paramètres */}
        <View style={styles.floatingCard}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="settings-outline" size={16} color="rgba(10, 145, 104, 1)" /> Paramètres
          </Text>
          
          <View style={styles.settingsGroup}>
            <SettingRow
              icon="notifications-outline"
              title="Notifications"
              subtitle={notificationsEnabled ? "Activées" : "Désactivées"}
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: '#ccc', true: 'rgba(10, 145, 104, 0.3)' }}
                  thumbColor={notificationsEnabled ? 'rgba(10, 145, 104, 1)' : '#f4f3f4'}
                />
              }
              showArrow={false}
              first
            />
            
            <SettingRow
              icon="volume-high-outline"
              title="Son des notifications"
              subtitle={soundEnabled ? "Activé" : "Désactivé"}
              rightElement={
                <Switch
                  value={soundEnabled}
                  onValueChange={setSoundEnabled}
                  trackColor={{ false: '#ccc', true: 'rgba(10, 145, 104, 0.3)' }}
                  thumbColor={soundEnabled ? 'rgba(10, 145, 104, 1)' : '#f4f3f4'}
                />
              }
              showArrow={false}
            />
            
            <SettingRow
              icon="time-outline"
              title="Messages éphémères"
              subtitle={ephemeralMessages ? "Activés - 24h" : "Désactivés"}
              rightElement={
                <Switch
                  value={ephemeralMessages}
                  onValueChange={setEphemeralMessages}
                  trackColor={{ false: '#ccc', true: 'rgba(10, 145, 104, 0.3)' }}
                  thumbColor={ephemeralMessages ? 'rgba(10, 145, 104, 1)' : '#f4f3f4'}
                />
              }
              showArrow={false}
              last
            />
          </View>
        </View>

        {/* Section Personnalisation */}
        <View style={styles.floatingCard}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="brush-outline" size={16} color="rgba(10, 145, 104, 1)" /> Personnalisation
          </Text>
          
          <View style={styles.settingsGroup}>
            <SettingRow
              icon="color-palette-outline"
              title="Fond d'écran"
              subtitle="Personnaliser l'arrière-plan"
              onPress={() => Alert.alert('Fond d\'écran', 'Fonctionnalité à venir')}
              first
            />
            
            <SettingRow
              icon="star-outline"
              title="Messages importants"
              subtitle="0 messages marqués"
              onPress={() => Alert.alert('Messages importants', 'Aucun message marqué')}
              last
            />
          </View>
        </View>

        {/* Section Actions */}
        <View style={styles.floatingCard}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="shield-checkmark-outline" size={16} color="rgba(10, 145, 104, 1)" /> Sécurité & Actions
          </Text>
          
          <View style={styles.settingsGroup}>
            <SettingRow
              icon="lock-closed-outline"
              title="Cryptage"
              subtitle="Conversation cryptée de bout en bout"
              showArrow={false}
              first
            />
            
            <SettingRow
              icon="archive-outline"
              title="Archiver la conversation"
              onPress={() => Alert.alert('Archiver', 'Conversation archivée')}
            />
            
            <SettingRow
              icon="share-outline"
              title="Exporter la conversation"
              onPress={() => Alert.alert('Exporter', 'Export en cours...')}
              last
            />
          </View>
        </View>

        {/* Section Danger Zone */}
        <View style={styles.floatingCard}>
          <View style={styles.settingsGroup}>
            {!isGroup && (
              <SettingRow
                icon="ban-outline"
                title="Bloquer le contact"
                onPress={() => Alert.alert('Bloquer', 'Contact bloqué')}
                danger
                first={!isGroup}
              />
            )}
            
            <SettingRow
              icon="trash-outline"
              title="Supprimer la conversation"
              subtitle="Supprimer tout l'historique"
              onPress={handleDeleteConversation}
              danger
            />
            
            {isGroup && (
              <SettingRow
                icon="exit-outline"
                title="Quitter le groupe"
                onPress={handleLeaveGroup}
                danger
                last
              />
            )}
            
            {!isGroup && (
              <SettingRow
                icon="flag-outline"
                title="Signaler"
                subtitle="Signaler ce contact"
                onPress={() => Alert.alert('Signaler', 'Contact signalé aux modérateurs')}
                danger
                last
              />
            )}
          </View>
        </View>

        {/* Informations supplémentaires */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            {isGroup 
              ? `Groupe créé le ${groupDetails?.created_at ? new Date(groupDetails.created_at).toLocaleDateString('fr-FR') : (conversation?.created_at ? new Date(conversation.created_at).toLocaleDateString('fr-FR') : 'N/A')}`
              : 'Les messages et appels sont cryptés de bout en bout.'
            }
          </Text>
          {isGroup && groupDetails?.invite_code && (
            <Text style={[styles.infoText, { marginTop: 8, fontWeight: '600' }]}>
              Code d'invitation : {groupDetails.invite_code}
            </Text>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  floatingBackButton: {
    position: 'absolute',
    top: 70,
    left: 20,
    zIndex: 20,
    shadowColor: 'rgba(10, 145, 104, 0.5)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  backButtonGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingHeader: {
    position: 'absolute',
    top: 70,
    left: 84,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    zIndex: 10,
    shadowColor: 'rgba(10, 145, 104, 0.5)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: FONTS.bold,
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingTop: 120,
  },
  
  // Section Profil
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
    fontFamily: FONTS.bold,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  username: {
    fontSize: 15,
    color: '#666',
    marginTop: 4,
    fontFamily: FONTS.regular,
  },
  aiBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 145, 104, 1)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 8,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  aiBadgeTextLarge: {
    color: '#fff',
    fontSize: 14,
    fontFamily: FONTS.bold,
  },
  groupDesc: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 22,
  },

  // Actions rapides - Container flottant
  quickActionsContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: 'rgba(10, 145, 104, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    backgroundColor: '#fff',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  quickAction: {
    flex: 1,
    marginHorizontal: 6,
  },
  quickActionGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 18,
    shadowColor: 'rgba(10, 145, 104, 0.15)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  quickActionText: {
    marginTop: 10,
    fontSize: 13,
    color: 'rgba(10, 145, 104, 1)',
    fontWeight: '700',
  },

  // Cards flottantes
  floatingCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: 'rgba(10, 145, 104, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    marginBottom: 16,
    letterSpacing: 0.8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: 'rgba(10, 145, 104, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonGradient: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Membres
  membersList: {
    marginTop: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  memberRowLast: {
    borderBottomWidth: 0,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 14,
  },
  memberName: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  memberUsername: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B8860B',
  },
  removeMemberButton: {
    padding: 8,
    marginLeft: 8,
  },
  aiBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(10, 145, 104, 1)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  aiBadgeTextSmall: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  viewAllButton: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  viewAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  viewAllText: {
    color: 'rgba(10, 145, 104, 1)',
    fontSize: 15,
    fontWeight: '700',
  },

  // Médias
  mediaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
  },
  mediaItem: {
    flex: 1,
  },
  mediaItemGradient: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  mediaCount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 10,
  },
  mediaLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontWeight: '600',
  },

  // Paramètres
  settingsGroup: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fafafa',
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  settingRowFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  settingRowLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(10, 145, 104, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconDanger: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  settingTitleDanger: {
    color: '#ff6b6b',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 3,
  },

  // Info Section
  infoSection: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});