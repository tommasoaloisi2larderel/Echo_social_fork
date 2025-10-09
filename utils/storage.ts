// Wrapper pour le stockage sécurisé multi-plateforme
// Utilise SecureStore sur mobile et localStorage sur web

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const isWeb = Platform.OS === 'web';

export const storage = {
  async getItemAsync(key: string): Promise<string | null> {
    if (isWeb) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.error('Error getting item from localStorage:', error);
        return null;
      }
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },

  async setItemAsync(key: string, value: string): Promise<void> {
    if (isWeb) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.error('Error setting item in localStorage:', error);
      }
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },

  async deleteItemAsync(key: string): Promise<void> {
    if (isWeb) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.error('Error deleting item from localStorage:', error);
      }
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

