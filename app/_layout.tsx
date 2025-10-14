import { Stack } from "expo-router";
import React from 'react';
import { AgentsProvider } from '../contexts/AgentsContext';
import { AuthProvider } from "../contexts/AuthContext";
import { ChatProvider } from "../contexts/ChatContext";
import { JarvisProvider } from "../contexts/JarvisContext";
import { NavigationProvider } from "../contexts/NavigationContext";
import { TransitionProvider } from "../contexts/TransitionContext";

export default function RootLayout() {
  console.log('🔧 RootLayout loaded!');
  
  return (
    <AuthProvider>
      <ChatProvider>
        <JarvisProvider>
          <AgentsProvider>
          <NavigationProvider>
            <TransitionProvider>
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
    </AuthProvider>
  );
}