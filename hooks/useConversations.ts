import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

export interface Conversation {
  uuid: string;
  unread_count: number;
  last_message?: {
    content: string;
    created_at: string;
    sender_username: string;
  };
  other_participant?: {
    username: string;
    surnom?: string; // Added surnom
    photo_profil_url: string;
    is_online?: boolean;
    uuid?: string; // Added uuid
  };
  group_info?: {
    name: string;
    avatar: string;
  };
}

export const useConversations = () => {
  const { makeAuthenticatedRequest, isLoggedIn } = useAuth();
  const queryClient = useQueryClient();

  const privateConversations = useQuery({
    queryKey: ['conversations', 'private'],
    queryFn: async () => {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/messaging/conversations/private/`);
      if (!response.ok) throw new Error('Failed to fetch private conversations');
      const data = await response.json();
      return Array.isArray(data) ? data : (data.results || []);
    },
    enabled: isLoggedIn,
    staleTime: 1000 * 60,
  });

  const groupConversations = useQuery({
    queryKey: ['conversations', 'groups'],
    queryFn: async () => {
      const response = await makeAuthenticatedRequest(`${API_BASE_URL}/messaging/conversations/groups/`);
      if (!response.ok) throw new Error('Failed to fetch group conversations');
      const data = await response.json();
      return Array.isArray(data) ? data : (data.results || []);
    },
    enabled: isLoggedIn,
    staleTime: 1000 * 60,
  });

  const refreshAll = async () => {
    await Promise.all([
      privateConversations.refetch(),
      groupConversations.refetch()
    ]);
  };

  const invalidateConversations = () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  return {
    privateConversations: (privateConversations.data || []) as Conversation[],
    groupConversations: (groupConversations.data || []) as Conversation[],
    
    isLoading: privateConversations.isLoading || groupConversations.isLoading,
    // 🆕 Expose refetching state for RefreshControl
    isRefetching: privateConversations.isRefetching || groupConversations.isRefetching,
    isError: privateConversations.isError || groupConversations.isError,
    error: privateConversations.error || groupConversations.error,
    
    refreshAll,
    invalidateConversations
  };
};