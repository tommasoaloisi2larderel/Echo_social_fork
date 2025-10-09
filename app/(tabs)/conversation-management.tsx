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
          <LinearGradient
            colors={['rgba(10, 145, 104, 0.03)', 'rgba(10, 145, 104, 0.01)']}
            style={styles.profileGradient}
          >
            <View style={styles.avatarWrapper}>
              {isGroup ? (
                <View style={styles.groupAvatarContainer}>
                  <LinearGradient
                    colors={['rgba(10, 145, 104, 0.9)', 'rgba(10, 145, 104, 0.7)']}
                    style={styles.largeAvatar}
                  >
                    <Ionicons name="people" size={50} color="#fff" />
                  </LinearGradient>
                </View>
              ) : contact?.photo_profil_url ? (
                <Image
                  source={{ uri: contact.photo_profil_url }}
                  style={styles.largeAvatar}
                  contentFit="cover"
                />
              ) : (
                <DefaultAvatar 
                  name={contact?.surnom || contact?.username || 'Contact'} 
                  size={120} 
                />
              )}
            </View>
            <Text style={styles.profileName}>
              {isGroup 
                ? conversation?.name || 'Groupe' 
                : contact?.surnom || contact?.username || 'Contact'
              }
            </Text>
            {contact?.is_ai && !isGroup && (
              <View style={styles.aiBadgeLarge}>
                <Ionicons name="flash" size={16} color="#fff" />
                <Text style={styles.aiBadgeTextLarge}>Agent IA</Text>
              </View>
            )}
            {isGroup && conversation?.description && (
              <Text style={styles.groupDesc}>{conversation.description}</Text>
            )}
            {!isGroup && contact?.username && (
              <Text style={styles.username}>@{contact.username}</Text>
            )}
          </LinearGradient>
        </View>

        {/* Section Actions rapides - seulement pour conversations privées */}
        {!isGroup && (
          <View style={styles.quickActionsContainer}>
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={['rgba(10, 145, 104, 0.15)', 'rgba(10, 145, 104, 0.08)']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="search-outline" size={24} color="rgba(10, 145, 104, 1)" />
                  <Text style={styles.quickActionText}>Rechercher</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={['rgba(10, 145, 104, 0.15)', 'rgba(10, 145, 104, 0.08)']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="call-outline" size={24} color="rgba(10, 145, 104, 1)" />
                  <Text style={styles.quickActionText}>Appeler</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={['rgba(10, 145, 104, 0.15)', 'rgba(10, 145, 104, 0.08)']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="videocam-outline" size={24} color="rgba(10, 145, 104, 1)" />
                  <Text style={styles.quickActionText}>Vidéo</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Section Membres (si groupe) */}
        {isGroup && members.length > 0 && (
          <View style={styles.floatingCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                <Ionicons name="people" size={16} color="rgba(10, 145, 104, 1)" /> {members.length} membres
              </Text>
              <TouchableOpacity style={styles.addButton}>
                <LinearGradient
                  colors={['rgba(10, 145, 104, 0.2)', 'rgba(10, 145, 104, 0.1)']}
                  style={styles.addButtonGradient}
                >
                  <Ionicons name="person-add" size={18} color="rgba(10, 145, 104, 1)" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
            
            <View style={styles.membersList}>
              {members.slice(0, 5).map((member, index) => (
                <TouchableOpacity 
                  key={member.uuid} 
                  style={[
                    styles.memberRow,
                    index === members.slice(0, 5).length - 1 && styles.memberRowLast
                  ]}
                >
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
                  <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>
              ))}
            </View>
            
            {members.length > 5 && (
              <TouchableOpacity style={styles.viewAllButton}>
                <LinearGradient
                  colors={['rgba(10, 145, 104, 0.1)', 'rgba(10, 145, 104, 0.05)']}
                  style={styles.viewAllGradient}
                >
                  <Text style={styles.viewAllText}>Voir tous les membres</Text>
                  <Ionicons name="chevron-forward" size={16} color="rgba(10, 145, 104, 1)" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Actions pour groupes */}
        {isGroup && (
          <View style={styles.quickActionsContainer}>
            <View style={styles.quickActions}>
              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={['rgba(10, 145, 104, 0.15)', 'rgba(10, 145, 104, 0.08)']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="search-outline" size={24} color="rgba(10, 145, 104, 1)" />
                  <Text style={styles.quickActionText}>Rechercher</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={['rgba(10, 145, 104, 0.15)', 'rgba(10, 145, 104, 0.08)']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="create-outline" size={24} color="rgba(10, 145, 104, 1)" />
                  <Text style={styles.quickActionText}>Modifier</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickAction}>
                <LinearGradient
                  colors={['rgba(10, 145, 104, 0.15)', 'rgba(10, 145, 104, 0.08)']}
                  style={styles.quickActionGradient}
                >
                  <Ionicons name="image-outline" size={24} color="rgba(10, 145, 104, 1)" />
                  <Text style={styles.quickActionText}>Photo</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Section Médias, liens et documents */}
        <View style={styles.floatingCard}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="folder-outline" size={16} color="rgba(10, 145, 104, 1)" /> Médias, liens et documents
          </Text>
          
          <View style={styles.mediaGrid}>
            <TouchableOpacity style={styles.mediaItem}>
              <LinearGradient
                colors={['rgba(10, 145, 104, 0.12)', 'rgba(10, 145, 104, 0.06)']}
                style={styles.mediaItemGradient}
              >
                <Ionicons name="image-outline" size={32} color="rgba(10, 145, 104, 1)" />
                <Text style={styles.mediaCount}>{conversation?.media_count || 0}</Text>
                <Text style={styles.mediaLabel}>Médias</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaItem}>
              <LinearGradient
                colors={['rgba(10, 145, 104, 0.12)', 'rgba(10, 145, 104, 0.06)']}
                style={styles.mediaItemGradient}
              >
                <Ionicons name="link-outline" size={32} color="rgba(10, 145, 104, 1)" />
                <Text style={styles.mediaCount}>{conversation?.link_count || 0}</Text>
                <Text style={styles.mediaLabel}>Liens</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaItem}>
              <LinearGradient
                colors={['rgba(10, 145, 104, 0.12)', 'rgba(10, 145, 104, 0.06)']}
                style={styles.mediaItemGradient}
              >
                <Ionicons name="document-outline" size={32} color="rgba(10, 145, 104, 1)" />
                <Text style={styles.mediaCount}>{conversation?.document_count || 0}</Text>
                <Text style={styles.mediaLabel}>Fichiers</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section Paramètres */}
        <View style={styles.floatingCard}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="settings-outline" size={16} color="rgba(10, 145, 104, 1)" /> Paramètres
          </Text>
          
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
        <View style={styles.floatingCard}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="brush-outline" size={16} color="rgba(10, 145, 104, 1)" /> Personnalisation
          </Text>
          
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
        <View style={styles.floatingCard}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="shield-checkmark-outline" size={16} color="rgba(10, 145, 104, 1)" /> Sécurité & Actions
          </Text>
          
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
              icon="share-outline"
              title="Exporter la conversation"
              onPress={() => Alert.alert('Exporter', 'Export en cours...')}
              last
            />
          </View>
        </View>

        {/* Section Danger Zone */}
        <View style={styles.floatingCard}>
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
    backgroundColor: '#f0f2f5',
  },
  floatingBackButton: {
    position: 'absolute',
    top: 70,
    left: 20,
    zIndex: 20,
    shadowColor: 'rgba(10, 145, 104, 0.5)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },
  backButtonGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingHeader: {
    position: 'absolute',
    top: 70,
    left: 84,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    zIndex: 10,
    shadowColor: 'rgba(10, 145, 104, 0.5)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
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
    marginBottom: 16,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: 'rgba(10, 145, 104, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    backgroundColor: '#fff',
  },
  profileGradient: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  avatarWrapper: {
    marginBottom: 15,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  groupAvatarContainer: {
    borderRadius: 60,
  },
  largeAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  username: {
    fontSize: 15,
    color: '#666',
    marginTop: 4,
  },
  aiBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 145, 104, 1)',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 8,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  aiBadgeTextLarge: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  groupDesc: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 22,
  },

  // Actions rapides - Container flottant
  quickActionsContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: 'rgba(10, 145, 104, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    backgroundColor: '#fff',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  quickAction: {
    flex: 1,
    marginHorizontal: 6,
  },
  quickActionGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 18,
    shadowColor: 'rgba(10, 145, 104, 0.15)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  quickActionText: {
    marginTop: 10,
    fontSize: 13,
    color: 'rgba(10, 145, 104, 1)',
    fontWeight: '700',
  },

  // Cards flottantes
  floatingCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: 'rgba(10, 145, 104, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    marginBottom: 16,
    letterSpacing: 0.8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: 'rgba(10, 145, 104, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonGradient: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Membres
  membersList: {
    marginTop: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  memberRowLast: {
    borderBottomWidth: 0,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  aiBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(10, 145, 104, 1)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
  },
  aiBadgeTextSmall: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  viewAllButton: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  viewAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  viewAllText: {
    color: 'rgba(10, 145, 104, 1)',
    fontSize: 15,
    fontWeight: '700',
  },

  // Médias
  mediaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
  },
  mediaItem: {
    flex: 1,
  },
  mediaItemGradient: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  mediaCount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 10,
  },
  mediaLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontWeight: '600',
  },

  // Paramètres
  settingsGroup: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fafafa',
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  settingRowFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  settingRowLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(10, 145, 104, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconDanger: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  settingTitleDanger: {
    color: '#ff6b6b',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 3,
  },

  // Info Section
  infoSection: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginHorizontal: 16,
  },
  infoText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});