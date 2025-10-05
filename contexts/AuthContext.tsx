import * as SecureStore from "expo-secure-store";
import React, { createContext, useContext, useEffect, useState } from "react";

const API_BASE_URL = "https://reseausocial-production.up.railway.app"

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
  login: (username: string, password: string) => Promise<void>;
  register: (data: Record<string, any>) => Promise<void>;
  logout: () => Promise<void>;
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

  // Charger depuis SecureStore au démarrage
  useEffect(() => {
    const loadAuthData = async () => {
      const storedAccessToken = await SecureStore.getItemAsync("accessToken");
      const storedRefreshToken = await SecureStore.getItemAsync("refreshToken");
      const storedUser = await SecureStore.getItemAsync("user");

      if (storedAccessToken && storedRefreshToken && storedUser) {
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);
        setUser(JSON.parse(storedUser));
      }
    };
    loadAuthData();
  }, []);

  // 🔑 Login
  const login = async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error("Échec de la connexion");
    }

    const data = await response.json();

    setAccessToken(data.access);
    setRefreshToken(data.refresh);
    setUser(data.user);

    await SecureStore.setItemAsync("accessToken", data.access);
    await SecureStore.setItemAsync("refreshToken", data.refresh);
    await SecureStore.setItemAsync("user", JSON.stringify(data.user));
  };

  // 📝 Register
  const register = async (formData: Record<string, any>) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/register/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      throw new Error("Échec de l'inscription");
    }

    const data = await response.json();

    setAccessToken(data.tokens.access);
    setRefreshToken(data.tokens.refresh);
    setUser(data.user);

    await SecureStore.setItemAsync("accessToken", data.tokens.access);
    await SecureStore.setItemAsync("refreshToken", data.tokens.refresh);
    await SecureStore.setItemAsync("user", JSON.stringify(data.user));
  };

  // 🚪 Logout
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

    await SecureStore.deleteItemAsync("accessToken");
    await SecureStore.deleteItemAsync("refreshToken");
    await SecureStore.deleteItemAsync("user");
  };

  // 🔄 Refresh token si nécessaire
  const refreshAccessToken = async (): Promise<string | null> => {
    if (!refreshToken) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) {
        console.log("❌ Refresh échoué:", response.status);
        return null;
      }

      const data = await response.json();
      console.log("✅ Nouveau token reçu:", data.access);

      setAccessToken(data.access);
      await SecureStore.setItemAsync("accessToken", data.access);

      return data.access;
    } catch (error) {
      console.error("❌ Erreur lors du refresh:", error);
      return null;
    }
  };

  // ⚡️ Requêtes protégées
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
      console.log("⚠️ Token expiré, tentative de refresh...");

      const newToken = await refreshAccessToken();
      if (!newToken) {
        console.log("❌ Refresh impossible, déconnexion");
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

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        login,
        register,
        logout,
        makeAuthenticatedRequest,
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
