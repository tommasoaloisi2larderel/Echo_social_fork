import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ECHO_COLOR, WHITE } from '../constants/colors';

interface DefaultAvatarProps {
  name: string;
  size?: number;
  style?: any;
}

export default function DefaultAvatar({ name, size = 50, style }: DefaultAvatarProps) {
  // Extraire les initiales (max 2 lettres)
  const getInitials = (name: string) => {
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <View style={[
      styles.container,
      { width: size, height: size, borderRadius: size / 2 },
      style
    ]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: ECHO_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: WHITE,
    fontWeight: 'bold',
  },
});