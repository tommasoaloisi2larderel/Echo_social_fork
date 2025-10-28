// components/AttachmentVideo.tsx
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as MediaLibrary from 'expo-media-library';



const API_BASE_URL = Platform.OS === 'web' && __DEV__
  ? "http://localhost:3001"
  : "https://reseausocial-production.up.railway.app";

interface AttachmentVideoProps {
  thumbnailUrl: string;
  videoUrl: string;
  isMyMessage?: boolean;
}

export default function AttachmentVideo({
  thumbnailUrl,
  videoUrl,
  isMyMessage = false
}: AttachmentVideoProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(false);

  const playerRef = useRef<Video>(null);
  

  const getFullUrl = (url: string) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    return `${API_BASE_URL}${url}`;
  };

  const thumbnailFullUrl = getFullUrl(thumbnailUrl) ?? null;
  const videoFullUrl = getFullUrl(videoUrl);

  const downloadVideo = async () => {



    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission refusée", "Impossible d'enregistrer la vidéo");
        return; // on stoppe la fonction si pas de permission
      }

      const fileExtension = videoUrl.split('.').pop() || 'mp4';
      const fileName = `video_${Date.now()}.${fileExtension}`;


      
      if (Platform.OS === 'web') {
        if (!videoFullUrl) return;
        // ✅ Téléchargement direct sur navigateur
        const link = document.createElement('a');
        link.href = videoFullUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      setLoadingVideo(true);
      const FS = FileSystem as unknown as {
        documentDirectory?: string;
        cacheDirectory?: string;
      };
      const directory = FS.documentDirectory ?? FS.cacheDirectory ?? "";
      const fileUri = directory + fileName;

      await FileSystem.downloadAsync(videoFullUrl as any , fileUri);

      // 3️⃣ Sauvegarder dans la galerie
      await MediaLibrary.saveToLibraryAsync(fileUri);

      Alert.alert("Téléchargement terminé 🎉", "Vidéo enregistrée dans la galerie !");
    } catch (error) {
      Alert.alert("Erreur", "Impossible de télécharger la vidéo");
      console.error(error);
    } finally {
      setLoadingVideo(false);
    }
  };

  return (
    <>
      {/* Miniature cliquable */}
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        activeOpacity={0.9}
      >
        <View style={styles.thumbnailContainer}>
          {thumbnailFullUrl ? (
            <Video
              ref={playerRef}
              source={{ uri: thumbnailFullUrl }}
              style={styles.thumbnail}
              resizeMode={ResizeMode.COVER}
              isMuted = {false}
              shouldPlay={false}
            />
          ) : (
            <View style={[styles.thumbnail, { backgroundColor: "#000" }]} />
          )}
          <Ionicons name="play-circle" size={50} color="#fff" style={styles.playIcon} />
        </View>
      </TouchableOpacity>

      {/* Modal fullscreen */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setModalVisible(false);
          playerRef.current?.pauseAsync();
        }}
      >
        <BlurView intensity={80} tint="dark" style={styles.modalBlur}>
          
          {/* Close Button */}
          <TouchableOpacity
            onPress={() => {
              playerRef.current?.pauseAsync();
              setModalVisible(false);
            }}
            style={[styles.actionButton, styles.closeButton]}
          >
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>

          {/* Download Button */}
          <TouchableOpacity
            onPress={downloadVideo}
            style={[styles.actionButton, styles.downloadButton]}
          >
            {loadingVideo
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="download" size={26} color="#fff" /> }
          </TouchableOpacity>

          {/* Video Player */}
          <View style={styles.videoWrapper}>
            <Video
              ref={playerRef}
              source={{ uri: videoFullUrl! }}
              style={styles.fullVideo}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              isMuted={false}
            />
          </View>

        </BlurView>
      </Modal>
    </>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  thumbnailContainer: {
    width: 220,
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  playIcon: {
    position: "absolute",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },

  loader: {
    position: "absolute",
  },

  modalBlur: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(0,0,0,0.35)',
},

videoWrapper: {
  width: '90%',
  height: '55%',
  backgroundColor: '#000',
  borderRadius: 20,
  overflow: 'hidden',
  elevation: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.4,
  shadowRadius: 12,
},

fullVideo: {
  width: '100%',
  height: '100%',
},

actionButton: {
  position: 'absolute',
  top: 40,
  width: 54,
  height: 54,
  borderRadius: 27,
  backgroundColor: 'rgba(10,145,104,1)',
  justifyContent: 'center',
  alignItems: 'center',
  elevation: 10,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.4,
  shadowRadius: 8,
},

closeButton: {
  right: 25,
},

downloadButton: {
  left: 25,
},
});
