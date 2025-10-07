import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DefaultAvatar from '@/components/DefaultAvatar';
import { BACKGROUND_GRAY } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Content (rename to avoid saying "AI")
  const highlights = useMemo(() => [
    { id: 1, sender: 'Raphael', message: "Raphael is basically just cassing your couilles, no need to answer." },
    { id: 2, sender: 'Ralph', message: "Ralph still hasn't answered your question, should I tell him he is a connard?" },
    { id: 3, sender: 'Antoine', message: "Antoine won't be there this weekend, so i complained that he is never here." },
  ], []);

  // Breathing ambient motion for header bubbles (inhale 4s, exhale 4s)
  const breath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), // inhale
        Animated.timing(breath, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), // exhale
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  const blobShiftA = breath.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const blobShiftB = breath.interpolate({ inputRange: [0, 1], outputRange: [0, 12] });
  const blobScaleA = breath.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.3] });
  const blobScaleB = breath.interpolate({ inputRange: [0, 1], outputRange: [1.3, 0.96] });
  const blobOpacityA = breath.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.35] });
  const blobOpacityB = breath.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.3] });

  // Staggered entrance for highlight cards
  const enterAnims = useRef(highlights.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const anims = enterAnims.map(v => Animated.timing(v, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }));
    Animated.stagger(120, anims).start();
  }, [enterAnims]);

  const goMessages = () => router.push('/messages' as any);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* HEADER */}
      <LinearGradient colors={['#ecf7ef', '#d8efe0']} style={[styles.hero, { paddingTop: (insets.top || 0) + 12 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        {/* Ambient bubbles */}
        <Animated.View style={[styles.blob, styles.blobA, { opacity: blobOpacityA, transform: [{ translateY: blobShiftA }, { scale: blobScaleA }] }]} />
        <Animated.View style={[styles.blob, styles.blobB, { opacity: blobOpacityB, transform: [{ translateY: blobShiftB }, { scale: blobScaleB }] }]} />

        <View style={styles.heroContent}>
          <DefaultAvatar name={user?.username || 'User'} size={72} />
          <View style={styles.heroTextWrap}>
            <Text style={styles.hello}>Bonjour</Text>
            <Text style={styles.name}>{user?.username}</Text>
            <Text style={styles.subtitle}>Respirez. Tout est sous contrôle.</Text>
          </View>
        </View>
      </LinearGradient>

      {/* HIGHLIGHTS (each is its own big, airy card) */}
      <View style={{ marginTop: 12 }} />
      {highlights.map((item, idx) => {
        const opacity = enterAnims[idx].interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
        const translateY = enterAnims[idx].interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
        return (
          <Animated.View key={item.id} style={[styles.card, { opacity, transform: [{ translateY }] }]}> 
            <TouchableOpacity activeOpacity={0.85} onPress={goMessages} style={styles.cardTouchable}>
              <View style={styles.row}>
                <View style={styles.senderAvatar}><Text style={styles.senderInitial}>{item.sender[0]}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.senderName}>{item.sender}</Text>
                  <Text style={styles.messageText}>{item.message}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#2e7d32" />
              </View>
            </TouchableOpacity>
          </Animated.View>
        );
      })}

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_GRAY },
  content: { padding: 16, paddingBottom: 40 },

  // HEADER
  hero: {
    padding: 20,
    borderRadius: 28,
    overflow: 'hidden',
  },
  heroContent: { flexDirection: 'row', alignItems: 'center' },
  heroTextWrap: { marginLeft: 14, flexShrink: 1 },
  hello: { color: '#1b5e20', fontSize: 14, opacity: 0.9 },
  name: { color: '#1b5e20', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#4b6a4e', marginTop: 2, fontSize: 13, fontStyle: 'italic' },

  // Ambient blobs
  blob: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.28,
  },
  blobA: { backgroundColor: '#9fd3a6', top: -60, left: -40 },
  blobB: { backgroundColor: '#cee9d3', bottom: -70, right: -30 },

  // CARD
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginTop: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 10, elevation: 2,
  },
  cardTouchable: { paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  senderAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e6eee6', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  senderInitial: { color: '#2e7d32', fontWeight: '800' },
  senderName: { color: '#365a3a', fontWeight: '700', marginBottom: 2 },
  messageText: { color: '#55685a', lineHeight: 22 },
});