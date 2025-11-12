import { API_BASE_URL } from "@/config/api";
import { router } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import { storage } from "../utils/storage";

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
  makeAuthenticatedRequest: (
    url: string,
    options?: RequestInit
  ) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAuthData = async () => {
      try {
        const storedAccessToken = await storage.getItemAsync("accessToken");
        const storedRefreshToken = await storage.getItemAsync("refreshToken");
        const storedUser = await storage.getItemAsync("user");

        if (storedAccessToken && storedRefreshToken && storedUser) {
          setAccessToken(storedAccessToken);
          setRefreshToken(storedRefreshToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error("Error loading auth data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadAuthData();
  }, []);

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
  };

  const logout = async () => {
    try {
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

    router.replace("/(auth)/login");
  };

  const refreshAccessToken = async (): Promise<string | null> => {
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) return null;

      const data = await response.json();

      setAccessToken(data.access);
      await storage.setItemAsync("accessToken", data.access);

      return data.access;
    } catch (error) {
      console.error("Erreur refresh token:", error);
      return null;
    }
  };

  const makeAuthenticatedRequest = async (
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

    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      if (!newToken) {
        await logout();
        throw new Error("Session expirée, veuillez vous reconnecter");
      }

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