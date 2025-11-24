import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from "expo-router";
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppLifecycleManager } from "../components/AppLifecycleManager";
import { AgentsProvider } from '../contexts/AgentsContext';
import { AuthProvider } from "../contexts/AuthContext";
import { ChatProvider } from "../contexts/ChatContext";
import { JarvisProvider } from "../contexts/JarvisContext";
import { NavigationProvider } from "../contexts/NavigationContext";
import { TransitionProvider } from "../contexts/TransitionContext";
import { UserProfileProvider } from "../contexts/UserProfileContext";

// 1. Create the client outside the component
const queryClient = new QueryClient();

export default function RootLayout() {
  console.log('🔧 RootLayout loaded!');
  
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* 2. Wrap everything with QueryClientProvider */}
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <UserProfileProvider>
            <ChatProvider>
              <JarvisProvider>
                <AgentsProvider>
                  <NavigationProvider>
                    <TransitionProvider>
                      <AppLifecycleManager />
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="(auth)" />
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="(screens)" />
                      </Stack>
                    </TransitionProvider>
                  </NavigationProvider>
                </AgentsProvider>
              </JarvisProvider>
            </ChatProvider>
          </UserProfileProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}