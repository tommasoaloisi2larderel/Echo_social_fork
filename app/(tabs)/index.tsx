import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import DefaultAvatar from '@/components/DefaultAvatar';
import { BACKGROUND_GRAY } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { fetchWithAuth } from "@/services/apiClient";

interface MessageSummary {
  id: string;
  sender: string;
  message: string;
  conversationUuid?: string;
}

export default function HomePage() {
  const { user } = useAuth();
  
  const [summaries, setSummaries] = useState<MessageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const enterAnims = useMemo(() => {
    return Array(3).fill(0).map(() => new Animated.Value(0));
  }, []);

  const goToConversation = useCallback((conversationUuid: string) => {
    router.push({
      pathname: '/(tabs)/conversation-direct',
      params: { conversationId: conversationUuid }
    });
  }, []);

  // Fetch AI summaries from Jarvis
  const fetchAISummaries = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!user) {
      console.log('No authenticated user, skipping fetch');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      console.log('🤖 Requesting AI summaries from Jarvis...');
      
      // Call Jarvis notifications endpoint
      const response = await fetchWithAuth(
        '/jarvis/chat/?type=notifications',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );
      
      console.log(`📥 Jarvis response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Jarvis request failed:', errorText);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const data = await response.json();
      console.log('✅ Jarvis response received:', JSON.stringify(data, null, 2));
      
      // Parse the structured response from Jarvis
      const parsedSummaries = parseJarvisNotifications(data);
      console.log('📋 Parsed summaries:', parsedSummaries);
      
      setSummaries(parsedSummaries);
      
    } catch (error) {
      console.error('Error fetching AI summaries:', error);
      setSummaries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  // Parse Jarvis notifications from structured JSON response
  const parseJarvisNotifications = (data: any): MessageSummary[] => {
    const summaries: MessageSummary[] = [];
    
    console.log('🔍 Parsing Jarvis data:', data);
    console.log('🔍 Data type:', typeof data);
    
    // First, check if data.response is a JSON string that needs parsing
    let parsedData = data;
    if (data.response && typeof data.response === 'string') {
      try {
        console.log('🔄 Parsing data.response as JSON...');
        parsedData = JSON.parse(data.response);
        console.log('✅ Parsed response:', parsedData);
      } catch (error) {
        console.log('❌ Failed to parse response as JSON:', error);
        parsedData = data;
      }
    }
    
    console.log('🔍 Has notifications?', parsedData?.notifications);
    console.log('🔍 Is array?', Array.isArray(parsedData?.notifications));
    console.log('🔍 Total unread:', parsedData?.total_unread);
    
    // Check if we have the notifications array
    if (parsedData.notifications && Array.isArray(parsedData.notifications)) {
      console.log(`📦 Found ${parsedData.notifications.length} notifications`);
      
      if (parsedData.notifications.length === 0) {
        console.log('⚠️ Notifications array is empty');
        
        // Check if there are unread messages but no notifications
        if (parsedData.total_unread && parsedData.total_unread > 0) {
          console.log(`📊 Found ${parsedData.total_unread} total unread but no notification details`);
          summaries.push({
            id: '0',
            sender: 'Messages',
            message: `Vous avez ${parsedData.total_unread} message${parsedData.total_unread > 1 ? 's' : ''} non lu${parsedData.total_unread > 1 ? 's' : ''}`,
          });
        }
      } else {
        parsedData.notifications.forEach((notif: any, index: number) => {
          console.log(`📝 Processing notification ${index}:`, notif);
          
          // Each notification has: conversation_uuid, username, unread_count, summary
          if (notif.summary) {
            const summary = {
              id: notif.conversation_uuid || `${index}`,
              sender: notif.username || 'Unknown',
              message: notif.summary,
              conversationUuid: notif.conversation_uuid,
            };
            
            console.log(`✅ Added summary:`, summary);
            summaries.push(summary);
          } else {
            console.warn(`⚠️ Notification ${index} has no summary:`, notif);
          }
        });
      }
      
      console.log(`✅ Parsed ${summaries.length} notifications from structured data`);
      return summaries;
    }
    
    console.log('⚠️ No notifications array found in parsed data');
    console.log(`🎯 Final summaries count: ${summaries.length}`);
    return summaries;
  };

  useEffect(() => {
    // Only fetch if user is authenticated
    if (user) {
      fetchAISummaries();
    } else {
      setLoading(false);
    }
  }, [fetchAISummaries, user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAISummaries();
  }, [fetchAISummaries]);

  useEffect(() => {
    enterAnims.forEach((anim, i) => {
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: i * 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [enterAnims]);

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* HEADER */}
      <LinearGradient colors={['#c8e6c9', '#a5d6a7']} style={styles.hero}>
        <View style={[styles.blob, styles.blobA]} />
        <View style={[styles.blob, styles.blobB]} />

        {/* Show user info when authenticated */}
        {user ? (
          <View style={styles.heroContent}>
            {(user as any)?.photo_profil_url ? (
              <Image
                source={{ uri: (user as any).photo_profil_url }}
                style={styles.profileAvatar}
              />
            ) : (
              <DefaultAvatar name={user?.username || 'User'} size={60} />
            )}
            <View style={styles.heroTextWrap}>
              <Text style={styles.hello}>Bonjour,</Text>
              <Text style={styles.name}>{ user?.username || 'Utilisateur'}</Text>
              <Text style={styles.subtitle}>Tout est sous contrôle.</Text>
            </View>
          </View>
        ) : (
          /* Show Login button when not authenticated */
          <View style={styles.guestContent}>
            <View style={styles.guestTextWrap}>
              <Text style={styles.guestTitle}>Bienvenue sur Echo Social</Text>
              <Text style={styles.guestSubtitle}>Découvrez l'application en mode invité</Text>
            </View>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.loginButtonText}>Se connecter</Text>
              <Ionicons name="log-in-outline" size={20} color="#fff" style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      {/* LOADING STATE */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="rgba(10, 145, 104, 1)" />
          <Text style={styles.loadingText}>Chargement des résumés...</Text>
        </View>
      )}

      {/* SUMMARIES */}
      {!loading && summaries.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons
            name={user ? "checkmark-circle-outline" : "lock-closed-outline"}
            size={48}
            color="rgba(10, 145, 104, 0.5)"
          />
          <Text style={styles.emptyTitle}>
            {user ? "Tout est à jour !" : "Mode invité"}
          </Text>
          <Text style={styles.emptyText}>
            {user
              ? "Vous n'avez aucune notification pour le moment."
              : "Connectez-vous pour voir les notifications de Jarvis et discuter avec vos amis."}
          </Text>
        </View>
      )}

      {!loading && summaries.map((item, idx) => {
        const opacity = enterAnims[idx]?.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) || 1;
        const translateY = enterAnims[idx]?.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) || 0;
        
        return (
          <Animated.View key={item.id} style={[styles.card, { opacity, transform: [{ translateY }] }]}> 
            <TouchableOpacity 
              activeOpacity={0.85} 
              onPress={() => item.conversationUuid && goToConversation(item.conversationUuid)}
              style={styles.cardTouchable}
              disabled={!item.conversationUuid}
            >
              <View style={styles.row}>
                <View style={styles.senderAvatar}>
                  <Text style={styles.senderInitial}>{item.sender[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.senderName}>{item.sender}</Text>
                  <Text style={styles.messageText}>{item.message}</Text>
                </View>
                {item.conversationUuid && (
                  <Ionicons name="chevron-forward" size={18} color="rgba(10, 145, 104, 1)" />
                )}
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
    top: 30,
    marginBottom: 20,
    padding: 20,
    borderRadius: 28,
    overflow: 'hidden',
  },
  heroContent: { flexDirection: 'row', alignItems: 'center' },
  heroTextWrap: { marginLeft: 14, flexShrink: 1 },
  hello: { color: '#1b5e20', fontSize: 14, opacity: 0.9 },
  name: { color: '#1b5e20', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#4b6a4e', marginTop: 2, fontSize: 13, fontStyle: 'italic' },

  // Guest mode styles
  guestContent: { alignItems: 'center', paddingVertical: 10 },
  guestTextWrap: { alignItems: 'center', marginBottom: 20 },
  guestTitle: { color: '#1b5e20', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  guestSubtitle: { color: '#4b6a4e', marginTop: 8, fontSize: 14, textAlign: 'center' },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 145, 104, 1)',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  loginButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

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

  // LOADING
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    color: '#55685a',
    fontSize: 14,
  },

  // EMPTY STATE
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6c8a6e',
    textAlign: 'center',
    lineHeight: 20,
  },

  // CARD
  card: {
    backgroundColor: BACKGROUND_GRAY,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginTop: 14,
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 7,
    elevation: 3,
  },
  cardTouchable: { paddingVertical: 2 },
  row: { flexDirection: 'row', alignItems: 'center' },
  senderAvatar: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    backgroundColor: '#e6eee6', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginRight: 12 
  },
  senderInitial: { color: 'rgba(10, 145, 104, 1)', fontWeight: '800' },
  senderName: { color: '#365a3a', fontWeight: '700', marginBottom: 2 },
  messageText: { color: '#55685a', lineHeight: 22, marginBottom: 4 },
  profileAvatar: {
  width: 60,
  height: 60,
  borderRadius: 30,
  borderWidth: 3,
  borderColor: '#fff',
},
});