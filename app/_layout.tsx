import {
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_400Regular_Italic,
    Poppins_500Medium,
    Poppins_500Medium_Italic,
    Poppins_600SemiBold,
    Poppins_600SemiBold_Italic,
    Poppins_700Bold,
    Poppins_700Bold_Italic,
    Poppins_800ExtraBold,
    useFonts,
} from '@expo-google-fonts/poppins';
import { Stack } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AuthProvider } from "../contexts/AuthContext";
import { ChatProvider } from "../contexts/ChatContext";
import { NavigationProvider } from "../contexts/NavigationContext";
import { TransitionProvider } from "../contexts/TransitionContext";

// Empêcher le splashscreen de se cacher automatiquement
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  console.log('🔧 RootLayout loaded!');
  
  const [fontsLoaded, fontError] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_400Regular_Italic,
    Poppins_500Medium,
    Poppins_500Medium_Italic,
    Poppins_600SemiBold,
    Poppins_600SemiBold_Italic,
    Poppins_700Bold,
    Poppins_700Bold_Italic,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Cacher le splashscreen une fois les polices chargées
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }
  
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