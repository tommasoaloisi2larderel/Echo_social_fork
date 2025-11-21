import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../config/api';
import { useAuth } from '../contexts/AuthContext';

// 🆕 Exporting the interface so it can be used in components
export interface Attachment {
  uuid: string;
  file_type: string;
  file_url: string;
  thumbnail_url?: string;
  original_filename?: string;
}

export interface Message {
  id: number;
  uuid: string;
  content: string;
  sender_username: string;
  created_at: string;
  is_read: boolean;
  conversation_uuid: string;
  // 🆕 Added optional fields to support UI requirements
  is_ai_generated?: boolean;
  isAiLoading?: boolean;
  isPending?: boolean;
  attachments?: Attachment[];
}

export const useMessages = (conversationId: string | null) => {
  const { makeAuthenticatedRequest } = useAuth();
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/conversations/${conversationId}/messages/?limit=50`
      );
      if (!response.ok) throw new Error('Failed to fetch messages');
      
      const data = await response.json();
      let messages = Array.isArray(data) ? data : (data.results || []);
      
      return messages.sort((a: Message, b: Message) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    },
    enabled: !!conversationId,
    staleTime: 0, // Always consider stale to allow websocket updates to take precedence or easy refetch
  });

  // Mutation to mark messages as read
  const markReadMutation = useMutation({
    mutationFn: async () => {
      if (!conversationId) return;
      await makeAuthenticatedRequest(
        `${API_BASE_URL}/messaging/conversations/${conversationId}/read/`,
        { method: 'POST' }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  });

  return {
    messages: (messagesQuery.data || []) as Message[],
    isLoading: messagesQuery.isLoading,
    isError: messagesQuery.isError,
    refresh: messagesQuery.refetch,
    markAsRead: markReadMutation.mutate,
  };
};