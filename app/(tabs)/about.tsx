import DefaultAvatar from '@/components/DefaultAvatar';
import { BACKGROUND_GRAY, ECHO_COLOR } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? "http://localhost:3001"
  : "https://reseausocial-production.up.railway.app";

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
  const { user, accessToken, logout, makeAuthenticatedRequest } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      if (!accessToken) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/auth/profile/stats/`);
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
  }, [makeAuthenticatedRequest, accessToken]);

  const fetchPosts = useCallback(async () => {
    if (!user?.uuid) return;
    
    setLoadingPosts(true);
    try {
      const response = await makeAuthenticatedRequest(
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
  }, [makeAuthenticatedRequest, user?.uuid]);

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

  // Fixed profile picture logic - using photo_profil_url directly
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
          <TouchableOpacity onPress={() => router.push('/edit-profile' as any)} style={styles.iconButton}>
            <Ionicons name="create-outline" size={22} color="rgba(10, 145, 104, 1)" />
          </TouchableOpacity>
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

        {(
          <View style={styles.quickStatsRow}>
            <TouchableOpacity style={styles.quickStatCard} onPress={() => router.push('/friends' as any)}>
              <Ionicons name="people-outline" size={18} color={ECHO_COLOR} />
              <Text style={styles.quickStatNum}>{user?.nb_connexions ?? 0}</Text>
              <Text style={styles.quickStatLabel}>Amis</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickStatCard} onPress={() => router.push('/(screens)/calendar' as any)}>
              <Ionicons name="calendar-outline" size={18} color={ECHO_COLOR} />
              <Text style={styles.quickStatNum}>{stats?.total_evenements ?? 0}</Text>
              <Text style={styles.quickStatLabel}>Calendrier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickStatCard} onPress={() => router.push('/stats' as any)}>
              <Ionicons name="bar-chart-outline" size={18} color={ECHO_COLOR} />
              <Text style={styles.quickStatNum}>{stats?.total_reponses ?? 0}</Text>
              <Text style={styles.quickStatLabel}>Statistiques</Text>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      <View style={styles.cardsGrid}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text-outline" size={18} color={ECHO_COLOR} />
            <Text style={styles.cardTitle}>Posts</Text>
            <TouchableOpacity 
              style={styles.newPostBtn} 
              onPress={() => router.push('/posts/new' as any)}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.newPostText}>Nouveau</Text>
            </TouchableOpacity>
          </View>
          
          {loadingPosts ? (
            <View style={styles.postsLoading}>
              <ActivityIndicator size="small" color={ECHO_COLOR} />
            </View>
          ) : posts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="leaf-outline" size={20} color="#9bb89f" />
              <Text style={styles.emptyText}>Vous n'avez pas encore publié. Partagez votre premier post !</Text>
            </View>
          ) : (
            <View style={styles.postsList}>
              {posts.map((post) => (
                <View key={post.id || post.uuid} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <View style={styles.postAuthor}>
                      {post.auteur?.photo_profil_url ? (
                        <Image 
                          source={{ uri: post.auteur.photo_profil_url }} 
                          style={styles.postAvatar}
                        />
                      ) : (
                        <DefaultAvatar 
                          name={post.auteur?.username || user?.username || 'User'} 
                          size={32}
                        />
                      )}
                      <View style={styles.postAuthorInfo}>
                        <Text style={styles.postAuthorName}>
                          {post.auteur?.username || user?.username}
                        </Text>
                        <Text style={styles.postDate}>
                          {formatPostDate(post.created_at)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={styles.postContent}>{post.contenu}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={styles.footerSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_GRAY,
  },
  content: {
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BACKGROUND_GRAY,
  },
  hero: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginBottom: 20,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  avatarWrap: {
    marginBottom: 16,
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: 'white',
  },
  nameText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1b5e20',
  },
  tagline: {
    fontSize: 15,
    color: '#5a7a5f',
    marginTop: 4,
    fontStyle: 'italic',
  },
  bioText: {
    textAlign: 'center',
    color: '#375a3b',
    marginTop: 8,
    paddingHorizontal: 24,
  },
  quickStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  quickStatCard: {
    flex: 1,
    backgroundColor: 'white',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  quickStatNum: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '700',
    color: '#1b5e20',
  },
  quickStatLabel: {
    fontSize: 11,
    color: '#6c8a6e',
    marginTop: 2,
  },
  cardsGrid: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginLeft: 8,
  },
  newPostBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 145, 104, 1)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  newPostText: { 
    color: '#fff', 
    fontWeight: '700', 
    marginLeft: 6 
  },
  emptyState: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8 
  },
  emptyText: { 
    marginLeft: 8, 
    color: '#6e7f71' 
  },
  postsLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  postsList: {
    marginTop: 8,
  },
  postCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  postHeader: {
    marginBottom: 8,
  },
  postAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  postAuthorInfo: {
    flex: 1,
  },
  postAuthorName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  postDate: {
    fontSize: 12,
    color: '#999',
  },
  postContent: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  footerSpace: {
    height: 60,
  },
});