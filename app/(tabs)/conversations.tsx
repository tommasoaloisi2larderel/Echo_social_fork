import { styles } from '@/styles/appStyles';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import React, { ComponentRef, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CreateGroupModal } from '../../components/CreateGroupModal';
import DefaultAvatar from '../../components/DefaultAvatar';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useTransition } from '../../contexts/TransitionContext';

// Import type pour forcer TypeScript à reconnaître la route

// Types pour les données des conversations
interface Conversation {
  id: number;
  uuid: string;
  last_message: {
    content: string;
    sender_username: string;
    created_at: string;
  } | null;
  other_participant: {
    uuid: string;
    username: string;
    surnom: string;
    photo_profil_url?: string;
  } | null; // ← Peut être null
  unread_count: number;
  created_at: string;
  updated_at: string;
}

// Type pour les utilisateurs dans les résultats de recherche
interface User {
  uuid: string;
  username: string;
  surnom: string;
  photo_profil_url?: string;
  is_friend?: boolean;
}

// Type pour les connexions (amis)
interface Connection {
  id: number;
  uuid: string;
  user_uuid?: string; // UUID de l'utilisateur si différent du uuid de la connexion
  username: string;
  surnom: string;
  first_name?: string;
  last_name?: string;
  photo_profil_url?: string;
  statut_relation?: string;
}

// Type pour les groupes
interface Group {
  id: number;
  uuid: string;
  name: string;
  description?: string;
  avatar?: string | null;
  member_count: number;
  my_role?: 'owner' | 'moderator' | 'member';
  unread_messages?: number;
  created_at: string;
  conversation_uuid?: string;
}

// Type pour les membres de groupe
interface GroupMember {
  id: number;
  user: number;
  username: string;
  user_uuid: string;
  surnom?: string;
  role: 'owner' | 'moderator' | 'member';
  photo_profil_url?: string | null;
  joined_at: string;
}

// Type pour les invitations de groupe
interface GroupInvitation {
  id: number;
  uuid: string;
  group: {
    uuid: string;
    name: string;
    description?: string;
    member_count: number;
  };
  created_by: {
    uuid: string;
    username: string;
    photo_profil_url?: string | null;
  };
  invitation_type: 'official' | 'member_request';
  status: 'sent' | 'viewed' | 'pending' | 'accepted' | 'declined' | 'expired';
  message?: string;
  created_at: string;
  expires_at: string;
}

const SearchBar = ({ query, setQuery }: { query: string; setQuery: (q: string) => void }) => (
  <View style={styles.searchContainer}>
    <TextInput
      style={styles.searchInput}
      placeholder="Search for a conversation"
      placeholderTextColor="#777"
      value={query}
      onChangeText={setQuery}
    />
  </View>
);


const ConversationSquare = ({ 
  name, 
  unread, 
  onPress,
  photoUrl,
  squareRef
}: { 
  name: string; 
  unread: boolean; 
  onPress: () => void;
  photoUrl?: string;
  squareRef?: React.RefObject<ComponentRef<typeof TouchableOpacity>>;
}) => (
  <TouchableOpacity
    ref={squareRef}
    style={[
      styles.conversationSquare,
      {
        shadowColor: unread ? "rgba(10, 145, 104, 0.8)" : "#777",
        shadowOpacity: 0.6,
      },
    ]}
    onPress={onPress}
  >
    {photoUrl ? (
      <Image source={{ uri: photoUrl }} style={styles.avatar} />
    ) : (
      <DefaultAvatar name={name} size={110} style={styles.avatar} />
    )}
    <View style={styles.conversationNameBadge}>
      <Text style={styles.conversationName} numberOfLines={1}>
        {name}
      </Text>
    </View>
  </TouchableOpacity>
);

// Composant pour afficher un utilisateur dans les résultats de recherche
const UserSquare = ({ 
  user, 
  onPress,
}: { 
  user: User; 
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={[
      styles.conversationSquare,
      {
        shadowColor: "#777",
        shadowOpacity: 0.4,
      },
    ]}
    onPress={onPress}
  >
    {user.photo_profil_url ? (
      <Image source={{ uri: user.photo_profil_url }} style={styles.avatar} />
    ) : (
      <DefaultAvatar name={user.surnom || user.username} size={110} style={styles.avatar} />
    )}
    <View style={styles.conversationNameBadge}>
      <Text style={styles.conversationName} numberOfLines={1}>
        {user.surnom || user.username}
      </Text>
    </View>
  </TouchableOpacity>
);

const GroupSquare = React.memo(({ 
  group, 
  onPress,
}: { 
  group: Group; 
  onPress: () => void;
}) => {
  if (!group) {
    console.warn('⚠️ GroupSquare reçu un groupe null');
    return null;
  }

  const groupName = group.name || 'Groupe';
  const memberCount = typeof group.member_count === 'number' ? group.member_count : 0;
  const unreadCount = typeof group.unread_messages === 'number' ? group.unread_messages : 0;

  return (
    <TouchableOpacity
      style={[
        styles.conversationSquare,
        {
          shadowColor: "#777",
          shadowOpacity: 0.4,
        },
      ]}
      onPress={onPress}
    >
      {group.avatar ? (
        <Image source={{ uri: group.avatar }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: 'rgba(10, 145, 104, 0.2)', justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="people" size={40} color="rgba(10, 145, 104, 1)" />
        </View>
      )}
      {unreadCount > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{unreadCount}</Text>
        </View>
      )}
      <View style={styles.conversationNameBadge}>
        <Text style={styles.conversationName} numberOfLines={1}>
          {groupName}
        </Text>
        <Text style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
          {memberCount} membre{memberCount > 1 ? 's' : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

GroupSquare.displayName = 'GroupSquare';

export default function ConversationsScreen() {
  const pathname = usePathname();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { makeAuthenticatedRequest, user } = useAuth(); // Utiliser la nouvelle fonction
  const { setTransitionPosition } = useTransition();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<'direct' | 'group'>('direct');
  const {
    prefetchConversation,
    prefetchAvatars,
    getCachedConversations,
    setCachedConversations,
    getCachedConnections,
    setCachedConnections,
    getCachedGroups,
    setCachedGroups,
    getCachedGroupInvitations,
    setCachedGroupInvitations,
    prefetchConversationsOverview,
  } = useChat();
  const squareRefs = useRef<Map<string, React.RefObject<ComponentRef<typeof TouchableOpacity>>>>(new Map());
  
  // États pour la recherche d'utilisateurs
  const [searchResults, setSearchResults] = useState<{ friends: User[], strangers: User[] }>({ friends: [], strangers: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [myConnections, setMyConnections] = useState<Connection[]>([]);
  
  // États pour les groupes
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupInvitations, setGroupInvitations] = useState<GroupInvitation[]>([]);
  
  // Utilise le proxy local pour éviter CORS en développement web
  const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? "http://localhost:3001"
    : "https://reseausocial-production.up.railway.app";

  // Forcer la route base sur /conversations pour éviter le “rebascule” vers Home
  useEffect(() => {
    try {
      if (!pathname.includes('/conversations')) {
        router.replace('/(tabs)/conversations');
      }
    } catch {}
    // volontairement [] pour ne déclencher qu'au montage de l'écran
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fonction pour récupérer les conversations
  const fetchConversations = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/conversations/`
      );

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Conversations récupérées:', data);
      const list = data.results || data;
      setConversations(list);
      setCachedConversations(list);
      // Précharger avatars de la liste de conversations
      try {
        const avatarUrls: string[] = [];
        (Array.isArray(data.results ? data.results : data) ? (data.results || data) : []).forEach((c: any) => {
          const url = c.other_participant?.photo_profil_url || c.group?.avatar;
          if (url) avatarUrls.push(url);
        });
        await prefetchAvatars(avatarUrls);
      } catch {}
      
    } catch (error) {
      console.error('Erreur lors du chargement des conversations:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      if (errorMessage.includes('Token expiré')) {
        // L'utilisateur sera automatiquement déconnecté
        return;
      }
      Alert.alert(
        'Erreur', 
        'Impossible de charger les conversations. Vérifiez votre connexion.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fonction pour rechercher tous les utilisateurs
  const searchAllUsers = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSearchResults({ friends: [], strangers: [] });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      // Récupérer tous les utilisateurs
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/api/users/`
      );

      if (!response.ok) {
        console.log(`Erreur lors de la récupération des utilisateurs (${response.status})`);
        throw new Error(`Erreur ${response.status}: Impossible de récupérer la liste des utilisateurs`);
      }

      const data = await response.json();
      let allUsers: User[] = Array.isArray(data) ? data : (data.results || []);
      
      // Filtrer localement par surnom ou username
      const users = allUsers.filter(u => {
        const surnom = (u.surnom || '').toLowerCase();
        const username = (u.username || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return surnom.includes(query) || username.includes(query);
      });
      
      // Créer un Set avec les UUIDs des connexions (user_uuid en priorité, sinon uuid)
      const connectionUuids = new Set(myConnections.map(c => c.user_uuid || c.uuid));
      
      console.log('🔍 Utilisateurs trouvés:', users.length);
      console.log('📋 Connexions actives:', myConnections.length);
      console.log('👥 UUIDs des connexions:', Array.from(connectionUuids));
      
      // Séparer les résultats en amis (connexions acceptées) et inconnus (tous les autres)
      const friends = users.filter(u => connectionUuids.has(u.uuid));
      const strangers = users.filter(u => !connectionUuids.has(u.uuid));
      
      console.log('✅ Amis trouvés:', friends.length, friends.map(f => f.surnom || f.username));
      console.log('🆕 Inconnus trouvés:', strangers.length, strangers.map(s => s.surnom || s.username));
      
      setSearchResults({ friends, strangers });
    } catch (error) {
      console.error('Erreur lors de la recherche d\'utilisateurs:', error);
      setSearchResults({ friends: [], strangers: [] });
    } finally {
      setIsSearching(false);
    }
  };

  // Fonction pour récupérer les connexions
  const fetchConnections = async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/relations/connections/my-connections/`
      );
      
      if (response.ok) {
        const data = await response.json();
        const connections: Connection[] = data.connexions || [];
        setMyConnections(connections);
        setCachedConnections(connections);
        console.log('📱 Connexions chargées:', connections.length, connections.map(c => c.surnom || c.username));
        console.log('📋 Structure première connexion:', JSON.stringify(connections[0], null, 2));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des connexions:', error);
    }
  };

  // Fonction pour récupérer les groupes
  const fetchGroups = async () => {
    try {
      console.log('📡 Chargement des groupes...');
      
      // D'abord récupérer toutes les conversations pour filtrer
      const conversationsResponse = await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/conversations/`
      );
      
      const privateConversationUuids = new Set<string>();
      if (conversationsResponse.ok) {
        const convList = await conversationsResponse.json();
        // Marquer toutes les conversations avec other_participant comme privées
        convList.forEach((c: any) => {
          if (c.other_participant) {
            privateConversationUuids.add(c.uuid);
            console.log('🔒 Conv privée détectée:', c.uuid, '- participant:', c.other_participant.username);
          }
        });
        console.log('🔒 Conversations privées trouvées:', privateConversationUuids.size);
      }
      
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/groups/my-groups/`
      );
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Groupes de base récupérés:', data.length);
        
        // /groups/my-groups/ ne retourne pas conversation_uuid
        // Il faut charger les détails de chaque groupe
        const groupsWithDetails = [];
        
        for (const group of data) {
          try {
            console.log('🔍 Chargement détails pour:', group.name);
            const detailsResponse = await makeAuthenticatedRequest(
              `${API_BASE_URL}/groups/${group.uuid}/`
            );
            
            if (detailsResponse.ok) {
              const groupDetails = await detailsResponse.json();
              const convUuid = groupDetails.conversation_uuid;
              
              console.log('🔍 Détails complets pour', group.name, ':', JSON.stringify({
                conversation_uuid: convUuid,
                my_role: groupDetails.my_role,
                my_membership: groupDetails.my_membership,
                member_count: groupDetails.member_count
              }, null, 2));
              
              // Vérifier si c'est vraiment un conflit (groupe avec my_role devrait être affiché)
              const hasGroupRole = groupDetails.my_membership || groupDetails.my_role;
              if (convUuid && privateConversationUuids.has(convUuid) && !hasGroupRole) {
                console.warn('⚠️ Groupe', group.name, 'a un conversation_uuid qui est une conv privée, ignoré');
                console.warn('   → conversation_uuid:', convUuid);
                console.warn('   → group_uuid:', group.uuid);
                console.warn('   → my_role:', groupDetails.my_role, 'my_membership:', groupDetails.my_membership);
                continue;
              }
              
              if (convUuid && privateConversationUuids.has(convUuid)) {
                console.log('⚠️ CONFLIT détecté pour', group.name, '- mais le groupe a un rôle, donc affiché quand même');
              }
              
              console.log('✅ Détails récupérés pour', group.name, '- conversation_uuid:', convUuid);
              groupsWithDetails.push({
                ...group,
                conversation_uuid: convUuid,
                members: groupDetails.members,
                my_membership: groupDetails.my_membership,
                invite_code: groupDetails.invite_code,
              });
            } else {
              console.error('❌ Erreur HTTP pour', group.name, ':', detailsResponse.status);
              groupsWithDetails.push(group);
            }
          } catch (error) {
            console.error('❌ Erreur chargement détails groupe:', group.name, error);
            // Garder le groupe même si on ne peut pas charger les détails
            groupsWithDetails.push(group);
          }
        }
        
        setGroups(groupsWithDetails);
        setCachedGroups(groupsWithDetails);
        console.log('👥 Groupes chargés:', groupsWithDetails.length, groupsWithDetails.map((g: any) => g.name));
        console.log('📋 Groupes avec conversation_uuid:', JSON.stringify(groupsWithDetails.map((g: any) => ({
          name: g.name,
          uuid: g.uuid,
          conversation_uuid: g.conversation_uuid
        })), null, 2));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des groupes:', error);
    }
  };

  // Fonction pour récupérer les invitations de groupe
  const fetchGroupInvitations = async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/groups/invitations/received/`
      );
      if (response.ok) {
        const data = await response.json();
        setGroupInvitations(data);
        setCachedGroupInvitations(data);
        console.log('📨 Invitations de groupe:', data.length);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des invitations:', error);
    }
  };

  // Fonction pour créer un nouveau groupe
  const createGroup = async (name: string, description: string) => {
    try {
      console.log('🆕 Création groupe:', name);
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/groups/create/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Erreur création groupe:', errorData);
        throw new Error(errorData.detail || errorData.error || `Erreur ${response.status}`);
      }

      const newGroup = await response.json();
      console.log('✅ Groupe créé:', newGroup.name, 'UUID:', newGroup.uuid, 'Conversation:', newGroup.conversation_uuid);
      console.log('📋 Données complètes du groupe:', JSON.stringify(newGroup, null, 2));
      
      // Ajouter le nouveau groupe à la liste
      setGroups(prev => [newGroup, ...prev]);
      
      Alert.alert(
        'Succès',
        `Le groupe "${name}" a été créé avec succès !`
      );

      // Si le groupe a une conversation, on peut l'ouvrir
      if (newGroup.conversation_uuid) {
        console.log('🎯 Ouverture conversation groupe:', newGroup.conversation_uuid);
        router.push({
          pathname: '/(tabs)/conversation-group',
          params: { conversationId: newGroup.conversation_uuid }
        });
      } else {
        console.warn('⚠️ Le groupe créé n\'a pas de conversation_uuid');
      }
    } catch (error) {
      console.error('❌ Erreur lors de la création du groupe:', error);
      throw error;
    }
  };

  // Charger depuis le cache au montage pour affichage instantané, puis rafraîchir en arrière-plan léger
  useEffect(() => {
    const cachedConvs = getCachedConversations();
    const cachedConns = getCachedConnections();
    const cachedGroups = getCachedGroups();
    const cachedInvites = getCachedGroupInvitations();

    if (cachedConvs) {
      setConversations(cachedConvs as any);
      // Précharger avatars pour un rendu encore plus fluide
      try {
        const avatarUrls: string[] = [];
        (cachedConvs as any[]).forEach((c: any) => {
          const url = c.other_participant?.photo_profil_url || c.group?.avatar;
          if (url) avatarUrls.push(url);
        });
        prefetchAvatars(avatarUrls);
      } catch {}
    }
  if (cachedConns) setMyConnections(cachedConns as any);
  // Hydrater immédiatement les groupes/invitations pour que l'onglet Groupe s'affiche instantanément
  if (cachedGroups) setGroups(cachedGroups as any);
  if (cachedInvites) setGroupInvitations(cachedInvites as any);

    // Si on a déjà des conversations en cache, pas de spinner
    setLoading(!(cachedConvs && (cachedConvs as any[]).length > 0));

    // Rafraîchissement léger en arrière-plan (sans changer loading)
    fetchConversations(true);
    fetchConnections();
    // Les groupes sont chargés uniquement lors du passage en mode 'group'
  }, []); // Supprimer accessToken des dépendances

  // Charger les groupes quand on passe en mode Groupe
  useEffect(() => {
    if (viewMode === 'group') {
      fetchGroups();
      fetchGroupInvitations();
    }
  }, [viewMode]);

  // Déclencher la recherche quand la query change (seulement en mode Privé)
  useEffect(() => {
    if (viewMode === 'direct') {
      const timeoutId = setTimeout(() => {
        searchAllUsers(query);
      }, 300); // Debounce de 300ms
      
      return () => clearTimeout(timeoutId);
    } else {
      // En mode Groupe, réinitialiser les résultats de recherche
      setSearchResults({ friends: [], strangers: [] });
    }
  }, [query, myConnections, viewMode]);

  // Fonction de rafraîchissement (pull-to-refresh)
  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations(true);
    fetchConnections();
  };

  // Déclencher le préchargement pour les éléments visibles
  const handleItemVisibility = async (items: typeof displayItems) => {
    try {
      const candidateIds = items
        .map((it) => it.conversationId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
        .slice(0, 9); // limiter pour éviter surcharge
      await Promise.allSettled(candidateIds.map((id) => prefetchConversation(id, makeAuthenticatedRequest)));
    } catch {}
  };

  // Fonction pour créer ou ouvrir une conversation avec un utilisateur
  const handleUserPress = async (userUuid: string, userName: string) => {
    try {
      // Vérifier s'il existe déjà une conversation avec cet utilisateur (ami)
      const existingConversation = conversations.find(
        c => c.other_participant?.uuid === userUuid
      );

      if (existingConversation) {
        // C'est un ami, ouvrir la conversation existante
        router.push({
          pathname: '/(tabs)/conversation-direct',
          params: { conversationId: existingConversation.uuid }
        });
      } else {
        // Ce n'est pas encore un ami, envoyer une demande de connexion
        Alert.alert(
          'Envoyer une demande',
          `Voulez-vous envoyer une demande de connexion à ${userName} ?`,
          [
            {
              text: 'Annuler',
              style: 'cancel'
            },
            {
              text: 'Envoyer',
              onPress: async () => {
                try {
                  console.log('📤 Envoi demande de connexion pour UUID:', userUuid);
                  
                  const response = await makeAuthenticatedRequest(
                    `${API_BASE_URL}/relations/connections/`,
                    {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        destinataire_uuid: userUuid,
                        message: `Bonjour ${userName}, je souhaite te connecter !`,
                      }),
                    }
                  );

                  console.log('📥 Réponse statut:', response.status);

                  if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('❌ Erreur détails:', errorData);
                    
                    // Gérer les cas d'erreur spécifiques
                    let errorMessage = 'Impossible d\'envoyer la demande de connexion.';
                    
                    if (errorData.detail) {
                      errorMessage = errorData.detail;
                    } else if (errorData.error) {
                      errorMessage = errorData.error;
                    } else if (errorData.non_field_errors) {
                      errorMessage = errorData.non_field_errors[0];
                    } else if (errorData.destinataire_uuid) {
                      errorMessage = `UUID invalide: ${errorData.destinataire_uuid[0]}`;
                    }
                    
                    throw new Error(errorMessage);
                  }

                  await response.json();
                  console.log('✅ Demande envoyée avec succès');
                  
                  Alert.alert(
                    'Demande envoyée',
                    `Votre demande de connexion a été envoyée à ${userName}. Vous pourrez discuter une fois qu'elle sera acceptée.`
                  );
                } catch (error) {
                  console.error('Erreur lors de l\'envoi de la demande de connexion:', error);
                  const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
                  
                  Alert.alert(
                    'Erreur',
                    errorMessage.includes('existe déjà') || errorMessage.includes('déjà')
                      ? 'Une demande de connexion existe déjà avec cet utilisateur.'
                      : errorMessage
                  );
                }
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Erreur lors de la gestion de l\'utilisateur:', error);
      Alert.alert(
        'Erreur',
        'Une erreur est survenue.'
      );
    }
  };

    
    // Affichage de chargement
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="rgba(10, 145, 104, 1)" />
        <Text style={{ marginTop: 10, color: '#666' }}>Chargement...</Text>
      </View>
    );
  }

  // Helpers to detect 1-on-1 vs group
  const isDirect = (c: Conversation) => !!c.other_participant;
  const isGroup = (c: Conversation) => !c.other_participant;

  const modeFiltered = conversations.filter((c) =>
    viewMode === 'direct' ? isDirect(c) : isGroup(c)
  );

  // Créer une liste selon le mode sélectionné
  let displayItems: {
    uuid: string;
    name: string;
    photoUrl?: string;
    unread: boolean;
    conversationId?: string;
    hasConversation: boolean;
    isGroup?: boolean;
    memberCount?: number;
    unreadMessages?: number;
  }[] = [];

  if (viewMode === 'direct') {
    // Mode Privé : afficher tous les amis (avec ou sans conversation)
    displayItems = myConnections.map(friend => {
      // Utiliser user_uuid si disponible, sinon uuid
      const friendUuid = friend.user_uuid || friend.uuid;
      
      // Trouver la conversation correspondante s'il y en a une
      const conversation = conversations.find(c => 
        c.other_participant?.uuid === friendUuid || 
        c.other_participant?.uuid === friend.uuid
      );
      
      return {
        uuid: friendUuid,
        name: friend.surnom || friend.username,
        photoUrl: friend.photo_profil_url,
        unread: conversation ? conversation.unread_count > 0 : false,
        conversationId: conversation?.uuid,
        hasConversation: !!conversation,
      };
    });
  } else {
    // Mode Groupe : afficher les groupes depuis l'API /groups/my-groups/
    displayItems = groups.map(group => ({
      uuid: group.uuid,
      name: group.name,
      photoUrl: group.avatar || undefined,
      unread: false, // L'unread sera géré via group.unread_messages
      conversationId: group.conversation_uuid,
      hasConversation: !!group.conversation_uuid,
      isGroup: true,
      memberCount: group.member_count,
      unreadMessages: group.unread_messages || 0,
    }));
  }

  // Filtrer selon la recherche
  const filteredFriends = query.trim()
    ? displayItems.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
    : displayItems;

  // Afficher les "autres utilisateurs" seulement si on a une recherche active en mode Privé
  const showStrangers = viewMode === 'direct' && query.trim().length > 0 && searchResults.strangers.length > 0;
  
  return (
    <View style={[styles.container, { paddingTop: (insets.top || 0) + 0 }]}> 
      <SearchBar query={query} setQuery={setQuery} />

      {/* Toggle 1-on-1 / Groupes */}
      <View style={localStyles.toggleContainer}>
        <TouchableOpacity
          style={[localStyles.toggleButton, viewMode === 'direct' && localStyles.toggleActive]}
          onPress={() => setViewMode('direct')}
          activeOpacity={0.8}
        >
          <Ionicons name="person-outline" size={16} color={viewMode === 'direct' ? '#fff' : '#666'} />
          <Text style={[localStyles.toggleLabel, viewMode === 'direct' && localStyles.toggleLabelActive]}>Privé</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[localStyles.toggleButton, viewMode === 'group' && localStyles.toggleActive]}
          onPress={() => setViewMode('group')}
          activeOpacity={0.8}
        >
          <Ionicons name="people-outline" size={16} color={viewMode === 'group' ? '#fff' : '#666'} />
          <Text style={[localStyles.toggleLabel, viewMode === 'group' && localStyles.toggleLabelActive]}>Groupe</Text>
        </TouchableOpacity>
      </View>

      {/* Header Créer un groupe (en mode Groupe avec recherche) */}
      {viewMode === 'group' && query.trim().length > 0 && (
        <TouchableOpacity
          style={[localStyles.categoryHeaderSearch, { marginTop: 160 }]}
          onPress={() => {
            console.log('🆕 Création groupe depuis header');
            setShowCreateGroupModal(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle" size={18} color="rgba(10, 145, 104, 1)" />
          <Text style={localStyles.categoryTitleSearch}>Créer un groupe</Text>
          <Ionicons name="chevron-forward" size={18} color="rgba(10, 145, 104, 1)" />
        </TouchableOpacity>
      )}

      {/* Grille de conversations avec section "Autres utilisateurs" si recherche */}
      {filteredFriends.length === 0 && !showStrangers && !(viewMode === 'group' && query.trim().length > 0) ? (
        <View style={localStyles.emptyConversationsContainer}>
          <Ionicons 
            name={viewMode === 'direct' ? "person-outline" : "people-outline"} 
            size={80} 
            color="rgba(10, 145, 104, 0.3)" 
          />
          <Text style={localStyles.emptyConversationsTitle}>
            {viewMode === 'direct' ? 'Aucun ami' : 'Aucun groupe'}
          </Text>
          <Text style={localStyles.emptyConversationsText}>
            {viewMode === 'direct' 
              ? 'Utilisez la barre de recherche pour trouver des personnes et commencer à discuter'
              : 'Vous n\'avez pas encore de conversation de groupe'
            }
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
          onLayout={() => handleItemVisibility(filteredFriends)}
          onScrollEndDrag={() => handleItemVisibility(filteredFriends)}
        >
          {/* Grille des amis (toujours affichée) */}
      <FlatList
            data={filteredFriends}
        keyExtractor={(item) => item.uuid}
        renderItem={({ item }) => {
          // Si c'est un groupe, utiliser GroupSquare
          if (item.isGroup) {
            const group = groups.find(g => g.uuid === item.uuid);
            if (group) {
              return (
                <GroupSquare
                  group={group}
                  onPress={async () => {
                    console.log('🔍 Clic sur groupe:', {
                      name: group.name,
                      uuid: group.uuid,
                      conversation_uuid: group.conversation_uuid
                    });
                    
                    if (group.conversation_uuid) {
                      console.log('👥 Ouverture groupe:', group.name, 'conversation:', group.conversation_uuid);
        router.push({
          pathname: '/(tabs)/conversation-group',
          params: { conversationId: group.conversation_uuid }
        });
                    } else {
                      // Le groupe devrait avoir un conversation_uuid dès la création
                      // Si ce n'est pas le cas, recharger les données du groupe
                      console.log('⚠️ Groupe sans conversation_uuid, rechargement...');
                      try {
                        const response = await makeAuthenticatedRequest(
                          `${API_BASE_URL}/groups/${group.uuid}/`
                        );
                        
                        if (!response.ok) {
                          console.error('❌ Erreur rechargement:', response.status);
                          throw new Error(`Erreur ${response.status}`);
                        }
                        
                        const updatedGroup = await response.json();
                        console.log('✅ Groupe rechargé:', {
                          name: updatedGroup.name,
                          conversation_uuid: updatedGroup.conversation_uuid
                        });
                        
                        // Mettre à jour le groupe dans la liste
                        setGroups(prev => prev.map(g => 
                          g.uuid === group.uuid ? {
                            ...updatedGroup,
                            conversation_uuid: updatedGroup.conversation_uuid
                          } : g
                        ));
                        
                        if (updatedGroup.conversation_uuid) {
                          // Ouvrir la conversation maintenant
                          console.log('✅ Ouverture conversation:', updatedGroup.conversation_uuid);
                          router.push({
                            pathname: '/(tabs)/conversation-group',
                            params: { conversationId: updatedGroup.conversation_uuid }
                          });
                        } else {
                          console.error('❌ Groupe rechargé mais pas de conversation_uuid');
                          Alert.alert(
                            'Erreur', 
                            'Ce groupe n\'a pas encore de conversation associée. Veuillez réessayer plus tard.'
                          );
                        }
                      } catch (error) {
                        console.error('❌ Erreur lors du rechargement du groupe:', error);
                        Alert.alert('Erreur', 'Impossible d\'ouvrir le groupe.');
                      }
                    }
                  }}
                />
              );
            }
            return null;
          }

          // Sinon, c'est une conversation directe
          if (!squareRefs.current.has(item.uuid)) {
                squareRefs.current.set(item.uuid, React.createRef() as React.RefObject<ComponentRef<typeof TouchableOpacity>>);
          }
          const squareRef = squareRefs.current.get(item.uuid)!;
          
          return (
            <ConversationSquare
                  name={item.name}
                  unread={item.unread}
                  photoUrl={item.photoUrl}
              squareRef={squareRef}
                  onPress={async () => {
                    if (item.hasConversation) {
                      // Si conversation existe, ouvrir la conversation directement
                      squareRef.current?.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                        setTransitionPosition({ x: pageX, y: pageY, width, height });
                        router.push({
                          pathname: '/(tabs)/conversation-direct',
                          params: { conversationId: item.conversationId }
                        });
                      });
                    } else {
                      // Si ami sans conversation, vérifier d'abord si une conversation existe
                      try {
                        console.log('🔍 Recherche conversation avec UUID:', item.uuid);
                        
                        // Vérifier dans toutes les conversations (même celles filtrées)
                        const existingConv = conversations.find(c => c.other_participant?.uuid === item.uuid);
                        
                        if (existingConv) {
                          console.log('✅ Conversation trouvée:', existingConv.uuid);
                          squareRef.current?.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                            setTransitionPosition({ x: pageX, y: pageY, width, height });
                        router.push({
                          pathname: '/(tabs)/conversation-direct',
                          params: { conversationId: existingConv.uuid }
                        });
                          });
                          return;
                        }
                        
                        console.log('🆕 Création nouvelle conversation pour UUID:', item.uuid);
                        console.log('📋 Nom de l\'ami:', item.name);
                        
                        const response = await makeAuthenticatedRequest(
                          `${API_BASE_URL}/messaging/conversations/`,
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              other_user_uuid: item.uuid,
                            }),
                          }
                        );

                        if (!response.ok) {
                          const errorData = await response.json().catch(() => ({}));
                          console.error('❌ Erreur création conversation pour UUID:', item.uuid);
                          console.error('❌ Détails erreur:', errorData);
                          throw new Error(errorData.detail || errorData.error || `Erreur ${response.status}`);
                        }

                        const newConversation = await response.json();
                        console.log('✅ Conversation créée:', newConversation.uuid);
                        
                        // Ajouter la nouvelle conversation et l'ouvrir
                        setConversations(prev => [newConversation, ...prev]);
                        
                        squareRef.current?.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                  setTransitionPosition({ x: pageX, y: pageY, width, height });
                  router.push({
                    pathname: '/(tabs)/conversation-direct',
                    params: { conversationId: newConversation.uuid }
                  });
                });
                      } catch (error) {
                        console.error('❌ Erreur lors de la création de la conversation:', error);
                        Alert.alert(
                          'Erreur',
                          'Impossible de créer la conversation.'
                        );
                      }
                    }
              }}
            />
          );
        }}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.conversationGrid, localStyles.gridCompact]}
            scrollEnabled={false}
            ListFooterComponent={
              showStrangers ? (
                <View>
                  <View style={localStyles.categoryHeaderSearch}>
                    <Ionicons name="person-add" size={18} color="rgba(10, 145, 104, 1)" />
                    <Text style={localStyles.categoryTitleSearch}>Autres utilisateurs</Text>
                    <View style={localStyles.categoryBadge}>
                      <Text style={localStyles.categoryBadgeText}>{searchResults.strangers.length}</Text>
                    </View>
                  </View>
                  
                  {/* Grille des autres utilisateurs */}
                  <FlatList
                    data={searchResults.strangers}
                    keyExtractor={(item) => item.uuid}
                    renderItem={({ item }) => (
                      <UserSquare
                        user={item}
                        onPress={() => handleUserPress(item.uuid, item.surnom || item.username)}
                      />
                    )}
                    numColumns={3}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={{ paddingHorizontal: 10 }}
                    scrollEnabled={false}
                  />
                </View>
              ) : null
            }
          />

          {/* Message si aucun résultat avec recherche */}
          {query.trim() && filteredFriends.length === 0 && searchResults.strangers.length === 0 && !isSearching && viewMode === 'direct' && (
            <View style={localStyles.noResultsContainer}>
              <Ionicons name="search-outline" size={64} color="#ccc" />
              <Text style={localStyles.noResultsTitle}>Aucun résultat</Text>
              <Text style={localStyles.noResultsText}>
                Aucun utilisateur ne correspond à &quot;{query}&quot;
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal de création de groupe */}
      <CreateGroupModal
        visible={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onCreate={createGroup}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  toggleContainer: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    padding: 3,
    borderRadius: 25,
    zIndex: 10,
    shadowColor: 'rgba(255, 255, 255, 0.75)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 5,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 25,
    backgroundColor: 'transparent',
  },
  toggleActive: {
    backgroundColor: 'rgba(10, 145, 104, 0.65)',
    shadowColor: 'rgba(10, 145, 104, 0.7)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleLabel: {
    marginLeft: 6,
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
  },
  toggleLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  gridCompact: {
    paddingTop: 145,
    marginTop: 0,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(240, 250, 248, 1)',
    borderRadius: 16,
    marginBottom: 4,
    marginHorizontal: 20,
    shadowColor: 'rgba(10, 145, 104, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryHeaderSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 15,
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 25,
    shadowColor: '#fff',
    shadowOpacity: 0.9,
    elevation: 5,
    paddingHorizontal: 15,
    paddingVertical: 12,
    zIndex: 5,
  },
  categoryTitleSearch: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(10, 145, 104, 1)',
    marginLeft: 10,
    flex: 1,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(10, 145, 104, 1)',
    marginLeft: 10,
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: 'rgba(10, 145, 104, 1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  noResultsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: '#6c8a6e',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyConversationsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 120,
  },
  emptyConversationsTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
  },
  emptyConversationsText: {
    fontSize: 15,
    color: '#6c8a6e',
    textAlign: 'center',
    lineHeight: 22,
  },
});
