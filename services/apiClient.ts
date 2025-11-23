import { API_BASE_URL } from "@/config/api";
import { storage } from "@/utils/storage"; // Your existing storage wrapper

interface FailedRequest {
  resolve: (value: Response | PromiseLike<Response>) => void;
  reject: (reason?: any) => void;
  url: string;
  options?: RequestInit;
}

// State variables for the "Lock" mechanism
let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

// Event listener to trigger Logout in React context from here
let onLogoutRequired: (() => void) | null = null;

export const setLogoutCallback = (callback: () => void) => {
  onLogoutRequired = callback;
};

/**
 * Processes the queue of failed requests after a token refresh attempt.
 */
const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      // Retry the request with the new token
      if (prom.options) {
        prom.options.headers = {
          ...prom.options.headers,
          Authorization: `Bearer ${token}`,
        };
      }
      fetch(prom.url, prom.options!)
        .then(prom.resolve)
        .catch(prom.reject);
    }
  });
  failedQueue = [];
};

/**
 * Internal function to refresh the token
 */
const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const refreshToken = await storage.getItemAsync("refreshToken");
    if (!refreshToken) return null;

    const response = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.access) {
      await storage.setItemAsync("accessToken", data.access);
      return data.access;
    }
    return null;
  } catch (error) {
    console.error("Token refresh network error:", error);
    return null;
  }
};

/**
 * Main Authenticated Fetch Wrapper
 * Replaces: makeAuthenticatedRequest
 */
export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const accessToken = await storage.getItemAsync("accessToken");

  // 1. Attach current token if it exists
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  } as HeadersInit;

  const response = await fetch(url, { ...options, headers });

  // 2. Handle 401 (Unauthorized) -> The logic happens here
  if (response.status === 401) {
    // If we are already refreshing, queue this request
    if (isRefreshing) {
      return new Promise<Response>((resolve, reject) => {
        failedQueue.push({ resolve, reject, url, options });
      });
    }

    // Otherwise, start the refresh process
    isRefreshing = true;

    try {
      const newAccessToken = await refreshAccessToken();

      if (newAccessToken) {
        isRefreshing = false;
        // Process all queued requests with the new token
        processQueue(null, newAccessToken);

        // Retry the original request
        return await fetch(url, {
          ...options,
          headers: {
            ...headers,
            Authorization: `Bearer ${newAccessToken}`,
          },
        });
      } else {
        // Refresh failed completely (refresh token expired or invalid)
        isRefreshing = false;
        processQueue(new Error("Session expired"));
        if (onLogoutRequired) onLogoutRequired();
        return response; // Return the 401 so the UI can handle it if needed
      }
    } catch (error) {
      isRefreshing = false;
      processQueue(error as Error);
      if (onLogoutRequired) onLogoutRequired();
      throw error;
    }
  }

  return response;
};