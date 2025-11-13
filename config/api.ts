import { Platform } from 'react-native';

/**
 * Centralized API configuration
 * 
 * This properly handles environment detection for React Native (iOS/Android)
 * without relying on window.location which doesn't exist in native environments.
 * 
 * __DEV__ is a React Native global that's true in development, false in production.
 */

const getApiBaseUrl = (): string => {
  // For web platform in development, use the proxy
  if (Platform.OS === 'web' && __DEV__) {
    return 'http://localhost:3001';
  }
  
  // For all other cases (production web, iOS, Android - both dev and prod)
  return 'https://reseausocial-production.up.railway.app';
};

export const API_BASE_URL = getApiBaseUrl();

// For WebSocket connections
export const WS_BASE_URL = API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// Optional: Export function if you need dynamic URL determination
export const getApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};