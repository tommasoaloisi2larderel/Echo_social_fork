// components/AttachmentButton.tsx
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/contexts/ChatContext';
import { Modal } from 'react-native';

const API_BASE_URL = "https://reseausocial-production.up.railway.app";

interface StagedAttachment {
  uri: string;
  name: string;
  type: string;
  kind: 'image' | 'video' | 'file';
}

interface AttachmentButtonProps {
  conversationId: string;
  onAttachmentSent?: () => void; // Callback optionnel après envoi
}

/**
 * Bouton flottant pour ajouter des pièces jointes (photo, vidéo, fichier)
 * Peut être placé n'importe où dans une page de conversation
 */
export default function AttachmentButton({ 
  conversationId, 
  onAttachmentSent 
}: AttachmentButtonProps) {
  const { makeAuthenticatedRequest } = useAuth();
  const { websocket } = useChat();
  
  const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showPickerMenu, setShowPickerMenu] = useState(false);

  // ==================== SÉLECTION DES FICHIERS ====================

  const handlePickCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Caméra', 'Autorisez l\'accès à la caméra.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      const name = `photo_${Date.now()}.jpg`;
      setStagedAttachments((prev) => [...prev, { 
        uri: asset.uri, 
        name, 
        type: 'image/jpeg', 
        kind: 'image' 
      }]);
    } catch (e) {
      console.error('camera error', e);
    }
  };

  const handlePickPhotoVideo = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Galerie', 'Autorisez l\'accès à la galerie.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      const isVideo = asset.type === 'video';
      const name = asset.fileName || `${isVideo ? 'video' : 'photo'}_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`;
      const type = isVideo ? 'video/mp4' : 'image/jpeg';
      setStagedAttachments((prev) => [...prev, { 
        uri: asset.uri, 
        name, 
        type, 
        kind: isVideo ? 'video' : 'image' 
      }]);
    } catch (e) {
      console.error('pick photo/video error', e);
    }
  };

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        multiple: false,
        type: '*/*',
        copyToCacheDirectory: true,
      });
      // @ts-ignore
      if (res.canceled || res.type === 'cancel') return;
      // @ts-ignore
      const file = res.assets?.[0] || res;
      const uri = file.uri;
      const name = file.name || `file_${Date.now()}`;
      const mime = file.mimeType || 'application/octet-stream';
      setStagedAttachments((prev) => [...prev, { 
        uri, 
        name, 
        type: mime, 
        kind: 'file' 
      }]);
    } catch (e) {
      console.error('pick doc error', e);
    }
  };
/*
  const handleShowMenu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Annuler', 'Prendre une photo', 'Photo/Vidéo', 'Fichier'],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) handlePickCamera();
          else if (idx === 2) handlePickPhotoVideo();
          else if (idx === 3) handlePickDocument();
        }
      );
    } else {
      Alert.alert('Ajouter', 'Choisissez une option', [
        { text: 'Prendre une photo', onPress: handlePickCamera },
        { text: 'Photo/Vidéo de la galerie', onPress: handlePickPhotoVideo },
        { text: 'Fichier', onPress: handlePickDocument },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  };
*/
    const handleShowMenu = () => setShowPickerMenu(true);



  // ==================== UPLOAD ET ENVOI ====================

    const uploadAttachment = async (file: { uri: string; name: string; type: string }): Promise<string | null> => {
    try {
        const formData = new FormData();
        
        // ✅ Sur mobile, il faut spécifier le filename et le type correctement
        formData.append('file', {
        uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
        name: file.name,
        type: file.type,
        } as any);

        console.log('📤 Uploading:', file.name, file.type);

        const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/attachments/upload/`,
        {
            method: 'POST',
            body: formData,
        }
        );

        if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Upload failed:', response.status, errorText);
        Alert.alert('Erreur', `Upload échoué: ${response.status}`);
        return null;
        }

        const data = await response.json();
        
        if (data?.uuid) {
        console.log('✅ Attachment uploaded:', data.uuid);
        return data.uuid;
        }
        
        return null;
        
    } catch (e) {
        console.error('uploadAttachment error', e);
        Alert.alert('Erreur', "Impossible d'uploader le fichier");
        return null;
    }
    };

  const handleSendAttachments = async () => {
    if (stagedAttachments.length === 0) return;
    
    setIsUploading(true);
    try {
      const uuids: string[] = [];
      
      // Upload de tous les fichiers
      for (const att of stagedAttachments) {
        const uuid = await uploadAttachment({ 
          uri: att.uri, 
          name: att.name, 
          type: att.type 
        });
        if (uuid) uuids.push(uuid);
      }

      if (uuids.length === 0) {
        Alert.alert('Erreur', 'Impossible d\'uploader les fichiers');
        return;
      }

      // Envoi via WebSocket
      const payload = {
        type: 'chat_message',
        conversation_uuid: conversationId,
        message: `📎 ${stagedAttachments.length} fichier(s) joint(s)`,
        attachment_uuids: uuids,
      };

      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify(payload));
        console.log('✅ Attachments sent via WebSocket');
      } else {
        // Fallback REST API
        await makeAuthenticatedRequest(
          `${API_BASE_URL}/messaging/conversations/${conversationId}/messages/create-with-attachments/`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: payload.message,
              attachment_uuids: uuids,
            }),
          }
        );
        console.log('✅ Attachments sent via REST API');
      }

      // Nettoyage et callback
      setStagedAttachments([]);
      onAttachmentSent?.();
      
    } catch (e) {
      console.error('send attachments error', e);
      Alert.alert('Erreur', "Impossible d'envoyer les fichiers");
    } finally {
      setIsUploading(false);
    }
  };

  const removeStagedAt = (index: number) => {
    setStagedAttachments((prev) => prev.filter((_, i) => i !== index));
  };
  

    const AttachmentMenu = () => (
    <Modal
        transparent
        animationType="fade"
        visible={showPickerMenu}
        onRequestClose={() => setShowPickerMenu(false)}
    >
        <TouchableOpacity style={styles.menuBackdrop} onPress={() => setShowPickerMenu(false)}>
        <View style={styles.menuContainer}>
            {[
            { label: 'Prendre une photo', icon: 'camera', action: handlePickCamera },
            { label: 'Photo/Vidéo', icon: 'images', action: handlePickPhotoVideo },
            { label: 'Fichier', icon: 'document', action: handlePickDocument },
            ].map((item, i) => (
            <TouchableOpacity key={i} style={styles.menuItem} onPress={() => {
                setShowPickerMenu(false);
                item.action();
            }}>
                <Ionicons name={item.icon as any} size={22} color="rgba(10,145,104,1)" />
                <Text style={styles.menuText}>{item.label}</Text>
            </TouchableOpacity>
            ))}
        </View>
        </TouchableOpacity>
    </Modal>
    );

  // ==================== RENDER ====================

  return (
    <View style={styles.container}>
      {/* Bouton principal flottant */}
      <TouchableOpacity
        style={styles.mainButton}
        onPress={handleShowMenu}
        activeOpacity={0.8}
      >
        {Platform.OS === 'ios' ? (
          <SymbolView 
            name="paperclip.circle.fill" 
            size={56} 
            tintColor="rgba(10, 145, 104, 1)" 
            type="hierarchical" 
          />
        ) : (
          <View style={styles.androidButton}>
            <Ionicons 
              name="attach" 
              size={28} 
              color="#fff" 
            />
          </View>
        )}
      </TouchableOpacity>

      {/* Prévisualisation des pièces jointes sélectionnées */}
      {stagedAttachments.length > 0 && (
        <View style={styles.previewContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.previewScroll}
          >
            {stagedAttachments.map((att, idx) => (
              <View key={idx} style={styles.attachmentItem}>
                {att.kind === 'image' ? (
                  <Image source={{ uri: att.uri }} style={styles.attachmentImage} />
                ) : (
                  <View style={styles.attachmentFileIcon}>
                    <Ionicons 
                      name={att.kind === 'video' ? 'videocam' : 'document'} 
                      size={32} 
                      color="rgba(10,145,104,1)" 
                    />
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => removeStagedAt(idx)}
                  style={styles.removeButton}
                >
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </TouchableOpacity>
                <Text numberOfLines={1} style={styles.attachmentName}>
                  {att.name}
                </Text>
              </View>
            ))}
          </ScrollView>

          {/* Bouton d'envoi */}
          <TouchableOpacity
            style={styles.sendButton}
            onPress={handleSendAttachments}
            disabled={isUploading}
            activeOpacity={0.8}
          >
            {isUploading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.sendButtonText}>Envoyer</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

    {showPickerMenu && <AttachmentMenu />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 55,
    right: 310,
    alignItems: 'flex-end',
    zIndex: 10000,
  },
  mainButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  androidButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(10, 145, 104, 1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContainer: {
    position: 'absolute',
    bottom: 60,
    maxHeight: 160,
    width: 250,
    right: -210,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    maxWidth: 300,
  },
  previewScroll: {
    maxHeight: 120,
  },
  attachmentItem: {
    width: 80,
    marginRight: 10,
    alignItems: 'center',
  },
  attachmentImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  attachmentFileIcon: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: 'rgba(10,145,104,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentName: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
    width: 80,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(255,0,0,0.9)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 145, 104, 1)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  menuBackdrop: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.4)',
  justifyContent: 'flex-end',
},
menuContainer: {
  backgroundColor: '#fff',
  paddingVertical: 20,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
},
menuItem: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 15,
  paddingHorizontal: 20,
},
menuText: {
  marginLeft: 12,
  fontSize: 16,
  fontWeight: '500',
},
});