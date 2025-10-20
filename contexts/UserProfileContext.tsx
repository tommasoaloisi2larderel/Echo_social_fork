import React, { createContext, useContext, useRef, useEffect } from 'react';
import { storage } from '../utils/storage';

const API_BASE_URL = "https://reseausocial-production.up.railway.app";

// Durée de validité du cache : 24 heures
const CACHE_DURATION = 24 * 60 * 60 * 1000;

interface UserProfile {
  id: number;
  uuid: string;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  date_naissance?: string;
  date_inscription?: string;
  surnom?: string;
  nationalite?: string;
  photo_profil?: string;
  photo_profil_url?: string;
  nb_connexions?: number;
  derniere_reponse?: {
    question: string;
    reponse: string;
    date: string;
  } | null;
  prochains_evenements?: Array<{
    id: number;
    titre: string;
    date_debut: string;
    type: string;
  }>;
}

interface UserProfileStats {
  total_connexions: number;
  total_evenements: number;
  evenements_ce_mois: number;
  total_reponses: number;
  date_inscription: string;
  derniere_activite: string;
}

interface CachedProfile {
  profile: UserProfile;
  stats?: UserProfileStats;
  timestamp: number;
}

interface UserProfileContextType {
  getUserProfile: (uuid: string, makeAuthRequest: (url: string) => Promise<Response>) => Promise<UserProfile | null>;
  getUserStats: (uuid: string, makeAuthRequest: (url: string) => Promise<Response>) => Promise<UserProfileStats | null>;
  preloadProfiles: (uuids: string[], makeAuthRequest: (url: string) => Promise<Response>) => Promise<void>;
  clearCache: () => Promise<void>;
  getCachedProfile: (uuid: string) => UserProfile | null;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  // Cache en mémoire pour accès rapide
  const profileCacheRef = useRef<Map<string, CachedProfile>>(new Map());
  const inFlightRequestsRef = useRef<Map<string, Promise<UserProfile | null>>>(new Map());

  // Charger le cache depuis le stockage au démarrage
  useEffect(() => {
    loadCacheFromStorage();
  }, []);

  const loadCacheFromStorage = async () => {
    try {
      const cachedData = await storage.getItemAsync('user_profiles_cache');
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        const now = Date.now();
        
        // Filtrer les entrées expirées
        const validEntries = Object.entries(parsed).filter(
          ([_, value]: [string, any]) => now - value.timestamp < CACHE_DURATION
        );
        
        profileCacheRef.current = new Map(validEntries as [string, CachedProfile][]);
        console.log('📦 Cache profils chargé:', profileCacheRef.current.size, 'profils');
      }
    } catch (error) {
      console.error('❌ Erreur chargement cache profils:', error);
    }
  };

  const saveCacheToStorage = async () => {
    try {
      const cacheObject = Object.fromEntries(profileCacheRef.current);
      await storage.setItemAsync('user_profiles_cache', JSON.stringify(cacheObject));
    } catch (error) {
      console.error('❌ Erreur sauvegarde cache profils:', error);
    }
  };

  const isCacheValid = (timestamp: number): boolean => {
    return Date.now() - timestamp < CACHE_DURATION;
  };

  const getCachedProfile = (uuid: string): UserProfile | null => {
    const cached = profileCacheRef.current.get(uuid);
    if (cached && isCacheValid(cached.timestamp)) {
      return cached.profile;
    }
    return null;
  };

  const getUserProfile = async (
    uuid: string,
    makeAuthRequest: (url: string) => Promise<Response>
  ): Promise<UserProfile | null> => {
    // Vérifier le cache d'abord
    const cached = getCachedProfile(uuid);
    if (cached) {
      console.log('✅ Profil trouvé en cache:', uuid);
      return cached;
    }

    // Vérifier si une requête est déjà en cours
    if (inFlightRequestsRef.current.has(uuid)) {
      console.log('⏳ Requête profil déjà en cours:', uuid);
      return inFlightRequestsRef.current.get(uuid)!;
    }

    // Créer une nouvelle requête
    const request = (async () => {
      try {
        console.log('🔍 Chargement profil depuis API:', uuid);
        const response = await makeAuthRequest(`${API_BASE_URL}/api/users/${uuid}/`);
        
        if (!response.ok) {
          console.error('❌ Erreur chargement profil:', response.status);
          return null;
        }

        const profile: UserProfile = await response.json();
        
        // Mettre en cache
        profileCacheRef.current.set(uuid, {
          profile,
          timestamp: Date.now(),
        });
        
        // Sauvegarder dans le stockage
        await saveCacheToStorage();
        
        console.log('✅ Profil chargé et mis en cache:', uuid);
        return profile;
      } catch (error) {
        console.error('❌ Erreur requête profil:', error);
        return null;
      } finally {
        inFlightRequestsRef.current.delete(uuid);
      }
    })();

    inFlightRequestsRef.current.set(uuid, request);
    return request;
  };

  const getUserStats = async (
    uuid: string,
    makeAuthRequest: (url: string) => Promise<Response>
  ): Promise<UserProfileStats | null> => {
    // Vérifier le cache
    const cached = profileCacheRef.current.get(uuid);
    if (cached && cached.stats && isCacheValid(cached.timestamp)) {
      console.log('✅ Stats trouvées en cache:', uuid);
      return cached.stats;
    }

    try {
      console.log('🔍 Chargement stats depuis API:', uuid);
      const response = await makeAuthRequest(`${API_BASE_URL}/api/users/${uuid}/stats/`);
      
      if (!response.ok) {
        console.error('❌ Erreur chargement stats:', response.status);
        return null;
      }

      const stats: UserProfileStats = await response.json();
      
      // Mettre à jour le cache avec les stats
      const existingCache = profileCacheRef.current.get(uuid);
      if (existingCache) {
        profileCacheRef.current.set(uuid, {
          ...existingCache,
          stats,
          timestamp: Date.now(),
        });
      } else {
        profileCacheRef.current.set(uuid, {
          profile: {} as UserProfile,
          stats,
          timestamp: Date.now(),
        });
      }
      
      await saveCacheToStorage();
      
      console.log('✅ Stats chargées et mises en cache:', uuid);
      return stats;
    } catch (error) {
      console.error('❌ Erreur requête stats:', error);
      return null;
    }
  };

  const preloadProfiles = async (
    uuids: string[],
    makeAuthRequest: (url: string) => Promise<Response>
  ): Promise<void> => {
    const toLoad = uuids.filter(uuid => !getCachedProfile(uuid));
    
    if (toLoad.length === 0) {
      console.log('✅ Tous les profils déjà en cache');
      return;
    }

    console.log('📥 Préchargement de', toLoad.length, 'profils...');
    
    // Charger en parallèle avec limite de concurrence
    const concurrency = 5;
    for (let i = 0; i < toLoad.length; i += concurrency) {
      const batch = toLoad.slice(i, i + concurrency);
      await Promise.allSettled(
        batch.map(uuid => getUserProfile(uuid, makeAuthRequest))
      );
    }
    
    console.log('✅ Préchargement terminé');
  };

  const clearCache = async () => {
    profileCacheRef.current.clear();
    await storage.deleteItemAsync('user_profiles_cache');
    console.log('🗑️ Cache profils vidé');
  };

  return (
    <UserProfileContext.Provider
      value={{
        getUserProfile,
        getUserStats,
        preloadProfiles,
        clearCache,
        getCachedProfile,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}