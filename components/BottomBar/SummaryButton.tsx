import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity } from 'react-native';

interface SummaryButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

const SummaryButton: React.FC<SummaryButtonProps> = ({ onPress, disabled, loading }) => {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={['rgba(10, 145, 104, 1)', 'rgba(10, 145, 104, 0.8)']}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : Platform.OS === 'ios' ? (
          <SymbolView 
            name="sparkles" 
            size={20} 
            tintColor="white" 
            type="hierarchical" 
          />
        ) : (
          <Ionicons name="sparkles" size={20} color="white" />
        )}
      </LinearGradient>
    </TouchableOpacity>
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
});

export default SummaryButton;