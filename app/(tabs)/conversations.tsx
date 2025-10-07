import { styles } from '@/styles/appStyles';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import DefaultAvatar from '../../components/DefaultAvatar';
import { useAuth } from '../../contexts/AuthContext';

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
  photoUrl 
}: { 
  name: string; 
  unread: boolean; 
  onPress: () => void;
  photoUrl?: string;
}) => (
  <TouchableOpacity
    style={[
      styles.conversationSquare,
      {
        shadowColor: unread ? "rgba(55, 116, 69, 1)" : "#777",
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
  const [query, setQuery] = useState("");
  const API_BASE_URL = 'https://reseausocial-production.up.railway.app';

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
        <ActivityIndicator size="large" color="rgba(55, 116, 69, 1)" />
        <Text style={{ marginTop: 10, color: '#666' }}>Chargement...</Text>
      </View>
    );
  }

  // Affichage si aucune conversation
  if (conversations.length === 0) {
    return (
      <View style={styles.container}>
        <Ionicons name="chatbubbles-outline" size={80} color="rgba(55, 116, 69, 1)" />
        <Text style={{ fontSize: 20, marginTop: 16 }}>Aucune conversation</Text>
        <TouchableOpacity onPress={() => fetchConversations()}>
          <Text>Actualiser</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Filtrer les conversations selon la recherche
  const filteredConversations = conversations.filter((c) => {
    const name = c.other_participant?.surnom || c.other_participant?.username || '';
    return name.toLowerCase().includes(query.toLowerCase());
  });
  
  return (
    <View style={styles.container}>
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.uuid}
        renderItem={({ item }) => (
          <ConversationSquare
            name={item.other_participant?.surnom || item.other_participant?.username || 'Unknown'}
            unread={item.unread_count > 0}
            photoUrl={item.other_participant?.photo_profil_url}
            onPress={() => {
              router.push({
                pathname: '/(tabs)/conversation-detail',
                params: { conversationId: item.uuid }
              });
            }}
          />
        )}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.conversationGrid}
        showsVerticalScrollIndicator={false}
      />
      <SearchBar query={query} setQuery={setQuery} />
    </View>
  );
}
