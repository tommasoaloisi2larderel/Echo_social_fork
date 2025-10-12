import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface FloatingHeaderProps {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onBack?: () => void;
}

export const FloatingHeader = ({ title, icon = 'settings-outline', onBack }: FloatingHeaderProps) => {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <>
      {/* Bouton retour */}
      <TouchableOpacity style={styles.floatingBackButton} onPress={handleBack}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Header */}
      <View style={styles.floatingHeader}>
        <Ionicons name={icon} size={20} color="#fff" />
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  floatingBackButton: {
    position: 'absolute',
    top: 65,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 145, 104, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingHeader: {
    position: 'absolute',
    top: 65,
    left: 75,
    right: 20,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 145, 104, 0.9)',
    zIndex: 10,
    shadowColor: 'rgba(10, 145, 104, 0.4)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

