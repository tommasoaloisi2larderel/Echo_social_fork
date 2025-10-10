import { styles } from '@/styles/appStyles';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { ComponentRef, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DefaultAvatar from '../../components/DefaultAvatar';
import { useAuth } from '../../contexts/AuthContext';
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

export default function ConversationsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { makeAuthenticatedRequest, user } = useAuth(); // Utiliser la nouvelle fonction
  const { setTransitionPosition } = useTransition();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<'direct' | 'group'>('direct');
  const squareRefs = useRef<Map<string, React.RefObject<ComponentRef<typeof TouchableOpacity>>>>(new Map());
  
  // États pour la recherche d'utilisateurs
  const [searchResults, setSearchResults] = useState<{ friends: User[], strangers: User[] }>({ friends: [], strangers: [] });
  const [isSearching, setIsSearching] = useState(false);
  
  // Utilise le proxy local pour éviter CORS en développement web
  const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? "http://localhost:3001"
    : "https://reseausocial-production.up.railway.app";

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
      setConversations(data.results || data);
      
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
      
      // Récupérer les UUIDs des utilisateurs avec qui on a déjà une conversation
      const existingConversationUuids = new Set(
        conversations
          .filter(c => c.other_participant)
          .map(c => c.other_participant!.uuid)
      );
      
      // Séparer les résultats en amis et inconnus
      const friends = users.filter(u => existingConversationUuids.has(u.uuid));
      const strangers = users.filter(u => !existingConversationUuids.has(u.uuid));
      
      setSearchResults({ friends, strangers });
    } catch (error) {
      console.error('Erreur lors de la recherche d\'utilisateurs:', error);
      setSearchResults({ friends: [], strangers: [] });
    } finally {
      setIsSearching(false);
    }
  };

  // Charger les conversations au montage du composant
  useEffect(() => {
    fetchConversations();
  }, []); // Supprimer accessToken des dépendances

  // Déclencher la recherche quand la query change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchAllUsers(query);
    }, 300); // Debounce de 300ms
    
    return () => clearTimeout(timeoutId);
  }, [query, conversations]);

  // Fonction de rafraîchissement (pull-to-refresh)
  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations(true);
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
          pathname: '/(tabs)/conversation-detail',
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

  // Affichage si aucune conversation
  if (conversations.length === 0) {
    return (
      <View style={styles.container}>
        <Ionicons name="chatbubbles-outline" size={80} color="rgba(10, 145, 104, 1)" />
        <Text style={{ fontSize: 20, marginTop: 16 }}>Aucune conversation</Text>
        <TouchableOpacity onPress={() => fetchConversations()}>
          <Text>Actualiser</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Helpers to detect 1-on-1 vs group
  const isDirect = (c: Conversation) => !!c.other_participant;
  const isGroup = (c: Conversation) => !c.other_participant;

  const modeFiltered = conversations.filter((c) =>
    viewMode === 'direct' ? isDirect(c) : isGroup(c)
  );

  // Filtrer selon la recherche (pour les conversations existantes)
  const filteredConversations = modeFiltered.filter((c) => {
    const name = c.other_participant?.surnom || c.other_participant?.username || '';
    return name.toLowerCase().includes(query.toLowerCase());
  });

  // Déterminer si on affiche les résultats de recherche ou les conversations normales
  const showSearchResults = query.trim().length > 0 && (searchResults.friends.length > 0 || searchResults.strangers.length > 0);
  
  return (
    <View style={[styles.container, { paddingTop: (insets.top || 0) + 0 }]}> 
      <SearchBar query={query} setQuery={setQuery} />

      {/* Toggle 1-on-1 / Groupes - caché pendant la recherche */}
      {!query.trim() && (
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
      )}

      {/* Affichage des résultats de recherche ou des conversations */}
      {showSearchResults ? (
        <ScrollView 
          style={localStyles.searchResultsContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Catégorie Amis */}
          {searchResults.friends.length > 0 && (
            <View style={localStyles.categorySection}>
              <Text style={localStyles.categoryTitle}>Amis</Text>
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
                contentContainerStyle={styles.conversationGrid}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Catégorie Utilisateurs inconnus */}
          {searchResults.strangers.length > 0 && (
            <View style={localStyles.categorySection}>
              <Text style={localStyles.categoryTitle}>Utilisateurs</Text>
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
                contentContainerStyle={styles.conversationGrid}
                scrollEnabled={false}
              />
            </View>
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.uuid}
          renderItem={({ item }) => {
            // Créer ou récupérer une ref pour ce carré
            if (!squareRefs.current.has(item.uuid)) {
              squareRefs.current.set(item.uuid, React.createRef() as React.RefObject<ComponentRef<typeof TouchableOpacity>>);
            }
            const squareRef = squareRefs.current.get(item.uuid)!;
            
            return (
              <ConversationSquare
                name={item.other_participant?.surnom || item.other_participant?.username || 'Unknown'}
                unread={item.unread_count > 0}
                photoUrl={item.other_participant?.photo_profil_url}
                squareRef={squareRef}
              onPress={() => {
                // Capturer la position avant la navigation
                squareRef.current?.measure((x: number, y: number, width: number, height: number, pageX: number, pageY: number) => {
                  setTransitionPosition({ x: pageX, y: pageY, width, height });
                  router.push({
                    pathname: '/(tabs)/conversation-detail',
                    params: { conversationId: item.uuid }
                  });
                });
              }}
              />
            );
          }}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.conversationGrid, localStyles.gridCompact]}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}
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
  searchResultsContainer: {
    flex: 1,
    paddingTop: 120,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'rgba(10, 145, 104, 1)',
    marginLeft: 20,
    marginBottom: 10,
    marginTop: 10,
  },
});
