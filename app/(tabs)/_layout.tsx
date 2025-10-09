import { Tabs, useLocalSearchParams, usePathname } from 'expo-router';
import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomBar from '../../components/BottomBar';
import SwipeableContainer from '../../components/SwipeableContainer';

// Import the actual screen components
import AboutScreen from './about';
import ConversationsScreen from './conversations';
import IndexScreen from './index';

export default function TabsLayout() {
  const [chatText, setChatText] = useState("");
  const pathname = usePathname();
  const { conversationId } = useLocalSearchParams();

  const deriveIndexFromPath = (p: string) => {
    if (p.includes('/conversations')) return 0;
    if (p.includes('/about')) return 2;
    return 1; // index/home
  };
  // Capture the initial index exactly once to avoid remounting or shifting when pathname changes later
  const initialSwipeIndexRef = useRef<number>(deriveIndexFromPath(pathname));

  // Determine if we're showing a detail route
  const isInConversationDetail = pathname.includes('conversation-detail');

  const handleSendMessage = () => {
    console.log("Envoi du message:", chatText);
  };

  if (isInConversationDetail) {
    // Render the real Tabs navigator only for the detail flow
    return (
      <>
        <Tabs
          screenOptions={{
            tabBarActiveTintColor: "#da913eff",
            tabBarStyle: { display: 'none' },
            headerShown: false,
          }}
        >
          {/* Hide the regular tabs from the tab bar/deeplinks here */}
          <Tabs.Screen name="index" options={{ href: null }} />
          <Tabs.Screen name="conversations" options={{ href: null }} />
          <Tabs.Screen name="about" options={{ href: null }} />
          <Tabs.Screen
            name="conversation-detail"
            options={{
              headerTitle: "Conversation",
              headerShown: false,
            }}
          />
        </Tabs>

        <BottomBar
          currentRoute={pathname}
          chatText={chatText}
          setChatText={setChatText}
          chatRecipient="Contact"
          onSendMessage={handleSendMessage}
          conversationId={conversationId as string}
        />
      </>
    );
  }

  // Main 3-screen swipe experience (no hidden Tabs mounted here)
  console.log('Layout rendered with path:', pathname);
  return (
    <View style={styles.container}>
      <SwipeableContainer
        initialIndex={deriveIndexFromPath(pathname)}
      >
        <ConversationsScreen />
        <IndexScreen />
        <AboutScreen />
      </SwipeableContainer>

      <BottomBar
        currentRoute={pathname}
        chatText={chatText}
        setChatText={setChatText}
        chatRecipient=""
        onSendMessage={undefined}
        conversationId={undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});