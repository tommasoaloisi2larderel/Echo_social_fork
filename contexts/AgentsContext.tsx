import React, { createContext, useContext, useState } from 'react';

interface AgentInstructions {
  system_prompt?: string;
  language?: string;
  formality_level?: string;
  max_response_length?: number;
}

export interface Agent {
  uuid: string;
  name: string;
  description?: string;
  avatar?: string | null;
  agent_type: 'simple' | 'conditional' | 'action';
  is_active: boolean;
  created_at: string;
  created_by_username: string;
  conversation_count?: number;
  instructions?: AgentInstructions;
}

interface AgentsContextType {
  // User's agents
  myAgents: Agent[];
  loadingAgents: boolean;
  
  // Agents in current conversation
  conversationAgents: Agent[];
  loadingConversationAgents: boolean;
  
  // Methods
  fetchMyAgents: (makeRequest: (url: string, options?: RequestInit) => Promise<Response>) => Promise<void>;
  fetchConversationAgents: (conversationId: string, makeRequest: (url: string, options?: RequestInit) => Promise<Response>) => Promise<void>;
  createAgent: (agentData: Partial<Agent>, makeRequest: (url: string, options?: RequestInit) => Promise<Response>) => Promise<Agent>;
  updateAgent: (uuid: string, agentData: Partial<Agent>, makeRequest: (url: string, options?: RequestInit) => Promise<Response>) => Promise<Agent>;
  addAgentToConversation: (conversationId: string, agentUuid: string, makeRequest: (url: string, options?: RequestInit) => Promise<Response>) => Promise<void>;
  removeAgentFromConversation: (conversationId: string, agentUuid: string, makeRequest: (url: string, options?: RequestInit) => Promise<Response>) => Promise<void>;
}

const AgentsContext = createContext<AgentsContextType | undefined>(undefined);

const API_BASE_URL = 'https://reseausocial-production.up.railway.app';

export function AgentsProvider({ children }: { children: React.ReactNode }) {
  const [myAgents, setMyAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [conversationAgents, setConversationAgents] = useState<Agent[]>([]);
  const [loadingConversationAgents, setLoadingConversationAgents] = useState(false);

  const fetchMyAgents = async (makeRequest: (url: string, options?: RequestInit) => Promise<Response>) => {
    setLoadingAgents(true);
    try {
      // Using correct endpoint: /agents/agents/
      const response = await makeRequest(`${API_BASE_URL}/agents/agents/`);
      if (response.ok) {
        const data = await response.json();
        setMyAgents(data);
      } else {
        console.error('Failed to fetch agents:', response.status);
        // Don't crash if agents endpoint doesn't exist yet
        setMyAgents([]);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
      setMyAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  };

  const fetchConversationAgents = async (
    conversationId: string,
    makeRequest: (url: string, options?: RequestInit) => Promise<Response>
  ) => {
    setLoadingConversationAgents(true);
    try {
      // Using correct endpoint: /agents/conversations/{uuid}/agents/
      const response = await makeRequest(
        `${API_BASE_URL}/agents/conversations/${conversationId}/agents/`
      );
      if (response.ok) {
        const data = await response.json();
        setConversationAgents(data.agents || []);
      } else {
        console.error('Failed to fetch conversation agents:', response.status);
        setConversationAgents([]);
      }
    } catch (error) {
      console.error('Error fetching conversation agents:', error);
      setConversationAgents([]);
    } finally {
      setLoadingConversationAgents(false);
    }
  };

  const createAgent = async (
    agentData: Partial<Agent>,
    makeRequest: (url: string, options?: RequestInit) => Promise<Response>
  ): Promise<Agent> => {
    console.log('Creating agent with data:', agentData);
    
    try {
      // Using correct endpoint: /agents/agents/
      const response = await makeRequest(`${API_BASE_URL}/agents/agents/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentData),
      });

      console.log('Create agent response status:', response.status);
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      console.log('Response content-type:', contentType);
      
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Le serveur a renvoyé une réponse invalide. L\'endpoint agents n\'est peut-être pas encore implémenté.');
      }

      if (!response.ok) {
        const error = await response.json();
        console.error('Create agent error:', error);
        throw new Error(error.error || error.message || 'Failed to create agent');
      }

      const newAgent = await response.json();
      console.log('Agent created successfully:', newAgent);
      setMyAgents(prev => [...prev, newAgent]);
      return newAgent;
    } catch (error) {
      console.error('Error in createAgent:', error);
      throw error;
    }
  };

  const updateAgent = async (
    uuid: string,
    agentData: Partial<Agent>,
    makeRequest: (url: string, options?: RequestInit) => Promise<Response>
  ): Promise<Agent> => {
    // Using correct endpoint: /agents/agents/{uuid}/
    const response = await makeRequest(`${API_BASE_URL}/agents/agents/${uuid}/`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update agent');
    }

    const updatedAgent = await response.json();
    setMyAgents(prev => prev.map(a => a.uuid === uuid ? updatedAgent : a));
    setConversationAgents(prev => prev.map(a => a.uuid === uuid ? updatedAgent : a));
    return updatedAgent;
  };

  const addAgentToConversation = async (
    conversationId: string,
    agentUuid: string,
    makeRequest: (url: string, options?: RequestInit) => Promise<Response>
  ) => {
    // Using correct endpoint: /agents/conversations/{uuid}/agents/add/
    const response = await makeRequest(
      `${API_BASE_URL}/agents/conversations/${conversationId}/agents/add/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agent_uuid: agentUuid }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to add agent to conversation');
    }

    // Refresh conversation agents
    await fetchConversationAgents(conversationId, makeRequest);
  };

  const removeAgentFromConversation = async (
    conversationId: string,
    agentUuid: string,
    makeRequest: (url: string, options?: RequestInit) => Promise<Response>
  ) => {
    // Using correct endpoint: /agents/conversations/{uuid}/agents/remove/
    const response = await makeRequest(
      `${API_BASE_URL}/agents/conversations/${conversationId}/agents/remove/`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agent_uuid: agentUuid }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to remove agent from conversation');
    }

    // Update local state
    setConversationAgents(prev => prev.filter(a => a.uuid !== agentUuid));
  };

  return (
    <AgentsContext.Provider
      value={{
        myAgents,
        loadingAgents,
        conversationAgents,
        loadingConversationAgents,
        fetchMyAgents,
        fetchConversationAgents,
        createAgent,
        updateAgent,
        addAgentToConversation,
        removeAgentFromConversation,
      }}
    >
      {children}
    </AgentsContext.Provider>
  );
}

export function useAgents() {
  const context = useContext(AgentsContext);
  if (!context) {
    throw new Error('useAgents must be used within an AgentsProvider');
  }
  return context;
}