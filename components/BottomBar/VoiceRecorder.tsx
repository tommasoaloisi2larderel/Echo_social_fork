import { Ionicons } from "@expo/vector-icons";
import { Audio } from 'expo-av';
import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import {
  Alert,
  Platform,
  Text,
  TouchableOpacity,
  View
} from "react-native";

// Note: onSendRecorded removed from props, logic moves to parent
interface VoiceRecorderProps {
  // Just notifications if needed
  onRecordingStart?: () => void;
  onRecordingStop?: (uri: string) => void; 
}

export default function VoiceRecorder({ onRecordingStart, onRecordingStop }: VoiceRecorderProps = {}) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  // We no longer keep "recordedUri" here for staging, 
  // we only keep it here while "Recording" or "Paused"
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<any>(null);
  const [isPaused, setIsPaused] = useState(false);

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Micro', 'Autorisez le micro pour enregistrer.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
      
      onRecordingStart?.();
    } catch (e) {
      console.error('startRecording error', e);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      // Reset local state
      setRecording(null);
      setIsRecording(false);
      setIsPaused(false);
      setRecordingSeconds(0);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      // Pass the URI to parent to handle "Staging"
      if (uri && onRecordingStop) {
        onRecordingStop(uri);
      }

    } catch (e) {
      console.error('stopRecording error', e);
    }
  };

  const cancelRecording = async () => {
      if (recording) {
          await recording.stopAndUnloadAsync();
      }
      setRecording(null);
      setIsRecording(false);
      setIsPaused(false);
      setRecordingSeconds(0);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
  }

  return {
    isRecording,
    recordingSeconds,
    isPaused,
    startRecording,
    stopRecording,
    cancelRecording,
    RecordingDisplay: () => (
      isRecording ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 12 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="mic" size={18} color="#ef4444" />
            <Text style={{ marginLeft: 8, color: '#ef4444', fontWeight: '700' }}>{isPaused ? 'En pause...' : 'Enregistrement...'}</Text>

            <Text style={{ marginLeft: 8, color: '#ef4444' }}>
              {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, '0')}
            </Text>
          </View>
          
          {/* Stop button (Finish) */}
          <TouchableOpacity onPress={stopRecording}>
            {Platform.OS === 'ios' ? (
              <SymbolView name="stop.circle.fill" size={24} tintColor="#ef4444" type="hierarchical" />
            ) : (
              <Ionicons name="stop-circle" size={24} color="#ef4444" />
            )}
          </TouchableOpacity>
        </View>
      ) : null
    )
  };
}