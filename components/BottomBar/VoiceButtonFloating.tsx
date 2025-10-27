import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SymbolView } from "expo-symbols";
import VoiceRecorder from './VoiceRecorder';

interface VoiceButtonFloatingProps {
  isRecording: boolean;
  recordedUri: string | null;
  recordingSeconds: number;
  isPaused: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => Promise<void>;
  resumeRecording: () => Promise<void>;
  cancelRecorded: () => void;
  sendRecorded: () => Promise<void>;
  disabled?: boolean;
}

export default function VoiceButtonFloating({
  isRecording,
  recordedUri,
  recordingSeconds,
  isPaused,
  startRecording,
  stopRecording,
  pauseRecording,
  resumeRecording,
  cancelRecorded,
  sendRecorded,
  disabled,
}: VoiceButtonFloatingProps) {

  // Bouton initial - pas d'enregistrement
  if (!isRecording && !recordedUri) {
    return (
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={startRecording}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['rgba(10, 145, 104, 1)', 'rgba(10, 145, 104, 0.8)']}
          style={styles.gradientButton}
        >
          <Ionicons name="mic" size={24} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  // Pendant l'enregistrement
  if (isRecording) {
    return (
      <View style={styles.recordingControls}>
        {/* Boutons de contrôle */}
        <View style={styles.controlButtons}>
          {/* Annuler */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => {
              stopRecording();
              cancelRecorded();
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#ff6b6b' }]}>
              {Platform.OS === 'ios' ? (
                <SymbolView name="xmark" size={20} tintColor="white" type="hierarchical" />
              ) : (
                <Ionicons name="close" size={20} color="white" />
              )}
            </View>
          </TouchableOpacity>

          {/* Pause/Resume */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={isPaused ? resumeRecording : pauseRecording}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#ffa500' }]}>
              {Platform.OS === 'ios' ? (
                <SymbolView 
                  name={isPaused ? "play.fill" : "pause.fill"} 
                  size={18} 
                  tintColor="white" 
                  type="hierarchical" 
                />
              ) : (
                <Ionicons name={isPaused ? "play" : "pause"} size={20} color="white" />
              )}
            </View>
          </TouchableOpacity>

          {/* Valider (stop) */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={stopRecording}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(10, 145, 104, 1)' }]}>
              {Platform.OS === 'ios' ? (
                <SymbolView name="checkmark" size={20} tintColor="white" type="hierarchical" />
              ) : (
                <Ionicons name="checkmark" size={20} color="white" />
              )}
            </View>
          </TouchableOpacity>
        </View>
        {/* Timer - maintenant à droite */}
        <View style={styles.timerContainer}>
          <View style={styles.recordingDot} />
          <Text style={styles.timerText}>
            {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
          </Text>
        </View>

      </View>
    );
  }

  // Vocal prêt (après stopRecording)
  if (recordedUri) {
    return (
      <View style={styles.recordingControls}>
        <View style={styles.readyContainer}>
          <Ionicons name="mic" size={18} color="#4ade80" />
          <Text style={styles.readyText}>Vocal prêt</Text>
        </View>

        <View style={styles.controlButtons}>
          {/* Annuler */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={cancelRecorded}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: '#ff6b6b' }]}>
              {Platform.OS === 'ios' ? (
                <SymbolView name="xmark" size={20} tintColor="white" type="hierarchical" />
              ) : (
                <Ionicons name="close" size={20} color="white" />
              )}
            </View>
          </TouchableOpacity>

          {/* Envoyer */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={sendRecorded}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(10, 145, 104, 1)' }]}>
              {Platform.OS === 'ios' ? (
                <SymbolView name="paperplane.fill" size={18} tintColor="white" type="hierarchical" />
              ) : (
                <Ionicons name="send" size={18} color="white" />
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    right: -20,
    bottom: 50,
    zIndex: 1000,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  gradientButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingControls: {
    position: 'absolute',
    right: 64,
    bottom: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 10000,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff6b6b',
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  readyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  readyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4ade80',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  controlButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});