import { Stack } from "expo-router";
import React from 'react';
import { AuthProvider } from "../contexts/AuthContext";
import { ChatProvider } from "../contexts/ChatContext";
import { NavigationProvider } from "../contexts/NavigationContext";
import { TransitionProvider } from "../contexts/TransitionContext";

export default function RootLayout() {
  console.log('🔧 RootLayout loaded!');
  
  return (
    <AuthProvider>
      <ChatProvider>
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
      </ChatProvider>
    </AuthProvider>
  );
}