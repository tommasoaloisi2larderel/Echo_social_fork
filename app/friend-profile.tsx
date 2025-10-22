import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useUserProfile } from '../contexts/UserProfileContext';
import DefaultAvatar from '../components/DefaultAvatar';

const API_BASE_URL = "https://reseausocial-production.up.railway.app";

interface UserProfile {
  id: number;
  uuid: string;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  date_naissance?: string;
  date_inscription?: string;
  surnom?: string;
  nationalite?: string;
  photo_profil?: string;
  photo_profil_url?: string;
  nb_connexions?: number;
  derniere_reponse?: {
    question: string;
    reponse: string;
    date: string;
  } | null;
  prochains_evenements?: Array<{
    id: number;
    titre: string;
    date_debut: string;
    type: string;
  }>;
}

interface UserProfileStats {
  total_connexions: number;
  total_evenements: number;
  evenements_ce_mois: number;
  total_reponses: number;
  date_inscription: string;
  derniere_activite: string;
}

export default function UserProfileScreen() {
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { makeAuthenticatedRequest } = useAuth();
  const { getUserProfile, getUserStats } = useUserProfile();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserProfileStats | null>(null);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    loadProfile();
  }, [uuid]);

  const loadProfile = async () => {
    if (!uuid) return;
    
    setLoading(true);
    try {
      const profileData = await getUserProfile(uuid, makeAuthenticatedRequest);
      if (profileData) {
        setProfile(profileData);
      }

      const statsData = await getUserStats(uuid, makeAuthenticatedRequest);
      if (statsData) {
        setStats(statsData);
      }
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      Alert.alert('Erreur', 'Impossible de charger le profil');
    } finally {
      setLoading(false);
    }
  };


  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Non renseigné';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.replace('/(tabs)/friends')} 
            style={styles.backButton}
              >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="rgba(10, 145, 104, 1)" />
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.replace('/(tabs)/friends')} 
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Profil introuvable</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.replace('/(tabs)/friends')} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Photo de profil et infos principales */}
        <View style={styles.profileHeader}>
          {profile.photo_profil_url ? (
            <Image source={{ uri: profile.photo_profil_url }} style={styles.profileImage} />
          ) : (
            <DefaultAvatar
              name={profile.surnom || profile.username}
              size={120}
            />
          )}
          
          <Text style={styles.displayName}>
            {profile.surnom || profile.username}
          </Text>
          
          {profile.first_name && profile.last_name && (
            <Text style={styles.fullName}>
              {profile.first_name} {profile.last_name}
            </Text>
          )}

          {profile.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}
        </View>

        {/* Statistiques */}
        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Ionicons name="people" size={24} color="rgba(10, 145, 104, 1)" />
              <Text style={styles.statNumber}>{stats.total_connexions}</Text>
              <Text style={styles.statLabel}>Connexions</Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="calendar" size={24} color="rgba(10, 145, 104, 1)" />
              <Text style={styles.statNumber}>{stats.total_evenements}</Text>
              <Text style={styles.statLabel}>Événements</Text>
            </View>
            
            <View style={styles.statItem}>
              <Ionicons name="chatbubble" size={24} color="rgba(10, 145, 104, 1)" />
              <Text style={styles.statNumber}>{stats.total_reponses}</Text>
              <Text style={styles.statLabel}>Réponses</Text>
            </View>
          </View>
        )}

        {/* Informations détaillées */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Informations</Text>
          
          {profile.nationalite && (
            <View style={styles.infoRow}>
              <Ionicons name="flag" size={20} color="#666" />
              <Text style={styles.infoLabel}>Nationalité</Text>
              <Text style={styles.infoValue}>{profile.nationalite}</Text>
            </View>
          )}

          {profile.date_naissance && (
            <View style={styles.infoRow}>
              <Ionicons name="gift" size={20} color="#666" />
              <Text style={styles.infoLabel}>Date de naissance</Text>
              <Text style={styles.infoValue}>{formatDate(profile.date_naissance)}</Text>
            </View>
          )}

          {stats?.date_inscription && (
            <View style={styles.infoRow}>
              <Ionicons name="time" size={20} color="#666" />
              <Text style={styles.infoLabel}>Membre depuis</Text>
              <Text style={styles.infoValue}>{formatDate(stats.date_inscription)}</Text>
            </View>
          )}
        </View>

        {/* Dernière réponse */}
        {profile.derniere_reponse && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Dernière réponse</Text>
            <View style={styles.responseCard}>
              <Text style={styles.responseQuestion}>
                {profile.derniere_reponse.question}
              </Text>
              <Text style={styles.responseAnswer}>
                {profile.derniere_reponse.reponse}
              </Text>
              <Text style={styles.responseDate}>
                {formatDate(profile.derniere_reponse.date)}
              </Text>
            </View>
          </View>
        )}

        {/* Prochains événements */}
        {profile.prochains_evenements && profile.prochains_evenements.length > 0 && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Prochains événements</Text>
            {profile.prochains_evenements.map((event) => (
              <View key={event.id} style={styles.eventCard}>
                <View style={styles.eventIcon}>
                  <Ionicons name="calendar-outline" size={20} color="rgba(10, 145, 104, 1)" />
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{event.titre}</Text>
                  <Text style={styles.eventDate}>{formatDate(event.date_debut)}</Text>
                  <Text style={styles.eventType}>{event.type}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Bouton envoyer un message */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.sendMessageButton}
            onPress={async () => {
              try {
                // Chercher si une conversation existe déjà
                const response = await makeAuthenticatedRequest(
                  `${API_BASE_URL}/messaging/conversations/`
                );
                
                if (response.ok) {
                  const conversations = await response.json();
                  const existingConv = conversations.find((conv: any) => 
                    conv.other_participant?.uuid === profile?.uuid
                  );
                  
                  if (existingConv) {
                    // Conversation existante
                    router.replace({
                      pathname: '/(tabs)/conversation-direct',
                      params: { conversationId: existingConv.uuid }
                    });
                  } else {
                    // Créer nouvelle conversation
                    const createResponse = await makeAuthenticatedRequest(
                      `${API_BASE_URL}/messaging/conversations/`,
                      {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ recipient_uuid: profile?.uuid })
                      }
                    );
                    
                    if (createResponse.ok) {
                      const newConv = await createResponse.json();
                      router.replace({
                        pathname: '/(tabs)/conversation-direct',
                        params: { conversationId: newConv.uuid }
                      });
                    }
                  }
                }
              } catch (error) {
                console.error('Erreur navigation conversation:', error);
                Alert.alert('Erreur', 'Impossible d\'ouvrir la conversation');
              }
            }}
          >
            <Ionicons name="chatbubble" size={20} color="#fff" />
            <Text style={styles.sendMessageText}>Envoyer un message</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 16,
    color: '#333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  fullName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  bio: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginTop: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 24,
    backgroundColor: '#fff',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  infoSection: {
    backgroundColor: '#fff',
    marginTop: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  responseCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: 'rgba(10, 145, 104, 1)',
  },
  responseQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  responseAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 8,
  },
  responseDate: {
    fontSize: 12,
    color: '#999',
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  eventType: {
    fontSize: 12,
    color: 'rgba(10, 145, 104, 1)',
    fontWeight: '600',
  },
  actionSection: {
    padding: 16,
    marginTop: 8,
  },
  sendMessageButton: {
  backgroundColor: 'rgba(10, 145, 104, 1)',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 16,
  borderRadius: 12,
  gap: 8,
},
sendMessageText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: '700',
},

});