import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

// Import type pour forcer TypeScript à reconnaître la route
import type { Href } from 'expo-router';

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

export default function ConversationsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { makeAuthenticatedRequest, user } = useAuth(); // Utiliser la nouvelle fonction

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

  // Formater la date pour l'affichage
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit' 
      });
    }
  };

  // Rendu d'un item de conversation
  const renderConversationItem = ({ item }: { item: Conversation }) => {
    // Gérer le cas où other_participant est null
    if (!item.other_participant) {
      console.log('⚠️ Conversation sans participant:', item.uuid);
      return (
        <TouchableOpacity style={styles.conversationItem}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>?</Text>
            </View>
          </View>
          <View style={styles.conversationContent}>
            <Text style={styles.participantName}>Conversation sans participant</Text>
            <Text style={styles.lastMessageText}>
              {item.last_message ? item.last_message.content : 'Conversation vide'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => {
          console.log('Ouvrir conversation:', item.uuid);
          router.push({
            pathname: '/(tabs)/conversation-detail',
            params: { conversationId: item.uuid }
          });
        }}
      >
        {/* Avatar avec photo de profil ou initiales */}
        <View style={styles.avatarContainer}>
          {item.other_participant.photo_profil_url ? (
            <Image
              source={{ 
                uri: item.other_participant.photo_profil_url.startsWith('http') 
                  ? item.other_participant.photo_profil_url 
                  : `${API_BASE_URL}${item.other_participant.photo_profil_url}`
              }}
              style={styles.avatarImage}
              onError={() => {
                console.log('Erreur de chargement de l\'image de profil');
              }}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.other_participant.surnom?.charAt(0)?.toUpperCase() || 
                 item.other_participant.username?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>

        {/* Contenu principal */}
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.participantName}>
              {item.other_participant.surnom || item.other_participant.username}
            </Text>
            <Text style={styles.lastMessageTime}>
              {item.last_message ? formatDate(item.last_message.created_at) : formatDate(item.created_at)}
            </Text>
          </View>

          <View style={styles.lastMessageContainer}>
            <Text 
              style={styles.lastMessageText} 
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.last_message ? item.last_message.content : 'Conversation démarrée'}
            </Text>
            
            {/* Badge de messages non lus */}
            {item.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>
                  {item.unread_count > 99 ? '99+' : item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Affichage de chargement
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#da913eff" />
        <Text style={styles.loadingText}>Chargement des conversations...</Text>
      </View>
    );
  }

  // Affichage si aucune conversation
  if (conversations.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubbles-outline" size={80} color="#198a31ff" />
        <Text style={styles.emptyTitle}>Aucune conversation</Text>
        <Text style={styles.emptySubtitle}>
          Commencez à discuter avec vos amis !
        </Text>
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={() => fetchConversations()}
        >
          <Text style={styles.refreshButtonText}>Actualiser</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* En-tête avec nom d'utilisateur */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <Text style={styles.headerSubtitle}>Connecté en tant que {user?.username}</Text>
      </View>

      {/* Liste des conversations */}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.uuid}
        renderItem={renderConversationItem}
        style={styles.conversationsList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#da913eff']}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 16,
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#da913eff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  lastMessageTime: {
    fontSize: 12,
    color: '#888',
  },
  lastMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastMessageText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#da913eff',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  separator: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginLeft: 78, // Pour aligner avec le texte
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 40,
  },
  refreshButton: {
    backgroundColor: '#da913eff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});