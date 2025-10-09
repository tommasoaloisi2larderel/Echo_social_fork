import { styles } from '@/styles/appStyles';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
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
  squareRef?: React.RefObject<TouchableOpacity>;
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

export default function ConversationsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { makeAuthenticatedRequest, user } = useAuth(); // Utiliser la nouvelle fonction
  const { setTransitionPosition } = useTransition();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<'direct' | 'group'>('direct');
  const squareRefs = useRef<Map<string, React.RefObject<TouchableOpacity>>>(new Map());
  
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

  // Charger les conversations au montage du composant
  useEffect(() => {
    fetchConversations();
  }, []); // Supprimer accessToken des dépendances

  // Fonction de rafraîchissement (pull-to-refresh)
  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations(true);
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

  // Filtrer selon la recherche
  const filteredConversations = modeFiltered.filter((c) => {
    const name = c.other_participant?.surnom || c.other_participant?.username || '';
    return name.toLowerCase().includes(query.toLowerCase());
  });
  
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

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.uuid}
        renderItem={({ item }) => {
          // Créer ou récupérer une ref pour ce carré
          if (!squareRefs.current.has(item.uuid)) {
            squareRefs.current.set(item.uuid, React.createRef<TouchableOpacity>());
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
                squareRef.current?.measure((x, y, width, height, pageX, pageY) => {
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
});
