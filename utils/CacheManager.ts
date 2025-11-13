import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * CacheEntry represents a single cached value with metadata
 */
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number; // Time-to-live in seconds (Infinity for never expire)
  key: string;
  size?: number; // Approximate size in bytes for LRU eviction
}

/**
 * CacheStats for monitoring cache performance
 */
interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  evictions: number;
  invalidations: number;
}

/**
 * CacheManager - Dual-layer caching system with TTL and LRU eviction
 *
 * Features:
 * - Memory layer (Map) for instant access
 * - AsyncStorage layer for persistence across app restarts
 * - TTL (Time-To-Live) management with automatic expiration
 * - LRU eviction when storage limit is reached
 * - Type-safe with TypeScript generics
 * - Batch operations for performance
 * - Pattern-based invalidation
 *
 * @example
 * const cache = CacheManager.getInstance();
 * await cache.set('user:123', userData, 3600);
 * const user = await cache.get<User>('user:123');
 */
export class CacheManager {
  private static instance: CacheManager;

  // Memory cache for fast access
  private memoryCache: Map<string, CacheEntry<any>> = new Map();

  // Track access order for LRU eviction
  private accessOrder: string[] = [];

  // Cache statistics
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    invalidations: 0,
  };

  // Configuration
  private readonly MAX_MEMORY_ITEMS = 100; // Max items in memory cache
  private readonly MAX_STORAGE_SIZE = 10 * 1024 * 1024; // 10MB max storage
  private readonly CACHE_KEY_PREFIX = '@cache:';
  private readonly METADATA_KEY = '@cache:metadata';

  private currentStorageSize = 0;

  private constructor() {
    this.loadMetadata();
  }

  /**
   * Get singleton instance of CacheManager
   */
  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Get a value from cache
   * Checks memory first, then AsyncStorage
   * Returns null if not found or expired
   */
  public async get<T>(key: string): Promise<T | null> {
    try {
      // Check memory cache first
      const memoryEntry = this.memoryCache.get(key);

      if (memoryEntry) {
        // Check if expired
        if (this.isExpired(memoryEntry)) {
          console.log(`🔴 Cache EXPIRED (memory): ${key}`);
          this.memoryCache.delete(key);
          await this.removeFromStorage(key);
          this.stats.misses++;
          return null;
        }

        // Update access order for LRU
        this.updateAccessOrder(key);

        console.log(`✅ Cache HIT (memory): ${key}`);
        this.stats.hits++;
        return memoryEntry.value as T;
      }

      // Check AsyncStorage
      const storageKey = this.getStorageKey(key);
      const storageData = await AsyncStorage.getItem(storageKey);

      if (storageData) {
        const entry: CacheEntry<T> = JSON.parse(storageData);

        // Check if expired
        if (this.isExpired(entry)) {
          console.log(`🔴 Cache EXPIRED (storage): ${key}`);
          await this.removeFromStorage(key);
          this.stats.misses++;
          return null;
        }

        // Promote to memory cache
        this.memoryCache.set(key, entry);
        this.updateAccessOrder(key);

        console.log(`✅ Cache HIT (storage): ${key}`);
        this.stats.hits++;
        return entry.value as T;
      }

      console.log(`❌ Cache MISS: ${key}`);
      this.stats.misses++;
      return null;
    } catch (error) {
      console.error(`❌ Cache GET error for ${key}:`, error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set a value in cache with TTL
   * Writes to both memory and AsyncStorage
   *
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time-to-live in seconds (Infinity for never expire)
   */
  public async set<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        value,
        timestamp: Date.now(),
        ttl,
        key,
        size: this.estimateSize(value),
      };

      // Set in memory cache
      this.memoryCache.set(key, entry);
      this.updateAccessOrder(key);

      // Evict from memory if needed
      this.evictMemoryIfNeeded();

      // Set in AsyncStorage
      const storageKey = this.getStorageKey(key);
      await AsyncStorage.setItem(storageKey, JSON.stringify(entry));

      // Update storage size tracking
      this.currentStorageSize += entry.size || 0;
      await this.evictStorageIfNeeded();
      await this.saveMetadata();

      console.log(`💾 Cache SET: ${key} (TTL: ${ttl === Infinity ? '∞' : ttl + 's'})`);
      this.stats.sets++;
    } catch (error) {
      console.error(`❌ Cache SET error for ${key}:`, error);
    }
  }

  /**
   * Get multiple values from cache
   */
  public async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get<T>(key);
        if (value !== null) {
          results.set(key, value);
        }
      })
    );

    return results;
  }

  /**
   * Set multiple values in cache
   */
  public async setMany<T>(entries: Map<string, { value: T; ttl: number }>): Promise<void> {
    await Promise.all(
      Array.from(entries.entries()).map(([key, { value, ttl }]) =>
        this.set(key, value, ttl)
      )
    );
  }

  /**
   * Invalidate (delete) a specific cache entry
   */
  public async invalidate(key: string): Promise<void> {
    try {
      this.memoryCache.delete(key);
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
      await this.removeFromStorage(key);

      console.log(`🗑️ Cache INVALIDATED: ${key}`);
      this.stats.invalidations++;
    } catch (error) {
      console.error(`❌ Cache INVALIDATE error for ${key}:`, error);
    }
  }

  /**
   * Invalidate all cache entries matching a pattern
   * Supports wildcards with *
   *
   * @example
   * invalidatePattern('user:*') // Invalidates all user keys
   * invalidatePattern('conversations:123:*') // Invalidates all keys for conversation 123
   */
  public async invalidatePattern(pattern: string): Promise<void> {
    try {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );

      // Invalidate from memory
      const memoryKeysToDelete: string[] = [];
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          memoryKeysToDelete.push(key);
        }
      }

      // Invalidate from storage
      const allKeys = await AsyncStorage.getAllKeys();
      const storageKeysToDelete: string[] = [];

      for (const storageKey of allKeys) {
        if (storageKey.startsWith(this.CACHE_KEY_PREFIX)) {
          const key = storageKey.replace(this.CACHE_KEY_PREFIX, '');
          if (regex.test(key)) {
            storageKeysToDelete.push(storageKey);
          }
        }
      }

      // Delete from memory
      memoryKeysToDelete.forEach((key) => {
        this.memoryCache.delete(key);
        this.accessOrder = this.accessOrder.filter((k) => k !== key);
      });

      // Delete from storage
      if (storageKeysToDelete.length > 0) {
        await AsyncStorage.multiRemove(storageKeysToDelete);
      }

      console.log(
        `🗑️ Cache INVALIDATED pattern "${pattern}": ${
          memoryKeysToDelete.length + storageKeysToDelete.length
        } entries`
      );
      this.stats.invalidations += memoryKeysToDelete.length + storageKeysToDelete.length;

      await this.saveMetadata();
    } catch (error) {
      console.error(`❌ Cache INVALIDATE PATTERN error for ${pattern}:`, error);
    }
  }

  /**
   * Clear all cache
   */
  public async clear(): Promise<void> {
    try {
      this.memoryCache.clear();
      this.accessOrder = [];
      this.currentStorageSize = 0;

      // Clear all cache keys from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((key) =>
        key.startsWith(this.CACHE_KEY_PREFIX)
      );

      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }

      console.log(`🗑️ Cache CLEARED: ${cacheKeys.length} entries`);
      await this.saveMetadata();
    } catch (error) {
      console.error('❌ Cache CLEAR error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get cache hit rate as percentage
   */
  public getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total === 0 ? 0 : (this.stats.hits / total) * 100;
  }

  /**
   * Check if a cache entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    if (entry.ttl === Infinity) return false;
    const age = (Date.now() - entry.timestamp) / 1000; // Age in seconds
    return age > entry.ttl;
  }

  /**
   * Update access order for LRU eviction
   */
  private updateAccessOrder(key: string): void {
    // Remove key if it exists
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Evict least recently used items from memory cache if needed
   */
  private evictMemoryIfNeeded(): void {
    while (this.memoryCache.size > this.MAX_MEMORY_ITEMS) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.memoryCache.delete(oldestKey);
        console.log(`🗑️ Memory EVICTED (LRU): ${oldestKey}`);
        this.stats.evictions++;
      }
    }
  }

  /**
   * Evict least recently used items from AsyncStorage if size limit exceeded
   */
  private async evictStorageIfNeeded(): Promise<void> {
    if (this.currentStorageSize <= this.MAX_STORAGE_SIZE) return;

    try {
      // Get all cache entries from storage
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((key) =>
        key.startsWith(this.CACHE_KEY_PREFIX)
      );

      if (cacheKeys.length === 0) return;

      // Load all entries to sort by access time
      const entries: Array<{ key: string; entry: CacheEntry<any> }> = [];

      for (const storageKey of cacheKeys) {
        const data = await AsyncStorage.getItem(storageKey);
        if (data) {
          const entry = JSON.parse(data);
          entries.push({ key: storageKey, entry });
        }
      }

      // Sort by timestamp (oldest first)
      entries.sort((a, b) => a.entry.timestamp - b.entry.timestamp);

      // Evict oldest entries until under limit
      let evicted = 0;
      while (this.currentStorageSize > this.MAX_STORAGE_SIZE && entries.length > 0) {
        const oldest = entries.shift();
        if (oldest) {
          await AsyncStorage.removeItem(oldest.key);
          this.currentStorageSize -= oldest.entry.size || 0;
          evicted++;
          console.log(`🗑️ Storage EVICTED (LRU): ${oldest.entry.key}`);
          this.stats.evictions++;
        }
      }

      if (evicted > 0) {
        await this.saveMetadata();
      }
    } catch (error) {
      console.error('❌ Storage eviction error:', error);
    }
  }

  /**
   * Get storage key with prefix
   */
  private getStorageKey(key: string): string {
    return `${this.CACHE_KEY_PREFIX}${key}`;
  }

  /**
   * Remove entry from AsyncStorage
   */
  private async removeFromStorage(key: string): Promise<void> {
    try {
      const storageKey = this.getStorageKey(key);
      const data = await AsyncStorage.getItem(storageKey);

      if (data) {
        const entry = JSON.parse(data);
        this.currentStorageSize -= entry.size || 0;
      }

      await AsyncStorage.removeItem(storageKey);
      await this.saveMetadata();
    } catch (error) {
      console.error(`❌ Remove from storage error for ${key}:`, error);
    }
  }

  /**
   * Estimate size of value in bytes
   */
  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 0;
    }
  }

  /**
   * Save cache metadata (size, stats) to AsyncStorage
   */
  private async saveMetadata(): Promise<void> {
    try {
      const metadata = {
        currentStorageSize: this.currentStorageSize,
        stats: this.stats,
        lastUpdated: Date.now(),
      };
      await AsyncStorage.setItem(this.METADATA_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('❌ Save metadata error:', error);
    }
  }

  /**
   * Load cache metadata from AsyncStorage
   */
  private async loadMetadata(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(this.METADATA_KEY);
      if (data) {
        const metadata = JSON.parse(data);
        this.currentStorageSize = metadata.currentStorageSize || 0;
        this.stats = metadata.stats || this.stats;
        console.log(`📊 Cache metadata loaded (size: ${this.currentStorageSize} bytes)`);
      }
    } catch (error) {
      console.error('❌ Load metadata error:', error);
    }
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance();
