import { API_BASE_URL } from "@/config/api";
import { styles } from '@/styles/appStyles';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import React, { ComponentRef, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
// 🆕 Import the hook
import { useConversations } from '../../hooks/useConversations';

// 🆕 Define a proper interface for the items we display in the list
interface DisplayItem {
  uuid: string;
  name: string;
  photoUrl?: string;
  unread: boolean;
  conversationId?: string;
  hasConversation: boolean;
  lastMessage?: string;
  lastMessageTime?: string;
  isGroup?: boolean;
  memberCount?: number;
  unreadMessages?: number;
}

// ... [Keep User, Connection, Group, GroupMember interfaces as they were] ...
interface User {
  uuid: string;
  username: string;
  surnom: string;
  photo_profil_url?: string;
  is_friend?: boolean;
}

// Type pour les résultats de recherche par sections
interface SearchResultsSections {
  conversations: DisplayItem[]; // 🆕 Use the explicit interface here
  friends: User[];
  others: User[];
}

// ... [Keep Group and GroupInvitation interfaces] ...
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

// ... [Keep SearchBar, ConversationSquare, UserSquare, GroupSquare, ExpandableSection components exactly as they were] ...
const SearchBar = ({ query, setQuery }: { query: string; setQuery: (q: string) => void }) => (
  <View style={styles.searchContainer}>
    <Ionicons name="search-outline" size={20} color="rgba(10, 145, 104, 0.6)" style={{ marginRight: 10 }} />
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

const ConversationSquare = ({ name, unread, onPress, photoUrl, squareRef }: any) => (
  <TouchableOpacity
    ref={squareRef}
    style={[styles.conversationSquare, unread && styles.unreadConversationSquare]}
    onPress={onPress}
  >
    {photoUrl ? (
      <Image source={{ uri: photoUrl }} style={styles.avatar} />
    ) : (
      <DefaultAvatar name={name} size={110} style={styles.avatar} />
    )}
    <View style={styles.conversationNameBadge}>
      <Text style={styles.conversationName} numberOfLines={1} ellipsizeMode="clip">{name}</Text>
    </View>
  </TouchableOpacity>
);

const UserSquare = ({ user, onPress }: { user: User; onPress: () => void }) => (
  <TouchableOpacity style={[styles.conversationSquare, { shadowColor: "#777", shadowOpacity: 0.4 }]} onPress={onPress}>
    {user.photo_profil_url ? (
      <Image source={{ uri: user.photo_profil_url }} style={styles.avatar} />
    ) : (
      <DefaultAvatar name={user.surnom || user.username} size={110} style={styles.avatar} />
    )}
    <View style={styles.conversationNameBadge}>
      <Text style={styles.conversationName} numberOfLines={1} ellipsizeMode="clip">{user.surnom || user.username}</Text>
    </View>
  </TouchableOpacity>
);

const GroupSquare = React.memo(({ group, onPress }: { group: Group; onPress: () => void }) => {
  if (!group) return null;
  return (
    <TouchableOpacity style={[styles.conversationSquare, { shadowColor: "#777", shadowOpacity: 0.4 }]} onPress={onPress}>
      {group.avatar ? (
        <Image source={{ uri: group.avatar }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: 'rgba(10, 145, 104, 0.2)', justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="people" size={40} color="rgba(10, 145, 104, 1)" />
        </View>
      )}
      {(group.unread_messages || 0) > 0 && (
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadText}>{group.unread_messages}</Text>
        </View>
      )}
      <View style={styles.conversationNameBadge}>
        <Text style={styles.conversationName} numberOfLines={1} ellipsizeMode="clip">{group.name}</Text>
      </View>
    </TouchableOpacity>
  );
});
GroupSquare.displayName = 'GroupSquare';

const ExpandableSection = ({ title, count, icon, isExpanded, onToggle, children }: any) => (
  <View>
    <TouchableOpacity style={localStyles.categoryHeaderSearch} onPress={onToggle} activeOpacity={0.7}>
      <Ionicons name={icon} size={18} color="rgba(10, 145, 104, 1)" />
      <Text style={localStyles.categoryTitleSearch}>{title}</Text>
      <View style={localStyles.categoryBadge}>
        <Text style={localStyles.categoryBadgeText}>{count}</Text>
      </View>
      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="rgba(10, 145, 104, 1)" style={{ marginLeft: 8 }} />
    </TouchableOpacity>
    {isExpanded && children}
  </View>
);

export default function ConversationsScreen() {
  const pathname = usePathname();
  const { makeAuthenticatedRequest, user } = useAuth();
  const { setTransitionPosition } = useTransition();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<'direct' | 'group'>('direct');
  
  // 🆕 Use the new hook
  const { 
    privateConversations, 
    groupConversations, 
    isLoading: isLoadingConversations, 
    isRefetching,
    refreshAll 
  } = useConversations();

  const {
    prefetchConversation,
    getCachedGroups,
    getCachedGroupInvitations,
  } = useChat();
  
  const squareRefs = useRef<Map<string, React.RefObject<ComponentRef<typeof TouchableOpacity>>>>(new Map());
  
  const [searchResults, setSearchResults] = useState<SearchResultsSections>({
    conversations: [],
    friends: [],
    others: []
  });
  const [isSearching, setIsSearching] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    conversations: true,
    friends: true,
    others: true,
  });

  // Forcer la route base sur /conversations
  useEffect(() => {
    try {
      if (!pathname.includes('/conversations')) {
        router.replace('/(tabs)/conversations');
      }
    } catch {}
  }, []);

  // Search logic
  const searchAllUsers = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSearchResults({ conversations: [], friends: [], others: [] });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const query = searchQuery.toLowerCase();

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
          } as DisplayItem;
        });

      // ... [Keep existing search logic for friends/connections] ...
      const connectionsResponse = await makeAuthenticatedRequest(
        `${API_BASE_URL}/relations/connections/?statut=acceptee`
      );

      let friendUuids = new Set<string>();
      if (connectionsResponse.ok) {
        const connectionsData = await connectionsResponse.json();
        const connections = Array.isArray(connectionsData) ? connectionsData : (connectionsData.results || []);
        connections.forEach((conn: any) => {
          if (conn.demandeur_info?.uuid !== user?.uuid) friendUuids.add(conn.demandeur_info?.uuid);
          if (conn.destinataire_info?.uuid !== user?.uuid) friendUuids.add(conn.destinataire_info?.uuid);
        });
      }

      const conversationUserUuids = new Set(
        matchingConversations
          .map(c => privateConversations.find(pc => pc.uuid === c.uuid)?.other_participant?.uuid)
          .filter(Boolean)
      );

      const usersResponse = await makeAuthenticatedRequest(`${API_BASE_URL}/api/users/`);
      if (!usersResponse.ok) throw new Error("Error fetching users");

      const usersData = await usersResponse.json();
      let allUsers: User[] = Array.isArray(usersData) ? usersData : (usersData.results || []);

      const matchingUsers = allUsers.filter(u => {
        const surnom = (u.surnom || '').toLowerCase();
        const username = (u.username || '').toLowerCase();
        return surnom.includes(query) || username.includes(query);
      });

      const friends = matchingUsers.filter(u => friendUuids.has(u.uuid) && !conversationUserUuids.has(u.uuid));
      const others = matchingUsers.filter(u => !friendUuids.has(u.uuid) && !conversationUserUuids.has(u.uuid));

      setSearchResults({ conversations: matchingConversations, friends, others });
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      setSearchResults({ conversations: [], friends: [], others: [] });
    } finally {
      setIsSearching(false);
    }
  };

  // [Keep createGroup and other handlers]
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const createGroup = async (name: string, description: string) => {
    // ... [Keep existing createGroup logic] ...
    // Note: You might want to invalidate queries here after creation
    // queryClient.invalidateQueries({ queryKey: ['conversations', 'groups'] });
  };

  const handleUserPress = (userUuid: string, userName: string) => {
    const conv = privateConversations.find(c => c.other_participant?.uuid === userUuid);
    if (conv) {
      router.push({ pathname: '/(tabs)/conversation-direct', params: { conversationId: conv.uuid } });
    } else {
      router.push(`/(screens)/user-profile?uuid=${userUuid}` as any);
    }
  };

  useEffect(() => {
    if (viewMode === 'direct') {
      const timeoutId = setTimeout(() => { searchAllUsers(query); }, 300);
      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults({ conversations: [], friends: [], others: [] });
    }
  }, [query, viewMode, privateConversations]); // Added privateConversations dependency

  // 🆕 Updated Display Items Logic
  let displayItems: DisplayItem[] = [];

  if (viewMode === 'direct') {
    displayItems = privateConversations.map(conv => {
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
  } else {
    // Map from groupConversations (hook data) instead of manual 'groups' state
    displayItems = groupConversations.map(group => ({
      uuid: group.uuid,
      name: group.group_info?.name || 'Groupe',
      photoUrl: group.group_info?.avatar,
      unread: (group.unread_count || 0) > 0,
      conversationId: group.uuid,
      hasConversation: true,
      isGroup: true,
      // memberCount and unreadMessages might need adjustment based on API response
      memberCount: 0, 
      unreadMessages: group.unread_count || 0,
    }));
  }

  const filteredFriends = query.trim()
    ? displayItems.filter(f => f.name.toLowerCase().includes(query.toLowerCase()))
    : displayItems;

  const showSearchSections = viewMode === 'direct' && query.trim().length > 0;
  const hasSearchResults = searchResults.conversations.length > 0 || searchResults.friends.length > 0 || searchResults.others.length > 0;

  if (isLoadingConversations && !isRefetching) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="rgba(10, 145, 104, 1)" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: (insets.top || 0) + 0 }]}>
      <SearchBar query={query} setQuery={setQuery} />

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

      {/* List Container */}
      {!showSearchSections && filteredFriends.length === 0 && !(viewMode === 'group' && query.trim().length > 0) ? (
        <View style={localStyles.emptyConversationsContainer}>
          <Ionicons name={viewMode === 'direct' ? "person-outline" : "people-outline"} size={80} color="rgba(10, 145, 104, 0.3)" />
          <Text style={localStyles.emptyConversationsTitle}>{viewMode === 'direct' ? 'Aucun ami' : 'Aucun groupe'}</Text>
          <Text style={localStyles.emptyConversationsText}>{viewMode === 'direct' ? 'Utilisez la barre de recherche pour trouver des personnes' : 'Vous n\'avez pas encore de conversation de groupe'}</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refreshAll}
            />
          }
        >
          {showSearchSections ? (
            <View style={{ paddingTop: 145 }}>
              {/* Search Results Render Logic... [Keep existing search rendering] */}
              {/* Use the same rendering logic as before but ensure it uses the DisplayItem type */}
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
              {/* ... [Friends and Others Sections] ... */}
            </View>
          ) : (
            // Main List
            <FlatList
              data={filteredFriends}
              keyExtractor={(item) => item.uuid}
              renderItem={({ item }) => {
                // Group Logic
                if (item.isGroup) {
                  // Simple GroupSquare adapter
                  const groupItem: Group = {
                    id: 0, // Placeholder
                    uuid: item.uuid,
                    name: item.name,
                    avatar: item.photoUrl || null,
                    member_count: item.memberCount || 0,
                    unread_messages: item.unreadMessages,
                    created_at: '',
                    conversation_uuid: item.conversationId
                  };
                  return (
                    <GroupSquare
                      group={groupItem}
                      onPress={() => {
                        router.push({
                          pathname: '/(tabs)/conversation-group',
                          params: { conversationId: item.conversationId }
                        });
                      }}
                    />
                  );
                }

                // Direct Conversation Logic
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
        </ScrollView>
      )}

      <CreateGroupModal
        visible={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onCreate={createGroup}
      />
    </View>
  );
}

// ... [Keep localStyles] ...
const localStyles = StyleSheet.create({
  // ... [Your existing styles] ...
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