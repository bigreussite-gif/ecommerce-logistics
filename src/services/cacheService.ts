type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

class CacheService {
  private cache: Record<string, CacheEntry<any>> = {};
  
  // Default TTL: 5 minutes (in ms)
  private defaultTTL = 5 * 60 * 1000;

  get<T>(key: string): T | null {
    const entry = this.cache[key];
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.defaultTTL) {
      delete this.cache[key];
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, customTTL?: number): void {
    this.cache[key] = {
      data,
      timestamp: Date.now()
    };
    
    if (customTTL !== undefined) {
      setTimeout(() => this.invalidate(key), customTTL);
    }
  }

  invalidate(key: string): void {
    delete this.cache[key];
  }

  invalidatePrefix(prefix: string): void {
    Object.keys(this.cache).forEach(key => {
      if (key.startsWith(prefix)) {
        delete this.cache[key];
      }
    });
  }

  clear(): void {
    this.cache = {};
  }
}

export const appCache = new CacheService();
