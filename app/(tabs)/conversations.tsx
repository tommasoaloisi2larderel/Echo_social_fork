import { API_BASE_URL } from "@/config/api";
import { styles } from '@/styles/appStyles';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router, usePathname } from 'expo-router';
import React, { ComponentRef, useCallback, useEffect, useRef, useState } from 'react';
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

// Type pour les résultats de recherche par sections
interface SearchResultsSections {
  conversations: typeof displayItems;
  friends: User[];
  others: User[];
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
    <Ionicons
      name="search-outline"
      size={20}
      color="rgba(10, 145, 104, 0.6)"
      style={{ marginRight: 10 }}
    />
    <TextInput
      style={[styles.searchInput, { flex: 1 }]}
      placeholder="Search for a conversation"
      placeholderTextColor="#999"
      value={query}
      onChangeText={setQuery}
    />
    {query.length > 0 && (
      <TouchableOpacity onPress={() => setQuery('')} style={{ padding: 4 }}>
        <Ionicons name="close-circle" size={20} color="rgba(10, 145, 104, 0.6)" />
      </TouchableOpacity>
    )}
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
      unread && styles.unreadConversationSquare,
    ]}
    onPress={onPress}
  >

    {photoUrl ? (
      <Image source={{ uri: photoUrl }} style={styles.avatar} />
    ) : (
      <DefaultAvatar name={name} size={110} style={styles.avatar} />
    )}
    <View style={styles.conversationNameBadge}>
      <Text style={styles.conversationName} numberOfLines={1} ellipsizeMode="clip">
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
      <Text style={styles.conversationName} numberOfLines={1} ellipsizeMode="clip">
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
        <Text style={styles.conversationName} numberOfLines={1} ellipsizeMode="clip">
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

// Composant pour section expandable/collapsible
const ExpandableSection = ({
  title,
  count,
  icon,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  icon: keyof typeof Ionicons.glyphMap;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <View>
    <TouchableOpacity
      style={localStyles.categoryHeaderSearch}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={18} color="rgba(10, 145, 104, 1)" />
      <Text style={localStyles.categoryTitleSearch}>{title}</Text>
      <View style={localStyles.categoryBadge}>
        <Text style={localStyles.categoryBadgeText}>{count}</Text>
      </View>
      <Ionicons
        name={isExpanded ? "chevron-up" : "chevron-down"}
        size={18}
        color="rgba(10, 145, 104, 1)"
        style={{ marginLeft: 8 }}
      />
    </TouchableOpacity>
    {isExpanded && children}
  </View>
);

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
    getCachedPrivateConversations,
    getCachedGroupConversations,
    getCachedConnections,
    getCachedGroups,
    setCachedGroups,
    getCachedGroupInvitations,
    setCachedGroupInvitations,
    prefetchConversationsOverview,
  } = useChat();
  const squareRefs = useRef<Map<string, React.RefObject<ComponentRef<typeof TouchableOpacity>>>>(new Map());
  
  // États pour la recherche d'utilisateurs
  const [searchResults, setSearchResults] = useState<SearchResultsSections>({
    conversations: [],
    friends: [],
    others: []
  });
  const [isSearching, setIsSearching] = useState(false);

  // États pour les sections expandables
  const [expandedSections, setExpandedSections] = useState({
    conversations: true,
    friends: true,
    others: true,
  });

  
  // États pour les groupes
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupInvitations, setGroupInvitations] = useState<GroupInvitation[]>([]);

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


  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 🎯 Un seul appel charge TOUT (conversations privées + groupes + connections)
      await prefetchConversationsOverview(makeAuthenticatedRequest);
      
      // Récupérer les groupes et invitations du cache
      const cachedGroups = getCachedGroups();
      setGroups(cachedGroups || []);
      
      const cachedInvitations = getCachedGroupInvitations();
      setGroupInvitations(cachedInvitations || []);
      
      console.log('✅ Données chargées depuis les caches');
    } catch (error) {
      console.error('❌ Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  };


  // Fonction pour rechercher tous les utilisateurs avec trois sections
  const searchAllUsers = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSearchResults({ conversations: [], friends: [], others: [] });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const query = searchQuery.toLowerCase();

      // 1. Récupérer les conversations privées et filtrer par nom
      const privateConversations = getCachedPrivateConversations() || [];

      const matchingConversations = privateConversations
        .filter(conv => {
          const participant = conv.other_participant;
          if (!participant) return false;
          const name = (participant.surnom || participant.username || '').toLowerCase();
          return name.includes(query);
        })
        .map(conv => {
          const otherParticipant = conv.other_participant;
          return {
            uuid: conv.uuid,
            name: otherParticipant?.surnom || otherParticipant?.username || 'Inconnu',
            photoUrl: otherParticipant?.photo_profil_url,
            unread: (conv.unread_count || 0) > 0,
            conversationId: conv.uuid,
            hasConversation: true,
            lastMessage: conv.last_message?.content,
            lastMessageTime: conv.last_message?.created_at,
          };
        });

      // 2. Récupérer les connexions/amis acceptées
      const connectionsResponse = await makeAuthenticatedRequest(
        `${API_BASE_URL}/relations/connections/?statut=acceptee`
      );

      let friendUuids = new Set<string>();
      if (connectionsResponse.ok) {
        const connectionsData = await connectionsResponse.json();
        const connections = Array.isArray(connectionsData) ? connectionsData : (connectionsData.results || []);

        // Extraire les UUIDs des amis (demandeur ou destinataire selon qui est l'utilisateur actuel)
        connections.forEach((conn: any) => {
          if (conn.demandeur_info?.uuid !== user?.uuid) {
            friendUuids.add(conn.demandeur_info?.uuid);
          }
          if (conn.destinataire_info?.uuid !== user?.uuid) {
            friendUuids.add(conn.destinataire_info?.uuid);
          }
        });
      }

      // Créer un Set des UUIDs d'utilisateurs avec conversations qui matchent
      const conversationUserUuids = new Set(
        matchingConversations
          .map(c => privateConversations.find(pc => pc.uuid === c.uuid)?.other_participant?.uuid)
          .filter(Boolean)
      );

      // 3. Récupérer tous les utilisateurs et filtrer
      const usersResponse = await makeAuthenticatedRequest(
        `${API_BASE_URL}/api/users/`
      );

      if (!usersResponse.ok) {
        throw new Error(`Erreur ${usersResponse.status}: Impossible de récupérer la liste des utilisateurs`);
      }

      const usersData = await usersResponse.json();
      let allUsers: User[] = Array.isArray(usersData) ? usersData : (usersData.results || []);

      // Filtrer par nom
      const matchingUsers = allUsers.filter(u => {
        const surnom = (u.surnom || '').toLowerCase();
        const username = (u.username || '').toLowerCase();
        return surnom.includes(query) || username.includes(query);
      });

      // Séparer en amis et autres utilisateurs
      const friends = matchingUsers.filter(u =>
        friendUuids.has(u.uuid) && !conversationUserUuids.has(u.uuid)
      );
      const others = matchingUsers.filter(u =>
        !friendUuids.has(u.uuid) && !conversationUserUuids.has(u.uuid)
      );

      console.log('🔍 Recherche:', query);
      console.log('💬 Conversations matchées:', matchingConversations.length);
      console.log('👥 Amis sans conversation matchée:', friends.length);
      console.log('🆕 Autres utilisateurs:', others.length);

      setSearchResults({
        conversations: matchingConversations,
        friends,
        others
      });
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      setSearchResults({ conversations: [], friends: [], others: [] });
    } finally {
      setIsSearching(false);
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

  // Charger les données au démarrage et à chaque fois qu'on revient sur cet écran
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  useEffect(() => {
      if (viewMode === 'direct') {
        const timeoutId = setTimeout(() => {
          searchAllUsers(query);
        }, 300);

        return () => clearTimeout(timeoutId);
      } else {
        setSearchResults({ conversations: [], friends: [], others: [] });
      }
    }, [query, viewMode]);

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
  const handleUserPress = (userUuid: string, userName: string) => {
    // 🎯 Trouver la conversation correspondante
    const privateConversations = getCachedPrivateConversations() || [];
    const conv = privateConversations.find(
      c => c.other_participant?.uuid === userUuid
    );
    
    if (conv) {
      // La conversation existe, l'ouvrir
      router.push({
        pathname: '/(tabs)/conversation-direct',
        params: { conversationId: conv.uuid }
      });
    } else {
      // Normalement impossible (chaque ami a une conversation)
      // Mais au cas où, rediriger vers le profil
      console.warn('⚠️ Conversation non trouvée pour:', userName);
      router.push(`/(screens)/user-profile?uuid=${userUuid}` as any);
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
    // 🎯 MODE PRIVÉ : Afficher les conversations privées du cache
    const privateConversations = getCachedPrivateConversations() || [];
    
    console.log('📊 Conversations privées:', privateConversations.length);
    
    displayItems = privateConversations.map(conv => {
      const otherParticipant = conv.other_participant;
      
      return {
        uuid: conv.uuid,  // 🎯 UUID de la CONVERSATION (pas de l'utilisateur)
        name: otherParticipant?.surnom || otherParticipant?.username || 'Inconnu',
        photoUrl: otherParticipant?.photo_profil_url,
        unread: (conv.unread_count || 0) > 0,
        conversationId: conv.uuid,
        hasConversation: true,  // 🎯 Toujours vrai maintenant
        lastMessage: conv.last_message?.content,
        lastMessageTime: conv.last_message?.created_at,
      };
    });
  }
else {
    displayItems = groups.map(group => ({
    uuid: group.uuid,  // UUID du GROUPE
    name: group.name,
    photoUrl: group.avatar || undefined,
    unread: (group.unread_messages || 0) > 0,
    conversationId: group.conversation_uuid,
    hasConversation: !!group.conversation_uuid,
    isGroup: true,
    memberCount: group.member_count || 0,
    unreadMessages: group.unread_messages || 0,
  }));
}

  // Filtrer selon la recherche
  const filteredFriends = query.trim()
    ? displayItems.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
    : displayItems;

  // Afficher les sections de recherche seulement si on a une recherche active en mode Privé
  const showSearchSections = viewMode === 'direct' && query.trim().length > 0;
  const hasSearchResults = searchResults.conversations.length > 0 || searchResults.friends.length > 0 || searchResults.others.length > 0;
  const onRefresh = () => {
      setRefreshing(true);
      fetchData().finally(() => setRefreshing(false));
    };
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
      {/* 🆕 Bouton créer un groupe (visible uniquement en mode Groupe) */}
        {viewMode === 'group' && (
          <TouchableOpacity
            style={localStyles.createGroupButton}
            onPress={() => setShowCreateGroupModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={localStyles.createGroupButtonText}>Créer un groupe</Text>
          </TouchableOpacity>
        )}

      {/* Header Créer un groupe (en mode Groupe avec recherche) */}
      {viewMode === 'group' && query.trim().length > 0 && (
        <TouchableOpacity
          style={[localStyles.categoryHeaderSearch, { marginTop: 145 }]}
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

      {/* Grille de conversations avec sections de recherche */}
      {!showSearchSections && filteredFriends.length === 0 && !(viewMode === 'group' && query.trim().length > 0) ? (
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
          {/* Afficher soit les conversations régulières, soit les sections de recherche */}
          {showSearchSections ? (
            // Mode recherche: afficher les trois sections
            <View style={{ paddingTop: 145 }}>
              {/* Section 1: Conversations qui matchent */}
              {searchResults.conversations.length > 0 && (
                <ExpandableSection
                  title="Conversations"
                  count={searchResults.conversations.length}
                  icon="chatbubbles"
                  isExpanded={expandedSections.conversations}
                  onToggle={() => setExpandedSections(prev => ({ ...prev, conversations: !prev.conversations }))}
                >
                  <FlatList
                    data={searchResults.conversations}
                    keyExtractor={(item) => item.uuid}
                    renderItem={({ item }) => {
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
                          onPress={() => {
                            squareRef.current?.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                              setTransitionPosition({ x: pageX, y: pageY, width, height });
                              router.push({
                                pathname: '/(tabs)/conversation-direct',
                                params: { conversationId: item.conversationId }
                              });
                            });
                          }}
                        />
                      );
                    }}
                    numColumns={3}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={{ paddingHorizontal: 10 }}
                    scrollEnabled={false}
                  />
                </ExpandableSection>
              )}

              {/* Section 2: Amis sans conversations matchées */}
              {searchResults.friends.length > 0 && (
                <ExpandableSection
                  title="Amis"
                  count={searchResults.friends.length}
                  icon="people"
                  isExpanded={expandedSections.friends}
                  onToggle={() => setExpandedSections(prev => ({ ...prev, friends: !prev.friends }))}
                >
                  <FlatList
                    data={searchResults.friends}
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
                </ExpandableSection>
              )}

              {/* Section 3: Autres utilisateurs */}
              {searchResults.others.length > 0 && (
                <ExpandableSection
                  title="Autres utilisateurs"
                  count={searchResults.others.length}
                  icon="person-add"
                  isExpanded={expandedSections.others}
                  onToggle={() => setExpandedSections(prev => ({ ...prev, others: !prev.others }))}
                >
                  <FlatList
                    data={searchResults.others}
                    keyExtractor={(item) => item.uuid}
                    renderItem={({ item }) => (
                      <UserSquare
                        user={item}
                        onPress={() => router.push(`/(screens)/user-profile?uuid=${item.uuid}` as any)}
                      />
                    )}
                    numColumns={3}
                    columnWrapperStyle={styles.row}
                    contentContainerStyle={{ paddingHorizontal: 10 }}
                    scrollEnabled={false}
                  />
                </ExpandableSection>
              )}
            </View>
          ) : (
            // Mode normal: afficher la grille des conversations
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
                  onPress={() => {
                    // 🎯 La conversation existe TOUJOURS maintenant
                    squareRef.current?.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                      setTransitionPosition({ x: pageX, y: pageY, width, height });
                      
                      if (item.isGroup) {
                        router.push({
                          pathname: '/(tabs)/conversation-group',
                          params: { conversationId: item.conversationId }
                        });
                      } else {
                        router.push({
                          pathname: '/(tabs)/conversation-direct',
                          params: { conversationId: item.conversationId }
                        });
                      }
                    });
                  }}
            />
          );
        }}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.conversationGrid, localStyles.gridCompact]}
            scrollEnabled={false}
          />
          )}

          {/* Message si aucun résultat avec recherche */}
          {query.trim() && !hasSearchResults && !isSearching && viewMode === 'direct' && (
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
    height: 48,
    marginTop: 12,
    marginBottom: 8,
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 16,
    shadowColor: 'rgba(10, 145, 104, 0.15)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
    paddingHorizontal: 16,
    paddingVertical: 0,
    zIndex: 5,
  },
  categoryTitleSearch: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(10, 145, 104, 1)',
    marginLeft: 8,
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 12,
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
  unreadWrapper: {
  backgroundColor: "rgba(10,145,104,0.35)",
  borderRadius: 20,
  padding: 5,
},

unreadSquare: {
  borderWidth: 3,
  borderColor: "rgba(10,145,104,1)",
  borderRadius: 18,
  backgroundColor: "white",
},
createGroupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 145, 104, 1)',
    marginHorizontal: 16,
    marginTop: 140,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: 'rgba(10, 145, 104, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  createGroupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
