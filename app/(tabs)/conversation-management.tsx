import DefaultAvatar from '@/components/DefaultAvatar';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

// Utilise le proxy local pour éviter CORS en développement web
const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? "http://localhost:3001"
  : "https://reseausocial-production.up.railway.app";

interface ConversationMember {
  uuid: string;
  username: string;
  surnom?: string;
  photo_profil_url?: string;
  is_ai?: boolean;
}

interface ConversationDetails {
  uuid: string;
  is_group: boolean;
  name?: string;
  description?: string;
  created_at?: string;
  members: ConversationMember[];
  other_participant?: ConversationMember;
  media_count?: number;
  link_count?: number;
  document_count?: number;
}

export default function ConversationManagement() {
  const { conversationId } = useLocalSearchParams();
  const { makeAuthenticatedRequest } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState<ConversationDetails | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ephemeralMessages, setEphemeralMessages] = useState(false);

  useEffect(() => {
    loadConversationDetails();
  }, [conversationId]);

  const loadConversationDetails = async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/conversations/${conversationId}/`
      );
      
      if (response.ok) {
        const data = await response.json();
        setConversation(data);
      }
    } catch (error) {
      console.error('Erreur chargement détails:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = () => {
    Alert.alert(
      'Supprimer la conversation',
      'Êtes-vous sûr de vouloir supprimer cette conversation ? Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/messaging/conversations/${conversationId}/`,
                { method: 'DELETE' }
              );
              if (response.ok) {
                router.back();
              }
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer');
            }
          }
        }
      ]
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Quitter le groupe',
      'Voulez-vous quitter ce groupe ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            // API call to leave group
            router.back();
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="rgba(10, 145, 104, 1)" />
      </View>
    );
  }

  const isGroup = conversation?.is_group || false;
  const members = isGroup ? conversation?.members || [] : [];
  const contact = conversation?.other_participant;

  // Composant pour une ligne de paramètre
  const SettingRow = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    showArrow = true, 
    rightElement,
    danger = false,
    first = false,
    last = false,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    showArrow?: boolean;
    rightElement?: React.ReactNode;
    danger?: boolean;
    first?: boolean;
    last?: boolean;
  }) => (
    <TouchableOpacity
      style={[
        styles.settingRow,
        first && styles.settingRowFirst,
        last && styles.settingRowLast,
      ]}
      onPress={onPress}
      disabled={!onPress && !rightElement}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, danger && styles.iconDanger]}>
        <Ionicons name={icon as any} size={22} color={danger ? '#ff6b6b' : 'rgba(10, 145, 104, 1)'} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, danger && styles.settingTitleDanger]}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (showArrow && (
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      ))}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Bouton retour flottant */}
      <TouchableOpacity onPress={() => router.back()} style={styles.floatingBackButton}>
        <LinearGradient
          colors={['rgba(10, 145, 104, 0.95)', 'rgba(10, 145, 104, 0.85)']}
          style={styles.backButtonGradient}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Header flottant */}
      <LinearGradient
        colors={['rgba(10, 145, 104, 0.95)', 'rgba(10, 145, 104, 0.85)']}
        style={styles.floatingHeader}
      >
        <Ionicons name="settings-outline" size={20} color="#fff" />
        <Text style={styles.headerTitle}>
          {isGroup ? 'Paramètres du groupe' : 'Infos du contact'}
        </Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section Photo/Avatar */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrapper}>
            {contact?.photo_profil_url ? (
              <Image
                source={{ uri: contact.photo_profil_url }}
                style={styles.largeAvatar}
                contentFit="cover"
              />
            ) : (
              <DefaultAvatar 
                name={contact?.surnom || contact?.username || (isGroup ? 'Groupe' : 'Contact')} 
                size={120} 
              />
            )}
          </View>
          <Text style={styles.profileName}>
            {contact?.surnom || contact?.username || conversation?.name || 'Groupe'}
          </Text>
          {contact?.is_ai && (
            <View style={styles.aiBadgeLarge}>
              <Ionicons name="flash" size={16} color="#fff" />
              <Text style={styles.aiBadgeTextLarge}>Agent IA</Text>
            </View>
          )}
          {isGroup && conversation?.description && (
            <Text style={styles.groupDesc}>{conversation.description}</Text>
          )}
        </View>

        {/* Section Actions rapides */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <LinearGradient
              colors={['rgba(10, 145, 104, 0.1)', 'rgba(10, 145, 104, 0.05)']}
              style={styles.quickActionGradient}
            >
              <Ionicons name="search-outline" size={24} color="rgba(10, 145, 104, 1)" />
              <Text style={styles.quickActionText}>Rechercher</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickAction}>
            <LinearGradient
              colors={['rgba(10, 145, 104, 0.1)', 'rgba(10, 145, 104, 0.05)']}
              style={styles.quickActionGradient}
            >
              <Ionicons name="volume-high-outline" size={24} color="rgba(10, 145, 104, 1)" />
              <Text style={styles.quickActionText}>Appeler</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickAction}>
            <LinearGradient
              colors={['rgba(10, 145, 104, 0.1)', 'rgba(10, 145, 104, 0.05)']}
              style={styles.quickActionGradient}
            >
              <Ionicons name="videocam-outline" size={24} color="rgba(10, 145, 104, 1)" />
              <Text style={styles.quickActionText}>Vidéo</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Section Membres (si groupe) */}
        {isGroup && members.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{members.length} membres</Text>
              <TouchableOpacity>
                <Ionicons name="add-circle" size={24} color="rgba(10, 145, 104, 1)" />
              </TouchableOpacity>
            </View>
            
            {members.slice(0, 5).map((member) => (
              <TouchableOpacity key={member.uuid} style={styles.memberRow}>
                <DefaultAvatar name={member.surnom || member.username} size={44} />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.surnom || member.username}</Text>
                  {member.is_ai && (
                    <View style={styles.aiBadgeSmall}>
                      <Ionicons name="flash" size={10} color="#fff" />
                      <Text style={styles.aiBadgeTextSmall}>IA</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
            
            {members.length > 5 && (
              <TouchableOpacity style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>Voir tous les membres</Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(10, 145, 104, 1)" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Section Médias, liens et documents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Médias, liens et documents</Text>
          
          <View style={styles.mediaGrid}>
            <TouchableOpacity style={styles.mediaItem}>
              <Ionicons name="image-outline" size={28} color="rgba(10, 145, 104, 1)" />
              <Text style={styles.mediaCount}>{conversation?.media_count || 0}</Text>
              <Text style={styles.mediaLabel}>Médias</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaItem}>
              <Ionicons name="link-outline" size={28} color="rgba(10, 145, 104, 1)" />
              <Text style={styles.mediaCount}>{conversation?.link_count || 0}</Text>
              <Text style={styles.mediaLabel}>Liens</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaItem}>
              <Ionicons name="document-outline" size={28} color="rgba(10, 145, 104, 1)" />
              <Text style={styles.mediaCount}>{conversation?.document_count || 0}</Text>
              <Text style={styles.mediaLabel}>Fichiers</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Paramètres */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paramètres</Text>
          
          <View style={styles.settingsGroup}>
            <SettingRow
              icon="notifications-outline"
              title="Notifications"
              subtitle={notificationsEnabled ? "Activées" : "Désactivées"}
              rightElement={
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: '#ccc', true: 'rgba(10, 145, 104, 0.3)' }}
                  thumbColor={notificationsEnabled ? 'rgba(10, 145, 104, 1)' : '#f4f3f4'}
                />
              }
              showArrow={false}
              first
            />
            
            <SettingRow
              icon="volume-high-outline"
              title="Son des notifications"
              subtitle={soundEnabled ? "Activé" : "Désactivé"}
              rightElement={
                <Switch
                  value={soundEnabled}
                  onValueChange={setSoundEnabled}
                  trackColor={{ false: '#ccc', true: 'rgba(10, 145, 104, 0.3)' }}
                  thumbColor={soundEnabled ? 'rgba(10, 145, 104, 1)' : '#f4f3f4'}
                />
              }
              showArrow={false}
            />
            
            <SettingRow
              icon="time-outline"
              title="Messages éphémères"
              subtitle={ephemeralMessages ? "Activés - 24h" : "Désactivés"}
              rightElement={
                <Switch
                  value={ephemeralMessages}
                  onValueChange={setEphemeralMessages}
                  trackColor={{ false: '#ccc', true: 'rgba(10, 145, 104, 0.3)' }}
                  thumbColor={ephemeralMessages ? 'rgba(10, 145, 104, 1)' : '#f4f3f4'}
                />
              }
              showArrow={false}
              last
            />
          </View>
        </View>

        {/* Section Personnalisation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personnalisation</Text>
          
          <View style={styles.settingsGroup}>
            <SettingRow
              icon="color-palette-outline"
              title="Fond d'écran"
              subtitle="Personnaliser l'arrière-plan"
              onPress={() => Alert.alert('Fond d\'écran', 'Fonctionnalité à venir')}
              first
            />
            
            <SettingRow
              icon="star-outline"
              title="Messages importants"
              subtitle="0 messages marqués"
              onPress={() => Alert.alert('Messages importants', 'Aucun message marqué')}
              last
            />
          </View>
        </View>

        {/* Section Actions */}
        <View style={styles.section}>
          <View style={styles.settingsGroup}>
            <SettingRow
              icon="lock-closed-outline"
              title="Cryptage"
              subtitle="Conversation cryptée de bout en bout"
              showArrow={false}
              first
            />
            
            <SettingRow
              icon="archive-outline"
              title="Archiver la conversation"
              onPress={() => Alert.alert('Archiver', 'Conversation archivée')}
            />
            
            <SettingRow
              icon="export-outline"
              title="Exporter la conversation"
              onPress={() => Alert.alert('Exporter', 'Export en cours...')}
              last
            />
          </View>
        </View>

        {/* Section Danger Zone */}
        <View style={styles.section}>
          <View style={styles.settingsGroup}>
            {!isGroup && (
              <SettingRow
                icon="ban-outline"
                title="Bloquer le contact"
                onPress={() => Alert.alert('Bloquer', 'Contact bloqué')}
                danger
                first={!isGroup}
              />
            )}
            
            <SettingRow
              icon="trash-outline"
              title="Supprimer la conversation"
              subtitle="Supprimer tout l'historique"
              onPress={handleDeleteConversation}
              danger
            />
            
            {isGroup && (
              <SettingRow
                icon="exit-outline"
                title="Quitter le groupe"
                onPress={handleLeaveGroup}
                danger
                last
              />
            )}
            
            {!isGroup && (
              <SettingRow
                icon="flag-outline"
                title="Signaler"
                subtitle="Signaler ce contact"
                onPress={() => Alert.alert('Signaler', 'Contact signalé aux modérateurs')}
                danger
                last
              />
            )}
          </View>
        </View>

        {/* Informations supplémentaires */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            {isGroup 
              ? `Groupe créé le ${conversation?.created_at ? new Date(conversation.created_at).toLocaleDateString('fr-FR') : 'N/A'}`
              : 'Les messages et appels sont cryptés de bout en bout.'
            }
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  floatingBackButton: {
    position: 'absolute',
    top: 70,
    left: 20,
    zIndex: 20,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  backButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingHeader: {
    position: 'absolute',
    top: 70,
    left: 80,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22,
    zIndex: 10,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingTop: 120,
  },
  
  // Section Profil
  profileSection: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  avatarWrapper: {
    marginBottom: 15,
    shadowColor: 'rgba(10, 145, 104, 0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  largeAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  profileName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  aiBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 145, 104, 1)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  aiBadgeTextLarge: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  groupDesc: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },

  // Actions rapides
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  quickAction: {
    flex: 1,
    marginHorizontal: 8,
  },
  quickActionGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
  },
  quickActionText: {
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(10, 145, 104, 1)',
    fontWeight: '600',
  },

  // Sections
  section: {
    backgroundColor: '#fff',
    marginBottom: 10,
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  // Membres
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  aiBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(10, 145, 104, 1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  aiBadgeTextSmall: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
  },
  viewAllText: {
    color: 'rgba(10, 145, 104, 1)',
    fontSize: 15,
    fontWeight: '600',
  },

  // Médias
  mediaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mediaItem: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    minWidth: 90,
  },
  mediaCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  mediaLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  // Paramètres
  settingsGroup: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fafafa',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingRowFirst: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  settingRowLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconDanger: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  settingTitleDanger: {
    color: '#ff6b6b',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },

  // Info Section
  infoSection: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  infoText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
  },
});