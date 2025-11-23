import DefaultAvatar from '@/components/DefaultAvatar';
import { API_BASE_URL } from "@/config/api";
import { BACKGROUND_GRAY, ECHO_COLOR } from '@/constants/colors';
import { useChat } from '@/contexts/ChatContext';
import { fetchWithAuth } from '@/services/apiClient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ArchivedConversation {
  id: number;
  uuid: string;
  conversation_type: string;
  last_message: {
    content: string;
    sender_username: string;
    created_at: string;
    is_read: boolean;
  };
  other_participant?: {
    id: number;
    uuid: string;
    username: string;
    surnom: string;
    photo_profil_url: string | null;
  };
  group_info?: {
    id: number;
    uuid: string;
    name: string;
    avatar: string | null;
    member_count: number;
  };
  unread_count: number;
  created_at: string;
  updated_at: string;
  archived_at: string;
}

export default function ArchivedConversationsScreen() {
  const { 
  setCachedPrivateConversations,  // 🆕
  setCachedGroupConversations,     // 🆕
  prefetchConversationsOverview,
} = useChat();
  const [conversations, setConversations] = useState<ArchivedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [unarchiving, setUnarchiving] = useState<string | null>(null);

  const fetchArchivedConversations = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/messaging/conversations/archived/`);
      
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      } else {
        console.error('Erreur lors de la récupération des conversations archivées');
      }
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Impossible de charger les conversations archivées');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchArchivedConversations();
  }, [fetchArchivedConversations]);

  const handleUnarchive = async (conversationUuid: string, name: string) => {
    Alert.alert(
      'Désarchiver',
      `Voulez-vous désarchiver la conversation avec ${name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Désarchiver',
          onPress: async () => {
            setUnarchiving(conversationUuid);
            try {
              const response = await fetchWithAuth(
                `${API_BASE_URL}/messaging/conversations/${conversationUuid}/archive/`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'unarchive' }),
                }
              );

              if (response.ok) {
                // Retirer de la liste locale
                setConversations(prev => prev.filter(item => item.uuid !== conversationUuid));
                
                
                // Rafraîchir le cache des conversations pour l'écran principal
                try {
                  const convsResponse = await fetchWithAuth(
                    `${API_BASE_URL}/messaging/conversations/`
                  );
                  if (convsResponse.ok) {
                    const data = await convsResponse.json();
                    const list = data.results || data;
                    await prefetchConversationsOverview(fetchWithAuth);
                  }
                } catch (error) {
                  console.error('Erreur rafraîchissement cache:', error);
                }
                
                Alert.alert('Succès', 'Conversation désarchivée');
              } else {
                Alert.alert('Erreur', 'Impossible de désarchiver cette conversation');
              }
            } catch (error) {
              console.error('Erreur:', error);
              Alert.alert('Erreur', 'Une erreur est survenue');
            } finally {
              setUnarchiving(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  };

  const renderConversation = ({ item }: { item: ArchivedConversation }) => {
    const isUnarchiving = unarchiving === item.uuid;
    const isGroup = item.conversation_type === 'group_chat';
    const displayName = isGroup 
      ? item.group_info?.name 
      : (item.other_participant?.surnom || item.other_participant?.username);
    
    const avatarName = isGroup
      ? item.group_info?.name || 'Groupe'
      : (item.other_participant?.username || 'User');

    const photoUrl = isGroup 
      ? item.group_info?.avatar 
      : item.other_participant?.photo_profil_url;

    return (
      <View style={styles.conversationCard}>
        <TouchableOpacity 
          style={styles.conversationInfo}
          onPress={() => {
            // Navigation vers la conversation
            router.push({
              pathname: '/(screens)/conversation-detail',
              params: { conversationId: item.uuid }
            } as any);
          }}
        >
          {photoUrl ? (
            <img 
              src={photoUrl} 
              style={styles.avatar as any}
              alt={displayName}
            />
          ) : (
            <DefaultAvatar name={avatarName} size={50} />
          )}
          
          <View style={styles.conversationDetails}>
            <View style={styles.conversationHeader}>
              <Text style={styles.conversationName} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={styles.timestamp}>
                {formatDate(item.last_message?.created_at)}
              </Text>
            </View>
            
            <Text style={styles.lastMessage} numberOfLines={2}>
              {item.last_message?.sender_username}: {item.last_message?.content}
            </Text>
            
            <Text style={styles.archivedDate}>
              Archivé le {new Date(item.archived_at).toLocaleDateString('fr-FR')}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.unarchiveButton, isUnarchiving && styles.unarchiveButtonDisabled]}
          onPress={() => handleUnarchive(item.uuid, displayName || 'cette conversation')}
          disabled={isUnarchiving}
        >
          {isUnarchiving ? (
            <ActivityIndicator size="small" color={ECHO_COLOR} />
          ) : (
            <Ionicons name="archive-outline" size={24} color={ECHO_COLOR} />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Conversations archivées</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ECHO_COLOR} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Conversations archivées</Text>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="archive-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Aucune conversation archivée</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.uuid}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_GRAY,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ECHO_COLOR,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  conversationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  conversationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  conversationDetails: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  archivedDate: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  unarchiveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  unarchiveButtonDisabled: {
    opacity: 0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
});