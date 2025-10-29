import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

interface VoiceJarvisHandlerProps {
  onComplete: (transcription: string, response: string) => void;
  onCancel: () => void;
}

const VoiceJarvisHandler: React.FC<VoiceJarvisHandlerProps> = ({
  onComplete,
  onCancel,
}) => {
  const { makeAuthenticatedRequest } = useAuth();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const durationInterval = useRef<number | null>(null);

  // Animation de pulsation pendant l'enregistrement
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Compteur de durée
      durationInterval.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      pulseAnim.setValue(1);
      if (durationInterval.current !== null) {
        clearInterval(durationInterval.current);
      }
    }

    return () => {
      if (durationInterval.current !== null) {
        clearInterval(durationInterval.current);
      }
    };
  }, [isRecording]);

  // Démarrer l'enregistrement automatiquement au montage
  useEffect(() => {
    startRecording();
    return () => {
      stopAndCleanup();
    };
  }, []);

  const startRecording = async () => {
    try {
      console.log('🎤 Demande de permission audio...');
      const permission = await Audio.requestPermissionsAsync();
      
      if (permission.status !== 'granted') {
        console.error('❌ Permission audio refusée');
        onCancel();
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      console.log('🎙️ Démarrage de l\'enregistrement...');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);
      console.log('✅ Enregistrement démarré');
    } catch (err) {
      console.error('❌ Erreur lors du démarrage de l\'enregistrement:', err);
      onCancel();
    }
  };

  const stopRecording = async () => {
    if (!recording) {
      console.log('⚠️ Aucun enregistrement en cours');
      return;
    }

    try {
      console.log('⏹️ Arrêt de l\'enregistrement...');
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();
      console.log('📁 URI de l\'enregistrement:', uri);

      if (uri) {
        await sendVoiceToJarvis(uri);
      } else {
        console.error('❌ URI d\'enregistrement invalide');
        onCancel();
      }
    } catch (err) {
      console.error('❌ Erreur lors de l\'arrêt de l\'enregistrement:', err);
      onCancel();
    }
  };

  const sendVoiceToJarvis = async (uri: string) => {
    setIsProcessing(true);
    
    try {
      console.log('📤 Envoi du fichier audio à /jarvis/vocal/...');
      
      const formData = new FormData();
      formData.append('audio', {
        uri: uri,
        type: 'audio/m4a',
        name: 'voice_message.m4a',
      } as any);

      const response = await makeAuthenticatedRequest(
        'https://reseausocial-production.up.railway.app/jarvis/vocal/',
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('✅ Réponse HTTP reçue, status:', response.status);

      // Parser la réponse JSON
      const data = await response.json();
      console.log('✅ Données JSON parsées:', data);

      // Vérifier si la réponse contient les champs attendus
      if (data && data.success && data.transcription && data.jarvis_response) {
        onComplete(data.transcription, data.jarvis_response);
      } else {
        console.error('❌ Réponse invalide:', data);
        onCancel();
      }
    } catch (err) {
      console.error('❌ Erreur lors de l\'envoi vocal:', err);
      onCancel();
    } finally {
      setIsProcessing(false);
    }
  };

  const stopAndCleanup = async () => {
    if (recording) {
      try {
        const status = await recording.getStatusAsync();
        if (status.isRecording) {
          await recording.stopAndUnloadAsync();
        }
      } catch (err) {
        console.error('Erreur lors du nettoyage:', err);
      }
    }
    setRecording(null);
    setIsRecording(false);
  };

  const handleCancel = () => {
    stopAndCleanup();
    onCancel();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {isProcessing ? (
        // Mode traitement
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.processingText}>Traitement en cours...</Text>
        </View>
      ) : (
        // Mode enregistrement
        <>
          <View style={styles.recordingInfo}>
            <Text style={styles.recordingText}>
              {isRecording ? '🎙️ Enregistrement...' : '⏸️ En pause'}
            </Text>
            <Text style={styles.durationText}>{formatDuration(recordingDuration)}</Text>
          </View>

          <View style={styles.controls}>
            {/* Bouton Stop/Send */}
            <TouchableOpacity
              style={styles.stopButton}
              onPress={stopRecording}
              activeOpacity={0.8}
              disabled={!isRecording}
            >
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                {Platform.OS === 'ios' ? (
                  <SymbolView 
                    name="arrow.up.circle.fill" 
                    size={32} 
                    tintColor="white" 
                    type="hierarchical" 
                  />
                ) : (
                  <Ionicons 
                    name="send" 
                    size={32} 
                    color="white" 
                  />
                )}
              </Animated.View>
            </TouchableOpacity>

            {/* Bouton Annuler */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              activeOpacity={0.8}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView 
                  name="xmark.circle.fill" 
                  size={28} 
                  tintColor="rgba(255, 59, 48, 0.9)" 
                  type="hierarchical" 
                />
              ) : (
                <Ionicons 
                  name="close-circle" 
                  size={28} 
                  color="rgba(255, 59, 48, 0.9)" 
                />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 35,
    marginHorizontal: 10,
    marginBottom: 5,
    paddingHorizontal: 20,
    paddingVertical: 12,
    height: 60,
  },
  processingContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  recordingInfo: {
    flex: 1,
  },
  recordingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  durationText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stopButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(10, 145, 104, 1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    shadowColor: 'rgba(10, 145, 104, 0.5)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  cancelButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VoiceJarvisHandler;