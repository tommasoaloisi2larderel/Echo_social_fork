# 🚀 Aggressive Caching System - Usage Examples

This document provides examples of how to use the new aggressive caching system in the Echo Social app.

## 📋 Table of Contents

1. [Basic Usage](#basic-usage)
2. [Cache Configuration](#cache-configuration)
3. [Common Patterns](#common-patterns)
4. [Cache Invalidation](#cache-invalidation)
5. [Stale-While-Revalidate](#stale-while-revalidate)
6. [Advanced Examples](#advanced-examples)

---

## Basic Usage

### Default Behavior (Automatic Caching for GET)

```typescript
import { useAuth } from '@/contexts/AuthContext';

const MyComponent = () => {
  const { makeAuthenticatedRequest } = useAuth();

  // GET requests are automatically cached with default TTL
  const fetchUserProfile = async () => {
    const response = await makeAuthenticatedRequest(
      `${API_BASE_URL}/api/auth/profile/`
    );
    const data = await response.json();
    return data;
  };

  // First call: fetches from API ✅
  // Second call: returns from cache instantly ⚡
  // After TTL expires: fetches fresh data 🔄
};
```

### Disable Caching for Specific Request

```typescript
const fetchFreshData = async () => {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/api/auth/profile/`,
    {},
    { useCache: false } // Always fetch fresh
  );
  return response.json();
};
```

---

## Cache Configuration

### Custom TTL (Time-To-Live)

```typescript
import { CacheKeys, CacheTTL } from '@/utils/cache-config';

// Short-lived cache (2 minutes for invitations)
const fetchInvitations = async () => {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/groups/invitations/received/`,
    {},
    {
      cacheKey: CacheKeys.groupInvitations(),
      ttl: CacheTTL.INVITATIONS, // 120 seconds
    }
  );
  return response.json();
};

// Long-lived cache (1 hour for user profile)
const fetchUserProfile = async (uuid: string) => {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/profiles/${uuid}/`,
    {},
    {
      cacheKey: CacheKeys.userProfile(uuid),
      ttl: CacheTTL.USER_PROFILE, // 3600 seconds
    }
  );
  return response.json();
};

// Immutable cache (messages never expire)
const fetchMessages = async (conversationId: string) => {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/messaging/conversations/${conversationId}/messages/`,
    {},
    {
      cacheKey: CacheKeys.conversationMessages(conversationId),
      ttl: CacheTTL.MESSAGES, // Infinity
    }
  );
  return response.json();
};
```

---

## Common Patterns

### Fetching Conversations List

```typescript
import { CacheKeys, CacheTTL } from '@/utils/cache-config';

const fetchPrivateConversations = async () => {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/messaging/conversations/private/`,
    {},
    {
      cacheKey: CacheKeys.privateConversations(),
      ttl: CacheTTL.CONVERSATIONS_LIST, // 5 minutes
      staleWhileRevalidate: true, // Show cache immediately, refresh in background
    }
  );
  return response.json();
};
```

### Fetching Connections

```typescript
const fetchConnections = async () => {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/relations/connections/my-connections/`,
    {},
    {
      cacheKey: CacheKeys.connections(),
      ttl: CacheTTL.CONNECTIONS, // 10 minutes
      staleWhileRevalidate: true,
    }
  );
  return response.json();
};
```

### Fetching Groups

```typescript
const fetchGroups = async () => {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/groups/my-groups/`,
    {},
    {
      cacheKey: CacheKeys.groups(),
      ttl: CacheTTL.GROUPS, // 10 minutes
    }
  );
  return response.json();
};
```

---

## Cache Invalidation

### Invalidate Specific Keys After Mutation

```typescript
import { CacheKeys } from '@/utils/cache-config';

// Send a new message - invalidate conversation list
const sendMessage = async (conversationId: string, content: string) => {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/messaging/conversations/${conversationId}/send/`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    },
    {
      invalidateKeys: [
        CacheKeys.privateConversations(),
        CacheKeys.groupConversations(),
        CacheKeys.conversationInfo(conversationId),
      ],
    }
  );
  return response.json();
};
```

### Invalidate by Pattern

```typescript
// Accept a connection invitation - invalidate all connection-related caches
const acceptInvitation = async (invitationId: string) => {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/relations/invitations/${invitationId}/accept/`,
    { method: 'POST' },
    {
      invalidatePattern: 'invitations:*', // Invalidates all invitation caches
      invalidateKeys: [CacheKeys.connections()],
    }
  );
  return response.json();
};

// Delete a conversation - invalidate all related caches
const deleteConversation = async (conversationId: string) => {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/messaging/conversations/${conversationId}/`,
    { method: 'DELETE' },
    {
      invalidatePattern: `conversations:${conversationId}:*`, // All keys for this conversation
      invalidateKeys: [
        CacheKeys.privateConversations(),
        CacheKeys.groupConversations(),
      ],
    }
  );
  return response;
};
```

### Update Profile - Invalidate User Cache

```typescript
const updateProfile = async (updates: Partial<User>) => {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/api/auth/profile/`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    },
    {
      invalidateKeys: [CacheKeys.userProfile(user.uuid)],
    }
  );
  return response.json();
};
```

---

## Stale-While-Revalidate

This pattern shows cached data immediately while fetching fresh data in the background.

```typescript
const fetchConversationsWithSWR = async () => {
  // First call: fetches from API, caches result
  // Subsequent calls:
  //   1. Returns cached data INSTANTLY ⚡
  //   2. Fetches fresh data in background 🔄
  //   3. Updates cache silently
  //   4. Next call gets fresh data

  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/messaging/conversations/private/`,
    {},
    {
      cacheKey: CacheKeys.privateConversations(),
      ttl: CacheTTL.CONVERSATIONS_LIST,
      staleWhileRevalidate: true, // 🔑 Key feature
    }
  );
  return response.json();
};
```

**When to use SWR:**
- ✅ Conversations list (show old list, update in background)
- ✅ User profiles (show cached profile, refresh silently)
- ✅ Connections/groups (immediate display, background sync)
- ❌ Invitations (too time-sensitive)
- ❌ Real-time messages (handled via WebSocket)

---

## Advanced Examples

### Batch Requests with Manual Cache Control

```typescript
import { cacheManager } from '@/utils/CacheManager';
import { CacheKeys, CacheTTL } from '@/utils/cache-config';

const prefetchUserProfiles = async (userIds: string[]) => {
  // Fetch multiple user profiles in parallel
  const profiles = await Promise.all(
    userIds.map(async (uuid) => {
      // Check cache first
      const cached = await cacheManager.get(CacheKeys.userProfile(uuid));
      if (cached) return cached;

      // Fetch if not cached
      const response = await makeAuthenticatedRequest(
        `${API_BASE_URL}/profiles/${uuid}/`
      );
      const data = await response.json();

      // Manually cache
      await cacheManager.set(
        CacheKeys.userProfile(uuid),
        data,
        CacheTTL.USER_PROFILE
      );

      return data;
    })
  );

  return profiles;
};
```

### Manual Cache Invalidation

```typescript
import { cacheManager } from '@/utils/CacheManager';
import { CacheKeys } from '@/utils/cache-config';

// Invalidate specific cache manually
const invalidateConversationsCache = async () => {
  await cacheManager.invalidate(CacheKeys.privateConversations());
  await cacheManager.invalidate(CacheKeys.groupConversations());
  console.log('Conversations cache invalidated');
};

// Invalidate all user-related caches
const invalidateAllUserCaches = async () => {
  await cacheManager.invalidatePattern('user:*');
  console.log('All user caches invalidated');
};

// Clear all caches
const clearAllCaches = async () => {
  await cacheManager.clear();
  console.log('All caches cleared');
};
```

### Check Cache Statistics

```typescript
import { cacheManager } from '@/utils/CacheManager';

const showCacheStats = () => {
  const stats = cacheManager.getStats();
  const hitRate = cacheManager.getHitRate();

  console.log('📊 Cache Statistics:');
  console.log(`Hits: ${stats.hits}`);
  console.log(`Misses: ${stats.misses}`);
  console.log(`Hit Rate: ${hitRate.toFixed(2)}%`);
  console.log(`Sets: ${stats.sets}`);
  console.log(`Evictions: ${stats.evictions}`);
  console.log(`Invalidations: ${stats.invalidations}`);
};
```

### Request Deduplication Check

```typescript
import { requestDeduplicator } from '@/utils/RequestDeduplicator';

const checkDeduplication = () => {
  const stats = requestDeduplicator.getStats();

  console.log('🔄 Deduplication Statistics:');
  console.log(`Total Requests: ${stats.totalRequests}`);
  console.log(`Deduplicated: ${stats.deduplicatedRequests}`);
  console.log(`Active: ${stats.activeRequests}`);
  console.log(`Deduplication Rate: ${stats.deduplicationRate.toFixed(2)}%`);
};
```

---

## 🎯 Best Practices

### 1. Always Use Cache Keys from `cache-config.ts`

✅ **Good:**
```typescript
import { CacheKeys, CacheTTL } from '@/utils/cache-config';

const response = await makeAuthenticatedRequest(url, {}, {
  cacheKey: CacheKeys.userProfile(uuid),
  ttl: CacheTTL.USER_PROFILE,
});
```

❌ **Bad:**
```typescript
// Don't use magic strings
const response = await makeAuthenticatedRequest(url, {}, {
  cacheKey: 'user:' + uuid, // ❌ Inconsistent
  ttl: 3600, // ❌ Magic number
});
```

### 2. Invalidate Related Caches After Mutations

```typescript
// When creating a new group
const createGroup = async (groupData) => {
  const response = await makeAuthenticatedRequest(
    `${API_BASE_URL}/groups/`,
    {
      method: 'POST',
      body: JSON.stringify(groupData),
    },
    {
      // Invalidate groups list and group conversations
      invalidateKeys: [
        CacheKeys.groups(),
        CacheKeys.groupConversations(),
      ],
    }
  );
  return response.json();
};
```

### 3. Use SWR for Lists, Not for Critical Data

✅ **Good for SWR:**
- Conversations list
- Friends list
- User profiles

❌ **Bad for SWR:**
- Invitations (time-sensitive)
- Payment info
- Security settings

### 4. Set Appropriate TTLs

- **Immutable data** (messages): `Infinity`
- **Rarely changes** (user profile): `3600` (1 hour)
- **Updates occasionally** (conversations): `300` (5 minutes)
- **Time-sensitive** (invitations): `120` (2 minutes)

---

## 🔍 Debugging Cache Issues

### Enable Verbose Logging

The caching system already logs with emojis:
- ✅ Cache HIT (memory/storage)
- ❌ Cache MISS
- 🔴 Cache EXPIRED
- 💾 Cache SET
- 🗑️ Cache INVALIDATED
- 🔄 Request DEDUPLICATED

### Check Console Logs

```
✅ Cache HIT (memory): conversations:private
❌ Cache MISS: user:123
💾 Cache SET: conversations:private (TTL: 300s)
🗑️ Cache INVALIDATED: invitations:*
🔄 Request DEDUPLICATED: GET:/api/auth/profile/
```

### Monitor Cache Performance

```typescript
// Add this to your debug screen
import { cacheManager } from '@/utils/CacheManager';

const CacheDebugInfo = () => {
  const stats = cacheManager.getStats();
  const hitRate = cacheManager.getHitRate();

  return (
    <View>
      <Text>Cache Hit Rate: {hitRate.toFixed(2)}%</Text>
      <Text>Total Hits: {stats.hits}</Text>
      <Text>Total Misses: {stats.misses}</Text>
    </View>
  );
};
```

---

## 📝 Summary

The aggressive caching system provides:

1. ✅ **Automatic caching** for GET requests
2. ✅ **Request deduplication** (prevents duplicate API calls)
3. ✅ **Smart invalidation** on mutations
4. ✅ **Stale-while-revalidate** for instant UI
5. ✅ **Dual-layer caching** (memory + AsyncStorage)
6. ✅ **TTL management** with automatic expiration
7. ✅ **LRU eviction** to prevent unbounded growth
8. ✅ **Type-safe** with TypeScript

**Expected Result:** 70-85% reduction in API calls! 🚀
