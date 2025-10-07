import DefaultAvatar from '@/components/DefaultAvatar';
import { BACKGROUND_GRAY, ECHO_COLOR } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const API_BASE_URL = "https://reseausocial-production.up.railway.app";

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

export default function ProfileScreen() {
  const { user, accessToken, logout, makeAuthenticatedRequest } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      // If no token, do not attempt the call (avoids noisy error "Pas de token d'accès")
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

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
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

  const lastAnswer: unknown = user?.derniere_reponse as unknown;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ECHO_COLOR} />
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Header */}
      <LinearGradient colors={['#e8f5e9', '#c8e6c9']} style={styles.hero} start={{x:0, y:0}} end={{x:1, y:1}}>
        <View style={styles.heroTopRow}>
          <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
            <Ionicons name="log-out-outline" size={22} color="#2e7d32" />
          </TouchableOpacity>
        </View>

        <View style={styles.avatarWrap}>
          <DefaultAvatar name={user?.username || 'User'} size={110} />
        </View>

        <Text style={styles.nameText}>{user?.username}</Text>
        {user?.surnom ? (
          <Text style={styles.tagline}>&ldquo;{user.surnom}&rdquo;</Text>
        ) : null}
        {user?.bio ? (
          <Text style={styles.bioText}>{user.bio}</Text>
        ) : null}

        {/* Quick stats */}
        {stats && (
          <View style={styles.quickStatsRow}>
            <View style={styles.quickStatCard}>
              <Ionicons name="log-in-outline" size={18} color={ECHO_COLOR} />
              <Text style={styles.quickStatNum}>{user?.nb_connexions || 0}</Text>
              <Text style={styles.quickStatLabel}>Connexions</Text>
            </View>
            <View style={styles.quickStatCard}>
              <Ionicons name="calendar-outline" size={18} color={ECHO_COLOR} />
              <Text style={styles.quickStatNum}>{stats.total_evenements}</Text>
              <Text style={styles.quickStatLabel}>Événements</Text>
            </View>
            <View style={styles.quickStatCard}>
              <Ionicons name="chatbubbles-outline" size={18} color={ECHO_COLOR} />
              <Text style={styles.quickStatNum}>{stats.total_reponses}</Text>
              <Text style={styles.quickStatLabel}>Réponses</Text>
            </View>
          </View>
        )}
      </LinearGradient>

      {/* Information & Activity */}
      <View style={styles.cardsGrid}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="information-circle-outline" size={18} color={ECHO_COLOR} />
            <Text style={styles.cardTitle}>Profil</Text>
          </View>
          <InfoRow icon="mail" label="Email" value={user?.email} />
          {user?.first_name && <InfoRow icon="person" label="Prénom" value={user.first_name} />}
          {user?.last_name && <InfoRow icon="person-outline" label="Nom" value={user.last_name} />}
          {user?.nationalite && <InfoRow icon="flag" label="Nationalité" value={user.nationalite} />}        
          <InfoRow icon="calendar-outline" label="Membre depuis" value={formatDate(user?.date_inscription || '')} />
        </View>

        {isDerniereReponse(lastAnswer) && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="sparkles-outline" size={18} color={ECHO_COLOR} />
              <Text style={styles.cardTitle}>Dernière réponse</Text>
            </View>
            <View style={styles.answerBox}>
              <Text style={styles.questionText}>Q: {lastAnswer.question}</Text>
              <Text style={styles.answerText}>R: {lastAnswer.reponse}</Text>
              <View style={styles.answerFooter}>
                <Ionicons name="time-outline" size={14} color="#999" />
                <Text style={styles.dateText}>{formatDate(lastAnswer.date)}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Primary action */}
      <View style={styles.footerSpace} />
    </ScrollView>
  );
}

const InfoRow = ({ icon, label, value }: { icon: any; label: string; value?: string }) => {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={ECHO_COLOR} />
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
};

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
    paddingBottom: 40,
  },
  hero: {
    paddingTop: 36,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  iconButton: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  avatarWrap: {
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  nameText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1b5e20',
    textAlign: 'center',
  },
  tagline: {
    textAlign: 'center',
    color: ECHO_COLOR,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoContent: {
    marginLeft: 15,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#333',
  },
  answerBox: {
    padding: 14,
    backgroundColor: '#f6fbf6',
    borderRadius: 12,
  },
  questionText: {
    fontSize: 14,
    color: '#5f6d61',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  answerText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
  answerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  dateText: {
    fontSize: 11,
    color: '#999',
    marginLeft: 6,
  },
  footerSpace: {
    height: 60,
  },
});
