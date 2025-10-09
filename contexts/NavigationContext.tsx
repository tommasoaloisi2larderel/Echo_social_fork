import { router } from 'expo-router';
import React, { createContext, useContext, useRef, useState } from 'react';

type SwipeScreen = 'conversations' | 'home' | 'profile';

interface NavigationContextType {
  currentScreen: SwipeScreen;
  navigateToScreen: (screen: SwipeScreen) => void;
  scrollToIndex: (index: number) => void;
  registerScrollRef: (ref: any) => void;
  goBack: () => void;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [currentScreen, setCurrentScreen] = useState<SwipeScreen>('home');
  const [pendingScreen, setPendingScreen] = useState<SwipeScreen | null>(null);
  const scrollViewRef = useRef<any>(null);

  const registerScrollRef = (ref: any) => {
    console.log('Enregistrement du ref:', ref);
    scrollViewRef.current = ref;
    
    // Si on avait une navigation en attente, l'exécuter maintenant
    if (pendingScreen) {
      console.log('📍 Exécution navigation en attente vers:', pendingScreen);
      const indexMap: Record<SwipeScreen, number> = {
        conversations: 0,
        home: 1,
        profile: 2,
      };
      const index = indexMap[pendingScreen];
      
      // Petit délai pour laisser le composant se monter
      setTimeout(() => {
        if (scrollViewRef.current?.current?.scrollToIndex) {
          scrollViewRef.current.current.scrollToIndex(index);
          setCurrentScreen(pendingScreen);
          setPendingScreen(null);
        }
      }, 100);
    }
  };

  const scrollToIndex = (index: number) => {
    console.log('Tentative de scroll vers index:', index);
    console.log('ScrollViewRef:', scrollViewRef.current);
    console.log('ScrollViewRef.current:', scrollViewRef.current?.current);
    
    if (scrollViewRef.current?.current?.scrollToIndex) {
      console.log('✅ Appel de scrollToIndex');
      scrollViewRef.current.current.scrollToIndex(index);
    } else {
      console.error('❌ scrollToIndex non disponible');
    }
  };

  const navigateToScreen = (screen: SwipeScreen) => {
    const indexMap: Record<SwipeScreen, number> = {
      conversations: 0,
      home: 1,
      profile: 2,
    };

    const index = indexMap[screen];
    
    // Si le SwipeableContainer n'est pas monté (par ex. on est dans conversation-detail)
    if (!scrollViewRef.current?.current?.scrollToIndex) {
      console.log('📌 SwipeableContainer non monté, navigation en attente vers:', screen);
      setPendingScreen(screen);
      // Retourner en arrière pour afficher le SwipeableContainer
      if (router.canGoBack()) {
        router.back();
      }
      return;
    }
    
    setCurrentScreen(screen);
    scrollToIndex(index);
  };

  const goBack = () => {
    // Toujours essayer de revenir en arrière
    // Si on est dans conversation-detail, cela retournera à conversations
    router.back();
  };

  return (
    <NavigationContext.Provider
      value={{
        currentScreen,
        navigateToScreen,
        scrollToIndex,
        registerScrollRef,
        goBack,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}

