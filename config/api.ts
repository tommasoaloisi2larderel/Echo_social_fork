import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Robust API URL determination.
 * Handles:
 * 1. Web (localhost)
 * 2. Mobile Emulator (localhost)
 * 3. Physical Device (detects your computer's LAN IP automatically)
 * 4. Production
 */
const getApiBaseUrl = (): string => {
  if (__DEV__) {
    // Web environment
    if (Platform.OS === "web") {
      return "http://localhost:3001";
    }

    // Mobile environment (Emulator or Physical Device)
    // Constants.expoConfig.hostUri contains the LAN IP of the Metro Bundler
    const debuggerHost = Constants.expoConfig?.hostUri;
    const localhost = debuggerHost?.split(":")[0];

    if (localhost) {
      return `http://${localhost}:3001`;
    }
  }

  // Production URL
  return "https://reseausocial-production.up.railway.app";
};

export const API_BASE_URL = getApiBaseUrl();
export const WS_BASE_URL = API_BASE_URL.replace("https://", "wss://").replace("http://", "ws://");