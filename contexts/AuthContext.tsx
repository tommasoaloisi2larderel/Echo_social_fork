import { API_BASE_URL } from "@/config/api";
import { fetchWithAuth, setLogoutCallback } from "@/services/apiClient";
import { router } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import { storage } from "../utils/storage"; // Your existing storage wrapper

interface User {
  id: number;
  uuid: string;
  username: string;
  email: string;
  photo_profil?: string | null;
  // Add other fields as needed
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isLoggedIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (data: Record<string, any>) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updatedUser: User) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize logic
  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Bind the logout action to the API Client
        // This allows the non-React API file to trigger a logout on 401 failure
        setLogoutCallback(() => {
          performLogout(false); // false = don't call API to logout, just clear state
        });

        // 2. Check if we have user data
        const storedUser = await storage.getItemAsync("user");
        const storedAccess = await storage.getItemAsync("accessToken");
        const storedRefresh = await storage.getItemAsync("refreshToken");

        if (storedUser && storedAccess && storedRefresh) {
          setUser(JSON.parse(storedUser));
          
          // Optional: Verify session is actually valid by fetching profile quietly
          // We don't await this to keep startup fast, but it will trigger logout if invalid
          fetchWithAuth(`${API_BASE_URL}/api/auth/profile/`)
            .then(res => {
              if (!res.ok) performLogout(false);
            })
            .catch(() => { /* Network error, ignore */ });
            
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Internal helper to clear state and storage
   * @param callApi - whether to notify the backend (true for user click, false for session expiry)
   */
  const performLogout = async (callApi: boolean = true) => {
    if (callApi) {
      try {
        const refresh = await storage.getItemAsync("refreshToken");
        if (refresh) {
          await fetch(`${API_BASE_URL}/api/auth/logout/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh }),
          });
        }
      } catch (e) {
        console.warn("Logout API call failed", e);
      }
    }

    setUser(null);
    await storage.deleteItemAsync("accessToken");
    await storage.deleteItemAsync("refreshToken");
    await storage.deleteItemAsync("user");
    
    router.replace("/(auth)/login");
  };

  const login = async (username: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Échec de la connexion");
    }

    const data = await response.json();
    
    // Store secure data
    await storage.setItemAsync("accessToken", data.access);
    await storage.setItemAsync("refreshToken", data.refresh);
    await storage.setItemAsync("user", JSON.stringify(data.user));
    
    setUser(data.user);
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
      throw new Error(errorData.detail || "Échec de l'inscription");
    }

    const data = await response.json();

    await storage.setItemAsync("accessToken", data.tokens.access);
    await storage.setItemAsync("refreshToken", data.tokens.refresh);
    await storage.setItemAsync("user", JSON.stringify(data.user));

    setUser(data.user);
  };

  const logout = async () => {
    await performLogout(true);
  };

  const updateUser = async (updatedUser: User) => {
    setUser(updatedUser);
    await storage.setItemAsync("user", JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLoggedIn: !!user,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};