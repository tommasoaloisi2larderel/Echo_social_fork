import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface JarvisSplitButtonProps {
  onTextActivate: () => void;
  onVoiceActivate: () => void;
}

const JarvisSplitButton: React.FC<JarvisSplitButtonProps> = ({
  onTextActivate,
  onVoiceActivate,
}) => {
  return (
    <View style={styles.container}>
      {/* Zone gauche - Texte */}
      <TouchableOpacity
        style={styles.textButton}
        onPress={onTextActivate}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          {Platform.OS === 'ios' ? (
            <SymbolView 
              name="keyboard" 
              size={22} 
              tintColor="rgba(10, 145, 104, 1)" 
              type="hierarchical" 
            />
          ) : (
            <Ionicons 
              name="chatbubble-outline" 
              size={22} 
              color="rgba(10, 145, 104, 1)" 
            />
          )}
        </View>
        <Text style={styles.textButtonLabel}>Écrire à Jarvis</Text>
      </TouchableOpacity>

      {/* Séparateur vertical */}
      <View style={styles.separator} />

      {/* Zone droite - Vocal */}
      <TouchableOpacity
        style={styles.voiceButton}
        onPress={onVoiceActivate}
        activeOpacity={0.8}
      >
        <View style={styles.voiceIconContainer}>
          {Platform.OS === 'ios' ? (
            <SymbolView 
              name="mic.fill" 
              size={24} 
              tintColor="rgb(255, 255, 255)" 
              type="hierarchical" 
            />
          ) : (
            <Ionicons 
              name="mic" 
              size={24} 
              color="rgb(255, 255, 255)" 
            />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 35,
    marginHorizontal: 10,
    marginBottom: 5,
    overflow: 'hidden',
    height: 60,
  },
  textButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  iconContainer: {
    marginRight: 10,
  },
  textButtonLabel: {
    color: "rgba(10, 145, 104, 1)",
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    width: 1,
    backgroundColor: 'rgba(10, 145, 104, 0.2)',
  },
  voiceButton: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 145, 104, 0.9)',
  },
  voiceIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(10, 145, 104, 1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(10, 145, 104, 0.5)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
});

export default JarvisSplitButton;