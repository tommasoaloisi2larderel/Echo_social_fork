import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

const API_BASE_URL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? "http://localhost:3001"
  : "https://reseausocial-production.up.railway.app";

interface JarvisInstance {
  uuid: string;
  user: number;
  user_username: string;
  user_preferences: Record<string, any>;
  is_active: boolean;
  default_language: string;
  total_requests: number;
  total_actions_performed: number;
  last_interaction: string | null;
  created_at: string;
  updated_at: string;
  learned_patterns: Record<string, any>;
  api_rate_limit: number;
}

interface JarvisMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

interface JarvisHistoryEntry {
  uuid: string;
  user_message: string;
  jarvis_response: string;
  related_action: any | null;
  created_at: string;
}

interface JarvisStats {
  total_requests: number;
  total_actions_performed: number;
  successful_actions: number;
  failed_actions: number;
  success_rate: number;
  last_interaction: string | null;
  actions_by_type: { action_type: string; count: number }[];
  is_active: boolean;
  api_rate_limit: number;
}

interface JarvisContextType {
  instance: JarvisInstance | null;
  messages: JarvisMessage[];
  history: JarvisHistoryEntry[];
  stats: JarvisStats | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  sendMessage: (message: string) => Promise<void>;
  getWelcomeMessage: () => Promise<void>;
  getNotificationsSummary: () => Promise<void>;
  loadHistory: () => Promise<void>;
  loadStats: () => Promise<void>;
  clearHistory: () => Promise<void>;
  updateInstance: (updates: Partial<JarvisInstance>) => Promise<void>;
  addMessage: (message: JarvisMessage) => void;
  clearMessages: () => void;
}

const JarvisContext = createContext<JarvisContextType | undefined>(undefined);

export const JarvisProvider = ({ children }: { children: ReactNode }) => {
  const { makeAuthenticatedRequest, isLoggedIn } = useAuth();
  const [instance, setInstance] = useState<JarvisInstance | null>(null);
  const [messages, setMessages] = useState<JarvisMessage[]>([]);
  const [history, setHistory] = useState<JarvisHistoryEntry[]>([]);
  const [stats, setStats] = useState<JarvisStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Jarvis instance when user logs in
  useEffect(() => {
    if (isLoggedIn) {
      initializeInstance();
    }
  }, [isLoggedIn]);

  const initializeInstance = async () => {
    try {
      setIsLoading(true);
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/jarvis/instance/`);
      if (response.ok) {
        const data = await response.json();
        setInstance(data);
        setError(null);
      } else {
        setError('Failed to initialize Jarvis');
      }
    } catch (err) {
      console.error('Error initializing Jarvis:', err);
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;

    const userMessage: JarvisMessage = {
      id: Date.now(),
      role: 'user',
      content: message.trim(),
    };

    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/jarvis/chat/?type=message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: message.trim() }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: JarvisMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: data.response || 'No response',
        };
        setMessages(prev => [...prev, assistantMessage]);
        setError(null);
      } else if (response.status === 403) {
        const errorData = await response.json();
        setError(errorData.error || 'Jarvis is disabled');
        const errorMessage: JarvisMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: errorData.error || 'Jarvis is currently disabled for your account.',
        };
        setMessages(prev => [...prev, errorMessage]);
      } else {
        throw new Error(`Error ${response.status}`);
      }
    } catch (err) {
      console.error('Error sending message to Jarvis:', err);
      const errorMessage: JarvisMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      };
      setMessages(prev => [...prev, errorMessage]);
      setError('Network error');
    }
  };

  const getWelcomeMessage = async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/jarvis/chat/?type=welcome`,
        { method: 'POST' }
      );

      if (response.ok) {
        const data = await response.json();
        const welcomeMessage: JarvisMessage = {
          id: Date.now(),
          role: 'assistant',
          content: data.response || 'Welcome!',
        };
        setMessages(prev => [...prev, welcomeMessage]);
      }
    } catch (err) {
      console.error('Error getting welcome message:', err);
    }
  };

  const getNotificationsSummary = async () => {
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/jarvis/chat/?type=notifications`,
        { method: 'POST' }
      );

      if (response.ok) {
        const data = await response.json();
        const notifMessage: JarvisMessage = {
          id: Date.now(),
          role: 'assistant',
          content: data.response || 'No notifications',
        };
        setMessages(prev => [...prev, notifMessage]);
      }
    } catch (err) {
      console.error('Error getting notifications:', err);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/jarvis/history/`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
        
        // Convert history to messages format
        const historyMessages: JarvisMessage[] = [];
        data.forEach((entry: JarvisHistoryEntry) => {
          historyMessages.push({
            id: Date.now() + Math.random(),
            role: 'user',
            content: entry.user_message,
          });
          historyMessages.push({
            id: Date.now() + Math.random() + 1,
            role: 'assistant',
            content: entry.jarvis_response,
          });
        });
        
        setMessages(historyMessages);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    }
  };

  const loadStats = async () => {
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/jarvis/stats/`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const clearHistory = async () => {
    try {
      // Backend doesn't have a clear history endpoint, so we just clear local state
      setMessages([]);
      setHistory([]);
    } catch (err) {
      console.error('Error clearing history:', err);
    }
  };

  const updateInstance = async (updates: Partial<JarvisInstance>) => {
    try {
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/jarvis/instance/`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setInstance(data);
      }
    } catch (err) {
      console.error('Error updating instance:', err);
    }
  };

  const addMessage = (message: JarvisMessage) => {
    setMessages(prev => [...prev, message]);
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <JarvisContext.Provider
      value={{
        instance,
        messages,
        history,
        stats,
        isLoading,
        error,
        sendMessage,
        getWelcomeMessage,
        getNotificationsSummary,
        loadHistory,
        loadStats,
        clearHistory,
        updateInstance,
        addMessage,
        clearMessages,
      }}
    >
      {children}
    </JarvisContext.Provider>
  );
};

export const useJarvis = () => {
  const context = useContext(JarvisContext);
  if (context === undefined) {
    throw new Error('useJarvis must be used within a JarvisProvider');
  }
  return context;
};