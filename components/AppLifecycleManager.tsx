import { fetchWithAuth } from '@/services/apiClient';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useChat } from '../contexts/ChatContext';

/**
 * AppLifecycleManager - Handles app state changes and background refresh
 *
 * Features:
 * - Detects when app comes to foreground
 * - Triggers background refresh of stale caches
 * - Uses fetchWithAuth from AuthContext
 * - Works with ChatContext's background refresh mechanism
 *
 * This component should be mounted at the app root level.
 */
export function AppLifecycleManager() {
  const { isLoggedIn } = useAuth();
  const { backgroundRefresh } = useChat();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Only set up listeners if user is logged in
    if (!isLoggedIn) return;

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // App came to foreground from background
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('📱 App resumed - triggering background refresh...');

        try {
          // Trigger background refresh of stale caches
          await backgroundRefresh(fetchWithAuth);
          console.log('✅ Background refresh completed on app resume');
        } catch (error) {
          console.error('❌ Background refresh failed on app resume:', error);
        }
      }

      appStateRef.current = nextAppState;
    };

    // Subscribe to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup on unmount
    return () => {
      subscription.remove();
    };
  }, [isLoggedIn, fetchWithAuth, backgroundRefresh]);

  // This component doesn't render anything
  return null;
}
