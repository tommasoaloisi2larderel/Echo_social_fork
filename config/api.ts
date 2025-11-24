import { Platform } from 'react-native';

/**
 * Centralized API configuration
 * * __DEV__ is a React Native global that's true in development, false in production.
 */

const getApiBaseUrl = (): string => {
  // Only use localhost for WEB development
  if (Platform.OS === 'web' && __DEV__) {
    return 'http://localhost:3001';
  }
  
  // For Mobile (iOS/Android) Dev & Prod, and Web Prod -> Use Production Backend
  // This matches your original working setup
  return 'https://reseausocial-production.up.railway.app';
};

export const API_BASE_URL = getApiBaseUrl();

// For WebSocket connections
export const WS_BASE_URL = API_BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');

export const getApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};