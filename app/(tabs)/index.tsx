import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Easing, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import DefaultAvatar from '@/components/DefaultAvatar';
import { BACKGROUND_GRAY } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? "http://localhost:3001"
  : "https://reseausocial-production.up.railway.app";

interface ConversationSummary {
  conversation_uuid: string;
  unread_count: number;
  sender_name: string;
  summary: string;
}

interface UnreadMessagesResponse {
  total_unread: number;
  conversations: {
    conversation_uuid: string;
    unread_count: number;
  }[];
}

export default function HomePage() {
  const { user, makeAuthenticatedRequest, accessToken } = useAuth();
  
  const [summaries, setSummaries] = useState<ConversationSummary[]>([]);
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

  // Fetch unread messages and their summaries
  const fetchUnreadSummaries = useCallback(async () => {
    // Don't fetch if not authenticated
    if (!accessToken) {
      console.log('No access token, skipping fetch');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Get all conversations to find those with unread messages
      const conversationsResponse = await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/conversations/`
      );
      
      if (!conversationsResponse.ok) {
        console.error('Failed to fetch conversations');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const conversationsData = await conversationsResponse.json();
      console.log('Conversations data for summaries:', conversationsData);
      
      // Filter conversations with unread messages and take top 3
      const unreadConversations = Array.isArray(conversationsData) 
        ? conversationsData
            .filter((conv: any) => conv.unread_count > 0)
            .slice(0, 3)
        : [];
      
      console.log('Filtered unread conversations:', unreadConversations);
      
      if (unreadConversations.length === 0) {
        setSummaries([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      // Get AI summaries for each conversation
      const summariesPromises = unreadConversations.map(async (conv: any) => {
          try {
            const conversationUuid = conv.uuid;
            
            console.log(`🔄 Processing conversation ${conversationUuid} for ${conv.other_participant?.username || 'Unknown'}`);
            
            // Get sender name from conversation data
            const senderName = conv.other_participant?.username || 
                              conv.other_participant?.surnom || 
                              conv.name ||
                              'Unknown';
            
            // Try to get AI summary
            let summary = `${conv.unread_count} message${conv.unread_count > 1 ? 's' : ''} non lu${conv.unread_count > 1 ? 's' : ''}`;
            
            try {
              console.log(`📡 Requesting AI summary for conversation ${conversationUuid}...`);
              const summaryResponse = await makeAuthenticatedRequest(
                `${API_BASE_URL}/messaging/conversations/${conversationUuid}/summarize/`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({}),
                }
              );
              
              console.log(`📥 Summary response status: ${summaryResponse.status}`);
              
              if (summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                console.log('✅ AI Summary received for', conversationUuid, ':', summaryData);
                // The API might return the summary in different fields
                summary = summaryData.summary || 
                         summaryData.message || 
                         summaryData.ai_summary ||
                         summaryData.result ||
                         summary;
                console.log('📝 Final summary text:', summary);
              } else {
                const errorText = await summaryResponse.text();
                console.warn('❌ AI summary request failed with status:', summaryResponse.status, 'Error:', errorText);
              }
            } catch (summaryError) {
              console.warn('⚠️ Could not fetch AI summary:', summaryError);
            }

            const result = {
              conversation_uuid: conversationUuid,
              unread_count: conv.unread_count,
              sender_name: senderName,
              summary,
            };
            
            console.log('✨ Final conversation summary object:', result);
            
            return result;
          } catch (error) {
            console.error('❌ Error processing conversation:', error);
            return null;
          }
        });
      
      console.log('⏳ Waiting for all summaries to resolve...');
      const resolvedSummaries = (await Promise.all(summariesPromises))
        .filter((s): s is ConversationSummary => 
          s !== null && 
          s.sender_name !== undefined && 
          s.summary !== undefined
        );
      
      console.log('🎉 Final resolved summaries count:', resolvedSummaries.length);
      console.log('🎉 Final resolved summaries:', resolvedSummaries);
      
      setSummaries(resolvedSummaries);
    } catch (error) {
      console.error('Error fetching unread summaries:', error);
      setSummaries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [makeAuthenticatedRequest, accessToken]);

  useEffect(() => {
    // Only fetch if user is authenticated
    if (accessToken) {
      fetchUnreadSummaries();
    } else {
      setLoading(false);
    }
  }, [fetchUnreadSummaries, accessToken]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUnreadSummaries();
  }, [fetchUnreadSummaries]);

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
        <View style={styles.heroContent}>
          <DefaultAvatar name={user?.username || 'User'} size={60} />
          <View style={styles.heroTextWrap}>
            <Text style={styles.hello}>Bonjour,</Text>
            <Text style={styles.name}>{user?.first_name || user?.username || 'Utilisateur'}</Text>
            <Text style={styles.subtitle}>Tout est sous contrôle.</Text>
          </View>
        </View>
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
          <Ionicons name="checkmark-circle-outline" size={48} color="rgba(10, 145, 104, 0.5)" />
          <Text style={styles.emptyTitle}>Tout est à jour !</Text>
          <Text style={styles.emptyText}>
            Vous n&apos;avez aucun message non lu pour le moment.
          </Text>
        </View>
      )}

      {!loading && summaries.map((item, idx) => {
        const opacity = enterAnims[idx]?.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) || 1;
        const translateY = enterAnims[idx]?.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) || 0;
        
        return (
          <Animated.View key={item.conversation_uuid} style={[styles.card, { opacity, transform: [{ translateY }] }]}> 
            <TouchableOpacity 
              activeOpacity={0.85} 
              onPress={() => goToConversation(item.conversation_uuid)} 
              style={styles.cardTouchable}
            >
              <View style={styles.row}>
                <View style={styles.senderAvatar}>
                  <Text style={styles.senderInitial}>{item.sender_name[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.senderName}>{item.sender_name}</Text>
                  <Text style={styles.messageText}>{item.summary}</Text>
                  <Text style={styles.unreadBadge}>
                    {item.unread_count} message{item.unread_count > 1 ? 's' : ''} non lu{item.unread_count > 1 ? 's' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(10, 145, 104, 1)" />
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
  unreadBadge: {
    color: 'rgba(10, 145, 104, 1)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});