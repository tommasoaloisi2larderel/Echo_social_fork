import { API_BASE_URL } from "@/config/api";
import { ECHO_COLOR } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from '@/services/apiClient';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface ProfileStats {
  total_connexions: number;
  total_evenements: number;
  evenements_ce_mois: number;
  total_reponses: number;
  date_inscription: string;
  derniere_activite: string;
}

interface ExtendedStats extends ProfileStats {
  nb_amis?: number;
  conversations_actives?: number;
  messages_envoyes?: number;
  messages_recus?: number;
  agents_crees?: number;
  posts_publies?: number;
  jours_depuis_inscription?: number;
  moyenne_messages_jour?: number;
  taux_reponse?: number;
}

export default function StatsScreen() {
  const { user } = useAuth();
  const [stats, setStats] = useState<ExtendedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      
      // Appel à l'API réelle
      const response = await fetchWithAuth(
        `${API_BASE_URL}/api/auth/profile/stats/`
      );

      if (response.ok) {
        const data = await response.json();
        
        // Calculer les jours depuis l'inscription
        const inscriptionDate = new Date(data.date_inscription);
        const now = new Date();
        const daysSinceInscription = Math.floor(
          (now.getTime() - inscriptionDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // Utiliser directement les données de l'API
        const extendedData = {
          // Vue d'ensemble
          nb_amis: data.total_connexions,
          total_connexions: data.total_connexions,
          conversations_actives: data.conversations_actives,
          messages_envoyes: data.messages_envoyes,
          messages_recus: data.messages_recus,
          
          // Activité
          total_evenements: data.total_evenements,
          evenements_ce_mois: data.evenements_ce_mois,
          total_reponses: data.total_reponses,
          posts_publies: data.posts_publies,
          
          // Intelligence & Engagement
          agents_crees: data.agents_crees,
          taux_reponse: data.taux_reponse,
          moyenne_messages_jour: data.moyenne_messages_jour,
          
          // Informations du compte
          date_inscription: data.date_inscription,
          derniere_activite: data.derniere_activite,
          jours_depuis_inscription: daysSinceInscription,
        };
        
        setStats(extendedData);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', { 
      day: 'numeric', 
      month: 'short', 
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ECHO_COLOR} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(240, 250, 248, 1)', 'rgba(200, 235, 225, 1)']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={ECHO_COLOR} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Ionicons name="bar-chart" size={28} color={ECHO_COLOR} />
            <Text style={styles.headerTitle}>Mes Statistiques</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ECHO_COLOR} />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vue d&apos;ensemble</Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon="people"
              title="Amis"
              value={stats?.nb_amis ?? 0}
              color="#4CAF50"
              subtitle="connexions"
            />
            <StatCard
              icon="chatbubbles"
              title="Conversations"
              value={stats?.conversations_actives ?? 0}
              color="#2196F3"
              subtitle="actives"
            />
            <StatCard
              icon="send"
              title="Messages envoyés"
              value={stats?.messages_envoyes ?? 0}
              color="#FF9800"
              subtitle="au total"
            />
            <StatCard
              icon="mail"
              title="Messages reçus"
              value={stats?.messages_recus ?? 0}
              color="#9C27B0"
              subtitle="au total"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activité</Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon="calendar"
              title="Événements"
              value={stats?.total_evenements ?? 0}
              color="#00BCD4"
              subtitle="au total"
            />
            <StatCard
              icon="calendar-number"
              title="Ce mois-ci"
              value={stats?.evenements_ce_mois ?? 0}
              color="#009688"
              subtitle="événements"
            />
            <StatCard
              icon="chatbox"
              title="Réponses"
              value={stats?.total_reponses ?? 0}
              color="#673AB7"
              subtitle="aux questions"
            />
            <StatCard
              icon="document-text"
              title="Posts"
              value={stats?.posts_publies ?? 0}
              color="#E91E63"
              subtitle="publiés"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Intelligence & Engagement</Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon="flash"
              title="Agents IA"
              value={stats?.agents_crees ?? 0}
              color="#FF5722"
              subtitle="créés"
            />
            <StatCard
              icon="trending-up"
              title="Taux de réponse"
              value={`${stats?.taux_reponse ?? 0}%`}
              color="#8BC34A"
              subtitle="engagement"
            />
            <StatCard
              icon="timer"
              title="Moy. messages/jour"
              value={stats?.moyenne_messages_jour ?? 0}
              color="#FFC107"
              subtitle="activité"
            />
            <StatCard
              icon="log-in"
              title="Connexions"
              value={stats?.total_connexions ?? 0}
              color="#607D8B"
              subtitle="au total"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations du compte</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="calendar-outline" size={24} color={ECHO_COLOR} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Date d&apos;inscription</Text>
                <Text style={styles.infoValue}>
                  {stats?.date_inscription ? formatDate(stats.date_inscription) : 'N/A'}
                </Text>
              </View>
            </View>
            
            <View style={styles.infoDivider} />
            
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="time-outline" size={24} color={ECHO_COLOR} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Dernière activité</Text>
                <Text style={styles.infoValue}>
                  {stats?.derniere_activite ? formatDateTime(stats.derniere_activite) : 'N/A'}
                </Text>
              </View>
            </View>
            
            <View style={styles.infoDivider} />
            
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="hourglass-outline" size={24} color={ECHO_COLOR} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Jours sur Echo</Text>
                <Text style={styles.infoValue}>
                  {stats?.jours_depuis_inscription ?? 0} jours
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badges & Accomplissements</Text>
          <View style={styles.badgesContainer}>
            <BadgeCard
              icon="star"
              title="Membre actif"
              achieved={(stats?.total_connexions ?? 0) > 5}
              description="Plus de 5 connexions"
            />
            <BadgeCard
              icon="chatbubble-ellipses"
              title="Conversationnel"
              achieved={(stats?.messages_envoyes ?? 0) > 50}
              description="50+ messages envoyés"
            />
            <BadgeCard
              icon="calendar"
              title="Organisateur"
              achieved={(stats?.total_evenements ?? 0) > 5}
              description="5+ événements créés"
            />
            <BadgeCard
              icon="people-circle"
              title="Social"
              achieved={(stats?.nb_amis ?? 0) > 10}
              description="10+ amis"
            />
          </View>
        </View>

        <View style={styles.footerSpace} />
      </ScrollView>
    </View>
  );
}

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: number | string;
  color: string;
  subtitle?: string;
}

function StatCard({ icon, title, value, color, subtitle }: StatCardProps) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

interface BadgeCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  achieved: boolean;
  description: string;
}

function BadgeCard({ icon, title, achieved, description }: BadgeCardProps) {
  return (
    <View style={[styles.badgeCard, achieved && styles.badgeAchieved]}>
      <View style={[styles.badgeIcon, achieved && styles.badgeIconAchieved]}>
        <Ionicons 
          name={icon} 
          size={32} 
          color={achieved ? '#FFD700' : '#ccc'} 
        />
      </View>
      <Text style={styles.badgeTitle}>{title}</Text>
      <Text style={styles.badgeDescription}>{description}</Text>
      {achieved && (
        <View style={styles.achievedBadge}>
          <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
          <Text style={styles.achievedText}>Débloqué</Text>
        </View>
      )}
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
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1b5e20',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    paddingLeft: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: CARD_WIDTH,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statContent: {
    gap: 2,
  },
  statTitle: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    marginVertical: 4,
  },
  statSubtitle: {
    fontSize: 11,
    color: '#999',
  },
  infoCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(218, 145, 62, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 8,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  badgeCard: {
    width: CARD_WIDTH,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  badgeAchieved: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  badgeIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  badgeIconAchieved: {
    backgroundColor: '#FFF8DC',
  },
  badgeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  badgeDescription: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
  },
  achievedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
  },
  achievedText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
  footerSpace: {
    height: 40,
  },
});