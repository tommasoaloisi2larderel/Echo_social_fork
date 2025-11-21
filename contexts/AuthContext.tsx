import { API_BASE_URL } from "@/config/api";
import { router } from "expo-router";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { storage } from "../utils/storage";

// User interface definition
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
  /**
   * Authenticated fetch wrapper.
   * Injects the Bearer token and handles 401 refresh/retry logic.
   * Caching and deduplication are now delegated to React Query.
   */
  makeAuthenticatedRequest: (
    url: string,
    options?: RequestInit
  ) => Promise<Response>;
  
  ensureValidToken: () => Promise<string | null>;
  onTokenRefresh: (callback: (newAccessToken: string) => void) => () => void;
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

  // Token refresh event listeners
  const tokenRefreshListenersRef = useRef<Set<(newAccessToken: string) => void>>(new Set());

  // Auto-refresh tokens periodically
  const startAutoRefresh = (refresh: string) => {
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
          if (isTokenExpiringSoon(storedAccessToken, 5)) {
            console.log("🔄 Access token expired, refreshing on startup...");
            const newAccessToken = await refreshAccessTokenInternal(storedRefreshToken);

            if (newAccessToken) {
              setAccessToken(newAccessToken);
              setRefreshToken(storedRefreshToken);
              setUser(JSON.parse(storedUser));
              startAutoRefresh(storedRefreshToken);
            } else {
              console.log("❌ Token refresh failed on startup, clearing auth data");
              await storage.deleteItemAsync("accessToken");
              await storage.deleteItemAsync("refreshToken");
              await storage.deleteItemAsync("user");
            }
          } else {
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

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      stopAutoRefresh();
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (
      appStateRef.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
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

    startAutoRefresh(data.refresh);
  };

  const register = async (formData: Record<string, any>) => {
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

    startAutoRefresh(data.tokens.refresh);
  };

  const logout = async () => {
    try {
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

    // Note: We removed cacheManager.clear() here.
    // You should assume the queryClient from TanStack Query will be cleared elsewhere or by the parent provider.
    
    router.replace("/(auth)/login");
  };

  const refreshAccessToken = async (): Promise<string | null> => {
    if (!refreshToken) return null;
    return await refreshAccessTokenInternal(refreshToken);
  };

  /**
   * 🟢 Refactored for TanStack Query Compatibility
   * This function simply wraps fetch with Token Injection & 401 Retry logic.
   * It is intended to be used as the `fetcher` in your queryFn.
   */
  const makeAuthenticatedRequest = async (
    url: string,
    options: RequestInit = {}
  ): Promise<Response> => {
    if (!accessToken) throw new Error("Pas de token d'accès");

    // 1. Try request with current token
    let response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // 2. Handle 401 Unauthorized (Token Expired)
    if (response.status === 401) {
      console.log("🔒 401 detected, attempting silent refresh...");
      const newToken = await refreshAccessToken();
      
      if (!newToken) {
        // Refresh failed - User session is invalid
        await logout();
        throw new Error("Session expirée, veuillez vous reconnecter");
      }

      // 3. Retry request with new token
      response = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${newToken}`,
        },
      });
    }

    return response;
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
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/auth/profile/`);

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

  const ensureValidToken = async (): Promise<string | null> => {
    const currentAccessToken = await storage.getItemAsync("accessToken");
    const currentRefreshToken = await storage.getItemAsync("refreshToken");

    if (!currentAccessToken || !currentRefreshToken) {
      console.warn("⚠️ No tokens found");
      return null;
    }

    if (isTokenExpiringSoon(currentAccessToken, 5)) {
      console.log("🔄 Token expiring soon, refreshing...");
      const newToken = await refreshAccessTokenInternal(currentRefreshToken);

      if (!newToken) {
        console.error("❌ Failed to refresh token");
        return null;
      }
      return newToken;
    }

    return currentAccessToken;
  };

  const onTokenRefresh = (callback: (newAccessToken: string) => void): (() => void) => {
    tokenRefreshListenersRef.current.add(callback);
    return () => {
      tokenRefreshListenersRef.current.delete(callback);
    };
  };

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