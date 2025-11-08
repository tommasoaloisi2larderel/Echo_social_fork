import DefaultAvatar from '@/components/DefaultAvatar';
import { BACKGROUND_GRAY, ECHO_COLOR } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? "http://localhost:3001"
  : "https://reseausocial-production.up.railway.app";

interface BlockedUser {
  id: number;
  uuid: string;
  blocked_user: {
    id: number;
    uuid: string;
    username: string;
    surnom: string;
    photo_profil_url: string | null;
  };
  blocked_at: string;
  reason: string;
}

export default function BlockedUsersScreen() {
  const { makeAuthenticatedRequest } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const fetchBlockedUsers = useCallback(async () => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/messaging/blocked-users/`);
      
      if (response.ok) {
        const data = await response.json();
        setBlockedUsers(data);
      } else {
        console.error('Erreur lors de la récupération des utilisateurs bloqués');
      }
    } catch (error) {
      console.error('Erreur:', error);
      Alert.alert('Erreur', 'Impossible de charger la liste des utilisateurs bloqués');
    } finally {
      setLoading(false);
    }
  }, [makeAuthenticatedRequest]);

  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  const handleUnblock = async (userUuid: string, username: string) => {
    Alert.alert(
      'Débloquer',
      `Voulez-vous débloquer ${username} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Débloquer',
          onPress: async () => {
            setUnblocking(userUuid);
            try {
              const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/messaging/unblock-user/`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ user_uuid: userUuid }),
                }
              );

              if (response.ok) {
                setBlockedUsers(prev => prev.filter(item => item.blocked_user.uuid !== userUuid));
                Alert.alert('Succès', `${username} a été débloqué`);
              } else {
                Alert.alert('Erreur', 'Impossible de débloquer cet utilisateur');
              }
            } catch (error) {
              console.error('Erreur:', error);
              Alert.alert('Erreur', 'Une erreur est survenue');
            } finally {
              setUnblocking(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => {
    const isUnblocking = unblocking === item.blocked_user.uuid;

    return (
      <View style={styles.userCard}>
        <View style={styles.userInfo}>
          {item.blocked_user.photo_profil_url ? (
            <img 
              src={item.blocked_user.photo_profil_url} 
              style={styles.avatar as any}
              alt={item.blocked_user.username}
            />
          ) : (
            <DefaultAvatar name={item.blocked_user.username} size={50} />
          )}
          
          <View style={styles.userDetails}>
            <Text style={styles.username}>
              {item.blocked_user.surnom || item.blocked_user.username}
            </Text>
            <Text style={styles.blockedDate}>
              Bloqué le {formatDate(item.blocked_at)}
            </Text>
            {item.reason && (
              <Text style={styles.reason}>Raison: {item.reason}</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.unblockButton, isUnblocking && styles.unblockButtonDisabled]}
          onPress={() => handleUnblock(item.blocked_user.uuid, item.blocked_user.username)}
          disabled={isUnblocking}
        >
          {isUnblocking ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.unblockButtonText}>Débloquer</Text>
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
          <Text style={styles.headerTitle}>Utilisateurs bloqués</Text>
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
        <Text style={styles.headerTitle}>Utilisateurs bloqués</Text>
      </View>

      {blockedUsers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="ban-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Aucun utilisateur bloqué</Text>
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          renderItem={renderBlockedUser}
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
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
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
  userInfo: {
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
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  blockedDate: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  reason: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  unblockButton: {
    backgroundColor: ECHO_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  unblockButtonDisabled: {
    opacity: 0.5,
  },
  unblockButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
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