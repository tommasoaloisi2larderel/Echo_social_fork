import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Linking,
  Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import AttachmentImage from '@/components/FIlesLecture/AttachementImage';
import AttachmentVideo from '@/components/FIlesLecture/AttachementVideo';

const API_BASE_URL = "https://reseausocial-production.up.railway.app";
const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 48) / 3; // 3 colonnes avec marges

interface MediaItem {
  attachment_uuid: string;
  file_url: string;
  thumbnail_url: string | null;
  compressed_url: string | null;
  file_type: 'image' | 'video' | 'document';
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  original_filename: string;
  created_at: string;
  message: {
    uuid: string;
    content: string;
    created_at: string;
    sender: {
      uuid: string;
      username: string;
    };
  };
}

interface MediaResponse {
  conversation_uuid: string;
  page: number;
  page_size: number;
  total_count: number;
  has_next: boolean;
  items: MediaItem[];
}

export default function ConversationMedia() {
  const { conversationId, initialTab } = useLocalSearchParams();
  const { makeAuthenticatedRequest } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<'photos' | 'documents'>(
    (initialTab as 'photos' | 'documents') || 'photos'
  );
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [documents, setDocuments] = useState<MediaItem[]>([]);
  const [photosPage, setPhotosPage] = useState(1);
  const [documentsPage, setDocumentsPage] = useState(1);
  const [hasNextPhotos, setHasNextPhotos] = useState(false);
  const [hasNextDocuments, setHasNextDocuments] = useState(false);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [totalDocuments, setTotalDocuments] = useState(0);

  useEffect(() => {
    if (activeTab === 'photos') {
      loadPhotos(1);
    } else {
      loadDocuments(1);
    }
  }, [activeTab]);

  const loadPhotos = async (page: number) => {
    try {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/conversations/${conversationId}/media/photos/?page=${page}`
      );

      if (response.ok) {
        const data: MediaResponse = await response.json();
        
        if (page === 1) {
          setPhotos(data.items);
        } else {
          setPhotos(prev => [...prev, ...data.items]);
        }
        
        setHasNextPhotos(data.has_next);
        setTotalPhotos(data.total_count);
        setPhotosPage(page);
      }
    } catch (error) {
      console.error('Erreur chargement photos:', error);
      Alert.alert('Erreur', 'Impossible de charger les photos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadDocuments = async (page: number) => {
    try {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/conversations/${conversationId}/media/documents/?page=${page}`
      );

      if (response.ok) {
        const data: MediaResponse = await response.json();
        
        if (page === 1) {
          setDocuments(data.items);
        } else {
          setDocuments(prev => [...prev, ...data.items]);
        }
        
        setHasNextDocuments(data.has_next);
        setTotalDocuments(data.total_count);
        setDocumentsPage(page);
      }
    } catch (error) {
      console.error('Erreur chargement documents:', error);
      Alert.alert('Erreur', 'Impossible de charger les documents');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (loadingMore) return;
    
    if (activeTab === 'photos' && hasNextPhotos) {
      loadPhotos(photosPage + 1);
    } else if (activeTab === 'documents' && hasNextDocuments) {
      loadDocuments(documentsPage + 1);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const openFile = async (item: MediaItem) => {
    try {
      const url = item.file_url;
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Erreur', 'Impossible d\'ouvrir ce fichier');
      }
    } catch (error) {
      console.error('Erreur ouverture fichier:', error);
      Alert.alert('Erreur', 'Impossible d\'ouvrir ce fichier');
    }
  };
  
    const renderPhotoItem = ({ item }: { item: MediaItem }) => {
    if (item.file_type === 'video') {
        return (
        <View style={styles.photoItem}>
            <AttachmentVideo
            thumbnailUrl={item.thumbnail_url || item.file_url}
            videoUrl={item.file_url}
            />
        </View>
        );
    }
    
    // Pour les images
    return (
        <View style={styles.photoItem}>
        <AttachmentImage
            thumbnailUrl={item.thumbnail_url || item.compressed_url || item.file_url}
            fullUrl={item.file_url}
        />
        </View>
    );
    };
 

  const getDocumentIcon = (mimeType: string): string => {
    if (mimeType.includes('pdf')) return 'document-text';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'stats-chart';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'easel';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return 'archive';
    return 'document-outline';
  };

  const renderDocumentItem = ({ item }: { item: MediaItem }) => (
    <TouchableOpacity
      style={styles.documentItem}
      onPress={() => openFile(item)}
      activeOpacity={0.7}
    >
      <View style={styles.documentIcon}>
        <Ionicons name={getDocumentIcon(item.mime_type) as any} size={28} color="rgba(10, 145, 104, 1)" />
      </View>
      <View style={styles.documentInfo}>
        <Text style={styles.documentName} numberOfLines={2}>
          {item.original_filename}
        </Text>
        <Text style={styles.documentMeta}>
          {formatFileSize(item.file_size)} • {formatDate(item.created_at)}
        </Text>
        <Text style={styles.documentSender} numberOfLines={1}>
          Par {item.message.sender.username}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons
        name={activeTab === 'photos' ? 'images-outline' : 'document-outline'}
        size={80}
        color="rgba(10, 145, 104, 0.3)"
      />
      <Text style={styles.emptyTitle}>
        {activeTab === 'photos' ? 'Aucun média' : 'Aucun document'}
      </Text>
      <Text style={styles.emptyText}>
        {activeTab === 'photos'
          ? 'Les photos et vidéos partagées apparaîtront ici'
          : 'Les documents partagés apparaîtront ici'}
      </Text>
    </View>
  );

  const currentData = activeTab === 'photos' ? photos : documents;
  const currentTotal = activeTab === 'photos' ? totalPhotos : totalDocuments;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color="rgba(10, 145, 104, 1)" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Médias et Documents</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Onglets */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'photos' && styles.tabActive]}
          onPress={() => setActiveTab('photos')}
        >
          <Ionicons
            name="images-outline"
            size={20}
            color={activeTab === 'photos' ? 'rgba(10, 145, 104, 1)' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'photos' && styles.tabTextActive]}>
            Photos/Vidéos
          </Text>
          {totalPhotos > 0 && (
            <View style={[styles.badge, activeTab === 'photos' && styles.badgeActive]}>
              <Text style={[styles.badgeText, activeTab === 'photos' && styles.badgeTextActive]}>
                {totalPhotos}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'documents' && styles.tabActive]}
          onPress={() => setActiveTab('documents')}
        >
          <Ionicons
            name="document-outline"
            size={20}
            color={activeTab === 'documents' ? 'rgba(10, 145, 104, 1)' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'documents' && styles.tabTextActive]}>
            Documents
          </Text>
          {totalDocuments > 0 && (
            <View style={[styles.badge, activeTab === 'documents' && styles.badgeActive]}>
              <Text style={[styles.badgeText, activeTab === 'documents' && styles.badgeTextActive]}>
                {totalDocuments}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Contenu */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="rgba(10, 145, 104, 1)" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : currentData.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={currentData}
          renderItem={activeTab === 'photos' ? renderPhotoItem : renderDocumentItem}
          keyExtractor={(item) => item.attachment_uuid}
          numColumns={activeTab === 'photos' ? 3 : 1}
          key={activeTab} // Force re-render when switching tabs
          contentContainerStyle={styles.listContent}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator color="rgba(10, 145, 104, 1)" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 145, 104, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    gap: 8,
  },
  tabActive: {
    backgroundColor: 'rgba(10, 145, 104, 0.12)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: 'rgba(10, 145, 104, 1)',
  },
  badge: {
    backgroundColor: '#e0e0e0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeActive: {
    backgroundColor: 'rgba(10, 145, 104, 0.2)',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  badgeTextActive: {
    color: 'rgba(10, 145, 104, 1)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  listContent: {
    padding: 16,
  },
  
  // Photos/Vidéos
  photoItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  
  // Documents
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    gap: 12,
  },
  documentIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(10, 145, 104, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentInfo: {
    flex: 1,
    gap: 4,
  },
  documentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  documentMeta: {
    fontSize: 12,
    color: '#888',
  },
  documentSender: {
    fontSize: 12,
    color: '#666',
  },
  
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});