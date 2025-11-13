/**
 * Cache Configuration
 *
 * Defines TTL (Time-To-Live) constants for different data types
 * and cache key patterns used throughout the application.
 */

/**
 * TTL Constants (in seconds)
 */
export const CacheTTL = {
  /**
   * User profile data - 1 hour
   * User profiles don't change frequently
   */
  USER_PROFILE: 3600,

  /**
   * Conversations list - 5 minutes
   * Conversations can update with new messages
   */
  CONVERSATIONS_LIST: 300,

  /**
   * Individual messages - Never expire
   * Messages are immutable once sent
   */
  MESSAGES: Infinity,

  /**
   * Avatar images - 24 hours
   * Profile pictures rarely change
   */
  AVATARS: 86400,

  /**
   * Connections/friends list - 10 minutes
   * Connections can be added/removed
   */
  CONNECTIONS: 600,

  /**
   * Groups list - 10 minutes
   * Groups can be created/joined
   */
  GROUPS: 600,

  /**
   * Group invitations - 2 minutes
   * Invitations are time-sensitive
   */
  INVITATIONS: 120,

  /**
   * Agents list - 30 minutes
   * Agents don't change frequently
   */
  AGENTS: 1800,

  /**
   * User search results - 5 minutes
   * Search results can become stale
   */
  SEARCH_RESULTS: 300,

  /**
   * Conversation info (metadata) - 15 minutes
   * Conversation metadata updates occasionally
   */
  CONVERSATION_INFO: 900,

  /**
   * Media (images/videos) - 7 days
   * Media files are immutable
   */
  MEDIA: 604800,

  /**
   * Stats/analytics - 1 hour
   * Stats are computed periodically
   */
  STATS: 3600,

  /**
   * Questions (profile questions) - 1 day
   * Questions rarely change
   */
  QUESTIONS: 86400,
} as const;

/**
 * Cache Key Patterns
 *
 * Standardized patterns for generating cache keys.
 * Use these functions to ensure consistency across the app.
 */
export const CacheKeys = {
  /**
   * User profile: user:{uuid}
   */
  userProfile: (uuid: string) => `user:${uuid}`,

  /**
   * Private conversations list: conversations:private
   */
  privateConversations: () => 'conversations:private',

  /**
   * Group conversations list: conversations:groups
   */
  groupConversations: () => 'conversations:groups',

  /**
   * Conversation messages: conversations:{uuid}:messages
   */
  conversationMessages: (conversationUuid: string) =>
    `conversations:${conversationUuid}:messages`,

  /**
   * Conversation info: conversations:{uuid}:info
   */
  conversationInfo: (conversationUuid: string) =>
    `conversations:${conversationUuid}:info`,

  /**
   * Connections list: connections
   */
  connections: () => 'connections',

  /**
   * Groups list: groups
   */
  groups: () => 'groups',

  /**
   * Group invitations: invitations:groups
   */
  groupInvitations: () => 'invitations:groups',

  /**
   * Connection invitations sent: invitations:connections:sent
   */
  connectionInvitationsSent: () => 'invitations:connections:sent',

  /**
   * Connection invitations received: invitations:connections:received
   */
  connectionInvitationsReceived: () => 'invitations:connections:received',

  /**
   * Agents list: agents
   */
  agents: () => 'agents',

  /**
   * Agent details: agents:{uuid}
   */
  agentDetails: (uuid: string) => `agents:${uuid}`,

  /**
   * Avatar URL: avatar:{url_hash}
   */
  avatar: (url: string) => {
    // Simple hash for URL
    const hash = url.split('').reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
    }, 0);
    return `avatar:${Math.abs(hash)}`;
  },

  /**
   * Search results: search:{query}
   */
  search: (query: string) => `search:${encodeURIComponent(query)}`,

  /**
   * Profile questions: questions
   */
  questions: () => 'questions',

  /**
   * User stats: stats:{uuid}
   */
  userStats: (uuid: string) => `stats:${uuid}`,

  /**
   * Media items: media:{conversationUuid}
   */
  conversationMedia: (conversationUuid: string) =>
    `media:${conversationUuid}`,

  /**
   * Jarvis history: jarvis:history
   */
  jarvisHistory: () => 'jarvis:history',

  /**
   * Jarvis instance: jarvis:instance
   */
  jarvisInstance: () => 'jarvis:instance',
} as const;

/**
 * Cache Invalidation Rules
 *
 * Defines which cache keys should be invalidated when certain actions occur.
 * This ensures cache consistency across the application.
 */
export const CacheInvalidationRules = {
  /**
   * When a new message is sent
   */
  onMessageSent: (conversationUuid: string) => [
    CacheKeys.privateConversations(),
    CacheKeys.groupConversations(),
    CacheKeys.conversationInfo(conversationUuid),
    // Don't invalidate messages - we'll add the new message to cache
  ],

  /**
   * When user profile is updated
   */
  onProfileUpdated: (uuid: string) => [CacheKeys.userProfile(uuid)],

  /**
   * When a connection is added/removed
   */
  onConnectionChanged: () => [
    CacheKeys.connections(),
    CacheKeys.connectionInvitationsSent(),
    CacheKeys.connectionInvitationsReceived(),
  ],

  /**
   * When a group is created/joined/left
   */
  onGroupChanged: () => [
    CacheKeys.groups(),
    CacheKeys.groupConversations(),
    CacheKeys.groupInvitations(),
  ],

  /**
   * When an invitation is sent/accepted/declined
   */
  onInvitationChanged: () => [
    CacheKeys.connectionInvitationsSent(),
    CacheKeys.connectionInvitationsReceived(),
    CacheKeys.groupInvitations(),
  ],

  /**
   * When user logs out - clear all cache
   */
  onLogout: () => ['*'], // Invalidate everything

  /**
   * When an agent is created/modified
   */
  onAgentChanged: (uuid?: string) =>
    uuid ? [CacheKeys.agents(), CacheKeys.agentDetails(uuid)] : [CacheKeys.agents()],

  /**
   * When conversation is deleted
   */
  onConversationDeleted: (conversationUuid: string) => [
    CacheKeys.privateConversations(),
    CacheKeys.groupConversations(),
    `conversations:${conversationUuid}:*`, // All keys related to this conversation
  ],
} as const;

/**
 * Stale-While-Revalidate Configuration
 *
 * For certain data types, we want to show stale cache data immediately
 * while fetching fresh data in the background.
 */
export const StaleWhileRevalidateConfig = {
  /**
   * Enable SWR for conversations list
   * Show cached list immediately, refresh in background
   */
  CONVERSATIONS_LIST: true,

  /**
   * Enable SWR for user profiles
   * Show cached profile, update in background
   */
  USER_PROFILE: true,

  /**
   * Enable SWR for connections
   */
  CONNECTIONS: true,

  /**
   * Enable SWR for groups
   */
  GROUPS: true,

  /**
   * Disable SWR for invitations (they're time-sensitive)
   */
  INVITATIONS: false,

  /**
   * Disable SWR for messages (handled separately via WebSocket)
   */
  MESSAGES: false,
} as const;

/**
 * Cache Configuration Presets
 *
 * Common cache configurations for different types of API requests
 */
export const CachePresets = {
  /**
   * For frequently changing data that should be fresh
   */
  SHORT_LIVED: {
    ttl: 60, // 1 minute
    useCache: true,
    staleWhileRevalidate: false,
  },

  /**
   * For data that changes occasionally
   */
  MEDIUM_LIVED: {
    ttl: 600, // 10 minutes
    useCache: true,
    staleWhileRevalidate: true,
  },

  /**
   * For data that rarely changes
   */
  LONG_LIVED: {
    ttl: 3600, // 1 hour
    useCache: true,
    staleWhileRevalidate: true,
  },

  /**
   * For immutable data
   */
  IMMUTABLE: {
    ttl: Infinity,
    useCache: true,
    staleWhileRevalidate: false,
  },

  /**
   * Don't use cache (always fetch fresh)
   */
  NO_CACHE: {
    ttl: 0,
    useCache: false,
    staleWhileRevalidate: false,
  },
} as const;
