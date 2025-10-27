import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AudioPlayerProps {
  audioUrl: string;
  isMyMessage: boolean;
}

// Cache en mémoire pour les sons chargés
const audioCache = new Map<string, Audio.Sound>();

export default function AudioPlayer({ audioUrl, isMyMessage }: AudioPlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const loadSound = async () => {
    try {
      setIsLoading(true);
      
      // ✅ Vérifier si le son est déjà en cache
      let cachedSound = audioCache.get(audioUrl);
      
      if (cachedSound) {
        console.log('✅ Audio from cache:', audioUrl);
        setSound(cachedSound);
        const status = await cachedSound.getStatusAsync();
        if (status.isLoaded) {
          setDuration(status.durationMillis || 0);
        }
        setIsLoading(false);
        return;
      }

      // Sinon, charger le son
      console.log('⬇️ Loading audio...');
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      
      // ✅ Mettre en cache
      audioCache.set(audioUrl, newSound);
      setSound(newSound);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading sound:', error);
      setIsLoading(false);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);

      // Si la lecture est terminée, réinitialiser
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  const togglePlayPause = async () => {
    try {
      if (!sound) {
        await loadSound();
        return;
      }

      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        // Si on est à la fin, recommencer du début
        if (position >= duration) {
          await sound.setPositionAsync(0);
        }
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? position / duration : 0;

  return (
    <View style={[
      styles.container,
      { backgroundColor: isMyMessage ? 'rgba(255, 255, 255, 0.2)' : 'rgba(10, 145, 104, 0.1)' }
    ]}>
      <TouchableOpacity
        onPress={togglePlayPause}
        disabled={isLoading}
        style={styles.playButton}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isMyMessage ? '#fff' : 'rgba(10, 145, 104, 1)'} />
        ) : Platform.OS === 'ios' ? (
          <SymbolView
            name={isPlaying ? 'pause.fill' : 'play.fill'}
            size={20}
            tintColor={isMyMessage ? '#fff' : 'rgba(10, 145, 104, 1)'}
            type="hierarchical"
          />
        ) : (
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={20}
            color={isMyMessage ? '#fff' : 'rgba(10, 145, 104, 1)'}
          />
        )}
      </TouchableOpacity>

      <View style={styles.waveformContainer}>
        {/* Barre de progression */}
        <View style={[styles.progressBar, { backgroundColor: isMyMessage ? 'rgba(255, 255, 255, 0.3)' : 'rgba(10, 145, 104, 0.2)' }]}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: isMyMessage ? '#fff' : 'rgba(10, 145, 104, 1)'
              }
            ]}
          />
        </View>

        {/* Durée */}
        <Text style={[styles.timeText, { color: isMyMessage ? 'rgba(255, 255, 255, 0.8)' : '#666' }]}>
          {formatTime(position)} / {formatTime(duration)}
        </Text>
      </View>

      <Ionicons
        name="mic"
        size={16}
        color={isMyMessage ? 'rgba(255, 255, 255, 0.6)' : 'rgba(10, 145, 104, 0.6)'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    gap: 10,
    minWidth: 220,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flex: 1,
    gap: 4,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '500',
  },
});