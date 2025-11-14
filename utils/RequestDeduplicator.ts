/**
 * RequestDeduplicator - Prevents duplicate simultaneous API requests
 *
 * When multiple components request the same data simultaneously,
 * only one network request is made and the result is shared.
 *
 * Features:
 * - Tracks in-flight requests with Map<requestKey, Promise>
 * - Returns existing promise if request already in-flight
 * - Automatic cleanup after request completes
 * - Support for custom request keys
 *
 * @example
 * const deduplicator = RequestDeduplicator.getInstance();
 *
 * // Multiple calls to the same endpoint will only trigger one request
 * const promise1 = deduplicator.deduplicate('user:123', () => fetchUser('123'));
 * const promise2 = deduplicator.deduplicate('user:123', () => fetchUser('123'));
 *
 * // promise1 === promise2 (same promise instance)
 */
export class RequestDeduplicator {
  private static instance: RequestDeduplicator;

  // Track in-flight requests: Map<requestKey, Promise<Response>>
  private inFlightRequests: Map<string, Promise<any>> = new Map();

  // Statistics
  private stats = {
    totalRequests: 0,
    deduplicatedRequests: 0,
    activeRequests: 0,
  };

  private constructor() {}

  /**
   * Get singleton instance of RequestDeduplicator
   */
  public static getInstance(): RequestDeduplicator {
    if (!RequestDeduplicator.instance) {
      RequestDeduplicator.instance = new RequestDeduplicator();
    }
    return RequestDeduplicator.instance;
  }

  /**
   * Deduplicate a request
   *
   * @param key Unique key for the request (e.g., URL + method + body hash)
   * @param requestFn Function that performs the actual request
   * @returns Promise that resolves with the request result
   */
  public async deduplicate<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    this.stats.totalRequests++;

    // Check if request is already in-flight
    const existingRequest = this.inFlightRequests.get(key);

    if (existingRequest) {
      console.log(`🔄 Request DEDUPLICATED: ${key}`);
      this.stats.deduplicatedRequests++;
      return existingRequest as Promise<T>;
    }

    // Create new request
    console.log(`🌐 Request STARTED: ${key}`);
    this.stats.activeRequests++;

    const requestPromise = requestFn()
      .then((result) => {
        // Cleanup after successful completion
        this.cleanupRequest(key);
        console.log(`✅ Request COMPLETED: ${key}`);
        return result;
      })
      .catch((error) => {
        // Cleanup after error
        this.cleanupRequest(key);
        console.error(`❌ Request FAILED: ${key}`, error);
        throw error;
      });

    // Store in-flight request
    this.inFlightRequests.set(key, requestPromise);

    return requestPromise;
  }

  /**
   * Generate a request key from URL, method, and optional body
   *
   * @param url Request URL
   * @param method HTTP method (GET, POST, etc.)
   * @param body Optional request body (will be hashed)
   * @returns Unique request key
   */
  public generateKey(url: string, method: string = 'GET', body?: any): string {
    let key = `${method}:${url}`;

    if (body) {
      // Simple hash of body
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      const hash = this.simpleHash(bodyStr);
      key += `:${hash}`;
    }

    return key;
  }

  /**
   * Cancel a specific in-flight request
   * (Note: This doesn't actually abort the fetch, just removes it from tracking)
   *
   * @param key Request key
   */
  public cancel(key: string): void {
    if (this.inFlightRequests.has(key)) {
      this.inFlightRequests.delete(key);
      this.stats.activeRequests--;
      console.log(`🚫 Request CANCELLED: ${key}`);
    }
  }

  /**
   * Clear all in-flight requests
   */
  public clear(): void {
    const count = this.inFlightRequests.size;
    this.inFlightRequests.clear();
    this.stats.activeRequests = 0;
    console.log(`🗑️ Cleared ${count} in-flight requests`);
  }

  /**
   * Get deduplication statistics
   */
  public getStats() {
    return {
      ...this.stats,
      deduplicationRate:
        this.stats.totalRequests === 0
          ? 0
          : (this.stats.deduplicatedRequests / this.stats.totalRequests) * 100,
    };
  }

  /**
   * Get count of active in-flight requests
   */
  public getActiveCount(): number {
    return this.inFlightRequests.size;
  }

  /**
   * Check if a request is currently in-flight
   */
  public isInFlight(key: string): boolean {
    return this.inFlightRequests.has(key);
  }

  /**
   * Cleanup completed request
   */
  private cleanupRequest(key: string): void {
    this.inFlightRequests.delete(key);
    this.stats.activeRequests--;
  }

  /**
   * Simple hash function for request bodies
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Reset statistics
   */
  public resetStats(): void {
    this.stats = {
      totalRequests: 0,
      deduplicatedRequests: 0,
      activeRequests: this.inFlightRequests.size,
    };
  }
}

// Export singleton instance
export const requestDeduplicator = RequestDeduplicator.getInstance();
