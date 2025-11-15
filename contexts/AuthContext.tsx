import { API_BASE_URL } from "@/config/api";
import { router } from "expo-router";
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { storage } from "../utils/storage";
import { AppState, AppStateStatus } from "react-native";
import { cacheManager } from "../utils/CacheManager";
import { requestDeduplicator } from "../utils/RequestDeduplicator";
import { CacheTTL } from "../utils/cache-config";

interface User {
  id: number;
  uuid: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  date_naissance?: string;
  date_inscription: string;
  surnom?: string;
  nationalite?: string;
  photo_profil?: string | null;
  photo_profil_url?: string | null;
  nb_connexions: number;
  derniere_reponse?: string | null;
  prochains_evenements: any[];
}

/**
 * Cache configuration for API requests
 */
interface CacheConfig {
  /** Whether to use cache for this request (default: true for GET, false for others) */
  useCache?: boolean;
  /** Time-to-live in seconds (default: based on endpoint, see CacheTTL) */
  ttl?: number;
  /** Custom cache key (default: auto-generated from URL) */
  cacheKey?: string;
  /** Use stale-while-revalidate: return cached data immediately, fetch fresh in background */
  staleWhileRevalidate?: boolean;
  /** Cache keys to invalidate after successful mutation (for POST/PUT/DELETE) */
  invalidateKeys?: string[];
  /** Pattern to invalidate after successful mutation (supports wildcards) */
  invalidatePattern?: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: Record<string, any>) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: User) => Promise<void>;
  reloadUser: () => Promise<void>;
  makeAuthenticatedRequest: (
    url: string,
    options?: RequestInit,
    cacheConfig?: CacheConfig
  ) => Promise<Response>;
  /**
   * 🆕 Ensure we have a valid access token
   * Refreshes if token is expired or expiring soon
   * @returns A valid access token or null if refresh fails
   */
  ensureValidToken: () => Promise<string | null>;
  /**
   * 🆕 Subscribe to token refresh events
   * @param callback Called when tokens are refreshed with new access token
   * @returns Unsubscribe function
   */
  onTokenRefresh: (callback: (newAccessToken: string) => void) => () => void;
  /**
   * 🆕 Check if current token is expiring soon
   * @param bufferMinutes Minutes before expiry to consider "expiring soon"
   * @returns true if token will expire within buffer time
   */
  isTokenExpiringSoon: (bufferMinutes?: number) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Utility function to decode JWT and get expiration time
const decodeJWT = (token: string): { exp: number } | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Error decoding JWT:", error);
    return null;
  }
};

// Check if token is expired or will expire soon (within 5 minutes)
const isTokenExpiringSoon = (token: string, bufferMinutes: number = 5): boolean => {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;

  const expirationTime = decoded.exp * 1000; // Convert to milliseconds
  const bufferTime = bufferMinutes * 60 * 1000;
  const currentTime = Date.now();

  return (expirationTime - currentTime) < bufferTime;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Refs for auto-refresh mechanism
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // 🆕 Token refresh event listeners
  const tokenRefreshListenersRef = useRef<Set<(newAccessToken: string) => void>>(new Set());

  // Auto-refresh tokens periodically
  const startAutoRefresh = (refresh: string) => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Check and refresh tokens every 4 minutes
    refreshIntervalRef.current = setInterval(async () => {
      try {
        const currentAccessToken = await storage.getItemAsync("accessToken");
        if (currentAccessToken && isTokenExpiringSoon(currentAccessToken, 5)) {
          console.log("🔄 Auto-refreshing access token...");
          await refreshAccessTokenInternal(refresh);
        }
      } catch (error) {
        console.error("Error in auto-refresh:", error);
      }
    }, 4 * 60 * 1000); // Every 4 minutes
  };

  const stopAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  };

  useEffect(() => {
    const loadAuthData = async () => {
      try {
        const storedAccessToken = await storage.getItemAsync("accessToken");
        const storedRefreshToken = await storage.getItemAsync("refreshToken");
        const storedUser = await storage.getItemAsync("user");

        if (storedAccessToken && storedRefreshToken && storedUser) {
          // Check if access token is expired or expiring soon
          if (isTokenExpiringSoon(storedAccessToken, 5)) {
            console.log("🔄 Access token expired, refreshing on startup...");

            // Try to refresh the access token
            const newAccessToken = await refreshAccessTokenInternal(storedRefreshToken);

            if (newAccessToken) {
              setAccessToken(newAccessToken);
              setRefreshToken(storedRefreshToken);
              setUser(JSON.parse(storedUser));
              startAutoRefresh(storedRefreshToken);
            } else {
              // Refresh failed, clear stored data and require login
              console.log("❌ Token refresh failed on startup, clearing auth data");
              await storage.deleteItemAsync("accessToken");
              await storage.deleteItemAsync("refreshToken");
              await storage.deleteItemAsync("user");
            }
          } else {
            // Tokens are still valid
            setAccessToken(storedAccessToken);
            setRefreshToken(storedRefreshToken);
            setUser(JSON.parse(storedUser));
            startAutoRefresh(storedRefreshToken);
          }
        }
      } catch (error) {
        console.error("Error loading auth data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadAuthData();

    // Listen for app state changes (background/foreground)
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup on unmount
    return () => {
      stopAutoRefresh();
      subscription.remove();
    };
  }, []);

  // Handle app state changes (foreground/background)
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (
      appStateRef.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // App has come to the foreground, check if tokens need refresh
      console.log("📱 App resumed, checking tokens...");

      const storedAccessToken = await storage.getItemAsync("accessToken");
      const storedRefreshToken = await storage.getItemAsync("refreshToken");

      if (storedAccessToken && storedRefreshToken) {
        if (isTokenExpiringSoon(storedAccessToken, 5)) {
          console.log("🔄 Refreshing tokens on app resume...");
          await refreshAccessTokenInternal(storedRefreshToken);
        }
      }
    }
    appStateRef.current = nextAppState;
  };

  // Internal refresh function used by auto-refresh mechanism
  const refreshAccessTokenInternal = async (refresh: string): Promise<string | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (!response.ok) {
        console.error("Token refresh failed:", response.status);
        return null;
      }

      const data = await response.json();

      setAccessToken(data.access);
      await storage.setItemAsync("accessToken", data.access);

      // 🆕 Notify all listeners about the new token
      tokenRefreshListenersRef.current.forEach((listener) => {
        try {
          listener(data.access);
        } catch (error) {
          console.error("Error in token refresh listener:", error);
        }
      });

      console.log("✅ Access token refreshed successfully");
      return data.access;
    } catch (error) {
      console.error("Error refreshing token:", error);
      return null;
    }
  };

  const login = async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || errorData.error || "Échec de la connexion";
      throw new Error(errorMessage);
    }

    const data = await response.json();

    setAccessToken(data.access);
    setRefreshToken(data.refresh);
    setUser(data.user);

    await storage.setItemAsync("accessToken", data.access);
    await storage.setItemAsync("refreshToken", data.refresh);
    await storage.setItemAsync("user", JSON.stringify(data.user));

    // Start auto-refresh mechanism
    startAutoRefresh(data.refresh);
  };

  const register = async (formData: Record<string, any>) => {
    // Django requires password confirmation
    if (formData.password && !formData.password2) {
      formData.password2 = formData.password;
    }
    
    const response = await fetch(`${API_BASE_URL}/api/auth/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle field-specific errors
      if (errorData.username) {
        const msg = Array.isArray(errorData.username) ? errorData.username.join(', ') : errorData.username;
        throw new Error(`Nom d'utilisateur: ${msg}`);
      }
      if (errorData.email) {
        const msg = Array.isArray(errorData.email) ? errorData.email.join(', ') : errorData.email;
        throw new Error(`Email: ${msg}`);
      }
      if (errorData.password) {
        const msg = Array.isArray(errorData.password) ? errorData.password.join(', ') : errorData.password;
        throw new Error(`Mot de passe: ${msg}`);
      }
      
      const errorMessage = errorData.detail || errorData.error || "Échec de l'inscription";
      throw new Error(errorMessage);
    }

    const data = await response.json();

    setAccessToken(data.tokens.access);
    setRefreshToken(data.tokens.refresh);
    setUser(data.user);

    await storage.setItemAsync("accessToken", data.tokens.access);
    await storage.setItemAsync("refreshToken", data.tokens.refresh);
    await storage.setItemAsync("user", JSON.stringify(data.user));

    // Start auto-refresh mechanism
    startAutoRefresh(data.tokens.refresh);
  };

  const logout = async () => {
    try {
      // Stop auto-refresh
      stopAutoRefresh();

      if (refreshToken) {
        await fetch(`${API_BASE_URL}/api/auth/logout/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: refreshToken }),
        });
      }
    } catch (error) {
      console.warn("Erreur lors de la déconnexion:", error);
    }

    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);

    await storage.deleteItemAsync("accessToken");
    await storage.deleteItemAsync("refreshToken");
    await storage.deleteItemAsync("user");

    // 🆕 Clear all caches on logout
    await cacheManager.clear();
    console.log("🗑️ All caches cleared on logout");

    router.replace("/(auth)/login");
  };

  const refreshAccessToken = async (): Promise<string | null> => {
    if (!refreshToken) return null;
    return await refreshAccessTokenInternal(refreshToken);
  };

  /**
   * Make an authenticated API request with aggressive caching
   *
   * Features:
   * - Automatic caching for GET requests
   * - Cache invalidation for mutations (POST/PUT/DELETE/PATCH)
   * - Request deduplication (prevents duplicate simultaneous requests)
   * - Stale-while-revalidate support
   * - Automatic token refresh on 401
   *
   * @param url Request URL
   * @param options Fetch options
   * @param cacheConfig Cache configuration
   */
  const makeAuthenticatedRequest = async (
    url: string,
    options: RequestInit = {},
    cacheConfig: CacheConfig = {}
  ): Promise<Response> => {
    if (!accessToken) throw new Error("Pas de token d'accès");

    const method = (options.method || 'GET').toUpperCase();
    const isGetRequest = method === 'GET';
    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

    // Extract cache config with defaults
    const {
      useCache = isGetRequest, // Default: cache GET, don't cache mutations
      ttl = CacheTTL.CONVERSATIONS_LIST, // Default TTL
      cacheKey = url, // Default: use URL as cache key
      staleWhileRevalidate = false,
      invalidateKeys = [],
      invalidatePattern,
    } = cacheConfig;

    // Generate request deduplication key
    const dedupeKey = requestDeduplicator.generateKey(url, method, options.body);

    // For GET requests with caching enabled
    if (isGetRequest && useCache) {
      // Check cache first
      const cachedData = await cacheManager.get<{
        status: number;
        statusText: string;
        headers: Record<string, string>;
        body: any;
      }>(cacheKey);

      if (cachedData) {
        // Cache hit - return cached response
        const cachedResponse = new Response(JSON.stringify(cachedData.body), {
          status: cachedData.status,
          statusText: cachedData.statusText,
          headers: new Headers(cachedData.headers),
        });

        // If stale-while-revalidate, fetch fresh data in background
        if (staleWhileRevalidate) {
          console.log(`🔄 Stale-while-revalidate: returning cache, fetching fresh for ${cacheKey}`);

          // Fetch in background (don't await)
          requestDeduplicator
            .deduplicate(dedupeKey, async () => {
              const freshResponse = await performAuthenticatedFetch(url, options);
              if (freshResponse.ok) {
                await cacheResponse(cacheKey, freshResponse.clone(), ttl);
              }
              return freshResponse;
            })
            .catch((error) => {
              console.error(`❌ Background refresh failed for ${cacheKey}:`, error);
            });
        }

        return cachedResponse;
      }

      // Cache miss - fetch with deduplication
      console.log(`❌ Cache miss, fetching: ${cacheKey}`);

      const response = await requestDeduplicator.deduplicate(dedupeKey, async () => {
        const response = await performAuthenticatedFetch(url, options);

        // Cache successful responses
        if (response.ok) {
          await cacheResponse(cacheKey, response.clone(), ttl);
        }

        return response;
      });

      // Clone response before returning to avoid "Already read" errors
      // when multiple consumers access deduplicated requests
      return response.clone();
    }

    // For mutations or non-cached requests
    const response = await performAuthenticatedFetch(url, options);

    // Invalidate cache after successful mutations
    if (isMutation && response.ok) {
      // Invalidate specific keys
      if (invalidateKeys.length > 0) {
        await Promise.all(
          invalidateKeys.map((key) => cacheManager.invalidate(key))
        );
        console.log(`🗑️ Invalidated ${invalidateKeys.length} cache keys after ${method}`);
      }

      // Invalidate by pattern
      if (invalidatePattern) {
        await cacheManager.invalidatePattern(invalidatePattern);
        console.log(`🗑️ Invalidated pattern "${invalidatePattern}" after ${method}`);
      }
    }

    return response;
  };

  /**
   * Perform the actual authenticated fetch with token refresh on 401
   */
  const performAuthenticatedFetch = async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    if (!accessToken) throw new Error("Pas de token d'accès");

    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Handle 401 - refresh token and retry
    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        await logout();
        throw new Error("Session expirée, veuillez vous reconnecter");
      }

      // Retry with new token
      return fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${newToken}`,
        },
      });
    }

    return response;
  };

  /**
   * Cache a successful response
   */
  const cacheResponse = async (
    key: string,
    response: Response,
    ttl: number
  ): Promise<void> => {
    try {
      // Clone response to read body
      const body = await response.json();

      // Extract headers as plain object
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      // Cache the response data
      await cacheManager.set(
        key,
        {
          status: response.status,
          statusText: response.statusText,
          headers,
          body,
        },
        ttl
      );
    } catch (error) {
      console.error(`❌ Failed to cache response for ${key}:`, error);
    }
  };

  const isLoggedIn = !!user && !!accessToken;
  const updateUser = async (updatedUser: User) => {
    setUser(updatedUser);
    await storage.setItemAsync("user", JSON.stringify(updatedUser));
    console.log('✅ Utilisateur mis à jour dans le contexte');
  };

  const reloadUser = async () => {
    if (!accessToken) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/profile/`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (response.ok) {
        const freshUser = await response.json();
        setUser(freshUser);
        await storage.setItemAsync("user", JSON.stringify(freshUser));
        console.log('✅ User rechargé depuis l\'API');
      }
    } catch (error) {
      console.error('❌ Erreur rechargement user:', error);
    }
  };

  /**
   * 🆕 Ensure we have a valid access token
   * Checks if current token is expiring soon and refreshes if needed
   * @returns A valid access token or null if refresh fails
   */
  const ensureValidToken = async (): Promise<string | null> => {
    const currentAccessToken = await storage.getItemAsync("accessToken");
    const currentRefreshToken = await storage.getItemAsync("refreshToken");

    if (!currentAccessToken || !currentRefreshToken) {
      console.warn("⚠️ No tokens found");
      return null;
    }

    // Check if token is expiring soon (within 5 minutes)
    if (isTokenExpiringSoon(currentAccessToken, 5)) {
      console.log("🔄 Token expiring soon, refreshing...");
      const newToken = await refreshAccessTokenInternal(currentRefreshToken);

      if (!newToken) {
        console.error("❌ Failed to refresh token");
        return null;
      }

      return newToken;
    }

    // Token is still valid
    return currentAccessToken;
  };

  /**
   * 🆕 Subscribe to token refresh events
   * Useful for WebSockets and other components that need to know when tokens change
   * @param callback Called when tokens are refreshed with new access token
   * @returns Unsubscribe function
   */
  const onTokenRefresh = (callback: (newAccessToken: string) => void): (() => void) => {
    tokenRefreshListenersRef.current.add(callback);

    // Return unsubscribe function
    return () => {
      tokenRefreshListenersRef.current.delete(callback);
    };
  };

  /**
   * 🆕 Check if current token is expiring soon
   * @param bufferMinutes Minutes before expiry to consider "expiring soon" (default: 5)
   * @returns true if token will expire within buffer time
   */
  const checkTokenExpiringSoon = (bufferMinutes: number = 5): boolean => {
    if (!accessToken) return true;
    return isTokenExpiringSoon(accessToken, bufferMinutes);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        loading,
        isLoggedIn,
        login,
        register,
        logout,
        updateUser,
        makeAuthenticatedRequest,
        reloadUser,
        ensureValidToken,
        onTokenRefresh,
        isTokenExpiringSoon: checkTokenExpiringSoon,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit être utilisé dans un AuthProvider");
  }
  return context;
};