// je rajoute dans ce fichier la logique qui permet de gérer l'envoie de vocaux dans les conversations.

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

interface VoiceRecorderProps {
  onSendRecorded: (uri: string) => Promise<void>;
}

export default function VoiceRecorder({ onSendRecorded }: VoiceRecorderProps) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
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
    } catch (e) {
      console.error('startRecording error', e);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);
      setIsPaused(false);
      if (uri) setRecordedUri(uri);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    } catch (e) {
      console.error('stopRecording error', e);
    }
  };

  const cancelRecorded = () => {
    setRecordedUri(null);
    setRecordingSeconds(0);
    setIsPaused(false);
  };

  const sendRecorded = async () => {
    if (!recordedUri) return;
    await onSendRecorded(recordedUri);
    setRecordedUri(null);
    setRecordingSeconds(0);
    setIsPaused(false);
  };


  const pauseRecording = async () => {
    try {
      if (recording && !isPaused) {
        await recording.pauseAsync();
        setIsPaused(true);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      }
    } catch (e) {
      console.error('pauseRecording error', e);
    }
  };

  const resumeRecording = async () => {
    try {
      if (recording && isPaused) {
        await recording.startAsync();
        setIsPaused(false);
        recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
      }
    } catch (e) {
      console.error('resumeRecording error', e);
    }
  };


  return {
    isRecording,
    recordedUri,
    recordingSeconds,
    isPaused,
    startRecording,
    stopRecording,
    cancelRecorded,
    sendRecorded,
    pauseRecording,
    resumeRecording,
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
          <TouchableOpacity onPress={stopRecording}>
            {Platform.OS === 'ios' ? (
              <SymbolView name="stop.circle.fill" size={24} tintColor="#ef4444" type="hierarchical" />
            ) : (
              <Ionicons name="stop-circle" size={22} color="#ef4444" />
            )}
          </TouchableOpacity>
        </View>
      ) : recordedUri ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingHorizontal: 8 }}>
          <Ionicons name="mic" size={18} color="#4ade80" />
          <Text style={{ marginLeft: 8, color: '#4ade80', fontWeight: '700' }}>Vocal prêt</Text>
          <TouchableOpacity style={{ marginLeft: 10 }} onPress={cancelRecorded}>
            {Platform.OS === 'ios' ? (
              <SymbolView name="xmark.circle.fill" size={20} tintColor="#ff6b6b" type="hierarchical" />
            ) : (
              <Ionicons name="close-circle" size={18} color="#ff6b6b" />
            )}
          </TouchableOpacity>
        </View>
      ) : null
    )
  };
}
