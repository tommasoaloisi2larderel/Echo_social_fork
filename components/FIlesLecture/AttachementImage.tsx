// components/AttachmentImage.tsx
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';

const API_BASE_URL = Platform.OS === 'web' && __DEV__
  ? "http://localhost:3001"
  : "https://reseausocial-production.up.railway.app";

interface AttachmentImageProps {
  thumbnailUrl: string;
  fullUrl: string;
  isMyMessage?: boolean;
}

export default function AttachmentImage({ 
  thumbnailUrl, 
  fullUrl, 
  isMyMessage = false 
}: AttachmentImageProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  // ✅ Transformer les URLs relatives en absolues
  const getFullUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    return `${API_BASE_URL}${url}`;
  };

  const thumbnailFullUrl = getFullUrl(thumbnailUrl);
  const imageFullUrl = getFullUrl(fullUrl);

  return (
    <>
      {/* Miniature cliquable dans la conversation */}
      <TouchableOpacity 
        onPress={() => setModalVisible(true)}
        activeOpacity={0.9}
      >
        <Image 
          source={{ uri: thumbnailFullUrl }} 
          style={styles.thumbnail}
          contentFit="cover"
          transition={200}
        />
      </TouchableOpacity>

      {/* Modal plein écran pour l'image HD */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          {/* Bouton fermer */}
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => setModalVisible(false)}
          >
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>

          {/* Image HD */}
          <View style={styles.imageContainer}>
            {imageLoading && (
              <ActivityIndicator 
                size="large" 
                color="#fff" 
                style={styles.loader}
              />
            )}
            <Image
              source={{ uri: imageFullUrl }}
              style={styles.fullImage}
              contentFit="contain"
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
              transition={300}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  thumbnail: {
    width: 220,
    height: 160,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  imageContainer: {
    width: width,
    height: height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: width,
    height: height,
  },
  loader: {
    position: 'absolute',
    zIndex: 5,
  },
});