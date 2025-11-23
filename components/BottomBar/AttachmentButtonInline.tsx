import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface AttachmentButtonInlineProps {
  conversationId: string;
  // NEW: We pass the selected file up instead of sending it
  onFileSelected: (file: { uri: string; type: 'image' | 'video' | 'file'; name: string; mime: string }) => void;
  disabled?: boolean;
}

const AttachmentButtonInline: React.FC<AttachmentButtonInlineProps> = ({
  conversationId,
  onFileSelected,
  disabled,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  // ==================== FILE PICKERS ====================

  const handlePickCamera = async () => {
    setShowMenu(false);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Caméra', "Autorisez l'accès à la caméra.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;

      onFileSelected({
        uri: asset.uri,
        name: `photo_${Date.now()}.jpg`,
        type: 'image',
        mime: 'image/jpeg'
      });
    } catch (e) {
      console.error('camera error', e);
    }
  };

  const handlePickPhotoVideo = async () => {
    setShowMenu(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Galerie', "Autorisez l'accès à la galerie.");
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
      
      onFileSelected({
        uri: asset.uri,
        name: name,
        type: isVideo ? 'video' : 'image',
        mime: isVideo ? 'video/mp4' : 'image/jpeg'
      });

    } catch (e) {
      console.error('pick photo/video error', e);
    }
  };

  const handlePickDocument = async () => {
    setShowMenu(false);
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
      
      onFileSelected({
        uri: file.uri,
        name: file.name || `file_${Date.now()}`,
        type: 'file',
        mime: file.mimeType || 'application/octet-stream'
      });
    } catch (e) {
      console.error('pick doc error', e);
    }
  };

  // ==================== RENDER ====================

  return (
    <>
      <TouchableOpacity
        style={styles.button}
        onPress={() => setShowMenu(true)}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['rgba(10, 145, 104, 1)', 'rgba(10, 145, 104, 0.8)']}
          style={styles.gradient}
        >
          {Platform.OS === 'ios' ? (
            <SymbolView
              name="paperclip"
              size={20}
              tintColor="white"
              type="hierarchical"
            />
          ) : (
            <Ionicons name="attach" size={20} color="white" />
          )}
        </LinearGradient>
      </TouchableOpacity>

      {/* Picker Menu Modal */}
      <Modal
        transparent
        animationType="fade"
        visible={showMenu}
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuBackdrop}
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
        >
          <View style={styles.menuContainer}>
            {[
              { label: 'Prendre une photo', icon: 'camera', action: handlePickCamera },
              { label: 'Photo/Vidéo', icon: 'images', action: handlePickPhotoVideo },
              { label: 'Fichier', icon: 'document', action: handlePickDocument },
            ].map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.menuItem}
                onPress={item.action}
              >
                <Ionicons
                  name={item.icon as any}
                  size={22}
                  color="rgba(10,145,104,1)"
                />
                <Text style={styles.menuText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  gradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
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

export default AttachmentButtonInline;