import DefaultAvatar from '@/components/DefaultAvatar';
import { styles } from '@/styles/appStyles';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? "http://localhost:3001"
  : "https://reseausocial-production.up.railway.app";

interface User {
  id: number;
  uuid: string;
  username: string;
  surnom?: string;
  photo_profil_url?: string;
}

interface GroupMember {
  user_uuid: string;
  username: string;
  surnom?: string;
}

export default function AddGroupMembers() {
  const { groupUuid, groupName } = useLocalSearchParams();
  const { makeAuthenticatedRequest } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [groupMembers, setGroupMembers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroupMembers();
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        searchUsers(query);
      } else {
        setSearchResults([]);
      }
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [query]);

  const loadGroupMembers = async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/groups/${groupUuid}/members/`
      );
      
      if (response.ok) {
        const members = await response.json();
        const memberUuids = new Set(members.map((m: GroupMember) => m.user_uuid));
        setGroupMembers(memberUuids);
        console.log('👥 Membres actuels du groupe:', memberUuids.size);
      }
    } catch (error) {
      console.error('Erreur chargement membres:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (searchQuery: string) => {
    setIsSearching(true);
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/api/users/`
      );

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      const data = await response.json();
      let allUsers: User[] = Array.isArray(data) ? data : (data.results || []);
      
      // Filtrer par surnom ou username
      const users = allUsers.filter(u => {
        const surnom = (u.surnom || '').toLowerCase();
        const username = (u.username || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        return surnom.includes(q) || username.includes(q);
      });
      
      // Exclure les membres déjà dans le groupe
      const availableUsers = users.filter(u => !groupMembers.has(u.uuid));
      
      setSearchResults(availableUsers);
      console.log('🔍 Utilisateurs disponibles:', availableUsers.length);
    } catch (error) {
      console.error('Erreur recherche utilisateurs:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const toggleUserSelection = (userUuid: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userUuid)) {
        newSet.delete(userUuid);
      } else {
        newSet.add(userUuid);
      }
      return newSet;
    });
  };

  const handleInvite = async () => {
    if (selectedUsers.size === 0) {
      Alert.alert('Aucune sélection', 'Veuillez sélectionner au moins un utilisateur');
      return;
    }

    try {
      console.log('📤 Envoi invitations pour:', selectedUsers.size, 'utilisateurs');
      
      // Envoyer une invitation pour chaque utilisateur sélectionné
      const promises = Array.from(selectedUsers).map(userUuid =>
        makeAuthenticatedRequest(
          `${API_BASE_URL}/groups/${groupUuid}/invite/`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_uuid: userUuid,
              message: `Invitation à rejoindre ${groupName}`
            })
          }
        )
      );

      const results = await Promise.all(promises);
      const successCount = results.filter(r => r.ok).length;
      
      if (successCount > 0) {
        Alert.alert(
          'Invitations envoyées',
          `${successCount} invitation${successCount > 1 ? 's' : ''} envoyée${successCount > 1 ? 's' : ''} avec succès !`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert('Erreur', 'Impossible d\'envoyer les invitations');
      }
    } catch (error) {
      console.error('Erreur envoi invitations:', error);
      Alert.alert('Erreur', 'Impossible d\'envoyer les invitations');
    }
  };

  const UserSquare = ({ user }: { user: User }) => {
    const isSelected = selectedUsers.has(user.uuid);
    
    return (
      <TouchableOpacity
        style={[
          localStyles.userSquare,
          isSelected && localStyles.userSquareSelected
        ]}
        onPress={() => toggleUserSelection(user.uuid)}
      >
        {user.photo_profil_url ? (
          <Image source={{ uri: user.photo_profil_url }} style={styles.avatar} />
        ) : (
          <DefaultAvatar name={user.surnom || user.username} size={80} />
        )}
        
        {isSelected && (
          <View style={localStyles.selectedBadge}>
            <Ionicons name="checkmark-circle" size={24} color="rgba(10, 145, 104, 1)" />
          </View>
        )}
        
        <View style={styles.conversationNameBadge}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {user.surnom || user.username}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[localStyles.container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="rgba(10, 145, 104, 1)" />
      </View>
    );
  }

  return (
    <View style={[localStyles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={localStyles.header}>
        <TouchableOpacity onPress={() => router.back()} style={localStyles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={localStyles.headerTitle}>Ajouter des membres</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Nom du groupe */}
      <View style={localStyles.groupInfo}>
        <Ionicons name="people" size={20} color="rgba(10, 145, 104, 1)" />
        <Text style={localStyles.groupName}>{groupName}</Text>
      </View>

      {/* Barre de recherche */}
      <View style={localStyles.searchContainer}>
        <View style={localStyles.searchBar}>
          <Ionicons name="search" size={20} color="#888" />
          <TextInput
            style={localStyles.searchInput}
            placeholder="Rechercher des utilisateurs..."
            value={query}
            onChangeText={setQuery}
            placeholderTextColor="#999"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color="#888" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sélection en cours */}
      {selectedUsers.size > 0 && (
        <View style={localStyles.selectionBar}>
          <Text style={localStyles.selectionText}>
            {selectedUsers.size} utilisateur{selectedUsers.size > 1 ? 's' : ''} sélectionné{selectedUsers.size > 1 ? 's' : ''}
          </Text>
          <TouchableOpacity
            style={localStyles.inviteButton}
            onPress={handleInvite}
          >
            <Ionicons name="send" size={18} color="#fff" />
            <Text style={localStyles.inviteButtonText}>Inviter</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Liste des utilisateurs */}
      {isSearching ? (
        <View style={localStyles.loadingContainer}>
          <ActivityIndicator size="large" color="rgba(10, 145, 104, 1)" />
          <Text style={localStyles.loadingText}>Recherche en cours...</Text>
        </View>
      ) : searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.uuid}
          renderItem={({ item }) => <UserSquare user={item} />}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={localStyles.grid}
        />
      ) : query.trim().length > 0 ? (
        <View style={localStyles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color="#ccc" />
          <Text style={localStyles.emptyTitle}>Aucun résultat</Text>
          <Text style={localStyles.emptyText}>
            Aucun utilisateur ne correspond à "{query}"
          </Text>
        </View>
      ) : (
        <View style={localStyles.emptyContainer}>
          <Ionicons name="person-add-outline" size={64} color="rgba(10, 145, 104, 0.3)" />
          <Text style={localStyles.emptyTitle}>Rechercher des utilisateurs</Text>
          <Text style={localStyles.emptyText}>
            Utilisez la barre de recherche pour trouver des personnes à inviter dans le groupe
          </Text>
        </View>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(10, 145, 104, 1)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(10, 145, 104, 0.2)',
  },
  selectionText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(10, 145, 104, 1)',
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 145, 104, 1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  grid: {
    paddingHorizontal: 10,
    paddingTop: 20,
    paddingBottom: 100,
  },
  userSquare: {
    width: '31%',
    aspectRatio: 1,
    margin: '1.16%',
    borderRadius: 15,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    backgroundColor: '#fff',
  },
  userSquareSelected: {
    borderWidth: 3,
    borderColor: 'rgba(10, 145, 104, 1)',
  },
  selectedBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#fff',
    borderRadius: 12,
    zIndex: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
});

