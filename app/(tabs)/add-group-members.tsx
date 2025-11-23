import { FloatingHeader } from '@/components/FloatingHeader';
import { API_BASE_URL } from "@/config/api";
import { fetchWithAuth } from '@/services/apiClient';
import { styles } from '@/styles/appStyles';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
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
  const insets = useSafeAreaInsets();
  
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [groupMembers, setGroupMembers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    console.log('🆕 Page add-group-members montée');
    console.log('📋 Params reçus:', { groupUuid, groupName });
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
      console.log('📡 Chargement membres du groupe:', groupUuid);
      const response = await fetchWithAuth(
        `${API_BASE_URL}/groups/${groupUuid}/members/`
      );
      
      if (response.ok) {
        const members = await response.json();
        console.log('📋 Membres reçus:', members);
        console.log('📋 Structure premier membre:', members[0]);
        // Extraire les UUIDs des membres (la structure peut être m.user_uuid ou m.user.uuid)
        const memberUuids = new Set<string>(
          members.map((m: any) => m.user_uuid || m.user?.uuid).filter(Boolean)
        );
        setGroupMembers(memberUuids);
        console.log('👥 Membres actuels du groupe:', memberUuids.size, Array.from(memberUuids));
      } else {
        console.error('❌ Erreur chargement membres:', response.status);
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Détails erreur:', errorData);
      }
    } catch (error) {
      console.error('❌ Erreur chargement membres:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (searchQuery: string) => {
    setIsSearching(true);
    try {
      console.log('🔍 Recherche utilisateurs avec query:', searchQuery);
      const response = await fetchWithAuth(
        `${API_BASE_URL}/api/users/`
      );

      if (!response.ok) {
        console.error('❌ Erreur recherche utilisateurs:', response.status);
        throw new Error(`Erreur ${response.status}`);
      }

      const data = await response.json();
      let allUsers: User[] = Array.isArray(data) ? data : (data.results || []);
      console.log('📋 Total utilisateurs:', allUsers.length);
      
      // Filtrer par surnom ou username
      const users = allUsers.filter(u => {
        const surnom = (u.surnom || '').toLowerCase();
        const username = (u.username || '').toLowerCase();
        const q = searchQuery.toLowerCase();
        return surnom.includes(q) || username.includes(q);
      });
      console.log('📋 Utilisateurs correspondants:', users.length);
      
      // Exclure les membres déjà dans le groupe
      const availableUsers = users.filter(u => !groupMembers.has(u.uuid));
      
      setSearchResults(availableUsers);
      console.log('✅ Utilisateurs disponibles (après exclusion membres):', availableUsers.length);
      console.log('📋 Preview:', availableUsers.slice(0, 3).map(u => u.surnom || u.username));
    } catch (error) {
      console.error('❌ Erreur recherche utilisateurs:', error);
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

    setSending(true);
    try {
      console.log('📤 Envoi invitations pour:', selectedUsers.size, 'utilisateurs');
      console.log('📤 Groupe UUID:', groupUuid);
      console.log('📤 Groupe Nom:', groupName);
      console.log('📤 UUIDs utilisateurs:', Array.from(selectedUsers));
      console.log('📤 URL complète:', `${API_BASE_URL}/groups/${groupUuid}/invite/`);
      
      // Envoyer une invitation pour chaque utilisateur sélectionné
      const invitations = Array.from(selectedUsers).map(async userUuid => {
        console.log('📨 Envoi invitation pour:', userUuid);
        
        const payload = {
          target_user_uuid: userUuid,
          message: `Invitation à rejoindre ${groupName}`
        };
        console.log('📨 Payload:', JSON.stringify(payload, null, 2));
        
        const response = await fetchWithAuth(
          `${API_BASE_URL}/groups/${groupUuid}/invite/`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );
        
        console.log('📨 Réponse statut pour', userUuid, ':', response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('❌ Erreur invitation:', {
            userUuid,
            status: response.status,
            errorData: JSON.stringify(errorData, null, 2)
          });
          return { success: false, userUuid, error: errorData, status: response.status };
        }
        
        const data = await response.json();
        console.log('✅ Invitation envoyée:', {
          userUuid,
          responseData: data
        });
        return { success: true, userUuid };
      });

      const results = await Promise.all(invitations);
      const successCount = results.filter(r => r.success).length;
      const failedCount = results.length - successCount;
      
      console.log('📊 Résultats finaux:', { successCount, failedCount, total: results.length });
      
      if (successCount > 0) {
        const message = failedCount > 0
          ? `${successCount} invitation(s) envoyée(s), ${failedCount} échec(s)`
          : `${successCount} invitation(s) envoyée(s) avec succès !`;
        
        Alert.alert(
          'Invitations envoyées',
          message,
          [{ 
            text: 'OK', 
            onPress: () => {
              // Recharger les membres du groupe
              loadGroupMembers();
              // Vider la sélection
              setSelectedUsers(new Set());
              setQuery('');
              setSearchResults([]);
            }
          }]
        );
      } else {
        const firstError = results.find(r => !r.success);
        
        // Gérer les erreurs spécifiques
        let errorTitle = 'Erreur';
        let errorMessage = 'Impossible d\'envoyer les invitations.';
        
        if (firstError?.error?.non_field_errors) {
          const errors = firstError.error.non_field_errors;
          if (Array.isArray(errors) && errors.length > 0) {
            const errorText = errors[0];
            if (errorText.includes('déjà en cours')) {
              errorTitle = 'Invitation déjà envoyée';
              errorMessage = 'Une invitation a déjà été envoyée à cet utilisateur. Veuillez attendre sa réponse.';
            } else {
              errorMessage = errorText;
            }
          }
        } else if (firstError?.error?.detail) {
          errorMessage = firstError.error.detail;
        } else if (firstError?.error?.error) {
          errorMessage = firstError.error.error;
        } else if (firstError?.error && typeof firstError.error === 'object') {
          errorMessage = JSON.stringify(firstError.error);
        }
        
        console.error('❌ Message d\'erreur final:', errorMessage);
        Alert.alert(errorTitle, errorMessage);
      }
    } catch (error) {
      console.error('❌ Erreur globale envoi invitations:', error);
      Alert.alert('Erreur', `Impossible d'envoyer les invitations: ${error}`);
    } finally {
      setSending(false);
    }
  };

  const UserSquare = ({ user }: { user: User }) => {
    const isSelected = selectedUsers.has(user.uuid);
    
    return (
      <TouchableOpacity
        style={[
          styles.conversationSquare,
          isSelected && localStyles.userSquareSelected
        ]}
        onPress={() => toggleUserSelection(user.uuid)}
        activeOpacity={0.7}
      >
        {user.photo_profil_url ? (
          <Image source={{ uri: user.photo_profil_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: 'rgba(10, 145, 104, 0.2)', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name="person" size={50} color="rgba(10, 145, 104, 1)" />
          </View>
        )}
        
        {isSelected && (
          <View style={localStyles.selectedBadge}>
            <Ionicons name="checkmark-circle" size={28} color="rgba(10, 145, 104, 1)" />
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
      <View style={[localStyles.container, { paddingTop: (insets.top || 0), justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="rgba(10, 145, 104, 1)" />
      </View>
    );
  }

  return (
    <View style={[localStyles.container, { paddingTop: (insets.top || 0) }]}>
      {/* Header unifié */}
      <FloatingHeader title="Ajouter des membres" icon="person-add" />

      {/* Info groupe */}
      <View style={localStyles.groupInfoBadge}>
        <Ionicons name="people" size={16} color="rgba(10, 145, 104, 1)" />
        <Text style={localStyles.groupNameText}>{groupName}</Text>
      </View>

      {/* Barre de recherche style app */}
      <View style={localStyles.searchContainer}>
        <TextInput
          style={localStyles.searchInput}
          placeholder="Rechercher un utilisateur..."
          placeholderTextColor="#777"
          value={query}
          onChangeText={setQuery}
        />
      </View>

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
            Aucun utilisateur ne correspond à &quot;{query}&quot;
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

      {/* Bouton d'invitation flottant */}
      {selectedUsers.size > 0 && (
        <TouchableOpacity
          style={localStyles.floatingInviteButton}
          onPress={handleInvite}
          activeOpacity={0.8}
          disabled={sending}
        >
          <LinearGradient
            colors={sending 
              ? ['rgba(10, 145, 104, 0.6)', 'rgba(10, 145, 104, 0.5)']
              : ['rgba(10, 145, 104, 1)', 'rgba(10, 145, 104, 0.9)']
            }
            style={localStyles.inviteButtonGradient}
          >
            {sending ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={localStyles.inviteButtonText}>
                  Envoi en cours...
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="send" size={24} color="#fff" />
                <Text style={localStyles.inviteButtonText}>
                  Inviter {selectedUsers.size} personne{selectedUsers.size > 1 ? 's' : ''}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const localStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(245,250,245,0.9)',
  },
  groupInfoBadge: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 5,
  },
  groupNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(10, 145, 104, 1)',
  },
  searchContainer: {
    position: 'absolute',
    top: 170,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 25,
    shadowColor: '#fff',
    shadowOpacity: 0.9,
    elevation: 5,
    paddingHorizontal: 15,
    paddingVertical: 5,
    zIndex: 10,
  },
  searchInput: {
    fontSize: 16,
    paddingVertical: 8,
    color: '#333',
  },
  grid: {
    paddingTop: 230,
    paddingBottom: 200,
    paddingHorizontal: 10,
  },
  userSquareSelected: {
    shadowColor: 'rgba(10, 145, 104, 0.8)',
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
    transform: [{ scale: 0.98 }],
  },
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 14,
    zIndex: 10,
    shadowColor: 'rgba(10, 145, 104, 0.5)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  floatingInviteButton: {
    position: 'absolute',
    bottom: 115,
    left: 20,
    right: 20,
    zIndex: 20,
    shadowColor: 'rgba(10, 145, 104, 0.5)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  inviteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 28,
  },
  inviteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 200,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 15,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
});
