import { Stack, useLocalSearchParams, usePathname } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomBar from '../../components/BottomBar';
import SwipeableContainer, { SwipeableContainerHandle } from '../../components/SwipeableContainer';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useNavigation } from '../../contexts/NavigationContext';

// Import the actual screen components
import AboutScreen from './about';
import ConversationsScreen from './conversations';
import IndexScreen from './index';

export default function TabsLayout() {
  const [chatText, setChatText] = useState("");
  const pathname = usePathname();
  const { conversationId } = useLocalSearchParams();
  const { registerScrollRef } = useNavigation();
  const swipeControlRef = useRef<SwipeableContainerHandle>(null);
  const { isLoggedIn, makeAuthenticatedRequest } = useAuth();
  const { prefetchConversationsOverview, prefetchAllMessages } = useChat();

  const deriveIndexFromPath = (p: string) => {
    if (p.includes('/conversations')) return 0;
    if (p.includes('/about')) return 2;
    return 1; // index/home
  };

  // Determine if we're showing a detail route or other full-screen pages
  const isInConversationDetail = pathname.includes('conversation-direct') || 
                                  pathname.includes('conversation-group') || 
                                  pathname.includes('conversation-detail') || 
                                  pathname.includes('conversation-management') || 
                                  pathname.includes('add-group-members') || 
                                  pathname.includes('/friends');

  const handleSendMessage = () => {
    console.log("Envoi du message:", chatText);
  };

  // Enregistrer le ref du swipe container
  React.useEffect(() => {
    registerScrollRef(swipeControlRef);
  }, []);

  // Bootstrap: au premier rendu des tabs (si connecté), précharger overview + tous messages
  useEffect(() => {
    if (!isLoggedIn) return;
    prefetchConversationsOverview(makeAuthenticatedRequest).then(() => {
      prefetchAllMessages(makeAuthenticatedRequest);
    });
  }, [isLoggedIn]);

  console.log('Layout rendered with path:', pathname, 'isInConversationDetail:', isInConversationDetail);
  
  return (
    <View style={styles.container}>
      {/* Stack navigator - pour toutes les routes */}
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="conversations" />
        <Stack.Screen name="about" />
        <Stack.Screen name="friends" />
        <Stack.Screen name="conversation-direct" />
        <Stack.Screen name="conversation-group" />
        {/* backward-compat pour anciennes navigations éventuelles */}
        <Stack.Screen name="conversation-detail" />
        <Stack.Screen name="conversation-management" />
        <Stack.Screen name="add-group-members" />
      </Stack>

      {/* SwipeableContainer - overlay quand on n'est pas dans detail */}
      {!isInConversationDetail && (
        <View style={styles.swipeContainer}>
          <SwipeableContainer
            initialIndex={deriveIndexFromPath(pathname)}
            controlRef={swipeControlRef}
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
        chatRecipient={isInConversationDetail ? "Contact" : ""}
        onSendMessage={isInConversationDetail ? handleSendMessage : undefined}
        conversationId={isInConversationDetail ? conversationId as string : undefined}
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
    bottom: 0,
    zIndex: 100,
    backgroundColor: '#f0f2f5', // Fond opaque pour cacher le Stack en dessous
  },
});