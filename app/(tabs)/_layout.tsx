import { API_BASE_URL } from "@/config/api";
import { fetchWithAuth } from "@/services/apiClient";
import { Stack, useGlobalSearchParams, useLocalSearchParams, usePathname } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import BottomBar from '../../components/BottomBar/index';
import SwipeableContainer, { SwipeableContainerHandle } from '../../components/SwipeableContainer';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useNavigation } from '../../contexts/NavigationContext';
import AboutScreen from './about';
import ConversationsScreen from './conversations';
import IndexScreen from './index';

export default function TabsLayout() {
  const [chatText, setChatText] = useState("");
  const pathname = usePathname();
  const localParams = useLocalSearchParams();
  const globalParams = useGlobalSearchParams();
  const conversationId = (globalParams.conversationId || localParams.conversationId) as string | undefined;
  const swipeControlRef = useRef<SwipeableContainerHandle>(null);
  const { isLoggedIn, accessToken } = useAuth();
  const { prefetchConversationsOverview, prefetchAllMessages } = useChat();
  
  // Summary state
  const [loadingSummary, setLoadingSummary] = useState(false);
  
  // Debug: voir ce qui est récupéré
  console.log('📍 _layout - localParams:', localParams, 'globalParams:', globalParams, 'conversationId:', conversationId);

  const deriveIndexFromPath = (p: string) => {
    if (p.includes('/conversations')) return 0;
    if (p.includes('/about')) return 2;
    return 1;
  };

  const { registerScrollRef } = useNavigation();

  React.useEffect(() => {
    if (swipeControlRef.current) {
      registerScrollRef(swipeControlRef.current.scrollToIndex);
    }
  }, [registerScrollRef]);

  useEffect(() => {
  if (isLoggedIn && accessToken) {
    prefetchConversationsOverview(fetchWithAuth);
    prefetchAllMessages(fetchWithAuth);
  }
}, [isLoggedIn, fetchWithAuth, prefetchConversationsOverview, prefetchAllMessages]);


  const isInConversationDetail = 
    pathname.includes('conversation-direct') || 
    pathname.includes('conversation-group') || 
    pathname.includes('conversation-detail')||
    pathname.includes('conversation-management')||
    pathname.includes('conversation-media');

  // Summary fetch function
  const fetchSummary = async () => {
    if (!conversationId || !accessToken) {
      console.log('❌ Résumé impossible - conversationId:', conversationId, 'accessToken:', !!accessToken);
      Alert.alert('Info', 'Aucune conversation sélectionnée');
      return;
    }
    
    console.log('🔍 Début du résumé pour conversation:', conversationId);
    setLoadingSummary(true);
    
    try {
      const url = `${API_BASE_URL}/messaging/conversations/${conversationId}/summarize/`;
      console.log('📤 URL appelée:', url);
      
      const response = await fetchWithAuth(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('📥 Statut de la réponse:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Erreur HTTP:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Données reçues:', JSON.stringify(data, null, 2));
      
      // Show the summary in an alert for now
      Alert.alert(
        '📝 Résumé de la conversation',
        data.summary || 'Aucun résumé disponible',
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('❌ Erreur lors du résumé:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      Alert.alert('Erreur', `Impossible de générer le résumé: ${errorMessage}`);
    } finally {
      setLoadingSummary(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="conversations" />
        <Stack.Screen name="about" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="conversation-direct" />
        <Stack.Screen name="conversation-group" />
        <Stack.Screen name="conversation-detail" />
        <Stack.Screen name="conversation-management" />
        <Stack.Screen name="add-group-members" />
      </Stack>

      {/* SwipeableContainer - overlay quand on n'est pas dans detail */}
      {!isInConversationDetail && (
        <View style={styles.swipeContainer}>
          <SwipeableContainer
            initialIndex={deriveIndexFromPath(pathname)}
            controlRef={swipeControlRef as any} 
          >
            <ConversationsScreen />
            <IndexScreen />
            <AboutScreen />
          </SwipeableContainer>
        </View>
      )}

      {/* BottomBar - toujours visible */}
      <BottomBar
        currentRoute={pathname}
        chatText={chatText}
        setChatText={setChatText}
        conversationId={conversationId}
        onSummaryPress={fetchSummary}
        loadingSummary={loadingSummary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  swipeContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 70,
    zIndex: 100,
    backgroundColor: '#f0f2f5',
  },
});