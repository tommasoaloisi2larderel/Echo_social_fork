import DefaultAvatar from '@/components/DefaultAvatar';
import { API_BASE_URL } from "@/config/api";
import { BACKGROUND_GRAY, ECHO_COLOR } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Modal } from 'react-native';
import { fetchWithAuth } from '@/services/apiClient';

interface ProfileStats {
  total_connexions: number;
  total_evenements: number;
  evenements_ce_mois: number;
  total_reponses: number;
  date_inscription: string;
  derniere_activite: string;
}

interface DerniereReponse {
  question: string;
  reponse: string;
  date: string;
}

const isDerniereReponse = (val: any): val is DerniereReponse => {
  return val && typeof val === 'object' && 'question' in val && 'reponse' in val && 'date' in val;
};

interface Post {
  id: number;
  uuid: string;
  contenu: string;
  auteur: {
    uuid: string;
    username: string;
    photo_profil_url?: string | null;
  };
  created_at: string;
  updated_at: string;
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/auth/profile/stats/`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        console.warn('Stats request failed with status', response.status);
      }
    } catch (error) {
      console.warn('Error fetching stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    if (!user?.uuid) return;
    
    setLoadingPosts(true);
    try {
      const response = await fetchWithAuth(
        `${API_BASE_URL}/posts/?auteur_uuid=${user.uuid}`
      );
      if (response.ok) {
        const data = await response.json();
        // Gérer différents formats de réponse
        const postsList = Array.isArray(data) ? data : (data.results || data.posts || []);
        setPosts(postsList);
      } else {
        console.warn('Posts request failed with status', response.status);
      }
    } catch (error) {
      console.warn('Error fetching posts:', error);
    } finally {
      setLoadingPosts(false);
    }
  }, [user?.uuid]);

  useEffect(() => {
    fetchStats();
    fetchPosts();
  }, [fetchStats, fetchPosts]);

  // Recharger les posts quand on revient sur la page (après création d'un post)
  useFocusEffect(
    useCallback(() => {
      fetchPosts();
    }, [fetchPosts])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
    fetchPosts();
  };

  const handleLogout = () => {
    Alert.alert(
      "Déconnexion",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Déconnexion", 
          style: "destructive",
          onPress: async () => {
            await logout();
          }
        }
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const formatPostDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const lastAnswer: unknown = user?.derniere_reponse as unknown;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ECHO_COLOR} />
      </View>
    );
  }

  const profilePictureUrl = (user as any)?.photo_profil_url;

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={['rgba(240, 250, 248, 1)', 'rgba(200, 235, 225, 1)']} style={styles.hero} start={{x:0, y:0}} end={{x:1, y:1}}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
            <Ionicons name="log-out-outline" size={22} color="rgba(10, 145, 104, 1)" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => router.push('/edit-profile' as any)} style={styles.iconButton}>
              <Ionicons name="create-outline" size={22} color="rgba(10, 145, 104, 1)" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowSettingsMenu(true)} style={styles.iconButton}>
              <Ionicons name="settings-outline" size={22} color="rgba(10, 145, 104, 1)" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.avatarWrap}>
          {profilePictureUrl ? (
            <Image source={{ uri: profilePictureUrl }} style={styles.avatarImage} />
          ) : (
            <DefaultAvatar name={user?.username || 'User'} size={110} />
          )}
        </View>

        <Text style={styles.nameText}>{user?.username}</Text>
        {user?.surnom ? (
          <Text style={styles.tagline}>&ldquo;{user.surnom}&rdquo;</Text>
        ) : null}
        {user?.bio ? (
          <Text style={styles.bioText}>{user.bio}</Text>
        ) : null}

        <View style={styles.quickStatsRow}>
          <TouchableOpacity style={styles.quickStatCard} onPress={() => router.push('/(screens)/friends' as any)}>
            <Ionicons name="people-outline" size={18} color={ECHO_COLOR} />
            <Text style={styles.quickStatNum}>{user?.nb_connexions ?? 0}</Text>
            <Text style={styles.quickStatLabel}>Amis</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickStatCard} onPress={() => router.push('/(screens)/calendar' as any)}>
            <Ionicons name="calendar-outline" size={18} color={ECHO_COLOR} />
            <Text style={styles.quickStatNum}>{stats?.total_evenements ?? 0}</Text>
            <Text style={styles.quickStatLabel}>Événements</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickStatCard} onPress={() => router.push('/(screens)/stats' as any)}>
            <Ionicons name="stats-chart-outline" size={18} color={ECHO_COLOR} />
            <Text style={styles.quickStatNum}>{stats?.total_reponses ?? 0}</Text>
            <Text style={styles.quickStatLabel}>Statistiques</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
      
      <View style={styles.cardsGrid}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text-outline" size={18} color={ECHO_COLOR} />
            <Text style={styles.cardTitle}>Posts</Text>
            <TouchableOpacity style={styles.newPostBtn} onPress={() => router.push('/posts/new' as any)}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.newPostText}>Nouveau</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.emptyState}>
            <Ionicons name="leaf-outline" size={20} color="#9bb89f" />
            <Text style={styles.emptyText}>Vous n'avez pas encore publié. Partagez votre premier post !</Text>
          </View>
        </View>
      </View>

      <View style={styles.footerSpace} />

      <Modal
        visible={showSettingsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettingsMenu(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1}
          onPress={() => setShowSettingsMenu(false)}
        >
          <View style={styles.settingsMenu}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                setShowSettingsMenu(false);
                router.push('/(screens)/blocked-users' as any);
              }}
            >
              <Ionicons name="ban-outline" size={22} color="#333" />
              <Text style={styles.menuItemText}>Utilisateurs bloqués</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                setShowSettingsMenu(false);
                router.push('/(screens)/archived-conversations' as any);
              }}
            >
              <Ionicons name="archive-outline" size={22} color="#333" />
              <Text style={styles.menuItemText}>Conversations archivées</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BACKGROUND_GRAY,
  },
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_GRAY,
  },
  content: {
    paddingBottom: 100,
  },
  hero: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  nameText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 16,
    fontStyle: 'italic',
    color: '#555',
    textAlign: 'center',
    marginBottom: 8,
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  quickStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickStatNum: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 4,
  },
  quickStatLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#888',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  questionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  answerText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#888',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 110,
    paddingRight: 20,
  },
  settingsMenu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  footerSpace: {
    height: 60,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
  },
  cardsGrid: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  newPostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ECHO_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  newPostText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    flex: 1,
  },
});